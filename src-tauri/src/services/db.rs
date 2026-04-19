use rusqlite::{Connection, params};
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn open(db_path: &Path) -> Result<Self, String> {
        let conn = Connection::open(db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| format!("Failed to set pragmas: {}", e))?;

        let db = Self { conn: Mutex::new(conn) };
        db.run_migrations()?;
        Ok(db)
    }

    pub fn app_db_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
        let dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Failed to create app data dir: {}", e))?;
        Ok(dir.join("scene-todo.db"))
    }

    fn run_migrations(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _migrations (
                id   INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            );"
        ).map_err(|e| format!("Migration tracking table error: {}", e))?;

        let applied: Vec<i64> = {
            let mut stmt = conn
                .prepare("SELECT id FROM _migrations ORDER BY id")
                .map_err(|e| format!("Prepare migration query: {}", e))?;
            let rows = stmt.query_map([], |row| row.get(0))
                .map_err(|e| format!("Query migrations: {}", e))?;
            rows.filter_map(|r| r.ok()).collect()
        };

        let migrations: Vec<(i64, &str, &str)> = vec![
            (1, "001_init", include_str!("../../migrations/001_init.sql")),
            (2, "002_scene_tracking", include_str!("../../migrations/002_scene_tracking.sql")),
            (3, "003_show_widget", include_str!("../../migrations/003_show_widget.sql")),
            (4, "004_current_session", include_str!("../../migrations/004_current_session.sql")),
        ];

        for (id, name, sql) in &migrations {
            if applied.contains(id) { continue; }
            conn.execute_batch(sql)
                .map_err(|e| format!("Migration {} ({}) failed: {}", id, name, e))?;
            conn.execute(
                "INSERT INTO _migrations (id, name) VALUES (?1, ?2)",
                params![id, name],
            ).map_err(|e| format!("Record migration {}: {}", id, e))?;
        }

        // Post-migration verification: ensure scene migration data integrity
        let app_binding_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM todo_app_bindings", [], |row| row.get(0)
        ).unwrap_or(0);
        let scene_binding_count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM todo_scene_bindings", [], |row| row.get(0)
        ).unwrap_or(0);
        if scene_binding_count < app_binding_count {
            return Err(format!(
                "Migration verification failed: todo_scene_bindings count ({}) < todo_app_bindings count ({})",
                scene_binding_count, app_binding_count
            ));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;

    fn test_db() -> Database {
        let tmp = NamedTempFile::new().unwrap();
        Database::open(tmp.path()).unwrap()
    }

    #[test]
    fn test_open_creates_tables() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert!(tables.contains(&"groups".to_string()));
        assert!(tables.contains(&"todos".to_string()));
        assert!(tables.contains(&"apps".to_string()));
        assert!(tables.contains(&"scenes".to_string()));
        assert!(tables.contains(&"scene_apps".to_string()));
        assert!(tables.contains(&"todo_scene_bindings".to_string()));
        assert!(tables.contains(&"time_sessions".to_string()));
    }

    #[test]
    fn test_migrations_idempotent() {
        let tmp = NamedTempFile::new().unwrap();
        let _db1 = Database::open(tmp.path()).unwrap();
        let _db2 = Database::open(tmp.path()).unwrap();
    }

    #[test]
    fn test_wal_mode_enabled() {
        let db = test_db();
        let conn = db.conn.lock().unwrap();
        let mode: String = conn
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .unwrap();
        assert_eq!(mode, "wal");
    }
}
