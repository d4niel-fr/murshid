/** Murshid for Schools / licensing endpoints used by the web app (onboarding, plans, School page). */
import { API_BASE } from './api';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { request } from './http';

// timeouts, retries for safe requests, readable errors (see lib/http.ts)
function req<T>(path: string, init: { method?: string; body?: unknown; devUser?: string; idempotencyKey?: string; timeoutMs?: number } = {}): Promise<T> {
  return request<T>(path, {
    method: (init.method ?? 'GET') as 'GET' | 'POST' | 'DELETE', body: init.body, idempotencyKey: init.idempotencyKey, timeoutMs: init.timeoutMs,
    headers: init.devUser ? { 'x-dev-user': init.devUser, 'x-dev-user-id': init.devUser } : undefined,
  });
}

export interface Plan { id: string; audience: 'families' | 'schools'; name: string; priceAed: number; per: 'month' | 'student-year'; yearlyAed?: number; rangeAed?: [number, number]; featured: boolean; blurb: string; features: string[] }
export const getPlans = () => req<{ families: Plan[]; schools: Plan[] }>('/plans');
export const getMsAccounts = (org = 'demo-school') => req<{ org: { name: string; domain: string } | null; items: { id: string; name: string; email: string; role: string; code: string }[] }>(`/auth/microsoft/accounts?org=${org}&role=student`);
export const startMs = (org = 'demo-school') => req<{ url: string; state: string }>(`/auth/microsoft/authorize?org=${org}&role=student`);
export const onboard = (body: Record<string, unknown>, idempotencyKey?: string) => req<any>('/onboarding', { method: 'POST', body, idempotencyKey });
export const getSchool = (devUser: string) => req<any>('/student/school', { devUser });

/** Fallback plans so the pricing page still renders with the API down (same numbers as the API). */
export const FALLBACK_PLANS: { families: Plan[]; schools: Plan[] } = {
  families: [
    { id: 'single', audience: 'families', name: 'Single', priceAed: 29, per: 'month', yearlyAed: 249, featured: false, blurb: 'For one student: a parent buying for their child, or a student buying for themselves. The only plan sold online.', features: ['A weekly plan around classes, tests, homework and sport', 'Ask Murshid, with how it worked this out under every reply', 'Flashcards, notes, focus timer, quizzes and topic tracker', 'Opportunities, applications and CV', 'Weekly summary for a parent (opt-in)'] },
  ],
  schools: [
    { id: 'school', audience: 'schools', name: 'Murshid for Schools', priceAed: 150, per: 'student-year', rangeAed: [120, 180], featured: true, blurb: 'Your school licenses Murshid for its students. Teachers post work directly or connect Microsoft 365.', features: ['Every student gets Murshid, linked to their school', 'Sign in with Microsoft (Entra ID); Teams classes and assignments sync', 'Teachers post assignments that land in every student\u2019s plan', 'Class progress report with at-risk flags', 'Best day to set homework, with on-time likelihood', 'Automatic weekly report from every student', 'Separate school tenant: school data never mixes with family accounts'] },
  ],
};

/** Buy the Single plan (demo: no card is charged). The idempotency key makes a double-click or a retry safe. */
export interface CheckoutResult { orderId: string; plan: 'single'; billing: 'monthly' | 'yearly'; amountAed: number; status: 'active'; renewsAt: string }
export const checkout = (body: { plan: 'single'; billing: 'monthly' | 'yearly'; name: string; email: string; who: 'parent' | 'student'; studentName?: string; grade: number }, idempotencyKey: string) =>
  req<CheckoutResult>('/billing/checkout', { method: 'POST', body, idempotencyKey });

/** Answer a teacher's built-in form. One response per student: sending again updates it. */
export interface FormResponse { answers: Record<string, string>; submittedAt: string; updatedAt: string }
export const answerForm = (devUser: string, assignmentId: string, answers: Record<string, string>, idempotencyKey: string) =>
  req<{ assignmentId: string; status: 'submitted'; updated: boolean; response: FormResponse }>(`/student/assignments/${encodeURIComponent(assignmentId)}/responses`, { method: 'POST', body: { answers }, devUser, idempotencyKey });

