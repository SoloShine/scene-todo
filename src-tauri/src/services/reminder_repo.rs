use rusqlite::{params, Row};

use crate::models::*;
use crate::services::db::Database;
use crate::services::recurrence_repo::compute_trigger_at;

fn row_to_reminder(row: &Row) -> Result<Reminder, rusqlite::Error> {
    Ok(Reminder {
        id: row.get(0)?,
        todo_id: row.get(1)?,
        r#type: row.get(2)?,
        offset_minutes: row.get(3)?,
        absolute_at: row.get(4)?,
        label: row.get(5)?,
        notify_in_app: row.get::<_, i64>(6)? != 0,
        notify_system: row.get::<_, i64>(7)? != 0,
        enabled: row.get::<_, i64>(8)? != 0,
    })
}

fn row_to_queue_item(row: &Row) -> Result<ReminderQueueItem, rusqlite::Error> {
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
}

pub fn create_reminder(db: &Database, input: CreateReminder) -> Result<Reminder, String> {
    let notify_in_app = input.notify_in_app.unwrap_or(true);
    let notify_system = input.notify_system.unwrap_or(true);

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO reminders (todo_id, type, offset_minutes, absolute_at, label, notify_in_app, notify_system)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            input.todo_id,
            input.r#type,
            input.offset_minutes,
            input.absolute_at,
            input.label,
            notify_in_app as i64,
            notify_system as i64,
        ],
    )
    .map_err(|e| format!("Insert reminder: {}", e))?;

    let id = conn.last_insert_rowid();

    // If the todo has a due_date, compute trigger_at and insert into reminder_queue
    let due_date: Option<String> = conn
        .query_row(
            "SELECT due_date FROM todos WHERE id = ?1",
            params![input.todo_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    if let Some(ref due) = due_date {
        let trigger_at = compute_trigger_at(
            &input.r#type,
            input.offset_minutes,
            input.absolute_at.as_ref(),
            due,
        );
        if let Some(trigger) = trigger_at {
            conn.execute(
                "INSERT INTO reminder_queue (todo_id, reminder_id, trigger_at, status)
                 VALUES (?1, ?2, ?3, 'pending')",
                params![input.todo_id, id, trigger],
            )
            .map_err(|e| format!("Insert reminder queue: {}", e))?;
        }
    }

    let mut stmt = conn
        .prepare(
            "SELECT id, todo_id, type, offset_minutes, absolute_at, label, notify_in_app, notify_system, enabled
             FROM reminders WHERE id = ?1",
        )
        .map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_reminder)
        .map_err(|e| format!("Fetch: {}", e))
}

pub fn get_reminder(db: &Database, id: i64) -> Result<Reminder, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, todo_id, type, offset_minutes, absolute_at, label, notify_in_app, notify_system, enabled
             FROM reminders WHERE id = ?1",
        )
        .map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_reminder)
        .map_err(|e| format!("Not found: {}", e))
}

pub fn list_reminders_by_todo(db: &Database, todo_id: i64) -> Result<Vec<Reminder>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, todo_id, type, offset_minutes, absolute_at, label, notify_in_app, notify_system, enabled
             FROM reminders WHERE todo_id = ?1",
        )
        .map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt
        .query_map(params![todo_id], row_to_reminder)
        .map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn update_reminder(db: &Database, input: UpdateReminder) -> Result<Reminder, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut sets = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(v) = input.offset_minutes {
        sets.push(format!("offset_minutes = ?{}", param_values.len() + 1));
        param_values.push(Box::new(v));
    }
    if let Some(ref v) = input.absolute_at {
        if v.is_empty() {
            sets.push("absolute_at = NULL".into());
        } else {
            sets.push(format!("absolute_at = ?{}", param_values.len() + 1));
            param_values.push(Box::new(v.clone()));
        }
    }
    if let Some(ref v) = input.label {
        if v.is_empty() {
            sets.push("label = NULL".into());
        } else {
            sets.push(format!("label = ?{}", param_values.len() + 1));
            param_values.push(Box::new(v.clone()));
        }
    }
    if let Some(v) = input.notify_in_app {
        sets.push(format!("notify_in_app = ?{}", param_values.len() + 1));
        param_values.push(Box::new(v as i64));
    }
    if let Some(v) = input.notify_system {
        sets.push(format!("notify_system = ?{}", param_values.len() + 1));
        param_values.push(Box::new(v as i64));
    }
    if let Some(v) = input.enabled {
        sets.push(format!("enabled = ?{}", param_values.len() + 1));
        param_values.push(Box::new(v as i64));
    }

    if sets.is_empty() {
        drop(conn);
        return get_reminder(db, input.id);
    }

    let sql = format!("UPDATE reminders SET {} WHERE id = ?", sets.join(", "));
    param_values.push(Box::new(input.id));
    let params: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params.as_slice())
        .map_err(|e| format!("Update: {}", e))?;
    drop(conn);
    get_reminder(db, input.id)
}

