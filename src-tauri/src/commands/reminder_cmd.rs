use std::sync::Arc;
use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::reminder_repo;

#[tauri::command]
pub fn create_reminder(
    db: State<'_, Arc<Database>>,
    input: CreateReminder,
) -> Result<Reminder, String> {
    reminder_repo::create_reminder(&db, input)
}

#[tauri::command]
pub fn list_reminders_by_todo(
    db: State<'_, Arc<Database>>,
    todo_id: i64,
) -> Result<Vec<Reminder>, String> {
    reminder_repo::list_reminders_by_todo(&db, todo_id)
}

#[tauri::command]
pub fn update_reminder(
    db: State<'_, Arc<Database>>,
    input: UpdateReminder,
) -> Result<Reminder, String> {
    reminder_repo::update_reminder(&db, input)
}

#[tauri::command]
pub fn delete_reminder(
    db: State<'_, Arc<Database>>,
    id: i64,
) -> Result<(), String> {
    reminder_repo::delete_reminder(&db, id)
}

#[tauri::command]
pub fn snooze_reminder(
    db: State<'_, Arc<Database>>,
    input: SnoozeInput,
) -> Result<(), String> {
    reminder_repo::snooze_reminder(&db, input.queue_id, input.snooze_minutes)
}

#[tauri::command]
pub fn dismiss_reminder(
    db: State<'_, Arc<Database>>,
    id: i64,
) -> Result<(), String> {
    reminder_repo::dismiss_reminder(&db, id)
}
