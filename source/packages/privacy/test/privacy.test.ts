import { describe, expect, it } from 'vitest';
import {
  AgeGate,
  NEUTRAL_DOB_SCREEN,
  ageOn,
  ConsentService,
  InMemoryConsentStore,
  ConsentError,
  GuardianFlow,
  InMemoryGuardianStore,
  MockEmailSender,
  can,
  type Actor,
  AuditWriter,
  InMemoryAuditStore,
  evaluateIntegrity,
  AiUseLogger,
  InMemoryAiUseLogStore,
  DataRightsService,
  InMemoryStudentDataSource,
  readZip,
  RETENTION_POLICY,
  isExpired,
  STUDENT_DATA_TABLES,
  type Task,
} from '../src/index.js';

const fixed = (iso: string) => () => new Date(iso);
const AISHA = '11111111-1111-4111-8111-111111111111';
const ROHAN = '22222222-2222-4222-8222-222222222222';
const SCHOOL = '99999999-9999-4999-8999-999999999999';

describe('age gate', () => {
  const gate = new AgeGate({ clock: fixed('2026-10-10T08:00:00Z') });

  it('computes age in Asia/Dubai calendar', () => {
    // 2026-10-09T21:00Z is already 10 Oct in Dubai
    expect(ageOn('2013-10-10', new Date('2026-10-09T21:00:00Z'))).toBe(13);
    expect(ageOn('2013-10-10', new Date('2026-10-09T19:00:00Z'))).toBe(12);
  });

  it('blocks under 13, needs guardian 13-17, adult 18+', () => {
    expect(gate.evaluate('2014-01-01').outcome).toBe('blocked_under_min_age');
    expect(gate.evaluate('2013-10-10').outcome).toBe('allowed_needs_guardian');
    expect(gate.evaluate('2009-09-14').outcome).toBe('allowed_needs_guardian');
    expect(gate.evaluate('2008-10-10').outcome).toBe('allowed_adult');
    expect(gate.evaluate('2010-02-30').outcome).toBe('invalid');
  });

  it('neutral screen never mentions an age threshold', () => {
    const copy = JSON.stringify(NEUTRAL_DOB_SCREEN);
    expect(copy).not.toMatch(/13|18|old enough|over|under/i);
    expect(NEUTRAL_DOB_SCREEN.defaultYear).toBeNull();
  });

  it('locks the device after a block so a different DOB cannot be retried', async () => {
    expect((await gate.submit('device-1', '2015-05-05')).outcome).toBe('blocked_under_min_age');
    expect((await gate.submit('device-1', '2005-05-05')).outcome).toBe('locked');
    expect((await gate.submit('device-2', '2005-05-05')).outcome).toBe('allowed_adult');
  });
});

async function verifiedGuardian(studentId = AISHA) {
  const email = new MockEmailSender();
  const store = new InMemoryGuardianStore();
  const flow = new GuardianFlow(store, email, { clock: fixed('2026-10-10T08:00:00Z') });
  const { invite } = await flow.invite({
    studentId,
    studentPreferredName: 'Aisha',
    guardianName: 'Parent Test',
    guardianEmail: 'Parent.Test@example.com',
    relation: 'mother',
  });
  const res = await flow.verifyOtp(invite.id, email.sent[0]!.otp);
  if (!res.ok) throw new Error('verify failed');
  return res.guardian;
}

