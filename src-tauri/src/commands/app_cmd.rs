use std::sync::Arc;
use tauri::State;
use crate::models::*;
use crate::services::app_repo;
use crate::services::db::Database;
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
