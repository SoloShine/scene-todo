use std::sync::Arc;
use tauri::State;
use crate::services::db::Database;
use crate::services::data_port;

#[tauri::command]
pub fn export_data(db: State<'_, Arc<Database>>) -> Result<String, String> {
    let data = data_port::export_all(&db)?;
    serde_json::to_string_pretty(&data).map_err(|e| format!("Serialize: {}", e))
}

#[tauri::command]
pub fn import_data(db: State<'_, Arc<Database>>, json: String) -> Result<(), String> {
    let data: data_port::ExportData = serde_json::from_str(&json)
        .map_err(|e| format!("Parse JSON: {}", e))?;
    data_port::import_all(&db, &data)
}
