use std::str::FromStr;

use chrono::{DateTime, Local, NaiveDate, NaiveDateTime, TimeZone};
use rrule::{
    Frequency, NWeekday, RRule, RRuleSet, Tz, Unvalidated, Weekday,
};

use crate::models::{RruleDescribeResult, SimplifiedRecurrenceInput};

/// Parse a date string (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS) into a DateTime<Tz>.
fn parse_dt(dt_str: &str) -> Result<DateTime<Tz>, String> {
    // Try full datetime with seconds first
    if let Ok(ndt) = NaiveDateTime::parse_from_str(dt_str, "%Y-%m-%dT%H:%M:%S") {
        return Local
            .from_local_datetime(&ndt)
            .single()
            .map(|dt| dt.with_timezone(&Tz::Asia__Shanghai))
            .ok_or_else(|| format!("Parse: ambiguous datetime '{}'", dt_str));
    }
    // Try datetime without seconds (HH:MM)
    if let Ok(ndt) = NaiveDateTime::parse_from_str(dt_str, "%Y-%m-%dT%H:%M") {
        return Local
            .from_local_datetime(&ndt)
            .single()
            .map(|dt| dt.with_timezone(&Tz::Asia__Shanghai))
            .ok_or_else(|| format!("Parse: ambiguous datetime '{}'", dt_str));
    }
    // Try date only
    if let Ok(nd) = NaiveDate::parse_from_str(dt_str, "%Y-%m-%d") {
        let ndt = nd.and_hms_opt(0, 0, 0).unwrap();
        return Ok(Local
            .from_local_datetime(&ndt)
            .single()
            .map(|dt| dt.with_timezone(&Tz::Asia__Shanghai))
            .unwrap());
    }
    Err(format!("Parse: invalid date format '{}'", dt_str))
}

/// Validate an RRULE string. Returns Ok(()) if valid.
pub fn validate_rrule(rrule_str: &str, dtstart: &str) -> Result<(), String> {
    let dt_start = parse_dt(dtstart)?;
    let rrule: RRule<Unvalidated> =
        RRule::from_str(rrule_str).map_err(|e| format!("Parse: {}", e))?;
    rrule
        .validate(dt_start)
        .map_err(|e| format!("Validate: {}", e))?;
    Ok(())
}

/// Parse RRULE string and return a validated RRule<Unvalidated> + RRuleSet.
fn parse_rrule_set(rrule_str: &str, dtstart: &str) -> Result<(RRule<Unvalidated>, RRuleSet), String> {
    let dt_start = parse_dt(dtstart)?;
    let rrule: RRule<Unvalidated> =
        RRule::from_str(rrule_str).map_err(|e| format!("Parse: {}", e))?;
    let rrule_set = rrule
        .clone()
        .build(dt_start)
        .map_err(|e| format!("Build: {}", e))?;
    Ok((rrule, rrule_set))
}

/// Convert a Weekday to its Chinese short name.
fn weekday_cn(wd: Weekday) -> &'static str {
    match wd {
        Weekday::Mon => "一",
        Weekday::Tue => "二",
        Weekday::Wed => "三",
        Weekday::Thu => "四",
        Weekday::Fri => "五",
        Weekday::Sat => "六",
        Weekday::Sun => "日",
    }
}

/// Convert an NWeekday to a Chinese description fragment.
fn nweekday_cn(nw: &NWeekday) -> String {
    match nw {
        NWeekday::Every(wd) => format!("周{}", weekday_cn(*wd)),
        NWeekday::Nth(n, wd) => {
            let cn_num = ordinal_cn(*n);
            format!("第{}个周{}", cn_num, weekday_cn(*wd))
        }
    }
}

/// Convert a number to its Chinese ordinal representation (for set position).
fn ordinal_cn(n: i16) -> String {
    let abs = n.unsigned_abs();
    match abs {
        1 => "1".to_string(),
        2 => "2".to_string(),
        3 => "3".to_string(),
        4 => "4".to_string(),
        5 => "5".to_string(),
        _ => format!("{}", abs),
    }
}

