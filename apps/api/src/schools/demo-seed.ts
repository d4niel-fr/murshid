/**
 * The demo school's "lived-in" state, so every screen of the public demo has something real-looking in it without
 * anyone typing data in: work a teacher posted with hand-ins to mark and a question waiting, class announcements with
 * replies, a reminder, notifications, leave requests for the school office, a check-in question for today, and
 * published Term 1 reports. Only the fictional demo school is touched; real schools start empty.
 */
import { addDays, dubaiDate } from '../lib/time';
import type { NotificationHub, Note } from '../notify/hub';
import { SUBJECT_NAMES, type Stream } from './catalog';
import type { HandIn, Message } from './classroom';
import type { WorkItem } from './engine';
import { commentBank, type ReportEntry } from './life';
import type { SchoolStore } from './store';

const FLAGSHIP_APP = 'demo-ideal';

export function seedDemoSchool(schools: SchoolStore, hub: NotificationHub | undefined, now: Date, averages: (st: Stream, day: string) => Map<string, { average: number | null; missing: number }>) {
  const me = schools.rosterByApp(FLAGSHIP_APP);
  if (!me || schools.org(me.orgId)?.real) return;
  const today = dubaiDate(now);
  const room = schools.classroom; const life = schools.life;
  const iso = (daysAgo: number, hour = 10) => new Date(now.getTime() - daysAgo * 86_400_000 - (now.getUTCHours() - hour + 4) * 3_600_000).toISOString();
  const teacher = (id: string) => schools.teachers.find((t) => t.id === id)!;
  const classes = schools.streams.filter((st) => (schools.members[st.id] ?? []).includes(me.id));
  const others = (st: Stream) => (schools.members[st.id] ?? []).filter((id) => id !== me.id).map((id) => schools.roster.find((r) => r.id === id)!).filter(Boolean);
  const eng = classes.find((c) => c.subject === 'english') ?? classes[0]!;
  const maths = classes.find((c) => c.subject === 'maths') ?? classes[1] ?? eng;
  const thomas = teacher(eng.teacherId); const desai = teacher(maths.teacherId);

  /* ---------- work a teacher posted, with hand-ins to mark ---------- */
  const essay: WorkItem = {
    id: `${eng.id}-demo-poetry-essay`, streamId: eng.id, subject: eng.subject, teacherId: eng.teacherId, title: 'Compare two poems about power',
    instructions: 'Compare how power is presented in Ozymandias and one other poem from the anthology. About 600 words; quote at least three lines from each poem.',
    setDate: addDays(today, -3), dueDate: addDays(today, 1), dueTime: '08:00', minutes: 60, source: 'portal', posted: true, createdAt: iso(3, 9),
    rubric: [{ id: 'r1', label: 'Analysis of language', points: 40 }, { id: 'r2', label: 'Comparison', points: 30 }, { id: 'r3', label: 'Use of quotations', points: 30 }],
  };
  const sheet: WorkItem = {
    id: `${maths.id}-demo-simultaneous`, streamId: maths.id, subject: maths.subject, teacherId: maths.teacherId, title: 'Simultaneous equations practice sheet',
    instructions: 'Questions 1–12 on the sheet. Show every step; check each answer by substituting back.', setDate: addDays(today, -1), dueDate: addDays(today, 4), dueTime: '08:00',
    minutes: 40, source: 'portal', posted: true, createdAt: iso(1, 13), photosRequired: true,
  };
  for (const it of [essay, sheet]) if (!schools.postedById.has(it.id)) { schools.posted.push(it); schools.postedById.set(it.id, it); }

  const texts = [
    'Both poems show power as something that does not last. In Ozymandias, Shelley uses the “colossal wreck” to show that even a king’s statue is destroyed by time, while in London Blake shows power through the “mind-forged manacles” that people cannot escape…',
    'Ozymandias presents power as arrogant: “Look on my works, ye Mighty, and despair!” The irony is that nothing is left. In comparison, Exposure shows nature as more powerful than people…',
    'I think power is shown as temporary in both. The sonnet form in Ozymandias is broken, which mirrors the broken statue…',
    'Shelley uses a frame narrative so the king’s words reach us second hand, which already makes him seem smaller…',
    'In my essay I compare Ozymandias with My Last Duchess. Both speakers are rulers who want to control how they are remembered…',
    'Power in nature vs power of humans: Storm on the Island and Ozymandias both show nature winning in the end…',
  ];
  const hands = (room.handins[essay.id] ??= {});
  others(eng).slice(0, 9).forEach((s, i) => {
    if (hands[s.id]) return;
    const at = iso(i < 3 ? 2 : 1, 15 + (i % 5));
    const h: HandIn = { text: texts[i % texts.length]!, files: [], state: i === 0 ? 'marked' : i === 1 ? 'returned' : 'handed_in', late: false, submittedAt: at, updatedAt: at, versions: 1,
      grade: i === 0 ? 86 : null, scores: i === 0 ? { r1: 34, r2: 26, r3: 26 } : null, feedback: i === 0 ? 'Thoughtful comparison with well-chosen quotations. Next time, say more about form.' : i === 1 ? 'Good start: please add your second poem and at least three quotations from it.' : null,
      reviewedAt: i <= 1 ? iso(1, 18) : null, reviewer: i <= 1 ? thomas.name : null };
    hands[s.id] = h;
  });
  // fixed ids: every server copy builds the same demo, so a reply sent to one copy finds the post on another
  const msg = (from: 'student' | 'teacher', authorId: string, name: string, text: string, at: string): Message => ({ id: `demo-msg-${authorId}`, from, authorId, name, text, files: [], at });
  const asker = others(eng)[10];
  const th = (room.threads[essay.id] ??= {});
  if (asker && !th[asker.id]) th[asker.id] = { messages: [msg('student', asker.id, asker.name, 'Miss, can I compare Ozymandias with Exposure instead of London?', iso(0, 9))], seenByStudent: 1, seenByTeacher: 0 };
  if (!th[me.id]) th[me.id] = { messages: [msg('teacher', thomas.id, thomas.name, 'Ahamed: remember to quote at least three lines from each poem, and say what the form adds.', iso(1, 16))], seenByStudent: 0, seenByTeacher: 1 };

  /* ---------- announcements with replies ---------- */
  const post = (st: Stream, text: string, daysAgo: number, pinned = false, replies: [string, string, 'student' | 'teacher'][] = []) => {
    const list = (room.announcements[st.id] ??= []);
    if (list.some((a) => a.text === text)) return;
    const t = teacher(st.teacherId);
    list.push({ id: `demo-ann-${st.id}-${list.length}`, streamId: st.id, authorId: t.id, authorName: t.name, text, files: [], links: [], pinned, at: iso(daysAgo, 8), replies: replies.map(([who, body, from], i) => ({ id: `demo-rep-${st.id}-${list.length}-${i}`, from, authorId: from === 'teacher' ? t.id : who, name: from === 'teacher' ? t.name : who, text: body, at: iso(Math.max(0, daysAgo - 1), 12 + i) })) });
  };
  const someone = others(eng)[4]?.name ?? 'A student';
  post(eng, 'Mock exam next Thursday, Period 2 in the hall. Bring two black pens. We will revise unseen poetry in Monday’s lesson.', 2, true, [[someone, 'Is the mock open book?', 'student'], ['', 'No, closed book, but you get the anthology poems printed in the paper.', 'teacher']]);
  post(eng, 'Great discussion on Ozymandias today. The slides are on Teams if you missed anything.', 5);
  post(maths, 'Revision session on Wednesday after school in M12 for anyone who wants more practice on simultaneous equations.', 1);
  for (const st of classes.filter((c) => c !== eng && c !== maths)) post(st, `Welcome back! This week in ${SUBJECT_NAMES[st.subject]} we start a new unit. Check the plan in Murshid and ask if anything is unclear.`, 4);

  /* ---------- a reminder from a teacher ---------- */
  const rem = (room.reminders[me.id] ??= []);
  if (!rem.some((r) => r.itemId === essay.id)) rem.push({ id: `demo-rem-${essay.id}`, itemId: essay.id, title: essay.title, subject: SUBJECT_NAMES[eng.subject], teacherName: thomas.name, note: 'Due tomorrow at 8 AM: hand it in tonight if you can.', dueDate: essay.dueDate, at: iso(0, 7), dismissed: false });

  /* ---------- notifications ---------- */
  if (hub && !(hub.inbox[FLAGSHIP_APP]?.length)) {
    const n = (kind: Note['kind'], title: string, body: string, url: string, daysAgo: number, hour: number, read: boolean): Note => ({ id: `demo-${kind}-${daysAgo}-${hour}`, kind, title, body, url, at: iso(daysAgo, hour), read });
    hub.inbox[FLAGSHIP_APP] = [
      n('reminder', `${thomas.name}: ${essay.title}`, 'Due tomorrow at 8 AM.', `/app/school/assignments/${encodeURIComponent(essay.id)}`, 0, 7, false),
      n('message', `${thomas.name} about "${essay.title}"`, 'Remember to quote at least three lines from each poem.', `/app/school/assignments/${encodeURIComponent(essay.id)}`, 1, 16, false),
      n('assignment', `New from ${desai.name}: ${sheet.title}`, 'Due in 4 days. Murshid added time for it to your plan.', `/app/school/assignments/${encodeURIComponent(sheet.id)}`, 1, 13, false),
      n('points', '+2 for teamwork', `${teacher(classes.find((c) => c.subject === 'business')?.teacherId ?? eng.teacherId).name}: group presentation`, '/app/points', 2, 11, true),
      n('report', 'Your Term 1 reports are ready', 'Comments from each of your teachers.', '/app/reports', 3, 15, true),
      n('announcement', `${eng.name}: ${thomas.name}`, 'Mock exam next Thursday, Period 2 in the hall.', '/app/school', 2, 8, true),
    ];
  }
  if (hub && !(hub.inbox[thomas.id]?.length)) {
    hub.inbox[thomas.id] = others(eng).slice(2, 6).map((s, i) => ({ id: `demo-handin-${i}`, kind: 'handin' as const, title: `${s.name} handed in "${essay.title}"`, body: texts[(i + 2) % texts.length]!.slice(0, 120), url: `/admin/teacher/assignments/${encodeURIComponent(essay.id)}?class=${encodeURIComponent(eng.id)}&student=${encodeURIComponent(s.id)}`, at: iso(1, 15 + i), read: false }));
  }

  /* ---------- the school office: leave requests ---------- */
  if (!life.leave.some((l) => l.orgId === me.orgId)) {
    const [a, b, c] = schools.roster.filter((r) => r.orgId === me.orgId && r.id !== me.id).slice(3, 6);
    const leave = (r: typeof a, from: number, to: number, reason: 'illness' | 'appointment' | 'family' | 'competition', note: string, by: 'student' | 'parent', status: 'pending' | 'approved') => r && life.leave.push({
      id: `demo-leave-${r.id}`, orgId: me.orgId, studentId: r.id, from: addDays(today, from), to: addDays(today, to), reason, note, by, byName: by === 'parent' ? `Parent of ${r.name.split(' ')[0]}` : r.name,
      status, decidedBy: status === 'approved' ? 'School office' : null, decidedAt: status === 'approved' ? iso(1, 10) : null, reply: status === 'approved' ? 'Approved. Get well soon.' : '', at: iso(status === 'approved' ? 2 : 0, 8),
    });
    leave(a, 1, 1, 'appointment', 'Orthodontist at 10:30, back after lunch.', 'parent', 'pending');
    leave(b, 3, 4, 'competition', 'Emirates swimming championship in Abu Dhabi.', 'student', 'pending');
    leave(c, -2, -1, 'illness', 'Fever, doctor’s note to follow.', 'parent', 'approved');
  }

  /* ---------- today's check-in question ---------- */
  if (!(life.prompts[eng.id] ?? []).some((p) => p.date === today)) (life.prompts[eng.id] ??= []).push({ id: `demo-prompt-${today}`, streamId: eng.id, question: 'How ready do you feel for next week’s mock?', date: today, by: thomas.name });

  /* ---------- published Term 1 reports ---------- */
  for (const st of classes) {
    if ((life.published[st.id] ?? []).includes('T1')) continue;
    const avg = averages(st, today);
    const book = ((life.reports[st.id] ??= {}).T1 ??= {});
    for (const r of [me, ...others(st).slice(0, 6)]) {
      const a = avg.get(r.id) ?? { average: null, missing: 0 };
      const lines = commentBank(r.name, SUBJECT_NAMES[st.subject], { average: a.average, attendance: 97, points: 6, missing: a.missing });
      const entry: ReportEntry = { comment: [lines[0], lines[1], lines.at(-1)].filter(Boolean).join(' '), effort: (a.average ?? 75) >= 80 ? 4 : 3, updatedAt: iso(3, 14), by: teacher(st.teacherId).name };
      book[r.id] ??= entry;
    }
    (life.published[st.id] ??= []).push('T1');
  }
}
