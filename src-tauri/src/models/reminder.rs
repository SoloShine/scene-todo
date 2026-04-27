use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reminder {
    pub id: i64,
    pub todo_id: i64,
    #[serde(rename = "type")]
    pub r#type: String,
    pub offset_minutes: Option<i64>,
    pub absolute_at: Option<String>,
    pub label: Option<String>,
    pub notify_in_app: bool,
    pub notify_system: bool,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateReminder {
    pub todo_id: i64,
    #[serde(rename = "type")]
    pub r#type: String,
    pub offset_minutes: Option<i64>,
    pub absolute_at: Option<String>,
    pub label: Option<String>,
    pub notify_in_app: Option<bool>,
    pub notify_system: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateReminder {
    pub id: i64,
    pub offset_minutes: Option<i64>,
    pub absolute_at: Option<String>,
    pub label: Option<String>,
    pub notify_in_app: Option<bool>,
    pub notify_system: Option<bool>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReminderQueueItem {
    pub id: i64,
    pub todo_id: i64,
    pub reminder_id: i64,
    pub trigger_at: String,
    pub status: String,
    pub snooze_until: Option<String>,
    pub todo_title: Option<String>,
    pub todo_priority: Option<String>,
    pub todo_due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnoozeInput {
    pub queue_id: i64,
    pub snooze_minutes: i64,
}