/** Cancel the Single plan on the server (it stays usable until the renewal date). */
export const cancelPlan = (orderId: string, email: string, idempotencyKey: string) =>
  req<{ orderId: string; status: 'canceled' }>('/billing/cancel', { method: 'POST', body: { orderId, email }, idempotencyKey });

/* ---------- classroom: files, hand-ins, messages, stream ---------- */
export type FileKind = 'image' | 'pdf' | 'slides' | 'doc' | 'sheet' | 'text';
export interface FileRef { id: string; name: string; mime: string; kind: FileKind; size: number; url: string }
export interface HandIn { text: string; files: FileRef[]; state: 'handed_in' | 'returned' | 'marked'; late: boolean; submittedAt: string; updatedAt: string; versions: number; grade: number | null; scores: Record<string, number> | null; feedback: string | null; reviewedAt: string | null; reviewer: string | null }
export interface Message { id: string; from: 'student' | 'teacher'; authorId: string; name: string; text: string; files: FileRef[]; at: string }
export interface AssignmentCard {
  id: string; classId: string; title: string; subject: string; teacher: string; instructions: string | null; setDate: string; dueDate: string; dueTime: string; setLabel: string; dueLabel: string; minutes: number;
  format: 'task' | 'form' | 'google_form' | 'microsoft_form'; formUrl: string | null; questions: { id: string; type: 'short' | 'long' | 'choice'; prompt: string; options?: string[]; required: boolean }[] | null; posted: boolean;
  attachments: FileRef[]; links: { url: string; label: string }[]; photosRequired: boolean; rubric: { id: string; label: string; points: number }[] | null;
}
export interface AssignmentDetail { assignment: AssignmentCard; handIn: HandIn | null; status: 'assigned' | 'overdue' | 'handed_in' | 'returned' | 'marked'; overdue: boolean; response: FormResponse | null; messages: Message[]; unread: number; reminders: Reminder[] }
export interface Reminder { id: string; itemId: string; title: string; subject: string; teacherName: string; note: string | null; dueDate: string; at: string; dismissed: boolean }
export interface Reply { id: string; from: 'student' | 'teacher'; authorId: string; name: string; text: string; at: string }
export interface Announcement { id: string; streamId: string; authorName: string; text: string; files: FileRef[]; links: { url: string; label: string }[]; pinned: boolean; at: string; replies: Reply[]; className?: string; subject?: string }

/** A file's address in the browser (the API sits behind /api). */
export const fileUrl = (f: Pick<FileRef, 'url'>) => `${API_BASE}${f.url}`;
const sid = (id: string) => encodeURIComponent(id);
export const uploadFile = (devUser: string, file: { name: string; mime: string; data: string }) => req<FileRef>('/files', { method: 'POST', body: file, devUser, timeoutMs: 60_000 });
export const getAssignment = (devUser: string, id: string) => req<AssignmentDetail>(`/student/assignments/${sid(id)}`, { devUser });
export const handIn = (devUser: string, id: string, body: { text: string; fileIds: string[] }, idempotencyKey: string) =>
  req<{ assignmentId: string; handIn: HandIn; updated: boolean }>(`/student/assignments/${sid(id)}/handin`, { method: 'POST', body, devUser, idempotencyKey });
export const undoHandIn = (devUser: string, id: string) => req<{ undone: true }>(`/student/assignments/${sid(id)}/handin`, { method: 'DELETE', devUser });
export const sendMessage = (devUser: string, id: string, body: { text: string; fileIds: string[] }, idempotencyKey: string) =>
  req<Message>(`/student/assignments/${sid(id)}/messages`, { method: 'POST', body, devUser, idempotencyKey });
export const getStream = (devUser: string) => req<{ announcements: Announcement[]; reminders: Reminder[] }>('/student/stream', { devUser });
export const replyToAnnouncement = (devUser: string, id: string, text: string, idempotencyKey: string) =>
  req<Reply>(`/student/announcements/${sid(id)}/replies`, { method: 'POST', body: { text }, devUser, idempotencyKey });
export const dismissReminder = (devUser: string, id: string) => req<{ dismissed: true }>(`/student/reminders/${sid(id)}/dismiss`, { method: 'POST', body: {}, devUser });
