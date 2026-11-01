import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { addDays, dubaiDate } from '../src/lib/time';
import { NOW } from './helpers';

const THOMAS = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-thomas' };
const DESAI = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-desai' };
const AHAMED = { 'x-dev-user': 'demo-ideal' };
const CLASS = 'cls-eng-11ab';
const ME = 'dss-ahamed-mehta';
const today = dubaiDate(NOW);

// tiny valid files
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString('base64');
const PPTX = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(60, 1)]).toString('base64');
const PDF = Buffer.from('%PDF-1.4\n%fake\n').toString('base64');

async function setup() {
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' } });
  const raw = (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) =>
    built.app.request(path, { method, headers: { ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
  const req = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
    const res = await raw(method, path, headers, body);
    const text = await res.text();
    let parsed: any = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed, headers: res.headers };
  };
  const upload = async (who: Record<string, string>, name: string, mime: string, data: string) => req('POST', '/files', who, { name, mime, data });
  /** Ms Thomas posts to the Grade 11 English class (Ahamed is in it). */
  const post = async (extra: Record<string, unknown> = {}) => (await req('POST', `/teacher/classes/${CLASS}/assignments`, THOMAS, { title: 'Notes from the slides', instructions: 'Copy the key points into your notebook and send photos.', dueDate: addDays(today, 3), ...extra })).body.assignment;
  return { req, raw, upload, post };
}

describe('files', () => {
  it('accepts photos, PDFs and slides, and serves them back with safe headers', async () => {
    const { upload, raw } = await setup();
    const img = await upload(AHAMED, 'page 1.jpg', 'image/jpeg', `data:image/jpeg;base64,${JPEG}`);
    expect(img.status).toBe(201);
    expect(img.body).toMatchObject({ name: 'page 1.jpg', kind: 'image', size: 22 });
    const slides = await upload(THOMAS, 'Lesson 4.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', PPTX);
    expect(slides.body.kind).toBe('slides');
    const got = await raw('GET', img.body.url);
    expect(got.status).toBe(200);
    expect(got.headers.get('content-type')).toBe('image/jpeg');
    expect(got.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await raw('GET', slides.body.url)).headers.get('content-disposition')).toMatch(/^attachment/);
  });
  it('refuses files that are not what they claim, unsupported types and files over 3 MB', async () => {
    const { upload } = await setup();
    expect((await upload(AHAMED, 'x.jpg', 'image/jpeg', PDF)).body.code).toBe('type_mismatch');
    expect((await upload(AHAMED, 'x.html', 'text/html', JPEG)).status).toBe(400);
    const big = Buffer.alloc(3 * 1024 * 1024 + 10, 0xff); big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
    expect((await upload(AHAMED, 'big.jpg', 'image/jpeg', big.toString('base64'))).status).toBe(413);
  });
});

describe('an assignment with slides, handed in with photos of notes', () => {
  it('teacher attaches slides and asks for photos; the student sees both', async () => {
    const { upload, post, req } = await setup();
    const slides = (await upload(THOMAS, 'Lesson 4.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', PPTX)).body;
    const a = await post({ attachmentIds: [slides.id], photosRequired: true, links: [{ url: 'https://example.com/notes', label: 'Reading' }] });
    expect(a.attachments).toHaveLength(1);
    const school = (await req('GET', '/student/school', AHAMED)).body.school;
    const mine = school.assignments.find((x: { id: string }) => x.id === a.id);
    expect(mine).toMatchObject({ attachments: 1, photosRequired: true, handIn: null, unread: 0 });
    const detail = (await req('GET', `/student/assignments/${a.id}`, AHAMED)).body;
    expect(detail.assignment.attachments[0].name).toBe('Lesson 4.pptx');
    expect(detail.assignment.links[0]).toEqual({ url: 'https://example.com/notes', label: 'Reading' });
    expect(detail.status).toBe('assigned');
  });

  it('a teacher cannot attach someone else\'s upload', async () => {
    const { upload, post } = await setup();
    const mine = (await upload(AHAMED, 'p.jpg', 'image/jpeg', JPEG)).body;
    expect(await post({ attachmentIds: [mine.id] })).toBeUndefined();
  });

  it('needs a photo when the teacher asked for one; then hands in and ticks the plan', async () => {
    const { upload, post, req } = await setup();
    const a = await post({ photosRequired: true });
    const noPhoto = await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { text: 'Here are my notes.' });
    expect(noPhoto.body.code).toBe('photos_required');
    const p1 = (await upload(AHAMED, 'page 1.jpg', 'image/jpeg', JPEG)).body;
    const p2 = (await upload(AHAMED, 'page 2.jpg', 'image/jpeg', JPEG)).body;
    const done = await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { text: 'Two pages of notes.', fileIds: [p1.id, p2.id] });
    expect(done.status).toBe(201);
    expect(done.body.handIn).toMatchObject({ state: 'handed_in', late: false, versions: 1 });
    expect(done.body.handIn.files).toHaveLength(2);
    const task = (await req('GET', '/student/school', AHAMED)).body.school.assignments.find((x: { id: string }) => x.id === a.id);
    expect(task.status).toBe('submitted');
  });

  it("can't hand in someone else's file or an empty hand-in", async () => {
    const { upload, post, req } = await setup();
    const a = await post();
    const theirs = (await upload(THOMAS, 's.pdf', 'application/pdf', PDF)).body;
    expect((await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { fileIds: [theirs.id] })).body.code).toBe('file_not_found');
    expect((await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { text: '   ' })).status).toBe(400);
  });
});