/// Parse RRULE and return Chinese description + preview dates.
pub fn describe_rrule(rrule_str: &str) -> RruleDescribeResult {
    // We need a dtstart for building, use today as a sensible default
    let dtstart = Local::now().date_naive().format("%Y-%m-%d").to_string();

    let (rrule, rrule_set) = match parse_rrule_set(rrule_str, &dtstart) {
        Ok(v) => v,
        Err(e) => {
            return RruleDescribeResult {
                valid: false,
                description: None,
                error: Some(e),
                preview_dates: vec![],
            }
        }
    };

    let description = match build_description(&rrule) {
        Ok(d) => d,
        Err(e) => {
            return RruleDescribeResult {
                valid: false,
                description: None,
                error: Some(e),
                preview_dates: vec![],
            }
        }
    };

    // Generate preview dates (up to 5)
    let preview_dates: Vec<String> = rrule_set
        .into_iter()
        .take(5)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .collect();

    RruleDescribeResult {
        valid: true,
        description: Some(description),
        error: None,
        preview_dates,
    }
}

/// Build a Chinese description from a parsed RRule.
fn build_description(rrule: &RRule<Unvalidated>) -> Result<String, String> {
    let freq = rrule.get_freq();
    let interval = rrule.get_interval();
    let by_weekday = rrule.get_by_weekday();
    let by_month = rrule.get_by_month();
    let by_month_day = rrule.get_by_month_day();
    let by_set_pos = rrule.get_by_set_pos();

    let freq_cn = match freq {
        Frequency::Yearly => "年",
        Frequency::Monthly => "月",
        Frequency::Weekly => "周",
        Frequency::Daily => "天",
        _ => return Err(format!("Describe: unsupported frequency {:?}", freq)),
    };

    let mut parts = vec![];

    // Main frequency + interval
    if interval <= 1 {
        parts.push(format!("每{}", freq_cn));
    } else {
        parts.push(format!("每{}{}{}", interval, freq_cn, if freq == Frequency::Daily { "" } else { "" }));
        // Adjust: "每2天" / "每2周" / "每2月" / "每2年"
    }

    // For weekly with by_day, describe specific weekdays
    if !by_weekday.is_empty() {
        if freq == Frequency::Weekly {
            // e.g., "每周一、三、五"
            let simple_days: Vec<String> = by_weekday
                .iter()
                .map(|nw| match nw {
                    NWeekday::Every(wd) => weekday_cn(*wd).to_string(),
                    NWeekday::Nth(_, wd) => weekday_cn(*wd).to_string(),
                })
                .collect();
            parts = vec![format!("每{}{}", freq_cn, simple_days.join("、"))];
        } else if freq == Frequency::Monthly {
            // e.g., "每月第2个周五"
            if let Some(NWeekday::Nth(n, wd)) = by_weekday.first() {
                if by_set_pos.is_empty() || by_set_pos.first() == Some(&0) {
                    parts = vec![format!(
                        "每{}第{}个周{}",
                        freq_cn,
                        ordinal_cn(*n),
                        weekday_cn(*wd)
                    )];
                }
            }
        }
    }

    // For monthly with by_month_day
    if !by_month_day.is_empty() && freq == Frequency::Monthly && by_weekday.is_empty() {
        let days: Vec<String> = by_month_day.iter().map(|d| format!("{}日", d)).collect();
        parts = vec![format!("每{}{}", freq_cn, days.join("、"))];
    }

    // For yearly with by_month + by_month_day
    if freq == Frequency::Yearly {
        if !by_month.is_empty() && !by_month_day.is_empty() {
            let month = by_month[0];
            let day = by_month_day[0];
            parts = vec![format!("每年{}月{}日", month, day)];
        } else if !by_month.is_empty() {
            let months: Vec<String> = by_month.iter().map(|m| format!("{}月", m)).collect();
            let base = if interval > 1 {
                format!("每{}年", interval)
            } else {
                "每年".to_string()
            };
            parts = vec![format!("{}{}", base, months.join("、"))];
        }
    }

    if parts.is_empty() {
        parts.push(format!("每{}", freq_cn));
    }

    Ok(parts.join(""))
}

/// Get the next occurrence date after the given date.
pub fn next_occurrence(rrule_str: &str, after_date: &str) -> Result<String, String> {
    let after_dt = parse_dt(after_date)?;

    // Use a date well before 'after' as dtstart
    let dt_start = parse_dt("2000-01-01")?;

    let rrule: RRule<Unvalidated> =
        RRule::from_str(rrule_str).map_err(|e| format!("Parse: {}", e))?;
    let rrule_set = rrule
        .build(dt_start)
        .map_err(|e| format!("Build: {}", e))?;

    // Iterate through occurrences and find the first one strictly after after_dt
    for dt in rrule_set.into_iter().take(10000) {
        if dt > after_dt {
            return Ok(dt.format("%Y-%m-%d").to_string());
        }
    }

    Err("Next occurrence: no occurrences found".to_string())
}

