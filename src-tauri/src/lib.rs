mod commands;
mod models;
mod services;

use std::sync::Arc;
use services::db::Database;
use services::widget_manager::WidgetManager;
use services::window_monitor::{ForegroundChanged, WindowMonitor};
use tauri::{
    Listener, Manager,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
};

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
            let db_arc = Arc::new(database);
            app.manage(db_arc.clone());

            let widget_mgr = WidgetManager::new(db_arc.clone());
            app.manage(widget_mgr);

            let monitor = WindowMonitor::new(app.handle().clone(), db_arc);
            app.manage(monitor);

            let app_handle = app.handle().clone();
            app.listen("foreground-changed", move |event| {
                if let Ok(fg_event) = serde_json::from_str::<ForegroundChanged>(event.payload()) {
                    let widget_mgr = app_handle.state::<WidgetManager>();
                    widget_mgr.handle_foreground_change(&app_handle, &fg_event);
                }
            });

            // System tray
            let show_item = MenuItemBuilder::with_id("show", "显示主窗口").build(app)?;
            let pause_item = MenuItemBuilder::with_id("pause", "暂停 Widget").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &pause_item, &quit_item])
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Overlay Todo")
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "pause" => {
                            let monitor = app.state::<WindowMonitor>();
                            if monitor.is_running() {
                                monitor.stop();
                                if let Some(tray) = app.tray_by_id("main") {
                                    let _ = tray.set_tooltip(Some("Overlay Todo (已暂停)"));
                                }
                            } else {
                                monitor.start();
                                if let Some(tray) = app.tray_by_id("main") {
                                    let _ = tray.set_tooltip(Some("Overlay Todo"));
                                }
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Prevent app from closing when main window is closed (hide to tray)
            if let Some(main_win) = app.get_webview_window("main") {
                let win_clone = main_win.clone();
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win_clone.hide();
                    }
                });
            }

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
            commands::app_cmd::start_window_monitor,
            commands::app_cmd::stop_window_monitor,
            commands::app_cmd::start_window_capture,
            commands::app_cmd::save_widget_offset,
            commands::app_cmd::set_widget_default_size,
            commands::app_cmd::hide_widget,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
