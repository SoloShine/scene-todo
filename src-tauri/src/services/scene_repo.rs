use rusqlite::{params, Row};
use crate::models::*;
use crate::services::db::Database;

fn row_to_scene(row: &Row) -> Result<Scene, rusqlite::Error> {
    Ok(Scene {
        id: row.get(0)?,
        name: row.get(1)?,
        icon: row.get(2)?,
        color: row.get(3)?,
        sort_order: row.get(4)?,
        track_time: row.get::<_, i32>(5)? != 0,
        created_at: row.get(6)?,
    })
}

fn row_to_time_session(row: &Row) -> Result<TimeSession, rusqlite::Error> {
    Ok(TimeSession {
        id: row.get(0)?,
        scene_id: row.get(1)?,
        app_id: row.get(2)?,
        started_at: row.get(3)?,
        ended_at: row.get(4)?,
        duration_secs: row.get(5)?,
    })
}

// --- Scene CRUD ---

pub fn create_scene(db: &Database, input: CreateScene) -> Result<Scene, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let color = input.color.unwrap_or_else(|| "#6B7280".to_string());
    let track_time = input.track_time.unwrap_or(true) as i32;
    conn.execute(
        "INSERT INTO scenes (name, icon, color, sort_order, track_time) VALUES (?1, ?2, ?3, 0, ?4)",
        params![input.name, input.icon, color, track_time],
    ).map_err(|e| format!("Insert scene: {}", e))?;
    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, sort_order, track_time, created_at FROM scenes WHERE id = ?1"
    ).map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_scene).map_err(|e| format!("Fetch: {}", e))
}

pub fn list_scenes(db: &Database) -> Result<Vec<Scene>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, sort_order, track_time, created_at FROM scenes ORDER BY sort_order, name"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map([], row_to_scene).map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn get_scene(db: &Database, id: i64) -> Result<Scene, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, color, sort_order, track_time, created_at FROM scenes WHERE id = ?1"
    ).map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_scene).map_err(|e| format!("Not found: {}", e))
}

pub fn update_scene(db: &Database, input: UpdateScene) -> Result<Scene, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut sets = Vec::new();
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref v) = input.name {
        sets.push(format!("name = ?{}", pv.len() + 1));
        pv.push(Box::new(v.clone()));
    }
    if let Some(ref v) = input.icon {
        sets.push(format!("icon = ?{}", pv.len() + 1));
        pv.push(Box::new(v.clone()));
    }
    if let Some(ref v) = input.color {
        sets.push(format!("color = ?{}", pv.len() + 1));
        pv.push(Box::new(v.clone()));
    }
    if let Some(v) = input.sort_order {
        sets.push(format!("sort_order = ?{}", pv.len() + 1));
        pv.push(Box::new(v));
    }
    if let Some(v) = input.track_time {
        sets.push(format!("track_time = ?{}", pv.len() + 1));
        pv.push(Box::new(v as i32));
    }

    if sets.is_empty() {
        drop(conn);
        return get_scene(db, input.id);
    }

    let sql = format!("UPDATE scenes SET {} WHERE id = ?", sets.join(", "));
    pv.push(Box::new(input.id));
    let params: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params.as_slice()).map_err(|e| format!("Update: {}", e))?;
    drop(conn);
    get_scene(db, input.id)
}

pub fn delete_scene(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM scenes WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete: {}", e))?;
    Ok(())
}

// --- Scene-App management ---

pub fn add_app_to_scene(db: &Database, scene_id: i64, app_id: i64, priority: i32) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO scene_apps (scene_id, app_id, priority) VALUES (?1, ?2, ?3)",
        params![scene_id, app_id, priority],
    ).map_err(|e| format!("Insert scene_app: {}", e))?;
    Ok(())
}

pub fn remove_app_from_scene(db: &Database, scene_id: i64, app_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM scene_apps WHERE scene_id = ?1 AND app_id = ?2",
        params![scene_id, app_id],
    ).map_err(|e| format!("Delete scene_app: {}", e))?;
    Ok(())
}

pub fn list_scene_apps(db: &Database, scene_id: i64) -> Result<Vec<SceneApp>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT scene_id, app_id, priority FROM scene_apps WHERE scene_id = ?1 ORDER BY priority DESC"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map(params![scene_id], |row| {
        Ok(SceneApp {
            scene_id: row.get(0)?,
            app_id: row.get(1)?,
            priority: row.get(2)?,
        })
    }).map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

