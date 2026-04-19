# Phase 4: Backend Reliability Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate N+1 query patterns in the Rust backend, fix Widget lifecycle (reuse pool + cleanup on app delete), and harden data safety (import validation, transaction wrapping, session persistence).

**Architecture:** Refactor `todo_repo.rs` to use batch queries instead of per-item loops, add an in-memory app cache to `window_monitor.rs`, convert `widget_manager.rs` to a reuse pool pattern, wrap `data_port.rs::import_all` in a transaction with validation, and persist the current `TimeTracker` session to a new `current_session` table.

**Tech Stack:** Rust, rusqlite 0.31, Tauri 2.0, percent-encoding crate

**Spec:** `docs/superpowers/specs/2026-04-19-phase4-backend-reliability-design.md`

---

## File Structure

### New files
- `src-tauri/migrations/004_current_session.sql` — Single-row table for session persistence
- `src-tauri/src/services/import_validator.rs` — Import data validation module

### Modified files (10)
- `src-tauri/Cargo.toml` — Add `percent-encoding` dependency
- `src-tauri/src/services/todo_repo.rs` — N+1 queries → batch queries (batch_query_tags, batch_query_subtasks, batch_query_scene_bindings)
- `src-tauri/src/services/widget_manager.rs` — Reuse pool + cleanup + URL encoding fix
- `src-tauri/src/services/data_port.rs` — Transaction wrapping + import validation
- `src-tauri/src/services/time_tracker.rs` — Session persistence via `current_session` table
- `src-tauri/src/services/window_monitor.rs` — In-memory app cache + 30s refresh
- `src-tauri/src/services/db.rs` — Register migration 004
- `src-tauri/src/services/mod.rs` — Add `import_validator` module
- `src-tauri/src/commands/app_cmd.rs` — Call `widget_manager.destroy_widget` on app delete
- `src-tauri/src/services/scene_repo.rs` — Batch-aware `list_todos_with_details_by_scene`

---

### Task 1: Add `percent-encoding` dependency

**Files:** `src-tauri/Cargo.toml`

- [ ] **Step 1: Add dependency**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
percent-encoding = "2"
```

- [ ] **Step 2: Verify compilation**

Run: `cd d:/Project/scene-todo/src-tauri && cargo build 2>&1 | tail -5`

Expected: `Finished` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore: add percent-encoding dependency for URL encoding"
```

---

### Task 2: Create migration 004 — `current_session` table

**Files:**
- Create: `src-tauri/migrations/004_current_session.sql`
- Modify: `src-tauri/src/services/db.rs`

- [ ] **Step 1: Create migration SQL file**

Create `src-tauri/migrations/004_current_session.sql`:

```sql
CREATE TABLE IF NOT EXISTS current_session (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    scene_id INTEGER NOT NULL,
    app_id INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL
);
```

- [ ] **Step 2: Register migration in db.rs**

In `src-tauri/src/services/db.rs`, add the migration entry. In the `run_migrations` method, the `migrations` vec currently has entries 1-3. Add entry 4:

```rust
let migrations: Vec<(i64, &str, &str)> = vec![
    (1, "001_init", include_str!("../../migrations/001_init.sql")),
    (2, "002_scene_tracking", include_str!("../../migrations/002_scene_tracking.sql")),
    (3, "003_show_widget", include_str!("../../migrations/003_show_widget.sql")),
    (4, "004_current_session", include_str!("../../migrations/004_current_session.sql")),
];
```

- [ ] **Step 3: Verify compilation and migration**

Run: `cd d:/Project/scene-todo/src-tauri && cargo build 2>&1 | tail -5`

Expected: Build succeeds. On next app start, migration 004 runs and creates the `current_session` table.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/migrations/004_current_session.sql src-tauri/src/services/db.rs
git commit -m "feat: add current_session table migration for session persistence"
```

---

### Task 3: N+1 query optimization in `todo_repo.rs`

**Files:** `src-tauri/src/services/todo_repo.rs`

This is the biggest performance fix. The current `list_todos_with_details` and `list_todos_by_app` loop over IDs calling `get_todo_with_details` (3-4 queries per item). We replace this with 4 fixed batch queries.

- [ ] **Step 1: Add batch query helper functions**

At the bottom of `todo_repo.rs` (before the `#[cfg(test)]` block), add three batch query functions:

