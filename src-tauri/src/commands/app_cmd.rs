use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::app_repo;

#[tauri::command]
pub fn create_app(db: State<Database>, input: CreateApp) -> Result<App, String> {
    app_repo::create_app(&db, input)
}

#[tauri::command]
pub fn list_apps(db: State<Database>) -> Result<Vec<App>, String> {
    app_repo::list_apps(&db)
}

#[tauri::command]
pub fn update_app(db: State<Database>, input: UpdateApp) -> Result<App, String> {
    app_repo::update_app(&db, input)
}

#[tauri::command]
pub fn delete_app(db: State<Database>, id: i64) -> Result<(), String> {
    app_repo::delete_app(&db, id)
}

#[tauri::command]
pub fn bind_todo_to_app(db: State<Database>, todo_id: i64, app_id: i64) -> Result<(), String> {
    app_repo::bind_todo_to_app(&db, todo_id, app_id)
}

#[tauri::command]
pub fn unbind_todo_from_app(db: State<Database>, todo_id: i64, app_id: i64) -> Result<(), String> {
    app_repo::unbind_todo_from_app(&db, todo_id, app_id)
}
