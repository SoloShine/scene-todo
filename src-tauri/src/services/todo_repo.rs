use rusqlite::{params, Row};
use crate::models::*;
use crate::services::db::Database;

pub fn create_todo(db: &Database, input: CreateTodo) -> Result<Todo, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let priority = input.priority.unwrap_or_else(|| "medium".into());
    conn.execute(
        "INSERT INTO todos (title, description, priority, group_id, parent_id, due_date)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![input.title, input.description, priority, input.group_id, input.parent_id, input.due_date],
    ).map_err(|e| format!("Insert todo: {}", e))?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare(
        "SELECT id, title, description, status, priority, group_id, parent_id, sort_order, due_date, created_at, completed_at FROM todos WHERE id = ?1"
    ).map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_todo).map_err(|e| format!("Fetch: {}", e))
}

pub fn list_todos(db: &Database, filters: TodoFilters) -> Result<Vec<Todo>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut sql = String::from(
        "SELECT id, title, description, status, priority, group_id, parent_id, sort_order, due_date, created_at, completed_at FROM todos WHERE 1=1"
    );
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref s) = filters.status {
        sql.push_str(&format!(" AND status = ?{}", param_values.len() + 1));
        param_values.push(Box::new(s.clone()));
    }
    if let Some(ref gid) = filters.group_id {
        sql.push_str(&format!(" AND group_id = ?{}", param_values.len() + 1));
        param_values.push(Box::new(*gid));
    }
    if let Some(ref pid) = filters.parent_id {
        sql.push_str(&format!(" AND parent_id = ?{}", param_values.len() + 1));
        param_values.push(Box::new(*pid));
    } else {
        sql.push_str(" AND parent_id IS NULL");
    }
    if let Some(ref p) = filters.priority {
        sql.push_str(&format!(" AND priority = ?{}", param_values.len() + 1));
        param_values.push(Box::new(p.clone()));
    }
    if let Some(ref tid) = filters.tag_id {
        sql.push_str(&format!(" AND id IN (SELECT todo_id FROM todo_tags WHERE tag_id = ?{})", param_values.len() + 1));
        param_values.push(Box::new(*tid));
    }
    if let Some(ref d) = filters.due_before {
        sql.push_str(&format!(" AND date(due_date) <= ?{}", param_values.len() + 1));
        param_values.push(Box::new(d.clone()));
    }
    sql.push_str(" ORDER BY sort_order, created_at DESC");

    let params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map(params.as_slice(), row_to_todo)
        .map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn get_todo(db: &Database, id: i64) -> Result<Todo, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, title, description, status, priority, group_id, parent_id, sort_order, due_date, created_at, completed_at FROM todos WHERE id = ?1"
    ).map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_todo).map_err(|e| format!("Not found: {}", e))
}

pub fn update_todo(db: &Database, input: UpdateTodo) -> Result<Todo, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut sets = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref v) = input.title { sets.push(format!("title = ?{}", param_values.len() + 1)); param_values.push(Box::new(v.clone())); }
    if let Some(ref v) = input.description { sets.push(format!("description = ?{}", param_values.len() + 1)); param_values.push(Box::new(v.clone())); }
    if let Some(ref v) = input.status {
        sets.push(format!("status = ?{}", param_values.len() + 1));
        param_values.push(Box::new(v.clone()));
        if v == "completed" {
            sets.push(format!("completed_at = datetime('now')"));
        } else {
            sets.push("completed_at = NULL".into());
        }
    }
    if let Some(ref v) = input.priority { sets.push(format!("priority = ?{}", param_values.len() + 1)); param_values.push(Box::new(v.clone())); }
    if let Some(v) = input.group_id { sets.push(format!("group_id = ?{}", param_values.len() + 1)); param_values.push(Box::new(v)); }
    if let Some(ref v) = input.due_date {
        if v.is_empty() {
            sets.push("due_date = NULL".into());
        } else {
            sets.push(format!("due_date = ?{}", param_values.len() + 1));
            param_values.push(Box::new(v.clone()));
        }
    }

    if sets.is_empty() { return get_todo(db, input.id); }

    let sql = format!("UPDATE todos SET {} WHERE id = ?", sets.join(", "));
    param_values.push(Box::new(input.id));
    let params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params.as_slice()).map_err(|e| format!("Update: {}", e))?;
    drop(conn);
    get_todo(db, input.id)
}

