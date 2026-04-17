use std::sync::Arc;
use tauri::{Manager, State};
use crate::models::*;
use crate::services::app_repo;
use crate::services::db::Database;
use crate::services::process_matcher;
use crate::services::widget_manager::WidgetManager;
use crate::services::window_monitor::WindowMonitor;

#[tauri::command]
pub fn create_app(db: State<'_, Arc<Database>>, input: CreateApp) -> Result<App, String> {
    app_repo::create_app(&db, input)
}

#[tauri::command]
pub fn list_apps(db: State<'_, Arc<Database>>) -> Result<Vec<App>, String> {
    app_repo::list_apps(&db)
}

#[tauri::command]
pub fn update_app(db: State<'_, Arc<Database>>, input: UpdateApp) -> Result<App, String> {
    app_repo::update_app(&db, input)
}

#[tauri::command]
pub fn delete_app(db: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    app_repo::delete_app(&db, id)
}

#[tauri::command]
pub fn bind_todo_to_app(db: State<'_, Arc<Database>>, todo_id: i64, app_id: i64) -> Result<(), String> {
    app_repo::bind_todo_to_app(&db, todo_id, app_id)
}

#[tauri::command]
pub fn unbind_todo_from_app(db: State<'_, Arc<Database>>, todo_id: i64, app_id: i64) -> Result<(), String> {
    app_repo::unbind_todo_from_app(&db, todo_id, app_id)
}

#[tauri::command]
pub fn start_window_monitor(monitor: State<'_, WindowMonitor>) -> Result<(), String> {
    monitor.start();
    Ok(())
}

#[tauri::command]
pub fn stop_window_monitor(monitor: State<'_, WindowMonitor>) -> Result<(), String> {
    monitor.stop();
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CapturedWindow {
    pub process_name: String,
    pub window_title: String,
}

/// Synchronous capture: hides window, waits for foreground change, returns result directly.
#[tauri::command]
pub fn start_window_capture(app: tauri::AppHandle) -> Result<CapturedWindow, String> {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }

    let (tx, rx) = std::sync::mpsc::channel::<CapturedWindow>();
    let app_restore = app.clone();

    std::thread::spawn(move || {
        use windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow;

        std::thread::sleep(std::time::Duration::from_millis(500));
        let initial_fg = unsafe { GetForegroundWindow() };

        let target_hwnd = loop {
            std::thread::sleep(std::time::Duration::from_millis(100));
            let fg = unsafe { GetForegroundWindow() };
            if fg != initial_fg && !fg.is_invalid() {
                break fg;
            }
        };

        let process_name = process_matcher::get_process_name_from_hwnd(target_hwnd)
            .unwrap_or_default();
        let window_title = process_matcher::get_window_title(target_hwnd)
            .unwrap_or_default();

        if let Some(win) = app_restore.get_webview_window("main") {
            let _ = win.show();
            let _ = win.set_focus();
        }

        let _ = tx.send(CapturedWindow { process_name, window_title });
    });

    rx.recv().map_err(|e| format!("Capture failed: {}", e))
}

#[tauri::command]
pub fn save_widget_offset(
    widget_mgr: State<'_, WidgetManager>,
    app_id: i64,
    offset_x: i32,
    offset_y: i32,
) -> Result<(), String> {
    widget_mgr.save_offset(app_id, (offset_x, offset_y));
    Ok(())
}

#[tauri::command]
pub fn hide_widget(app: tauri::AppHandle, app_id: i64) -> Result<(), String> {
    let label = format!("widget-{}", app_id);
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.hide();
    }
    Ok(())
}
