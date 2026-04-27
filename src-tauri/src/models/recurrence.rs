use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurrenceRule {
    pub id: i64,
    pub rrule: String,
    pub dtstart: String,
    pub next_due: Option<String>,
    pub end_date: Option<String>,
    pub max_count: Option<i64>,
    pub completed_count: i64,
    pub expired: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRecurrenceRule {
    pub rrule: String,
    pub dtstart: String,
    pub end_date: Option<String>,
    pub max_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RruleDescribeResult {
    pub valid: bool,
    pub description: Option<String>,
    pub error: Option<String>,
    pub preview_dates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimplifiedRecurrenceInput {
    pub freq: String,
    pub interval: Option<i64>,
    pub by_day: Option<Vec<String>>,
    pub by_month_day: Option<i64>,
    pub by_set_pos: Option<i64>,
    pub end_date: Option<String>,
    pub max_count: Option<i64>,
}
