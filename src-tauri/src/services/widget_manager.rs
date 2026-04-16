use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow};
use windows::Win32::Foundation::HWND;

use crate::services::process_matcher;
use crate::services::window_monitor::ForegroundChanged;

pub struct WidgetManager {
    active_widgets: Mutex<HashMap<i64, String>>,
    widget_offsets: Mutex<HashMap<i64, (i32, i32)>>,
}

impl WidgetManager {
    pub fn new() -> Self {
        Self {
            active_widgets: Mutex::new(HashMap::new()),
            widget_offsets: Mutex::new(HashMap::new()),
        }
    }

    pub fn handle_foreground_change(
        &self,
        app_handle: &AppHandle,
        event: &ForegroundChanged,
    ) {
        let active = self.active_widgets.lock().unwrap();
        for (_, label) in active.iter() {
            if let Some(win) = app_handle.get_webview_window(label) {
                let _ = win.hide();
            }
        }
        drop(active);

        if let (Some(app_id), Some(app_name), hwnd_value) =
            (event.app_id, &event.app_name, event.hwnd)
        {
            let target_hwnd = HWND(hwnd_value as *mut _);
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
                .inner_size(280.0, 320.0)
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
                        return;
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
        if let Some((_x, _y, w, _h)) = process_matcher::get_window_rect(target_hwnd) {
            let offset = self
                .widget_offsets
                .lock()
                .unwrap()
                .get(&app_id)
                .copied()
                .unwrap_or((-290, 10));

            let widget_x = w + offset.0;
            let widget_y = offset.1;
            let _ = widget.set_position(tauri::Position::Physical(
                tauri::PhysicalPosition::new(widget_x, widget_y),
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

/// Simple URL percent-encoding for safe passage of app_name in query strings.
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
