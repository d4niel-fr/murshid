// Synthetic data only. Dubai is UTC+4 (no DST): local = Z + 4h.
import type { Application, CalendarEvent, Goal, Guardian, Material, Opportunity, Recipient, Student, Task } from '../src/types.js';

/** Local Dubai wall time → Date. e.g. dubai('2026-10-13 10:00') */
export const dubai = (s: string) => new Date(`${s.replace(' ', 'T')}:00+04:00`);

export const aisha: Student = {
  id: 'stu-aisha',
  full_name: 'Aisha Test',
  preferred_name: 'Aisha',
  date_of_birth: '2010-03-01', // 16 in Oct 2026
  grade: 11,
  emirate: 'Dubai',
};

export const rohan: Student = { id: 'stu-rohan', full_name: 'Rohan Test', date_of_birth: '2007-01-15', grade: 12 }; // 19

export const aishaRecipient: Recipient = {
  kind: 'student',
  studentId: aisha.id,
  name: 'Aisha Test',
  email: 'aisha.test@example.com',
  phone: '+971500000001',
  expoPushTokens: ['ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'],
  whatsappOptIn: { optedIn: true, at: '2026-09-01T10:00:00Z' },
};

export const guardianGranted: Guardian = {
  id: 'gua-1',
  student_id: aisha.id,
  name: 'Mariam Test',
  email: 'mariam.test@example.com',
  phone: '+971500000002',
  relation: 'mother',
  consent_status: 'granted',
  verified_at: '2026-09-01T10:00:00Z',
};
export const guardianPending: Guardian = { ...guardianGranted, id: 'gua-2', name: 'Omar Test', relation: 'father', consent_status: 'pending', verified_at: null };

export const guardianRecipient = (g: Guardian): Recipient => ({
  kind: 'guardian',
  studentId: g.student_id,
  guardianId: g.id,
  name: g.name,
  email: g.email,
  phone: g.phone,
  whatsappOptIn: { optedIn: true, at: '2026-09-01T10:00:00Z' },
});

export const tasks: Task[] = [
  { id: 't-physics', student_id: aisha.id, title: 'Physics lab report', kind: 'assignment', due_at: dubai('2026-10-14 20:00').toISOString(), status: 'todo' },
  { id: 't-english', student_id: aisha.id, title: 'English essay draft', kind: 'assignment', due_at: dubai('2026-10-13 14:00').toISOString(), status: 'doing' },
  { id: 't-done', student_id: aisha.id, title: 'Maths worksheet', kind: 'assignment', due_at: dubai('2026-10-13 08:00').toISOString(), status: 'done' },
  { id: 't-overdue', student_id: aisha.id, title: 'Read chapter 3', kind: 'study', due_at: dubai('2026-10-09 18:00').toISOString(), status: 'todo' },
];

export const exams: Material[] = [
  { id: 'm-chem', course_id: 'c-chem', title: 'Chemistry unit test', kind: 'exam', due_at: dubai('2026-10-15 08:00').toISOString() },
];

export const events: CalendarEvent[] = [
  { id: 'e-1', student_id: aisha.id, title: 'Maths quiz', start_at: dubai('2026-10-12 09:00').toISOString() },
  { id: 'e-2', student_id: aisha.id, title: 'Chemistry unit test', start_at: dubai('2026-10-15 08:00').toISOString() }, // dup of exam
  { id: 'e-3', student_id: aisha.id, title: 'Football practice', start_at: dubai('2026-10-13 16:00').toISOString() },
];

export const opportunity: Opportunity = {
  id: 'o-1',
  title: 'Test Youth Hackathon',
  organizer: 'Test Org',
  type: 'hackathon',
  deadline: dubai('2026-10-16 23:59').toISOString(),
  status: 'open',
};

export const application: Application = {
  id: 'a-1',
  student_id: aisha.id,
  opportunity_id: opportunity.id,
  status: 'preparing',
  checklist: [
    { item: 'Form team', done: true },
    { item: 'Submit', done: false },
  ],
};

export const goals: Goal[] = [
  { id: 'g-1', student_id: aisha.id, title: 'A* in Physics', category: 'academic', status: 'active', progress: 55 },
  { id: 'g-2', student_id: aisha.id, title: 'Learn Python', category: 'skill', status: 'active', progress: 30 },
  { id: 'g-3', student_id: aisha.id, title: 'Old goal', category: 'personal', status: 'done', progress: 100 },
];