```rust
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
            row.get::<_, i64>(0)?, // todo_id
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

    // For todos with no direct bindings, check parent bindings (mirrors get_todo_with_details logic)
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
```

- [ ] **Step 2: Rewrite `list_todos_with_details` to use batch queries**

Replace the current `list_todos_with_details` function (line 194-197) with:

```rust
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
```

- [ ] **Step 3: Rewrite `list_todos_by_app` to use batch queries**

Replace the current `list_todos_by_app` function (lines 157-192) with:

```rust
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
        stmt.query_map([], row_to_todo)
            .map_err(|e| format!("Query fetch todos: {}", e))?
            .filter_map(|r| r.ok()).collect()
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
```

Note: The `get_todo_with_details` single-item function is kept unchanged — it is still used directly by the `get_todo_with_details` Tauri command for single-todo views. Only the list functions are optimized.

- [ ] **Step 4: Verify compilation and tests**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test 2>&1 | tail -20
cargo build 2>&1 | tail -5
```

Expected: All existing tests pass. Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/todo_repo.rs
git commit -m "perf: replace N+1 queries with batch queries in list_todos_with_details and list_todos_by_app"
```

---

### Task 4: Optimize `list_todos_with_details_by_scene` in scene_repo.rs

**Files:** `src-tauri/src/services/scene_repo.rs`

The current `list_todos_with_details_by_scene` (line 222-229) also loops calling `get_todo_with_details`. We already have batch queries in `todo_repo` — we can reuse them via a new public batch entry point, or simply call the batch functions through a thin wrapper. The simplest approach: expose a function that takes a `Vec<i64>` and returns `Vec<TodoWithDetails>`.

- [ ] **Step 1: Add a public batch-details function in todo_repo.rs**

In `src-tauri/src/services/todo_repo.rs`, add after `list_todos_with_details`:

```rust
/// Batch-fetch TodoWithDetails for a list of todo IDs.
/// Uses the same batch query strategy as list_todos_with_details.
pub fn get_todos_with_details_by_ids(db: &Database, ids: &[i64]) -> Result<Vec<TodoWithDetails>, String> {
    if ids.is_empty() {
        return Ok(vec![]);
    }

    let id_list = ids.iter().map(|id| id.to_string()).collect::<Vec<_>>().join(",");

    // Fetch the todo rows
    let todos: Vec<Todo> = {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        let sql = format!(
            "SELECT id, title, description, status, priority, group_id, parent_id, sort_order, due_date, created_at, completed_at \
             FROM todos WHERE id IN ({}) ORDER BY sort_order",
            id_list
        );
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare: {}", e))?;
        stmt.query_map([], row_to_todo)
            .map_err(|e| format!("Query: {}", e))?
            .filter_map(|r| r.ok()).collect()
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
```

- [ ] **Step 2: Update `list_todos_with_details_by_scene` in scene_repo.rs**

Replace the current implementation (lines 222-229):

```rust
pub fn list_todos_with_details_by_scene(db: &Database, scene_id: i64) -> Result<Vec<TodoWithDetails>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let ids = query_todo_ids_by_scene(&conn, scene_id)?;
    drop(conn);

    crate::services::todo_repo::get_todos_with_details_by_ids(db, &ids)
}
```

- [ ] **Step 3: Verify compilation and tests**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test 2>&1 | tail -20
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/services/todo_repo.rs src-tauri/src/services/scene_repo.rs
git commit -m "perf: batch-optimize list_todos_with_details_by_scene via shared batch query"
```

---

### Task 5: In-memory app cache for WindowMonitor

**Files:** `src-tauri/src/services/window_monitor.rs`

The `find_app_by_process_conn` function loads ALL apps from the database on every call (~every 200ms). We add an in-memory cache that refreshes periodically.

- [ ] **Step 1: Add app cache fields to WindowMonitor**

In `src-tauri/src/services/window_monitor.rs`, add `std::collections::HashMap` to imports and add cache fields:

Add to imports at top:
```rust
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

