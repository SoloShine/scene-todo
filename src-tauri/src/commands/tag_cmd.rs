use std::sync::Arc;
use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::tag_repo;

#[tauri::command]
pub fn create_tag(db: State<'_, Arc<Database>>, input: CreateTag) -> Result<Tag, String> {
    tag_repo::create_tag(&db, input)
}

#[tauri::command]
pub fn list_tags(db: State<'_, Arc<Database>>) -> Result<Vec<Tag>, String> {
    tag_repo::list_tags(&db)
}

#[tauri::command]
pub fn update_tag(db: State<'_, Arc<Database>>, input: UpdateTag) -> Result<Tag, String> {
    tag_repo::update_tag(&db, input)
}

#[tauri::command]
pub fn delete_tag(db: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    tag_repo::delete_tag(&db, id)
}
