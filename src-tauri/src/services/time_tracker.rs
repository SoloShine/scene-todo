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
        let paused = *self.paused.lock().unwrap_or_else(|e| e.into_inner());
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
        let conn = self.db.conn.lock().unwrap_or_else(|e| e.into_inner());
        let _ = conn.execute(
            "DELETE FROM current_session",
            [],
        );
        let _ = conn.execute(
            "INSERT INTO current_session (id, scene_id, app_id, started_at) VALUES (1, ?1, ?2, ?3)",
            rusqlite::params![scene_id, app_id, now],
        );

        *self.current_session.lock().unwrap_or_else(|e| e.into_inner()) = Some(session);
    }

    /// End current session and write to DB
    pub fn end_current_session(&self) {
        let mut session = self.current_session.lock().unwrap_or_else(|e| e.into_inner());
        if let Some(s) = session.take() {
            let now = chrono::Local::now();
            let started =
                chrono::NaiveDateTime::parse_from_str(&s.started_at, "%Y-%m-%d %H:%M:%S").ok();
            let duration_secs =
                started.map(|t| (now.naive_local() - t).num_seconds().max(0) as i64);

            let conn = self.db.conn.lock().unwrap_or_else(|e| e.into_inner());
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
        let conn = self.db.conn.lock().unwrap_or_else(|e| e.into_inner());
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
        *self.paused.lock().unwrap_or_else(|e| e.into_inner()) = paused;
    }

    pub fn is_paused(&self) -> bool {
        *self.paused.lock().unwrap_or_else(|e| e.into_inner())
    }

    pub fn get_current_session_info(&self) -> Option<(i64, i64, String)> {
        self.current_session
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .as_ref()
            .map(|s| (s.scene_id, s.app_id, s.started_at.clone()))
    }

    pub fn get_db(&self) -> Arc<Database> {
        self.db.clone()
    }
}