describe('guardian invite + OTP', () => {
  it('sends OTP, stores only a hash, verifies', async () => {
    const email = new MockEmailSender();
    const store = new InMemoryGuardianStore();
    const flow = new GuardianFlow(store, email, { clock: fixed('2026-10-10T08:00:00Z') });
    const { invite, guardian } = await flow.invite({
      studentId: AISHA, studentPreferredName: 'Aisha', guardianName: 'P', guardianEmail: 'p@example.com', relation: 'father',
    });
    const otp = email.sent[0]!.otp;
    expect(otp).toMatch(/^\d{6}$/);
    expect(JSON.stringify(invite)).not.toContain(otp);
    expect(guardian.verified_at).toBeNull();
    const res = await flow.verifyOtp(invite.id, otp);
    expect(res.ok).toBe(true);
    expect((await flow.verifyOtp(invite.id, otp)).ok).toBe(false); // single use
  });

  it('locks after 5 wrong codes and expires after TTL', async () => {
    const email = new MockEmailSender();
    let now = new Date('2026-10-10T08:00:00Z');
    const flow = new GuardianFlow(new InMemoryGuardianStore(), email, { clock: () => now });
    const { invite } = await flow.invite({ studentId: AISHA, studentPreferredName: 'A', guardianName: 'P', guardianEmail: 'p@example.com', relation: 'mother' });
    const wrong = email.sent[0]!.otp === '000000' ? '111111' : '000000';
    for (let i = 0; i < 4; i++) expect(await flow.verifyOtp(invite.id, wrong)).toMatchObject({ ok: false, reason: 'wrong_code' });
    expect(await flow.verifyOtp(invite.id, wrong)).toMatchObject({ ok: false, reason: 'locked' });
    expect(await flow.verifyOtp(invite.id, email.sent[0]!.otp)).toMatchObject({ ok: false, reason: 'locked' });

    const { invite: inv2 } = await flow.invite({ studentId: AISHA, studentPreferredName: 'A', guardianName: 'P', guardianEmail: 'p@example.com', relation: 'mother' });
    now = new Date('2026-10-10T08:16:00Z');
    expect(await flow.verifyOtp(inv2.id, email.sent[1]!.otp)).toMatchObject({ ok: false, reason: 'expired' });
  });

  it('UAE PASS hook is a placeholder', async () => {
    const flow = new GuardianFlow(new InMemoryGuardianStore(), new MockEmailSender());
    expect(await flow.verifyWithUaePass('g', 'code')).toEqual({ verified: false, level: null });
  });
});

describe('consent', () => {
  it('minor needs verified guardian; purposes separately revocable; dependency cascade', async () => {
    const svc = new ConsentService(new InMemoryConsentStore(), fixed('2026-10-10T08:00:00Z'));
    const subject = { studentId: AISHA, isMinor: true };
    await expect(svc.grant({ subject, purpose: 'core_service', actor: { role: 'student', id: AISHA } })).rejects.toBeInstanceOf(ConsentError);

    const g = await verifiedGuardian();
    const actor = { role: 'guardian' as const, id: g.id };
    await expect(svc.grant({ subject, purpose: 'notifications', actor, guardian: g })).rejects.toMatchObject({ code: 'dependency_missing' });
    await svc.grant({ subject, purpose: 'core_service', actor, guardian: g });
    await svc.grant({ subject, purpose: 'notifications', actor, guardian: g });
    await svc.grant({ subject, purpose: 'school_connector', actor, guardian: g });

    let snap = await svc.snapshot(AISHA);
    expect(snap).toMatchObject({ core_service: true, notifications: true, school_connector: true, guardian_summaries: false, opportunity_sharing_universities: false });

    await svc.revoke(AISHA, 'notifications', { role: 'student', id: AISHA });
    snap = await svc.snapshot(AISHA);
    expect(snap.notifications).toBe(false);
    expect(snap.school_connector).toBe(true);

    await svc.revoke(AISHA, 'core_service', { role: 'student', id: AISHA });
    snap = await svc.snapshot(AISHA);
    expect(snap.school_connector).toBe(false);
  });

  it('unverified guardian or guardian of another student is rejected', async () => {
    const svc = new ConsentService(new InMemoryConsentStore());
    const g = await verifiedGuardian(ROHAN);
    await expect(
      svc.grant({ subject: { studentId: AISHA, isMinor: true }, purpose: 'core_service', actor: { role: 'guardian', id: g.id }, guardian: g }),
    ).rejects.toMatchObject({ code: 'wrong_student' });
    await expect(
      svc.grant({ subject: { studentId: AISHA, isMinor: true }, purpose: 'core_service', actor: { role: 'guardian', id: 'x' }, guardian: { id: 'x', student_id: AISHA, verified_at: null } }),
    ).rejects.toMatchObject({ code: 'guardian_not_verified' });
  });

  it('adult can self-consent; version bump requires re-consent', async () => {
    const store = new InMemoryConsentStore();
    const svc = new ConsentService(store);
    await svc.grant({ subject: { studentId: ROHAN, isMinor: false }, purpose: 'core_service', actor: { role: 'student', id: ROHAN } });
    expect(await svc.isGranted(ROHAN, 'core_service')).toBe(true);
    const { CONSENT_PURPOSES } = await import('../src/consent.js');
    const bumped = { ...CONSENT_PURPOSES, core_service: { ...CONSENT_PURPOSES.core_service, version: 2 } };
    const svc2 = new ConsentService(store, undefined, bumped);
    expect(await svc2.isGranted(ROHAN, 'core_service')).toBe(false);
    expect(await svc2.needsReconsent(ROHAN)).toEqual(['core_service']);
  });
});

