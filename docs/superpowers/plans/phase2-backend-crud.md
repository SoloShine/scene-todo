# Phase 2: Backend CRUD Commands

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement repository layer (DB operations) and Tauri commands for all entities: todos, groups, tags, apps, and bindings.

**Architecture:** Repository pattern — each entity (todo, group, tag, app) gets a dedicated repo module with functions that take `&Database` and return domain models. Tauri commands are thin wrappers that inject `State<Database>` and delegate to repos.

**Tech Stack:** Rust, rusqlite, Tauri 2.0 commands, serde

**Parent:** [2026-04-16-scene-todo.md](2026-04-16-scene-todo.md)

**Depends on:** Phase 1 (database, models, Tauri state)

---

### Task 5: Todo Repository

**Files:**
- Create: `src-tauri/src/services/todo_repo.rs`

- [ ] **Step 1: Write failing tests for todo repo**

File: `src-tauri/src/services/todo_repo.rs` — append tests at bottom:
```rust
use rusqlite::{params, Row};
use crate::models::*;
use crate::services::db::Database;

pub fn create_todo(db: &Database, input: CreateTodo) -> Result<Todo, String> {
    todo!("implement")
}

pub fn list_todos(db: &Database, filters: TodoFilters) -> Result<Vec<Todo>, String> {
    todo!("implement")
}

pub fn get_todo(db: &Database, id: i64) -> Result<Todo, String> {
    todo!("implement")
}

pub fn update_todo(db: &Database, input: UpdateTodo) -> Result<Todo, String> {
    todo!("implement")
}

pub fn delete_todo(db: &Database, id: i64) -> Result<(), String> {
    todo!("implement")
}

pub fn get_todo_with_details(db: &Database, id: i64) -> Result<TodoWithDetails, String> {
    todo!("implement")
}

pub fn list_todos_by_app(db: &Database, app_id: i64) -> Result<Vec<TodoWithDetails>, String> {
    todo!("implement")
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct TodoFilters {
    pub status: Option<String>,
    pub group_id: Option<i64>,
    pub tag_id: Option<i64>,
    pub priority: Option<String>,
    pub parent_id: Option<i64>,  // None = top-level only
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test --lib services::todo_repo
```

Expected: Compilation fails — functions use `todo!()` macro.

- [ ] **Step 3: Implement todo_repo functions**

Replace the `todo!("implement")` bodies with full implementations:

```rust
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
    if let Some(ref v) = input.due_date { sets.push(format!("due_date = ?{}", param_values.len() + 1)); param_values.push(Box::new(v.clone())); }

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

    // Tags
    let mut stmt = conn.prepare(
        "SELECT t.id, t.name, t.color FROM tags t JOIN todo_tags tt ON t.id = tt.tag_id WHERE tt.todo_id = ?1"
    ).map_err(|e| format!("Prepare tags: {}", e))?;
    let tags: Vec<Tag> = stmt.query_map(params![id], |row| Ok(Tag {
        id: row.get(0)?, name: row.get(1)?, color: row.get(2)?,
    })).map_err(|e| format!("Query tags: {}", e))?.filter_map(|r| r.ok()).collect();

    // Sub-tasks
    let mut stmt = conn.prepare(
        "SELECT id, title, description, status, priority, group_id, parent_id, sort_order, due_date, created_at, completed_at FROM todos WHERE parent_id = ?1 ORDER BY sort_order"
    ).map_err(|e| format!("Prepare subtasks: {}", e))?;
    let sub_tasks = stmt.query_map(params![id], row_to_todo)
        .map_err(|e| format!("Query subtasks: {}", e))?.filter_map(|r| r.ok()).collect();

    // Bound app ids
    let mut stmt = conn.prepare(
        "SELECT app_id FROM todo_app_bindings WHERE todo_id = ?1"
    ).map_err(|e| format!("Prepare bindings: {}", e))?;
    let bound_app_ids: Vec<i64> = stmt.query_map(params![id], |row| row.get(0))
        .map_err(|e| format!("Query bindings: {}", e))?.filter_map(|r| r.ok()).collect();

    Ok(TodoWithDetails { todo, tags, sub_tasks, bound_app_ids })
}

pub fn list_todos_by_app(db: &Database, app_id: i64) -> Result<Vec<TodoWithDetails>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT t.id FROM todos t JOIN todo_app_bindings b ON t.id = b.todo_id WHERE b.app_id = ?1 AND t.status = 'pending' AND t.parent_id IS NULL ORDER BY t.sort_order"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let ids: Vec<i64> = stmt.query_map(params![app_id], |row| row.get(0))
        .map_err(|e| format!("Query: {}", e))?.filter_map(|r| r.ok()).collect();
    drop(conn);
    ids.iter().map(|&id| get_todo_with_details(db, id)).collect()
}

// Tag management helpers for todos
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test --lib services::todo_repo -- --nocapture
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/todo_repo.rs
git commit -m "feat: implement todo repository with CRUD and filtering"
```

