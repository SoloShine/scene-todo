use std::sync::Arc;
use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::todo_repo::{self, TodoFilters};
use crate::services::recurrence_repo;

#[tauri::command]
pub fn create_todo(db: State<'_, Arc<Database>>, input: CreateTodo) -> Result<Todo, String> {
    todo_repo::create_todo(&db, input)
}

#[tauri::command]
pub fn list_todos(db: State<'_, Arc<Database>>, filters: TodoFilters) -> Result<Vec<Todo>, String> {
    todo_repo::list_todos(&db, filters)
}

#[tauri::command]
pub fn list_todos_with_details(db: State<'_, Arc<Database>>, filters: TodoFilters) -> Result<Vec<TodoWithDetails>, String> {
    todo_repo::list_todos_with_details(&db, filters)
}

#[tauri::command]
pub fn get_todo(db: State<'_, Arc<Database>>, id: i64) -> Result<Todo, String> {
    todo_repo::get_todo(&db, id)
}

#[tauri::command]
pub fn update_todo(db: State<'_, Arc<Database>>, input: UpdateTodo) -> Result<Todo, String> {
    todo_repo::update_todo(&db, input)
}

#[tauri::command]
pub fn delete_todo(db: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    todo_repo::delete_todo(&db, id)
}

#[tauri::command]
pub fn get_todo_with_details(db: State<'_, Arc<Database>>, id: i64) -> Result<TodoWithDetails, String> {
    todo_repo::get_todo_with_details(&db, id)
}

#[tauri::command]
pub fn list_todos_by_app(db: State<'_, Arc<Database>>, app_id: i64) -> Result<Vec<TodoWithDetails>, String> {
    todo_repo::list_todos_by_app(&db, app_id)
}

#[tauri::command]
pub fn add_tag_to_todo(db: State<'_, Arc<Database>>, todo_id: i64, tag_id: i64) -> Result<(), String> {
    todo_repo::add_tag_to_todo(&db, todo_id, tag_id)
}

#[tauri::command]
pub fn remove_tag_from_todo(db: State<'_, Arc<Database>>, todo_id: i64, tag_id: i64) -> Result<(), String> {
    todo_repo::remove_tag_from_todo(&db, todo_id, tag_id)
}

#[tauri::command]
pub fn complete_todo(db: State<'_, Arc<Database>>, id: i64, status: String) -> Result<Todo, String> {
    let todo = todo_repo::update_todo(&db, UpdateTodo {
        id,
        title: None,
        description: None,
        status: Some(status.clone()),
        priority: None,
        group_id: None,
        due_date: None,
        recurrence_rule_id: None,
    })?;

    if status == "completed" || status == "abandoned" {
        if let Some(rule_id) = todo.recurrence_rule_id {
            let _new_id = recurrence_repo::generate_next_instance(&db, id, rule_id)?;
        }
    }

    Ok(todo)
}