describe('policy engine', () => {
  const full = { core_service: true, school_connector: true, guardian_summaries: true, notifications: true, opportunity_sharing_universities: false };
  const none = {};
  const res = (type: any = 'task') => ({ type, studentId: AISHA, schoolId: SCHOOL });
  const student: Actor = { role: 'student', id: AISHA, studentId: AISHA };
  const other: Actor = { role: 'student', id: ROHAN, studentId: ROHAN };
  const guardian: Actor = { role: 'guardian', id: 'g1', studentId: AISHA, verified: true };
  const counsellor: Actor = { role: 'counsellor', id: 'c1', schoolId: SCHOOL };
  const connector: Actor = { role: 'service', id: 'gc', service: 'connector' };
  const agent: Actor = { role: 'service', id: 'a', service: 'agent' };
  const notify: Actor = { role: 'service', id: 'n', service: 'notify' };

  it('students: own data only; rights never consent-gated', () => {
    expect(can(student, 'read', res(), { consent: full, isMinor: true }).allowed).toBe(true);
    expect(can(other, 'read', res(), { consent: full, isMinor: true }).allowed).toBe(false);
    expect(can(student, 'read', res(), { consent: none, isMinor: true }).allowed).toBe(false);
    expect(can(student, 'export', res(), { consent: none, isMinor: true }).allowed).toBe(true);
    expect(can(student, 'delete', res(), { consent: none, isMinor: true }).allowed).toBe(true);
  });

  it('guardians: summary only, verified, consented', () => {
    expect(can(guardian, 'read_summary', res('weekly_summary'), { consent: full, isMinor: true }).allowed).toBe(true);
    expect(can(guardian, 'read', res('task'), { consent: full, isMinor: true }).allowed).toBe(false);
    expect(can({ ...guardian, verified: false } as Actor, 'read_summary', res('weekly_summary'), { consent: full, isMinor: true }).allowed).toBe(false);
    expect(can(guardian, 'read_summary', res('weekly_summary'), { consent: { ...full, guardian_summaries: false }, isMinor: true }).allowed).toBe(false);
  });

  it('counsellor: same school + consent, summaries only', () => {
    expect(can(counsellor, 'read_summary', res('weekly_summary'), { consent: full, isMinor: true }).allowed).toBe(true);
    expect(can(counsellor, 'read', res('material'), { consent: full, isMinor: true }).allowed).toBe(false);
    expect(can(counsellor, 'read_summary', { type: 'weekly_summary', studentId: AISHA, schoolId: 'other' }, { consent: full, isMinor: true }).allowed).toBe(false);
    expect(can(counsellor, 'read_summary', res('weekly_summary'), { consent: { core_service: true }, isMinor: true }).allowed).toBe(false);
  });

  it('services need their purpose', () => {
    expect(can(connector, 'read', res('material'), { consent: full, isMinor: true }).allowed).toBe(true);
    expect(can(connector, 'read', res('material'), { consent: { core_service: true }, isMinor: true }).reason).toMatch(/school_connector/);
    expect(can(connector, 'read', res('cv'), { consent: full, isMinor: true }).allowed).toBe(false);
    expect(can(agent, 'read', res('task'), { consent: { core_service: true }, isMinor: true }).allowed).toBe(true);
    expect(can(notify, 'notify', res('notification'), { consent: full, isMinor: true, notifyRecipient: 'other' }).allowed).toBe(false);
    expect(can(notify, 'notify', res('notification'), { consent: { core_service: true }, isMinor: true }).allowed).toBe(false);
  });

  it('external sharing requires its own consent', () => {
    expect(can(student, 'share_external', res('cv'), { consent: full, isMinor: true }).allowed).toBe(false);
    expect(can(student, 'share_external', res('cv'), { consent: { ...full, opportunity_sharing_universities: true }, isMinor: true }).allowed).toBe(true);
    expect(can(counsellor, 'share_external', res('cv'), { consent: { ...full, opportunity_sharing_universities: true }, isMinor: true }).allowed).toBe(false);
  });
});

