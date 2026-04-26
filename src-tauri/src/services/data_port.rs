use serde::{Deserialize, Serialize};
use rusqlite::params;
use crate::services::db::Database;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportData {
    pub version: u32,
    pub groups: Vec<RowData>,
    pub tags: Vec<RowData>,
    pub todos: Vec<RowData>,
    pub todo_tags: Vec<RowData>,
    pub apps: Vec<RowData>,
    pub scenes: Vec<RowData>,
    pub scene_apps: Vec<RowData>,
    pub todo_app_bindings: Vec<RowData>,
    pub todo_scene_bindings: Vec<RowData>,
    pub time_sessions: Vec<RowData>,
}

pub type RowData = serde_json::Map<String, serde_json::Value>;

pub fn export_all(db: &Database) -> Result<ExportData, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    Ok(ExportData {
        version: 1,
        groups: query_rows(&conn, "SELECT * FROM groups ORDER BY id")?,
        tags: query_rows(&conn, "SELECT * FROM tags ORDER BY id")?,
        todos: query_rows(&conn, "SELECT * FROM todos ORDER BY id")?,
        todo_tags: query_rows(&conn, "SELECT * FROM todo_tags")?,
        apps: query_rows(&conn, "SELECT * FROM apps ORDER BY id")?,
        scenes: query_rows(&conn, "SELECT * FROM scenes ORDER BY id")?,
        scene_apps: query_rows(&conn, "SELECT * FROM scene_apps")?,
        todo_app_bindings: query_rows(&conn, "SELECT * FROM todo_app_bindings ORDER BY id")?,
        todo_scene_bindings: query_rows(&conn, "SELECT * FROM todo_scene_bindings ORDER BY id")?,
        time_sessions: query_rows(&conn, "SELECT * FROM time_sessions ORDER BY id")?,
    })
}

pub fn import_all(db: &Database, data: &ExportData) -> Result<(), String> {
    if data.version != 1 {
        return Err(format!("Unsupported export version: {}", data.version));
    }

    // Validate data before touching the database
    crate::services::import_validator::validate_import_data(data)?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Wrap entire import in a transaction for atomicity
    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Begin transaction: {}", e))?;

    // Disable FK checks during import
    tx.execute_batch("PRAGMA foreign_keys=OFF;")
        .map_err(|e| format!("Disable FK: {}", e))?;

    // Clear all tables (reverse dependency order)
    let tables = [
        "time_sessions", "todo_scene_bindings", "todo_app_bindings",
        "scene_apps", "todo_tags", "todos", "scenes", "apps", "tags", "groups",
    ];
    for t in &tables {
        tx.execute(&format!("DELETE FROM {}", t), [])
            .map_err(|e| format!("Clear {}: {}", t, e))?;
    }

    // Insert in dependency order
    insert_rows_tx(&tx, "groups", &data.groups)?;
    insert_rows_tx(&tx, "tags", &data.tags)?;
    insert_rows_tx(&tx, "apps", &data.apps)?;
    insert_rows_tx(&tx, "todos", &data.todos)?;
    insert_rows_tx(&tx, "todo_tags", &data.todo_tags)?;
    insert_rows_tx(&tx, "scenes", &data.scenes)?;
    insert_rows_tx(&tx, "scene_apps", &data.scene_apps)?;
    insert_rows_tx(&tx, "todo_app_bindings", &data.todo_app_bindings)?;
    insert_rows_tx(&tx, "todo_scene_bindings", &data.todo_scene_bindings)?;
    insert_rows_tx(&tx, "time_sessions", &data.time_sessions)?;

    // Re-enable FK checks
    tx.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Enable FK: {}", e))?;

    tx.commit().map_err(|e| format!("Commit: {}", e))?;
    Ok(())
}

