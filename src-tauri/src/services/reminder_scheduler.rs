use std::cmp::Reverse;
use std::collections::BinaryHeap;
use std::sync::Arc;

use chrono::{Local, NaiveDateTime, TimeZone};
use tauri::{AppHandle, Emitter};
use tauri_plugin_notification::NotificationExt;
use tokio::sync::Mutex as TokioMutex;
use tokio::time::{sleep_until, Duration, Instant};

use crate::models::ReminderQueueItem;
use crate::services::db::Database;
use crate::services::reminder_repo;

pub struct ReminderScheduler {
    db: Arc<Database>,
    app: AppHandle,
    heap: Arc<TokioMutex<BinaryHeap<Reverse<(Instant, ReminderQueueItem)>>>>,
}

impl ReminderScheduler {
    pub fn new(db: Arc<Database>, app: AppHandle) -> Self {
        Self {
            db,
            app,
            heap: Arc::new(TokioMutex::new(BinaryHeap::new())),
        }
    }

    pub async fn start(&self) {
        // Initial load of pending reminders within 24 hours
        self.reload().await;

        loop {
            let heap = self.heap.lock().await;

            if heap.is_empty() {
                drop(heap);
                // No pending reminders — sleep a while and reload
                tokio::time::sleep(Duration::from_secs(300)).await;
                self.reload().await;
                continue;
            }

            let next_instant = heap.peek().unwrap().0 .0;
            drop(heap);

            let now = Instant::now();
            if next_instant > now {
                // Sleep until the next trigger time
                sleep_until(next_instant).await;
            }

            // Pop and fire
            let item = {
                let mut heap = self.heap.lock().await;
                heap.pop().map(|Reverse((_, item))| item)
            };

            if let Some(item) = item {
                self.fire(item).await;
            }
        }
    }

    async fn reload(&self) {
        match reminder_repo::get_pending_reminders(&self.db, 24) {
            Ok(items) => {
                let mut heap = self.heap.lock().await;
                heap.clear();
                let now = Instant::now();
                for item in items {
                    if let Some(instant) = parse_trigger_instant(&item.trigger_at) {
                        // Only add items that are in the future or very recently due
                        // (allow up to 60s of slack for items that just passed)
                        if instant > now - Duration::from_secs(60) {
                            heap.push(Reverse((instant, item)));
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("ReminderScheduler reload error: {}", e);
            }
        }
    }

    async fn fire(&self, item: ReminderQueueItem) {
        // 1. Mark as fired in DB
        if let Err(e) = reminder_repo::mark_reminder_fired(&self.db, item.id) {
            eprintln!("ReminderScheduler mark_fired error: {}", e);
            return;
        }

        let title = item
            .todo_title
            .clone()
            .unwrap_or_else(|| "Reminder".to_string());
        let due_info = item
            .todo_due_date
            .as_deref()
            .unwrap_or("No due date");

        // 2. Emit "reminder-fired" for in-app toast
        let payload = serde_json::json!({
            "queue_id": item.id,
            "todo_id": item.todo_id,
            "reminder_id": item.reminder_id,
            "title": title,
            "priority": item.todo_priority,
            "due_date": item.todo_due_date,
        });

        let _ = self.app.emit("reminder-fired", &payload);

        // 3. Emit "show-reminder-popup" with popup data
        let _ = self.app.emit("show-reminder-popup", &payload);

        // 4. Send system notification
        let notification_body = format!("Due: {}", due_info);
        let _ = self
            .app
            .notification()
            .builder()
            .title(&title)
            .body(&notification_body)
            .show();
    }
}

/// Parse a trigger_at string ("YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS")
/// into a tokio::Instant relative to the current system time.
fn parse_trigger_instant(trigger_at: &str) -> Option<Instant> {
    let naive = if let Ok(ndt) =
        NaiveDateTime::parse_from_str(trigger_at, "%Y-%m-%dT%H:%M:%S")
    {
        ndt
    } else if let Ok(ndt) =
        NaiveDateTime::parse_from_str(trigger_at, "%Y-%m-%d %H:%M:%S")
    {
        ndt
    } else {
        return None;
    };

    let local_dt = Local::now();
    let trigger_local = local_dt
        .timezone()
        .from_local_datetime(&naive)
        .single()?;

    let now = Local::now();
    let duration = trigger_local.signed_duration_since(now);
    if duration.num_milliseconds() > 0 {
        Some(Instant::now() + Duration::from_millis(duration.num_milliseconds() as u64))
    } else {
        // Already past — return now so it fires immediately
        Some(Instant::now())
    }
}
