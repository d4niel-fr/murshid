import { describe, expect, it } from 'vitest';
import { parseLmsEmail, findDate } from '../src/services/email-parser';
import { NOW, SEED, setup } from './helpers';

describe('courses & materials', () => {
  it('CRUD courses and scoped materials', async () => {
    const { aisha, rohan } = await setup();
    expect((await aisha('GET', '/courses')).body.items).toHaveLength(3);
    const co = await aisha('POST', '/courses', { name: 'Chemistry', teacher: 'Mx Test' });
    expect(co.status).toBe(201);
    expect((await rohan('GET', `/courses/${co.body.id}`)).status).toBe(404);
    expect((await aisha('PATCH', `/courses/${co.body.id}`, { teacher: 'Dr Who' })).body.teacher).toBe('Dr Who');
    const m = await aisha('POST', '/materials', { course_id: co.body.id, title: 'Titration lab report', kind: 'assignment', due_at: '2026-10-15T19:59:00Z' });
    expect(m.status).toBe(201);
    expect(m.body.task).toMatchObject({ title: 'Titration lab report', kind: 'assignment', est_minutes: 60, linked_material_id: m.body.id });
    expect((await aisha('GET', `/courses/${co.body.id}/materials`)).body.items).toHaveLength(1);
    expect((await aisha('GET', '/materials?kind=assignment')).body.items.length).toBe(2);
    expect((await rohan('GET', `/materials/${m.body.id}`)).status).toBe(404);
    expect((await rohan('POST', '/materials', { course_id: co.body.id, title: 'x' })).status).toBe(404);
    expect((await aisha('DELETE', `/courses/${co.body.id}`)).status).toBe(204);
    expect((await aisha('GET', `/materials/${m.body.id}`)).status).toBe(404);
  });

  it('registers uploaded file metadata', async () => {
    const { aisha } = await setup();
    const r = await aisha('POST', '/materials/upload', {
      course_id: SEED.courses.physics, title: 'Mock exam paper', kind: 'exam', file_url: 'storage://materials/mock.pdf',
      file_name: 'mock.pdf', mime_type: 'application/pdf', size_bytes: 12345, due_at: '2026-10-20T04:00:00Z',
    });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ source: 'upload', file_url: 'storage://materials/mock.pdf', file: { mime_type: 'application/pdf' } });
    expect(r.body.task).toMatchObject({ title: 'Revise: Mock exam paper', kind: 'study' });
    expect((await aisha('POST', '/materials/upload', { course_id: SEED.courses.physics, title: 'x' })).status).toBe(400);
  });
});

describe('LMS email parser (rule-based)', () => {
  it('parses a Google Classroom assignment email with a known course', () => {
    const p = parseLmsEmail({
      subject: 'Fwd: New assignment: "Projectile motion worksheet"',
      text: 'Ms. Test posted a new assignment in Physics\nDue: Oct 15, 11:59 PM\nOpen in Google Classroom',
      from: 'no-reply@classroom.google.com',
    }, { now: NOW, knownCourses: ['Physics', 'Mathematics'] });
    expect(p).toMatchObject({ kind: 'assignment', title: 'Projectile motion worksheet', course_name: 'Physics', lms: 'google_classroom' });
    expect(p.due_at).toBe('2026-10-15T19:59:00.000Z');
    expect(p.confidence).toBe(1);
  });

  it('parses day-first numeric dates and times (UAE style)', () => {
    const p = parseLmsEmail({ subject: 'Homework reminder', text: 'Class: Biology\nPlease submit by 03/11/2026 at 5pm' }, { now: NOW });
    expect(p.kind).toBe('assignment');
    expect(p.course_name).toBe('Biology');
    expect(p.due_at).toBe('2026-11-03T13:00:00.000Z');
  });

  it('handles relative dates, exams and Teams', () => {
    const p = parseLmsEmail({ subject: 'Unit test on Thursday', text: 'Microsoft Teams: Chemistry quiz covers chapters 3-4.' }, { now: NOW, knownCourses: ['Chemistry'] });
    expect(p).toMatchObject({ kind: 'exam', course_name: 'Chemistry', lms: 'teams' });
    expect(p.due_at).toBe('2026-10-15T04:00:00.000Z'); // Thursday 08:00 Dubai default for exams
    const t = parseLmsEmail({ subject: 'Essay due tomorrow', text: '' }, { now: NOW });
    expect(t.due_at).toBe('2026-10-13T19:59:00.000Z');
  });

  it('treats plain announcements as undated', () => {
    const p = parseLmsEmail({ subject: 'Announcement: sports day', text: 'Wear house colours.' }, { now: NOW });
    expect(p).toMatchObject({ kind: 'announcement', due_at: null });
  });

  it('infers next year for past month/day and parses ISO + html', () => {
    expect(findDate('due 5 January', NOW)?.date).toBe('2027-01-05');
    expect(findDate('due 2026-12-01', NOW)?.date).toBe('2026-12-01');
    const p = parseLmsEmail({ subject: 'Assignment', text: '', html: '<p>Course: Art</p><p>Due <b>20 October 2026</b></p>' }, { now: NOW });
    expect(p.course_name).toBe('Art');
    expect(p.due_at).toBe('2026-10-20T19:59:00.000Z');
  });
});

describe('POST /inbox/email', () => {
  const email = {
    to: `inbox+${SEED.aisha.studentId}@inbox.murshid.local`, from: 'no-reply@classroom.google.com',
    subject: 'New assignment: "Sonnet analysis"', text: 'Mr. Test posted a new assignment in English Literature. Due 16 Oct',
    message_id: '<m1@test>',
  };

  it('ingests via webhook secret into material + task, and dedupes by message id', async () => {
    const { call, aisha } = await setup();
    const r = await call('POST', '/inbox/email', { headers: { 'x-inbox-secret': 'test-secret' }, body: email });
    expect(r.status).toBe(201);
    expect(r.body.created_course).toBe(false);
    expect(r.body.course.id).toBe(SEED.courses.english);
    expect(r.body.material).toMatchObject({ title: 'Sonnet analysis', kind: 'assignment', source: 'email:google_classroom' });
    expect(r.body.task.due_at).toBe('2026-10-16T19:59:00.000Z');
    const again = await call('POST', '/inbox/email', { headers: { 'x-inbox-secret': 'test-secret' }, body: email });
    expect(again.body.duplicate).toBe(true);
    expect((await aisha('GET', '/tasks?status=todo')).body.items.some((t: any) => t.title === 'Sonnet analysis')).toBe(true);
  });

  it('rejects a wrong secret and unknown recipients', async () => {
    const { call } = await setup();
    expect((await call('POST', '/inbox/email', { headers: { 'x-inbox-secret': 'nope' }, body: email })).status).toBe(401);
    expect((await call('POST', '/inbox/email', { headers: { 'x-inbox-secret': 'test-secret' }, body: { ...email, to: 'inbox+missing@x' } })).status).toBe(404);
    expect((await call('POST', '/inbox/email', { body: email })).status).toBe(401);
  });

  it('accepts an authenticated student and creates an unknown course', async () => {
    const { aisha } = await setup();
    const r = await aisha('POST', '/inbox/email', { to: 'me', subject: 'Homework', text: 'Course: Geography\nDue 2026-10-19' });
    expect(r.status).toBe(201);
    expect(r.body.created_course).toBe(true);
    expect(r.body.course.name).toBe('Geography');
  });
});
