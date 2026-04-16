use rusqlite::{params, Row};
use crate::models::*;
use crate::services::db::Database;

fn row_to_app(row: &Row) -> Result<App, rusqlite::Error> {
    Ok(App {
        id: row.get(0)?,
        name: row.get(1)?,
        process_names: row.get(2)?,
        icon_path: row.get(3)?,
        display_name: row.get(4)?,
    })
}

pub fn create_app(db: &Database, input: CreateApp) -> Result<App, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let process_json = serde_json::to_string(&input.process_names)
        .map_err(|e| format!("Serialize process_names: {}", e))?;
    conn.execute(
        "INSERT INTO apps (name, process_names, display_name) VALUES (?1, ?2, ?3)",
        params![input.name, process_json, input.display_name],
    ).map_err(|e| format!("Insert app: {}", e))?;
    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare(
        "SELECT id, name, process_names, icon_path, display_name FROM apps WHERE id = ?1"
    ).map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_app).map_err(|e| format!("Fetch: {}", e))
}

pub fn list_apps(db: &Database) -> Result<Vec<App>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, name, process_names, icon_path, display_name FROM apps ORDER BY name"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map([], row_to_app).map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn get_app(db: &Database, id: i64) -> Result<App, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, name, process_names, icon_path, display_name FROM apps WHERE id = ?1"
    ).map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_app).map_err(|e| format!("Not found: {}", e))
}

pub fn update_app(db: &Database, input: UpdateApp) -> Result<App, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut sets = Vec::new();
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref v) = input.name { sets.push(format!("name = ?{}", pv.len() + 1)); pv.push(Box::new(v.clone())); }
    if let Some(ref v) = input.process_names {
        let json = serde_json::to_string(v).map_err(|e| format!("Serialize: {}", e))?;
        sets.push(format!("process_names = ?{}", pv.len() + 1)); pv.push(Box::new(json));
    }
    if let Some(ref v) = input.display_name { sets.push(format!("display_name = ?{}", pv.len() + 1)); pv.push(Box::new(v.clone())); }

    if sets.is_empty() { drop(conn); return get_app(db, input.id); }

    let sql = format!("UPDATE apps SET {} WHERE id = ?", sets.join(", "));
    pv.push(Box::new(input.id));
    let params: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params.as_slice()).map_err(|e| format!("Update: {}", e))?;
    drop(conn);
    get_app(db, input.id)
}

pub fn delete_app(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM apps WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete: {}", e))?;
    Ok(())
}

pub fn bind_todo_to_app(db: &Database, todo_id: i64, app_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR IGNORE INTO todo_app_bindings (todo_id, app_id) VALUES (?1, ?2)",
        params![todo_id, app_id],
    ).map_err(|e| format!("Bind: {}", e))?;
    Ok(())
}

pub fn unbind_todo_from_app(db: &Database, todo_id: i64, app_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM todo_app_bindings WHERE todo_id = ?1 AND app_id = ?2",
        params![todo_id, app_id],
    ).map_err(|e| format!("Unbind: {}", e))?;
    Ok(())
}

pub fn find_app_by_process(db: &Database, process_name: &str) -> Option<App> {
    let conn = db.conn.lock().ok()?;
    let apps: Vec<App> = conn.prepare(
        "SELECT id, name, process_names, icon_path, display_name FROM apps"
    ).ok()?
    .query_map([], row_to_app).ok()?
    .filter_map(|r| r.ok()).collect();

    for app in apps {
        if let Ok(names) = serde_json::from_str::<Vec<String>>(&app.process_names) {
            if names.iter().any(|n| n.eq_ignore_ascii_case(process_name)) {
                return Some(app);
            }
        }
    }
    None
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
    fn test_app_crud() {
        let db = setup_db();
        let app = create_app(&db, CreateApp {
            name: "Word".into(),
            process_names: vec!["WINWORD.EXE".into()],
            display_name: Some("Microsoft Word".into()),
        }).unwrap();
        assert_eq!(app.name, "Word");
        let apps = list_apps(&db).unwrap();
        assert_eq!(apps.len(), 1);
        delete_app(&db, app.id).unwrap();
        assert_eq!(list_apps(&db).unwrap().len(), 0);
    }

    #[test]
    fn test_binding() {
        let db = setup_db();
        use crate::services::todo_repo;
        let todo = todo_repo::create_todo(&db, crate::models::CreateTodo {
            title: "Test".into(), description: None, priority: None,
            group_id: None, parent_id: None, due_date: None,
        }).unwrap();
        let app = create_app(&db, CreateApp {
            name: "Word".into(), process_names: vec!["WINWORD.EXE".into()], display_name: None,
        }).unwrap();

        bind_todo_to_app(&db, todo.id, app.id).unwrap();
        let details = todo_repo::get_todo_with_details(&db, todo.id).unwrap();
        assert!(details.bound_app_ids.contains(&app.id));

        unbind_todo_from_app(&db, todo.id, app.id).unwrap();
        let details = todo_repo::get_todo_with_details(&db, todo.id).unwrap();
        assert!(!details.bound_app_ids.contains(&app.id));
    }

    #[test]
    fn test_find_by_process() {
        let db = setup_db();
        create_app(&db, CreateApp {
            name: "Word".into(), process_names: vec!["WINWORD.EXE".into()], display_name: None,
        }).unwrap();
        let found = find_app_by_process(&db, "WINWORD.EXE").unwrap();
        assert_eq!(found.name, "Word");
        assert!(find_app_by_process(&db, "EXCEL.EXE").is_none());
    }
}