describe('review: return for revision, resubmit, mark with a rubric', () => {
  it('runs the whole loop and keeps everyone informed', async () => {
    const { upload, post, req } = await setup();
    const a = await post({ rubric: [{ label: 'Key points', points: 6 }, { label: 'Neat and labelled', points: 4 }] });
    const p = (await upload(AHAMED, 'notes.jpg', 'image/jpeg', JPEG)).body;
    await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { text: 'My notes', fileIds: [p.id] });

    // the teacher's list and inbox show it waiting
    const list = (await req('GET', `/teacher/classes/${CLASS}/assignments/${a.id}/handins`, THOMAS)).body;
    expect(list.counts).toMatchObject({ students: 30, handedIn: 1, toReview: 1, notStarted: 29 });
    expect((await req('GET', '/teacher/inbox', THOMAS)).body.toReview).toHaveLength(1);

    // return with feedback: the student sees it, and it lands in the thread
    const back = await req('POST', `/teacher/classes/${CLASS}/assignments/${a.id}/handins/${ME}/review`, THOMAS, { action: 'return', feedback: 'Label the diagram on page 1.' });
    expect(back.body.handIn).toMatchObject({ state: 'returned', feedback: 'Label the diagram on page 1.' });
    const seen = (await req('GET', '/student/school', AHAMED)).body.school.assignments.find((x: { id: string }) => x.id === a.id);
    expect(seen).toMatchObject({ status: 'returned', unread: 1 });
    expect(seen.handIn.feedback).toBe('Label the diagram on page 1.');

    // resubmit: version 2
    const again = await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { text: 'Labelled now', fileIds: [p.id] });
    expect(again.body.handIn).toMatchObject({ state: 'handed_in', versions: 2 });

    // mark with rubric scores: 5/6 + 4/4 = 90%; scores are clamped to each criterion
    const marked = await req('POST', `/teacher/classes/${CLASS}/assignments/${a.id}/handins/${ME}/review`, THOMAS, { action: 'mark', scores: { c1: 5, c2: 9 }, feedback: 'Much better.' });
    expect(marked.body.handIn).toMatchObject({ state: 'marked', grade: 90, scores: { c1: 5, c2: 4 } });
    expect((await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { text: 'one more' })).status).toBe(409);
    expect((await req('DELETE', `/student/assignments/${a.id}/handin`, AHAMED)).status).toBe(409);
    const book = (await req('GET', `/teacher/classes/${CLASS}/gradebook`, THOMAS)).body;
    const row = book.rows.find((r: { studentId: string }) => r.studentId === ME);
    expect(row.cells[book.columns.findIndex((col: { id: string }) => col.id === a.id)]).toMatchObject({ state: 'marked', grade: 90 });
  });

  it('marking needs a grade, and only hand-ins can be reviewed', async () => {
    const { post, req } = await setup();
    const a = await post();
    expect((await req('POST', `/teacher/classes/${CLASS}/assignments/${a.id}/handins/${ME}/review`, THOMAS, { action: 'mark', grade: 80 })).body.code).toBe('nothing_handed_in');
    await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { text: 'Done' });
    expect((await req('POST', `/teacher/classes/${CLASS}/assignments/${a.id}/handins/${ME}/review`, THOMAS, { action: 'mark' })).status).toBe(400);
  });

  it('a student can undo a hand-in before it is marked', async () => {
    const { post, req } = await setup();
    const a = await post();
    await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { text: 'Done' });
    expect((await req('DELETE', `/student/assignments/${a.id}/handin`, AHAMED)).body.undone).toBe(true);
    expect((await req('GET', `/student/assignments/${a.id}`, AHAMED)).body.handIn).toBeNull();
  });

  it('flags answers that are very similar to a classmate\'s', async () => {
    const { req, post } = await setup();
    const a = await post();
    const essay = 'The poet describes the photograph of her mother at the beach and remembers how the sea was cold and the light was bright and the cousins laughed and the moment can never return because time moves on and memory is all that is left of the summer holiday by the water';
    await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { text: essay });
    // a second app student in the same class does not exist in the demo, so compare against a classmate via the rule directly
    const { checksFor } = await import('../src/schools/classroom');
    const checks = checksFor({ text: essay, files: [], state: 'handed_in', late: false, submittedAt: '', updatedAt: '', versions: 1, grade: null, scores: null, feedback: null, reviewedAt: null, reviewer: null }, [{ name: 'Zara Khan', text: `${essay} and that is all` }], false);
    expect(checks.map((x) => x.code)).toContain('similar');
  });
});

