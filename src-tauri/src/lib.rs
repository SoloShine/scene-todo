mod commands;
mod models;
mod services;

use std::collections::HashSet;
use std::sync::Arc;
use services::db::Database;
use services::time_tracker::TimeTracker;
use services::widget_manager::WidgetManager;
use services::window_monitor::{ForegroundChanged, WindowMonitor, WindowMoved};
use tauri::{
    Listener, Manager,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
};
use tauri::menu::PredefinedMenuItem;

pub struct PassthroughState {
    active: std::sync::Mutex<HashSet<i64>>,
}

impl PassthroughState {
    pub fn new() -> Self {
        Self { active: std::sync::Mutex::new(HashSet::new()) }
    }
    pub fn set(&self, app_id: i64, passthrough: bool) {
        let mut active = self.active.lock().unwrap();
        if passthrough { active.insert(app_id); } else { active.remove(&app_id); }
    }
    pub fn is_any_active(&self) -> bool {
        !self.active.lock().unwrap().is_empty()
    }
    pub fn clear(&self) -> HashSet<i64> {
        std::mem::take(&mut *self.active.lock().unwrap())
    }
}

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

            let time_tracker = Arc::new(TimeTracker::new(db_arc.clone()));
            app.manage(time_tracker.clone());

            let widget_mgr = WidgetManager::new(db_arc.clone());
            app.manage(widget_mgr);

            let passthrough_state = PassthroughState::new();
            app.manage(passthrough_state);

            let monitor = WindowMonitor::new(app.handle().clone(), db_arc, time_tracker);
            app.manage(monitor);

            let app_handle = app.handle().clone();
            app.listen("foreground-changed", move |event| {
                if let Ok(fg_event) = serde_json::from_str::<ForegroundChanged>(event.payload()) {
                    let widget_mgr = app_handle.state::<WidgetManager>();
                    widget_mgr.handle_foreground_change(&app_handle, &fg_event);
                }
            });

            // Listen for window move events and reposition widgets
            let move_app_handle = app.handle().clone();
            app.listen("window-location-changed", move |event| {
                if let Ok(moved) = serde_json::from_str::<WindowMoved>(event.payload()) {
                    let widget_mgr = move_app_handle.state::<WidgetManager>();
                    widget_mgr.handle_window_moved(&move_app_handle, moved.hwnd);
                }
            });

            // System tray
            let show_item = MenuItemBuilder::with_id("show", "显示主窗口").build(app)?;
            let pause_widget_item = MenuItemBuilder::with_id("pause_widget", "暂停 Widget").build(app)?;
            let pause_tracking_item = MenuItemBuilder::with_id("pause_tracking", "暂停追踪").build(app)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;

            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &separator, &pause_widget_item, &pause_tracking_item, &separator, &quit_item])
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("SceneTodo")
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "pause_widget" => {
                            let monitor = app.state::<WindowMonitor>();
                            if monitor.is_running() {
                                monitor.stop();
                                if let Some(tray) = app.tray_by_id("main") {
                                    let _ = tray.set_tooltip(Some("SceneTodo (Widget 已暂停)"));
                                }
                            } else {
                                monitor.start();
                                if let Some(tray) = app.tray_by_id("main") {
                                    let _ = tray.set_tooltip(Some("SceneTodo"));
                                }
                            }
                        }
                        "pause_tracking" => {
                            let time_tracker = app.state::<Arc<TimeTracker>>();
                            let current = time_tracker.is_paused();
                            time_tracker.set_paused(!current);
                            let new_label = if !current { "恢复追踪" } else { "暂停追踪" };
                            if let Some(item) = app.menu().and_then(|m| m.get("pause_tracking")) {
                                let _ = item.as_menuitem().map(|mi| mi.set_text(new_label));
                            }
                            if let Some(tray) = app.tray_by_id("main") {
                                let tooltip = if !current { "SceneTodo (追踪已暂停)" } else { "SceneTodo" };
                                let _ = tray.set_tooltip(Some(tooltip));
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
                        let state = app.state::<PassthroughState>();

                        if state.is_any_active() {
                            let app_ids = state.clear();
                            for id in &app_ids {
                                let label = format!("widget-app-{}", id);
                                if let Some(win) = app.get_webview_window(&label) {
                                    let _ = win.set_ignore_cursor_events(false);
                                    let _ = win.eval("window.dispatchEvent(new Event('passthrough-disabled'));");
                                }
                            }
                            if let Some(t) = app.tray_by_id("main") {
                                let _ = t.set_tooltip(Some("SceneTodo"));
                            }
                        } else {
                            if let Some(win) = app.get_webview_window("main") {
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
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
            commands::todo_cmd::list_todos_with_details,
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
            commands::app_cmd::set_widget_passthrough,
            commands::app_cmd::resize_widget,
            commands::scene_cmd::create_scene,
            commands::scene_cmd::list_scenes,
            commands::scene_cmd::update_scene,
            commands::scene_cmd::delete_scene,
            commands::scene_cmd::add_app_to_scene,
            commands::scene_cmd::remove_app_from_scene,
            commands::scene_cmd::list_scene_apps,
            commands::scene_cmd::bind_todo_to_scene,
            commands::scene_cmd::unbind_todo_from_scene,
            commands::scene_cmd::list_todos_by_scene,
            commands::scene_cmd::get_time_summary,
            commands::scene_cmd::get_time_detail,
            commands::scene_cmd::get_time_sessions,
            commands::scene_cmd::set_tracking_paused,
            commands::scene_cmd::get_tracking_status,
            commands::scene_cmd::get_active_scene,
            commands::scene_cmd::set_active_scene,
            commands::scene_cmd::cleanup_old_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
