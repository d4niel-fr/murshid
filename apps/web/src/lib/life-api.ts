/** School life in the student app: feelings check-in, timetable, attendance and leave, points, polls, dates, reports. */
import { request } from './http';

const h = (devUser: string) => ({ 'x-dev-user': devUser, 'x-dev-user-id': devUser });
const get = <T,>(devUser: string, path: string) => request<T>(path, { headers: h(devUser) });
const send = <T,>(devUser: string, path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) => request<T>(path, { method, body, headers: h(devUser) });

export type Mood = 1 | 2 | 3 | 4 | 5;
export interface Emotion { id: string; mood: Mood; en: string; ar: string; simple?: boolean }
export interface CheckIn { id: string; date: string; at: string; mood: Mood; words: string[]; note: string; share: 'teacher' | 'private'; talkTo: string | null; demo?: boolean }
export interface Feelings {
  emotions: Emotion[]; today: CheckIn | null; history: CheckIn[]; weeks: { from: string; to: string; average: number | null; count: number }[];
  words: { id: string; n: number }[]; streak: number; prompt: { id: string; question: string; by: string } | null; teachers: { id: string; name: string }[];
}
export const getFeelings = (u: string) => get<Feelings>(u, '/student/feelings');
export const checkIn = (u: string, body: { mood: Mood; words: string[]; note: string; share: 'teacher' | 'private'; talkTo: string | null }) => send<CheckIn>(u, '/student/feelings', 'POST', body);
export const deleteCheckIn = (u: string, id: string) => send<{ deleted: true }>(u, `/student/feelings/${encodeURIComponent(id)}`, 'DELETE');

export interface Lesson { day: number; start: string; end: string; room: string; link: string | null; classId: string; className: string; subject: string; subjectName: string; teacher: string; nextDay?: boolean }
export interface Timetable { lessons: Lesson[]; today: number; nowMinutes: number; current: Lesson | null; next: Lesson | null; clashes: { day: number; a: string; b: string; at: string }[]; generated: boolean }
export const getTimetable = (u: string) => get<Timetable>(u, '/student/timetable');

export type Mark = 'present' | 'late' | 'absent' | 'excused';
export type LeaveReason = 'illness' | 'appointment' | 'family' | 'religious' | 'competition' | 'other';
export interface Leave { id: string; from: string; to: string; reason: LeaveReason; note: string; by: 'student' | 'parent'; byName: string; status: 'pending' | 'approved' | 'declined'; reply: string; at: string }
export interface Attendance { term: string; from: string; rate: number | null; classes: { id: string; name: string; subjectName: string; rate: number | null; absent: number; late: number; excused: number; recent: { date: string; mark: Mark }[] }[]; leave: Leave[] }
export const getAttendance = (u: string) => get<Attendance>(u, '/student/attendance');
export const askLeave = (u: string, body: { from: string; to: string; reason: LeaveReason; note: string }) => send<Leave>(u, '/student/leave', 'POST', body);
export const withdrawLeave = (u: string, id: string) => send<{ withdrawn: true }>(u, `/student/leave/${encodeURIComponent(id)}`, 'DELETE');

export interface Points {
  term: string; total: number; week: number; byReason: { id: string; label: string; n: number }[];
  byClass: { id: string; name: string; subjectName: string; n: number }[];
  recent: { id: string; reason: string; label: string; points: number; note: string; at: string; byName: string; className: string }[];
}
export const getPoints = (u: string) => get<Points>(u, '/student/points');

export interface Poll { id: string; kind: 'choice' | 'exit' | 'confidence'; question: string; options: string[]; anonymous: boolean; open: boolean; at: string; responses: number; counts: number[] | null; className: string; mine: { choice: number | null; text: string; at: string } | null }
export const getPolls = (u: string) => get<{ polls: Poll[] }>(u, '/student/polls');
export const answerPoll = (u: string, id: string, body: { choice: number | null; text: string }) => send<Poll>(u, `/student/polls/${encodeURIComponent(id)}/answer`, 'POST', body);

export type EventKind = 'holiday' | 'exam' | 'trip' | 'event' | 'meeting' | 'sport';
export interface SchoolEvent { id: string; title: string; date: string; end: string; kind: EventKind; grades: number[]; note: string }
export const getEvents = (u: string) => get<{ today: string; upcoming: SchoolEvent[]; past: SchoolEvent[] }>(u, '/student/events');

export interface Reports {
  student: { name: string; section: string; grade: number | null; school: string }; current: string;
  terms: { term: string; subjects: { classId: string; className: string; subjectName: string; teacher: string; comment: string; effort: number; effortLabel: string; average: number | null; attendance: number | null; updatedAt: string }[] }[];
}
export const getReports = (u: string) => get<Reports>(u, '/student/reports');

export interface TodayAtSchool { date: string; parent?: boolean; checkedIn: boolean | null; mood: Mood | null; prompt: { question: string } | null; current: Lesson | null; next: Lesson | null; lessonsLeft: number; polls: number; pointsWeek: number; event: SchoolEvent | null }
export const getTodayAtSchool = (u: string) => get<TodayAtSchool>(u, '/student/today-at-school');

/** The five faces of the check-in, worst to best. */
export const MOODS: { mood: Mood; face: string; en: string; ar: string; tone: string }[] = [
  { mood: 1, face: '😣', en: 'Awful', ar: 'سيئ جداً', tone: 'var(--danger)' },
  { mood: 2, face: '😕', en: 'Not great', ar: 'لست بخير', tone: 'var(--warning)' },
  { mood: 3, face: '😐', en: 'Okay', ar: 'عادي', tone: 'var(--text-muted)' },
  { mood: 4, face: '🙂', en: 'Good', ar: 'جيد', tone: 'var(--brand)' },
  { mood: 5, face: '😄', en: 'Great', ar: 'رائع', tone: 'var(--success)' },
];
