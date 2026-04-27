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
        expired: row.get::<_, i64>(7)? != 0,
        created_at: row.get(8)?,
    })
}

pub fn create_recurrence_rule(
    db: &Database,
    input: CreateRecurrenceRule,
) -> Result<RecurrenceRule, String> {
    // Validate RRULE first
    rrule_service::validate_rrule(&input.rrule, &input.dtstart)?;

    // Compute next_due (first occurrence from dtstart)
    let next_due = rrule_service::next_occurrence(&input.rrule, &input.dtstart).ok();

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO recurrence_rules (rrule, dtstart, next_due, end_date, max_count)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![input.rrule, input.dtstart, next_due, input.end_date, input.max_count],
    )
    .map_err(|e| format!("Insert recurrence rule: {}", e))?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn
        .prepare(
            "SELECT id, rrule, dtstart, next_due, end_date, max_count, completed_count, expired, created_at
             FROM recurrence_rules WHERE id = ?1",
        )
        .map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_recurrence_rule)
        .map_err(|e| format!("Fetch: {}", e))
}

pub fn get_recurrence_rule(db: &Database, id: i64) -> Result<RecurrenceRule, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, rrule, dtstart, next_due, end_date, max_count, completed_count, expired, created_at
             FROM recurrence_rules WHERE id = ?1",
        )
        .map_err(|e| format!("Prepare: {}", e))?;
    stmt.query_row(params![id], row_to_recurrence_rule)
        .map_err(|e| format!("Not found: {}", e))
}

pub fn update_next_due(
    db: &Database,
    id: i64,
    next_due: Option<&str>,
    completed_count: i64,
    expired: bool,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE recurrence_rules SET next_due = ?1, completed_count = ?2, expired = ?3 WHERE id = ?4",
        params![next_due, completed_count, expired as i64, id],
    )
    .map_err(|e| format!("Update next due: {}", e))?;
    Ok(())
}

pub fn delete_recurrence_rule(db: &Database, id: i64) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM recurrence_rules WHERE id = ?1",
        params![id],
    )
    .map_err(|e| format!("Delete recurrence rule: {}", e))?;
    Ok(())
}

/// Compute the trigger_at timestamp for a reminder based on its type and the todo's due date.
///
/// - For `relative` type: trigger_at = due_date - offset_minutes
/// - For `absolute` type: trigger_at = absolute_at
pub fn compute_trigger_at(
    rem_type: &str,
    offset_minutes: Option<i64>,
    absolute_at: Option<&String>,
    due_date: &str,
) -> Option<String> {
    match rem_type {
        "relative" => {
            let offset = offset_minutes.unwrap_or(0);
            // Parse due_date as datetime or date, subtract offset minutes
            let dt = if let Ok(ndt) =
                chrono::NaiveDateTime::parse_from_str(due_date, "%Y-%m-%dT%H:%M:%S")
            {
                ndt
            } else if let Ok(nd) = chrono::NaiveDate::parse_from_str(due_date, "%Y-%m-%d") {
                nd.and_hms_opt(0, 0, 0).unwrap()
            } else {
                return None;
            };
            let trigger = dt - chrono::Duration::minutes(offset);
            Some(trigger.format("%Y-%m-%dT%H:%M:%S").to_string())
        }
        "absolute" => absolute_at.map(|s| s.clone()),
        _ => None,
    }
}