use crate::models::App;
use crate::services::app_repo;
use crate::services::db::Database;
use crate::services::process_matcher;
use crate::services::scene_repo;
use crate::services::time_tracker::TimeTracker;
```

Add cache fields to the struct:
```rust
pub struct WindowMonitor {
    app_handle: AppHandle,
    db: Arc<Database>,
    time_tracker: Arc<TimeTracker>,
    running: Arc<Mutex<bool>>,
    last_hwnd: Arc<Mutex<isize>>,
    last_active_scene_id: Arc<Mutex<Option<i64>>>,
    tracked_hwnd: Arc<Mutex<isize>>,
    our_pid: u32,
    // App cache: process_name (lowercase) -> App
    app_cache: Arc<Mutex<HashMap<String, App>>>,
    app_cache_updated: Arc<Mutex<Instant>>,
}
```

- [ ] **Step 2: Initialize cache in `new()`**

In the `new()` constructor, add:
```rust
pub fn new(
    app_handle: AppHandle,
    db: Arc<Database>,
    time_tracker: Arc<TimeTracker>,
) -> Self {
    Self {
        app_handle,
        db,
        time_tracker,
        running: Arc::new(Mutex::new(false)),
        last_hwnd: Arc::new(Mutex::new(0)),
        last_active_scene_id: Arc::new(Mutex::new(None)),
        tracked_hwnd: Arc::new(Mutex::new(0)),
        our_pid: std::process::id(),
        app_cache: Arc::new(Mutex::new(HashMap::new())),
        app_cache_updated: Arc::new(Mutex::new(Instant::now() - Duration::from_secs(300))),
    }
}
```

- [ ] **Step 3: Add cache refresh and lookup methods**

Add these methods to `impl WindowMonitor`:

```rust
/// Refresh the app cache from the database.
fn refresh_app_cache(&self) {
    let apps = app_repo::list_apps(&self.db).unwrap_or_default();
    let mut cache = HashMap::new();
    for app in apps {
        if let Ok(names) = serde_json::from_str::<Vec<String>>(&app.process_names) {
            for name in names {
                cache.insert(name.to_lowercase(), app.clone());
            }
        }
    }
    *self.app_cache.lock().unwrap() = cache;
    *self.app_cache_updated.lock().unwrap() = Instant::now();
}

/// Look up an app by process name. Refreshes cache if stale (>30s).
fn find_app_cached(&self, process_name: &str) -> Option<App> {
    {
        let updated = self.app_cache_updated.lock().unwrap();
        if updated.elapsed() > Duration::from_secs(30) {
            drop(updated);
            self.refresh_app_cache();
        }
    }
    let cache = self.app_cache.lock().unwrap();
    cache.get(&process_name.to_lowercase()).cloned()
}

/// Force-refresh the app cache (call after app CRUD operations).
pub fn invalidate_app_cache(&self) {
    self.refresh_app_cache();
}
```

- [ ] **Step 4: Replace `find_app_by_process_conn` call in the monitor thread**

In the `start()` method, inside the spawned thread, find the block (around line 129-131):

```rust
let db_conn = db.conn.lock().unwrap();
let matched_app =
    app_repo::find_app_by_process_conn(&db_conn, &process_name);
