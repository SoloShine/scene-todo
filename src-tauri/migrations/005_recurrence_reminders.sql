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
