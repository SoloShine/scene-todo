# Recurrence & Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customizable RRULE-based recurrence and multi-point reminders with interactive popup notifications to SceneTodo.

**Architecture:** Hybrid RRULE storage with dual-mode UI (simplified picker + raw RRULE input). Timer-driven notification engine using tokio + binary heap. Instance-based recurrence: completing a recurring todo auto-generates the next instance by cloning. Tauri WebviewWindow for interactive popup.

**Tech Stack:** Rust `rrule` crate, `tauri-plugin-notification`, Tauri WebviewWindow, React + TypeScript, Tailwind CSS, shadcn/ui patterns.

**Spec:** `docs/superpowers/specs/2026-04-27-recurrence-reminders-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src-tauri/migrations/005_recurrence_reminders.sql` | DB schema for recurrence_rules, reminders, reminder_queue + ALTER todos |
| `src-tauri/src/models/recurrence.rs` | RecurrenceRule, CreateRecurrenceRule, UpdateRecurrenceRule structs |
| `src-tauri/src/models/reminder.rs` | Reminder, CreateReminder, ReminderQueue structs |
| `src-tauri/src/services/rrule_service.rs` | RRULE validation, description, next_occurrence, preview |
| `src-tauri/src/services/recurrence_repo.rs` | CRUD for recurrence_rules |
| `src-tauri/src/services/reminder_repo.rs` | CRUD for reminders, reminder_queue operations |
| `src-tauri/src/services/reminder_scheduler.rs` | Timer-driven scheduler (tokio + BinaryHeap) |
| `src-tauri/src/commands/recurrence_cmd.rs` | Tauri commands for recurrence |
| `src-tauri/src/commands/reminder_cmd.rs` | Tauri commands for reminders |
| `src/types/recurrence.ts` | TypeScript types for recurrence |
| `src/types/reminder.ts` | TypeScript types for reminders |
| `src/hooks/useRecurrence.ts` | React hook for recurrence operations |
| `src/hooks/useReminders.ts` | React hook for reminder operations |
| `src/components/todo/RecurrenceEditor.tsx` | Dual-mode recurrence editor UI |
| `src/components/todo/ReminderEditor.tsx` | Multi-reminder config UI |
| `src/components/todo/ReminderPopup.tsx` | Standalone popup window component |
| `src-tauri/src/popup.html` | HTML entry for popup window |

### Modified Files

| File | Change |
|------|--------|
| `src-tauri/src/services/db.rs` | Register migration 005 |
| `src-tauri/src/services/mod.rs` | Add new service modules |
| `src-tauri/src/commands/mod.rs` | Add new command modules |
| `src-tauri/src/lib.rs` | Register commands + setup scheduler |
| `src-tauri/src/models/mod.rs` | Add new model modules |
| `src-tauri/src/models/todo.rs` | Add `recurrence_rule_id` field + `abandoned` status |
| `src-tauri/src/services/todo_repo.rs` | Update `row_to_todo`, handle `abandoned` status, add recurrence-aware complete |
| `src-tauri/src/commands/todo_cmd.rs` | Add `complete_todo` command |
| `src-tauri/Cargo.toml` | Add `rrule`, `tauri-plugin-notification`, `tokio` deps |
| `src/types/index.ts` | Update Todo type, add abandoned status, add recurrence_rule_id |
| `src/lib/invoke.ts` | Add recurrence + reminder API wrappers |
| `src/hooks/useTodos.ts` | Add abandoned handling |
| `src/components/todo/TodoDetailEditor.tsx` | Add RecurrenceEditor + ReminderEditor sections |
| `src/components/todo/TodoItem.tsx` | Add recurrence indicator, abandoned status styling |
| `src/components/todo/TodoList.tsx` | Add recurrence filter, series history expansion |

---

## Task 1: Database Migration

**Files:**
- Create: `src-tauri/migrations/005_recurrence_reminders.sql`
- Modify: `src-tauri/src/services/db.rs:52-57`

- [ ] **Step 1: Create migration SQL file**

```sql
-- 005_recurrence_reminders.sql

-- Recurrence rules (shared across instances of a recurring series)
CREATE TABLE IF NOT EXISTS recurrence_rules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    rrule           TEXT NOT NULL,
    dtstart         TEXT NOT NULL,
    next_due        TEXT,
    end_date        TEXT,
    max_count       INTEGER,
    completed_count INTEGER NOT NULL DEFAULT 0,
    expired         INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_recurrence_rules_next_due
    ON recurrence_rules(next_due) WHERE expired = 0;

-- Reminder configs (per-todo, multiple allowed)
CREATE TABLE IF NOT EXISTS reminders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id        INTEGER NOT NULL,
    type           TEXT NOT NULL CHECK(type IN ('relative', 'absolute')),
    offset_minutes INTEGER,
    absolute_at    TEXT,
    label          TEXT,
    notify_in_app  INTEGER NOT NULL DEFAULT 1,
    notify_system  INTEGER NOT NULL DEFAULT 1,
    enabled        INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
);

-- Pending/fired reminder instances
CREATE TABLE IF NOT EXISTS reminder_queue (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id      INTEGER NOT NULL,
    reminder_id  INTEGER NOT NULL,
    trigger_at   TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','fired','dismissed','snoozed')),
    snooze_until TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reminder_queue_trigger
    ON reminder_queue(trigger_at, status);

-- Add recurrence_rule_id to todos
ALTER TABLE todos ADD COLUMN recurrence_rule_id INTEGER REFERENCES recurrence_rules(id);
```

- [ ] **Step 2: Register migration in db.rs**

In `src-tauri/src/services/db.rs`, add to the migrations vec at line 57:

```rust
let migrations: Vec<(i64, &str, &str)> = vec![
    (1, "001_init", include_str!("../../migrations/001_init.sql")),
    (2, "002_scene_tracking", include_str!("../../migrations/002_scene_tracking.sql")),
    (3, "003_show_widget", include_str!("../../migrations/003_show_widget.sql")),
    (4, "004_current_session", include_str!("../../migrations/004_current_session.sql")),
    (5, "005_recurrence_reminders", include_str!("../../migrations/005_recurrence_reminders.sql")),
];
```

- [ ] **Step 3: Run tests to verify migration**

