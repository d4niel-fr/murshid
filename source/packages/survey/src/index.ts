/**
 * Murshid validation survey: a student version and a teacher version (~8 questions each). Anonymous: no names,
 * emails or IDs; the only profile fields are an optional grade (students) or role (teachers). Shared by the web
 * form, the API (validation + aggregation) and the admin results view.
 */
export type SurveyVersion = 'student' | 'teacher';

export interface SurveyQuestion {
  id: string;
  text: string;
  kind: 'single' | 'multi' | 'scale' | 'text';
  options?: string[];
  /** scale: 1..5 with end labels */
  scale?: [string, string];
  optional?: boolean;
}

export const SURVEY_VERSION_ID = '2026-10-v1';

export const SURVEYS: Record<SurveyVersion, { title: string; intro: string; questions: SurveyQuestion[] }> = {
  student: {
    title: 'Student survey: homework, deadlines and your week',
    intro: 'Eight quick questions (about 2 minutes) about how school work, tests and activities pile up. Anonymous.',
    questions: [
      { id: 'grade', text: 'Which grade are you in? (optional)', kind: 'single', options: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Other', 'Prefer not to say'], optional: true },
      { id: 'workload', text: 'How stressful is your workload in a typical school week?', kind: 'scale', scale: ['Not at all', 'Extremely'] },
      { id: 'missed', text: 'In the last month, how many deadlines did you miss or hand in late?', kind: 'single', options: ['None', '1', '2-3', '4 or more'] },
      { id: 'clustering', text: 'How often do several deadlines or tests land on the same day or two?', kind: 'single', options: ['Never', 'Once a term', 'Once a month', 'Most weeks', 'Every week'] },
      { id: 'tracking', text: 'How do you keep track of homework and tests now?', kind: 'multi', options: ['Teams / school portal', 'Paper planner or notebook', 'Phone notes or calendar', 'WhatsApp groups', 'I just remember', 'Nothing really'] },
      { id: 'activities', text: 'Do sport, clubs or other activities make it harder to keep up with school work?', kind: 'single', options: ['No', 'Sometimes', 'Often', 'I don\u2019t do activities'] },
      { id: 'would_use', text: 'Would you use an app that puts every class, assignment, test and activity in one plan and builds your week around it?', kind: 'scale', scale: ['Definitely not', 'Definitely yes'] },
      { id: 'family_pay', text: 'If your school didn\u2019t provide it, would your family pay for it?', kind: 'single', options: ['No', 'Maybe, up to AED 15 a month', 'Yes, up to AED 30 a month', 'Yes, up to AED 50 a month', 'Not sure'] },
      { id: 'wish', text: 'What is the one thing that would make your school week easier? (optional)', kind: 'text', optional: true },
    ],
  },
  teacher: {
    title: 'Teacher survey: homework timing and class workload',
    intro: 'Eight quick questions (about 3 minutes) about setting homework and spotting students who are struggling. Anonymous.',
    questions: [
      { id: 'role', text: 'Your role (optional)', kind: 'single', options: ['Subject teacher', 'Class / form teacher', 'Head of department', 'Counsellor', 'School leadership', 'Other'], optional: true },
      { id: 'visibility', text: 'When you set homework, how well can you see what else your class has due that week?', kind: 'scale', scale: ['Not at all', 'Completely'] },
      { id: 'clustering', text: 'How often do you find out students had several deadlines or tests on the same days?', kind: 'single', options: ['Never', 'Once a term', 'Once a month', 'Most weeks', 'Every week'] },
      { id: 'late_rate', text: 'Roughly what share of homework in your classes is late or missing?', kind: 'single', options: ['Under 5%', '5-10%', '10-20%', '20-30%', 'Over 30%'] },
      { id: 'spot_struggling', text: 'How early do you usually spot a student who is falling behind?', kind: 'single', options: ['Within a week', 'Within 2-3 weeks', 'Within a month', 'Later than a month'] },
      { id: 'useful_features', text: 'Which would help you most?', kind: 'multi', options: ['Best day to set homework (on-time likelihood)', 'Class progress with at-risk flags', 'Suggested groups (support / more time / extension)', 'Automatic weekly report from each student', 'Assignments syncing with Teams'] },
      { id: 'would_use', text: 'Would you use a tool like this if the school provided it?', kind: 'scale', scale: ['Definitely not', 'Definitely yes'] },
      { id: 'time_saved', text: 'How much time a week might it save you?', kind: 'single', options: ['None', 'Under 30 minutes', '30-60 minutes', '1-2 hours', 'More than 2 hours'] },
      { id: 'concerns', text: 'Any concerns (privacy, workload, accuracy)? (optional)', kind: 'text', optional: true },
    ],
  },
};

export interface SurveySubmission { version: SurveyVersion; answers: Record<string, string | string[] | number>; consent: true }

/** Validate a submission against the question list. Returns the cleaned answers or an error message. */
export function validateSurvey(x: unknown): { ok: true; value: SurveySubmission } | { ok: false; error: string } {
  if (!x || typeof x !== 'object') return { ok: false, error: 'body must be an object' };
  const b = x as Record<string, unknown>;
  if (b.version !== 'student' && b.version !== 'teacher') return { ok: false, error: 'version must be student or teacher' };
  if (b.consent !== true) return { ok: false, error: 'consent is required' };
  const raw = (b.answers && typeof b.answers === 'object' ? b.answers : {}) as Record<string, unknown>;
  const out: SurveySubmission['answers'] = {};
  for (const q of SURVEYS[b.version].questions) {
    const v = raw[q.id];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) { if (!q.optional) return { ok: false, error: `please answer: ${q.text}` }; continue; }
    if (q.kind === 'scale') { const n = Number(v); if (!Number.isInteger(n) || n < 1 || n > 5) return { ok: false, error: `${q.id}: 1-5` }; out[q.id] = n; }
    else if (q.kind === 'single') { if (typeof v !== 'string' || !q.options!.includes(v)) return { ok: false, error: `${q.id}: unknown option` }; out[q.id] = v; }
    else if (q.kind === 'multi') { if (!Array.isArray(v) || v.some((o) => typeof o !== 'string' || !q.options!.includes(o))) return { ok: false, error: `${q.id}: unknown option` }; out[q.id] = [...new Set(v as string[])]; }
    else { if (typeof v !== 'string') return { ok: false, error: `${q.id}: text` }; out[q.id] = v.slice(0, 500).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email removed]').replace(/\+?\d[\d\s-]{7,}\d/g, '[number removed]'); }
  }
  return { ok: true, value: { version: b.version, answers: out, consent: true } };
}