describe('private messages', () => {
  it('goes both ways with photos, and unread counts clear when read', async () => {
    const { post, req, upload } = await setup();
    const a = await post();
    const photo = (await upload(AHAMED, 'q.jpg', 'image/jpeg', JPEG)).body;
    const m = await req('POST', `/student/assignments/${a.id}/messages`, AHAMED, { text: 'Is page 3 needed?', fileIds: [photo.id] });
    expect(m.status).toBe(201);
    const list = (await req('GET', `/teacher/classes/${CLASS}/assignments/${a.id}/handins`, THOMAS)).body;
    expect(list.rows.find((r: { studentId: string }) => r.studentId === ME).unread).toBe(1);
    expect((await req('GET', '/teacher/inbox', THOMAS)).body.messages[0]).toMatchObject({ name: 'Ahamed Mehta', unread: 1, snippet: 'Is page 3 needed?' });
    const thread = (await req('GET', `/teacher/classes/${CLASS}/assignments/${a.id}/handins/${ME}`, THOMAS)).body;
    expect(thread.messages[0].files).toHaveLength(1);
    expect((await req('GET', '/teacher/inbox', THOMAS)).body.messages).toHaveLength(0);
    await req('POST', `/teacher/classes/${CLASS}/assignments/${a.id}/messages/${ME}`, THOMAS, { text: 'Yes, page 3 too.' });
    expect((await req('GET', `/student/assignments/${a.id}`, AHAMED)).body.unread).toBe(1);
    expect((await req('GET', `/student/assignments/${a.id}`, AHAMED)).body.unread).toBe(0);
    expect((await req('POST', `/student/assignments/${a.id}/messages`, AHAMED, { text: '' })).status).toBe(400);
  });
});

describe('reminders, announcements and access', () => {
  it('reminds only students who have not handed in', async () => {
    const { post, req } = await setup();
    const a = await post();
    const r = await req('POST', `/teacher/classes/${CLASS}/assignments/${a.id}/remind`, THOMAS, { note: 'Due Thursday!' });
    expect(r.body.reminded).toBe(30);
    const stream = (await req('GET', '/student/stream', AHAMED)).body;
    expect(stream.reminders[0]).toMatchObject({ itemId: a.id, note: 'Due Thursday!', teacherName: 'Ms. Sana Thomas' });
    await req('POST', `/student/reminders/${stream.reminders[0].id}/dismiss`, AHAMED);
    expect((await req('GET', '/student/stream', AHAMED)).body.reminders).toHaveLength(0);
    await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { text: 'Done' });
    expect((await req('POST', `/teacher/classes/${CLASS}/assignments/${a.id}/remind`, THOMAS, {})).body.reminded).toBe(29);
  });

  it('posts announcements, pins one, takes questions and shows them in the inbox', async () => {
    const { req } = await setup();
    const a1 = (await req('POST', `/teacher/classes/${CLASS}/announcements`, THOMAS, { text: 'Bring your notebooks tomorrow.', pinned: true })).body;
    const a2 = (await req('POST', `/teacher/classes/${CLASS}/announcements`, THOMAS, { text: 'Quiz on Thursday.', pinned: true })).body;
    const list = (await req('GET', `/teacher/classes/${CLASS}/stream`, THOMAS)).body.announcements;
    expect(list.map((x: { id: string; pinned: boolean }) => [x.id, x.pinned])).toEqual([[a2.id, true], [a1.id, false]]);
    const q = await req('POST', `/student/announcements/${a2.id}/replies`, AHAMED, { text: 'Which chapters?' });
    expect(q.status).toBe(201);
    expect((await req('GET', '/teacher/inbox', THOMAS)).body.questions[0]).toMatchObject({ announcementId: a2.id, count: 1 });
    await req('POST', `/teacher/announcements/${a2.id}/replies`, THOMAS, { text: 'Chapters 3 and 4.' });
    expect((await req('GET', '/teacher/inbox', THOMAS)).body.questions).toHaveLength(0);
    expect((await req('GET', '/student/stream', AHAMED)).body.announcements[0].replies).toHaveLength(2);
    expect((await req('DELETE', `/teacher/announcements/${a1.id}`, DESAI)).status).toBe(403);
    expect((await req('DELETE', `/teacher/announcements/${a1.id}`, THOMAS)).body.deleted).toBe(true);
  });

  it('keeps classes apart', async () => {
    const { post, req } = await setup();
    const a = await post();
    expect((await req('GET', `/teacher/classes/${CLASS}/assignments/${a.id}/handins`, DESAI)).status).toBe(403);
    expect((await req('GET', '/student/assignments/cls-math-10ab-2026-01-05', AHAMED)).status).toBe(404);
  });

  it('exports the gradebook as CSV for Excel', async () => {
    const { raw } = await setup();
    const res = await raw('GET', `/teacher/classes/${CLASS}/gradebook?format=csv`, THOMAS);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // BOM, so Excel reads it as UTF-8
    const lines = new TextDecoder().decode(bytes).trim().split('\r\n');
    expect(lines[0]).toMatch(/^Student,Section,Average %,Missing,/);
    expect(lines).toHaveLength(31);
  });

  it('lets a student hand in work that came from Teams (generated items) too', async () => {
    const { req } = await setup();
    const list = (await req('GET', '/student/school', AHAMED)).body.school.assignments;
    const open = list.find((x: { posted: boolean; format: string; status: string }) => !x.posted && x.format === 'task' && x.status === 'pending');
    expect(open).toBeTruthy();
    const r = await req('POST', `/student/assignments/${open.id}/handin`, AHAMED, { text: 'Done from the app' });
    expect(r.status).toBe(201);
  });
});