pub fn delete_todo(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM todos WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete: {}", e))?;
    Ok(())
}

pub fn get_todo_with_details(db: &Database, id: i64) -> Result<TodoWithDetails, String> {
    let todo = get_todo(db, id)?;
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare(
        "SELECT t.id, t.name, t.color FROM tags t JOIN todo_tags tt ON t.id = tt.tag_id WHERE tt.todo_id = ?1"
    ).map_err(|e| format!("Prepare tags: {}", e))?;
    let tags: Vec<Tag> = stmt.query_map(params![id], |row| Ok(Tag {
        id: row.get(0)?, name: row.get(1)?, color: row.get(2)?,
    })).map_err(|e| format!("Query tags: {}", e))?.filter_map(|r| r.ok()).collect();

    let mut stmt = conn.prepare(
        "SELECT id, title, description, status, priority, group_id, parent_id, sort_order, due_date, created_at, completed_at FROM todos WHERE parent_id = ?1 ORDER BY sort_order"
    ).map_err(|e| format!("Prepare subtasks: {}", e))?;
    let sub_tasks = stmt.query_map(params![id], row_to_todo)
        .map_err(|e| format!("Query subtasks: {}", e))?.filter_map(|r| r.ok()).collect();

    let mut stmt = conn.prepare(
        "SELECT scene_id FROM todo_scene_bindings WHERE todo_id = ?1"
    ).map_err(|e| format!("Prepare bindings: {}", e))?;
    let bound_scene_ids: Vec<i64> = stmt.query_map(params![id], |row| row.get(0))
        .map_err(|e| format!("Query bindings: {}", e))?.filter_map(|r| r.ok()).collect();

    let bound_scene_ids: Vec<i64> = if bound_scene_ids.is_empty() {
        if let Some(parent_id) = todo.parent_id {
            let mut parent_stmt = conn.prepare(
                "SELECT scene_id FROM todo_scene_bindings WHERE todo_id = ?1"
            ).map_err(|e| format!("Prepare parent bindings: {}", e))?;
            let parent_ids: Vec<i64> = parent_stmt.query_map(params![parent_id], |row| row.get(0))
                .map_err(|e| format!("Query parent bindings: {}", e))?.filter_map(|r| r.ok()).collect();
            drop(parent_stmt);
            parent_ids
        } else {
            bound_scene_ids
        }
    } else {
        bound_scene_ids
    };

    Ok(TodoWithDetails { todo, tags, sub_tasks, bound_scene_ids })
}

