import { describe, expect, it } from 'vitest';
import { SEED, setup } from './helpers';

const asGuardian = (email: string) => ({ as: 'g-user', role: 'guardian', email });

describe('guardian', () => {
  it('lists linked students and returns a consented summary without contents', async () => {
    const { call, deps } = await setup();
    const list = await call('GET', '/guardian/students', asGuardian(SEED.guardian.email));
    expect(list.body.items).toEqual([expect.objectContaining({ student_id: SEED.aisha.studentId, consent_status: 'granted', name: 'Aisha' })]);
    const s = await call('GET', `/guardian/students/${SEED.aisha.studentId}/summary`, asGuardian(SEED.guardian.email));
    expect(s.status).toBe(200);
    expect(s.body.student).toEqual({ id: SEED.aisha.studentId, name: 'Aisha', grade: 11 });
    expect(s.body.tasks).toEqual({ due_this_week: 3, overdue: 0, open: 5 });
    expect(JSON.stringify(s.body)).not.toContain('1200-word'); // no material body text
    expect((await deps.repo.auditLogs.list({ action: 'read_summary' }))).toHaveLength(1);
  });

  it('denies unconsented links, other students, and non-guardians', async () => {
    const { call, aisha } = await setup();
    expect((await call('GET', `/guardian/students/${SEED.rohan.studentId}/summary`, asGuardian(SEED.rohanGuardian.email))).status).toBe(403);
    expect((await call('GET', `/guardian/students/${SEED.rohan.studentId}/summary`, asGuardian(SEED.guardian.email))).status).toBe(404);
    expect((await aisha('GET', '/guardian/students')).status).toBe(403);
    const pending = await call('GET', '/guardian/students', asGuardian(SEED.rohanGuardian.email));
    expect(pending.body.items[0].name).toBeNull();
  });
});

describe('briefing', () => {
  it('builds the weekly briefing JSON', async () => {
    const { aisha } = await setup();
    const b = (await aisha('GET', '/briefing/weekly')).body;
    expect(b.week_start).toBe('2026-10-12');
    expect(b.headline).toMatch(/^Aisha, you have 3 tasks due this week/);
    expect(b.tasks.due_this_week.map((t: any) => t.title)).toEqual(['Physics problem set 3', 'Macbeth essay draft', 'Revise differentiation']);
    expect(b.calendar.event_count).toBe(4);
    expect(b.goals[0].next_milestone.title).toBe('Join a robotics competition');
    expect(b.opportunities[0].title).toBe('UAE Robotics Challenge (Test)');
    expect(b.suggestions.length).toBeGreaterThan(0);
  });

  it('flags overdue work and urgent applications', async () => {
    const { aisha } = await setup();
    await aisha('POST', '/tasks', { title: 'Late lab', due_at: '2026-10-10T10:00:00Z', est_minutes: 30 });
    const opp = (await aisha('GET', '/opportunities?type=olympiad')).body.items[0];
    await aisha('POST', '/applications', { opportunity_id: opp.id });
    const b = (await aisha('GET', '/briefing/weekly')).body;
    expect(b.tasks.overdue.map((t: any) => t.title)).toEqual(['Late lab']);
    expect(b.suggestions[0]).toContain('overdue');
    expect(b.suggestions.some((s: string) => s.includes('Youth Physics Olympiad'))).toBe(true);
    expect(b.opportunities.map((o: any) => o.id)).not.toContain(opp.id);
  });
});

describe('agent chat (stub, AI-LATER)', () => {
  it('routes by keyword deterministically and audits the read', async () => {
    const { aisha, deps } = await setup();
    const r = await aisha('POST', '/agent/chat', { message: 'What is due this week?' });
    expect(r.body).toMatchObject({ intent: 'deadlines', ai: false, stub: true });
    expect(r.body.reply).toContain('Physics problem set 3');
    expect((await aisha('POST', '/agent/chat', { message: 'plan my week' })).body.intent).toBe('plan');
    expect((await aisha('POST', '/agent/chat', { message: 'any competitions?' })).body.reply).toContain('UAE Robotics Challenge');
    expect((await aisha('POST', '/agent/chat', { message: '' })).status).toBe(400);
    expect((await deps.repo.auditLogs.list({ action: 'agent_read' })).length).toBe(3);
  });
});
