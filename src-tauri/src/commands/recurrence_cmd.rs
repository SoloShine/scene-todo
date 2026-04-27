use std::sync::Arc;
use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::recurrence_repo;
use crate::services::rrule_service;
use crate::services::todo_repo;

#[tauri::command]
pub fn create_recurrence_rule(
    db: State<'_, Arc<Database>>,
    input: CreateRecurrenceRule,
) -> Result<RecurrenceRule, String> {
    recurrence_repo::create_recurrence_rule(&db, input)
}

#[tauri::command]
pub fn get_recurrence_rule(
    db: State<'_, Arc<Database>>,
    id: i64,
) -> Result<RecurrenceRule, String> {
    recurrence_repo::get_recurrence_rule(&db, id)
}

#[tauri::command]
pub fn delete_recurrence_rule(
    db: State<'_, Arc<Database>>,
    id: i64,
) -> Result<(), String> {
    recurrence_repo::delete_recurrence_rule(&db, id)
}

#[tauri::command]
pub fn describe_rrule(rrule: String) -> Result<RruleDescribeResult, String> {
    Ok(rrule_service::describe_rrule(&rrule))
}

#[tauri::command]
pub fn simplified_to_rrule(input: SimplifiedRecurrenceInput) -> Result<String, String> {
    rrule_service::simplified_to_rrule(&input)
}

/// Set or clear recurrence rule for a todo.
/// If `input` is Some, create a new rule and assign it to the todo.
/// If `input` is None, remove the recurrence rule from the todo.
#[tauri::command]
pub fn set_todo_recurrence(
    db: State<'_, Arc<Database>>,
    todo_id: i64,
    input: Option<CreateRecurrenceRule>,
) -> Result<Todo, String> {
    if let Some(rule_input) = input {
        // Create rule and assign to todo
        let rule = recurrence_repo::create_recurrence_rule(&db, rule_input)?;
        todo_repo::update_todo(
            &db,
            UpdateTodo {
                id: todo_id,
                title: None,
                description: None,
                status: None,
                priority: None,
                group_id: None,
                due_date: None,
                recurrence_rule_id: Some(rule.id),
            },
        )
    } else {
        // Clear recurrence: delete the existing rule and clear the field
        let todo = todo_repo::get_todo(&db, todo_id)?;
        if let Some(rule_id) = todo.recurrence_rule_id {
            recurrence_repo::delete_recurrence_rule(&db, rule_id)?;
        }
        todo_repo::update_todo(
            &db,
            UpdateTodo {
                id: todo_id,
                title: None,
                description: None,
                status: None,
                priority: None,
                group_id: None,
                due_date: None,
                recurrence_rule_id: Some(0), // Setting to 0 will be stored as 0
            },
        )
    }
}
