'use client';

import { Copy, GraduationCap, KeyRound, Plus, RefreshCw, Trash2, Upload, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/shell';
import { Badge, Button, Card, Empty, ErrorBox } from '@/components/ui';
import { api } from '@/lib/api';
import { useData } from '@/lib/use-data';
import { parseRoster } from '@/lib/roster';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Setup {
  school: { id: string; name: string; joinCode: string | null; licence: { seats: number | null } | null; students: number; teachers: number; classes: number };
  teachers: { id: string; name: string; email: string; subject: string; subjectName: string; signedIn: boolean }[];
  students: { id: string; name: string; email: string | null; grade: number | null; section: string; usesApp: boolean }[];
  classes: { id: string; name: string; subjectName: string; teacher: { id: string; name: string }; students: number; joinCode: string | null }[];
  subjects: { id: string; name: string }[];
}

const input = 'h-10 w-full rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--brand-light)]';

export default function SchoolSetupPage() {
  const setup = useData<Setup>('/school/setup', 'staff');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [t, setT] = useState({ name: '', email: '', subject: 'english' });
  const [rosterText, setRosterText] = useState('');
  const [cls, setCls] = useState({ name: '', subject: 'english', teacherId: '', sections: [] as string[] });
  const [copied, setCopied] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key); setError(null);
    try { await fn(); await setup.reload(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  };
  const copy = (text: string) => { void navigator.clipboard?.writeText(text); setCopied(text); setTimeout(() => setCopied(null), 1500); };
  const d = setup.data;
  const sections = useMemo(() => [...new Set((d?.students ?? []).map((s) => s.section))].sort(), [d]);
  const parsed = useMemo(() => parseRoster(rosterText), [rosterText]);

  return (
    <>
      <PageHeader title="School setup" sub="Invite teachers, add your students, and make classes. Microsoft 365 schools can sync all of this instead (School & licence)." />
      <ErrorBox error={setup.error ?? error} />
      {!d ? <Empty>Loading…</Empty> : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title={<span className="flex items-center gap-2"><KeyRound className="size-4" />School code</span>} action={<Badge>{d.school.students} / {d.school.licence?.seats ?? '∞'} seats</Badge>}>
            <p className="text-sm text-[var(--text-muted)]">Students type this when they set up Murshid, to join {d.school.name}.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--surface-2)] px-4 py-2 font-mono text-lg tracking-[0.15em]">{d.school.joinCode ?? '—'}</span>
              {d.school.joinCode && <Button size="sm" variant="outline" onClick={() => copy(d.school.joinCode!)}><Copy className="size-3.5" />{copied === d.school.joinCode ? 'Copied' : 'Copy'}</Button>}
              <Button size="sm" variant="ghost" disabled={busy === 'code'} onClick={() => { if (window.confirm('Make a new school code? The old one stops working.')) void run('code', () => api('/school/join-code', { method: 'POST', as: 'staff' })); }}><RefreshCw className="size-3.5" />New code</Button>
            </div>
          </Card>

          <Card title={<span className="flex items-center gap-2"><GraduationCap className="size-4" />Teachers ({d.teachers.length})</span>}>
            <form onSubmit={(e) => { e.preventDefault(); void run('teacher', async () => { await api('/school/teachers', { method: 'POST', body: t, as: 'staff' }); setT({ name: '', email: '', subject: t.subject }); }); }} className="grid gap-2 sm:grid-cols-[1fr_1fr_9rem_auto]">
              <input aria-label="Teacher name" required placeholder="Name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} className={input} />
              <input aria-label="Teacher email" required type="email" placeholder="email@school.ae" value={t.email} onChange={(e) => setT({ ...t, email: e.target.value })} className={input} dir="ltr" />
              <select aria-label="Subject" value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} className={input}>{d.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <Button type="submit" size="sm" disabled={busy === 'teacher'}><Plus className="size-3.5" />Invite</Button>
            </form>
            <p className="mt-2 text-xs text-[var(--text-muted)]">They sign in with that email (Microsoft, Google or an emailed link).</p>
            <ul className="mt-3 divide-y divide-[var(--border)]">
              {d.teachers.map((x) => (
                <li key={x.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1"><span className="block font-medium">{x.name}</span><span className="block truncate text-xs text-[var(--text-muted)]">{x.email} · {x.subjectName}</span></span>
                  {x.signedIn ? <Badge tone="success">Signed in</Badge> : <Badge>Invited</Badge>}
                  <button aria-label={`Remove ${x.name}`} onClick={() => { if (window.confirm(`Remove ${x.name}?`)) void run(`rm-${x.id}`, () => api(`/school/teachers/${x.id}`, { method: 'DELETE', as: 'staff' })); }} className="grid size-9 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={<span className="flex items-center gap-2"><Users className="size-4" />Students ({d.students.length})</span>}>
            <label htmlFor="roster" className="text-sm font-medium">Add students</label>
            <p className="mb-2 text-xs text-[var(--text-muted)]">One per line: name, school email, grade, section. You can paste straight from a spreadsheet.</p>
            <textarea id="roster" rows={5} value={rosterText} onChange={(e) => setRosterText(e.target.value)} placeholder={'Lina Haddad, lina@school.ae, 9, 9A\nYousef Ali, yousef@school.ae, 9, 9A'} className="w-full rounded-[var(--radius)] border border-[var(--border)] bg-white p-3 font-mono text-[13px] outline-none focus:border-[var(--brand-light)]" dir="ltr" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-[var(--text-muted)]">{parsed.rows.length} ready{parsed.bad.length ? ` · line ${parsed.bad.slice(0, 5).join(', ')} need a grade` : ''}</span>
              <Button size="sm" disabled={!parsed.rows.length || busy === 'roster'} onClick={() => void run('roster', async () => { const r = await api<{ added: number; skipped: string[] }>('/school/roster', { method: 'POST', body: { students: parsed.rows }, as: 'staff' }); setRosterText(''); if (r.skipped.length) setError(`${r.added} added; ${r.skipped.length} were already on the list.`); })}><Upload className="size-3.5" />Add {parsed.rows.length || ''} students</Button>
            </div>
            {d.students.length > 0 && (
              <ul className="mt-4 max-h-72 divide-y divide-[var(--border)] overflow-y-auto">
                {d.students.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1"><span className="block font-medium">{x.name}</span><span className="block truncate text-xs text-[var(--text-muted)]">{x.email ?? 'no email'} · Grade {x.grade ?? '?'} · {x.section}</span></span>
                    {x.usesApp ? <Badge tone="success">Uses the app</Badge> : <Badge>Not yet</Badge>}
                    <button aria-label={`Remove ${x.name}`} onClick={() => { if (window.confirm(`Remove ${x.name} from the school?`)) void run(`rs-${x.id}`, () => api(`/school/roster/${x.id}`, { method: 'DELETE', as: 'staff' })); }} className="grid size-9 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"><Trash2 className="size-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={<span className="flex items-center gap-2"><Plus className="size-4" />Classes ({d.classes.length})</span>}>
            <form onSubmit={(e) => { e.preventDefault(); void run('class', async () => { await api('/school/classes', { method: 'POST', body: { name: cls.name, subject: cls.subject, teacherId: cls.teacherId || d.teachers[0]?.id, sections: cls.sections }, as: 'staff' }); setCls({ ...cls, name: '', sections: [] }); }); }} className="grid gap-2 sm:grid-cols-2">
              <input aria-label="Class name" required placeholder="e.g. Grade 9 Arabic 9A" value={cls.name} onChange={(e) => setCls({ ...cls, name: e.target.value })} className={`${input} sm:col-span-2`} />
              <select aria-label="Subject" value={cls.subject} onChange={(e) => setCls({ ...cls, subject: e.target.value })} className={input}>{d.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <select aria-label="Teacher" required value={cls.teacherId} onChange={(e) => setCls({ ...cls, teacherId: e.target.value })} className={input}><option value="">Teacher…</option>{d.teachers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              {sections.length > 0 && (
                <fieldset className="sm:col-span-2"><legend className="mb-1 text-xs text-[var(--text-muted)]">Add whole sections (optional)</legend>
                  <div className="flex flex-wrap gap-1.5">{sections.map((sec) => {
                    const on = cls.sections.includes(sec);
                    return <button key={sec} type="button" aria-pressed={on} onClick={() => setCls({ ...cls, sections: on ? cls.sections.filter((x) => x !== sec) : [...cls.sections, sec] })} className={`h-8 rounded-full px-3 text-xs font-medium ${on ? 'bg-[var(--deep)] text-white' : 'bg-[var(--surface-2)]'}`}>{sec}</button>;
                  })}</div>
                </fieldset>
              )}
              <Button type="submit" size="sm" className="sm:col-span-2 sm:justify-self-start" disabled={busy === 'class' || !d.teachers.length}><Plus className="size-3.5" />Make the class</Button>
            </form>
            {!d.teachers.length && <p className="mt-2 text-xs text-[var(--text-muted)]">Invite a teacher first.</p>}
            <ul className="mt-4 divide-y divide-[var(--border)]">
              {d.classes.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                  <span className="min-w-0 flex-1"><span className="block font-medium">{x.name}</span><span className="block text-xs text-[var(--text-muted)]">{x.subjectName} · {x.teacher.name} · {x.students} students</span></span>
                  {x.joinCode && <button onClick={() => copy(x.joinCode!)} title="Students can join with this code" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--surface-2)] px-3 font-mono text-xs">{copied === x.joinCode ? 'Copied' : x.joinCode}<Copy className="size-3" /></button>}
                  <button aria-label={`Delete ${x.name}`} onClick={() => { if (window.confirm(`Delete ${x.name}? Its posted work stays in the records.`)) void run(`rc-${x.id}`, () => api(`/school/classes/${x.id}`, { method: 'DELETE', as: 'staff' })); }} className="grid size-9 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"><Trash2 className="size-4" /></button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  );
}