pub fn list_todos_by_app(db: &Database, app_id: i64) -> Result<Vec<TodoWithDetails>, String> {
    let ids: Vec<i64> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        // Top-level todos bound to scenes that contain this app
        let mut stmt = conn.prepare(
            "SELECT DISTINCT t.id FROM todos t
             JOIN todo_scene_bindings b ON t.id = b.todo_id
             JOIN scene_apps sa ON b.scene_id = sa.scene_id
             WHERE sa.app_id = ?1 AND t.status = 'pending' AND t.parent_id IS NULL
             ORDER BY t.sort_order"
        ).map_err(|e| format!("Prepare: {}", e))?;
        let mut result: Vec<i64> = stmt.query_map(params![app_id], |row| row.get(0))
            .map_err(|e| format!("Query: {}", e))?.filter_map(|r| r.ok()).collect();

        // Also include top-level todos whose sub-tasks are bound to scenes with this app
        let mut stmt2 = conn.prepare(
            "SELECT DISTINCT t.id FROM todos t
             JOIN todos sub ON sub.parent_id = t.id
             JOIN todo_scene_bindings b ON sub.id = b.todo_id
             JOIN scene_apps sa ON b.scene_id = sa.scene_id
             WHERE sa.app_id = ?1 AND t.status = 'pending' AND t.parent_id IS NULL
               AND t.id NOT IN (
                 SELECT DISTINCT t2.id FROM todos t2
                 JOIN todo_scene_bindings b2 ON t2.id = b2.todo_id
                 JOIN scene_apps sa2 ON b2.scene_id = sa2.scene_id
                 WHERE sa2.app_id = ?1
               )"
        ).map_err(|e| format!("Prepare sub-parents: {}", e))?;
        let parent_ids: Vec<i64> = stmt2.query_map(params![app_id], |row| row.get(0))
            .map_err(|e| format!("Query sub-parents: {}", e))?.filter_map(|r| r.ok()).collect();
        result.extend(parent_ids);

        result
    };

    if ids.is_empty() {
        return Ok(vec![]);
    }

    // Fetch the full todo rows for these IDs
    let todos: Vec<Todo> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let id_list = ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT id, title, description, status, priority, group_id, parent_id, sort_order, due_date, created_at, completed_at \
             FROM todos WHERE id IN ({}) ORDER BY sort_order",
            id_list
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare fetch todos: {}", e))?;
        let rows: Vec<Todo> = stmt.query_map([], row_to_todo)
            .map_err(|e| format!("Query fetch todos: {}", e))?
            .filter_map(|r| r.ok()).collect();
        drop(stmt);
        drop(conn);
        rows
    };

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let id_list = ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");
    let tags = batch_query_tags(&conn, &id_list)?;
    let subtasks = batch_query_subtasks(&conn, &id_list)?;
    let scenes = batch_query_scene_bindings(&conn, &id_list, &todos)?;

    Ok(todos.into_iter().map(|todo| {
        let todo_tags = tags.get(&todo.id).cloned().unwrap_or_default();
        let todo_subtasks = subtasks.get(&todo.id).cloned().unwrap_or_default();
        let todo_scenes = scenes.get(&todo.id).cloned().unwrap_or_default();
        TodoWithDetails {
            todo,
            tags: todo_tags,
            sub_tasks: todo_subtasks,
            bound_scene_ids: todo_scenes,
        }
    }).collect())
}

pub fn list_todos_with_details(db: &Database, filters: TodoFilters) -> Result<Vec<TodoWithDetails>, String> {
    let todos = list_todos(db, filters)?;

    if todos.is_empty() {
        return Ok(vec![]);
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let ids: Vec<String> = todos.iter().map(|t| t.id.to_string()).collect();
    let id_list = ids.join(",");

    let tags = batch_query_tags(&conn, &id_list)?;
    let subtasks = batch_query_subtasks(&conn, &id_list)?;
    let scenes = batch_query_scene_bindings(&conn, &id_list, &todos)?;

    Ok(todos.into_iter().map(|todo| {
        let todo_tags = tags.get(&todo.id).cloned().unwrap_or_default();
        let todo_subtasks = subtasks.get(&todo.id).cloned().unwrap_or_default();
        let todo_scenes = scenes.get(&todo.id).cloned().unwrap_or_default();
        TodoWithDetails {
            todo,
            tags: todo_tags,
            sub_tasks: todo_subtasks,
            bound_scene_ids: todo_scenes,
        }
    }).collect())
}

/// Batch-fetch TodoWithDetails for a list of todo IDs.
/// Uses the same batch query strategy as list_todos_with_details.
pub fn get_todos_with_details_by_ids(db: &Database, ids: &[i64]) -> Result<Vec<TodoWithDetails>, String> {
    if ids.is_empty() {
        return Ok(vec![]);
    }

    let id_list = ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");

    let todos: Vec<Todo> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let sql = format!(
            "SELECT id, title, description, status, priority, group_id, parent_id, sort_order, due_date, created_at, completed_at \
             FROM todos WHERE id IN ({}) ORDER BY sort_order",
            id_list
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare: {}", e))?;
        let rows: Vec<Todo> = stmt.query_map([], row_to_todo)
            .map_err(|e| format!("Query: {}", e))?
            .filter_map(|r| r.ok()).collect();
        drop(stmt);
        drop(conn);
        rows
    };

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let tags = batch_query_tags(&conn, &id_list)?;
    let subtasks = batch_query_subtasks(&conn, &id_list)?;
    let scenes = batch_query_scene_bindings(&conn, &id_list, &todos)?;

    Ok(todos.into_iter().map(|todo| {
        let todo_tags = tags.get(&todo.id).cloned().unwrap_or_default();
        let todo_subtasks = subtasks.get(&todo.id).cloned().unwrap_or_default();
        let todo_scenes = scenes.get(&todo.id).cloned().unwrap_or_default();
        TodoWithDetails {
            todo,
            tags: todo_tags,
            sub_tasks: todo_subtasks,
            bound_scene_ids: todo_scenes,
        }
    }).collect())
}

pub fn add_tag_to_todo(db: &Database, todo_id: i64, tag_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?1, ?2)", params![todo_id, tag_id])
        .map_err(|e| format!("Add tag: {}", e))?;
    Ok(())
}