/// Convert simplified UI input to RRULE string.
pub fn simplified_to_rrule(input: &SimplifiedRecurrenceInput) -> Result<String, String> {
    let freq: Frequency = input
        .freq
        .to_uppercase()
        .parse()
        .map_err(|e: rrule::ParseError| format!("Parse freq: {}", e))?;

    let mut rrule = RRule::new(freq);

    if let Some(interval) = input.interval {
        if interval > 0 {
            rrule = rrule.interval(interval as u16);
        }
    }

    // by_day
    if let Some(ref days) = input.by_day {
        let weekdays: Vec<NWeekday> = if let Some(set_pos) = input.by_set_pos {
            // e.g., BYDAY=FR with BYSETPOS=2 => Nth(2, Fri)
            days.iter()
                .filter_map(|d| parse_weekday_short(d))
                .map(|wd| NWeekday::Nth(set_pos as i16, wd))
                .collect()
        } else {
            days.iter()
                .filter_map(|d| parse_weekday_short(d))
                .map(|wd| NWeekday::Every(wd))
                .collect()
        };
        if !weekdays.is_empty() {
            rrule = rrule.by_weekday(weekdays);
        }
    }

    // by_month_day
    if let Some(month_day) = input.by_month_day {
        rrule = rrule.by_month_day(vec![month_day as i8]);
    }

    // by_set_pos (only when not already used for by_day)
    if input.by_set_pos.is_some() && input.by_day.is_none() {
        if let Some(set_pos) = input.by_set_pos {
            rrule = rrule.by_set_pos(vec![set_pos as i32]);
        }
    }

    // count
    if let Some(max_count) = input.max_count {
        if max_count > 0 {
            rrule = rrule.count(max_count as u32);
        }
    }

    // until (end_date)
    if let Some(ref end_date) = input.end_date {
        let dt = parse_dt(end_date)?;
        rrule = rrule.until(dt);
    }

    // Validate by building with a default dtstart
    let dt_start = parse_dt("2025-01-01")?;
    let validated = rrule
        .validate(dt_start)
        .map_err(|e| format!("Validate: {}", e))?;

    Ok(validated.to_string())
}

