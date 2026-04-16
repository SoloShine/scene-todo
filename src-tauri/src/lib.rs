mod commands;
mod models;
mod services;

use services::db::Database;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            let db_path = Database::app_db_path(&app.handle())?;
            let database = Database::open(&db_path)?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::todo_cmd::create_todo,
            commands::todo_cmd::list_todos,
            commands::todo_cmd::get_todo,
            commands::todo_cmd::update_todo,
            commands::todo_cmd::delete_todo,
            commands::todo_cmd::get_todo_with_details,
            commands::todo_cmd::list_todos_by_app,
            commands::todo_cmd::add_tag_to_todo,
            commands::todo_cmd::remove_tag_from_todo,
            commands::group_cmd::create_group,
            commands::group_cmd::list_groups,
            commands::group_cmd::update_group,
            commands::group_cmd::delete_group,
            commands::tag_cmd::create_tag,
            commands::tag_cmd::list_tags,
            commands::tag_cmd::update_tag,
            commands::tag_cmd::delete_tag,
            commands::app_cmd::create_app,
            commands::app_cmd::list_apps,
            commands::app_cmd::update_app,
            commands::app_cmd::delete_app,
            commands::app_cmd::bind_todo_to_app,
            commands::app_cmd::unbind_todo_from_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
