# Recurrence & Reminders Design

## Overview

Add customizable recurrence (RRULE-based) and multi-point reminders to todos. When a recurring todo is completed or abandoned, the system auto-generates the next instance with cloned sub-tasks, tags, scene bindings, and reminders.

## Requirements Summary

- **Recurrence**: Full iCal RRULE standard, dual UI (simplified picker + raw RRULE input)
- **Reminders**: Multiple reminder points per todo, supporting relative offsets and absolute times
- **Notifications**: In-app toast + system notification + interactive popup window (bottom-right)
- **Popup actions**: Complete, Abandon, Snooze (10min / 30min / 1hr / same time tomorrow / custom)
- **Completion behavior**: Auto-generate next instance, old instance stays in completed list
- **Sub-tasks**: Chain-propagated — cloned from the just-completed instance at generation time
- **New status**: `abandoned` — skips this instance but still generates the next one

## Database Schema

### recurrence_rules

```sql
CREATE TABLE recurrence_rules (
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
CREATE INDEX idx_recurrence_rules_next_due ON recurrence_rules(next_due) WHERE expired = 0;
```

### reminders

```sql
CREATE TABLE reminders (
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
```

### reminder_queue

```sql
CREATE TABLE reminder_queue (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id      INTEGER NOT NULL,
    reminder_id  INTEGER NOT NULL,
    trigger_at   TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','fired','dismissed','snoozed')),
    snooze_until TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (reminder_id) REFERENCES reminders(id) ON DELETE CASCADE
);
CREATE INDEX idx_reminder_queue_trigger ON reminder_queue(trigger_at, status);
```

### todos table change

```sql
ALTER TABLE todos ADD COLUMN recurrence_rule_id INTEGER REFERENCES recurrence_rules(id);
```

### status constraint update

`todos.status` expands to include `abandoned`:

```sql
CHECK(status IN ('pending', 'completed', 'abandoned'))
```

## Architecture

### ReminderScheduler (Rust service)

Timer-driven, not polling:

1. **Startup**: Load all `reminder_queue` rows with `status = 'pending' AND trigger_at < now + 24h` into a binary heap (min-heap by `trigger_at`)
2. **Timer**: Set `tokio::time::sleep_until(next_trigger_at)` for the heap's front element
3. **On fire**:
   - Update `reminder_queue.status → 'fired'`
   - Send system notification via Tauri notification plugin
   - Emit `app.emit("reminder-fired", payload)` for in-app toast
   - Create popup window (bottom-right, always-on-top, borderless)
   - Pop heap front, set timer for next element
4. **New reminder inserted**: Insert into heap, reset timer if it's sooner than current
5. **Snooze**: Update `snooze_until` + `status = 'snoozed'`, re-insert into heap with new trigger time

### RRULE Processing

Uses Rust `rrule` crate:

- **Validation**: `RRule::from_str()` — parse failure = invalid
- **Next occurrence**: `rrule.after(current_due_date)` to compute next instance date
- **Human-readable description**: Backend `describe_rrule()` parses RRULE fields into Chinese text
- **Preview**: Backend generates next N occurrence dates for frontend display

Examples:
```
FREQ=DAILY;INTERVAL=2        → "每2天"
FREQ=WEEKLY;BYDAY=MO,WE,FR   → "每周一、三、五"
FREQ=MONTHLY;BYDAY=2FR       → "每月第2个周五"
FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=8 → "每年3月8日"
```

### Instance Generation Flow

When a recurring todo is completed or abandoned:

```
BEGIN TRANSACTION
  1. UPDATE todos SET status = 'completed'/'abandoned', completed_at = now
  2. UPDATE recurrence_rules SET completed_count += 1
  3. Check end conditions (end_date reached / max_count reached / no more occurrences):
     → If ended: SET expired = 1, done
     → If not:
       a. Compute next_due via rrule.after(current_due_date)
       b. UPDATE recurrence_rules SET next_due = next_due
       c. Clone todo: new id, status='pending', due_date=next_due, same recurrence_rule_id
       d. Clone sub-tasks: parent_id → new todo id, status='pending', clear completed_at
       e. Copy todo_tags from original
       f. Copy todo_scene_bindings from original
       g. Copy reminder configs, compute trigger_at for each based on next_due
       h. INSERT into reminder_queue
COMMIT
```

