# Phase 1: Project Scaffold + Database Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the Tauri project with all dependencies, create the SQLite schema, define Rust data models, and wire the database into Tauri app state.

**Architecture:** Tauri 2.0 app scaffold with React+TypeScript frontend, Rust backend using SQLite (rusqlite) for persistence. Database initialized as Tauri managed state with migration system.

**Tech Stack:** Tauri 2.0, Rust, React 18, TypeScript, Tailwind CSS, shadcn/ui, SQLite (rusqlite), Vite

**Parent:** [2026-04-16-scene-todo.md](2026-04-16-scene-todo.md)

---

### Task 1: Initialize Tauri 2.0 + React + TypeScript Project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`

- [ ] **Step 1: Create Tauri project scaffold**

Run:
```bash
cd d:/Project/scene-todo
npm create tauri-app@latest -- --template react-ts --manager npm .
```

If the scaffolding tool complains about non-empty directory, use `--force` flag.

- [ ] **Step 2: Verify scaffold runs**

Run:
```bash
npm install
npm run tauri dev
```

Expected: A Tauri window opens with default React welcome page. Close the window to stop.

- [ ] **Step 3: Install frontend dependencies**

Run:
```bash
npm install @tauri-apps/api @tauri-apps/plugin-autostart
npm install -D tailwindcss @tailwindcss/vite
npx tailwindcss init
```

- [ ] **Step 4: Configure Tailwind in Vite**

File: `vite.config.ts`
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: "ws", host, port: 1421 }
      : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
```

- [ ] **Step 5: Configure Tailwind CSS**

File: `src/index.css` — replace entire content:
```css
@import "tailwindcss";
```

- [ ] **Step 6: Add Rust dependencies**

File: `src-tauri/Cargo.toml` — add to `[dependencies]`:
```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-autostart = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
uuid = { version = "1", features = ["v4"] }
chrono = { version = "0.4", features = ["serde"] }
thiserror = "1"

[target.'cfg(target_os = "windows")'.dependencies]
windows = { version = "0.58", features = [
  "Win32_Foundation",
  "Win32_UI_WindowsAndMessaging",
  "Win32_System_Threading",
  "Win32_Graphics_Dwm",
] }
```

- [ ] **Step 7: Verify Rust compiles**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo check
```

Expected: Compiles with no errors.

- [ ] **Step 8: Set up shadcn/ui**

Run:
```bash
cd d:/Project/scene-todo
npx shadcn@latest init -d
```

This creates `components.json` and `src/lib/utils.ts`.

- [ ] **Step 9: Commit scaffold**

```bash
git init
git add .
git commit -m "chore: initialize Tauri 2.0 + React + TypeScript with Tailwind and shadcn/ui"
```

---

### Task 2: SQLite Database Service with Migrations

**Files:**
- Create: `src-tauri/migrations/001_init.sql`
- Create: `src-tauri/src/services/mod.rs`
- Create: `src-tauri/src/services/db.rs`

- [ ] **Step 1: Write migration SQL**

File: `src-tauri/migrations/001_init.sql`
```sql
CREATE TABLE IF NOT EXISTS groups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    color       TEXT    NOT NULL DEFAULT '#6B7280',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    parent_id   INTEGER,
    FOREIGN KEY (parent_id) REFERENCES groups(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS tags (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6B7280'
);

CREATE TABLE IF NOT EXISTS todos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    title        TEXT    NOT NULL,
    description  TEXT,
    status       TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
    priority     TEXT    NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    group_id     INTEGER,
    parent_id    INTEGER,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    due_date     TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
    FOREIGN KEY (parent_id) REFERENCES todos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id INTEGER NOT NULL,
    tag_id  INTEGER NOT NULL,
    PRIMARY KEY (todo_id, tag_id),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id)  REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS apps (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    process_names TEXT NOT NULL DEFAULT '[]',
    icon_path     TEXT,
    display_name  TEXT
);

CREATE TABLE IF NOT EXISTS todo_app_bindings (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL,
    app_id  INTEGER NOT NULL,
    UNIQUE(todo_id, app_id),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (app_id)  REFERENCES apps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_todos_status     ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_group_id   ON todos(group_id);
CREATE INDEX IF NOT EXISTS idx_todos_parent_id  ON todos(parent_id);
CREATE INDEX IF NOT EXISTS idx_todos_due_date   ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_todo_app_bindings_app_id ON todo_app_bindings(app_id);
```

- [ ] **Step 2: Write database service**

File: `src-tauri/src/services/db.rs`
```rust
use rusqlite::{Connection, params};
use std::path::Path;
use std::sync::Mutex;
use tauri::AppHandle;

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
            stmt.query_map([], |row| row.get(0))
                .map_err(|e| format!("Query migrations: {}", e))?
                .filter_map(|r| r.ok())
                .collect()
        };

        let migrations: Vec<(i64, &str, &str)> = vec![
            (1, "001_init", include_str!("../../migrations/001_init.sql")),
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
```

