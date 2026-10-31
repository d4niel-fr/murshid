/**
 * Form definitions for the admin portal: each entity has a zod schema (mirrors apps/api/src/admin/routes.ts, so
 * staff see errors before the request) and a field list the generic EntityForm renders.
 */
import { z } from 'zod';

export const ACTIVITY_KINDS = ['athletics', 'gym', 'hackathon', 'robotics', 'music', 'football', 'swimming'] as const;
export const ASSESSMENT_KINDS = ['quiz', 'test', 'assignment', 'exam', 'project'] as const;
export const CURRICULA = ['british', 'american', 'indian_cbse', 'ib', 'uae_moe'] as const;
export const EMIRATES = ['dubai', 'abu_dhabi', 'sharjah'] as const;
export const OPP_TYPES = ['competition', 'internship', 'scholarship', 'summer_program', 'volunteering', 'olympiad', 'mun', 'hackathon', 'course'] as const;
export const GOAL_CATS = ['academic', 'university', 'career', 'sport', 'skill', 'personal'] as const;
export const ACH_CATS = ['academic', 'award', 'sport', 'project', 'volunteering', 'work', 'certificate', 'leadership'] as const;
export const APP_STATUS = ['saved', 'preparing', 'submitted', 'accepted', 'rejected'] as const;
export const TASK_KINDS = ['study', 'assignment', 'activity', 'habit', 'application'] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const req = (label: string, max = 120) => z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
const csv = z.string().max(600).transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean));
const num = (label: string, min: number, max: number) => z.coerce.number({ message: `${label} must be a number` }).min(min, `${label} ≥ ${min}`).max(max, `${label} ≤ ${max}`);
const optNum = z.union([z.literal(''), z.coerce.number()]).transform((v) => (v === '' ? null : v));

export type FieldType = 'text' | 'number' | 'date' | 'time' | 'select' | 'textarea' | 'csv' | 'checkbox';
export interface Field { name: string; label: string; type: FieldType; options?: readonly string[]; placeholder?: string; span?: 1 | 2; hint?: string }

export interface FormDef<T extends z.ZodType = z.ZodType> { title: string; schema: T; fields: Field[] }

export const studentForm: FormDef = {
  title: 'Student',
  schema: z.object({
    name: req('Full name'), preferredName: req('Preferred name', 60), nameAr: z.string().max(120).default(''),
    grade: num('Grade', 5, 13), age: num('Age', 9, 19), school: req('School'), curriculum: z.enum(CURRICULA), emirate: z.enum(EMIRATES),
    classLabel: z.string().max(60).optional(), nationality: z.string().max(60).optional(), languages: csv, interests: csv,
  }),
  fields: [
    { name: 'name', label: 'Full name', type: 'text', span: 2 }, { name: 'preferredName', label: 'Preferred name', type: 'text' }, { name: 'nameAr', label: 'Name (Arabic)', type: 'text' },
    { name: 'grade', label: 'Grade', type: 'number' }, { name: 'age', label: 'Age', type: 'number' }, { name: 'school', label: 'School', type: 'text', span: 2 },
    { name: 'curriculum', label: 'Curriculum', type: 'select', options: CURRICULA }, { name: 'emirate', label: 'Emirate', type: 'select', options: EMIRATES },
    { name: 'classLabel', label: 'Class label', type: 'text', placeholder: 'Year 12 (Grade 11)' }, { name: 'nationality', label: 'Nationality', type: 'text' },
    { name: 'languages', label: 'Languages', type: 'csv', hint: 'comma-separated', span: 2 }, { name: 'interests', label: 'Interests', type: 'csv', hint: 'comma-separated', span: 2 },
  ],
};

export const profileForm: FormDef = {
  title: 'Profile',
  schema: z.object({
    name: req('Full name'), preferredName: req('Preferred name', 60), nameAr: z.string().max(120), grade: num('Grade', 5, 13), age: num('Age', 9, 19),
    school: req('School'), curriculum: z.enum(CURRICULA), classLabel: req('Class label', 60), emirate: z.enum(EMIRATES), nationality: z.string().max(60),
    languages: csv, interests: csv, studyStreakDays: num('Study streak', 0, 1000),
  }),
  fields: [...studentForm.fields.filter((f) => f.name !== 'classLabel'), { name: 'classLabel', label: 'Class label', type: 'text' }, { name: 'studyStreakDays', label: 'Study streak (days)', type: 'number' }],
};

