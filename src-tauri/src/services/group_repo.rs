use rusqlite::{params, Row};
use crate::models::*;
use crate::services::db::Database;

fn row_to_group(row: &Row) -> Result<Group, rusqlite::Error> {
    Ok(Group {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        sort_order: row.get(3)?,
        parent_id: row.get(4)?,
    })
}

pub fn create_group(db: &Database, input: CreateGroup) -> Result<Group, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let color = input.color.unwrap_or_else(|| "#6B7280".into());
    let max_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) FROM groups WHERE parent_id IS ?1",
        params![input.parent_id],
        |row| row.get(0),
    ).unwrap_or(-1);

    conn.execute(
        "INSERT INTO groups (name, color, sort_order, parent_id) VALUES (?1, ?2, ?3, ?4)",
        params![input.name, color, max_order + 1, input.parent_id],
    ).map_err(|e| format!("Insert group: {}", e))?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare(
        "SELECT id, name, color, sort_order, parent_id FROM groups WHERE id = ?1"
    ).map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_group).map_err(|e| format!("Fetch: {}", e))
}

pub fn list_groups(db: &Database) -> Result<Vec<Group>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, name, color, sort_order, parent_id FROM groups ORDER BY sort_order"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map([], row_to_group).map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn update_group(db: &Database, input: UpdateGroup) -> Result<Group, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut sets = Vec::new();
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref v) = input.name { sets.push(format!("name = ?{}", pv.len() + 1)); pv.push(Box::new(v.clone())); }
    if let Some(ref v) = input.color { sets.push(format!("color = ?{}", pv.len() + 1)); pv.push(Box::new(v.clone())); }
    if let Some(v) = input.sort_order { sets.push(format!("sort_order = ?{}", pv.len() + 1)); pv.push(Box::new(v)); }
    if let Some(v) = input.parent_id { sets.push(format!("parent_id = ?{}", pv.len() + 1)); pv.push(Box::new(v)); }

    if sets.is_empty() {
        drop(conn);
        let conn2 = db.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn2.prepare("SELECT id, name, color, sort_order, parent_id FROM groups WHERE id = ?1")
            .map_err(|e| format!("Prepare: {}", e))?;
        return stmt.query_row(params![input.id], row_to_group).map_err(|e| format!("Fetch: {}", e));
    }

    let sql = format!("UPDATE groups SET {} WHERE id = ?", sets.join(", "));
    pv.push(Box::new(input.id));
    let params: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params.as_slice()).map_err(|e| format!("Update: {}", e))?;
    drop(conn);

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, color, sort_order, parent_id FROM groups WHERE id = ?1")
        .map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![input.id], row_to_group).map_err(|e| format!("Fetch: {}", e))
}

pub fn delete_group(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM groups WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete: {}", e))?;
    Ok(())
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
    fn test_create_and_list_groups() {
        let db = setup_db();
        let g1 = create_group(&db, CreateGroup { name: "Work".into(), color: Some("#FF0000".into()), parent_id: None }).unwrap();
        let g2 = create_group(&db, CreateGroup { name: "Personal".into(), color: None, parent_id: None }).unwrap();
        let groups = list_groups(&db).unwrap();
        assert_eq!(groups.len(), 2);
        assert_eq!(g1.sort_order, 0);
        assert_eq!(g2.sort_order, 1);
    }

    #[test]
    fn test_nested_groups() {
        let db = setup_db();
        let parent = create_group(&db, CreateGroup { name: "Work".into(), color: None, parent_id: None }).unwrap();
        let child = create_group(&db, CreateGroup { name: "Project A".into(), color: None, parent_id: Some(parent.id) }).unwrap();
        assert_eq!(child.parent_id, Some(parent.id));
    }

    #[test]
    fn test_delete_group() {
        let db = setup_db();
        let g = create_group(&db, CreateGroup { name: "Temp".into(), color: None, parent_id: None }).unwrap();
        delete_group(&db, g.id).unwrap();
        assert_eq!(list_groups(&db).unwrap().len(), 0);
    }
}