fn query_rows(conn: &rusqlite::Connection, sql: &str) -> Result<Vec<RowData>, String> {
    let mut stmt = conn.prepare(sql).map_err(|e| format!("Prepare {}: {}", sql, e))?;
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count)
        .map(|i| stmt.column_name(i).unwrap_or("?").to_string())
        .collect();

    let rows = stmt.query_map([], |row| {
        let mut map = serde_json::Map::new();
        for i in 0..col_count {
            let val: serde_json::Value = match row.get_ref(i) {
                Ok(rusqlite::types::ValueRef::Null) => serde_json::Value::Null,
                Ok(rusqlite::types::ValueRef::Integer(n)) => serde_json::json!(n),
                Ok(rusqlite::types::ValueRef::Real(f)) => serde_json::json!(f),
                Ok(rusqlite::types::ValueRef::Text(s)) => {
                    let text = String::from_utf8_lossy(s).into_owned();
                    serde_json::json!(text)
                },
                Ok(rusqlite::types::ValueRef::Blob(_)) => serde_json::Value::Null,
                Err(_) => serde_json::Value::Null,
            };
            map.insert(col_names[i].clone(), val);
        }
        Ok(map)
    }).map_err(|e| format!("Query {}: {}", sql, e))?;

    rows.filter_map(|r| r.ok()).collect::<Vec<_>>().into_iter()
        .map(Ok)
        .collect()
}

fn insert_rows_tx(tx: &rusqlite::Transaction, table: &str, rows: &[RowData]) -> Result<(), String> {
    if rows.is_empty() {
        return Ok(());
    }

    let cols: Vec<&String> = rows[0].keys().collect();
    let col_list = cols.iter()
        .map(|c| format!("\"{}\"", c.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(", ");
    let placeholders = cols.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let sql = format!("INSERT INTO {} ({}) VALUES ({})", table, col_list, placeholders);

    for row in rows {
        let mut vals: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        for col in &cols {
            let val = row.get(*col).cloned().unwrap_or(serde_json::Value::Null);
            let boxed: Box<dyn rusqlite::types::ToSql> = match val {
                serde_json::Value::Null => Box::new(Option::<String>::None),
                serde_json::Value::Bool(b) => Box::new(b as i32),
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        Box::new(i)
                    } else if let Some(f) = n.as_f64() {
                        Box::new(f)
                    } else {
                        Box::new(Option::<String>::None)
                    }
                },
                serde_json::Value::String(s) => Box::new(s),
                other => Box::new(other.to_string()),
            };
            vals.push(boxed);
        }
        let params: Vec<&dyn rusqlite::types::ToSql> = vals.iter().map(|v| v.as_ref()).collect();
        tx.execute(&sql, params.as_slice())
            .map_err(|e| format!("Insert into {}: {}", table, e))?;
    }

    Ok(())
}

fn insert_rows(conn: &rusqlite::Connection, table: &str, rows: &[RowData]) -> Result<(), String> {
    if rows.is_empty() {
        return Ok(());
    }

    // Get column names from first row
    let cols: Vec<&String> = rows[0].keys().collect();
    let col_list = cols.iter()
        .map(|c| format!("\"{}\"", c.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(", ");
    let placeholders = cols.iter().map(|_| "?").collect::<Vec<_>>().join(", ");
    let sql = format!("INSERT INTO {} ({}) VALUES ({})", table, col_list, placeholders);

    for row in rows {
        let mut vals: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        for col in &cols {
            let val = row.get(*col).cloned().unwrap_or(serde_json::Value::Null);
            let boxed: Box<dyn rusqlite::types::ToSql> = match val {
                serde_json::Value::Null => Box::new(Option::<String>::None),
                serde_json::Value::Bool(b) => Box::new(b as i32),
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        Box::new(i)
                    } else if let Some(f) = n.as_f64() {
                        Box::new(f)
                    } else {
                        Box::new(Option::<String>::None)
                    }
                },
                serde_json::Value::String(s) => Box::new(s),
                other => Box::new(other.to_string()),
            };
            vals.push(boxed);
        }
        let params: Vec<&dyn rusqlite::types::ToSql> = vals.iter().map(|v| v.as_ref()).collect();
        conn.execute(&sql, params.as_slice())
            .map_err(|e| format!("Insert into {}: {}", table, e))?;
    }

    Ok(())
}