// --- Scene lookup for WindowMonitor conflict resolution ---

pub fn find_scenes_by_app_id(db: &Database, app_id: i64) -> Result<Vec<(Scene, i32)>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT scenes.id, scenes.name, scenes.icon, scenes.color, scenes.sort_order, scenes.track_time, scenes.created_at, scene_apps.priority \
         FROM scenes JOIN scene_apps ON scenes.id = scene_apps.scene_id \
         WHERE scene_apps.app_id = ?1 \
         ORDER BY scene_apps.priority DESC"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map(params![app_id], |row| {
        let scene = Scene {
            id: row.get(0)?,
            name: row.get(1)?,
            icon: row.get(2)?,
            color: row.get(3)?,
            sort_order: row.get(4)?,
            track_time: row.get::<_, i32>(5)? != 0,
            created_at: row.get(6)?,
        };
        let priority: i32 = row.get(7)?;
        Ok((scene, priority))
    }).map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

// --- Todo-Scene binding ---

pub fn bind_todo_to_scene(db: &Database, todo_id: i64, scene_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO todo_scene_bindings (todo_id, scene_id) VALUES (?1, ?2)",
        params![todo_id, scene_id],
    ).map_err(|e| format!("Bind: {}", e))?;
    Ok(())
}

pub fn unbind_todo_from_scene(db: &Database, todo_id: i64, scene_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM todo_scene_bindings WHERE todo_id = ?1 AND scene_id = ?2",
        params![todo_id, scene_id],
    ).map_err(|e| format!("Unbind: {}", e))?;
    Ok(())
}

pub fn list_todos_by_scene(db: &Database, scene_id: i64) -> Result<Vec<Todo>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT DISTINCT t.id, t.title, t.description, t.status, t.priority, t.group_id, t.parent_id, t.sort_order, t.due_date, t.created_at, t.completed_at \
         FROM todos t \
         JOIN todo_scene_bindings tsb ON t.id = tsb.todo_id \
         WHERE tsb.scene_id = ?1 \
           AND t.status = 'pending' \
           AND t.parent_id IS NULL \
         UNION \
         SELECT DISTINCT t2.id, t2.title, t2.description, t2.status, t2.priority, t2.group_id, t2.parent_id, t2.sort_order, t2.due_date, t2.created_at, t2.completed_at \
         FROM todos t2 \
         JOIN todos parent ON t2.parent_id = parent.id \
         JOIN todo_scene_bindings tsb2 ON parent.id = tsb2.todo_id \
         WHERE tsb2.scene_id = ?1 \
           AND t2.status = 'pending' \
         ORDER BY sort_order, created_at"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map(params![scene_id], |row| {
        Ok(Todo {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            status: row.get(3)?,
            priority: row.get(4)?,
            group_id: row.get(5)?,
            parent_id: row.get(6)?,
            sort_order: row.get(7)?,
            due_date: row.get(8)?,
            created_at: row.get(9)?,
            completed_at: row.get(10)?,
        })
    }).map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

// --- Time tracking queries ---

