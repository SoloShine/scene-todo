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