- [ ] **Step 3: Create services module and placeholder files**

File: `src-tauri/src/services/mod.rs`
```rust
pub mod db;
pub mod todo_repo;
pub mod group_repo;
pub mod tag_repo;
pub mod app_repo;
pub mod window_monitor;
pub mod process_matcher;
pub mod widget_manager;
```

Create empty placeholder files:
```bash
touch src-tauri/src/services/todo_repo.rs
touch src-tauri/src/services/group_repo.rs
touch src-tauri/src/services/tag_repo.rs
touch src-tauri/src/services/app_repo.rs
touch src-tauri/src/services/window_monitor.rs
touch src-tauri/src/services/process_matcher.rs
touch src-tauri/src/services/widget_manager.rs
```

Each placeholder contains: `// TODO: implement in later phase`

- [ ] **Step 4: Run database tests**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo test --lib services::db -- --nocapture
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/migrations/ src-tauri/src/services/
git commit -m "feat: add SQLite database service with schema migrations"
```

---

### Task 3: Rust Data Models

**Files:**
- Create: `src-tauri/src/models/mod.rs`
- Create: `src-tauri/src/models/todo.rs`
- Create: `src-tauri/src/models/group.rs`
- Create: `src-tauri/src/models/tag.rs`
- Create: `src-tauri/src/models/app.rs`

- [ ] **Step 1: Write Todo model**

File: `src-tauri/src/models/todo.rs`
```rust
use serde::{Deserialize, Serialize};
use crate::models::{Tag, App};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Todo {
    pub id: i64,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
    pub group_id: Option<i64>,
    pub parent_id: Option<i64>,
    pub sort_order: i64,
    pub due_date: Option<String>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTodo {
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<String>,
    pub group_id: Option<i64>,
    pub parent_id: Option<i64>,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTodo {
    pub id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
    pub priority: Option<String>,
    pub group_id: Option<i64>,
    pub due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoWithDetails {
    #[serde(flatten)]
    pub todo: Todo,
    pub tags: Vec<Tag>,
    pub sub_tasks: Vec<Todo>,
    pub bound_app_ids: Vec<i64>,
}
```

- [ ] **Step 2: Write Group model**

File: `src-tauri/src/models/group.rs`
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Group {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub sort_order: i64,
    pub parent_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroup {
    pub name: String,
    pub color: Option<String>,
    pub parent_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateGroup {
    pub id: i64,
    pub name: Option<String>,
    pub color: Option<String>,
    pub sort_order: Option<i64>,
    pub parent_id: Option<i64>,
}
```

- [ ] **Step 3: Write Tag model**

File: `src-tauri/src/models/tag.rs`
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTag {
    pub name: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTag {
    pub id: i64,
    pub name: Option<String>,
    pub color: Option<String>,
}
```

- [ ] **Step 4: Write App + Binding models**

File: `src-tauri/src/models/app.rs`
```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct App {
    pub id: i64,
    pub name: String,
    pub process_names: String,  // JSON array, e.g. '["WINWORD.EXE"]'
    pub icon_path: Option<String>,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateApp {
    pub name: String,
    pub process_names: Vec<String>,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateApp {
    pub id: i64,
    pub name: Option<String>,
    pub process_names: Option<Vec<String>>,
    pub display_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TodoAppBinding {
    pub id: i64,
    pub todo_id: i64,
    pub app_id: i64,
}
```

- [ ] **Step 5: Create models module file**

File: `src-tauri/src/models/mod.rs`
```rust
pub mod todo;
pub mod group;
pub mod tag;
pub mod app;

pub use todo::*;
pub use group::*;
pub use tag::*;
pub use app::*;
```

- [ ] **Step 6: Verify compilation**

Run:
```bash
cd d:/Project/scene-todo/src-tauri && cargo check
```

Expected: Compiles without errors.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/models/
git commit -m "feat: add Rust data models for todos, groups, tags, and apps"
```

---

### Task 4: Wire Database into Tauri App State

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`
- Create: `src-tauri/src/commands/mod.rs`

- [ ] **Step 1: Update lib.rs to initialize database**

File: `src-tauri/src/lib.rs`
```rust
mod commands;
mod models;
mod services;

use services::db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            let db_path = Database::app_db_path(&app.handle())?;
            let database = Database::open(&db_path)?;
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Update main.rs**

File: `src-tauri/src/main.rs`
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    scene_todo_lib::run()
}
```

- [ ] **Step 3: Create placeholder commands module**

File: `src-tauri/src/commands/mod.rs`
```rust
// Commands will be registered in Phase 2
```

- [ ] **Step 4: Verify the app launches**

Run:
```bash
cd d:/Project/scene-todo && npm run tauri dev
```

Expected: App window opens. Database file is created in app data directory.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src-tauri/src/main.rs src-tauri/src/commands/mod.rs
git commit -m "feat: wire SQLite database into Tauri app state"
```