describe('audit log', () => {
  it('hash-chains rows and rejects content-bearing meta', async () => {
    const store = new InMemoryAuditStore();
    const w = new AuditWriter(store, fixed('2026-10-10T08:00:00Z'));
    await w.write({ actor: 'service:connector:gc', action: 'read', resource: { type: 'material', studentId: AISHA, id: 'm1' }, decision: { allowed: true, reason: 'ok' } });
    await w.write({ actor: 'service:agent:a', action: 'read', resource: { type: 'task', studentId: AISHA }, decision: { allowed: false, reason: 'no consent' } });
    expect(await w.verifyChain(AISHA)).toBe(-1);
    store.rows[0]!.reason = 'tampered';
    expect(await w.verifyChain(AISHA)).toBe(0);
    await expect(
      w.write({ actor: 'x', action: 'read', resource: { type: 'task', studentId: AISHA }, decision: { allowed: true, reason: '' }, meta: { body_text: 'x' } }),
    ).rejects.toThrow();
  });
});

describe('academic integrity + AI-use log', () => {
  it('blocks ghostwriting when level is none', () => {
    const r = evaluateIntegrity('Can you write my assessed essay on climate change?', 'none');
    expect(r.decision).toBe('block');
    expect(r.matchedRules).toContain('GW-1');
    expect(evaluateIntegrity('do my homework for me', 'none').decision).toBe('block');
    expect(evaluateIntegrity('اكتب لي مقال عن البيئة', 'none').decision).toBe('block');
    expect(evaluateIntegrity('explain photosynthesis', 'none').decision).toBe('block');
  });

  it('allows pure logistics on none', () => {
    expect(evaluateIntegrity('help me plan when to start this, the deadline is Friday', 'none').decision).toBe('allow');
  });

  it('support: blocks ghostwrite, guides drafting, allows explain', () => {
    expect(evaluateIntegrity('write my essay', 'support').decision).toBe('block');
    expect(evaluateIntegrity('draft an introduction about trade', 'support').decision).toBe('allow_with_guidance');
    expect(evaluateIntegrity('explain how supply and demand works', 'support').decision).toBe('allow');
  });

  it('led allows drafting but requires declaration; evasion always blocked', () => {
    const led = evaluateIntegrity('write my essay', 'led');
    expect(led.decision).toBe('allow_with_guidance');
    expect(led.declareAiUse).toBe(true);
    expect(evaluateIntegrity('paraphrase this so turnitin will not detect it', 'led').decision).toBe('block');
    expect(evaluateIntegrity('give me the answers to my quiz', 'led').decision).toBe('block');
  });

  it('logs per task without storing prompt text and builds a declaration', async () => {
    const store = new InMemoryAiUseLogStore();
    const logger = new AiUseLogger(store, fixed('2026-10-10T08:00:00Z'));
    const task: Task = { id: 't1', student_id: AISHA, title: 'Economics essay', kind: 'assignment', ai_use_level: 'support' };
    await logger.check(task, 'write my essay', 'claude-haiku-5.5');
    await logger.check(task, 'explain elasticity', 'claude-haiku-5.5');
    const entries = await store.listForTask('t1');
    expect(entries).toHaveLength(2);
    expect(entries[0]!.model_id).toBeNull();
    expect(JSON.stringify(entries)).not.toContain('write my essay');
    expect(await logger.declaration(task)).toMatch(/explaining concepts/);
  });
});

