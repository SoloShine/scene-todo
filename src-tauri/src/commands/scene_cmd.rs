use std::sync::Arc;
use tauri::State;
use crate::models::*;
use crate::services::scene_repo;
use crate::services::db::Database;
use crate::services::time_tracker::TimeTracker;
use crate::services::window_monitor::WindowMonitor;

#[tauri::command]
pub fn create_scene(db: State<'_, Arc<Database>>, input: CreateScene) -> Result<Scene, String> {
    scene_repo::create_scene(&db, input)
}

#[tauri::command]
pub fn list_scenes(db: State<'_, Arc<Database>>) -> Result<Vec<Scene>, String> {
    scene_repo::list_scenes(&db)
}

#[tauri::command]
pub fn update_scene(db: State<'_, Arc<Database>>, input: UpdateScene) -> Result<Scene, String> {
    scene_repo::update_scene(&db, input)
}

#[tauri::command]
pub fn delete_scene(db: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    scene_repo::delete_scene(&db, id)
}

#[tauri::command]
pub fn add_app_to_scene(db: State<'_, Arc<Database>>, scene_id: i64, app_id: i64, priority: i32) -> Result<(), String> {
    scene_repo::add_app_to_scene(&db, scene_id, app_id, priority)
}

#[tauri::command]
pub fn remove_app_from_scene(db: State<'_, Arc<Database>>, scene_id: i64, app_id: i64) -> Result<(), String> {
    scene_repo::remove_app_from_scene(&db, scene_id, app_id)
}

#[tauri::command]
pub fn list_scene_apps(db: State<'_, Arc<Database>>, scene_id: i64) -> Result<Vec<SceneApp>, String> {
    scene_repo::list_scene_apps(&db, scene_id)
}

#[tauri::command]
pub fn bind_todo_to_scene(db: State<'_, Arc<Database>>, todo_id: i64, scene_id: i64) -> Result<(), String> {
    scene_repo::bind_todo_to_scene(&db, todo_id, scene_id)
}

#[tauri::command]
pub fn unbind_todo_from_scene(db: State<'_, Arc<Database>>, todo_id: i64, scene_id: i64) -> Result<(), String> {
    scene_repo::unbind_todo_from_scene(&db, todo_id, scene_id)
}

#[tauri::command]
pub fn list_todos_by_scene(db: State<'_, Arc<Database>>, scene_id: i64) -> Result<Vec<TodoWithDetails>, String> {
    scene_repo::list_todos_with_details_by_scene(&db, scene_id)
}

#[tauri::command]
pub fn get_time_summary(db: State<'_, Arc<Database>>, range_start: String, range_end: String) -> Result<Vec<SceneTimeSummary>, String> {
    scene_repo::get_time_summary(&db, &range_start, &range_end)
}

#[tauri::command]
pub fn get_time_detail(db: State<'_, Arc<Database>>, scene_id: i64, range_start: String, range_end: String) -> Result<Vec<AppTimeDetail>, String> {
    scene_repo::get_time_detail(&db, scene_id, &range_start, &range_end)
}

#[tauri::command]
pub fn get_time_sessions(db: State<'_, Arc<Database>>, range_start: String, range_end: String, limit: i64) -> Result<Vec<TimeSession>, String> {
    scene_repo::get_time_sessions(&db, &range_start, &range_end, limit)
}

#[tauri::command]
pub fn set_tracking_paused(
    time_tracker: State<'_, Arc<TimeTracker>>,
    paused: bool,
) -> Result<(), String> {
    time_tracker.set_paused(paused);
    Ok(())
}

#[tauri::command]
pub fn get_tracking_status(
    db: State<'_, Arc<Database>>,
    time_tracker: State<'_, Arc<TimeTracker>>,
) -> Result<TrackingStatus, String> {
    let paused = time_tracker.is_paused();
    let info = time_tracker.get_current_session_info();
    let (current_scene_id, current_scene_name, session_started_at) = match info {
        Some((scene_id, _, started_at)) => {
            let scene = scene_repo::get_scene(&db, scene_id).ok();
            (Some(scene_id), scene.map(|s| s.name), Some(started_at))
        }
        None => (None, None, None),
    };
    Ok(TrackingStatus {
        paused,
        current_scene_id,
        current_scene_name,
        session_started_at,
    })
}

#[tauri::command]
pub fn get_active_scene(
    db: State<'_, Arc<Database>>,
    monitor: State<'_, WindowMonitor>,
) -> Result<Option<Scene>, String> {
    Ok(monitor
        .get_last_active_scene_id()
        .and_then(|id| scene_repo::get_scene(&db, id).ok()))
}

#[tauri::command]
pub fn set_active_scene(
    db: State<'_, Arc<Database>>,
    monitor: State<'_, WindowMonitor>,
    scene_id: i64,
) -> Result<(), String> {
    // Verify scene exists
    scene_repo::get_scene(&db, scene_id)?;
    monitor.set_last_active_scene(scene_id);
    Ok(())
}

#[tauri::command]
pub fn cleanup_old_sessions(db: State<'_, Arc<Database>>, retention_days: i64) -> Result<u64, String> {
    scene_repo::cleanup_old_sessions(&db, retention_days)
}
