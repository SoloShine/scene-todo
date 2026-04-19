use crate::services::data_port::ExportData;

/// Validate import data structure before applying to database.
/// Returns Ok(()) if data is valid, Err with descriptive message otherwise.
pub fn validate_import_data(data: &ExportData) -> Result<(), String> {
    // 1. Check version
    if data.version != 1 {
        return Err(format!("Unsupported export version: {}. Expected: 1", data.version));
    }

    // 2. Validate groups rows have "name" field
    validate_rows_have_field(&data.groups, "groups", "name")?;

    // 3. Validate tags rows have "name" field
    validate_rows_have_field(&data.tags, "tags", "name")?;

    // 4. Validate todos rows have "title" field
    validate_rows_have_field(&data.todos, "todos", "title")?;

    // 5. Validate apps rows have "name" and "process_names" fields
    validate_rows_have_field(&data.apps, "apps", "name")?;
    validate_rows_have_field(&data.apps, "apps", "process_names")?;

    // 6. Validate scenes rows have "name" field
    validate_rows_have_field(&data.scenes, "scenes", "name")?;

    // 7. Check referential sanity: todo_tags references exist
    let todo_ids: std::collections::HashSet<_> = data.todos.iter()
        .filter_map(|r| r.get("id").and_then(|v| v.as_i64()))
        .collect();
    let tag_ids: std::collections::HashSet<_> = data.tags.iter()
        .filter_map(|r| r.get("id").and_then(|v| v.as_i64()))
        .collect();

    for (i, row) in data.todo_tags.iter().enumerate() {
        if let Some(tid) = row.get("todo_id").and_then(|v| v.as_i64()) {
            if !todo_ids.contains(&tid) {
                return Err(format!("todo_tags row {} references non-existent todo_id {}", i, tid));
            }
        }
        if let Some(taid) = row.get("tag_id").and_then(|v| v.as_i64()) {
            if !tag_ids.contains(&taid) {
                return Err(format!("todo_tags row {} references non-existent tag_id {}", i, taid));
            }
        }
    }

    Ok(())
}

fn validate_rows_have_field(
    rows: &[serde_json::Map<String, serde_json::Value>],
    table: &str,
    field: &str,
) -> Result<(), String> {
    for (i, row) in rows.iter().enumerate() {
        if !row.contains_key(field) {
            return Err(format!("{} row {} missing required field '{}'", table, i, field));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::data_port::RowData;

    fn make_valid_data() -> ExportData {
        let mut groups_row = RowData::new();
        groups_row.insert("id".into(), serde_json::json!(1));
        groups_row.insert("name".into(), serde_json::json!("Work"));

        let mut tag_row = RowData::new();
        tag_row.insert("id".into(), serde_json::json!(1));
        tag_row.insert("name".into(), serde_json::json!("urgent"));
        tag_row.insert("color".into(), serde_json::json!("#FF0000"));

        let mut todo_row = RowData::new();
        todo_row.insert("id".into(), serde_json::json!(1));
        todo_row.insert("title".into(), serde_json::json!("Test todo"));
        todo_row.insert("status".into(), serde_json::json!("pending"));

        let mut app_row = RowData::new();
        app_row.insert("id".into(), serde_json::json!(1));
        app_row.insert("name".into(), serde_json::json!("Word"));
        app_row.insert("process_names".into(), serde_json::json!("[]"));

        let mut scene_row = RowData::new();
        scene_row.insert("id".into(), serde_json::json!(1));
        scene_row.insert("name".into(), serde_json::json!("Work"));

        ExportData {
            version: 1,
            groups: vec![groups_row],
            tags: vec![tag_row],
            todos: vec![todo_row],
            todo_tags: vec![],
            apps: vec![app_row],
            scenes: vec![scene_row],
            scene_apps: vec![],
            todo_app_bindings: vec![],
            todo_scene_bindings: vec![],
            time_sessions: vec![],
        }
    }

    #[test]
    fn test_valid_data() {
        let data = make_valid_data();
        assert!(validate_import_data(&data).is_ok());
    }

    #[test]
    fn test_bad_version() {
        let mut data = make_valid_data();
        data.version = 99;
        assert!(validate_import_data(&data).is_err());
    }

    #[test]
    fn test_missing_required_field() {
        let mut data = make_valid_data();
        data.todos[0].remove("title");
        let err = validate_import_data(&data).unwrap_err();
        assert!(err.contains("todos row 0 missing required field 'title'"));
    }

    #[test]
    fn test_dangling_todo_tag_reference() {
        let mut data = make_valid_data();
        let mut tt = RowData::new();
        tt.insert("todo_id".into(), serde_json::json!(999));
        tt.insert("tag_id".into(), serde_json::json!(1));
        data.todo_tags.push(tt);
        let err = validate_import_data(&data).unwrap_err();
        assert!(err.contains("non-existent todo_id 999"));
    }
}
