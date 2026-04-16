use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub sort_order: i64,
    pub parent_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroup {
    pub name: String,
    pub color: Option<String>,
    pub parent_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateGroup {
    pub id: i64,
    pub name: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i64>,
    pub parent_id: Option<i64>,
}
