use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

use crate::services::app_repo;
use crate::services::db::Database;
use crate::services::process_matcher;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ForegroundChanged {
    pub process_name: String,
    pub app_id: Option<i64>,
    pub app_name: Option<String>,
    pub hwnd: isize,
}

pub struct WindowMonitor {
    app_handle: AppHandle,
    db: Arc<Database>,
    running: Arc<Mutex<bool>>,
    last_hwnd: Arc<Mutex<isize>>,
}

impl WindowMonitor {
    pub fn new(app_handle: AppHandle, db: Arc<Database>) -> Self {
        Self {
            app_handle,
            db,
            running: Arc::new(Mutex::new(false)),
            last_hwnd: Arc::new(Mutex::new(0)),
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
        let running_flag = self.running.clone();
        let last_hwnd = self.last_hwnd.clone();

        std::thread::spawn(move || {
            loop {
                {
                    let r = running_flag.lock().unwrap();
                    if !*r {
                        break;
                    }
                }

                let foreground: HWND = unsafe { GetForegroundWindow() };
                let current_hwnd = foreground.0 as isize;

                {
                    let mut last = last_hwnd.lock().unwrap();
                    if *last != current_hwnd && current_hwnd != 0 {
                        *last = current_hwnd;

                        if let Some(process_name) =
                            process_matcher::get_process_name_from_hwnd(foreground)
                        {
                            let db_conn = db.conn.lock().unwrap();
                            let matched_app =
                                app_repo::find_app_by_process_conn(&db_conn, &process_name);
                            drop(db_conn);

                            let event = ForegroundChanged {
                                process_name: process_name.clone(),
                                app_id: matched_app.as_ref().map(|a| a.id),
                                app_name: matched_app.as_ref().map(|a| a.name.clone()),
                                hwnd: current_hwnd,
                            };

                            let _ = app_handle.emit("foreground-changed", &event);
                        }
                    }
                }

                std::thread::sleep(Duration::from_millis(200));
            }
        });
    }

    pub fn stop(&self) {
        let mut running = self.running.lock().unwrap();
        *running = false;
    }

    pub fn is_running(&self) -> bool {
        *self.running.lock().unwrap()
    }
}