---

### Task 6: Group Repository

**Files:**
- Create: `src-tauri/src/services/group_repo.rs`

- [ ] **Step 1: Write group_repo.rs with tests and implementation**

File: `src-tauri/src/services/group_repo.rs`
```rust
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
    // Get next sort_order
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
        let mut stmt = db.conn.lock().unwrap().prepare("SELECT id, name, color, sort_order, parent_id FROM groups WHERE id = ?1").unwrap();
        return stmt.query_row(params![input.id], row_to_group).map_err(|e| e.to_string());
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
```

- [ ] **Step 2: Run tests**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test --lib services::group_repo -- --nocapture
```

Expected: All 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/services/group_repo.rs
git commit -m "feat: implement group repository with CRUD and nesting"
```

---

### Task 7: Tag Repository

**Files:**
- Create: `src-tauri/src/services/tag_repo.rs`

- [ ] **Step 1: Write tag_repo.rs with tests and implementation**

File: `src-tauri/src/services/tag_repo.rs`
```rust
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
        let mut stmt = db.conn.lock().unwrap().prepare("SELECT id, name, color FROM tags WHERE id = ?1").unwrap();
        return stmt.query_row(params![input.id], row_to_tag).map_err(|e| e.to_string());
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
```

- [ ] **Step 2: Run tests**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test --lib services::tag_repo -- --nocapture
```

Expected: All 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/services/tag_repo.rs
git commit -m "feat: implement tag repository with CRUD"
```

---

### Task 8: App + Binding Repository

**Files:**
- Create: `src-tauri/src/services/app_repo.rs`

- [ ] **Step 1: Write app_repo.rs with tests and implementation**

File: `src-tauri/src/services/app_repo.rs`
```rust
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

// Bindings
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
```

- [ ] **Step 2: Run tests**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test --lib services::app_repo -- --nocapture
```

Expected: All 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/services/app_repo.rs
git commit -m "feat: implement app and binding repository with process matching"
```

---

### Task 9: Tauri Commands (Frontend API)

**Files:**
- Create: `src-tauri/src/commands/todo_cmd.rs`
- Create: `src-tauri/src/commands/group_cmd.rs`
- Create: `src-tauri/src/commands/tag_cmd.rs`
- Create: `src-tauri/src/commands/app_cmd.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs` — register all commands

- [ ] **Step 1: Write todo commands**

File: `src-tauri/src/commands/todo_cmd.rs`
```rust
use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::todo_repo::{self, TodoFilters};

#[tauri::command]
pub fn create_todo(db: State<Database>, input: CreateTodo) -> Result<Todo, String> {
    todo_repo::create_todo(&db, input)
}

#[tauri::command]
pub fn list_todos(db: State<Database>, filters: TodoFilters) -> Result<Vec<Todo>, String> {
    todo_repo::list_todos(&db, filters)
}

#[tauri::command]
pub fn get_todo(db: State<Database>, id: i64) -> Result<Todo, String> {
    todo_repo::get_todo(&db, id)
}

#[tauri::command]
pub fn update_todo(db: State<Database>, input: UpdateTodo) -> Result<Todo, String> {
    todo_repo::update_todo(&db, input)
}

#[tauri::command]
pub fn delete_todo(db: State<Database>, id: i64) -> Result<(), String> {
    todo_repo::delete_todo(&db, id)
}

#[tauri::command]
pub fn get_todo_with_details(db: State<Database>, id: i64) -> Result<TodoWithDetails, String> {
    todo_repo::get_todo_with_details(&db, id)
}

#[tauri::command]
pub fn list_todos_by_app(db: State<Database>, app_id: i64) -> Result<Vec<TodoWithDetails>, String> {
    todo_repo::list_todos_by_app(&db, app_id)
}

#[tauri::command]
pub fn add_tag_to_todo(db: State<Database>, todo_id: i64, tag_id: i64) -> Result<(), String> {
    todo_repo::add_tag_to_todo(&db, todo_id, tag_id)
}

#[tauri::command]
pub fn remove_tag_from_todo(db: State<Database>, todo_id: i64, tag_id: i64) -> Result<(), String> {
    todo_repo::remove_tag_from_todo(&db, todo_id, tag_id)
}
```

