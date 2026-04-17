use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scene {
    pub id: i64,
    pub name: String,
    pub icon: Option<String>,
    pub color: String,
    pub sort_order: i64,
    pub track_time: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateScene {
    pub name: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub track_time: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateScene {
    pub id: i64,
    pub name: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i64>,
    pub track_time: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneApp {
    pub scene_id: i64,
    pub app_id: i64,
    pub priority: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSession {
    pub id: i64,
    pub scene_id: Option<i64>,
    pub app_id: Option<i64>,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub duration_secs: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneTimeSummary {
    pub scene_id: i64,
    pub scene_name: String,
    pub color: String,
    pub total_secs: i64,
    pub percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppTimeDetail {
    pub app_id: i64,
    pub app_name: String,
    pub total_secs: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackingStatus {
    pub paused: bool,
    pub current_scene_id: Option<i64>,
    pub current_scene_name: Option<String>,
    pub session_started_at: Option<String>,
}