export const subjectForm: FormDef = {
  title: 'Subject',
  schema: z.object({ name: req('Subject'), teacher: req('Teacher', 80), target: num('Target %', 1, 100) }),
  fields: [{ name: 'name', label: 'Subject', type: 'text', span: 2 }, { name: 'teacher', label: 'Teacher', type: 'text' }, { name: 'target', label: 'Target %', type: 'number' }],
};

export const assessmentForm = (subjects: { id: string; name: string }[]): FormDef => ({
  title: 'Assessment',
  schema: z.object({
    subjectId: z.string().min(1, 'Pick a subject'), title: req('Title'), kind: z.enum(ASSESSMENT_KINDS), date: isoDate,
    maxScore: num('Max score', 1, 1000), score: optNum,
  }).refine((a) => a.score === null || (a.score >= 0 && a.score <= a.maxScore), { message: 'Score must be between 0 and max score', path: ['score'] }),
  fields: [
    { name: 'subjectId', label: 'Subject', type: 'select', options: subjects.map((s) => s.id) }, { name: 'kind', label: 'Kind', type: 'select', options: ASSESSMENT_KINDS },
    { name: 'title', label: 'Title', type: 'text', span: 2 }, { name: 'date', label: 'Date', type: 'date' }, { name: 'maxScore', label: 'Max score', type: 'number' },
    { name: 'score', label: 'Score', type: 'number', hint: 'leave empty for an upcoming assessment' },
  ],
});

