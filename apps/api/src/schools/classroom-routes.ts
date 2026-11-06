/**
 * Classroom API: everything around an assignment after it is posted.
 *
 *   files     POST /files (base64 upload, 3 MB, type-checked), GET /files/:id (capability link)
 *   student   GET  /student/assignments/:id            the assignment, attachments, my hand-in, my thread with the teacher
 *             POST /student/assignments/:id/handin     text + photos/files (photos of notebook pages, scans, documents)
 *             DELETE /student/assignments/:id/handin   undo a hand-in (until it is marked)
 *             POST /student/assignments/:id/messages   private message to the teacher (text + photos)
 *             GET  /student/stream                     announcements from my classes + my reminders
 *             POST /student/announcements/:id/replies  ask a question under an announcement
 *             POST /student/reminders/:id/dismiss
 *   teacher   GET  /teacher/inbox                      to review, unread messages, unanswered questions (all my classes)
 *             GET  /teacher/classes/:id/assignments/:itemId/handins            every student: state, checks, unread
 *             GET  /teacher/classes/:id/assignments/:itemId/handins/:studentId the hand-in, checks, thread
 *             POST /teacher/classes/:id/assignments/:itemId/handins/:studentId/review   mark or return (grade, rubric, feedback)
 *             POST /teacher/classes/:id/assignments/:itemId/messages/:studentId         reply privately
 *             POST /teacher/classes/:id/assignments/:itemId/remind                       nudge who has not handed in
 *             GET/POST /teacher/classes/:id/stream | announcements; PATCH/DELETE /teacher/announcements/:id;
 *             POST /teacher/announcements/:id/replies
 *             GET  /teacher/classes/:id/gradebook?format=json|csv
 */
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import { dubaiDate } from '../lib/time';
import type { DemoStore, DemoView } from '../v1/store';
import type { RosterStudent, Stream } from './catalog';
import { SUBJECT_NAMES } from './catalog';
import {
  checksFor, cleanName, isLate, MAX_FILE_BYTES, MIME_KIND, refOf, rubricGrade, sniffOk, toCsv, words,
  type Announcement, type FileRef, type HandIn, type Message, type Thread,
} from './classroom';
import { assignedTo, initialsOf, shortDay, streamItems, streamsOf, submission, type WorkItem } from './engine';
import type { Staff } from './routes';
import type { SchoolStore } from './store';

interface Helpers {
  view: (c: Ctx) => Promise<DemoView>;
  staff: (c: Ctx) => Promise<Staff>;
  classOf: (s: Staff, id: string) => Stream;
  today: (c: Ctx) => string;
  nowMinutes: (d: Date) => number;
  classCard: (st: Stream) => unknown;
}