All-or-nothing: failure rolls back, current instance status unchanged.

### Interactive Popup Window

Built as a Tauri WebviewWindow:
- Borderless, always-on-top, positioned at screen bottom-right
- Created dynamically when a reminder fires
- Multiple reminders queue up (shown one at a time)
- Fallback: if popup creation fails, system notification only

Layout:
```
┌──────────────────────────────────────┐
│  📋 待办提醒                    [×]  │
│──────────────────────────────────────│
│  {todo.title}                        │
│  截止: {due_date}                    │
│  优先级: {priority}                  │
│──────────────────────────────────────│
│  [✓ 完成]  [✗ 放弃]  [⏰ 延后 ▼]     │
│                                      │
│  延后选项（展开）:                    │
│   10分钟 | 30分钟 | 1小时 | 明天同时  │
│   [自定义时间...]                     │
└──────────────────────────────────────┘
```

Popup actions:
- **完成**: `update_todo(status: "completed")` → generates next instance
- **放弃**: `update_todo(status: "abandoned")` → generates next instance
- **延后**: Updates `reminder_queue.snooze_until` + `status: "snoozed"` → reschedules

## Frontend UI

### Recurrence Editor (in TodoDetailEditor)

Dual-mode toggle:

**Simplified mode**:
- Frequency dropdown: 每天 / 每周 / 每月 / 每年
- Interval input: 每 [N] [天/周/月/年]
- Weekly: weekday checkboxes
- Monthly: day-of-month input or "第N个星期X"
- End condition: 永不 / 日期 / 次数
- Backend assembles RRULE string from these fields

**RRULE mode**:
- Text input for raw RRULE string
- Real-time validation via `describe_rrule` command
- Shows parsed description + next N occurrence preview
- Red error on invalid input

### Reminder Editor (in TodoDetailEditor)

- List of configured reminders, each with toggle switch
- "Add reminder" button opens inline form:
  - Type: relative to due date / absolute time
  - Relative: offset amount + unit (minutes/hours/days)
  - Absolute: time picker
  - Notification method: in-app / system / both (checkboxes)
- Common presets as quick-add: "截止前15分钟", "截止前1小时", "截止前1天"

### Calendar View Enhancement

- Recurring todos marked with 🔁 icon
- Click icon to show recurrence rule info

### Todo List Enhancement

- Recurring todos show 🔁 icon + human-readable description (e.g., "每周一")
- Click icon to expand series history (completed/abandoned instances)
- New filter option: "重复待办"

## Edge Cases & Error Handling

### RRULE
- Invalid RRULE string: frontend real-time validation, prevent save
- Missing `dtstart`: default to `due_date`, fallback to today
- Zero interval or infinite loops: caught by `rrule` crate, backend returns error

### Reminders
- `trigger_at` already passed: fire immediately
- App closed during reminders: on startup, scan `pending WHERE trigger_at < now`, show "您有 N 条过期提醒"
- Relative reminder on todo without due_date: frontend blocks, requires due_date first
- Multiple reminders at same time: popup queue, show sequentially

### Instance Generation
- RRULE exhausted (no more occurrences): mark rule `expired`, stop generating
- Transaction failure: full rollback, current instance unchanged
- Concurrent completion: SQLite write lock prevents race conditions

## Sub-task Propagation

Chain-propagation model: at instance generation, sub-tasks are cloned from the **just-completed** instance. Changes to sub-tasks on the current active instance carry forward naturally:

```
Instance A has sub-tasks [S1, S2]
  → User renames S2 to "更新文档" on A
  → Complete A → clones A's sub-tasks for B
  → Instance B has sub-tasks [S1, "更新文档"]  (change inherited)
  → User adds S3 on B
  → Complete B → clones B's sub-tasks for C
  → Instance C has sub-tasks [S1, "更新文档", S3]
```

No separate template table needed.

## Deletion & Editing Behavior

### Deletion
- **Active instance**: Prompt "这是重复待办，是否停止整个系列？" → Confirm: delete instance + rule + all history; Cancel: delete only this instance
- **Completed/abandoned instance**: Direct delete, no impact on series

### Editing
- **Edit current instance** (title, description, priority): affects only this instance
- **Edit recurrence rule**: prompt "仅此实例 / 此后所有实例"
- **Edit sub-tasks**: affects only current instance's sub-tasks, not past instances
