use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow};
use windows::Win32::Foundation::HWND;

use crate::services::app_repo;
use crate::services::process_matcher;
use crate::services::scene_repo;
use crate::services::window_monitor::ForegroundChanged;
use crate::services::db::Database;

pub struct WidgetManager {
    active_widgets: Mutex<HashMap<i64, String>>,  // scene_id -> label
    widget_offsets: Mutex<HashMap<i64, (i32, i32)>>,  // app_id -> offset (kept per-app)
    default_size: Mutex<(f64, f64)>,
    db: Arc<Database>,
}

impl WidgetManager {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            active_widgets: Mutex::new(HashMap::new()),
            widget_offsets: Mutex::new(HashMap::new()),
            default_size: Mutex::new((260.0, 300.0)),
            db,
        }
    }

    pub fn handle_foreground_change(
        &self,
        app_handle: &AppHandle,
        event: &ForegroundChanged,
    ) {
        // If no scene, hide all widgets
        if event.scene_id.is_none() {
            let active = self.active_widgets.lock().unwrap();
            for (_, label) in active.iter() {
                if let Some(win) = app_handle.get_webview_window(label) {
                    let _ = win.hide();
                }
            }
            return;
        }

        let scene_id = event.scene_id.unwrap();
        let scene_name = event.scene_name.as_deref().unwrap_or("Unknown");
        let app_id = event.app_id;
        let target_label = format!("widget-scene-{}", scene_id);

        // Hide widgets for other scenes
        let active = self.active_widgets.lock().unwrap();
        for (_, label) in active.iter() {
            if *label != target_label {
                if let Some(win) = app_handle.get_webview_window(label) {
                    let _ = win.hide();
                }
            }
        }
        drop(active);

        // Check if scene has pending todos
        match scene_repo::list_todos_by_scene(&self.db, scene_id) {
            Ok(todos) if todos.is_empty() => return,
            Err(_) => return,
            _ => {}
        }

        // Check if the matched app has show_widget enabled
        if let Some(app_id) = event.app_id {
            if let Ok(app) = app_repo::get_app(&self.db, app_id) {
                if !app.show_widget {
                    return;
                }
            }
        }

        let mut active = self.active_widgets.lock().unwrap();

        if !active.contains_key(&scene_id) {
            // Create new widget for this scene
            let url = format!(
                "/widget?scene_id={}&scene_name={}",
                scene_id,
                urlencoding(scene_name)
            );
            let (w, h) = *self.default_size.lock().unwrap();
            let widget_window = WebviewWindow::builder(
                app_handle,
                &target_label,
                WebviewUrl::App(url.into()),
            )
            .title(&format!("{} - Widget", scene_name))
            .inner_size(w, h)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .transparent(true)
            .shadow(false)
            .build();

            match widget_window {
                Ok(win) => {
                    if event.hwnd != 0 {
                        let target_hwnd = HWND(event.hwnd as *mut _);
                        let offset_app_id = app_id.unwrap_or(scene_id);
                        self.position_widget(&win, target_hwnd, offset_app_id);
                    }
                    active.insert(scene_id, target_label);
                }
                Err(e) => {
                    eprintln!("Failed to create widget window: {}", e);
                }
            }
        } else {
            // Widget already exists — reposition to new app window
            if let Some(win) = app_handle.get_webview_window(&target_label) {
                let (w, h) = *self.default_size.lock().unwrap();
                let _ = win.set_size(tauri::Size::Physical(
                    tauri::PhysicalSize::new(w as u32, h as u32),
                ));
                let _ = win.show();
                if event.hwnd != 0 {
                    let target_hwnd = HWND(event.hwnd as *mut _);
                    let offset_app_id = app_id.unwrap_or(scene_id);
                    self.position_widget(&win, target_hwnd, offset_app_id);
                }
            }
        }
    }

    fn position_widget(&self, widget: &WebviewWindow, target_hwnd: HWND, app_id: i64) {
        if let Some((x, y, _w, _h)) = process_matcher::get_window_rect(target_hwnd) {
            let title_bar_h = 32;
            let padding = 8;
            let (dx, dy) = self
                .widget_offsets
                .lock()
                .unwrap()
                .get(&app_id)
                .copied()
                .unwrap_or((padding, title_bar_h));

            let _ = widget.set_position(tauri::Position::Physical(
                tauri::PhysicalPosition::new(x + dx, y + dy),
            ));
        }
    }

    pub fn save_offset(&self, app_id: i64, offset: (i32, i32)) {
        self.widget_offsets.lock().unwrap().insert(app_id, offset);
    }

    pub fn set_default_size(&self, size: (f64, f64)) {
        *self.default_size.lock().unwrap() = size;
    }

    pub fn destroy_widget(&self, app_handle: &AppHandle, scene_id: i64) {
        let mut active = self.active_widgets.lock().unwrap();
        if let Some(label) = active.remove(&scene_id) {
            if let Some(win) = app_handle.get_webview_window(&label) {
                let _ = win.close();
            }
        }
    }
}

fn urlencoding(s: &str) -> String {
    s.bytes()
        .flat_map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![b as char]
            }
            _ => format!("%{:02X}", b).chars().collect(),
        })
        .collect()
}