- [ ] **Step 2: Write group commands**

File: `src-tauri/src/commands/group_cmd.rs`
```rust
use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::group_repo;

#[tauri::command]
pub fn create_group(db: State<Database>, input: CreateGroup) -> Result<Group, String> {
    group_repo::create_group(&db, input)
}

#[tauri::command]
pub fn list_groups(db: State<Database>) -> Result<Vec<Group>, String> {
    group_repo::list_groups(&db)
}

#[tauri::command]
pub fn update_group(db: State<Database>, input: UpdateGroup) -> Result<Group, String> {
    group_repo::update_group(&db, input)
}

#[tauri::command]
pub fn delete_group(db: State<Database>, id: i64) -> Result<(), String> {
    group_repo::delete_group(&db, id)
}
```

- [ ] **Step 3: Write tag commands**

File: `src-tauri/src/commands/tag_cmd.rs`
```rust
use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::tag_repo;

#[tauri::command]
pub fn create_tag(db: State<Database>, input: CreateTag) -> Result<Tag, String> {
    tag_repo::create_tag(&db, input)
}

#[tauri::command]
pub fn list_tags(db: State<Database>) -> Result<Vec<Tag>, String> {
    tag_repo::list_tags(&db)
}

#[tauri::command]
pub fn update_tag(db: State<Database>, input: UpdateTag) -> Result<Tag, String> {
    tag_repo::update_tag(&db, input)
}

#[tauri::command]
pub fn delete_tag(db: State<Database>, id: i64) -> Result<(), String> {
    tag_repo::delete_tag(&db, id)
}
```

- [ ] **Step 4: Write app commands**

File: `src-tauri/src/commands/app_cmd.rs`
```rust
use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::app_repo;

#[tauri::command]
pub fn create_app(db: State<Database>, input: CreateApp) -> Result<App, String> {
    app_repo::create_app(&db, input)
}

#[tauri::command]
pub fn list_apps(db: State<Database>) -> Result<Vec<App>, String> {
    app_repo::list_apps(&db)
}

#[tauri::command]
pub fn update_app(db: State<Database>, input: UpdateApp) -> Result<App, String> {
    app_repo::update_app(&db, input)
}

#[tauri::command]
pub fn delete_app(db: State<Database>, id: i64) -> Result<(), String> {
    app_repo::delete_app(&db, id)
}

#[tauri::command]
pub fn bind_todo_to_app(db: State<Database>, todo_id: i64, app_id: i64) -> Result<(), String> {
    app_repo::bind_todo_to_app(&db, todo_id, app_id)
}

#[tauri::command]
pub fn unbind_todo_from_app(db: State<Database>, todo_id: i64, app_id: i64) -> Result<(), String> {
    app_repo::unbind_todo_from_app(&db, todo_id, app_id)
}
```

- [ ] **Step 5: Update commands module**

File: `src-tauri/src/commands/mod.rs`
```rust
pub mod todo_cmd;
pub mod group_cmd;
pub mod tag_cmd;
pub mod app_cmd;
```

- [ ] **Step 6: Register all commands in lib.rs**

File: `src-tauri/src/lib.rs` — update the `invoke_handler`:
```rust
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
])
```

- [ ] **Step 7: Verify compilation and app launch**

Run:
```bash
cd d:/Project/scene-todo && npm run tauri dev
```

Expected: App compiles and launches. No runtime errors.

- [ ] **Step 8: Run all tests**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test --lib
```

Expected: All tests pass (db: 3, todo: 5, group: 3, tag: 2, app: 3 = 16 total).

- [ ] **Step 9: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs
git commit -m "feat: add Tauri commands for all entity CRUD operations"
```
