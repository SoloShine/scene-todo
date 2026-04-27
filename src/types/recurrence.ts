export interface RecurrenceRule {
  id: number;
  rrule: string;
  dtstart: string;
  next_due: string | null;
  end_date: string | null;
  max_count: number | null;
  completed_count: number;
  expired: boolean;
  created_at: string;
}

export interface CreateRecurrenceRule {
  rrule: string;
  dtstart: string;
  end_date?: string | null;
  max_count?: number | null;
}

export interface RruleDescribeResult {
  valid: boolean;
  description: string | null;
  error: string | null;
  preview_dates: string[];
}

export interface SimplifiedRecurrenceInput {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval?: number | null;
  by_day?: string[] | null;
  by_month_day?: number | null;
  by_set_pos?: number | null;
  end_date?: string | null;
  max_count?: number | null;
}