pub fn get_time_summary(db: &Database, range_start: &str, range_end: &str) -> Result<Vec<SceneTimeSummary>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // First get total duration across all scenes for percentage calculation
    let total_secs: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_secs), 0) FROM time_sessions \
         WHERE started_at >= ?1 AND started_at < ?2 \
           AND duration_secs IS NOT NULL",
        params![range_start, range_end],
        |row| row.get(0),
    ).unwrap_or(0);

    let mut stmt = conn.prepare(
        "SELECT s.id, s.name, s.color, COALESCE(SUM(ts.duration_secs), 0) \
         FROM scenes s \
         LEFT JOIN time_sessions ts ON s.id = ts.scene_id \
           AND ts.started_at >= ?1 AND ts.started_at < ?2 \
           AND ts.duration_secs IS NOT NULL \
         GROUP BY s.id, s.name, s.color \
         HAVING COALESCE(SUM(ts.duration_secs), 0) > 0 \
         ORDER BY SUM(ts.duration_secs) DESC"
    ).map_err(|e| format!("Prepare: {}", e))?;

    let rows = stmt.query_map(params![range_start, range_end], |row| {
        let scene_id: i64 = row.get(0)?;
        let scene_name: String = row.get(1)?;
        let color: String = row.get(2)?;
        let total: i64 = row.get(3)?;
        let percentage = if total_secs > 0 {
            (total as f64 / total_secs as f64) * 100.0
        } else {
            0.0
        };
        Ok(SceneTimeSummary {
            scene_id,
            scene_name,
            color,
            total_secs: total,
            percentage,
        })
    }).map_err(|e| format!("Query: {}", e))?;

    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn get_time_detail(db: &Database, scene_id: i64, range_start: &str, range_end: &str) -> Result<Vec<AppTimeDetail>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT a.id, a.name, COALESCE(SUM(ts.duration_secs), 0) \
         FROM apps a \
         JOIN time_sessions ts ON a.id = ts.app_id \
         WHERE ts.scene_id = ?1 \
           AND ts.started_at >= ?2 AND ts.started_at < ?3 \
           AND ts.duration_secs IS NOT NULL \
         GROUP BY a.id, a.name \
         ORDER BY SUM(ts.duration_secs) DESC"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map(params![scene_id, range_start, range_end], |row| {
        Ok(AppTimeDetail {
            app_id: row.get(0)?,
            app_name: row.get(1)?,
            total_secs: row.get(2)?,
        })
    }).map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn get_time_sessions(db: &Database, range_start: &str, range_end: &str, limit: i64) -> Result<Vec<TimeSession>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, scene_id, app_id, started_at, ended_at, duration_secs \
         FROM time_sessions \
         WHERE started_at >= ?1 AND started_at < ?2 \
         ORDER BY started_at DESC \
         LIMIT ?3"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map(params![range_start, range_end, limit], row_to_time_session)
        .map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn cleanup_old_sessions(db: &Database, retention_days: i64) -> Result<u64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let affected = conn.execute(
        "DELETE FROM time_sessions WHERE ended_at IS NOT NULL AND ended_at < datetime('now', '-' || ?1 || ' days')",
        params![retention_days],
    ).map_err(|e| format!("Cleanup: {}", e))?;
    Ok(affected as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use crate::services::db::Database;

    fn setup_db() -> Database {
        let tmp = NamedTempFile::new().unwrap();
        Database::open(tmp.path()).unwrap()
    }

    #[test]
    fn test_scene_crud() {
        let db = setup_db();

        // Create
        let scene = create_scene(&db, CreateScene {
            name: "Work".into(),
            icon: Some("briefcase".into()),
            color: Some("#3B82F6".into()),
            track_time: Some(true),
        }).unwrap();
        assert_eq!(scene.name, "Work");
        assert_eq!(scene.color, "#3B82F6");
        assert!(scene.track_time);

        // List
        let scenes = list_scenes(&db).unwrap();
        assert_eq!(scenes.len(), 1);

        // Get
        let fetched = get_scene(&db, scene.id).unwrap();
        assert_eq!(fetched.name, "Work");

        // Update
        let updated = update_scene(&db, UpdateScene {
            id: scene.id,
            name: Some("Deep Work".into()),
            icon: None,
            color: Some("#EF4444".into()),
            sort_order: Some(1),
            track_time: Some(false),
        }).unwrap();
        assert_eq!(updated.name, "Deep Work");
        assert_eq!(updated.color, "#EF4444");
        assert!(!updated.track_time);
        assert_eq!(updated.sort_order, 1);

        // Delete
        delete_scene(&db, scene.id).unwrap();
        assert_eq!(list_scenes(&db).unwrap().len(), 0);
    }

    #[test]
    fn test_scene_defaults() {
        let db = setup_db();
        let scene = create_scene(&db, CreateScene {
            name: "Default".into(),
            icon: None,
            color: None,
            track_time: None,
        }).unwrap();
        assert_eq!(scene.color, "#6B7280");
        assert!(scene.track_time);
        assert_eq!(scene.sort_order, 0);
    }

    #[test]
    fn test_scene_app_management() {
        let db = setup_db();
        use crate::services::app_repo;

        let scene = create_scene(&db, CreateScene {
            name: "Work".into(),
            icon: None,
            color: None,
            track_time: None,
        }).unwrap();

        let app = app_repo::create_app(&db, crate::models::CreateApp {
            name: "Word".into(),
            process_names: vec!["WINWORD.EXE".into()],
            display_name: None,
        }).unwrap();

        // Add app to scene
        add_app_to_scene(&db, scene.id, app.id, 0).unwrap();
        let apps = list_scene_apps(&db, scene.id).unwrap();
        assert_eq!(apps.len(), 1);
        assert_eq!(apps[0].app_id, app.id);

        // Find scenes by app
        let found = find_scenes_by_app_id(&db, app.id).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].0.id, scene.id);

        // Remove app from scene
        remove_app_from_scene(&db, scene.id, app.id).unwrap();
        assert_eq!(list_scene_apps(&db, scene.id).unwrap().len(), 0);
    }

    #[test]
    fn test_todo_scene_binding() {
        let db = setup_db();
        use crate::services::todo_repo;

        let scene = create_scene(&db, CreateScene {
            name: "Work".into(),
            icon: None,
            color: None,
            track_time: None,
        }).unwrap();

        let todo = todo_repo::create_todo(&db, crate::models::CreateTodo {
            title: "Test task".into(),
            description: None,
            priority: None,
            group_id: None,
            parent_id: None,
            due_date: None,
        }).unwrap();

        // Bind
        bind_todo_to_scene(&db, todo.id, scene.id).unwrap();
        let todos = list_todos_by_scene(&db, scene.id).unwrap();
        assert_eq!(todos.len(), 1);
        assert_eq!(todos[0].id, todo.id);

        // Unbind
        unbind_todo_from_scene(&db, todo.id, scene.id).unwrap();
        let todos = list_todos_by_scene(&db, scene.id).unwrap();
        assert_eq!(todos.len(), 0);
    }

    #[test]
    fn test_time_summary() {
        let db = setup_db();

        let scene1 = create_scene(&db, CreateScene {
            name: "Work".into(),
            icon: None,
            color: Some("#3B82F6".into()),
            track_time: None,
        }).unwrap();

        let scene2 = create_scene(&db, CreateScene {
            name: "Personal".into(),
            icon: None,
            color: Some("#10B981".into()),
            track_time: None,
        }).unwrap();

        // Insert time sessions directly
        let conn = db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO time_sessions (scene_id, app_id, started_at, ended_at, duration_secs) VALUES (?1, NULL, ?2, ?3, ?4)",
            rusqlite::params![scene1.id, "2026-01-01 09:00:00", "2026-01-01 10:00:00", 3600],
        ).unwrap();
        conn.execute(
            "INSERT INTO time_sessions (scene_id, app_id, started_at, ended_at, duration_secs) VALUES (?1, NULL, ?2, ?3, ?4)",
            rusqlite::params![scene2.id, "2026-01-01 10:00:00", "2026-01-01 10:30:00", 1800],
        ).unwrap();
        drop(conn);

        let summary = get_time_summary(&db, "2026-01-01", "2026-01-02").unwrap();
        assert_eq!(summary.len(), 2);
        assert_eq!(summary[0].scene_id, scene1.id);
        assert_eq!(summary[0].total_secs, 3600);
        assert_eq!(summary[1].total_secs, 1800);

        // Check percentages sum to ~100
        let total_pct: f64 = summary.iter().map(|s| s.percentage).sum();
        assert!((total_pct - 100.0).abs() < 0.01);
    }

    #[test]
    fn test_cleanup_old_sessions() {
        let db = setup_db();

        let scene = create_scene(&db, CreateScene {
            name: "Work".into(),
            icon: None,
            color: None,
            track_time: None,
        }).unwrap();

        let conn = db.conn.lock().unwrap();
        // Old session (ended)
        conn.execute(
            "INSERT INTO time_sessions (scene_id, app_id, started_at, ended_at, duration_secs) VALUES (?1, NULL, '2020-01-01 09:00:00', '2020-01-01 10:00:00', 3600)",
            rusqlite::params![scene.id],
        ).unwrap();
        // Recent session (ended)
        conn.execute(
            "INSERT INTO time_sessions (scene_id, app_id, started_at, ended_at, duration_secs) VALUES (?1, NULL, datetime('now'), datetime('now', '+1 hour'), 3600)",
            rusqlite::params![scene.id],
        ).unwrap();
        // Old open session (no end time - should NOT be cleaned)
        conn.execute(
            "INSERT INTO time_sessions (scene_id, app_id, started_at, ended_at, duration_secs) VALUES (?1, NULL, '2020-01-01 09:00:00', NULL, NULL)",
            rusqlite::params![scene.id],
        ).unwrap();
        drop(conn);

        let deleted = cleanup_old_sessions(&db, 365).unwrap();
        assert_eq!(deleted, 1);

        let sessions = get_time_sessions(&db, "2020-01-01", "2030-01-01", 100).unwrap();
        assert_eq!(sessions.len(), 2); // recent + open session remain
    }
}