pub fn remove_tag_from_todo(db: &Database, todo_id: i64, tag_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM todo_tags WHERE todo_id = ?1 AND tag_id = ?2", params![todo_id, tag_id])
        .map_err(|e| format!("Remove tag: {}", e))?;
    Ok(())
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct TodoFilters {
    pub status: Option<String>,
    pub group_id: Option<i64>,
    pub tag_id: Option<i64>,
    pub priority: Option<String>,
    pub parent_id: Option<i64>,
    pub due_before: Option<String>,
}

fn row_to_todo(row: &Row) -> Result<Todo, rusqlite::Error> {
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
}

/// Batch-query tags for multiple todo IDs. Returns HashMap<todo_id, Vec<Tag>>.
fn batch_query_tags(conn: &rusqlite::Connection, id_list: &str) -> Result<std::collections::HashMap<i64, Vec<Tag>>, String> {
    let sql = format!(
        "SELECT tt.todo_id, t.id, t.name, t.color FROM tags t JOIN todo_tags tt ON t.id = tt.tag_id WHERE tt.todo_id IN ({})",
        id_list
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare batch tags: {}", e))?;
    let mut map: std::collections::HashMap<i64, Vec<Tag>> = std::collections::HashMap::new();
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            Tag {
                id: row.get(1)?,
                name: row.get(2)?,
                color: row.get(3)?,
            },
        ))
    }).map_err(|e| format!("Query batch tags: {}", e))?;

    for r in rows {
        let (todo_id, tag) = r.map_err(|e| format!("Row batch tags: {}", e))?;
        map.entry(todo_id).or_default().push(tag);
    }
    Ok(map)
}

