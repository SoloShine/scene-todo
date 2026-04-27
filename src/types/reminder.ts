export interface Reminder {
  id: number;
  todo_id: number;
  type: "relative" | "absolute";
  offset_minutes: number | null;
  absolute_at: string | null;
  label: string | null;
  notify_in_app: boolean;
  notify_system: boolean;
  enabled: boolean;
}

export interface CreateReminder {
  todo_id: number;
  type: "relative" | "absolute";
  offset_minutes?: number | null;
  absolute_at?: string | null;
  label?: string | null;
  notify_in_app?: boolean | null;
  notify_system?: boolean | null;
}

export interface UpdateReminder {
  id: number;
  offset_minutes?: number | null;
  absolute_at?: string | null;
  label?: string | null;
  notify_in_app?: boolean | null;
  notify_system?: boolean | null;
  enabled?: boolean | null;
}

export interface ReminderQueueItem {
  id: number;
  todo_id: number;
  reminder_id: number;
  trigger_at: string;
  status: "pending" | "fired" | "dismissed" | "snoozed";
  snooze_until: string | null;
  todo_title: string | null;
  todo_priority: string | null;
  todo_due_date: string | null;
}

export interface SnoozeInput {
  queue_id: number;
  snooze_minutes: number;
}