describe('copying an assignment to another class', () => {
  it('keeps the slides, rubric and photo setting, and lands with the other class', async () => {
    const { upload, post, req } = await setup();
    const slides = (await upload(THOMAS, 'Lesson 4.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', PPTX)).body;
    const a = await post({ attachmentIds: [slides.id], photosRequired: true, rubric: [{ label: 'Key points', points: 10 }] });
    const r = await req('POST', `/teacher/classes/${CLASS}/assignments/${a.id}/copy`, THOMAS, { toClassId: 'cls-eng-12' });
    expect(r.status).toBe(201);
    expect(r.body.class.id).toBe('cls-eng-12');
    expect(r.body.students).toBe(58);
    expect(r.body.assignment).toMatchObject({ title: a.title, photosRequired: true, rubric: [{ id: 'c1', label: 'Key points', points: 10 }] });
    expect(r.body.assignment.attachments[0].id).toBe(slides.id);
    expect((await req('POST', `/teacher/classes/${CLASS}/assignments/${a.id}/copy`, THOMAS, { toClassId: CLASS })).body.code).toBe('same_class');
    expect((await req('POST', `/teacher/classes/${CLASS}/assignments/${a.id}/copy`, THOMAS, { toClassId: 'cls-math-10ab' })).status).toBe(403);
  });
});

describe('api behaviour from the QA pass', () => {
  it('answers a wrong method with 405 and the methods it takes', async () => {
    const { raw } = await setup();
    const res = await raw('DELETE', '/teacher/inbox', THOMAS);
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET');
    expect((await raw('GET', '/no/such/route')).status).toBe(404);
  });
  it('refuses impossible and past due dates with the field named', async () => {
    const { req } = await setup();
    const bad = await req('POST', `/teacher/classes/${CLASS}/assignments`, THOMAS, { title: 'Bad date', dueDate: '2026-02-30' });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body.details)).toContain('not a real date');
    const past = await req('POST', `/teacher/classes/${CLASS}/assignments`, THOMAS, { title: 'Past', setDate: addDays(today, -10), dueDate: addDays(today, -3) });
    expect(past.status).toBe(400);
    expect(past.body.details[0].path).toBe('dueDate');
  });
  it('never invents hand-ins for work posted in Murshid', async () => {
    const { req, post } = await setup();
    const a = await post();
    const list = (await req('GET', `/teacher/classes/${CLASS}/assignments/${a.id}/handins`, THOMAS)).body;
    expect(list.counts).toMatchObject({ handedIn: 0, marked: 0 });
    expect(list.rows.every((r: { synthetic: boolean }) => !r.synthetic)).toBe(true);
  });
  it('clears the teacher reminder once the work is handed in', async () => {
    const { req, post } = await setup();
    const a = await post();
    await req('POST', `/teacher/classes/${CLASS}/assignments/${a.id}/remind`, THOMAS, {});
    expect((await req('GET', '/student/stream', AHAMED)).body.reminders).toHaveLength(1);
    await req('POST', `/student/assignments/${a.id}/handin`, AHAMED, { text: 'Done' });
    expect((await req('GET', '/student/stream', AHAMED)).body.reminders).toHaveLength(0);
  });
  it('gives unknown origins no CORS header', async () => {
    const { raw } = await setup();
    const res = await raw('GET', '/health', { origin: 'https://evil.example' });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