pub fn delete_reminder(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM reminders WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete: {}", e))?;
    Ok(())
}

pub fn get_pending_reminders(
    db: &Database,
    within_hours: i64,
) -> Result<Vec<ReminderQueueItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT rq.id, rq.todo_id, rq.reminder_id, rq.trigger_at, rq.status, rq.snooze_until,
                    t.title, t.priority, t.due_date
             FROM reminder_queue rq
             JOIN todos t ON t.id = rq.todo_id
             WHERE rq.status = 'pending'
               AND rq.trigger_at <= datetime('now', ?1 || ' hours')
             ORDER BY rq.trigger_at",
        )
        .map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt
        .query_map(params![format!("+{}", within_hours)], row_to_queue_item)
        .map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn mark_reminder_fired(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE reminder_queue SET status = 'fired' WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("Mark fired: {}", e))?;
    Ok(())
}

pub fn snooze_reminder(db: &Database, queue_id: i64, snooze_minutes: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE reminder_queue
         SET status = 'pending',
             trigger_at = datetime('now', ?1 || ' minutes')
         WHERE id = ?2",
        params![format!("+{}", snooze_minutes), queue_id],
    )
    .map_err(|e| format!("Snooze: {}", e))?;
    Ok(())
}

pub fn dismiss_reminder(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE reminder_queue SET status = 'dismissed' WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("Dismiss: {}", e))?;
    Ok(())
}

pub fn get_overdue_reminders(db: &Database) -> Result<Vec<ReminderQueueItem>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT rq.id, rq.todo_id, rq.reminder_id, rq.trigger_at, rq.status, rq.snooze_until,
                    t.title, t.priority, t.due_date
             FROM reminder_queue rq
             JOIN todos t ON t.id = rq.todo_id
             WHERE rq.status = 'pending'
               AND rq.trigger_at < datetime('now')
             ORDER BY rq.trigger_at",
        )
        .map_err(|e| format!("Prepare: {}", e))?;
    let rows = stmt
        .query_map([], row_to_queue_item)
        .map_err(|e| format!("Query: {}", e))?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::todo_repo;
    use tempfile::NamedTempFile;

    fn setup_db() -> Database {
        let tmp = NamedTempFile::new().unwrap();
        Database::open(tmp.path()).unwrap()
    }

    fn create_test_todo(db: &Database) -> Todo {
        todo_repo::create_todo(
            db,
            CreateTodo {
                title: "Test todo".to_string(),
                description: None,
                priority: Some("high".to_string()),
                group_id: None,
                parent_id: None,
                due_date: Some("2025-06-15T10:00:00".to_string()),
            },
        )
        .unwrap()
    }

    #[test]
    fn test_create_reminder() {
        let db = setup_db();
        let todo = create_test_todo(&db);

        let reminder = create_reminder(
            &db,
            CreateReminder {
                todo_id: todo.id,
                r#type: "relative".to_string(),
                offset_minutes: Some(60),
                absolute_at: None,
                label: Some("1 hour before".to_string()),
                notify_in_app: Some(true),
                notify_system: Some(false),
            },
        )
        .unwrap();

        assert_eq!(reminder.todo_id, todo.id);
        assert_eq!(reminder.r#type, "relative");
        assert_eq!(reminder.offset_minutes, Some(60));
        assert_eq!(reminder.label, Some("1 hour before".to_string()));
        assert!(reminder.notify_in_app);
        assert!(!reminder.notify_system);
        assert!(reminder.enabled);

        // Verify queue item was created
        let conn = db.conn.lock().unwrap();
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM reminder_queue WHERE reminder_id = ?1",
                params![reminder.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);

        let trigger_at: String = conn
            .query_row(
                "SELECT trigger_at FROM reminder_queue WHERE reminder_id = ?1",
                params![reminder.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(trigger_at, "2025-06-15T09:00:00");
    }

    #[test]
    fn test_list_reminders_by_todo() {
        let db = setup_db();
        let todo = create_test_todo(&db);

        let r1 = create_reminder(
            &db,
            CreateReminder {
                todo_id: todo.id,
                r#type: "relative".to_string(),
                offset_minutes: Some(60),
                absolute_at: None,
                label: None,
                notify_in_app: None,
                notify_system: None,
            },
        )
        .unwrap();

        let r2 = create_reminder(
            &db,
            CreateReminder {
                todo_id: todo.id,
                r#type: "absolute".to_string(),
                offset_minutes: None,
                absolute_at: Some("2025-06-15T08:00:00".to_string()),
                label: None,
                notify_in_app: None,
                notify_system: None,
            },
        )
        .unwrap();

        let reminders = list_reminders_by_todo(&db, todo.id).unwrap();
        assert_eq!(reminders.len(), 2);

        let ids: Vec<i64> = reminders.iter().map(|r| r.id).collect();
        assert!(ids.contains(&r1.id));
        assert!(ids.contains(&r2.id));
    }
}
