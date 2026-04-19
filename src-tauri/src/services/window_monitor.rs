use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

use crate::models::App;
use crate::services::app_repo;
use crate::services::db::Database;
use crate::services::process_matcher;
use crate::services::scene_repo;
use crate::services::time_tracker::TimeTracker;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ForegroundChanged {
    pub process_name: String,
    pub app_id: Option<i64>,
    pub app_name: Option<String>,
    pub scene_id: Option<i64>,
    pub scene_name: Option<String>,
    pub hwnd: isize,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct WindowMoved {
    pub hwnd: isize,
}

pub struct WindowMonitor {
    app_handle: AppHandle,
    db: Arc<Database>,
    time_tracker: Arc<TimeTracker>,
    running: Arc<Mutex<bool>>,
    last_hwnd: Arc<Mutex<isize>>,
    last_active_scene_id: Arc<Mutex<Option<i64>>>,
    tracked_hwnd: Arc<Mutex<isize>>,
    our_pid: u32,
    app_cache: Arc<Mutex<HashMap<String, App>>>,
    app_cache_updated: Arc<Mutex<Instant>>,
}

impl WindowMonitor {
    pub fn new(
        app_handle: AppHandle,
        db: Arc<Database>,
        time_tracker: Arc<TimeTracker>,
    ) -> Self {
        Self {
            app_handle,
            db,
            time_tracker,
            running: Arc::new(Mutex::new(false)),
            last_hwnd: Arc::new(Mutex::new(0)),
            last_active_scene_id: Arc::new(Mutex::new(None)),
            tracked_hwnd: Arc::new(Mutex::new(0)),
            our_pid: std::process::id(),
            app_cache: Arc::new(Mutex::new(HashMap::new())),
            app_cache_updated: Arc::new(Mutex::new(Instant::now() - Duration::from_secs(300))),
        }
    }

    pub fn start(&self) {
        let mut running = self.running.lock().unwrap();
        if *running {
            return;
        }
        *running = true;

        let app_handle = self.app_handle.clone();
        let db = self.db.clone();
        let time_tracker = self.time_tracker.clone();
        let running_flag = self.running.clone();
        let last_hwnd = self.last_hwnd.clone();
        let last_active_scene_id = self.last_active_scene_id.clone();
        let tracked_hwnd = self.tracked_hwnd.clone();
        let our_pid = self.our_pid;
        let app_cache = self.app_cache.clone();
        let app_cache_updated_arc = self.app_cache_updated.clone();

        std::thread::spawn(move || {
            let mut last_tracked_pos: Option<(i32, i32)> = None;
            let mut pending_hwnd: Option<isize> = None;
            let mut pending_since: Option<Instant> = None;
            let debounce = Duration::from_millis(500);

            loop {
                {
                    let r = running_flag.lock().unwrap();
                    if !*r {
                        break;
                    }
                }

                let foreground: HWND = unsafe { GetForegroundWindow() };
                let current_hwnd = foreground.0 as isize;

                // Debounce: wait for window to stay stable before acting
                {
                    let last = *last_hwnd.lock().unwrap();
                    if current_hwnd != 0 && current_hwnd != last {
                        if pending_hwnd != Some(current_hwnd) {
                            pending_hwnd = Some(current_hwnd);
                            pending_since = Some(Instant::now());
                        }
                        // Not yet stable — skip processing this cycle
                        if pending_since.map(|t| t.elapsed()) < Some(debounce) {
                            // Still check for window moves below
                            pending_hwnd = None;
                            pending_since = None;
                            std::thread::sleep(Duration::from_millis(200));
                            continue;
                        }
                        // Stable — proceed with the foreground change
                        pending_hwnd = None;
                        pending_since = None;
                    } else {
                        // Same window or zero — cancel any pending debounce
                        pending_hwnd = None;
                        pending_since = None;
                    }
                }

                {
                    let mut last = last_hwnd.lock().unwrap();
                    if *last != current_hwnd && current_hwnd != 0 {
                        *last = current_hwnd;

                        let mut fg_pid: u32 = 0;
                        unsafe {
                            GetWindowThreadProcessId(foreground, Some(&mut fg_pid));
                        }

                        if fg_pid == our_pid {
                            let is_main = app_handle
                                .get_webview_window("main")
                                .map(|w| {
                                    use tauri::Window;
                                    w.hwnd().map(|h| h.0 as isize == current_hwnd).unwrap_or(false)
                                })
                                .unwrap_or(false);

                            if is_main {
                                *last_active_scene_id.lock().unwrap() = None;
                                time_tracker.end_current_session();
                                *tracked_hwnd.lock().unwrap() = 0;
                                last_tracked_pos = None;

                                let event = ForegroundChanged {
                                    process_name: String::new(),
                                    app_id: None,
                                    app_name: None,
                                    scene_id: None,
                                    scene_name: None,
                                    hwnd: current_hwnd,
                                };
                                let _ = app_handle.emit("foreground-changed", &event);
                            }
                            // Widget window focused — skip entirely (no flicker)
                            continue;
                        }

                        if let Some(process_name) =
                            process_matcher::get_process_name_from_hwnd(foreground)
                        {
                            // Use cached app lookup instead of per-call DB query
                            {
                                let mut updated = app_cache_updated_arc.lock().unwrap();
                                if updated.elapsed() > Duration::from_secs(30) {
                                    let apps = app_repo::list_apps(&db).unwrap_or_default();
                                    let mut cache = HashMap::new();
                                    for app in apps {
                                        if let Ok(names) = serde_json::from_str::<Vec<String>>(&app.process_names) {
                                            for name in names {
                                                cache.insert(name.to_lowercase(), app.clone());
                                            }
                                        }
                                    }
                                    *app_cache.lock().unwrap() = cache;
                                    *updated = Instant::now();
                                }
                            }
                            let matched_app = app_cache.lock().unwrap().get(&process_name.to_lowercase()).cloned();

                            // Resolve scene from matched app
                            let resolved_scene =
                                if let Some(ref app) = matched_app {
                                    let scenes =
                                        scene_repo::find_scenes_by_app_id(&db, app.id)
                                            .unwrap_or_default();
                                    if scenes.is_empty() {
                                        None
                                    } else {
                                        // 1. Try last active scene
                                        let last_active =
                                            *last_active_scene_id.lock().unwrap();
                                        let chosen = scenes
                                            .iter()
                                            .find(|(s, _)| Some(s.id) == last_active)
                                            .or_else(|| scenes.first()) // 2. Fallback: highest priority (first, already sorted)
                                            .map(|(s, _)| s.clone());
                                        if let Some(ref scene) = chosen {
                                            *last_active_scene_id.lock().unwrap() =
                                                Some(scene.id);
                                        }
                                        chosen
                                    }
                                } else {
                                    // No matching app — clear active scene
                                    *last_active_scene_id.lock().unwrap() = None;
                                    time_tracker.end_current_session();
                                    None
                                };

                            // Handle time tracking
                            if let Some(ref scene) = resolved_scene {
                                let track_time = scene.track_time;
                                let app_id =
                                    matched_app.as_ref().map(|a| a.id).unwrap_or(0);
                                time_tracker.start_session(scene.id, app_id, track_time);
                            } else {
                                time_tracker.end_current_session();
                            }

                            // Track this hwnd for move events
                            if matched_app.is_some() {
                                *tracked_hwnd.lock().unwrap() = current_hwnd;
                                last_tracked_pos = process_matcher::get_window_rect(foreground)
                                    .map(|(x, y, _, _)| (x, y));
                            } else {
                                *tracked_hwnd.lock().unwrap() = 0;
                                last_tracked_pos = None;
                            }

                            let event = ForegroundChanged {
                                process_name: process_name.clone(),
                                app_id: matched_app.as_ref().map(|a| a.id),
                                app_name: matched_app.as_ref().map(|a| a.name.clone()),
                                scene_id: resolved_scene.as_ref().map(|s| s.id),
                                scene_name: resolved_scene.as_ref().map(|s| s.name.clone()),
                                hwnd: current_hwnd,
                            };

                            let _ = app_handle.emit("foreground-changed", &event);
                        }
                    }
                }

                // Check if tracked window has moved
                {
                    let tracked = *tracked_hwnd.lock().unwrap();
                    if tracked != 0 {
                        if let Some((x, y)) = process_matcher::get_window_rect(HWND(tracked as *mut _))
                            .map(|(x, y, _, _)| (x, y))
                        {
                            let changed = match last_tracked_pos {
                                Some((lx, ly)) => lx != x || ly != y,
                                None => true,
                            };
                            if changed {
                                last_tracked_pos = Some((x, y));
                                let _ = app_handle.emit(
                                    "window-location-changed",
                                    WindowMoved { hwnd: tracked },
                                );
                            }
                        } else {
                            // Window no longer exists
                            *tracked_hwnd.lock().unwrap() = 0;
                            last_tracked_pos = None;
                        }
                    }
                }

                std::thread::sleep(Duration::from_millis(200));
            }

            // Flush the last session when the monitor thread exits
            time_tracker.end_current_session();
        });
    }

    pub fn stop(&self) {
        let mut running = self.running.lock().unwrap();
        *running = false;
    }

    pub fn is_running(&self) -> bool {
        *self.running.lock().unwrap()
    }

    pub fn get_last_active_scene_id(&self) -> Option<i64> {
        *self.last_active_scene_id.lock().unwrap()
    }

    pub fn set_last_active_scene(&self, scene_id: i64) {
        *self.last_active_scene_id.lock().unwrap() = Some(scene_id);
    }

    pub fn get_time_tracker(&self) -> &Arc<TimeTracker> {
        &self.time_tracker
    }

    pub fn set_tracked_hwnd(&self, hwnd: isize) {
        *self.tracked_hwnd.lock().unwrap() = hwnd;
    }

    pub fn get_tracked_hwnd(&self) -> isize {
        *self.tracked_hwnd.lock().unwrap()
    }

    /// Force-refresh the app cache (call after app CRUD operations).
    pub fn invalidate_app_cache(&self) {
        let apps = app_repo::list_apps(&self.db).unwrap_or_default();
        let mut cache = HashMap::new();
        for app in apps {
            if let Ok(names) = serde_json::from_str::<Vec<String>>(&app.process_names) {
                for name in names {
                    cache.insert(name.to_lowercase(), app.clone());
                }
            }
        }
        *self.app_cache.lock().unwrap() = cache;
        *self.app_cache_updated.lock().unwrap() = Instant::now();
    }
}
