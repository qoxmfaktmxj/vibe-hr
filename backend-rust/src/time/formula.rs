use chrono::{DateTime, Duration, NaiveDate, TimeZone, Utc};
use chrono_tz::Asia::Seoul;

#[derive(Debug, PartialEq, Default)]
pub struct WorkMinutes {
    pub actual: i32,
    pub regular: i32,
    pub overtime: i32,
    pub night: i32,
    pub holiday_work: i32,
    pub holiday_overtime: i32,
    pub holiday_night: i32,
    pub holiday: bool,
}
fn local(day: NaiveDate, hour: u32) -> DateTime<Utc> {
    let local = day.and_hms_opt(hour, 0, 0).expect("valid fixed hour");
    // Match ZonedDateTime.atZone: prefer the earlier offset for overlaps,
    // and move through a local clock gap if a historical rule requires it.
    if let Some(value) = Seoul.from_local_datetime(&local).earliest() {
        return value.to_utc();
    }
    let before = Seoul
        .from_local_datetime(&(local - Duration::hours(12)))
        .earliest()
        .expect("outside transition");
    (before + Duration::hours(12)).to_utc()
}
pub fn calculate(
    start: Option<DateTime<Utc>>,
    end: Option<DateTime<Utc>>,
    status: &str,
    break_min: i32,
    expected: i32,
    holiday: bool,
    workday: bool,
) -> WorkMinutes {
    let (Some(start), Some(end)) = (start, end) else {
        return WorkMinutes::default();
    };
    if end <= start || matches!(status, "absent" | "leave") {
        return WorkMinutes::default();
    }
    let actual = ((end - start).num_minutes() as i32 - break_min.max(0)).max(0);
    let mut night = 0;
    let mut day = start.with_timezone(&Seoul).date_naive();
    let last = end.with_timezone(&Seoul).date_naive();
    while day <= last {
        let tomorrow = day.succ_opt().expect("valid following workday");
        for (from, to) in [
            (local(day, 0), local(day, 6)),
            (local(day, 22), local(tomorrow, 0)),
        ] {
            night += (end.min(to) - start.max(from)).num_minutes().max(0) as i32;
        }
        day = tomorrow;
    }
    if holiday || !workday {
        WorkMinutes {
            actual,
            holiday_work: actual.min(480),
            holiday_overtime: (actual - 480).max(0),
            holiday_night: night,
            holiday: true,
            ..Default::default()
        }
    } else {
        WorkMinutes {
            actual,
            regular: actual.min(expected.max(0)),
            overtime: (actual - expected.max(0)).max(0),
            night,
            ..Default::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn spring_work_minutes() {
        let day = NaiveDate::from_ymd_opt(2026, 8, 3).unwrap();
        let start = Some(local(day, 21));
        let end = Some(local(day.succ_opt().unwrap(), 7));
        let actual = calculate(start, end, "present", 60, 480, false, true);
        assert_eq!(
            (actual.actual, actual.regular, actual.overtime, actual.night),
            (540, 480, 60, 480)
        );
        let holiday = calculate(
            Some(local(day, 9)),
            Some(local(day, 20)),
            "present",
            60,
            480,
            true,
            false,
        );
        assert_eq!(
            (
                holiday.actual,
                holiday.holiday_work,
                holiday.holiday_overtime,
                holiday.holiday_night,
                holiday.holiday
            ),
            (600, 480, 120, 0, true)
        );
        assert_eq!(
            calculate(start, end, "leave", 60, 480, false, true),
            WorkMinutes::default()
        );
    }
}
