import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import {
  CourseCreate, CourseUpdate, InboundEmail, MaterialCreate, MaterialKind, MaterialUpdate, MaterialUpload,
  type Course, type Material, type Student, type Task,
} from '../domain';
import { authMiddleware } from '../lib/auth';
import { currentStudent, notFound, type Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import { parseLmsEmail } from '../services/email-parser';

async function ownCourse(c: Ctx, id: string): Promise<Course> {
  const s = await currentStudent(c);
  const co = await c.get('deps').repo.courses.get(id);
  if (!co || co.student_id !== s.id) return notFound('course');
  return co;
}

async function ownMaterial(c: Ctx, id: string): Promise<Material> {
  const m = (await c.get('deps').repo.materials.get(id)) ?? notFound('material');
  await ownCourse(c, m.course_id).catch(() => notFound('material'));
  return m;
}

const DEFAULT_MINUTES: Record<Material['kind'], number> = { assignment: 60, exam: 120, note: 30, announcement: 0 };

/** Assignments/exams with a due date become tasks so they show up in the planner. */
async function taskForMaterial(c: Ctx, studentId: string, m: Material): Promise<Task | null> {
  if (!m.due_at || (m.kind !== 'assignment' && m.kind !== 'exam')) return null;
  const { repo } = c.get('deps');
  const existing = await repo.tasks.findOne({ student_id: studentId, linked_material_id: m.id });
  if (existing) return existing;
  return repo.tasks.create({
    student_id: studentId, title: m.kind === 'exam' ? `Revise: ${m.title}` : m.title,
    kind: m.kind === 'exam' ? 'study' : 'assignment', due_at: m.due_at, est_minutes: DEFAULT_MINUTES[m.kind],
    status: 'todo', linked_goal_id: null, linked_material_id: m.id, linked_opportunity_id: null, ai_use_level: 'none',
  });
}

/** Resolve the student from a forwarding address: inbox+<student_id>@domain or <student_id>@domain. */
function studentIdFromAddress(to: string): string | null {
  const addr = to.match(/<([^>]+)>/)?.[1] ?? to;
  const local = addr.split('@')[0]?.trim() ?? '';
  const id = local.includes('+') ? local.split('+').slice(1).join('+') : local;
  return id || null;
}

export function registerCourses(api: Api) {
  api.route({ method: 'get', path: '/courses', tag: 'courses', summary: 'List my courses' }, async (c) => {
    const s = await currentStudent(c);
    return c.json({ items: await c.get('deps').repo.courses.list({ student_id: s.id }) });
  });
  api.route({ method: 'post', path: '/courses', tag: 'courses', summary: 'Create a course', body: CourseCreate }, async (c, { body }) => {
    const s = await currentStudent(c);
    return c.json(await c.get('deps').repo.courses.create({ ...body, student_id: s.id }), 201);
  });
  api.route({ method: 'get', path: '/courses/:id', tag: 'courses', summary: 'Get a course' }, async (c) => c.json(await ownCourse(c, c.req.param('id')!)));
  api.route({ method: 'patch', path: '/courses/:id', tag: 'courses', summary: 'Update a course', body: CourseUpdate }, async (c, { body }) => {
    const co = await ownCourse(c, c.req.param('id')!);
    return c.json(await c.get('deps').repo.courses.update(co.id, body));
  });
  api.route({ method: 'delete', path: '/courses/:id', tag: 'courses', summary: 'Delete a course and its materials' }, async (c) => {
    const co = await ownCourse(c, c.req.param('id')!);
    const { repo } = c.get('deps');
    for (const m of await repo.materials.list({ course_id: co.id })) await repo.materials.delete(m.id);
    await repo.courses.delete(co.id);
    return c.body(null, 204);
  });

  api.route({
    method: 'get', path: '/materials', tag: 'materials', summary: 'List my materials',
    query: z.object({ course_id: z.string().optional(), kind: MaterialKind.optional(), due_before: z.string().optional(), due_after: z.string().optional() }),
  }, async (c, { query }) => {
    const s = await currentStudent(c);
    const { repo } = c.get('deps');
    const courses = await repo.courses.list({ student_id: s.id });
    const ids = new Set(courses.map((co) => co.id));
    if (query.course_id && !ids.has(query.course_id)) notFound('course');
    let items = (await repo.materials.list({ kind: query.kind, course_id: query.course_id })).filter((m) => ids.has(m.course_id));
    if (query.due_before) items = items.filter((m) => m.due_at && m.due_at < new Date(query.due_before!).toISOString());
    if (query.due_after) items = items.filter((m) => m.due_at && m.due_at >= new Date(query.due_after!).toISOString());
    items.sort((a, b) => (a.due_at ?? b.ingested_at).localeCompare(b.due_at ?? a.ingested_at));
    return c.json({ items });
  });
  api.route({ method: 'get', path: '/courses/:id/materials', tag: 'materials', summary: 'List materials of a course' }, async (c) => {
    const co = await ownCourse(c, c.req.param('id')!);
    return c.json({ items: await c.get('deps').repo.materials.list({ course_id: co.id }) });
  });
  api.route({ method: 'post', path: '/materials', tag: 'materials', summary: 'Create a material (assignments/exams with due_at also create a task)', body: MaterialCreate }, async (c, { body }) => {
    const s = await currentStudent(c);
    await ownCourse(c, body.course_id);
    const { repo, now } = c.get('deps');
    const m = await repo.materials.create({ ...body, ingested_at: now().toISOString() });
    const task = await taskForMaterial(c, s.id, m);
    return c.json({ ...m, task }, 201);
  });
  api.route({
    method: 'post', path: '/materials/upload', tag: 'materials', summary: 'Register an uploaded file (metadata only)',
    description: 'The client uploads the file to storage (Supabase Storage) and posts the resulting URL + metadata here. ' +
      'AI-LATER: text extraction / summarisation of the file into body_text.',
    body: MaterialUpload,
  }, async (c, { body }) => {
    const s = await currentStudent(c);
    await ownCourse(c, body.course_id);
    const { repo, now } = c.get('deps');
    const m = await repo.materials.create({
      course_id: body.course_id, title: body.title, kind: body.kind, body_text: body.body_text, file_url: body.file_url,
      due_at: body.due_at, source: 'upload', external_id: null, ingested_at: now().toISOString(),
    });
    const task = body.create_task ? await taskForMaterial(c, s.id, m) : null;
    return c.json({
      ...m, task,
      file: { name: body.file_name ?? null, mime_type: body.mime_type ?? null, size_bytes: body.size_bytes ?? null },
    }, 201);
  });
  api.route({ method: 'get', path: '/materials/:id', tag: 'materials', summary: 'Get a material' }, async (c) => c.json(await ownMaterial(c, c.req.param('id')!)));
  api.route({ method: 'patch', path: '/materials/:id', tag: 'materials', summary: 'Update a material', body: MaterialUpdate }, async (c, { body }) => {
    const m = await ownMaterial(c, c.req.param('id')!);
    if (body.course_id) await ownCourse(c, body.course_id);
    return c.json(await c.get('deps').repo.materials.update(m.id, body));
  });
  api.route({ method: 'delete', path: '/materials/:id', tag: 'materials', summary: 'Delete a material' }, async (c) => {
    const m = await ownMaterial(c, c.req.param('id')!);
    await c.get('deps').repo.materials.delete(m.id);
    return c.body(null, 204);
  });

  api.route({
    method: 'post', path: '/inbox/email', tag: 'inbox', auth: 'custom',
    summary: 'Inbound-email webhook: parse a forwarded LMS email into a material (+ task)',
    description: 'Auth: either header `x-inbox-secret: $INBOX_WEBHOOK_SECRET` (provider webhook; student resolved from ' +
      '`to` = inbox+<student_id>@$INBOX_DOMAIN) or a normal user token (student = caller). Rule-based parsing; AI-LATER.',
    body: InboundEmail,
  }, async (c, { body }) => {
    const { repo, config, now } = c.get('deps');
    let student: Student;
    const secret = c.req.header('x-inbox-secret');
    if (secret !== undefined) {
      if (!config.inboxSecret || secret !== config.inboxSecret) throw new HTTPException(401, { message: 'invalid inbox secret' });
      const id = studentIdFromAddress(body.to);
      const s = id ? await repo.students.get(id) : null;
      if (!s) return notFound('inbox recipient');
      c.set('auth', { userId: s.auth_user_id, email: null, role: 'student', via: 'webhook' });
      student = s;
    } else {
      await authMiddleware(c, async () => {});
      student = await currentStudent(c);
    }

    const courses = await repo.courses.list({ student_id: student.id });
    if (body.message_id) {
      const ids = new Set(courses.map((co) => co.id));
      const dup = (await repo.materials.list({ external_id: body.message_id })).find((m) => ids.has(m.course_id));
      if (dup) return c.json({ duplicate: true, material: dup }, 200);
    }
    const parsed = parseLmsEmail(body, { now: now(), knownCourses: courses.map((co) => co.name) });

    const courseName = parsed.course_name ?? 'Inbox';
    let course = courses.find((co) => co.name.toLowerCase() === courseName.toLowerCase()) ?? null;
    const created_course = !course;
    course ??= await repo.courses.create({
      student_id: student.id, name: courseName, teacher: null,
      source: parsed.lms === 'other' ? 'email' : parsed.lms, external_id: null,
    });
    const material = await repo.materials.create({
      course_id: course.id, title: parsed.title, kind: parsed.kind, body_text: body.text || null, file_url: null,
      due_at: parsed.due_at, source: `email:${parsed.lms}`, external_id: body.message_id ?? null, ingested_at: now().toISOString(),
    });
    const task = await taskForMaterial(c, student.id, material);
    return c.json({ parsed, course, created_course, material, task }, 201);
  });
}