export const taskForm = (subjects: { id: string }[]): FormDef => ({
  title: 'Task',
  schema: z.object({
    title: req('Title'), date: isoDate, time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM'), durationMinutes: num('Minutes', 5, 480),
    kind: z.enum(TASK_KINDS), subjectId: z.string().transform((s) => s || null), notes: z.string().max(500).transform((s) => s || null),
  }),
  fields: [
    { name: 'title', label: 'Title', type: 'text', span: 2 }, { name: 'date', label: 'Due date', type: 'date' }, { name: 'time', label: 'Time', type: 'time' },
    { name: 'durationMinutes', label: 'Minutes', type: 'number' }, { name: 'kind', label: 'Kind', type: 'select', options: TASK_KINDS },
    { name: 'subjectId', label: 'Subject (optional)', type: 'select', options: ['', ...subjects.map((s) => s.id)] }, { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
  ],
});

export const goalForm: FormDef = {
  title: 'Goal',
  schema: z.object({
    title: req('Title'), category: z.enum(GOAL_CATS), unit: req('Unit', 20), start: z.coerce.number(), target: z.coerce.number(), better: z.enum(['higher', 'lower']),
    dueDate: isoDate, current: z.coerce.number(),
  }).refine((g) => g.start !== g.target, { message: 'Start and target must differ', path: ['target'] }),
  fields: [
    { name: 'title', label: 'Title', type: 'text', span: 2 }, { name: 'category', label: 'Category', type: 'select', options: GOAL_CATS }, { name: 'unit', label: 'Unit', type: 'text', placeholder: '%, books, s…' },
    { name: 'start', label: 'Start value', type: 'number' }, { name: 'target', label: 'Target value', type: 'number' }, { name: 'current', label: 'Current value', type: 'number' },
    { name: 'better', label: 'Better is', type: 'select', options: ['higher', 'lower'] }, { name: 'dueDate', label: 'Due date', type: 'date' },
  ],
};

export const activityForm: FormDef = {
  title: 'Activity',
  schema: z.object({
    kind: z.enum(ACTIVITY_KINDS), detail: req('Detail'), role: z.string().max(120).optional(), days: csv.transform((xs) => xs.map(Number)).pipe(z.array(z.number().int("Days are 0-6").min(0, "Days are 0-6").max(6, "Days are 0-6"))),
    minutes: num('Minutes per session', 5, 600), weeklyTargetMinutes: num('Weekly target', 0, 3000),
  }),
  fields: [
    { name: 'kind', label: 'Sport / activity', type: 'select', options: ACTIVITY_KINDS }, { name: 'detail', label: 'Detail', type: 'text', placeholder: 'School 1st XI' },
    { name: 'role', label: 'Role', type: 'text', placeholder: 'Captain…', span: 2 }, { name: 'days', label: 'Days (0=Sun…6=Sat)', type: 'csv', placeholder: '1,3' },
    { name: 'minutes', label: 'Minutes / session', type: 'number' }, { name: 'weeklyTargetMinutes', label: 'Weekly target (min)', type: 'number' },
  ],
};

export const sessionForm = (metricKeys: string[]): FormDef => ({
  title: 'Session',
  schema: z.object({
    date: isoDate, minutes: num('Minutes', 1, 720), type: z.enum(['training', 'match', 'race']), note: z.string().max(280).transform((s) => s || null),
    ...Object.fromEntries(metricKeys.map((k) => [`m_${k}`, optNum])),
  }),
  fields: [
    { name: 'date', label: 'Date', type: 'date' }, { name: 'minutes', label: 'Minutes', type: 'number' }, { name: 'type', label: 'Type', type: 'select', options: ['training', 'match', 'race'] },
    { name: 'note', label: 'Note', type: 'text' }, ...metricKeys.map((k) => ({ name: `m_${k}`, label: `Metric: ${k}`, type: 'number' as const })),
  ],
});

export const opportunityForm = (students: { id: string; name: string }[]): FormDef => ({
  title: 'Opportunity',
  schema: z.object({
    title: req('Title'), organizer: req('Organizer'), type: z.enum(OPP_TYPES), emirate: z.string().transform((s) => (s ? s : null)), deadline: isoDate,
    minGrade: num('Min grade', 5, 13), maxGrade: num('Max grade', 5, 13), costAed: num('Cost', 0, 100000), tags: csv, why: req('Why it fits', 280),
    url: z.string().trim().transform((s) => s || undefined).pipe(z.string().url('Enter a full URL').optional()),
    audienceIds: csv, status: z.enum(['published', 'draft', 'closed']),
  }).refine((o) => o.minGrade <= o.maxGrade, { message: 'Min grade must be ≤ max grade', path: ['maxGrade'] })
    .refine((o) => o.audienceIds.every((id) => students.some((s) => s.id === id)), { message: 'Unknown student id', path: ['audienceIds'] })
    .transform(({ audienceIds, ...o }) => ({ ...o, audience: { studentIds: audienceIds.length ? audienceIds : 'all' } })),
  fields: [
    { name: 'title', label: 'Title', type: 'text', span: 2 }, { name: 'organizer', label: 'Organizer', type: 'text' }, { name: 'type', label: 'Type', type: 'select', options: OPP_TYPES },
    { name: 'deadline', label: 'Deadline', type: 'date' }, { name: 'emirate', label: 'Emirate', type: 'select', options: ['', ...EMIRATES] },
    { name: 'minGrade', label: 'Min grade', type: 'number' }, { name: 'maxGrade', label: 'Max grade', type: 'number' }, { name: 'costAed', label: 'Cost (AED)', type: 'number' },
    { name: 'status', label: 'Status', type: 'select', options: ['published', 'draft', 'closed'] }, { name: 'tags', label: 'Tags', type: 'csv', hint: 'comma-separated', span: 2 },
    { name: 'why', label: 'Why it fits (shown to students)', type: 'textarea', span: 2 }, { name: 'url', label: 'Link', type: 'text', span: 2 },
    { name: 'audienceIds', label: 'Only these students (ids)', type: 'csv', hint: `empty = every student in the grade range · e.g. ${students.slice(0, 2).map((s) => s.id).join(', ')}`, span: 2 },
  ],
});

export const applicationForm: FormDef = {
  title: 'Application',
  schema: z.object({ title: req('Title'), organizer: req('Organizer'), type: z.enum(OPP_TYPES), status: z.enum(APP_STATUS), outcome: z.string().max(280).transform((s) => s || null), appliedAt: z.string().transform((s) => s || null) }),
  fields: [
    { name: 'title', label: 'Title', type: 'text', span: 2 }, { name: 'organizer', label: 'Organizer', type: 'text' }, { name: 'type', label: 'Type', type: 'select', options: OPP_TYPES },
    { name: 'status', label: 'Status', type: 'select', options: APP_STATUS }, { name: 'appliedAt', label: 'Applied on', type: 'date' }, { name: 'outcome', label: 'Outcome', type: 'text', span: 2 },
  ],
};

export const projectForm: FormDef = {
  title: 'Side project',
  schema: z.object({
    name: req('Name'), tagline: req('Tagline', 160), kind: z.enum(['business', 'app', 'club', 'creative', 'research']), role: req('Role', 60), startDate: isoDate,
    url: z.string().trim().transform((s) => s || null).pipe(z.string().url('Enter a full URL').nullable()), status: z.enum(['active', 'paused', 'done']), skills: csv,
  }),
  fields: [
    { name: 'name', label: 'Name', type: 'text' }, { name: 'role', label: 'Role', type: 'text' }, { name: 'tagline', label: 'Tagline', type: 'text', span: 2 },
    { name: 'kind', label: 'Kind', type: 'select', options: ['business', 'app', 'club', 'creative', 'research'] }, { name: 'status', label: 'Status', type: 'select', options: ['active', 'paused', 'done'] },
    { name: 'startDate', label: 'Started', type: 'date' }, { name: 'url', label: 'Link', type: 'text' }, { name: 'skills', label: 'Skills', type: 'csv', span: 2 },
  ],
};

export const milestoneForm: FormDef = {
  title: 'Milestone',
  schema: z.object({ title: req('Milestone'), date: isoDate, done: z.coerce.boolean() }),
  fields: [{ name: 'title', label: 'Milestone', type: 'text', span: 2 }, { name: 'date', label: 'Date', type: 'date' }, { name: 'done', label: 'Done', type: 'checkbox' }],
};

export const achievementForm: FormDef = {
  title: 'Achievement',
  schema: z.object({ title: req('Title'), category: z.enum(ACH_CATS), date: isoDate, description: z.string().max(400) }),
  fields: [{ name: 'title', label: 'Title', type: 'text', span: 2 }, { name: 'category', label: 'Category', type: 'select', options: ACH_CATS }, { name: 'date', label: 'Date', type: 'date' }, { name: 'description', label: 'Description', type: 'textarea', span: 2 }],
};

export const cvForm: FormDef = {
  title: 'CV fields',
  schema: z.object({
    headline: req('Headline', 220), summary: z.string().max(2600), email: z.string().trim().transform((s) => s || null).pipe(z.string().email('Invalid email').nullable()),
    location: req('Location', 80), skills: csv, predicted: z.string().max(120).transform((s) => s || null), universityGoal: z.string().max(160).transform((s) => s || null),
  }),
  fields: [
    { name: 'headline', label: 'Headline (LinkedIn, ≤220)', type: 'text', span: 2 }, { name: 'summary', label: 'Summary / About', type: 'textarea', span: 2 },
    { name: 'email', label: 'Email', type: 'text' }, { name: 'location', label: 'Location', type: 'text' }, { name: 'skills', label: 'Skills', type: 'csv', span: 2 },
    { name: 'predicted', label: 'Predicted grades', type: 'text' }, { name: 'universityGoal', label: 'University goal', type: 'text' },
  ],
};

export const linksForm: FormDef = {
  title: 'Links',
  schema: z.object(Object.fromEntries(['linkedin', 'github', 'instagram', 'portfolio', 'website'].map((k) => [k, z.string().max(300).transform((s) => s.trim() || null)]))),
  fields: ['linkedin', 'github', 'instagram', 'portfolio', 'website'].map((k) => ({ name: k, label: k[0]!.toUpperCase() + k.slice(1), type: 'text' as const, placeholder: k === 'github' ? '@handle or URL' : 'https://…', span: 2 as const })),
};

/** Validate raw form strings; returns parsed data or field → message. */
export function validate<T extends z.ZodType>(schema: T, raw: Record<string, unknown>): { ok: true; data: z.output<T> } | { ok: false; errors: Record<string, string> } {
  const r = schema.safeParse(raw);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const i of r.error.issues) { const k = String(i.path[0] ?? '_'); errors[k] ??= i.message; }
  return { ok: false, errors };
}

/** Turn an entity into form strings (arrays become comma lists). */
export function toFormValues(fields: Field[], src: Record<string, unknown> = {}): Record<string, string | boolean> {
  return Object.fromEntries(fields.map((f) => {
    const v = src[f.name];
    if (f.type === 'checkbox') return [f.name, Boolean(v)];
    return [f.name, Array.isArray(v) ? v.join(', ') : v === null || v === undefined ? '' : String(v)];
  }));
}