export interface SurveyRow { version: SurveyVersion; answers: Record<string, unknown>; created_at: string }
export interface QuestionSummary { id: string; text: string; kind: SurveyQuestion['kind']; answered: number; counts: { label: string; n: number }[]; mean?: number; texts?: string[] }
export interface SurveySummary { total: number; byVersion: Record<SurveyVersion, number>; first: string | null; last: string | null; versions: Record<SurveyVersion, QuestionSummary[]> }

/** Counts per option (and the mean for 1-5 scales) for each question, per version. */
export function summarizeSurvey(rows: SurveyRow[]): SurveySummary {
  const versions = {} as SurveySummary['versions'];
  for (const ver of ['student', 'teacher'] as SurveyVersion[]) {
    const rs = rows.filter((r) => r.version === ver);
    versions[ver] = SURVEYS[ver].questions.map((q) => {
      const vals = rs.map((r) => r.answers[q.id]).filter((v) => v !== undefined && v !== null && v !== '');
      const labels = q.kind === 'scale' ? ['1', '2', '3', '4', '5'] : q.options ?? [];
      const counts = labels.map((label) => ({ label, n: vals.filter((v) => (Array.isArray(v) ? v.includes(label) : String(v) === label)).length }));
      const nums = q.kind === 'scale' ? vals.map(Number).filter((n) => n >= 1 && n <= 5) : [];
      return {
        id: q.id, text: q.text, kind: q.kind, answered: vals.length, counts,
        ...(nums.length ? { mean: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10 } : {}),
        ...(q.kind === 'text' ? { texts: vals.map(String).slice(0, 50) } : {}),
      };
    });
  }
  const dates = rows.map((r) => r.created_at).sort();
  return { total: rows.length, byVersion: { student: rows.filter((r) => r.version === 'student').length, teacher: rows.filter((r) => r.version === 'teacher').length }, first: dates[0] ?? null, last: dates.at(-1) ?? null, versions };
}
