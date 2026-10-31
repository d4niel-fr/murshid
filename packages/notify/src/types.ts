// Local copies of the core domain types from docs/CONTRACT.md (only the fields notify needs).
// Swap for @murshid/core imports when it lands (README "Integration notes").

export type Channel = 'push' | 'email' | 'whatsapp' | 'in_app';

export interface Student {
  id: string;
  full_name: string;
  preferred_name?: string | null;
  date_of_birth?: string | null;
  grade: number;
  emirate?: string | null;
}

export interface Guardian {
  id: string;
  student_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  relation?: string | null;
  consent_status: 'pending' | 'granted' | 'revoked';
  verified_at?: string | null;
}

export interface Task {
  id: string;
  student_id: string;
  title: string;
  kind: 'study' | 'assignment' | 'application' | 'activity' | 'habit';
  due_at: string | null;
  status: 'todo' | 'doing' | 'done' | 'skipped';
}

export interface Opportunity {
  id: string;
  title: string;
  organizer: string;
  type: string;
  url?: string | null;
  deadline?: string | null;
  last_seen_at?: string | null;
  status?: 'open' | 'closed' | 'unknown';
}

export interface Application {
  id: string;
  student_id: string;
  opportunity_id: string;
  status: 'saved' | 'preparing' | 'submitted' | 'accepted' | 'rejected';
  checklist: { item: string; done: boolean }[];
}

export interface Goal {
  id: string;
  student_id: string;
  title: string;
  category: string;
  status: 'active' | 'done' | 'paused';
  progress: number;
  target_date?: string | null;
}

export interface CalendarEvent {
  id: string;
  student_id: string;
  title: string;
  start_at: string;
  end_at?: string | null;
}

export interface Material {
  id: string;
  course_id: string;
  title: string;
  kind: 'note' | 'assignment' | 'announcement' | 'exam';
  due_at?: string | null;
}

export type NotificationStatus = 'scheduled' | 'sent' | 'deferred' | 'blocked' | 'failed';

/** Mirrors the Notification row. `dedupe_key` is a notify-side extension (see README). */
export interface NotificationRecord {
  id: string;
  student_id: string;
  channel: Channel;
  template: string;
  payload: Record<string, unknown>;
  scheduled_at: string;
  sent_at: string | null;
  status: NotificationStatus;
  dedupe_key?: string;
  recipient_kind?: 'student' | 'guardian';
  error?: string;
}

/** Where a message goes. Addresses come from profile/guardian rows; device tokens from the app. */
export interface Recipient {
  kind: 'student' | 'guardian';
  studentId: string;
  guardianId?: string;
  name: string;
  email?: string | null;
  /** E.164, e.g. +971501234567 */
  phone?: string | null;
  expoPushTokens?: string[];
  /** WhatsApp requires an explicit, recorded opt-in. */
  whatsappOptIn?: { optedIn: boolean; at?: string | null } | null;
  locale?: 'en' | 'ar';
}
