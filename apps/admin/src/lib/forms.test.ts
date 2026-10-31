import { describe, expect, it } from 'vitest';
import { assessmentForm, goalForm, opportunityForm, studentForm, taskForm, toFormValues, validate } from './forms';

describe('admin form validation (zod)', () => {
  it('reports field errors for an empty student', () => {
    const r = validate(studentForm.schema, toFormValues(studentForm.fields));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual(expect.arrayContaining(['name', 'school', 'grade']));
  });
  it('parses a valid student (csv lists, numbers)', () => {
    const r = validate(studentForm.schema, { ...toFormValues(studentForm.fields), name: 'Test Student', preferredName: 'T', grade: '10', age: '15', school: 'Demo', curriculum: 'british', emirate: 'dubai', interests: 'art, coding' });
    expect(r.ok && r.data).toMatchObject({ grade: 10, interests: ['art', 'coding'] });
  });
  it('assessment: empty score means upcoming; score above max is rejected', () => {
    const def = assessmentForm([{ id: 'maths', name: 'Maths' }]);
    const base = { subjectId: 'maths', title: 'Mock', kind: 'exam', date: '2026-10-20', maxScore: '50' };
    expect(validate(def.schema, { ...base, score: '' })).toMatchObject({ ok: true, data: { score: null } });
    expect(validate(def.schema, { ...base, score: '60' })).toMatchObject({ ok: false, errors: { score: expect.any(String) } });
  });
  it('task time and goal start/target', () => {
    expect(validate(taskForm([]).schema, { title: 'x', date: '2026-10-20', time: '25:00', durationMinutes: '30', kind: 'study', subjectId: '', notes: '' }).ok).toBe(false);
    expect(validate(goalForm.schema, { title: 'g', category: 'academic', unit: '%', start: '5', target: '5', better: 'higher', dueDate: '2027-01-01', current: '5' })).toMatchObject({ ok: false, errors: { target: expect.any(String) } });
  });
  it('opportunity audience: empty = all; unknown student ids rejected', () => {
    const def = opportunityForm([{ id: 'demo-ideal', name: 'Ahamed' }]);
    const base = { title: 'T', organizer: 'O', type: 'competition', emirate: '', deadline: '2026-11-01', minGrade: '9', maxGrade: '12', costAed: '0', tags: '', why: 'w', url: '', status: 'published' };
    expect(validate(def.schema, { ...base, audienceIds: '' })).toMatchObject({ ok: true, data: { audience: { studentIds: 'all' }, emirate: null } });
    expect(validate(def.schema, { ...base, audienceIds: 'demo-ideal' })).toMatchObject({ ok: true, data: { audience: { studentIds: ['demo-ideal'] } } });
    expect(validate(def.schema, { ...base, audienceIds: 'nobody' }).ok).toBe(false);
  });
});