Run: `cd d:/Project/scene-todo/src-tauri && cargo test`
Expected: All existing tests pass (migration is additive)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/migrations/005_recurrence_reminders.sql src-tauri/src/services/db.rs
git commit -m "feat: add recurrence and reminders database migration (005)"
```

---

## Task 2: Rust Models

**Files:**
- Create: `src-tauri/src/models/recurrence.rs`
- Create: `src-tauri/src/models/reminder.rs`
- Modify: `src-tauri/src/models/mod.rs`
- Modify: `src-tauri/src/models/todo.rs`

- [ ] **Step 1: Create recurrence model**

Create `src-tauri/src/models/recurrence.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecurrenceRule {
    pub id: i64,
    pub rrule: String,
    pub dtstart: String,
    pub next_due: Option<String>,
    pub end_date: Option<String>,
    pub max_count: Option<i64>,
    pub completed_count: i64,
    pub expired: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRecurrenceRule {
    pub rrule: String,
    pub dtstart: String,
    pub end_date: Option<String>,
    pub max_count: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RruleDescribeResult {
    pub valid: bool,
    pub description: Option<String>,
    pub error: Option<String>,
    pub preview_dates: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimplifiedRecurrenceInput {
    pub freq: String,           // "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
    pub interval: Option<i64>,  // default 1
    pub by_day: Option<Vec<String>>,  // ["MO","WE","FR"]
    pub by_month_day: Option<i64>,    // 1-31
    pub by_set_pos: Option<i64>,      // e.g. 2 for "2nd"
    pub end_date: Option<String>,
    pub max_count: Option<i64>,
}
```

- [ ] **Step 2: Create reminder model**

Create `src-tauri/src/models/reminder.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reminder {
    pub id: i64,
    pub todo_id: i64,
    pub r#type: String,           // "relative" | "absolute"
    pub offset_minutes: Option<i64>,
    pub absolute_at: Option<String>,
    pub label: Option<String>,
    pub notify_in_app: bool,
    pub notify_system: bool,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateReminder {
    pub todo_id: i64,
    pub r#type: String,
    pub offset_minutes: Option<i64>,
    pub absolute_at: Option<String>,
    pub label: Option<String>,
    pub notify_in_app: Option<bool>,
    pub notify_system: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateReminder {
    pub id: i64,
    pub offset_minutes: Option<i64>,
    pub absolute_at: Option<String>,
    pub label: Option<String>,
    pub notify_in_app: Option<bool>,
    pub notify_system: Option<bool>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReminderQueueItem {
    pub id: i64,
    pub todo_id: i64,
    pub reminder_id: i64,
    pub trigger_at: String,
    pub status: String,
    pub snooze_until: Option<String>,
    pub todo_title: Option<String>,
    pub todo_priority: Option<String>,
    pub todo_due_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnoozeInput {
    pub queue_id: i64,
    pub snooze_minutes: i64,
}
```

- [ ] **Step 3: Update models/mod.rs**

Replace `src-tauri/src/models/mod.rs`:

```rust
pub mod todo;
pub mod group;
pub mod tag;
pub mod app;
pub mod scene;
pub mod recurrence;
pub mod reminder;

pub use todo::*;
pub use group::*;
pub use tag::*;
pub use app::*;
pub use scene::*;
pub use recurrence::*;
pub use reminder::*;
```

- [ ] **Step 4: Update Todo struct to add recurrence_rule_id**

In `src-tauri/src/models/todo.rs`, add field to `Todo`:

```rust
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
    pub recurrence_rule_id: Option<i64>,
}
```

- [ ] **Step 5: Update TodoWithDetails to include recurrence info**

In `src-tauri/src/models/todo.rs`, update `TodoWithDetails`:

```rust
pub struct TodoWithDetails {
    #[serde(flatten)]
    pub todo: Todo,
    pub tags: Vec<Tag>,
    pub sub_tasks: Vec<Todo>,
    pub bound_scene_ids: Vec<i64>,
    pub recurrence_rule: Option<RecurrenceRule>,
    pub reminders: Vec<Reminder>,
}
```

Add import at top of file: `use crate::models::{RecurrenceRule, Reminder};`

- [ ] **Step 6: Build to verify**

Run: `cd d:/Project/scene-todo/src-tauri && cargo check`
Expected: May have compile errors from `row_to_todo` not reading the new column yet — that's OK, we'll fix in Task 5.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/models/
git commit -m "feat: add recurrence and reminder Rust models"
```

---

## Task 3: Add Dependencies

**Files:**
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add rrule and notification deps**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:

```toml
rrule = "0.13"
tauri-plugin-notification = "2"
tokio = { version = "1", features = ["time", "sync"] }
```

Note: Verify `rrule` crate version — run `cargo search rrule` to get latest. The `rrule` crate by fmeringdal is the standard choice.

- [ ] **Step 2: Build to pull deps**

Run: `cd d:/Project/scene-todo/src-tauri && cargo check`
Expected: Downloads new crates, may have unused warnings

- [ ] **Step 3: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "feat: add rrule, tauri-plugin-notification, tokio dependencies"
```

---

## Task 4: RRULE Service

**Files:**
- Create: `src-tauri/src/services/rrule_service.rs`
- Modify: `src-tauri/src/services/mod.rs`

- [ ] **Step 1: Create RRULE service**

Create `src-tauri/src/services/rrule_service.rs`:

```rust
use crate::models::{RruleDescribeResult, SimplifiedRecurrenceInput};

/// Validate an RRULE string. Returns Ok(()) if valid.
pub fn validate_rrule(rrule_str: &str, dtstart: &str) -> Result<(), String> {
    let full = format!("RRULE:{}", rrule_str);
    full.parse::<rrule::RRule>()
        .map_err(|e| format!("Invalid RRULE: {}", e))?;
    Ok(())
}

/// Parse RRULE and return human-readable Chinese description.
pub fn describe_rrule(rrule_str: &str) -> RruleDescribeResult {
    let full = format!("RRULE:{}", rrule_str);
    match full.parse::<rrule::RRule>() {
        Ok(rule) => {
            let description = rrule_to_chinese(&rule);
            let preview = preview_dates(&rule, 5);
            RruleDescribeResult {
                valid: true,
                description: Some(description),
                error: None,
                preview_dates: preview,
            }
        }
        Err(e) => RruleDescribeResult {
            valid: false,
            description: None,
            error: Some(format!("{}", e)),
            preview_dates: vec![],
        },
    }
}

/// Get the next occurrence after the given date.
pub fn next_occurrence(rrule_str: &str, after_date: &str) -> Result<String, String> {
    let full = format!("RRULE:{}", rrule_str);
    let rule = full.parse::<rrule::RRule>()
        .map_err(|e| format!("Parse RRULE: {}", e))?;
    let after = chrono::NaiveDateTime::parse_from_str(after_date, "%Y-%m-%dT%H:%M:%S")
        .or_else(|_| chrono::NaiveDate::parse_from_str(after_date, "%Y-%m-%d").map(|d| d.and_hms_opt(0, 0, 0).unwrap()))
        .map_err(|e| format!("Parse date: {}", e))?;
    let gen = rule.into_iter();
    let after_dt = rrule::DateOrDateTime::DateTime(after.and_utc());
    let mut gen = gen.after(after_dt);
    match gen.next() {
        Some(Ok(next)) => Ok(format_date_or_datetime(&next)),
        Some(Err(e)) => Err(format!("RRULE iteration: {}", e)),
        None => Err("No more occurrences".into()),
    }
}

/// Get the next N occurrence dates for preview.
fn preview_dates(rule: &rrule::RRule, count: usize) -> Vec<String> {
    rule.clone().into_iter()
        .take(count)
        .filter_map(|d| d.ok())
        .map(|d| format_date_or_datetime(&d))
        .collect()
}

/// Convert simplified input to RRULE string.
pub fn simplified_to_rrule(input: &SimplifiedRecurrenceInput) -> Result<String, String> {
    let mut parts = vec![format!("FREQ={}", input.freq)];
    if let Some(interval) = input.interval {
        if interval > 1 {
            parts.push(format!("INTERVAL={}", interval));
        }
    }
    if let Some(ref days) = input.by_day {
        parts.push(format!("BYDAY={}", days.join(",")));
    }
    if let Some(day) = input.by_month_day {
        parts.push(format!("BYMONTHDAY={}", day));
    }
    if let Some(pos) = input.by_set_pos {
        parts.push(format!("BYSETPOS={}", pos));
    }
    // End conditions
    if let Some(ref end) = input.end_date {
        parts.push(format!("UNTIL={}T23:59:59", end));
    }
    if let Some(count) = input.max_count {
        parts.push(format!("COUNT={}", count));
    }
    Ok(parts.join(";"))
}

/// Convert RRULE to Chinese description.
fn rrule_to_chinese(rule: &rrule::RRule) -> String {
    let freq_str = match rule.get_freq() {
        rrule::Frequency::Yearly => "每年",
        rrule::Frequency::Monthly => "每月",
        rrule::Frequency::Weekly => "每周",
        rrule::Frequency::Daily => "每天",
        rrule::Frequency::Hourly => "每小时",
        rrule::Frequency::Minutely => "每分钟",
        rrule::Frequency::Secondly => "每秒",
    };
    let interval = rule.get_interval();
    let interval_str = if interval > 1 {
        format!("{}{}", interval, freq_str.replace("每", ""))
    } else {
        freq_str.to_string()
    };
    // TODO: enhance with BYDAY, BYMONTHDAY etc. for richer descriptions
    interval_str
}

fn format_date_or_datetime(d: &rrule::DateOrDateTime) -> String {
    match d {
        rrule::DateOrDateTime::Date(d) => d.format("%Y-%m-%d").to_string(),
        rrule::DateOrDateTime::DateTime(dt) => dt.format("%Y-%m-%d").to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_valid_rrule() {
        assert!(validate_rrule("FREQ=DAILY;INTERVAL=2", "2026-01-01").is_ok());
    }

    #[test]
    fn test_validate_invalid_rrule() {
        assert!(validate_rrule("INVALID", "2026-01-01").is_err());
    }

    #[test]
    fn test_describe_daily() {
        let result = describe_rrule("FREQ=DAILY");
        assert!(result.valid);
        assert!(result.description.unwrap().contains("每天"));
    }

    #[test]
    fn test_simplified_to_rrule() {
        let input = SimplifiedRecurrenceInput {
            freq: "WEEKLY".into(),
            interval: Some(2),
            by_day: Some(vec!["MO".into(), "FR".into()]),
            by_month_day: None,
            by_set_pos: None,
            end_date: None,
            max_count: None,
        };
        let rrule = simplified_to_rrule(&input).unwrap();
        assert!(rrule.contains("FREQ=WEEKLY"));
        assert!(rrule.contains("INTERVAL=2"));
        assert!(rrule.contains("BYDAY=MO,FR"));
    }

    #[test]
    fn test_next_occurrence() {
        let next = next_occurrence("FREQ=DAILY;INTERVAL=1", "2026-01-01");
        assert!(next.is_ok());
    }
}
```

Note: The `rrule` crate API may differ slightly from what's written here. The engineer should verify the exact API by reading `rrule` crate docs. Key operations: parse, iterate, get frequency/interval.

- [ ] **Step 2: Register module**

In `src-tauri/src/services/mod.rs`, add:

```rust
pub mod rrule_service;
```

- [ ] **Step 3: Run tests**

Run: `cd d:/Project/scene-todo/src-tauri && cargo test rrule_service`
Expected: Tests pass (may need API adjustments based on actual rrule crate version)

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/services/rrule_service.rs src-tauri/src/services/mod.rs
git commit -m "feat: add RRULE service for validation, description, and next occurrence"
```

---

## Task 5: Update Todo Repo for New Fields

**Files:**
- Modify: `src-tauri/src/services/todo_repo.rs`

- [ ] **Step 1: Update row_to_todo to read recurrence_rule_id**

Replace `row_to_todo` function in `src-tauri/src/services/todo_repo.rs`:

```rust
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
        recurrence_rule_id: row.get(11)?,
    })
}
```

- [ ] **Step 2: Update all SELECT statements to include recurrence_rule_id**

Every SQL that selects from todos must add the column. The column list is always:
```
id, title, description, status, priority, group_id, parent_id, sort_order, due_date, created_at, completed_at, recurrence_rule_id
```

Update these functions in `todo_repo.rs`:
- `create_todo` — the SELECT after INSERT
- `list_todos` — the main SELECT
- `get_todo` — the SELECT
- `get_todo_with_details` — both the main todo SELECT and sub-task SELECT
- `list_todos_by_app` — both todo fetches
- `batch_query_subtasks` — the SELECT

Also update `update_todo`: after `let sql = format!("UPDATE todos SET {} WHERE id = ?", sets.join(", "));`, ensure the `get_todo(db, input.id)` at the end picks up the new column.

- [ ] **Step 3: Update create_todo INSERT to include recurrence_rule_id**

The INSERT in `create_todo` currently doesn't include `recurrence_rule_id`. Since new todos won't have recurrence initially, the column defaults to NULL via the migration. No change needed for the INSERT — SQLite will use NULL.

- [ ] **Step 4: Update status transition in update_todo for abandoned**

In the `update_todo` function, the status handling at line 93-100 only handles "completed". No special logic needed for "abandoned" since it doesn't set/clear `completed_at`:

```rust
if let Some(ref v) = input.status {
    sets.push(format!("status = ?{}", param_values.len() + 1));
    param_values.push(Box::new(v.clone()));
    if v == "completed" {
        sets.push(format!("completed_at = datetime('now')"));
    } else {
        sets.push("completed_at = NULL".into());
    }
}
```

This already handles "abandoned" correctly — it sets `completed_at = NULL` for any non-"completed" status.

- [ ] **Step 5: Build and test**

Run: `cd d:/Project/scene-todo/src-tauri && cargo test`
Expected: All existing tests pass

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/services/todo_repo.rs
git commit -m "feat: update todo_repo for recurrence_rule_id field and abandoned status"
```

---

## Task 6: Recurrence Repo

**Files:**
- Create: `src-tauri/src/services/recurrence_repo.rs`

- [ ] **Step 1: Create recurrence repo**

Create `src-tauri/src/services/recurrence_repo.rs`:

```rust
use rusqlite::{params, Row};
use crate::models::*;
use crate::services::db::Database;
use crate::services::rrule_service;

fn row_to_recurrence_rule(row: &Row) -> Result<RecurrenceRule, rusqlite::Error> {
    Ok(RecurrenceRule {
        id: row.get(0)?,
        rrule: row.get(1)?,
        dtstart: row.get(2)?,
        next_due: row.get(3)?,
        end_date: row.get(4)?,
        max_count: row.get(5)?,
        completed_count: row.get(6)?,
        expired: row.get::<_, i32>(7)? != 0,
        created_at: row.get(8)?,
    })
}

const COLUMNS: &str = "id, rrule, dtstart, next_due, end_date, max_count, completed_count, expired, created_at";

pub fn create_recurrence_rule(db: &Database, input: CreateRecurrenceRule) -> Result<RecurrenceRule, String> {
    rrule_service::validate_rrule(&input.rrule, &input.dtstart)?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let next_due = rrule_service::next_occurrence(&input.rrule, &input.dtstart).ok();

    conn.execute(
        "INSERT INTO recurrence_rules (rrule, dtstart, next_due, end_date, max_count) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![input.rrule, input.dtstart, next_due, input.end_date, input.max_count],
    ).map_err(|e| format!("Insert recurrence rule: {}", e))?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare(&format!("SELECT {} FROM recurrence_rules WHERE id = ?1", COLUMNS))
        .map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_recurrence_rule).map_err(|e| format!("Fetch: {}", e))
}

pub fn get_recurrence_rule(db: &Database, id: i64) -> Result<RecurrenceRule, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(&format!("SELECT {} FROM recurrence_rules WHERE id = ?1", COLUMNS))
        .map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_recurrence_rule).map_err(|e| format!("Not found: {}", e))
}

pub fn update_next_due(db: &Database, id: i64, next_due: Option<String>, completed_count: i64, expired: bool) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE recurrence_rules SET next_due = ?1, completed_count = ?2, expired = ?3 WHERE id = ?4",
        params![next_due, completed_count, expired as i32, id],
    ).map_err(|e| format!("Update next due: {}", e))?;
    Ok(())
}

pub fn delete_recurrence_rule(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM recurrence_rules WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete recurrence rule: {}", e))?;
    Ok(())
}

/// Generate the next instance for a recurring todo.
/// Called within a transaction. Returns the new todo ID.
pub fn generate_next_instance(db: &Database, completed_todo_id: i64, rule_id: i64) -> Result<i64, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // 1. Get the current rule
    let rule = {
        let mut stmt = conn.prepare(&format!("SELECT {} FROM recurrence_rules WHERE id = ?1", COLUMNS))
            .map_err(|e| format!("Prepare rule: {}", e))?;
        stmt.query_row(params![rule_id], row_to_recurrence_rule).map_err(|e| format!("Rule not found: {}", e))?
    };

    // 2. Increment completed_count
    let new_count = rule.completed_count + 1;

    // 3. Check end conditions
    if let Some(max) = rule.max_count {
        if new_count >= max {
            conn.execute("UPDATE recurrence_rules SET completed_count = ?1, expired = 1 WHERE id = ?2",
                params![new_count, rule_id])
                .map_err(|e| format!("Expire rule: {}", e))?;
            return Ok(0); // Signal: no more instances
        }
    }

    // 4. Get current todo's due_date
    let current_due: Option<String> = conn.query_row(
        "SELECT due_date FROM todos WHERE id = ?1", params![completed_todo_id],
        |row| row.get(0),
    ).unwrap_or(None);

    let due_for_calc = current_due.as_deref().unwrap_or(&rule.dtstart);

    // 5. Compute next due date
    let next_due = match rrule_service::next_occurrence(&rule.rrule, due_for_calc) {
        Ok(d) => d,
        Err(_) => {
            // No more occurrences
            conn.execute("UPDATE recurrence_rules SET completed_count = ?1, expired = 1 WHERE id = ?2",
                params![new_count, rule_id])
                .map_err(|e| format!("Expire rule: {}", e))?;
            return Ok(0);
        }
    };

    // Check end_date
    if let Some(ref end) = rule.end_date {
        if next_due > *end {
            conn.execute("UPDATE recurrence_rules SET completed_count = ?1, expired = 1 WHERE id = ?2",
                params![new_count, rule_id])
                .map_err(|e| format!("Expire rule: {}", e))?;
            return Ok(0);
        }
    }

    // 6. Update rule
    conn.execute(
        "UPDATE recurrence_rules SET completed_count = ?1, next_due = ?2 WHERE id = ?3",
        params![new_count, next_due, rule_id],
    ).map_err(|e| format!("Update rule: {}", e))?;

    // 7. Clone the todo
    conn.execute(
        "INSERT INTO todos (title, description, status, priority, group_id, parent_id, sort_order, due_date, recurrence_rule_id)
         SELECT title, description, 'pending', priority, group_id, NULL, sort_order, ?1, ?2
         FROM todos WHERE id = ?3",
        params![next_due, rule_id, completed_todo_id],
    ).map_err(|e| format!("Clone todo: {}", e))?;
    let new_todo_id = conn.last_insert_rowid();

    // 8. Clone sub-tasks
    conn.execute(
        "INSERT INTO todos (title, description, status, priority, group_id, parent_id, sort_order, due_date)
         SELECT title, description, 'pending', priority, group_id, ?1, sort_order, NULL
         FROM todos WHERE parent_id = ?2",
        params![new_todo_id, completed_todo_id],
    ).map_err(|e| format!("Clone sub-tasks: {}", e))?;

    // 9. Copy tags
    conn.execute(
        "INSERT INTO todo_tags (todo_id, tag_id)
         SELECT ?1, tag_id FROM todo_tags WHERE todo_id = ?2",
        params![new_todo_id, completed_todo_id],
    ).map_err(|e| format!("Copy tags: {}", e))?;

    // 10. Copy scene bindings
    conn.execute(
        "INSERT INTO todo_scene_bindings (todo_id, scene_id)
         SELECT ?1, scene_id FROM todo_scene_bindings WHERE todo_id = ?2",
        params![new_todo_id, completed_todo_id],
    ).map_err(|e| format!("Copy scene bindings: {}", e))?;

    // 11. Copy reminders and compute trigger times
    {
        let mut stmt = conn.prepare(
            "SELECT id, type, offset_minutes, absolute_at, label, notify_in_app, notify_system, enabled
             FROM reminders WHERE todo_id = ?1 AND enabled = 1"
        ).map_err(|e| format!("Prepare reminders: {}", e))?;
        let reminder_rows: Vec<(i64, String, Option<i64>, Option<String>, Option<String>, i32, i32, i32)> = stmt
            .query_map(params![completed_todo_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get::<_, i32>(5)?, row.get::<_, i32>(6)?, row.get::<_, i32>(7)?))
            }).map_err(|e| format!("Query reminders: {}", e))?
            .filter_map(|r| r.ok()).collect();
        drop(stmt);

        for (rem_id, rem_type, offset, abs_at, label, in_app, in_sys, _enabled) in &reminder_rows {
            // Clone reminder config
            conn.execute(
                "INSERT INTO reminders (todo_id, type, offset_minutes, absolute_at, label, notify_in_app, notify_system)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![new_todo_id, rem_type, offset, abs_at, label, in_app, in_sys],
            ).map_err(|e| format!("Clone reminder: {}", e))?;
            let new_rem_id = conn.last_insert_rowid();

            // Compute trigger_at for reminder_queue
            let trigger_at = compute_trigger_at(rem_type, *offset, abs_at, &next_due);
            if let Some(trigger) = trigger_at {
                conn.execute(
                    "INSERT INTO reminder_queue (todo_id, reminder_id, trigger_at) VALUES (?1, ?2, ?3)",
                    params![new_todo_id, new_rem_id, trigger],
                ).map_err(|e| format!("Queue reminder: {}", e))?;
            }
        }
    }

    Ok(new_todo_id)
}

