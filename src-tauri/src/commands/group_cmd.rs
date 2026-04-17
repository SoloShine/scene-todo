use std::sync::Arc;
use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::group_repo;

#[tauri::command]
pub fn create_group(db: State<'_, Arc<Database>>, input: CreateGroup) -> Result<Group, String> {
    group_repo::create_group(&db, input)
}

#[tauri::command]
pub fn list_groups(db: State<'_, Arc<Database>>) -> Result<Vec<Group>, String> {
    group_repo::list_groups(&db)
}

#[tauri::command]
pub fn update_group(db: State<'_, Arc<Database>>, input: UpdateGroup) -> Result<Group, String> {
    group_repo::update_group(&db, input)
}

#[tauri::command]
pub fn delete_group(db: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    group_repo::delete_group(&db, id)
}
