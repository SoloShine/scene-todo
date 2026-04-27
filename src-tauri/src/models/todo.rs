use serde::{Deserialize, Serialize};
use crate::models::{Tag, RecurrenceRule, Reminder};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub group_id: Option<i64>,
    pub parent_id: Option<i64>,
    pub sort_order: i64,
    pub due_date: Option<String>,
    pub recurrence_rule_id: Option<i64>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTodo {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub group_id: Option<i64>,
    pub parent_id: Option<i64>,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTodo {
    pub id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub group_id: Option<i64>,
    pub due_date: Option<String>,
    pub recurrence_rule_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoWithDetails {
    #[serde(flatten)]
    pub todo: Todo,
    pub tags: Vec<Tag>,
    pub sub_tasks: Vec<Todo>,
    pub bound_scene_ids: Vec<i64>,
    pub recurrence_rule: Option<RecurrenceRule>,
    pub reminders: Vec<Reminder>,
}