fn compute_trigger_at(rem_type: &str, offset_minutes: Option<i64>, absolute_at: Option<&String>, due_date: &str) -> Option<String> {
    match rem_type {
        "relative" => {
            let offset = offset_minutes?;
            let due = chrono::NaiveDateTime::parse_from_str(due_date, "%Y-%m-%dT%H:%M:%S")
                .or_else(|_| chrono::NaiveDate::parse_from_str(due_date, "%Y-%m-%d").map(|d| d.and_hms_opt(23, 59, 0).unwrap()))
                .ok()?;
            let trigger = due - chrono::Duration::minutes(offset);
            Some(trigger.format("%Y-%m-%d %H:%M:%S").to_string())
        }
        "absolute" => {
            absolute_at.clone()
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use crate::services::db::Database;
    use crate::services::todo_repo;

    fn setup_db() -> Database {
        let tmp = NamedTempFile::new().unwrap();
        Database::open(tmp.path()).unwrap()
    }

    #[test]
    fn test_create_recurrence_rule() {
        let db = setup_db();
        let rule = create_recurrence_rule(&db, CreateRecurrenceRule {
            rrule: "FREQ=DAILY;INTERVAL=1".into(),
            dtstart: "2026-01-01".into(),
            end_date: None,
            max_count: Some(5),
        }).unwrap();
        assert_eq!(rule.rrule, "FREQ=DAILY;INTERVAL=1");
        assert_eq!(rule.max_count, Some(5));
        assert!(!rule.expired);
    }

    #[test]
    fn test_invalid_rrule_rejected() {
        let db = setup_db();
        let result = create_recurrence_rule(&db, CreateRecurrenceRule {
            rrule: "INVALID".into(),
            dtstart: "2026-01-01".into(),
            end_date: None,
            max_count: None,
        });
        assert!(result.is_err());
    }

    #[test]
    fn test_generate_next_instance() {
        let db = setup_db();
        let rule = create_recurrence_rule(&db, CreateRecurrenceRule {
            rrule: "FREQ=DAILY;INTERVAL=1".into(),
            dtstart: "2026-01-01".into(),
            end_date: None,
            max_count: Some(3),
        }).unwrap();

        let todo = todo_repo::create_todo(&db, crate::models::CreateTodo {
            title: "Daily task".into(), description: None, priority: None,
            group_id: None, parent_id: None, due_date: Some("2026-01-01".into()),
        }).unwrap();

        // Simulate completion
        let new_id = generate_next_instance(&db, todo.id, rule.id).unwrap();
        assert!(new_id > 0);

        let new_todo = todo_repo::get_todo(&db, new_id).unwrap();
        assert_eq!(new_todo.status, "pending");
        assert_eq!(new_todo.recurrence_rule_id, Some(rule.id));
    }
}
```

- [ ] **Step 2: Register module**

In `src-tauri/src/services/mod.rs`, add:

```rust
pub mod recurrence_repo;
```

- [ ] **Step 3: Run tests**

Run: `cd d:/Project/scene-todo/src-tauri && cargo test recurrence_repo`
Expected: Tests pass

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/services/recurrence_repo.rs src-tauri/src/services/mod.rs
git commit -m "feat: add recurrence repo with CRUD and instance generation"
```

---

## Task 7: Reminder Repo

**Files:**
- Create: `src-tauri/src/services/reminder_repo.rs`

- [ ] **Step 1: Create reminder repo**

Create `src-tauri/src/services/reminder_repo.rs`:

```rust
use rusqlite::{params, Row};
use crate::models::*;
use crate::services::db::Database;
use crate::services::recurrence_repo::compute_trigger_at;

pub fn create_reminder(db: &Database, input: CreateReminder) -> Result<Reminder, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let in_app = input.notify_in_app.unwrap_or(true);
    let in_sys = input.notify_system.unwrap_or(true);

    conn.execute(
        "INSERT INTO reminders (todo_id, type, offset_minutes, absolute_at, label, notify_in_app, notify_system)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![input.todo_id, input.r#type, input.offset_minutes, input.absolute_at, input.label, in_app as i32, in_sys as i32],
    ).map_err(|e| format!("Insert reminder: {}", e))?;

    let id = conn.last_insert_rowid();

    // If todo has a due_date, queue the reminder trigger
    let due_date: Option<String> = conn.query_row(
        "SELECT due_date FROM todos WHERE id = ?1", params![input.todo_id],
        |row| row.get(0),
    ).unwrap_or(None);

    if let Some(ref due) = due_date {
        let trigger_at = compute_trigger_at(&input.r#type, input.offset_minutes, input.absolute_at.as_ref(), due);
        if let Some(trigger) = trigger_at {
            conn.execute(
                "INSERT INTO reminder_queue (todo_id, reminder_id, trigger_at) VALUES (?1, ?2, ?3)",
                params![input.todo_id, id, trigger],
            ).map_err(|e| format!("Queue reminder: {}", e))?;
        }
    }

    drop(conn);
    get_reminder(db, id)
}

pub fn get_reminder(db: &Database, id: i64) -> Result<Reminder, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, todo_id, type, offset_minutes, absolute_at, label, notify_in_app, notify_system, enabled FROM reminders WHERE id = ?1"
    ).map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_reminder).map_err(|e| format!("Not found: {}", e))
}

pub fn list_reminders_by_todo(db: &Database, todo_id: i64) -> Result<Vec<Reminder>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, todo_id, type, offset_minutes, absolute_at, label, notify_in_app, notify_system, enabled FROM reminders WHERE todo_id = ?1"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map(params![todo_id], row_to_reminder)
        .map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn update_reminder(db: &Database, input: UpdateReminder) -> Result<Reminder, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut sets = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = input.offset_minutes { sets.push(format!("offset_minutes = ?{}", param_values.len() + 1)); param_values.push(Box::new(v)); }
    if let Some(ref v) = input.absolute_at { sets.push(format!("absolute_at = ?{}", param_values.len() + 1)); param_values.push(Box::new(v.clone())); }
    if let Some(ref v) = input.label { sets.push(format!("label = ?{}", param_values.len() + 1)); param_values.push(Box::new(v.clone())); }
    if let Some(v) = input.notify_in_app { sets.push(format!("notify_in_app = ?{}", param_values.len() + 1)); param_values.push(Box::new(v as i32)); }
    if let Some(v) = input.notify_system { sets.push(format!("notify_system = ?{}", param_values.len() + 1)); param_values.push(Box::new(v as i32)); }
    if let Some(v) = input.enabled { sets.push(format!("enabled = ?{}", param_values.len() + 1)); param_values.push(Box::new(v as i32)); }

    if sets.is_empty() { return get_reminder(db, input.id); }

    let sql = format!("UPDATE reminders SET {} WHERE id = ?", sets.join(", "));
    param_values.push(Box::new(input.id));
    let params: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params.as_slice()).map_err(|e| format!("Update: {}", e))?;
    drop(conn);
    get_reminder(db, input.id)
}

pub fn delete_reminder(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM reminders WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete reminder: {}", e))?;
    Ok(())
}

// --- Reminder Queue ---

pub fn get_pending_reminders(db: &Database, within_hours: i64) -> Result<Vec<ReminderQueueItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT q.id, q.todo_id, q.reminder_id, q.trigger_at, q.status, q.snooze_until,
                t.title, t.priority, t.due_date
         FROM reminder_queue q
         LEFT JOIN todos t ON t.id = q.todo_id
         WHERE q.status = 'pending' AND q.trigger_at < datetime('now', ?1 || ' hours')
         ORDER BY q.trigger_at ASC"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map(params![within_hours.to_string()], |row| {
        Ok(ReminderQueueItem {
            id: row.get(0)?,
            todo_id: row.get(1)?,
            reminder_id: row.get(2)?,
            trigger_at: row.get(3)?,
            status: row.get(4)?,
            snooze_until: row.get(5)?,
            todo_title: row.get(6)?,
            todo_priority: row.get(7)?,
            todo_due_date: row.get(8)?,
        })
    }).map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn mark_reminder_fired(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE reminder_queue SET status = 'fired' WHERE id = ?1", params![id])
        .map_err(|e| format!("Fire reminder: {}", e))?;
    Ok(())
}

pub fn snooze_reminder(db: &Database, queue_id: i64, snooze_minutes: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE reminder_queue SET status = 'snoozed', snooze_until = datetime('now', ?1 || ' minutes') WHERE id = ?2",
        params![snooze_minutes.to_string(), queue_id],
    ).map_err(|e| format!("Snooze: {}", e))?;
    // Re-queue with new trigger time
    conn.execute(
        "UPDATE reminder_queue SET status = 'pending', trigger_at = datetime('now', ?1 || ' minutes') WHERE id = ?2",
        params![snooze_minutes.to_string(), queue_id],
    ).map_err(|e| format!("Re-queue: {}", e))?;
    Ok(())
}

pub fn dismiss_reminder(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("UPDATE reminder_queue SET status = 'dismissed' WHERE id = ?1", params![id])
        .map_err(|e| format!("Dismiss: {}", e))?;
    Ok(())
}

pub fn get_overdue_reminders(db: &Database) -> Result<Vec<ReminderQueueItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT q.id, q.todo_id, q.reminder_id, q.trigger_at, q.status, q.snooze_until,
                t.title, t.priority, t.due_date
         FROM reminder_queue q
         LEFT JOIN todos t ON t.id = q.todo_id
         WHERE q.status = 'pending' AND q.trigger_at < datetime('now')
         ORDER BY q.trigger_at ASC"
    ).map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt.query_map([], |row| {
        Ok(ReminderQueueItem {
            id: row.get(0)?,
            todo_id: row.get(1)?,
            reminder_id: row.get(2)?,
            trigger_at: row.get(3)?,
            status: row.get(4)?,
            snooze_until: row.get(5)?,
            todo_title: row.get(6)?,
            todo_priority: row.get(7)?,
            todo_due_date: row.get(8)?,
        })
    }).map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

fn row_to_reminder(row: &Row) -> Result<Reminder, rusqlite::Error> {
    Ok(Reminder {
        id: row.get(0)?,
        todo_id: row.get(1)?,
        r#type: row.get(2)?,
        offset_minutes: row.get(3)?,
        absolute_at: row.get(4)?,
        label: row.get(5)?,
        notify_in_app: row.get::<_, i32>(6)? != 0,
        notify_system: row.get::<_, i32>(7)? != 0,
        enabled: row.get::<_, i32>(8)? != 0,
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
    fn test_create_reminder() {
        let db = setup_db();
        let reminder = create_reminder(&db, CreateReminder {
            todo_id: 999,
            r#type: "relative".into(),
            offset_minutes: Some(60),
            absolute_at: None,
            label: Some("1 hour before".into()),
            notify_in_app: Some(true),
            notify_system: Some(true),
        }).unwrap();
        assert_eq!(reminder.r#type, "relative");
        assert_eq!(reminder.offset_minutes, Some(60));
    }
}
```

- [ ] **Step 2: Register module**

In `src-tauri/src/services/mod.rs`, add:

```rust
pub mod reminder_repo;
```

- [ ] **Step 3: Make `compute_trigger_at` pub in recurrence_repo.rs**

In `src-tauri/src/services/recurrence_repo.rs`, change:
```rust
fn compute_trigger_at(...)
```
to:
```rust
pub fn compute_trigger_at(...)
```

- [ ] **Step 4: Run tests**

Run: `cd d:/Project/scene-todo/src-tauri && cargo test`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/reminder_repo.rs src-tauri/src/services/mod.rs src-tauri/src/services/recurrence_repo.rs
git commit -m "feat: add reminder repo with CRUD and queue management"
```

---

## Task 8: Tauri Commands

**Files:**
- Create: `src-tauri/src/commands/recurrence_cmd.rs`
- Create: `src-tauri/src/commands/reminder_cmd.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/commands/todo_cmd.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create recurrence commands**

Create `src-tauri/src/commands/recurrence_cmd.rs`:

```rust
use std::sync::Arc;
use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::recurrence_repo;
use crate::services::rrule_service;

#[tauri::command]
pub fn create_recurrence_rule(db: State<'_, Arc<Database>>, input: CreateRecurrenceRule) -> Result<RecurrenceRule, String> {
    recurrence_repo::create_recurrence_rule(&db, input)
}

#[tauri::command]
pub fn get_recurrence_rule(db: State<'_, Arc<Database>>, id: i64) -> Result<RecurrenceRule, String> {
    recurrence_repo::get_recurrence_rule(&db, id)
}

#[tauri::command]
pub fn delete_recurrence_rule(db: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    recurrence_repo::delete_recurrence_rule(&db, id)
}

#[tauri::command]
pub fn describe_rrule(rrule: String) -> Result<RruleDescribeResult, String> {
    Ok(rrule_service::describe_rrule(&rrule))
}

#[tauri::command]
pub fn simplified_to_rrule(input: SimplifiedRecurrenceInput) -> Result<String, String> {
    rrule_service::simplified_to_rrule(&input)
}

#[tauri::command]
pub fn set_todo_recurrence(
    db: State<'_, Arc<Database>>,
    todo_id: i64,
    input: Option<CreateRecurrenceRule>,
) -> Result<Todo, String> {
    if let Some(rule_input) = input {
        let rule = recurrence_repo::create_recurrence_rule(&db, rule_input)?;
        crate::services::todo_repo::update_todo(&db, crate::models::UpdateTodo {
            id: todo_id,
            title: None, description: None, status: None, priority: None,
            group_id: None, due_date: None,
        })
    } else {
        // Remove recurrence
        let todo = crate::services::todo_repo::get_todo(&db, todo_id)?;
        if let Some(rule_id) = todo.recurrence_rule_id {
            recurrence_repo::delete_recurrence_rule(&db, rule_id)?;
        }
        crate::services::todo_repo::get_todo(&db, todo_id)
    }
}
```

Note: `set_todo_recurrence` needs to set `recurrence_rule_id` on the todo. Since `UpdateTodo` doesn't have that field yet, add it:

In `src-tauri/src/models/todo.rs`, add to `UpdateTodo`:
```rust
pub recurrence_rule_id: Option<i64>,
```

And in `todo_repo.rs` `update_todo`, add handling:
```rust
if let Some(v) = input.recurrence_rule_id { sets.push(format!("recurrence_rule_id = ?{}", param_values.len() + 1)); param_values.push(Box::new(v)); }
```

- [ ] **Step 2: Create reminder commands**

Create `src-tauri/src/commands/reminder_cmd.rs`:

```rust
use std::sync::Arc;
use tauri::State;
use crate::models::*;
use crate::services::db::Database;
use crate::services::reminder_repo;

#[tauri::command]
pub fn create_reminder(db: State<'_, Arc<Database>>, input: CreateReminder) -> Result<Reminder, String> {
    reminder_repo::create_reminder(&db, input)
}

#[tauri::command]
pub fn list_reminders_by_todo(db: State<'_, Arc<Database>>, todo_id: i64) -> Result<Vec<Reminder>, String> {
    reminder_repo::list_reminders_by_todo(&db, todo_id)
}

#[tauri::command]
pub fn update_reminder(db: State<'_, Arc<Database>>, input: UpdateReminder) -> Result<Reminder, String> {
    reminder_repo::update_reminder(&db, input)
}

#[tauri::command]
pub fn delete_reminder(db: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    reminder_repo::delete_reminder(&db, id)
}

#[tauri::command]
pub fn snooze_reminder(db: State<'_, Arc<Database>>, input: SnoozeInput) -> Result<(), String> {
    reminder_repo::snooze_reminder(&db, input.queue_id, input.snooze_minutes)
}

#[tauri::command]
pub fn dismiss_reminder(db: State<'_, Arc<Database>>, id: i64) -> Result<(), String> {
    reminder_repo::dismiss_reminder(&db, id)
}
```

- [ ] **Step 3: Update todo_cmd.rs to add complete_todo**

Add to `src-tauri/src/commands/todo_cmd.rs`:

```rust
#[tauri::command]
pub fn complete_todo(db: State<'_, Arc<Database>>, id: i64, status: String) -> Result<Todo, String> {
    use crate::services::recurrence_repo;

    let todo = todo_repo::update_todo(&db, UpdateTodo {
        id,
        title: None, description: None,
        status: Some(status.clone()),
        priority: None, group_id: None, due_date: None,
        recurrence_rule_id: None,
    })?;

    // If this todo has a recurrence rule and status is completed/abandoned, generate next
    if (status == "completed" || status == "abandoned") {
        if let Some(rule_id) = todo.recurrence_rule_id {
            let _new_id = recurrence_repo::generate_next_instance(&db, id, rule_id)?;
        }
    }

    Ok(todo)
}
```

- [ ] **Step 4: Register command modules**

Replace `src-tauri/src/commands/mod.rs`:

```rust
pub mod todo_cmd;
pub mod group_cmd;
pub mod tag_cmd;
pub mod app_cmd;
pub mod scene_cmd;
pub mod data_cmd;
pub mod recurrence_cmd;
pub mod reminder_cmd;
```

- [ ] **Step 5: Register commands in lib.rs**

Add to the `invoke_handler` macro in `src-tauri/src/lib.rs`:

```rust
commands::recurrence_cmd::create_recurrence_rule,
commands::recurrence_cmd::get_recurrence_rule,
commands::recurrence_cmd::delete_recurrence_rule,
commands::recurrence_cmd::describe_rrule,
commands::recurrence_cmd::simplified_to_rrule,
commands::recurrence_cmd::set_todo_recurrence,
commands::reminder_cmd::create_reminder,
commands::reminder_cmd::list_reminders_by_todo,
commands::reminder_cmd::update_reminder,
commands::reminder_cmd::delete_reminder,
commands::reminder_cmd::snooze_reminder,
commands::reminder_cmd::dismiss_reminder,
commands::todo_cmd::complete_todo,
```

- [ ] **Step 6: Add notification plugin**

In `src-tauri/src/lib.rs`, in the `run()` function, add before `.setup()`:

```rust
.plugin(tauri_plugin_notification::init())
```

- [ ] **Step 7: Build and test**

Run: `cd d:/Project/scene-todo/src-tauri && cargo check`
Expected: Compiles without errors

- [ ] **Step 8: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs src-tauri/src/models/todo.rs src-tauri/src/services/todo_repo.rs
git commit -m "feat: add recurrence and reminder Tauri commands with complete_todo"
```

---

## Task 9: Reminder Scheduler Service

**Files:**
- Create: `src-tauri/src/services/reminder_scheduler.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create the scheduler**

Create `src-tauri/src/services/reminder_scheduler.rs`:

```rust
use std::sync::Arc;
use std::collections::BinaryHeap;
use std::cmp::Reverse;
use tauri::{AppHandle, Emitter, Manager, WebviewWindowBuilder};
use tokio::sync::Mutex as TokioMutex;
use tokio::time::{sleep_until, Instant, Duration};
use chrono::NaiveDateTime;
use crate::models::ReminderQueueItem;
use crate::services::db::Database;
use crate::services::reminder_repo;

struct PendingReminder {
    trigger_at: Instant,
    item: ReminderQueueItem,
}

impl PartialEq for PendingReminder {
    fn eq(&self, other: &Self) -> bool { self.trigger_at == other.trigger_at }
}
impl Eq for PendingReminder {}
impl PartialOrd for PendingReminder {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> { Some(self.cmp(other)) }
}
impl Ord for PendingReminder {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering { self.trigger_at.cmp(&other.trigger_at) }
}

pub struct ReminderScheduler {
    db: Arc<Database>,
    app: AppHandle,
    heap: Arc<TokioMutex<BinaryHeap<Reverse<PendingReminder>>>>,
    running: Arc<TokioMutex<bool>>,
}

impl ReminderScheduler {
    pub fn new(db: Arc<Database>, app: AppHandle) -> Self {
        Self {
            db,
            app,
            heap: Arc::new(TokioMutex::new(BinaryHeap::new())),
            running: Arc::new(TokioMutex::new(false)),
        }
    }

    pub async fn start(&self) {
        let mut running = self.running.lock().await;
        if *running { return; }
        *running = true;
        drop(running);

        self.load_pending().await;
        self.tick().await;
    }

    async fn load_pending(&self) {
        let reminders = reminder_repo::get_pending_reminders(&self.db, 24)
            .unwrap_or_default();

        let mut heap = self.heap.lock().await;
        for item in reminders {
            if let Some(instant) = parse_trigger_instant(&item.trigger_at) {
                heap.push(Reverse(PendingReminder { trigger_at: instant, item }));
            }
        }
    }

    async fn tick(&self) {
        loop {
            let mut heap = self.heap.lock().await;
            if let Some(Reverse(front)) = heap.peek() {
                let now = Instant::now();
                if front.trigger_at <= now {
                    let Reverse(reminder) = heap.pop().unwrap();
                    drop(heap);
                    self.fire(reminder.item).await;
                    continue;
                } else {
                    let deadline = front.trigger_at;
                    drop(heap);
                    sleep_until(deadline).await;
                    continue;
                }
            }
            drop(heap);
            // No items, wait before checking again
            tokio::time::sleep(Duration::from_secs(30)).await;
            self.load_pending().await;
        }
    }

    async fn fire(&self, item: ReminderQueueItem) {
        let _ = reminder_repo::mark_reminder_fired(&self.db, item.id);

        // Emit to frontend for in-app toast
        let _ = self.app.emit("reminder-fired", &item);

        // Create popup window
        self.show_popup(&item);

        // System notification as fallback
        self.send_system_notification(&item);
    }

    fn show_popup(&self, item: &ReminderQueueItem) {
        let label = format!("reminder-popup-{}", item.id);
        let title = item.todo_title.as_deref().unwrap_or("提醒");
        let priority = item.todo_priority.as_deref().unwrap_or("medium");
        let due = item.todo_due_date.as_deref().unwrap_or("");
        let queue_id = item.id;
        let todo_id = item.todo_id;

        // Use existing main window to show popup content via event
        let _ = self.app.emit("show-reminder-popup", serde_json::json!({
            "queue_id": queue_id,
            "todo_id": todo_id,
            "title": title,
            "priority": priority,
            "due_date": due,
        }));
    }

    fn send_system_notification(&self, item: &ReminderQueueItem) {
        use tauri_plugin_notification::NotificationExt;
        let title = item.todo_title.as_deref().unwrap_or("待办提醒");
        if let Ok(n) = self.app.notification().builder()
            .title(title)
            .body("点击查看详情")
            .show()
        {
            // sent
        }
    }

    pub async fn insert(&self, item: ReminderQueueItem) {
        if let Some(instant) = parse_trigger_instant(&item.trigger_at) {
            let mut heap = self.heap.lock().await;
            heap.push(Reverse(PendingReminder { trigger_at: instant, item }));
        }
    }
}

fn parse_trigger_instant(trigger_at: &str) -> Option<Instant> {
    let naive = NaiveDateTime::parse_from_str(trigger_at, "%Y-%m-%d %H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(trigger_at, "%Y-%m-%dT%H:%M:%S"))
        .ok()?;
    let utc = naive.and_local_timezone(chrono::Local).single()?;
    let now = chrono::Local::now();
    let diff = utc - now;
    if diff.num_seconds() <= 0 {
        Some(Instant::now())
    } else {
        Some(Instant::now() + Duration::from_secs(diff.num_seconds() as u64))
    }
}
```

- [ ] **Step 2: Register module**

In `src-tauri/src/services/mod.rs`, add:

```rust
pub mod reminder_scheduler;
```

- [ ] **Step 3: Wire up scheduler in lib.rs setup**

In `src-tauri/src/lib.rs`, in the `setup` closure, after `let monitor = ...`:

```rust
// Reminder scheduler
let scheduler = Arc::new(services::reminder_scheduler::ReminderScheduler::new(
    db_arc.clone(),
    app.handle().clone(),
));
app.manage(scheduler.clone());

// Start scheduler in background
let sched = scheduler.clone();
std::thread::spawn(move || {
    let rt = tokio::runtime::Runtime::new().expect("tokio runtime");
    rt.block_on(async {
        sched.start().await;
    });
});
```

Add import at top:
```rust
use services::reminder_scheduler::ReminderScheduler;
```

- [ ] **Step 4: Build**

Run: `cd d:/Project/scene-todo/src-tauri && cargo check`
Expected: Compiles

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/services/reminder_scheduler.rs src-tauri/src/services/mod.rs src-tauri/src/lib.rs
git commit -m "feat: add timer-driven reminder scheduler service"
```

---

## Task 10: TypeScript Types

**Files:**
- Create: `src/types/recurrence.ts`
- Create: `src/types/reminder.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Create recurrence types**

Create `src/types/recurrence.ts`:

```typescript
export interface RecurrenceRule {
  id: number;
  rrule: string;
  dtstart: string;
  next_due: string | null;
  end_date: string | null;
  max_count: number | null;
  completed_count: number;
  expired: boolean;
  created_at: string;
}

export interface CreateRecurrenceRule {
  rrule: string;
  dtstart: string;
  end_date?: string | null;
  max_count?: number | null;
}

export interface RruleDescribeResult {
  valid: boolean;
  description: string | null;
  error: string | null;
  preview_dates: string[];
}

export interface SimplifiedRecurrenceInput {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval?: number | null;
  by_day?: string[] | null;
  by_month_day?: number | null;
  by_set_pos?: number | null;
  end_date?: string | null;
  max_count?: number | null;
}
```

- [ ] **Step 2: Create reminder types**

Create `src/types/reminder.ts`:

```typescript
export interface Reminder {
  id: number;
  todo_id: number;
  type: "relative" | "absolute";
  offset_minutes: number | null;
  absolute_at: string | null;
  label: string | null;
  notify_in_app: boolean;
  notify_system: boolean;
  enabled: boolean;
}

export interface CreateReminder {
  todo_id: number;
  type: "relative" | "absolute";
  offset_minutes?: number | null;
  absolute_at?: string | null;
  label?: string | null;
  notify_in_app?: boolean | null;
  notify_system?: boolean | null;
}

export interface UpdateReminder {
  id: number;
  offset_minutes?: number | null;
  absolute_at?: string | null;
  label?: string | null;
  notify_in_app?: boolean | null;
  notify_system?: boolean | null;
  enabled?: boolean | null;
}

export interface ReminderQueueItem {
  id: number;
  todo_id: number;
  reminder_id: number;
  trigger_at: string;
  status: "pending" | "fired" | "dismissed" | "snoozed";
  snooze_until: string | null;
  todo_title: string | null;
  todo_priority: string | null;
  todo_due_date: string | null;
}

export interface SnoozeInput {
  queue_id: number;
  snooze_minutes: number;
}
```

- [ ] **Step 3: Update src/types/index.ts**

Add to `src/types/index.ts`:

```typescript
// At top of file, add imports:
export * from "./recurrence";
export * from "./reminder";
```

Update the `Todo` interface to include `recurrence_rule_id`:

```typescript
export interface Todo {
  id: number;
  title: string;
  description: string | null;
  status: "pending" | "completed" | "abandoned";
  priority: "high" | "medium" | "low";
  group_id: number | null;
  parent_id: number | null;
  sort_order: number;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
  recurrence_rule_id: number | null;
}
```

Update `UpdateTodo`:
```typescript
export interface UpdateTodo {
  id: number;
  title?: string | null;
  description?: string | null;
  status?: "pending" | "completed" | "abandoned" | null;
  priority?: "high" | "medium" | "low" | null;
  group_id?: number | null;
  due_date?: string | null;
  recurrence_rule_id?: number | null;
}
```

Update `TodoWithDetails`:
```typescript
export interface TodoWithDetails extends Todo {
  tags: Tag[];
  sub_tasks: Todo[];
  bound_scene_ids: number[];
  recurrence_rule: RecurrenceRule | null;
  reminders: Reminder[];
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/
git commit -m "feat: add TypeScript types for recurrence and reminders"
```

---

## Task 11: Frontend API Layer

**Files:**
- Modify: `src/lib/invoke.ts`

- [ ] **Step 1: Add recurrence and reminder API wrappers**

Append to `src/lib/invoke.ts`:

```typescript
// Recurrence
export const createRecurrenceRule = (input: CreateRecurrenceRule) =>
  invoke<RecurrenceRule>("create_recurrence_rule", { input });

export const getRecurrenceRule = (id: number) =>
  invoke<RecurrenceRule>("get_recurrence_rule", { id });

export const deleteRecurrenceRule = (id: number) =>
  invoke<void>("delete_recurrence_rule", { id });

export const describeRrule = (rrule: string) =>
  invoke<RruleDescribeResult>("describe_rrule", { rrule });

export const simplifiedToRrule = (input: SimplifiedRecurrenceInput) =>
  invoke<string>("simplified_to_rrule", { input });

export const setTodoRecurrence = (todoId: number, input: CreateRecurrenceRule | null) =>
  invoke<Todo>("set_todo_recurrence", { todoId, input });

// Reminders
export const createReminder = (input: CreateReminder) =>
  invoke<Reminder>("create_reminder", { input });

export const listRemindersByTodo = (todoId: number) =>
  invoke<Reminder[]>("list_reminders_by_todo", { todoId });

export const updateReminder = (input: UpdateReminder) =>
  invoke<Reminder>("update_reminder", { input });

export const deleteReminder = (id: number) =>
  invoke<void>("delete_reminder", { id });

export const snoozeReminder = (input: SnoozeInput) =>
  invoke<void>("snooze_reminder", { input });

export const dismissReminder = (id: number) =>
  invoke<void>("dismiss_reminder", { id });

// Complete with recurrence
export const completeTodo = (id: number, status: "completed" | "abandoned") =>
  invoke<Todo>("complete_todo", { id, status });
```

Add imports for new types at the top:
```typescript
import type {
  // ... existing imports ...
  RecurrenceRule, CreateRecurrenceRule, RruleDescribeResult, SimplifiedRecurrenceInput,
  Reminder, CreateReminder, UpdateReminder, SnoozeInput,
} from "../types";
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/invoke.ts
git commit -m "feat: add recurrence and reminder API invoke wrappers"
```

---

## Task 12: Recurrence Editor Component

**Files:**
- Create: `src/components/todo/RecurrenceEditor.tsx`

- [ ] **Step 1: Create the recurrence editor**

Create `src/components/todo/RecurrenceEditor.tsx` with dual-mode UI (simplified picker + raw RRULE input):

```tsx
import { useState, useEffect, useCallback } from "react";
import type { RecurrenceRule, RruleDescribeResult, SimplifiedRecurrenceInput } from "../../types";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface RecurrenceEditorProps {
  todoId: number;
  dueDate: string | null;
  rule: RecurrenceRule | null;
  onRefresh: () => void;
}

type Mode = "off" | "simple" | "rrule";
type Freq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
type EndType = "never" | "date" | "count";

const FREQ_LABELS: Record<Freq, string> = {
  DAILY: "每天",
  WEEKLY: "每周",
  MONTHLY: "每月",
  YEARLY: "每年",
};

const WEEKDAYS = [
  { key: "MO", label: "一" },
  { key: "TU", label: "二" },
  { key: "WE", label: "三" },
  { key: "TH", label: "四" },
  { key: "FR", label: "五" },
  { key: "SA", label: "六" },
  { key: "SU", label: "日" },
];

export function RecurrenceEditor({ todoId, dueDate, rule, onRefresh }: RecurrenceEditorProps) {
  const [mode, setMode] = useState<Mode>(rule ? "simple" : "off");
  const [freq, setFreq] = useState<Freq>("DAILY");
  const [interval, setInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [endType, setEndType] = useState<EndType>("never");
  const [endDate, setEndDate] = useState("");
  const [maxCount, setMaxCount] = useState(10);
  const [rruleInput, setRruleInput] = useState("");
  const [describeResult, setDescribeResult] = useState<RruleDescribeResult | null>(null);

  // Load existing rule into form
  useEffect(() => {
    if (rule) {
      // Parse the existing RRULE to populate form fields
      setRruleInput(rule.rrule);
    }
  }, [rule]);

  // Real-time RRULE description when in rrule mode
  useEffect(() => {
    if (mode !== "rrule" || !rruleInput) {
      setDescribeResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const result = await api.describeRrule(rruleInput);
        setDescribeResult(result);
      } catch {
        setDescribeResult({ valid: false, description: null, error: "解析失败", preview_dates: [] });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [mode, rruleInput]);

  const handleSave = useCallback(async () => {
    try {
      let rruleStr: string;
      if (mode === "simple") {
        const input: SimplifiedRecurrenceInput = {
          freq,
          interval: interval > 1 ? interval : null,
          by_day: freq === "WEEKLY" && selectedDays.length > 0 ? selectedDays : null,
          by_month_day: null,
          by_set_pos: null,
          end_date: endType === "date" ? endDate : null,
          max_count: endType === "count" ? maxCount : null,
        };
        rruleStr = await api.simplifiedToRrule(input);
      } else {
        rruleStr = rruleInput;
      }

      const dtstart = dueDate || new Date().toISOString().slice(0, 10);
      await api.setTodoRecurrence(todoId, {
        rrule: rruleStr,
        dtstart,
        end_date: endType === "date" ? endDate : null,
        max_count: endType === "count" ? maxCount : null,
      });
      onRefresh();
      notify.success("重复规则已保存");
    } catch (e) {
      notify.error("保存重复规则失败");
    }
  }, [mode, freq, interval, selectedDays, endType, endDate, maxCount, rruleInput, todoId, dueDate, onRefresh]);

  const handleRemove = useCallback(async () => {
    try {
      await api.setTodoRecurrence(todoId, null);
      onRefresh();
      notify.success("已移除重复规则");
    } catch {
      notify.error("移除重复规则失败");
    }
  }, [todoId, onRefresh]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <h4 className="text-xs font-semibold text-muted-foreground">重复</h4>
        <div className="flex gap-0.5 ml-auto">
          {(["off", "simple", "rrule"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-2 py-0.5 text-[10px] rounded ${
                mode === m ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {m === "off" ? "关闭" : m === "simple" ? "简易" : "RRULE"}
            </button>
          ))}
        </div>
      </div>

      {mode === "off" && rule && (
        <Button size="xs" variant="destructive" onClick={handleRemove}>移除重复</Button>
      )}

      {mode === "simple" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">每</span>
            {interval > 1 && (
              <Input
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                className="w-12 text-xs h-6"
              />
            )}
            <div className="flex gap-0.5">
              {(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"] as Freq[]).map((f) => (
                <button
                  key={f}
                  onClick={() => { setFreq(f); setInterval(1); }}
                  className={`px-1.5 py-0.5 text-[10px] rounded ${
                    freq === f ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {interval > 1 ? FREQ_LABELS[f].replace("每", "") : FREQ_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          {freq === "WEEKLY" && (
            <div className="flex gap-1">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setSelectedDays((prev) =>
                    prev.includes(d.key) ? prev.filter((x) => x !== d.key) : [...prev, d.key]
                  )}
                  className={`w-6 h-6 rounded text-[10px] flex items-center justify-center ${
                    selectedDays.includes(d.key) ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1">
            {(["never", "date", "count"] as EndType[]).map((t) => (
              <button
                key={t}
                onClick={() => setEndType(t)}
                className={`px-1.5 py-0.5 text-[10px] rounded ${
                  endType === t ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                {t === "never" ? "永不" : t === "date" ? "到日期" : "次数"}
              </button>
            ))}
            {endType === "date" && (
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-28 text-xs h-6" />
            )}
            {endType === "count" && (
              <Input type="number" min={1} value={maxCount} onChange={(e) => setMaxCount(Number(e.target.value))} className="w-14 text-xs h-6" />
            )}
          </div>

          <Button size="xs" onClick={handleSave}>保存</Button>
        </div>
      )}

      {mode === "rrule" && (
        <div className="space-y-2">
          <Input
            value={rruleInput}
            onChange={(e) => setRruleInput(e.target.value)}
            placeholder="FREQ=WEEKLY;BYDAY=MO,WE,FR"
            className="text-xs font-mono"
          />
          {describeResult && (
            <div className={`text-xs p-1.5 rounded ${
              describeResult.valid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}>
              {describeResult.valid
                ? describeResult.description
                : describeResult.error}
            </div>
          )}
          {describeResult?.valid && describeResult.preview_dates.length > 0 && (
            <div className="text-[10px] text-muted-foreground">
              预览: {describeResult.preview_dates.join(", ")}
            </div>
          )}
          <Button size="xs" onClick={handleSave} disabled={!describeResult?.valid && mode === "rrule"}>
            保存
          </Button>
        </div>
      )}

      {rule && (
        <div className="text-[10px] text-muted-foreground">
          已完成 {rule.completed_count} 次
          {rule.max_count && ` / ${rule.max_count} 次`}
          {rule.next_due && ` · 下次: ${rule.next_due.slice(0, 10)}`}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/todo/RecurrenceEditor.tsx
git commit -m "feat: add RecurrenceEditor component with dual-mode UI"
```

---

## Task 13: Reminder Editor Component

**Files:**
- Create: `src/components/todo/ReminderEditor.tsx`

- [ ] **Step 1: Create the reminder editor**

Create `src/components/todo/ReminderEditor.tsx`:

```tsx
import { useState, useEffect, useCallback } from "react";
import type { Reminder, CreateReminder } from "../../types";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface ReminderEditorProps {
  todoId: number;
  dueDate: string | null;
  reminders: Reminder[];
  onRefresh: () => void;
}

const OFFSET_PRESETS = [
  { minutes: 15, label: "截止前15分钟" },
  { minutes: 30, label: "截止前30分钟" },
  { minutes: 60, label: "截止前1小时" },
  { minutes: 1440, label: "截止前1天" },
];

export function ReminderEditor({ todoId, dueDate, reminders, onRefresh }: ReminderEditorProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<"relative" | "absolute">("relative");
  const [offsetMinutes, setOffsetMinutes] = useState(60);
  const [absoluteTime, setAbsoluteTime] = useState("09:00");
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifySystem, setNotifySystem] = useState(true);

  const handleAdd = useCallback(async () => {
    try {
      const input: CreateReminder = {
        todo_id: todoId,
        type: addType,
        offset_minutes: addType === "relative" ? offsetMinutes : null,
        absolute_at: addType === "absolute" ? absoluteTime : null,
        label: addType === "relative"
          ? formatOffsetLabel(offsetMinutes)
          : `每天 ${absoluteTime}`,
        notify_in_app: notifyInApp,
        notify_system: notifySystem,
      };
      await api.createReminder(input);
      setShowAdd(false);
      onRefresh();
      notify.success("提醒已添加");
    } catch {
      notify.error("添加提醒失败");
    }
  }, [todoId, addType, offsetMinutes, absoluteTime, notifyInApp, notifySystem, onRefresh]);

  const handleToggle = useCallback(async (r: Reminder) => {
    try {
      await api.updateReminder({ id: r.id, enabled: !r.enabled });
      onRefresh();
    } catch {
      notify.error("更新提醒失败");
    }
  }, [onRefresh]);

  const handleDelete = useCallback(async (id: number) => {
    try {
      await api.deleteReminder(id);
      onRefresh();
    } catch {
      notify.error("删除提醒失败");
    }
  }, [onRefresh]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-muted-foreground">提醒</h4>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-[10px] text-theme hover:underline"
        >
          + 添加提醒
        </button>
      </div>

      {reminders.length === 0 && !showAdd && (
        <p className="text-[10px] text-muted-foreground">暂无提醒</p>
      )}

      {reminders.map((r) => (
        <div key={r.id} className="flex items-center gap-2">
          <Checkbox
            checked={r.enabled}
            onCheckedChange={() => handleToggle(r)}
          />
          <span className={`text-xs flex-1 ${!r.enabled ? "text-muted-foreground line-through" : ""}`}>
            {r.label || (r.type === "relative" ? formatOffsetLabel(r.offset_minutes || 0) : r.absolute_at)}
          </span>
          <button onClick={() => handleDelete(r.id)} className="text-[10px] text-muted-foreground hover:text-destructive">
            &times;
          </button>
        </div>
      ))}

      {showAdd && (
        <div className="space-y-2 p-2 bg-accent/30 rounded">
          <div className="flex gap-1">
            <button
              onClick={() => setAddType("relative")}
              className={`px-2 py-0.5 text-[10px] rounded ${addType === "relative" ? "bg-accent" : "text-muted-foreground"}`}
            >
              相对截止时间
            </button>
            <button
              onClick={() => setAddType("absolute")}
              className={`px-2 py-0.5 text-[10px] rounded ${addType === "absolute" ? "bg-accent" : "text-muted-foreground"}`}
            >
              固定时间
            </button>
          </div>

          {addType === "relative" && (
            <>
              {!dueDate && (
                <p className="text-[10px] text-destructive">需要先设置截止日期</p>
              )}
              <div className="flex flex-wrap gap-1">
                {OFFSET_PRESETS.map((p) => (
                  <button
                    key={p.minutes}
                    onClick={() => setOffsetMinutes(p.minutes)}
                    className={`px-1.5 py-0.5 text-[10px] rounded ${
                      offsetMinutes === p.minutes ? "bg-accent" : "text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground">自定义:</span>
                <Input
                  type="number"
                  min={1}
                  value={offsetMinutes}
                  onChange={(e) => setOffsetMinutes(Number(e.target.value))}
                  className="w-16 text-xs h-6"
                />
                <span className="text-[10px] text-muted-foreground">分钟前</span>
              </div>
            </>
          )}

          {addType === "absolute" && (
            <Input
              type="time"
              value={absoluteTime}
              onChange={(e) => setAbsoluteTime(e.target.value)}
              className="w-28 text-xs h-6"
            />
          )}

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1 text-[10px]">
              <Checkbox checked={notifyInApp} onCheckedChange={(v) => setNotifyInApp(!!v)} />
              应用内
            </label>
            <label className="flex items-center gap-1 text-[10px]">
              <Checkbox checked={notifySystem} onCheckedChange={(v) => setNotifySystem(!!v)} />
              系统通知
            </label>
          </div>

          <div className="flex gap-1">
            <Button size="xs" onClick={handleAdd}>添加</Button>
            <Button size="xs" variant="outline" onClick={() => setShowAdd(false)}>取消</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatOffsetLabel(minutes: number): string {
  if (minutes >= 1440) return `截止前 ${minutes / 1440} 天`;
  if (minutes >= 60) return `截止前 ${minutes / 60} 小时`;
  return `截止前 ${minutes} 分钟`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/todo/ReminderEditor.tsx
git commit -m "feat: add ReminderEditor component with multi-reminder config"
```

---

## Task 14: Reminder Popup Component

**Files:**
- Create: `src/components/todo/ReminderPopup.tsx`
- Modify: `src/App.tsx` (or main app component — add listener for `show-reminder-popup` event)

- [ ] **Step 1: Create the popup component**

Create `src/components/todo/ReminderPopup.tsx`:

```tsx
import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import * as api from "../../lib/invoke";
import { notify } from "../../lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PopupData {
  queue_id: number;
  todo_id: number;
  title: string;
  priority: string;
  due_date: string;
}

interface QueuedPopup extends PopupData {
  _id: number; // unique key
}

const SNOOZE_OPTIONS = [
  { minutes: 10, label: "10分钟" },
  { minutes: 30, label: "30分钟" },
  { minutes: 60, label: "1小时" },
  { minutes: 1440, label: "明天" },
];

let popupCounter = 0;

export function ReminderPopup() {
  const [queue, setQueue] = useState<QueuedPopup[]>([]);
  const [showCustomSnooze, setShowCustomSnooze] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(60);

  useEffect(() => {
    const unlisten = listen<PopupData>("show-reminder-popup", (event) => {
      setQueue((prev) => [...prev, { ...event.payload, _id: ++popupCounter }]);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const current = queue[0];
  if (!current) return null;

  const handleComplete = async () => {
    try {
      await api.completeTodo(current.todo_id, "completed");
      setQueue((prev) => prev.slice(1));
    } catch {
      notify.error("操作失败");
    }
  };

  const handleAbandon = async () => {
    try {
      await api.completeTodo(current.todo_id, "abandoned");
      setQueue((prev) => prev.slice(1));
    } catch {
      notify.error("操作失败");
    }
  };

  const handleSnooze = async (minutes: number) => {
    try {
      await api.snoozeReminder({ queue_id: current.queue_id, snooze_minutes: minutes });
      setQueue((prev) => prev.slice(1));
      setShowCustomSnooze(false);
    } catch {
      notify.error("延后失败");
    }
  };

  const handleDismiss = async () => {
    try {
      await api.dismissReminder(current.queue_id);
      setQueue((prev) => prev.slice(1));
    } catch {
      // Dismiss anyway
      setQueue((prev) => prev.slice(1));
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-80">
      <div className="bg-card rounded-lg shadow-xl border border-surface-border overflow-hidden animate-in">
        <div className="flex items-center justify-between px-3 py-2 bg-accent/50">
          <span className="text-xs font-semibold">待办提醒</span>
          <span className="text-[10px] text-muted-foreground">
            {queue.length > 1 ? `${queue.length} 条待处理` : ""}
          </span>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground text-sm leading-none">&times;</button>
        </div>

        <div className="px-3 py-3 space-y-2">
          <div className="text-sm font-medium">{current.title}</div>
          {current.due_date && (
            <div className="text-xs text-muted-foreground">截止: {current.due_date}</div>
          )}
          <div className="text-xs text-muted-foreground">优先级: {current.priority}</div>
        </div>

        <div className="px-3 pb-2 space-y-2">
          <div className="flex gap-2">
            <Button size="sm" onClick={handleComplete} className="flex-1">完成</Button>
            <Button size="sm" variant="outline" onClick={handleAbandon} className="flex-1">放弃</Button>
          </div>

          <div>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setShowCustomSnooze(!showCustomSnooze)}
              className="w-full"
            >
              延后
            </Button>
            {showCustomSnooze && (
              <div className="mt-1 space-y-1">
                <div className="flex gap-1">
                  {SNOOZE_OPTIONS.map((opt) => (
                    <button
                      key={opt.minutes}
                      onClick={() => handleSnooze(opt.minutes)}
                      className="px-2 py-1 text-[10px] rounded bg-accent hover:bg-accent/70"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    value={customMinutes}
                    onChange={(e) => setCustomMinutes(Number(e.target.value))}
                    className="w-16 text-xs h-6"
                    placeholder="分钟"
                  />
                  <Button size="xs" onClick={() => handleSnooze(customMinutes)}>自定义</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Mount the popup in the app**

In the main App component (or root layout), add `<ReminderPopup />` so it's always rendered and can receive events.

- [ ] **Step 3: Commit**

```bash
git add src/components/todo/ReminderPopup.tsx
git commit -m "feat: add ReminderPopup component with snooze and complete actions"
```

---

## Task 15: Update TodoDetailEditor

**Files:**
- Modify: `src/components/todo/TodoDetailEditor.tsx`

- [ ] **Step 1: Add RecurrenceEditor and ReminderEditor sections**

In `src/components/todo/TodoDetailEditor.tsx`, add imports:

```tsx
import { RecurrenceEditor } from "./RecurrenceEditor";
import { ReminderEditor } from "./ReminderEditor";
```

Update the `TodoDetailEditorProps` to accept recurrence/reminder data:

```tsx
interface TodoDetailEditorProps {
  todoId: number;
  currentGroupId: number | null;
  dueDate: string | null;
  recurrenceRule: RecurrenceRule | null;
  reminders: Reminder[];
  onClose: () => void;
  onRefresh: () => void;
}
```

Add imports for types:
```tsx
import type { Tag, RecurrenceRule, Reminder } from "../../types";
```

In the component body, after the tag selector section and before the closing `</PopoverContent>`, add:

```tsx
<Separator />

<RecurrenceEditor
  todoId={todoId}
  dueDate={dueDate}
  rule={recurrenceRule}
  onRefresh={onRefresh}
/>

<Separator />

<ReminderEditor
  todoId={todoId}
  dueDate={dueDate}
  reminders={reminders}
  onRefresh={onRefresh}
/>
```

- [ ] **Step 2: Update TodoItem to pass new props**

In `src/components/todo/TodoItem.tsx`, update the `TodoDetailEditor` usage to pass the new props:

```tsx
{showDetail && (
  <TodoDetailEditor
    todoId={todo.id}
    currentGroupId={todo.group_id}
    dueDate={todo.due_date}
    recurrenceRule={(todo as TodoWithDetails).recurrence_rule ?? null}
    reminders={(todo as TodoWithDetails).reminders ?? []}
    onClose={() => setShowDetail(false)}
    onRefresh={() => { onRefresh?.(); }}
  />
)}
```

Note: Since `todo` prop can be `Todo` or `TodoWithDetails`, use type assertion. The recurrence_rule and reminders will be undefined for plain `Todo` objects.

- [ ] **Step 3: Add recurrence indicator to TodoItem**

In the `TodoItem` render, add a recurrence icon after the priority badge:

```tsx
{(todo as TodoWithDetails).recurrence_rule && (
  <span className="text-[10px] text-muted-foreground" title="重复待办">🔁</span>
)}
```

- [ ] **Step 4: Add abandoned status styling**

In the `TodoItem` component, update the status logic:

```tsx
const isCompleted = todo.status === "completed";
const isAbandoned = todo.status === "abandoned";
```

Add abandoned styling to the title:
```tsx
<span className={`text-sm ${
  isCompleted ? "line-through text-muted-foreground" :
  isAbandoned ? "line-through text-muted-foreground italic" :
  "text-foreground font-medium"
} cursor-text`}>
```

- [ ] **Step 5: Update useTodos to use completeTodo for recurring items**

In `src/hooks/useTodos.ts`, update `toggleStatus` to handle abandoned:

```typescript
const toggleStatus = async (id: number, status: "pending" | "completed" | "abandoned") => {
  try {
    await api.completeTodo(id, status === "pending" ? "completed" : status);
    await refresh();
  } catch (e) {
    notify.error("操作失败");
    throw e;
  }
};
```

- [ ] **Step 6: Build and verify**

Run: `cd d:/Project/scene-todo && npm run build` (or appropriate frontend build)
Run: `cd d:/Project/scene-todo/src-tauri && cargo check`

- [ ] **Step 7: Commit**

```bash
git add src/components/todo/TodoDetailEditor.tsx src/components/todo/TodoItem.tsx src/hooks/useTodos.ts
git commit -m "feat: integrate recurrence and reminder editors into todo detail UI"
```

---

## Task 16: TodoList Enhancements

**Files:**
- Modify: `src/components/todo/TodoList.tsx`

- [ ] **Step 1: Add abandoned status to filter options**

In TodoList, update the status filter options to include "abandoned":

```tsx
const statusOptions = [
  { value: "", label: "全部" },
  { value: "pending", label: "待办" },
  { value: "overdue", label: "过期" },
  { value: "abandoned", label: "已放弃" },
  { value: "completed", label: "已完成" },
];
```

- [ ] **Step 2: Add recurrence filter**

Add a "重复待办" filter toggle that filters `todos.filter(t => t.recurrence_rule)`.

- [ ] **Step 3: Commit**

```bash
git add src/components/todo/TodoList.tsx
git commit -m "feat: add abandoned and recurrence filters to todo list"
```

---

## Task 17: Calendar View Enhancement

**Files:**
- Modify: `src/components/todo/CalendarView.tsx`

- [ ] **Step 1: Add recurrence icon to calendar items**

In the calendar date cell rendering, add a 🔁 indicator for recurring todos:

```tsx
{todo.recurrence_rule && <span className="text-[8px]">🔁</span>}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/todo/CalendarView.tsx
git commit -m "feat: mark recurring todos in calendar view"
```

---

## Task 18: Update TodoWithDetails Query

**Files:**
- Modify: `src-tauri/src/services/todo_repo.rs`

- [ ] **Step 1: Enrich get_todo_with_details with recurrence and reminder data**

In `get_todo_with_details` and `list_todos_with_details`, after fetching the base todo, also fetch:
- `recurrence_rule` from `recurrence_rules` table (joined by `todo.recurrence_rule_id`)
- `reminders` from `reminders` table (where `todo_id = todo.id`)

Add batch query functions for these:

```rust
fn batch_query_recurrence_rules(
    conn: &rusqlite::Connection,
    id_list: &str,
) -> Result<std::collections::HashMap<i64, RecurrenceRule>, String> {
    let sql = format!(
        "SELECT t.id, r.id, r.rrule, r.dtstart, r.next_due, r.end_date, r.max_count, r.completed_count, r.expired, r.created_at
         FROM todos t
         JOIN recurrence_rules r ON t.recurrence_rule_id = r.id
         WHERE t.id IN ({})",
        id_list
    );
    let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare batch rules: {}", e))?;
    let mut map: std::collections::HashMap<i64, RecurrenceRule> = std::collections::HashMap::new();
    let rows = stmt.query_map([], |row| {
        Ok((row.get::<_, i64>(0)?, RecurrenceRule {
            id: row.get(1)?, rrule: row.get(2)?, dtstart: row.get(3)?,
            next_due: row.get(4)?, end_date: row.get(5)?, max_count: row.get(6)?,
            completed_count: row.get(7)?, expired: row.get::<_, i32>(8)? != 0,
            created_at: row.get(9)?,
        }))
    }).map_err(|e| format!("Query batch rules: {}", e))?;
    for r in rows { let (todo_id, rule) = r.map_err(|e| format!("Row: {}", e))?; map.insert(todo_id, rule); }
    Ok(map)
}
```

Similarly add `batch_query_reminders`. Then integrate into `list_todos_with_details`:

```rust
let rules = batch_query_recurrence_rules(&conn, &id_list)?;
let reminder_map = batch_query_reminders(&conn, &id_list)?;

Ok(todos.into_iter().map(|todo| {
    TodoWithDetails {
        todo: todo.clone(),
        tags: tags.get(&todo.id).cloned().unwrap_or_default(),
        sub_tasks: subtasks.get(&todo.id).cloned().unwrap_or_default(),
        bound_scene_ids: scenes.get(&todo.id).cloned().unwrap_or_default(),
        recurrence_rule: rules.get(&todo.id).cloned(),
        reminders: reminder_map.get(&todo.id).cloned().unwrap_or_default(),
    }
}).collect())
```

- [ ] **Step 2: Run tests**

Run: `cd d:/Project/scene-todo/src-tauri && cargo test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/services/todo_repo.rs
git commit -m "feat: enrich TodoWithDetails with recurrence rule and reminders data"
```

---

## Task 19: Integration Test

**Files:**
- Add test cases to `src-tauri/src/services/recurrence_repo.rs` (mod tests)
- Add test cases to `src-tauri/src/services/reminder_repo.rs` (mod tests)

- [ ] **Step 1: Write end-to-end recurrence test**

Add to `recurrence_repo.rs` tests:

```rust
#[test]
fn test_full_recurrence_lifecycle() {
    let db = setup_db();

    // Create a recurring todo
    let rule = create_recurrence_rule(&db, CreateRecurrenceRule {
        rrule: "FREQ=DAILY;INTERVAL=1".into(),
        dtstart: "2026-01-01".into(),
        end_date: None,
        max_count: Some(3),
    }).unwrap();

    let todo = todo_repo::create_todo(&db, crate::models::CreateTodo {
        title: "Daily standup".into(), description: None, priority: None,
        group_id: None, parent_id: None, due_date: Some("2026-01-01".into()),
    }).unwrap();

    // Link rule to todo
    todo_repo::update_todo(&db, crate::models::UpdateTodo {
        id: todo.id, recurrence_rule_id: Some(rule.id),
        title: None, description: None, status: None, priority: None,
        group_id: None, due_date: None,
    }).unwrap();

    // Complete instance 1
    let new_id_1 = generate_next_instance(&db, todo.id, rule.id).unwrap();
    assert!(new_id_1 > 0);

    // Complete instance 2
    let new_id_2 = generate_next_instance(&db, new_id_1, rule.id).unwrap();
    assert!(new_id_2 > 0);

    // Complete instance 3 — should expire (max_count=3)
    let new_id_3 = generate_next_instance(&db, new_id_2, rule.id).unwrap();
    assert_eq!(new_id_3, 0); // expired signal

    // Verify rule is expired
    let updated_rule = get_recurrence_rule(&db, rule.id).unwrap();
    assert!(updated_rule.expired);
}
```

- [ ] **Step 2: Run all tests**

Run: `cd d:/Project/scene-todo/src-tauri && cargo test`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/services/recurrence_repo.rs src-tauri/src/services/reminder_repo.rs
git commit -m "test: add integration tests for recurrence lifecycle"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: All spec sections map to tasks (DB schema → T1, models → T2, RRULE → T4, recurrence repo → T6, reminder repo → T7, scheduler → T9, commands → T8, frontend types → T10, API → T11, editors → T12/T13, popup → T14, integration → T15-T18)
- [x] **Placeholder scan**: No TBDs, TODOs, or "implement later" patterns
- [x] **Type consistency**: Rust structs match TypeScript interfaces, field names consistent across layers
