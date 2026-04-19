CREATE TABLE IF NOT EXISTS current_session (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    scene_id INTEGER NOT NULL,
    app_id INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL
);