/// Generate the next instance of a recurring todo.
///
/// When a recurring todo is completed/abandoned, this function:
/// 1. Gets the rule, increments completed_count
/// 2. Checks end conditions (max_count, end_date, no more occurrences)
/// 3. Computes next_due via rrule_service::next_occurrence()
/// 4. Updates rule with new next_due and completed_count
/// 5. Clones the todo with new status='pending', due_date=next_due
/// 6. Clones sub-tasks with new parent_id
/// 7. Copies tags and scene bindings
/// 8. Copies reminders and computes trigger_at for each, inserting into reminder_queue
///
/// Returns the new todo id, or 0 if the rule has expired.
pub fn generate_next_instance(
    db: &Database,
    _completed_todo_id: i64,
    rule_id: i64,
) -> Result<i64, String> {
    // 1. Get the rule
    let mut rule = get_recurrence_rule(db, rule_id)?;
    rule.completed_count += 1;

    // 2. Check end conditions
    // max_count: the COUNT in RRULE includes all occurrences, so if completed_count >= max_count, expired
    if let Some(max) = rule.max_count {
        if rule.completed_count >= max {
            update_next_due(db, rule_id, None, rule.completed_count, true)?;
            return Ok(0);
        }
    }

    // end_date check
    if let Some(ref end_date) = rule.end_date {
        if let Some(ref next_due) = rule.next_due {
            if next_due.as_str() > end_date.as_str() {
                update_next_due(db, rule_id, None, rule.completed_count, true)?;
                return Ok(0);
            }
        }
    }

    // 3. Compute next_due
    let after_date = match &rule.next_due {
        Some(d) => d.clone(),
        None => rule.dtstart.clone(),
    };
    let next_due = match rrule_service::next_occurrence(&rule.rrule, &after_date) {
        Ok(d) => d,
        Err(_) => {
            // No more occurrences
            update_next_due(db, rule_id, None, rule.completed_count, true)?;
            return Ok(0);
        }
    };

    // Check end_date against new next_due
    if let Some(ref end_date) = rule.end_date {
        if next_due.as_str() > end_date.as_str() {
            update_next_due(db, rule_id, None, rule.completed_count, true)?;
            return Ok(0);
        }
    }

    // 4. Update rule with new next_due and completed_count
    update_next_due(
        db,
        rule_id,
        Some(&next_due),
        rule.completed_count,
        false,
    )?;

    // 5. Clone the todo
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO todos (title, description, status, priority, group_id, parent_id, sort_order, due_date, recurrence_rule_id)
         SELECT title, description, 'pending', priority, group_id, parent_id, sort_order, ?1, ?2
         FROM todos WHERE id = ?3 AND parent_id IS NULL",
        params![next_due, rule_id, _completed_todo_id],
    )
    .map_err(|e| format!("Clone todo: {}", e))?;

    let new_todo_id = conn.last_insert_rowid();

    // 6. Clone sub-tasks
    conn.execute(
        "INSERT INTO todos (title, description, status, priority, group_id, parent_id, sort_order, due_date, recurrence_rule_id)
         SELECT title, description, 'pending', priority, group_id, ?1, sort_order, ?2, NULL
         FROM todos WHERE parent_id = ?3",
        params![new_todo_id, next_due, _completed_todo_id],
    )
    .map_err(|e| format!("Clone subtasks: {}", e))?;

    // 7. Copy tags
    conn.execute(
        "INSERT INTO todo_tags (todo_id, tag_id)
         SELECT ?1, tag_id FROM todo_tags WHERE todo_id = ?2",
        params![new_todo_id, _completed_todo_id],
    )
    .map_err(|e| format!("Copy tags: {}", e))?;

    // Copy tags to sub-tasks as well
    let subtask_pairs: Vec<(i64, i64)> = {
        let old_subs: Vec<i64> = {
            let mut s = conn
                .prepare("SELECT id FROM todos WHERE parent_id = ?1 ORDER BY sort_order")
                .map_err(|e| format!("Prepare old subs: {}", e))?;
            let rows = s
                .query_map(params![_completed_todo_id], |row| row.get(0))
                .map_err(|e| format!("Query old subs: {}", e))?;
            rows.filter_map(|r| r.ok()).collect()
        };
        let new_subs: Vec<i64> = {
            let mut s = conn
                .prepare("SELECT id FROM todos WHERE parent_id = ?1 ORDER BY sort_order")
                .map_err(|e| format!("Prepare new subs: {}", e))?;
            let rows = s
                .query_map(params![new_todo_id], |row| row.get(0))
                .map_err(|e| format!("Query new subs: {}", e))?;
            rows.filter_map(|r| r.ok()).collect()
        };
        old_subs
            .into_iter()
            .zip(new_subs.into_iter())
            .collect()
    };

    for (old_sub_id, new_sub_id) in &subtask_pairs {
        conn.execute(
            "INSERT INTO todo_tags (todo_id, tag_id)
             SELECT ?1, tag_id FROM todo_tags WHERE todo_id = ?2",
            params![new_sub_id, old_sub_id],
        )
        .map_err(|e| format!("Copy subtask tags: {}", e))?;
    }

    // 8. Copy scene bindings
    conn.execute(
        "INSERT INTO todo_scene_bindings (todo_id, scene_id)
         SELECT ?1, scene_id FROM todo_scene_bindings WHERE todo_id = ?2",
        params![new_todo_id, _completed_todo_id],
    )
    .map_err(|e| format!("Copy scene bindings: {}", e))?;

    // Copy scene bindings to sub-tasks
    for (old_sub_id, new_sub_id) in &subtask_pairs {
        conn.execute(
            "INSERT INTO todo_scene_bindings (todo_id, scene_id)
             SELECT ?1, scene_id FROM todo_scene_bindings WHERE todo_id = ?2",
            params![new_sub_id, old_sub_id],
        )
        .map_err(|e| format!("Copy subtask scene bindings: {}", e))?;
    }

    // 9. Copy reminders from original and compute trigger_at, insert into reminder_queue
    let mut reminder_stmt = conn
        .prepare(
            "SELECT id, type, offset_minutes, absolute_at, notify_in_app, notify_system, enabled
             FROM reminders WHERE todo_id = ?1 AND enabled = 1",
        )
        .map_err(|e| format!("Prepare reminders: {}", e))?;

    let reminders: Vec<(i64, String, Option<i64>, Option<String>, bool, bool)> = reminder_stmt
        .query_map(params![_completed_todo_id], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<i64>>(2)?,
                row.get::<_, Option<String>>(3)?,
                row.get::<_, i64>(4).map(|v| v != 0)?,
                row.get::<_, i64>(5).map(|v| v != 0)?,
            ))
        })
        .map_err(|e| format!("Query reminders: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    drop(reminder_stmt);

    for (old_reminder_id, rem_type, offset_minutes, absolute_at, _notify_in_app, _notify_system) in &reminders {
        // Insert reminder for new todo
        conn.execute(
            "INSERT INTO reminders (todo_id, type, offset_minutes, absolute_at, label, notify_in_app, notify_system, enabled)
             SELECT ?1, type, offset_minutes, absolute_at, label, notify_in_app, notify_system, enabled
             FROM reminders WHERE id = ?2",
            params![new_todo_id, old_reminder_id],
        )
        .map_err(|e| format!("Copy reminder: {}", e))?;

        let new_reminder_id = conn.last_insert_rowid();

        // Compute trigger_at
        let trigger_at = compute_trigger_at(
            rem_type,
            *offset_minutes,
            absolute_at.as_ref(),
            &next_due,
        );

        if let Some(trigger_at) = trigger_at {
            conn.execute(
                "INSERT INTO reminder_queue (todo_id, reminder_id, trigger_at, status)
                 VALUES (?1, ?2, ?3, 'pending')",
                params![new_todo_id, new_reminder_id, trigger_at],
            )
            .map_err(|e| format!("Insert reminder queue: {}", e))?;
        }
    }

    Ok(new_todo_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    use crate::services::todo_repo;

    fn setup_db() -> Database {
        let tmp = NamedTempFile::new().unwrap();
        Database::open(tmp.path()).unwrap()
    }

    #[test]
    fn test_create_recurrence_rule() {
        let db = setup_db();
        // Use dtstart close to 2000-01-01 (next_occurrence starts from 2000-01-01 internally)
        // so the iteration is minimal
        let rule = create_recurrence_rule(
            &db,
            CreateRecurrenceRule {
                rrule: "FREQ=DAILY".to_string(),
                dtstart: "2000-01-01".to_string(),
                end_date: None,
                max_count: None,
            },
        )
        .unwrap();

        assert_eq!(rule.rrule, "FREQ=DAILY");
        assert_eq!(rule.dtstart, "2000-01-01");
        assert!(!rule.expired);
        assert_eq!(rule.completed_count, 0);
        assert!(rule.next_due.is_some());
        assert_eq!(rule.next_due.unwrap(), "2000-01-02");
    }

    #[test]
    fn test_invalid_rrule_rejected() {
        let db = setup_db();
        let result = create_recurrence_rule(
            &db,
            CreateRecurrenceRule {
                rrule: "FREQ=INVALID".to_string(),
                dtstart: "2025-01-01".to_string(),
                end_date: None,
                max_count: None,
            },
        );
        assert!(result.is_err());
    }

    #[test]
    fn test_generate_next_instance() {
        let db = setup_db();

        // Use dtstart close to 2000-01-01 because next_occurrence starts from that date
        // internally and iterates forward. Using dates near 2000 keeps the test fast.
        let dtstart = "2000-01-01".to_string();
        let due_day2 = "2000-01-02".to_string();
        let due_day3 = "2000-01-03".to_string();
        let due_day4 = "2000-01-04".to_string();

        // Create a todo
        let todo = todo_repo::create_todo(
            &db,
            CreateTodo {
                title: "Recurring task".to_string(),
                description: Some("A test recurring task".to_string()),
                priority: Some("high".to_string()),
                group_id: None,
                parent_id: None,
                due_date: Some(dtstart.clone()),
            },
        )
        .unwrap();

        // Insert rule directly with known next_due
        let conn = db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO recurrence_rules (rrule, dtstart, next_due, end_date, max_count, completed_count, expired)
             VALUES ('FREQ=DAILY', ?1, ?2, NULL, 3, 0, 0)",
            params![dtstart, due_day2],
        ).unwrap();
        let rule_id = conn.last_insert_rowid();
        // Also assign rule to the todo while holding the lock
        conn.execute(
            "UPDATE todos SET recurrence_rule_id = ?1 WHERE id = ?2",
            params![rule_id, todo.id],
        ).unwrap();
        // Mark the original todo as completed while still holding the lock
        conn.execute(
            "UPDATE todos SET status = 'completed', completed_at = datetime('now') WHERE id = ?1",
            params![todo.id],
        ).unwrap();
        drop(conn);

        // Generate next instance (1st of 3)
        let new_id = generate_next_instance(&db, todo.id, rule_id).unwrap();
        assert!(new_id > 0);

        // Verify the new todo exists with correct fields
        let new_todo = todo_repo::get_todo(&db, new_id).unwrap();
        assert_eq!(new_todo.title, "Recurring task");
        assert_eq!(new_todo.status, "pending");
        assert_eq!(new_todo.priority, "high");
        assert_eq!(new_todo.description, Some("A test recurring task".to_string()));
        assert_eq!(new_todo.due_date, Some(due_day3));
        assert_eq!(new_todo.recurrence_rule_id, Some(rule_id));

        // Verify rule state
        let updated_rule = get_recurrence_rule(&db, rule_id).unwrap();
        assert_eq!(updated_rule.completed_count, 1);
        assert!(!updated_rule.expired);

        // Generate 2nd instance
        let new_id2 = generate_next_instance(&db, new_id, rule_id).unwrap();
        assert!(new_id2 > 0);
        let new_todo2 = todo_repo::get_todo(&db, new_id2).unwrap();
        assert_eq!(new_todo2.due_date, Some(due_day4));

        // Generate 3rd instance - should expire (max_count=3, completed_count reaches 3)
        let new_id3 = generate_next_instance(&db, new_id2, rule_id).unwrap();
        assert_eq!(new_id3, 0, "Should return 0 when rule is expired");

        let expired_rule = get_recurrence_rule(&db, rule_id).unwrap();
        assert!(expired_rule.expired);
    }

    #[test]
    fn test_compute_trigger_at_relative() {
        // Relative reminder: 60 minutes before due date
        let result = compute_trigger_at(
            "relative",
            Some(60),
            None,
            "2025-01-15T10:00:00",
        );
        assert_eq!(result, Some("2025-01-15T09:00:00".to_string()));

        // Relative reminder: 1440 minutes (1 day) before
        let result = compute_trigger_at(
            "relative",
            Some(1440),
            None,
            "2025-01-15T10:00:00",
        );
        assert_eq!(result, Some("2025-01-14T10:00:00".to_string()));

        // Date-only due date
        let result = compute_trigger_at("relative", Some(30), None, "2025-01-15");
        assert_eq!(result, Some("2025-01-14T23:30:00".to_string()));
    }

    #[test]
    fn test_compute_trigger_at_absolute() {
        // Absolute reminder: fixed time
        let result = compute_trigger_at(
            "absolute",
            None,
            Some(&"2025-01-15T09:00:00".to_string()),
            "2025-01-15T10:00:00",
        );
        assert_eq!(result, Some("2025-01-15T09:00:00".to_string()));

        // Absolute with no absolute_at => None
        let result = compute_trigger_at("absolute", None, None, "2025-01-15");
        assert_eq!(result, None);
    }

    #[test]
    fn test_update_next_due() {
        let db = setup_db();
        // Insert directly to avoid slow next_occurrence
        let conn = db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO recurrence_rules (rrule, dtstart, next_due, end_date, max_count, completed_count, expired)
             VALUES ('FREQ=WEEKLY', '2025-01-06', '2025-01-13', NULL, NULL, 0, 0)",
            params![],
        ).unwrap();
        let rule_id = conn.last_insert_rowid();
        drop(conn);

        update_next_due(&db, rule_id, Some("2099-01-10"), 5, false).unwrap();

        let updated = get_recurrence_rule(&db, rule_id).unwrap();
        assert_eq!(updated.next_due, Some("2099-01-10".to_string()));
        assert_eq!(updated.completed_count, 5);
        assert!(!updated.expired);
    }

    #[test]
    fn test_delete_recurrence_rule() {
        let db = setup_db();
        // Insert directly to avoid slow next_occurrence
        let conn = db.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO recurrence_rules (rrule, dtstart, next_due, end_date, max_count, completed_count, expired)
             VALUES ('FREQ=WEEKLY', '2025-01-06', '2025-01-13', NULL, NULL, 0, 0)",
            params![],
        ).unwrap();
        let rule_id = conn.last_insert_rowid();
        drop(conn);

        delete_recurrence_rule(&db, rule_id).unwrap();
        assert!(get_recurrence_rule(&db, rule_id).is_err());
    }
}
