use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct App {
    pub id: i64,
    pub name: String,
    pub process_names: String,  // JSON array, e.g. '["WINWORD.EXE"]'
    pub icon_path: Option<String>,
    pub display_name: Option<String>,
    pub show_widget: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApp {
    pub name: String,
    pub process_names: Vec<String>,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateApp {
    pub id: i64,
    pub name: Option<String>,
    pub process_names: Option<Vec<String>>,
    pub display_name: Option<String>,
    pub show_widget: Option<bool>,
    pub icon_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoAppBinding {
    pub id: i64,
    pub todo_id: i64,
    pub app_id: i64,
}