const fileId = z.string().min(8).max(64);
export const ClassroomSchemas = {
  Upload: z.object({
    name: z.string().trim().min(1).max(200),
    mime: z.string().max(120).refine((m) => m in MIME_KIND, 'this file type is not supported: use a photo (JPG, PNG, WebP), PDF, PowerPoint, Word, Excel or text file'),
    // base64 (a data: URL prefix is fine); 3 MB of file is ~4.2 MB of base64
    data: z.string().min(8).max(Math.ceil(MAX_FILE_BYTES / 3) * 4 + 120),
  }),
  HandIn: z.object({ text: z.string().max(8000).default(''), fileIds: z.array(fileId).max(12).default([]) }),
  Message: z.object({ text: z.string().trim().max(2000).default(''), fileIds: z.array(fileId).max(6).default([]) })
    .refine((m) => m.text.length > 0 || m.fileIds.length > 0, { message: 'write a message or attach a photo', path: ['text'] }),
  Review: z.object({
    action: z.enum(['mark', 'return']),
    grade: z.number().int().min(0).max(100).optional(),
    scores: z.record(z.string().max(8), z.number().min(0).max(100)).optional(),
    feedback: z.string().trim().max(2000).optional(),
  }),
  Remind: z.object({ studentIds: z.array(z.string().min(1).max(80)).max(200).optional(), note: z.string().trim().max(300).optional() }),
  Announce: z.object({
    text: z.string().trim().min(1).max(2000),
    fileIds: z.array(fileId).max(6).default([]),
    links: z.array(z.object({ url: z.string().trim().url().max(500).refine((u) => /^https?:\/\//.test(u), 'links must start with http(s)://'), label: z.string().trim().max(80).default('') })).max(6).default([]),
    pinned: z.boolean().default(false),
  }),
  AnnouncePatch: z.object({ pinned: z.boolean() }),
  ReplyText: z.object({ text: z.string().trim().min(1).max(1000) }),
  Gradebook: z.object({ format: z.enum(['json', 'csv']).default('json') }),
};

const SNIPPET = 140;

export function registerClassroom(api: Api, schools: SchoolStore, store: DemoStore, h: Helpers) {
  const room = schools.classroom;

  /* ---------- who is asking ---------- */
  async function student(c: Ctx): Promise<{ v: DemoView; r: RosterStudent }> {
    const v = await h.view(c);
    const r = schools.rosterByApp(v.profile.id);
    if (!r) throw new HTTPException(404, { message: 'assignments come with a school licence', cause: { code: 'no_school' } });
    return { v, r };
  }
  const isStaffRequest = async (c: Ctx) => {
    const whoami = c.get('deps').whoami;
    if (!whoami || (c.get('deps').config.authMode === 'dev' && !c.req.header('authorization'))) return Boolean(c.req.header('x-dev-role'));
    const me = await whoami(c);
    return me.role === 'teacher' || me.role === 'school_admin';
  };
  const teacherName = (s: Staff) => (s.role === 'teacher' ? s.teacher.name : 'School admin');

  /** An item this student has: a posted one (if it is for them) or one generated for their classes. */
  function itemForStudent(r: RosterStudent, id: string, day: string): WorkItem {
    const posted = schools.postedById.get(id);
    if (posted) {
      if ((schools.members[posted.streamId] ?? []).includes(r.id) && assignedTo(posted, r.id)) return posted;
      throw new HTTPException(404, { message: 'assignment not found' });
    }
    const school = schools.school(r.orgId);
    for (const st of streamsOf(school, r.id)) {
      if (!id.startsWith(`${st.id}-`)) continue;
      const it = streamItems(school, st, day).find((x) => x.id === id);
      if (it && it.setDate <= day) return it;
    }
    throw new HTTPException(404, { message: 'assignment not found' });
  }
  function itemForClass(st: Stream, itemId: string, day: string): WorkItem {
    const posted = schools.postedById.get(itemId);
    if (posted) { if (posted.streamId !== st.id) throw new HTTPException(404, { message: 'assignment not found' }); return posted; }
    const it = streamItems(schools.school(st.orgId), st, day).find((x) => x.id === itemId);
    if (!it) throw new HTTPException(404, { message: 'assignment not found' });
    return it;
  }
  function memberOf(st: Stream, item: WorkItem, studentId: string): RosterStudent {
    if (!(schools.members[st.id] ?? []).includes(studentId) || !assignedTo(item, studentId)) throw new HTTPException(404, { message: 'student not found in this assignment' });
    return schools.roster.find((x) => x.id === studentId)!;
  }
  /** Files the caller uploaded themselves (nobody can attach someone else's upload). */
  function ownFiles(ids: string[], owner: string): FileRef[] {
    return [...new Set(ids)].map((id) => {
      const f = room.files.get(id);
      if (!f || f.owner !== owner) throw new HTTPException(400, { message: 'a file was not found: upload it again', cause: { code: 'file_not_found' } });
      return refOf(f);
    });
  }
  const itemCard = (it: WorkItem) => {
    const t = schools.teachers.find((x) => x.id === it.teacherId);
    return {
      id: it.id, classId: it.streamId, title: it.title, subject: SUBJECT_NAMES[it.subject], teacher: t?.name ?? '', instructions: it.instructions,
      setDate: it.setDate, dueDate: it.dueDate, dueTime: it.dueTime, setLabel: shortDay(it.setDate), dueLabel: shortDay(it.dueDate), minutes: it.minutes,
      format: it.format ?? 'task', formUrl: it.formUrl ?? null, questions: it.questions ?? null, posted: it.posted,
      attachments: it.attachments ?? [], links: it.links ?? [], photosRequired: Boolean(it.photosRequired), rubric: it.rubric ?? null,
    };
  };
  const unreadFor = (th: Thread | undefined, who: 'student' | 'teacher') => {
    if (!th) return 0;
    return th.messages.slice(who === 'student' ? th.seenByStudent : th.seenByTeacher).filter((m) => m.from !== who).length;
  };
  const audit = (actor: string, actorRole: 'student' | 'admin', studentId: string | null, action: 'create' | 'update' | 'delete', resource: string, resourceId: string, summary: string, at: string) =>
    store.audit({ actor, actorRole, studentId, action, resource, resourceId, summary, at });

  /* ---------- files ---------- */
  api.route({ method: 'post', path: '/files', tag: 'classroom', auth: 'custom', body: ClassroomSchemas.Upload, summary: 'Upload a file (base64, up to 3 MB): a photo of notes, a PDF, slides or a document. Returns a link to use in hand-ins, messages and assignments.' },
    async (c, { body }) => {
      const b = body as z.output<typeof ClassroomSchemas.Upload>;
      let owner: string; let ownerRole: 'student' | 'teacher' | 'school_admin';
      if (await isStaffRequest(c)) { const s = await h.staff(c); owner = s.actor; ownerRole = s.role; }
      else { const v = await h.view(c); owner = v.profile.id; ownerRole = 'student'; }
      const b64 = b.data.replace(/^data:[^;,]+;base64,/, '');
      if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) throw new HTTPException(400, { message: 'file data must be base64', cause: { code: 'bad_encoding' } });
      const data = Buffer.from(b64, 'base64');
      if (data.length > MAX_FILE_BYTES) throw new HTTPException(413, { message: `that file is ${(data.length / 1048576).toFixed(1)} MB; the limit is 3 MB`, cause: { code: 'too_large' } });
      if (!sniffOk(b.mime, data)) throw new HTTPException(400, { message: "the file doesn't match its type: try saving it again", cause: { code: 'type_mismatch' } });
      const f = await room.putFile({ name: cleanName(b.name), mime: b.mime, kind: MIME_KIND[b.mime]!, data, owner, ownerRole, at: c.get('deps').now().toISOString() });
      return c.json(refOf(f), 201);
    });

  api.route({ method: 'get', path: '/files/:id', tag: 'classroom', auth: 'none', summary: 'Download a file by its link (images and PDFs open inline)' },
    async (c) => {
      const f = room.files.get(c.req.param('id')!);
      const data = f ? await room.fileBytes(f.id) : null;
      if (!f || !data) throw new HTTPException(404, { message: 'file not found' });
      const inline = f.kind === 'image' || f.kind === 'pdf';
      return new Response(new Uint8Array(data), {
        headers: {
          'content-type': f.kind === 'text' ? 'text/plain; charset=utf-8' : f.mime,
          'content-length': String(f.size),
          'content-disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
          'cache-control': 'private, max-age=86400, immutable',
          'x-content-type-options': 'nosniff',
          'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
        },
      });
    });

  /* ---------- student: one assignment ---------- */
  api.route({ method: 'get', path: '/student/assignments/:id', tag: 'classroom', auth: 'custom', summary: 'One assignment: instructions, attachments, my hand-in, my private thread with the teacher' },
    async (c) => {
      const { v, r } = await student(c);
      const day = dubaiDate(v.now);
      const item = itemForStudent(r, c.req.param('id')!, day);
      const hand = room.handins[item.id]?.[r.id] ?? null;
      const th = room.threads[item.id]?.[r.id];
      const unread = unreadFor(th, 'student');
      if (th) th.seenByStudent = th.messages.length;
      const sub = submission(r, item, day);
      return c.json({
        assignment: itemCard(item),
        handIn: hand,
        status: hand ? hand.state : schools.responses[item.id]?.[r.id] ? 'handed_in' : sub.status === 'missing' ? 'overdue' : 'assigned',
        overdue: !hand && item.dueDate < day,
        response: schools.responses[item.id]?.[r.id] ?? null,
        messages: th?.messages ?? [], unread,
        reminders: (room.reminders[r.id] ?? []).filter((x) => x.itemId === item.id && !x.dismissed),
      });
    });

  api.route({ method: 'post', path: '/student/assignments/:id/handin', tag: 'classroom', auth: 'custom', body: ClassroomSchemas.HandIn, summary: 'Hand in: a written answer and/or photos and files. Handing in again (before it is marked) updates it.' },
    async (c, { body }) => {
      const { v, r } = await student(c);
      const day = dubaiDate(v.now); const at = v.now.toISOString();
      const item = itemForStudent(r, c.req.param('id')!, day);
      if (item.format && item.format !== 'task') throw new HTTPException(400, { message: 'this assignment is a form: answer the form instead', cause: { code: 'is_form' } });
      const b = body as z.output<typeof ClassroomSchemas.HandIn>;
      const text = b.text.trim();
      const files = ownFiles(b.fileIds, v.profile.id);
      if (!text && !files.length) throw new HTTPException(400, { message: 'add your answer or a photo before handing in', cause: [{ path: 'text', message: 'required' }] });
      if (item.photosRequired && !files.some((f) => f.kind === 'image')) throw new HTTPException(400, { message: 'your teacher asked for photos of your notes: add at least one photo', cause: { code: 'photos_required' } });
      const prev = room.handins[item.id]?.[r.id];
      if (prev?.state === 'marked') throw new HTTPException(409, { message: 'this work is already marked: message your teacher to change it', cause: { code: 'already_marked' } });
      const late = isLate(day, h.nowMinutes(v.now), item.dueDate, item.dueTime);
      const next: HandIn = {
        text, files, state: 'handed_in', late, submittedAt: prev && prev.state === 'handed_in' ? prev.submittedAt : at, updatedAt: at,
        versions: (prev?.versions ?? 0) + (prev?.state === 'returned' || !prev ? 1 : 0),
        grade: null, scores: null, feedback: prev?.feedback ?? null, reviewedAt: prev?.reviewedAt ?? null, reviewer: prev?.reviewer ?? null,
      };
      (room.handins[item.id] ??= {})[r.id] = next;
      for (const rem of room.reminders[r.id] ?? []) if (rem.itemId === item.id) rem.dismissed = true;
      // tick off the matching task in the student's plan
      const rec = store.has(v.profile.id) ? store.record(v.profile.id, v.now) : null;
      const task = rec?.customTasks.find((t) => t.id === `school-${item.id}-${v.profile.id}`);
      if (task) task.status = 'done';
      c.get('deps').notify?.notify(item.teacherId, { kind: 'handin', title: `${r.name} handed in "${item.title}"${late ? ' (late)' : ''}`, body: text.slice(0, 120) || `${files.length} file${files.length === 1 ? '' : 's'}`, url: `/admin/teacher/assignments/${encodeURIComponent(item.id)}?class=${encodeURIComponent(item.streamId)}&student=${encodeURIComponent(r.id)}` });
      audit(v.profile.id, 'student', v.profile.id, prev ? 'update' : 'create', 'handin', item.id, `${prev ? (prev.state === 'returned' ? 'Resubmitted' : 'Updated the hand-in for') : 'Handed in'} "${item.title}"${files.length ? ` with ${files.length} file${files.length === 1 ? '' : 's'}` : ''}${late ? ' (late)' : ''}`, at);
      return c.json({ assignmentId: item.id, handIn: next, updated: Boolean(prev) }, prev ? 200 : 201);
    });

  api.route({ method: 'delete', path: '/student/assignments/:id/handin', tag: 'classroom', auth: 'custom', summary: 'Undo a hand-in (only before it is marked)' },
    async (c) => {
      const { v, r } = await student(c);
      const item = itemForStudent(r, c.req.param('id')!, dubaiDate(v.now));
      const prev = room.handins[item.id]?.[r.id];
      if (!prev) throw new HTTPException(404, { message: 'nothing handed in yet' });
      if (prev.state === 'marked') throw new HTTPException(409, { message: 'this work is already marked', cause: { code: 'already_marked' } });
      delete room.handins[item.id]![r.id];
      const rec = store.has(v.profile.id) ? store.record(v.profile.id, v.now) : null;
      const task = rec?.customTasks.find((t) => t.id === `school-${item.id}-${v.profile.id}`);
      if (task) task.status = 'todo';
      audit(v.profile.id, 'student', v.profile.id, 'delete', 'handin', item.id, `Undid the hand-in for "${item.title}"`, v.now.toISOString());
      return c.json({ assignmentId: item.id, undone: true, keptFiles: prev.files });
    });

  api.route({ method: 'post', path: '/student/assignments/:id/messages', tag: 'classroom', auth: 'custom', body: ClassroomSchemas.Message, summary: 'Message the teacher privately about this assignment (text and/or photos)' },
    async (c, { body }) => {
      const { v, r } = await student(c);
      const item = itemForStudent(r, c.req.param('id')!, dubaiDate(v.now));
      const b = body as z.output<typeof ClassroomSchemas.Message>;
      const at = v.now.toISOString();
      const msg: Message = { id: room.id('msg'), from: 'student', authorId: r.id, name: r.name, text: b.text, files: ownFiles(b.fileIds, v.profile.id), at };
      const th = room.thread(item.id, r.id);
      th.messages.push(msg); th.seenByStudent = th.messages.length;
      c.get('deps').notify?.notify(item.teacherId, { kind: 'message', title: `${r.name} about "${item.title}"`, body: b.text.slice(0, 140), url: `/admin/teacher/assignments/${encodeURIComponent(item.id)}?class=${encodeURIComponent(item.streamId)}&student=${encodeURIComponent(r.id)}` });
      return c.json(msg, 201);
    });

  /* ---------- student: stream + reminders ---------- */
  api.route({ method: 'get', path: '/student/stream', tag: 'classroom', auth: 'custom', summary: 'Announcements from my classes (pinned first) and reminders from my teachers' },
    async (c) => {
      const { r } = await student(c);
      const school = schools.school(r.orgId);
      const classes = streamsOf(school, r.id);
      const posts = classes.flatMap((st) => (room.announcements[st.id] ?? []).map((a) => ({ ...a, className: st.name, subject: SUBJECT_NAMES[st.subject] })))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at.localeCompare(a.at)).slice(0, 40);
      return c.json({ announcements: posts, reminders: (room.reminders[r.id] ?? []).filter((x) => !x.dismissed).slice(-20).reverse() });
    });

  api.route({ method: 'post', path: '/student/announcements/:id/replies', tag: 'classroom', auth: 'custom', body: ClassroomSchemas.ReplyText, summary: 'Ask a question or reply under a class announcement' },
    async (c, { body }) => {
      const { v, r } = await student(c);
      const a = findAnnouncement(c.req.param('id')!);
      if (!(schools.members[a.streamId] ?? []).includes(r.id)) throw new HTTPException(404, { message: 'announcement not found' });
      const reply = { id: room.id('rep'), from: 'student' as const, authorId: r.id, name: r.name, text: (body as { text: string }).text, at: v.now.toISOString() };
      a.replies.push(reply);
      return c.json(reply, 201);
    });

  api.route({ method: 'post', path: '/student/reminders/:id/dismiss', tag: 'classroom', auth: 'custom', summary: 'Dismiss a reminder from a teacher' },
    async (c) => {
      const { r } = await student(c);
      const rem = (room.reminders[r.id] ?? []).find((x) => x.id === c.req.param('id'));
      if (!rem) throw new HTTPException(404, { message: 'reminder not found' });
      rem.dismissed = true;
      return c.json({ id: rem.id, dismissed: true });
    });

  /* ---------- teacher: hand-ins for one assignment ---------- */
  function rowsFor(st: Stream, item: WorkItem, day: string) {
    const school = schools.school(st.orgId);
    const members = (schools.members[st.id] ?? []).filter((id) => assignedTo(item, id)).map((id) => school.roster.find((x) => x.id === id)!).filter(Boolean);
    const hands = room.handins[item.id] ?? {};
    const texts = members.flatMap((m) => (hands[m.id]?.text ? [{ id: m.id, name: m.name, text: hands[m.id]!.text }] : []));
    return members.map((m) => {
      const hand = hands[m.id];
      const th = room.threads[item.id]?.[m.id];
      const base = { studentId: m.id, name: m.name, section: m.section, initials: initialsOf(m.name), unread: unreadFor(th, 'teacher'), messages: th?.messages.length ?? 0 };
      if (hand) {
        const checks = checksFor(hand, texts.filter((t) => t.id !== m.id), Boolean(item.photosRequired));
        return { ...base, state: hand.state, late: hand.late, overdue: false, submittedAt: hand.submittedAt, grade: hand.grade, words: words(hand.text), photos: hand.files.filter((f) => f.kind === 'image').length, files: hand.files.length, versions: hand.versions, checks, synthetic: false };
      }
      const resp = schools.responses[item.id]?.[m.id];
      if (resp) return { ...base, state: 'handed_in' as const, late: false, overdue: false, submittedAt: resp.submittedAt, grade: null, words: 0, photos: 0, files: 0, versions: 1, checks: [], synthetic: false, form: true };
      const sub = item.posted && item.dueDate >= day ? { status: 'pending' as const, grade: null, submittedOn: null } : submission(m, item, day);
      if (sub.status === 'on_time' || sub.status === 'late' || sub.status === 'submitted') {
        const marked = sub.grade !== null && item.dueDate < day;
        return { ...base, state: marked ? 'marked' as const : 'handed_in' as const, late: sub.status === 'late', overdue: false, submittedAt: sub.submittedOn, grade: marked ? sub.grade : null, words: 0, photos: 0, files: 0, versions: 1, checks: [], synthetic: true };
      }
      return { ...base, state: 'not_started' as const, late: false, overdue: sub.status === 'missing', submittedAt: null, grade: null, words: 0, photos: 0, files: 0, versions: 0, checks: [], synthetic: false };
    });
  }

  api.route({ method: 'get', path: '/teacher/classes/:id/assignments/:itemId/handins', tag: 'classroom', auth: 'custom', summary: 'Every student on an assignment: handed in, late, returned, marked or not started, with checks and unread messages' },
    async (c) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const day = h.today(c);
      const item = itemForClass(st, c.req.param('itemId')!, day);
      const rows = rowsFor(st, item, day);
      const n = (state: string) => rows.filter((x) => x.state === state).length;
      const graded = rows.filter((x) => x.grade !== null);
      return c.json({
        class: h.classCard(st), assignment: itemCard(item),
        counts: { students: rows.length, handedIn: n('handed_in'), returned: n('returned'), marked: n('marked'), notStarted: n('not_started'), late: rows.filter((x) => x.late).length, overdue: rows.filter((x) => x.overdue).length, toReview: rows.filter((x) => x.state === 'handed_in' && !x.synthetic).length, unread: rows.reduce((t, x) => t + x.unread, 0) },
        average: graded.length ? Math.round(graded.reduce((t, x) => t + x.grade!, 0) / graded.length) : null,
        rows,
      });
    });

  api.route({ method: 'get', path: '/teacher/classes/:id/assignments/:itemId/handins/:studentId', tag: 'classroom', auth: 'custom', summary: "One student's hand-in with checks, rubric and the private thread (marks the thread read)" },
    async (c) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const day = h.today(c);
      const item = itemForClass(st, c.req.param('itemId')!, day);
      const m = memberOf(st, item, c.req.param('studentId')!);
      const row = rowsFor(st, item, day).find((x) => x.studentId === m.id)!;
      const th = room.threads[item.id]?.[m.id];
      if (th) th.seenByTeacher = th.messages.length;
      return c.json({
        assignment: itemCard(item), student: { id: m.id, name: m.name, section: m.section, initials: initialsOf(m.name) },
        handIn: room.handins[item.id]?.[m.id] ?? null, row, response: schools.responses[item.id]?.[m.id] ?? null,
        messages: th?.messages ?? [],
        order: rowsFor(st, item, day).map((x) => x.studentId),
      });
    });

  api.route({ method: 'post', path: '/teacher/classes/:id/assignments/:itemId/handins/:studentId/review', tag: 'classroom', auth: 'custom', body: ClassroomSchemas.Review, summary: 'Mark a hand-in (final) or return it for revision, with a grade or rubric scores and feedback' },
    async (c, { body }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const day = h.today(c);
      const item = itemForClass(st, c.req.param('itemId')!, day);
      const m = memberOf(st, item, c.req.param('studentId')!);
      const b = body as z.output<typeof ClassroomSchemas.Review>;
      const hand = room.handins[item.id]?.[m.id];
      if (!hand) throw new HTTPException(409, { message: `${m.name.split(' ')[0]} hasn't handed this in through Murshid yet`, cause: { code: 'nothing_handed_in' } });
      let grade = b.grade ?? null; let scores: Record<string, number> | null = null;
      if (item.rubric?.length && b.scores) {
        // a score above a row's maximum is a typing mistake: say so instead of quietly lowering it
        const over = item.rubric.filter((c) => (b.scores![c.id] ?? 0) > c.points);
        if (over.length) throw new HTTPException(400, { message: `score above the maximum for ${over.map((c) => c.label).join(', ')}`, cause: over.map((c) => ({ path: `scores.${c.id}`, message: `max ${c.points}` })) });
        ({ grade, scores } = rubricGrade(item.rubric, b.scores));
      }
      if (b.action === 'mark' && grade === null) throw new HTTPException(400, { message: 'add a grade (or rubric scores) to mark it', cause: [{ path: 'grade', message: 'required' }] });
      const at = c.get('deps').now().toISOString();
      hand.state = b.action === 'mark' ? 'marked' : 'returned';
      hand.grade = grade; hand.scores = scores; hand.feedback = b.feedback?.trim() || null; hand.reviewedAt = at; hand.reviewer = teacherName(s);
      if (b.feedback?.trim()) {
        const th = room.thread(item.id, m.id);
        th.messages.push({ id: room.id('msg'), from: 'teacher', authorId: s.actor, name: teacherName(s), text: `${b.action === 'mark' ? `Marked${grade !== null ? ` ${grade}%` : ''}` : 'Returned for revision'}: ${b.feedback.trim()}`, files: [], at, review: { action: b.action, grade: b.action === 'mark' ? grade : null, feedback: b.feedback.trim() } });
        th.seenByTeacher = th.messages.length;
      }
      if (m.appId) c.get('deps').notify?.notify(m.appId, b.action === 'mark'
        ? { kind: 'marked', title: `Marked: ${item.title}${grade !== null ? ` · ${grade}%` : ''}`, body: b.feedback?.trim().slice(0, 140) || `${teacherName(s)} marked your work.`, url: `/app/school/assignments/${encodeURIComponent(item.id)}` }
        : { kind: 'returned', title: `Returned for revision: ${item.title}`, body: b.feedback?.trim().slice(0, 140) || `${teacherName(s)} asked for another go.`, url: `/app/school/assignments/${encodeURIComponent(item.id)}` });
      audit(s.actor, 'admin', m.appId ?? null, 'update', 'handin', item.id, `${teacherName(s)} ${b.action === 'mark' ? `marked "${item.title}"${grade !== null ? ` (${grade}%)` : ''}` : `returned "${item.title}" for revision`} for ${m.name}`, at);
      return c.json({ studentId: m.id, handIn: hand });
    });

  api.route({ method: 'post', path: '/teacher/classes/:id/assignments/:itemId/messages/:studentId', tag: 'classroom', auth: 'custom', body: ClassroomSchemas.Message, summary: 'Reply privately to a student about an assignment' },
    async (c, { body }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const day = h.today(c);
      const item = itemForClass(st, c.req.param('itemId')!, day);
      const m = memberOf(st, item, c.req.param('studentId')!);
      const b = body as z.output<typeof ClassroomSchemas.Message>;
      const at = c.get('deps').now().toISOString();
      const msg: Message = { id: room.id('msg'), from: 'teacher', authorId: s.actor, name: teacherName(s), text: b.text, files: ownFiles(b.fileIds, s.actor), at };
      const th = room.thread(item.id, m.id);
      th.messages.push(msg); th.seenByTeacher = th.messages.length;
      if (m.appId) c.get('deps').notify?.notify(m.appId, { kind: 'message', title: `${teacherName(s)} about "${item.title}"`, body: b.text.slice(0, 140), url: `/app/school/assignments/${encodeURIComponent(item.id)}` });
      return c.json(msg, 201);
    });

  api.route({ method: 'post', path: '/teacher/classes/:id/assignments/:itemId/remind', tag: 'classroom', auth: 'custom', body: ClassroomSchemas.Remind, summary: "Remind students who haven't handed in (or chosen students): it shows in their app" },
    async (c, { body }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const day = h.today(c);
      const item = itemForClass(st, c.req.param('itemId')!, day);
      const b = body as z.output<typeof ClassroomSchemas.Remind>;
      const rows = rowsFor(st, item, day);
      const targets = b.studentIds ? rows.filter((x) => b.studentIds!.includes(x.studentId)) : rows.filter((x) => x.state === 'not_started' || x.state === 'returned');
      if (b.studentIds && targets.length !== new Set(b.studentIds).size) throw new HTTPException(400, { message: 'every chosen student must be on this assignment', cause: { code: 'not_in_assignment' } });
      const at = c.get('deps').now().toISOString();
      for (const t of targets) {
        const list = (room.reminders[t.studentId] ??= []);
        // one live reminder per assignment: a new one replaces the old
        for (const old of list) if (old.itemId === item.id) old.dismissed = true;
        list.push({ id: room.id('rem'), itemId: item.id, title: item.title, subject: SUBJECT_NAMES[item.subject], teacherName: teacherName(s), note: b.note || null, dueDate: item.dueDate, at, dismissed: false });
      }
      audit(s.actor, 'admin', null, 'create', 'reminder', item.id, `${teacherName(s)} reminded ${targets.length} student${targets.length === 1 ? '' : 's'} about "${item.title}"`, at);
      return c.json({ reminded: targets.length, names: targets.slice(0, 6).map((x) => x.name) }, 201);
    });

  /* ---------- teacher: inbox across classes ---------- */
  api.route({ method: 'get', path: '/teacher/inbox', tag: 'classroom', auth: 'custom', summary: 'Everything that needs the teacher across their classes: hand-ins to review, unread messages, unanswered questions' },
    async (c) => {
      const s = await h.staff(c); const day = h.today(c);
      const mine = schools.streams.filter((st) => st.orgId === s.orgId && (s.role !== 'teacher' || st.teacherId === s.teacher.id));
      const school = schools.school(s.orgId);
      const name = (id: string) => school.roster.find((x) => x.id === id)?.name ?? id;
      const toReview: unknown[] = []; const messages: unknown[] = []; const questions: unknown[] = [];
      for (const st of mine) {
        const items = new Map<string, WorkItem>();
        for (const id of new Set([...Object.keys(room.handins), ...Object.keys(room.threads)])) {
          const it = schools.postedById.get(id) ?? (id.startsWith(`${st.id}-`) ? streamItems(school, st, day).find((x) => x.id === id) : undefined);
          if (it && it.streamId === st.id) items.set(id, it);
        }
        for (const it of items.values()) {
          for (const [sid, hand] of Object.entries(room.handins[it.id] ?? {})) {
            if (hand.state === 'handed_in') toReview.push({ classId: st.id, className: st.name, itemId: it.id, title: it.title, studentId: sid, name: name(sid), at: hand.updatedAt, late: hand.late, files: hand.files.length, resubmitted: hand.versions > 1 });
          }
          for (const [sid, th] of Object.entries(room.threads[it.id] ?? {})) {
            const n = unreadFor(th, 'teacher');
            const last = th.messages[th.messages.length - 1];
            if (n && last) messages.push({ classId: st.id, className: st.name, itemId: it.id, title: it.title, studentId: sid, name: name(sid), unread: n, at: last.at, snippet: last.text.slice(0, SNIPPET) || (last.files.length ? `${last.files.length} photo${last.files.length === 1 ? '' : 's'}` : '') });
          }
        }
        for (const a of room.announcements[st.id] ?? []) {
          // questions after the teacher's last answer (by order, not time)
          let lastTeacher = -1; a.replies.forEach((x, i) => { if (x.from === 'teacher') lastTeacher = i; });
          const open = a.replies.slice(lastTeacher + 1).filter((x) => x.from === 'student');
          if (open.length) questions.push({ classId: st.id, className: st.name, announcementId: a.id, announcement: a.text.slice(0, SNIPPET), count: open.length, last: open[open.length - 1] });
        }
      }
      const byAt = (a: unknown, b: unknown) => String((b as { at?: string; last?: { at: string } }).at ?? (b as { last: { at: string } }).last.at).localeCompare(String((a as { at?: string; last?: { at: string } }).at ?? (a as { last: { at: string } }).last.at));
      return c.json({ toReview: toReview.sort(byAt), messages: messages.sort(byAt), questions: questions.sort(byAt), total: toReview.length + messages.length + questions.length });
    });

  /* ---------- teacher: class stream ---------- */
  function findAnnouncement(id: string): Announcement {
    for (const list of Object.values(room.announcements)) { const a = list.find((x) => x.id === id); if (a) return a; }
    throw new HTTPException(404, { message: 'announcement not found' });
  }
  const ownAnnouncement = async (c: Ctx) => {
    const s = await h.staff(c); const a = findAnnouncement(c.req.param('id')!);
    h.classOf(s, a.streamId); // throws if not this teacher's class
    return { s, a };
  };

  api.route({ method: 'get', path: '/teacher/classes/:id/stream', tag: 'classroom', auth: 'custom', summary: 'Class announcements (pinned first) with replies' },
    async (c) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!);
      const list = [...(room.announcements[st.id] ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at.localeCompare(a.at));
      return c.json({ class: h.classCard(st), announcements: list });
    });

  api.route({ method: 'post', path: '/teacher/classes/:id/announcements', tag: 'classroom', auth: 'custom', body: ClassroomSchemas.Announce, summary: 'Post an announcement to the class (text, files, links; optionally pinned)' },
    async (c, { body }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!);
      const b = body as z.output<typeof ClassroomSchemas.Announce>;
      const at = c.get('deps').now().toISOString();
      const a: Announcement = {
        id: room.id('ann'), streamId: st.id, authorId: s.actor, authorName: teacherName(s), text: b.text, files: ownFiles(b.fileIds, s.actor),
        links: b.links.map((l) => ({ url: l.url, label: l.label || l.url.replace(/^https?:\/\//, '').slice(0, 60) })), pinned: b.pinned, at, replies: [],
      };
      if (a.pinned) for (const x of room.announcements[st.id] ?? []) x.pinned = false;
      (room.announcements[st.id] ??= []).push(a);
      for (const rid of schools.members[st.id] ?? []) {
        const appId = schools.roster.find((x) => x.id === rid)?.appId;
        if (appId) c.get('deps').notify?.notify(appId, { kind: 'announcement', title: `${st.name}: ${teacherName(s)}`, body: b.text.slice(0, 140), url: '/app/school' });
      }
      audit(s.actor, 'admin', null, 'create', 'announcement', a.id, `${teacherName(s)} posted to ${st.name}: "${b.text.slice(0, 60)}"`, at);
      return c.json(a, 201);
    });

  api.route({ method: 'patch', path: '/teacher/announcements/:id', tag: 'classroom', auth: 'custom', body: ClassroomSchemas.AnnouncePatch, summary: 'Pin or unpin an announcement (one pinned per class)' },
    async (c, { body }) => {
      const { a } = await ownAnnouncement(c);
      const pinned = (body as { pinned: boolean }).pinned;
      if (pinned) for (const x of room.announcements[a.streamId] ?? []) x.pinned = false;
      a.pinned = pinned;
      return c.json(a);
    });

  api.route({ method: 'delete', path: '/teacher/announcements/:id', tag: 'classroom', auth: 'custom', summary: 'Delete an announcement' },
    async (c) => {
      const { s, a } = await ownAnnouncement(c);
      room.announcements[a.streamId] = (room.announcements[a.streamId] ?? []).filter((x) => x.id !== a.id);
      audit(s.actor, 'admin', null, 'delete', 'announcement', a.id, `${teacherName(s)} deleted an announcement`, c.get('deps').now().toISOString());
      return c.json({ id: a.id, deleted: true });
    });

  api.route({ method: 'post', path: '/teacher/announcements/:id/replies', tag: 'classroom', auth: 'custom', body: ClassroomSchemas.ReplyText, summary: 'Answer under an announcement' },
    async (c, { body }) => {
      const { s, a } = await ownAnnouncement(c);
      const reply = { id: room.id('rep'), from: 'teacher' as const, authorId: s.actor, name: teacherName(s), text: (body as { text: string }).text, at: c.get('deps').now().toISOString() };
      a.replies.push(reply);
      return c.json(reply, 201);
    });

  /* ---------- teacher: gradebook ---------- */
  api.route({ method: 'get', path: '/teacher/classes/:id/gradebook', tag: 'classroom', auth: 'custom', query: ClassroomSchemas.Gradebook, summary: 'Grades for every student and assignment set so far (JSON, or CSV for Excel)' },
    async (c, { query }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const day = h.today(c);
      const items = streamItems(schools.school(s.orgId), st, day).filter((it) => it.setDate <= day);
      const school = schools.school(s.orgId);
      const members = (schools.members[st.id] ?? []).map((id) => school.roster.find((x) => x.id === id)!).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name));
      const cols = items.map((it) => ({ id: it.id, title: it.title, due: it.dueDate, dueLabel: shortDay(it.dueDate) }));
      const byItem = new Map(items.map((it) => [it.id, new Map(rowsFor(st, it, day).map((r) => [r.studentId, r]))]));
      const rows = members.map((m) => {
        const cells = items.map((it) => {
          if (!assignedTo(it, m.id)) return { state: 'not_assigned', grade: null };
          const r = byItem.get(it.id)!.get(m.id)!;
          return { state: r.state === 'not_started' && r.overdue ? 'missing' : r.state, grade: r.grade, late: r.late };
        });
        const g = cells.filter((x) => x.grade !== null).map((x) => x.grade!);
        return { studentId: m.id, name: m.name, section: m.section, average: g.length ? Math.round(g.reduce((t, x) => t + x, 0) / g.length) : null, missing: cells.filter((x) => x.state === 'missing').length, cells };
      });
      if ((query as { format: string }).format === 'csv') {
        const label = (x: { state: string; grade: number | null; late?: boolean }) => x.grade !== null ? x.grade : x.state === 'missing' ? 'Missing' : x.state === 'not_assigned' ? '' : x.state === 'handed_in' ? 'Handed in' : x.state === 'returned' ? 'Returned' : '';
        const csv = toCsv([
          ['Student', 'Section', 'Average %', 'Missing', ...cols.map((x) => `${x.title} (due ${x.dueLabel})`)],
          ...rows.map((r) => [r.name, r.section, r.average, r.missing, ...r.cells.map(label)]),
        ]);
        return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${st.id}-gradebook-${day}.csv"` } });
      }
      return c.json({ class: h.classCard(st), columns: cols, rows });
    });
}
