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
        Self {
            db,
            current_session: Arc::new(Mutex::new(None)),
            paused: Arc::new(Mutex::new(false)),
        }
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
        let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        *self.current_session.lock().unwrap() = Some(PendingSession {
            scene_id,
            app_id,
            started_at: now,
        });
    }

    /// End current session and write to DB
    pub fn end_current_session(&self) {
        let mut session = self.current_session.lock().unwrap();
        if let Some(s) = session.take() {
            let now = chrono::Utc::now();
            let started =
                chrono::NaiveDateTime::parse_from_str(&s.started_at, "%Y-%m-%d %H:%M:%S").ok();
            let duration_secs =
                started.map(|t| (now.naive_utc() - t).num_seconds().max(0) as i64);

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
        }
    }

    /// Flush current session to DB without ending it (for periodic save / crash recovery)
    pub fn flush(&self) {
        // Current sessions live in memory only.
        // This hook exists for future use (e.g. periodic WAL flush, crash recovery).
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