drop(db_conn);
```

Replace with:
```rust
// Use the WindowMonitor's find_app_cached. We need a reference to self,
// but since we're in a spawned thread, we'll use an Arc-based approach.
let matched_app = app_cache_clone.find_app_cached(&process_name);
```

To make this work, add `app_cache` and `app_cache_updated` clones in the thread closure at the beginning of `start()`:

```rust
let app_cache = self.app_cache.clone();
let app_cache_updated = self.app_cache_updated.lock().unwrap().clone();
```

Actually, a cleaner approach is to move the cache lookup inline since we already clone Arcs. Add these to the thread closure variable captures in `start()`:

```rust
let app_cache = self.app_cache.clone();
let app_cache_updated_arc = self.app_cache_updated.clone();
```

Then in the thread body, replace the `find_app_by_process_conn` call:

```rust
// Refresh cache if stale (>30s)
{
    let mut updated = app_cache_updated_arc.lock().unwrap();
    if updated.elapsed() > Duration::from_secs(30) {
        let apps = app_repo::list_apps(&db).unwrap_or_default();
        let mut cache = HashMap::new();
        for app in apps {
            if let Ok(names) = serde_json::from_str::<Vec<String>>(&app.process_names) {
                for name in names {
                    cache.insert(name.to_lowercase(), app.clone());
                }
            }
        }
        *app_cache.lock().unwrap() = cache;
        *updated = Instant::now();
    }
}
let matched_app = app_cache.lock().unwrap().get(&process_name.to_lowercase()).cloned();
```

This replaces the `db.conn.lock()` + full table scan with an in-memory HashMap lookup.

- [ ] **Step 5: Verify compilation**

Run: `cd d:/Project/scene-todo/src-tauri && cargo build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/services/window_monitor.rs
git commit -m "perf: add in-memory app cache to WindowMonitor, refreshes every 30s"
```

---

### Task 6: Widget lifecycle — reuse pool + URL encoding fix

**Files:** `src-tauri/src/services/widget_manager.rs`

The current `WidgetManager` keeps `active_widgets: HashMap<i64, String>` (app_id -> label) but only shows/hides. The URL encoding uses a hand-written function. We fix both.

- [ ] **Step 1: Replace hand-written `urlencoding` with `percent_encoding` crate**

In `src-tauri/src/services/widget_manager.rs`, replace the `urlencoding` function at the bottom (lines 182-191):

```rust
fn urlencoding(s: &str) -> String {
    percent_encoding::percent_encode(s.as_bytes(), percent_encoding::NON_ALPHANUMERIC).to_string()
}
```

Add import at top:
```rust
use percent_encoding;
```

Note: The `urlencoding` local function name is kept for backward compatibility — it just delegates to the crate now.

- [ ] **Step 2: Add `destroy_all_widgets` method**

Add a method to clean up all widgets (used on shutdown or app deletion cascade):

```rust
/// Destroy all active widgets. Called on shutdown.
pub fn destroy_all_widgets(&self, app_handle: &AppHandle) {
    let mut active = self.active_widgets.lock().unwrap();
    for (_, label) in active.drain() {
        if let Some(win) = app_handle.get_webview_window(&label) {
            let _ = win.close();
        }
    }
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd d:/Project/scene-todo/src-tauri && cargo build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/services/widget_manager.rs
git commit -m "fix: replace hand-written URL encoding with percent-encoding crate, add destroy_all_widgets"
```

---

### Task 7: Widget cleanup on app deletion

**Files:** `src-tauri/src/commands/app_cmd.rs`

When an app is deleted, its widget window must be destroyed and the app cache invalidated.

- [ ] **Step 1: Modify `delete_app` command to destroy widget**

In `src-tauri/src/commands/app_cmd.rs`, update the `delete_app` function:

Current:
```rust
#[tauri::command]
pub fn delete_app(db: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    app_repo::delete_app(&db, id)
}
```

Replace with:
```rust
#[tauri::command]
pub fn delete_app(
    db: State<'_, Arc<Database>>,
    id: i64,
    app: tauri::AppHandle,
) -> Result<(), String> {
    // Destroy any active widget for this app
    if let Some(widget_mgr) = app.try_state::<WidgetManager>() {
        widget_mgr.destroy_widget(&app, id);
    }
    // Invalidate the WindowMonitor's app cache
    if let Some(monitor) = app.try_state::<WindowMonitor>() {
        monitor.invalidate_app_cache();
    }
    app_repo::delete_app(&db, id)
}
```

Note: `WidgetManager` and `WindowMonitor` are already imported at the top of `app_cmd.rs`.

- [ ] **Step 2: Also invalidate cache on create/update**

Update `create_app` and `update_app` commands to invalidate the monitor cache:

```rust
#[tauri::command]
pub fn create_app(db: State<'_, Arc<Database>>, input: CreateApp, app: tauri::AppHandle) -> Result<App, String> {
    let result = app_repo::create_app(&db, input)?;
    if let Some(monitor) = app.try_state::<WindowMonitor>() {
        monitor.invalidate_app_cache();
    }
    Ok(result)
}

#[tauri::command]
pub fn update_app(db: State<'_, Arc<Database>>, input: UpdateApp, app: tauri::AppHandle) -> Result<App, String> {
    let result = app_repo::update_app(&db, input)?;
    if let Some(monitor) = app.try_state::<WindowMonitor>() {
        monitor.invalidate_app_cache();
    }
    Ok(result)
}
```

- [ ] **Step 3: Verify compilation**

Run: `cd d:/Project/scene-todo/src-tauri && cargo build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/commands/app_cmd.rs
git commit -m "fix: destroy widget and invalidate app cache when app is deleted/created/updated"
```

---

### Task 8: Import validation module

**Files:**
- Create: `src-tauri/src/services/import_validator.rs`
- Modify: `src-tauri/src/services/mod.rs`

- [ ] **Step 1: Create import_validator.rs**

Create `src-tauri/src/services/import_validator.rs`:

```rust
use crate::services::data_port::ExportData;

/// Validate import data structure before applying to database.
/// Returns Ok(()) if data is valid, Err with descriptive message otherwise.
pub fn validate_import_data(data: &ExportData) -> Result<(), String> {
    // 1. Check version
    if data.version != 1 {
        return Err(format!("Unsupported export version: {}. Expected: 1", data.version));
    }

    // 2. Check required tables have valid data types
    // (ExportData fields are already typed as Vec<RowData>, so structural
    //  validation is done by serde deserialization. We check content-level rules.)

    // 3. Validate groups rows have "name" field
    validate_rows_have_field(&data.groups, "groups", "name")?;

    // 4. Validate tags rows have "name" field
    validate_rows_have_field(&data.tags, "tags", "name")?;

    // 5. Validate todos rows have "title" field
    validate_rows_have_field(&data.todos, "todos", "title")?;

    // 6. Validate apps rows have "name" and "process_names" fields
    validate_rows_have_field(&data.apps, "apps", "name")?;
    validate_rows_have_field(&data.apps, "apps", "process_names")?;

    // 7. Validate scenes rows have "name" field
    validate_rows_have_field(&data.scenes, "scenes", "name")?;

    // 8. Check referential sanity: todo_tags references exist
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
```

- [ ] **Step 2: Register module in mod.rs**

In `src-tauri/src/services/mod.rs`, add:

```rust
pub mod import_validator;
```

- [ ] **Step 3: Verify compilation and tests**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test import_validator 2>&1 | tail -15
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/services/import_validator.rs src-tauri/src/services/mod.rs
git commit -m "feat: add import_validator module with structural and referential checks"
```

---

### Task 9: Transaction wrapping in data_port.rs

**Files:** `src-tauri/src/services/data_port.rs`

Wrap the entire `import_all` in a transaction and call the validator.

- [ ] **Step 1: Add import validation and transaction wrapping**

Replace the current `import_all` function (lines 40-78) with:

```rust
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
```

Add a transaction-safe version of `insert_rows`:

```rust
fn insert_rows_tx(tx: &rusqlite::Transaction, table: &str, rows: &[RowData]) -> Result<(), String> {
    if rows.is_empty() {
        return Ok(());
    }

    let cols: Vec<&String> = rows[0].keys().collect();
    let col_list = cols.iter().map(|c| c.as_str()).collect::<Vec<_>>().join(", ");
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
```

Keep the original `insert_rows` function for any other callers (it currently exists as a private helper).

- [ ] **Step 2: Verify compilation and tests**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/services/data_port.rs
git commit -m "fix: wrap import_all in transaction, add validation before import"
```

---

### Task 10: Session persistence in TimeTracker

**Files:** `src-tauri/src/services/time_tracker.rs`

Persist the current session to the `current_session` table on `start_session`, remove it on `end_current_session`, and recover any orphaned session on startup.

- [ ] **Step 1: Rewrite TimeTracker with database persistence**

Replace the entire `src-tauri/src/services/time_tracker.rs`:

```rust
use std::sync::{Arc, Mutex};

use crate::services::db::Database;

struct PendingSession {
    scene_id: i64,
    app_id: i64,
    started_at: String,
}

pub struct TimeTracker {
    db: Arc<Database>,
    current_session: Arc<Mutex<Option<PendingSession>>>,
    paused: Arc<Mutex<bool>>,
}

impl TimeTracker {
    pub fn new(db: Arc<Database>) -> Self {
        let tracker = Self {
            db,
            current_session: Arc::new(Mutex::new(None)),
            paused: Arc::new(Mutex::new(false)),
        };

        // Recover any orphaned session from a previous crash
        tracker.recover_orphaned_session();
        tracker
    }

    /// Start a new time session. Ends the previous one if exists.
    /// Only records if scene.track_time is true and not paused.
    pub fn start_session(&self, scene_id: i64, app_id: i64, track_time: bool) {
        let paused = *self.paused.lock().unwrap();
        if paused || !track_time {
            // Still end current session but don't start new one
            self.end_current_session();
            return;
        }
        self.end_current_session();

        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let session = PendingSession {
            scene_id,
            app_id,
            started_at: now.clone(),
        };

        // Persist to database
        let conn = self.db.conn.lock().unwrap();
        let _ = conn.execute(
            "DELETE FROM current_session",
            [],
        );
        let _ = conn.execute(
            "INSERT INTO current_session (id, scene_id, app_id, started_at) VALUES (1, ?1, ?2, ?3)",
            rusqlite::params![scene_id, app_id, now],
        );

        *self.current_session.lock().unwrap() = Some(session);
    }

    /// End current session and write to DB
    pub fn end_current_session(&self) {
        let mut session = self.current_session.lock().unwrap();
        if let Some(s) = session.take() {
            let now = chrono::Local::now();
            let started =
                chrono::NaiveDateTime::parse_from_str(&s.started_at, "%Y-%m-%d %H:%M:%S").ok();
            let duration_secs =
                started.map(|t| (now.naive_local() - t).num_seconds().max(0) as i64);

            let conn = self.db.conn.lock().unwrap();
            let _ = conn.execute(
                "INSERT INTO time_sessions (scene_id, app_id, started_at, ended_at, duration_secs) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![
                    s.scene_id,
                    s.app_id,
                    s.started_at,
                    now.format("%Y-%m-%d %H:%M:%S").to_string(),
                    duration_secs,
                ],
            );
            // Remove persisted current session
            let _ = conn.execute("DELETE FROM current_session", []);
        }
    }

    /// Recover an orphaned session from a previous crash.
    /// Writes it to time_sessions with calculated duration, then clears it.
    fn recover_orphaned_session(&self) {
        let conn = self.db.conn.lock().unwrap();
        let result: Option<(i64, i64, String)> = conn.query_row(
            "SELECT scene_id, app_id, started_at FROM current_session WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        ).ok();

        if let Some((scene_id, app_id, started_at)) = result {
            let now = chrono::Local::now();
            let started =
                chrono::NaiveDateTime::parse_from_str(&started_at, "%Y-%m-%d %H:%M:%S").ok();
            let duration_secs =
                started.map(|t| (now.naive_local() - t).num_seconds().max(0) as i64);

            let _ = conn.execute(
                "INSERT INTO time_sessions (scene_id, app_id, started_at, ended_at, duration_secs) VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![
                    scene_id,
                    app_id,
                    started_at,
                    now.format("%Y-%m-%d %H:%M:%S").to_string(),
                    duration_secs,
                ],
            );
            let _ = conn.execute("DELETE FROM current_session", []);

            eprintln!(
                "Recovered orphaned session: scene_id={}, app_id={}, duration={:?}s",
                scene_id, app_id, duration_secs
            );
        }
    }

    pub fn set_paused(&self, paused: bool) {
        if paused {
            self.end_current_session();
        }
        *self.paused.lock().unwrap() = paused;
    }

    pub fn is_paused(&self) -> bool {
        *self.paused.lock().unwrap()
    }

    pub fn get_current_session_info(&self) -> Option<(i64, i64, String)> {
        self.current_session
            .lock()
            .unwrap()
            .as_ref()
            .map(|s| (s.scene_id, s.app_id, s.started_at.clone()))
    }

    pub fn get_db(&self) -> Arc<Database> {
        self.db.clone()
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd d:/Project/scene-todo/src-tauri && cargo build 2>&1 | tail -5`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/services/time_tracker.rs
git commit -m "feat: persist current time session to database for crash recovery"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run all Rust tests**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test 2>&1
```

Expected: All tests pass (todo_repo tests, app_repo tests, scene_repo tests, import_validator tests, db tests).

- [ ] **Step 2: Run cargo build for final check**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo build 2>&1
```

Expected: Build succeeds with no warnings or errors.

- [ ] **Step 3: Run cargo clippy for lint check**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo clippy 2>&1 | head -30
```

Expected: No errors. Warnings are acceptable but should be noted.

- [ ] **Step 4: Verify frontend build is unaffected**

Run:
```bash
cd d:/Project/scene-todo && npm run build 2>&1 | tail -10
```

Expected: Frontend build succeeds (no changes to frontend code).

---

## Self-Review

### Correctness checks

1. **N+1 optimization (Task 3-4):** The batch query functions build SQL `IN (...)` clauses from a comma-joined list of integer IDs. This is safe because IDs are `i64` values converted via `.to_string()` — no SQL injection risk. The `batch_query_scene_bindings` function correctly mirrors the parent-fallback logic from the original `get_todo_with_details`.

2. **App cache (Task 5):** The cache uses `HashMap<String, App>` keyed by lowercase process name. The 30-second TTL is a simple heuristic. The `invalidate_app_cache` method is called from `app_cmd.rs` on every CRUD operation, so the cache is always fresh after user actions.

3. **Widget lifecycle (Task 6-7):** `destroy_widget` already existed. The change is calling it from `delete_app` command. The `invalidate_app_cache` call ensures the monitor thread picks up the change immediately rather than waiting up to 30 seconds.

4. **Import safety (Task 8-9):** Validation runs before the transaction starts. If validation fails, the database is untouched. The transaction wraps all DELETE + INSERT operations. On any error, rusqlite's `Transaction` drops and rolls back automatically.

5. **Session persistence (Task 10):** `start_session` writes to `current_session` (single-row table). `end_current_session` writes to `time_sessions` and clears `current_session`. On startup, `recover_orphaned_session` reads any leftover row and writes it as a completed session with duration calculated to "now". This handles crash recovery gracefully.

6. **Migration 004 (Task 2):** The `current_session` table uses `CHECK (id = 1)` to enforce single-row semantics. No foreign keys on `scene_id`/`app_id` to allow recovery even if referenced entities were deleted.

### Risk assessment

- **Low risk:** Migration 004 (additive, single new table). Import validator (adds validation layer, no behavior change for valid data).
- **Medium risk:** N+1 batch queries (changes core data access pattern). Mitigated by keeping `get_todo_with_details` unchanged and only modifying list functions. All existing tests should still pass.
- **Medium risk:** TimeTracker persistence (changes session lifecycle). Mitigated by recovering orphaned sessions on startup and writing to `time_sessions` on every `end_current_session`.

### Missing coverage

- No new tests for batch query functions yet. The existing tests in `todo_repo.rs` test `get_todo_with_details` which is unchanged. New tests for `list_todos_with_details` with tags/subtasks/scenes could be added in a follow-up.
- No integration test for the import transaction rollback behavior.
