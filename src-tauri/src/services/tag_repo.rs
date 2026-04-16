use rusqlite::{params, Row};
use crate::models::*;
use crate::services::db::Database;

fn row_to_tag(row: &Row) -> Result<Tag, rusqlite::Error> {
    Ok(Tag { id: row.get(0)?, name: row.get(1)?, color: row.get(2)? })
}

pub fn create_tag(db: &Database, input: CreateTag) -> Result<Tag, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let color = input.color.unwrap_or_else(|| "#6B7280".into());
    conn.execute(
        "INSERT INTO tags (name, color) VALUES (?1, ?2)",
        params![input.name, color],
    ).map_err(|e| format!("Insert tag: {}", e))?;
    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT id, name, color FROM tags WHERE id = ?1")
        .map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_tag).map_err(|e| format!("Fetch: {}", e))
}

pub fn list_tags(db: &Database) -> Result<Vec<Tag>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, color FROM tags ORDER BY name")
        .map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map([], row_to_tag).map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn update_tag(db: &Database, input: UpdateTag) -> Result<Tag, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut sets = Vec::new();
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref v) = input.name { sets.push(format!("name = ?{}", pv.len() + 1)); pv.push(Box::new(v.clone())); }
    if let Some(ref v) = input.color { sets.push(format!("color = ?{}", pv.len() + 1)); pv.push(Box::new(v.clone())); }

    if sets.is_empty() {
        drop(conn);
        let conn2 = db.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn2.prepare("SELECT id, name, color FROM tags WHERE id = ?1")
            .map_err(|e| format!("Prepare: {}", e))?;
        return stmt.query_row(params![input.id], row_to_tag).map_err(|e| format!("Fetch: {}", e));
    }

    let sql = format!("UPDATE tags SET {} WHERE id = ?", sets.join(", "));
    pv.push(Box::new(input.id));
    let params: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params.as_slice()).map_err(|e| format!("Update: {}", e))?;
    drop(conn);

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, name, color FROM tags WHERE id = ?1")
        .map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![input.id], row_to_tag).map_err(|e| format!("Fetch: {}", e))
}

pub fn delete_tag(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tags WHERE id = ?1", params![id])
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
    fn test_tag_crud() {
        let db = setup_db();
        let t = create_tag(&db, CreateTag { name: "urgent".into(), color: Some("#FF0000".into()) }).unwrap();
        assert_eq!(t.name, "urgent");
        let updated = update_tag(&db, UpdateTag { id: t.id, name: Some("critical".into()), color: None }).unwrap();
        assert_eq!(updated.name, "critical");
        assert_eq!(list_tags(&db).unwrap().len(), 1);
        delete_tag(&db, t.id).unwrap();
        assert_eq!(list_tags(&db).unwrap().len(), 0);
    }

    #[test]
    fn test_duplicate_tag_name_fails() {
        let db = setup_db();
        create_tag(&db, CreateTag { name: "test".into(), color: None }).unwrap();
        let result = create_tag(&db, CreateTag { name: "test".into(), color: None });
        assert!(result.is_err());
    }
}
