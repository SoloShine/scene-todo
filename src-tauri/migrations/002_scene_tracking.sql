-- Scene tracking tables

CREATE TABLE IF NOT EXISTS scenes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    icon        TEXT,
    color       TEXT    NOT NULL DEFAULT '#6B7280',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    track_time  INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scene_apps (
    scene_id INTEGER NOT NULL,
    app_id   INTEGER NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (scene_id, app_id),
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (app_id)   REFERENCES apps(id)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todo_scene_bindings (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id  INTEGER NOT NULL,
    scene_id INTEGER NOT NULL,
    UNIQUE(todo_id, scene_id),
    FOREIGN KEY (todo_id)  REFERENCES todos(id)  ON DELETE CASCADE,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS time_sessions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    scene_id      INTEGER,
    app_id        INTEGER,
    started_at    TEXT    NOT NULL,
    ended_at      TEXT,
    duration_secs INTEGER,
    FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE SET NULL,
    FOREIGN KEY (app_id)   REFERENCES apps(id)   ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_time_sessions_scene_id   ON time_sessions(scene_id);
CREATE INDEX IF NOT EXISTS idx_time_sessions_started_at ON time_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_time_sessions_app_id     ON time_sessions(app_id);

-- Data migration: migrate existing apps with todo bindings into scenes.
-- Only process apps that have at least one todo_app_bindings record (skip orphan apps).
-- For each valid app, create a scene with deduplicated name.
-- Uses a correlated subquery to compute a row number for deduplication:
-- if the same base_name appears multiple times, suffix " (2)", " (3)", etc.
INSERT INTO scenes (name, sort_order, track_time)
SELECT
    CASE
        WHEN rn = 1 THEN base_name
        ELSE base_name || ' (' || cast(rn AS TEXT) || ')'
    END,
    0,
    1
FROM (
    SELECT
        a.id AS app_id,
        COALESCE(a.display_name, a.name) AS base_name,
        (
            SELECT COUNT(*)
            FROM apps a2
            WHERE COALESCE(a2.display_name, a2.name) = COALESCE(a.display_name, a.name)
              AND a2.id < a.id
              AND EXISTS (SELECT 1 FROM todo_app_bindings tab2 WHERE tab2.app_id = a2.id)
        ) + 1 AS rn
    FROM apps a
    WHERE EXISTS (SELECT 1 FROM todo_app_bindings tab WHERE tab.app_id = a.id)
    ORDER BY a.id
);

-- Insert scene_apps: link each app to its auto-created scene (priority 0).
-- The scenes were inserted in app.id order, so we correlate by rowid position.
INSERT INTO scene_apps (scene_id, app_id, priority)
SELECT
    (SELECT s.id FROM scenes s
     WHERE s.rowid = (
         SELECT COUNT(*)
         FROM apps a2
         WHERE a2.id <= a.id
           AND EXISTS (SELECT 1 FROM todo_app_bindings tab2 WHERE tab2.app_id = a2.id)
     )
    ) AS scene_id,
    a.id,
    0
FROM apps a
WHERE EXISTS (SELECT 1 FROM todo_app_bindings tab WHERE tab.app_id = a.id);

-- Migrate todo_app_bindings to todo_scene_bindings via the auto-created scene mapping.
INSERT INTO todo_scene_bindings (todo_id, scene_id)
SELECT DISTINCT tab.todo_id, sa.scene_id
FROM todo_app_bindings tab
JOIN scene_apps sa ON sa.app_id = tab.app_id;

-- Keep todo_app_bindings table (don't drop) for backward compatibility.
-- Verification is handled in Rust code after migration runs.