/// Batch-query subtasks for multiple parent todo IDs. Returns HashMap<parent_id, Vec<Todo>>.
fn batch_query_subtasks(conn: &rusqlite::Connection, id_list: &str) -> Result<std::collections::HashMap<i64, Vec<Todo>>, String> {
    let sql = format!(
        "SELECT id, title, description, status, priority, group_id, parent_id, sort_order, due_date, created_at, completed_at \
         FROM todos WHERE parent_id IN ({}) ORDER BY sort_order",
        id_list
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare batch subtasks: {}", e))?;
    let mut map: std::collections::HashMap<i64, Vec<Todo>> = std::collections::HashMap::new();
    let rows = stmt.query_map([], row_to_todo).map_err(|e| format!("Query batch subtasks: {}", e))?;

    for r in rows {
        let todo = r.map_err(|e| format!("Row batch subtasks: {}", e))?;
        if let Some(pid) = todo.parent_id {
            map.entry(pid).or_default().push(todo);
        }
    }
    Ok(map)
}

/// Batch-query scene bindings for multiple todo IDs. Returns HashMap<todo_id, Vec<i64>>.
/// Falls back to parent bindings when a todo has no direct bindings.
fn batch_query_scene_bindings(
    conn: &rusqlite::Connection,
    id_list: &str,
    todos: &[Todo],
) -> Result<std::collections::HashMap<i64, Vec<i64>>, String> {
    let sql = format!(
        "SELECT todo_id, scene_id FROM todo_scene_bindings WHERE todo_id IN ({})",
        id_list
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare batch scenes: {}", e))?;
    let mut map: std::collections::HashMap<i64, Vec<i64>> = std::collections::HashMap::new();
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
    }).map_err(|e| format!("Query batch scenes: {}", e))?;

    for r in rows {
        let (todo_id, scene_id) = r.map_err(|e| format!("Row batch scenes: {}", e))?;
        map.entry(todo_id).or_default().push(scene_id);
    }

    for todo in todos {
        if !map.contains_key(&todo.id) {
            if let Some(parent_id) = todo.parent_id {
                let parent_sql = format!(
                    "SELECT scene_id FROM todo_scene_bindings WHERE todo_id = {}",
                    parent_id
                );
                let mut parent_stmt = conn.prepare(&parent_sql)
                    .map_err(|e| format!("Prepare parent batch: {}", e))?;
                let parent_ids: Vec<i64> = parent_stmt.query_map([], |row| row.get(0))
                    .map_err(|e| format!("Query parent batch: {}", e))?
                    .filter_map(|r| r.ok()).collect();
                if !parent_ids.is_empty() {
                    map.insert(todo.id, parent_ids);
                }
            }
        }
    }

    Ok(map)
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
    fn test_create_todo() {
        let db = setup_db();
        let todo = create_todo(&db, CreateTodo {
            title: "Test todo".into(),
            description: Some("desc".into()),
            priority: Some("high".into()),
            group_id: None,
            parent_id: None,
            due_date: None,
        }).unwrap();
        assert_eq!(todo.title, "Test todo");
        assert_eq!(todo.status, "pending");
        assert_eq!(todo.priority, "high");
    }

    #[test]
    fn test_update_todo_status() {
        let db = setup_db();
        let todo = create_todo(&db, CreateTodo {
            title: "Test".into(), description: None,
            priority: None, group_id: None, parent_id: None, due_date: None,
        }).unwrap();
        let updated = update_todo(&db, UpdateTodo {
            id: todo.id, title: None, description: None,
            status: Some("completed".into()), priority: None,
            group_id: None, due_date: None,
        }).unwrap();
        assert_eq!(updated.status, "completed");
        assert!(updated.completed_at.is_some());
    }

    #[test]
    fn test_list_todos_with_filter() {
        let db = setup_db();
        create_todo(&db, CreateTodo {
            title: "Pending".into(), description: None,
            priority: None, group_id: None, parent_id: None, due_date: None,
        }).unwrap();
        let todo2 = create_todo(&db, CreateTodo {
            title: "Done".into(), description: None,
            priority: None, group_id: None, parent_id: None, due_date: None,
        }).unwrap();
        update_todo(&db, UpdateTodo {
            id: todo2.id, title: None, description: None,
            status: Some("completed".into()), priority: None,
            group_id: None, due_date: None,
        }).unwrap();

        let pending = list_todos(&db, TodoFilters {
            status: Some("pending".into()), ..Default::default()
        }).unwrap();
        assert_eq!(pending.len(), 1);
        assert_eq!(pending[0].title, "Pending");
    }

    #[test]
    fn test_sub_tasks() {
        let db = setup_db();
        let parent = create_todo(&db, CreateTodo {
            title: "Parent".into(), description: None,
            priority: None, group_id: None, parent_id: None, due_date: None,
        }).unwrap();
        create_todo(&db, CreateTodo {
            title: "Child".into(), description: None,
            priority: None, group_id: None, parent_id: Some(parent.id), due_date: None,
        }).unwrap();

        let details = get_todo_with_details(&db, parent.id).unwrap();
        assert_eq!(details.sub_tasks.len(), 1);
        assert_eq!(details.sub_tasks[0].title, "Child");
    }

    #[test]
    fn test_delete_todo_cascades() {
        let db = setup_db();
        let parent = create_todo(&db, CreateTodo {
            title: "Parent".into(), description: None,
            priority: None, group_id: None, parent_id: None, due_date: None,
        }).unwrap();
        create_todo(&db, CreateTodo {
            title: "Child".into(), description: None,
            priority: None, group_id: None, parent_id: Some(parent.id), due_date: None,
        }).unwrap();
        delete_todo(&db, parent.id).unwrap();
        assert!(get_todo(&db, parent.id).is_err());
    }
}
