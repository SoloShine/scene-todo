use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow};
use windows::Win32::Foundation::HWND;

use crate::services::process_matcher;
use crate::services::todo_repo;
use crate::services::window_monitor::ForegroundChanged;
use crate::services::db::Database;

pub struct WidgetManager {
    active_widgets: Mutex<HashMap<i64, String>>,
    widget_offsets: Mutex<HashMap<i64, (i32, i32)>>,
    db: Arc<Database>,
}

impl WidgetManager {
    pub fn new(db: Arc<Database>) -> Self {
        Self {
            active_widgets: Mutex::new(HashMap::new()),
            widget_offsets: Mutex::new(HashMap::new()),
            db,
        }
    }

    pub fn handle_foreground_change(
        &self,
        app_handle: &AppHandle,
        event: &ForegroundChanged,
    ) {
        let active = self.active_widgets.lock().unwrap();
        let target_label = event.app_id.map(|id| format!("widget-{}", id));

        // Hide widgets that are NOT the target (no flicker for the target)
        for (_, label) in active.iter() {
            if target_label.as_ref() != Some(label) {
                if let Some(win) = app_handle.get_webview_window(label) {
                    let _ = win.hide();
                }
            }
        }
        drop(active);

        if let (Some(app_id), Some(app_name), hwnd_value) =
            (event.app_id, &event.app_name, event.hwnd)
        {
            let target_hwnd = HWND(hwnd_value as *mut _);

            // Check if there are pending todos for this app
            match todo_repo::list_todos_by_app(&self.db, app_id) {
                Ok(todos) if todos.is_empty() => return,
                Err(_) => return,
                _ => {}
            }

            let label = format!("widget-{}", app_id);
            let mut active = self.active_widgets.lock().unwrap();

            if !active.contains_key(&app_id) {
                let url = format!(
                    "/widget?app_id={}&app_name={}",
                    app_id,
                    urlencoding(app_name)
                );
                let widget_window = WebviewWindow::builder(
                    app_handle,
                    &label,
                    WebviewUrl::App(url.into()),
                )
                .title(&format!("{} - Widget", app_name))
                .inner_size(260.0, 300.0)
                .decorations(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .transparent(true)
                .build();

                match widget_window {
                    Ok(win) => {
                        self.position_widget(&win, target_hwnd, app_id);
                        active.insert(app_id, label);
                    }
                    Err(e) => {
                        eprintln!("Failed to create widget window: {}", e);
                    }
                }
            } else {
                if let Some(win) = app_handle.get_webview_window(&label) {
                    let _ = win.show();
                    self.position_widget(&win, target_hwnd, app_id);
                }
            }
        }
    }

    fn position_widget(&self, widget: &WebviewWindow, target_hwnd: HWND, app_id: i64) {
        if let Some((x, y, _w, _h)) = process_matcher::get_window_rect(target_hwnd) {
            // Default: top-left corner of target window, just below the title bar
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

    pub fn destroy_widget(&self, app_handle: &AppHandle, app_id: i64) {
        let mut active = self.active_widgets.lock().unwrap();
        if let Some(label) = active.remove(&app_id) {
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
