import { HTTPException } from 'hono/http-exception';
import { StudentCreate, StudentUpdate, type Student } from '../domain';
import { audit, consentState, currentStudent, forbidden, notFound, type Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import { ageOn } from '../lib/time';

/** Who may read a student profile: the student, an admin, or a counsellor of the same school when consented. */
async function readableStudent(c: Ctx, id: string): Promise<Student> {
  const { repo } = c.get('deps');
  const auth = c.get('auth');
  const s = (await repo.students.get(id)) ?? notFound('student');
  if (auth.role === 'admin' || s.auth_user_id === auth.userId) return s;
  if (auth.role === 'counsellor' && auth.schoolId && auth.schoolId === s.school_id) {
    const cs = await consentState(c, s);
    if (!cs.minor || cs.guardian_consent === 'granted') {
      await audit(c, 'read', `students/${s.id}`);
      return s;
    }
    forbidden('student has not consented to counsellor access');
  }
  return notFound('student'); // do not reveal existence
}

async function ownStudent(c: Ctx, id: string): Promise<Student> {
  const s = await readableStudent(c, id);
  const auth = c.get('auth');
  if (auth.role !== 'admin' && s.auth_user_id !== auth.userId) forbidden('only the student can modify this profile');
  return s;
}

export function registerStudents(api: Api) {
  api.route({ method: 'get', path: '/me', tag: 'me', summary: 'Current user, role, student profile and consent state' }, async (c) => {
    const auth = c.get('auth');
    const { repo } = c.get('deps');
    const student = await repo.students.findOne({ auth_user_id: auth.userId });
    const guardian_of = auth.role === 'guardian' && auth.email
      ? (await repo.guardians.list({ email: auth.email })).map((g) => ({ student_id: g.student_id, consent_status: g.consent_status }))
      : [];
    return c.json({
      user: { id: auth.userId, email: auth.email, role: auth.role, auth_via: auth.via },
      student,
      consent: student ? await consentState(c, student) : null,
      guardian_of,
    });
  });

  api.route({ method: 'post', path: '/students', tag: 'students', summary: 'Create the caller\'s student profile (13+ only)', body: StudentCreate }, async (c, { body }) => {
    const auth = c.get('auth');
    const { repo, now } = c.get('deps');
    if (auth.role !== 'student' && auth.role !== 'admin') forbidden('only students can create a profile');
    if (await repo.students.findOne({ auth_user_id: auth.userId })) {
      throw new HTTPException(409, { message: 'profile already exists' });
    }
    if (ageOn(body.date_of_birth, now()) < 13) forbidden('Murshid is for students aged 13 and over');
    const s = await repo.students.create({ ...body, auth_user_id: auth.userId, created_at: now().toISOString() });
    return c.json(s, 201);
  });

  api.route({ method: 'get', path: '/students/:id', tag: 'students', summary: 'Get a student profile' }, async (c) => {
    return c.json(await readableStudent(c, c.req.param('id')!));
  });

  api.route({ method: 'patch', path: '/students/:id', tag: 'students', summary: 'Update a student profile', body: StudentUpdate }, async (c, { body }) => {
    const s = await ownStudent(c, c.req.param('id')!);
    const { repo, now } = c.get('deps');
    if (body.date_of_birth && ageOn(body.date_of_birth, now()) < 13) forbidden('Murshid is for students aged 13 and over');
    return c.json(await repo.students.update(s.id, body));
  });

  api.route({
    method: 'delete', path: '/students/:id', tag: 'students', summary: 'Delete a student profile and all their rows',
    description: 'In-memory cascade. Production delete/export is owned by packages/privacy.',
  }, async (c) => {
    const s = await ownStudent(c, c.req.param('id')!);
    const { repo } = c.get('deps');
    const goals = await repo.goals.list({ student_id: s.id });
    for (const g of goals) for (const m of await repo.milestones.list({ goal_id: g.id })) await repo.milestones.delete(m.id);
    const courses = await repo.courses.list({ student_id: s.id });
    for (const co of courses) for (const m of await repo.materials.list({ course_id: co.id })) await repo.materials.delete(m.id);
    const owned = [repo.goals, repo.courses, repo.tasks, repo.calendarEvents, repo.applications, repo.achievements,
      repo.cvVersions, repo.connections, repo.guardians] as const;
    for (const col of owned) {
      for (const row of await (col as typeof repo.tasks).list({ student_id: s.id } as never)) await col.delete(row.id);
    }
    await repo.students.delete(s.id);
    await audit(c, 'delete', `students/${s.id}`);
    return c.body(null, 204);
  });

  // convenience for clients that do not know their student id yet
  api.route({ method: 'get', path: '/students/me/consent', tag: 'students', summary: 'Age and guardian-consent state for the caller' }, async (c) => {
    return c.json(await consentState(c, await currentStudent(c)));
  });
}