describe('export + delete', () => {
  function seeded() {
    const src = new InMemoryStudentDataSource();
    src.seed('students', [{ id: AISHA, full_name: 'Aisha Test' }, { id: ROHAN, full_name: 'Rohan Test' }]);
    src.seed('goals', [{ id: 'g1', student_id: AISHA, title: 'IGCSE A*' }, { id: 'g2', student_id: ROHAN, title: 'Robotics' }]);
    src.seed('milestones', [{ id: 'm1', goal_id: 'g1', title: 'Mock' }, { id: 'm2', goal_id: 'g2', title: 'Build' }]);
    src.seed('courses', [{ id: 'c1', student_id: AISHA, name: 'Economics' }]);
    src.seed('materials', [{ id: 'mat1', course_id: 'c1', title: 'Notes' }]);
    src.seed('connections', [{ id: 'cn1', student_id: AISHA, provider: 'google_classroom', token_ref: 'vault://x' }]);
    src.seed('audit_logs', [{ id: 'a1', student_id: AISHA }]);
    return src;
  }

  it('exports a zip with every table and no secrets', async () => {
    const src = seeded();
    const svc = new DataRightsService(src, { tombstonePepper: 'test', clock: fixed('2026-10-10T08:00:00Z') });
    const files = readZip(await svc.exportZip(AISHA));
    expect(files.has('manifest.json')).toBe(true);
    for (const t of STUDENT_DATA_TABLES) expect(files.has(`data/${t}.json`)).toBe(true);
    expect(JSON.parse(files.get('data/milestones.json')!.toString())).toHaveLength(1);
    expect(files.get('data/connections.json')!.toString()).not.toContain('vault://');
    expect(files.get('data/students.json')!.toString()).not.toContain('Rohan');
  });

  it('cascades deletion, runs hooks, writes tombstone, keeps other students', async () => {
    const src = seeded();
    const hooksRan: string[] = [];
    const svc = new DataRightsService(src, {
      tombstonePepper: 'test',
      hooks: [{ name: 'revoke_oauth', run: async (id) => void hooksRan.push(id) }],
    });
    const tomb = await svc.deleteStudent(AISHA, 'student');
    expect(hooksRan).toEqual([AISHA]);
    expect(tomb.tables.milestones).toBe(1);
    expect(tomb.tables.materials).toBe(1);
    expect(tomb.subject_hash).not.toContain(AISHA);
    expect(await src.rowsFor('goals', AISHA)).toHaveLength(0);
    expect(await src.rowsFor('milestones', ROHAN)).toHaveLength(1);
    expect(await src.rowsFor('audit_logs', AISHA)).toHaveLength(1); // retained for anonymisation
    expect(src.tombstones).toHaveLength(1);
  });
});

describe('retention', () => {
  it('has a rule for every student table and expires correctly', () => {
    for (const t of STUDENT_DATA_TABLES) expect(RETENTION_POLICY[t]).toBeDefined();
    const r = RETENTION_POLICY.notifications;
    expect(isExpired(r, new Date('2026-01-01'), new Date('2026-04-02'))).toBe(true);
    expect(isExpired(r, new Date('2026-01-01'), new Date('2026-03-01'))).toBe(false);
    expect(isExpired(RETENTION_POLICY.students, new Date('2000-01-01'), new Date())).toBe(false);
  });
});