/// Parse a short weekday string (MO, TU, WE, TH, FR, SA, SU) into Weekday.
fn parse_weekday_short(s: &str) -> Option<Weekday> {
    match s.to_uppercase().as_str() {
        "MO" => Some(Weekday::Mon),
        "TU" => Some(Weekday::Tue),
        "WE" => Some(Weekday::Wed),
        "TH" => Some(Weekday::Thu),
        "FR" => Some(Weekday::Fri),
        "SA" => Some(Weekday::Sat),
        "SU" => Some(Weekday::Sun),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_valid_rrule() {
        assert!(validate_rrule("FREQ=DAILY", "2025-01-01").is_ok());
        assert!(validate_rrule("FREQ=WEEKLY;INTERVAL=2", "2025-01-01").is_ok());
        assert!(validate_rrule(
            "FREQ=MONTHLY;BYDAY=2FR",
            "2025-01-01"
        )
        .is_ok());
        assert!(validate_rrule(
            "FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=8",
            "2025-01-01"
        )
        .is_ok());
    }

    #[test]
    fn test_validate_invalid_rrule() {
        // Invalid frequency
        assert!(validate_rrule("FREQ=INVALID", "2025-01-01").is_err());
        // Empty string
        assert!(validate_rrule("", "2025-01-01").is_err());
        // Invalid date
        assert!(validate_rrule("FREQ=DAILY", "not-a-date").is_err());
    }

    #[test]
    fn test_validate_rrule_with_datetime_no_seconds() {
        // Frontend passes due_date as "2026-04-28T23:59"
        assert!(validate_rrule("FREQ=DAILY", "2026-04-28T23:59").is_ok());
        assert!(validate_rrule("FREQ=WEEKLY;BYDAY=MO", "2026-04-28T23:59").is_ok());
    }

    #[test]
    fn test_describe_daily() {
        let result = describe_rrule("FREQ=DAILY");
        assert!(result.valid);
        assert!(result.description.is_some());
        assert_eq!(result.description.unwrap(), "每天");
        assert!(!result.preview_dates.is_empty());

        let result = describe_rrule("FREQ=DAILY;INTERVAL=2");
        assert!(result.valid);
        let desc = result.description.unwrap();
        assert!(desc.contains("2"), "Expected interval 2 in: {}", desc);
        assert!(desc.contains("天"), "Expected '天' in: {}", desc);
    }

    #[test]
    fn test_describe_weekly_with_days() {
        let result = describe_rrule("FREQ=WEEKLY;BYDAY=MO,WE,FR");
        assert!(result.valid);
        let desc = result.description.unwrap();
        assert!(
            desc.contains("一") && desc.contains("三") && desc.contains("五"),
            "Expected weekdays in: {}",
            desc
        );
    }

    #[test]
    fn test_describe_monthly_by_day() {
        let result = describe_rrule("FREQ=MONTHLY;BYDAY=2FR");
        assert!(result.valid);
        let desc = result.description.unwrap();
        assert!(
            desc.contains("第2个周五"),
            "Expected '第2个周五' in: {}",
            desc
        );
    }

    #[test]
    fn test_describe_yearly() {
        let result = describe_rrule("FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=8");
        assert!(result.valid);
        let desc = result.description.unwrap();
        assert!(
            desc.contains("3月8日"),
            "Expected '3月8日' in: {}",
            desc
        );
    }

    #[test]
    fn test_simplified_to_rrule() {
        // Simple daily
        let input = SimplifiedRecurrenceInput {
            freq: "DAILY".to_string(),
            interval: Some(1),
            by_day: None,
            by_month_day: None,
            by_set_pos: None,
            end_date: None,
            max_count: None,
        };
        let result = simplified_to_rrule(&input).unwrap();
        assert!(result.contains("FREQ=DAILY"));

        // Weekly with days
        let input = SimplifiedRecurrenceInput {
            freq: "WEEKLY".to_string(),
            interval: None,
            by_day: Some(vec!["MO".to_string(), "WE".to_string(), "FR".to_string()]),
            by_month_day: None,
            by_set_pos: None,
            end_date: None,
            max_count: None,
        };
        let result = simplified_to_rrule(&input).unwrap();
        assert!(result.contains("FREQ=WEEKLY"));
        assert!(result.contains("BYDAY="));
        assert!(result.contains("MO"));
        assert!(result.contains("WE"));
        assert!(result.contains("FR"));

        // Monthly with by_set_pos + by_day
        let input = SimplifiedRecurrenceInput {
            freq: "MONTHLY".to_string(),
            interval: None,
            by_day: Some(vec!["FR".to_string()]),
            by_month_day: None,
            by_set_pos: Some(2),
            end_date: None,
            max_count: None,
        };
        let result = simplified_to_rrule(&input).unwrap();
        assert!(result.contains("FREQ=MONTHLY"));
        assert!(result.contains("BYDAY="));

        // Yearly with month and day
        let input = SimplifiedRecurrenceInput {
            freq: "YEARLY".to_string(),
            interval: None,
            by_day: None,
            by_month_day: Some(8),
            by_set_pos: None,
            end_date: None,
            max_count: None,
        };
        let result = simplified_to_rrule(&input).unwrap();
        assert!(result.contains("FREQ=YEARLY"));
        assert!(result.contains("BYMONTHDAY=8"));

        // With count
        let input = SimplifiedRecurrenceInput {
            freq: "DAILY".to_string(),
            interval: None,
            by_day: None,
            by_month_day: None,
            by_set_pos: None,
            end_date: None,
            max_count: Some(10),
        };
        let result = simplified_to_rrule(&input).unwrap();
        assert!(result.contains("COUNT=10"));
    }

    #[test]
    fn test_next_occurrence() {
        // Daily: next occurrence after 2025-01-01 should be 2025-01-02
        let result = next_occurrence("FREQ=DAILY", "2025-01-01").unwrap();
        assert_eq!(result, "2025-01-02");

        // Weekly: next occurrence after 2025-01-06 (Monday) should be 2025-01-13
        let result = next_occurrence("FREQ=WEEKLY;BYDAY=MO", "2025-01-06").unwrap();
        assert_eq!(result, "2025-01-13");

        // Every 2 days: next after 2025-01-01 should be 2025-01-03
        let result = next_occurrence("FREQ=DAILY;INTERVAL=2", "2025-01-01").unwrap();
        assert_eq!(result, "2025-01-03");
    }
}
