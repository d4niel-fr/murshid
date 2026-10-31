'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, ExternalLink, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { EntityForm } from '@/components/entity-form';
import { PageHeader } from '@/components/shell';
import { Badge, Bar, Button, Card, Empty, ErrorBox, MiniBars, Modal, Stat, Tabs } from '@/components/ui';
import { api, studentUrl } from '@/lib/api';
import {
  achievementForm, activityForm, applicationForm, assessmentForm, cvForm, goalForm, linksForm, milestoneForm, profileForm, projectForm, sessionForm,
  subjectForm, taskForm, type FormDef,
} from '@/lib/forms';
import { useData } from '@/lib/use-data';
import { AuditTable } from '@/components/audit-table';
import { BuddySwitch } from '@/components/buddy-switch';

type Editor = { def: FormDef; title: string; initial?: Record<string, unknown>; submit: (data: any) => Promise<unknown> } | null;

const statusTone = (s: string) => (s === 'accepted' || s === 'done' || s === 'graded' ? 'success' : s === 'rejected' ? 'danger' : s === 'submitted' || s === 'upcoming' ? 'info' : 'neutral') as 'success' | 'danger' | 'info' | 'neutral';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function StudentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: d, error, reload } = useData<any>(`/admin/students/${id}`);
  const [tab, setTab] = useState('profile');
  const [editor, setEditor] = useState<Editor>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const base = `/admin/students/${id}`;

  const run = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try { await fn(); await reload(); } catch (e) { setActionError((e as Error).message); }
  };
  const open = (def: FormDef, title: string, submit: (data: any) => Promise<unknown>, initial?: Record<string, unknown>) => setEditor({ def, title, submit, initial });
  const del = (path: string, what: string) => { if (window.confirm(`Delete ${what}?`)) void run(() => api(path, { method: 'DELETE' })); };

  if (error) return <ErrorBox error={error} />;
  if (!d) return <Empty>Loading…</Empty>;
  const s = d.summary;
  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'academics', label: 'Academics', count: d.assessments.length },
    { id: 'activities', label: 'Sports & activities', count: d.activities.length },
    { id: 'tasks', label: 'Tasks & deadlines', count: d.tasks.custom.length },
    { id: 'goals', label: 'Goals', count: d.goals.length },
    { id: 'opportunities', label: 'Opportunities', count: d.opportunities.length },
    { id: 'projects', label: 'Side projects', count: d.projects.length },
    { id: 'cv', label: 'CV & links' },
    { id: 'audit', label: 'Change log', count: d.audit.length },
  ];

  return (
    <>
      <Link href="/" className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"><ArrowLeft className="size-4" />Students</Link>
      <PageHeader
        title={<span className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">{s.initials}</span>{s.name}{s.flagship && <Badge tone="warning">Flagship persona</Badge>}<Badge>synthetic</Badge></span>}
        sub={`${s.classLabel} · ${s.school} · ${s.curriculumLabel} · ${s.emirateLabel} · age ${s.age} · ${s.id}`}
        action={<div className="flex gap-2">
          <a className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 text-sm hover:bg-[var(--surface-2)]" href={studentUrl(`/student/cv/linkedin.pdf`)} onClick={(e) => { e.preventDefault(); void openPdf(id); }}><FileText className="size-4" />CV PDF</a>
          {s.createdBy === 'admin' && <Button variant="danger" onClick={() => { if (window.confirm('Delete this student?')) void api(base, { method: 'DELETE' }).then(() => router.push('/')); }}><Trash2 className="size-4" />Delete</Button>}
        </div>} />
      <div className="mb-4 grid grid-cols-5 gap-3">
        <Stat label="Average" value={s.average === null ? '—' : `${s.average}%`} sub={`${s.subjects} subjects`} />
        <Stat label="Goals" value={s.goalsProgress === null ? '—' : `${s.goalsProgress}%`} sub="average progress" />
        <Stat label="Open tasks (7 days)" value={s.openTasksWeek} sub={s.overdue ? `${s.overdue} overdue` : 'none overdue'} />
        <Stat label="Activities" value={s.activities.length} sub={s.lastSession ? `last session ${s.lastSession}` : 'no sessions'} />
        <Stat label="Projects" value={s.projects.length} sub={s.projects.join(', ') || '—'} />
      </div>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="mt-4 flex flex-col gap-4">
        <ErrorBox error={actionError} />

        {tab === 'profile' && <BuddySwitch studentId={id} />}
        {tab === 'profile' && (
          <Card title="Profile" action={<Button size="sm" variant="outline" onClick={() => open(profileForm, 'Edit profile', (b) => api(base, { method: 'PATCH', body: b }), d.profile)}><Pencil className="size-3.5" />Edit</Button>}>
            <dl className="grid grid-cols-3 gap-x-6 gap-y-3 text-sm">
              {Object.entries(d.profile).map(([k, v]) => (
                <div key={k}><dt className="eyebrow">{profileLabel(k)}</dt><dd className="mt-0.5">{Array.isArray(v) ? v.join(', ') || '—' : String(v || '—')}</dd></div>
              ))}
            </dl>
          </Card>
        )}

        {tab === 'academics' && (
          <>
            <Card title="Subjects" pad={false} action={<Button size="sm" variant="outline" onClick={() => open(subjectForm, 'Add subject', (b) => api(`${base}/subjects`, { method: 'POST', body: b }), { target: 85 })}><Plus className="size-3.5" />Subject</Button>}>
              {!d.subjects.length ? <Empty>No subjects yet.</Empty> : (
                <table className="tbl"><thead><tr><th>Subject</th><th>Teacher</th><th>Current</th><th>Target</th><th>12-week change</th><th /></tr></thead><tbody>
                  {d.subjects.map((x: any) => (
                    <tr key={x.id}><td className="font-medium">{x.name}</td><td>{x.teacher}</td><td className="tabular-nums">{x.current}%</td><td className="tabular-nums">{x.target}%</td>
                      <td><Badge tone={x.trend === 'up' ? 'success' : x.trend === 'down' ? 'danger' : 'neutral'}>{x.delta12w > 0 ? '+' : ''}{x.delta12w}</Badge></td>
                      <td className="text-right"><RowActions onEdit={() => open(subjectForm, `Edit ${x.name}`, (b) => api(`${base}/subjects/${x.id}`, { method: 'PATCH', body: b }), x)} onDelete={() => del(`${base}/subjects/${x.id}`, x.name)} /></td></tr>
                  ))}
                </tbody></table>
              )}
            </Card>
            <Card title={`Assessments (${d.assessments.length}, newest first)`} pad={false} action={<Button size="sm" onClick={() => open(assessmentForm(d.subjects), 'Add assessment', (b) => api(`${base}/assessments`, { method: 'POST', body: b }), { subjectId: d.subjects[0]?.id, kind: 'test', maxScore: 50 })}><Plus className="size-3.5" />Assessment</Button>}>
              <div className="max-h-[520px] overflow-y-auto">
                <table className="tbl"><thead><tr><th>Date</th><th>Subject</th><th>Title</th><th>Kind</th><th>Score</th><th>Status</th><th /></tr></thead><tbody>
                  {d.assessments.slice(0, 150).map((a: any) => (
                    <tr key={a.id}><td className="whitespace-nowrap tabular-nums">{a.date}</td><td>{a.subject}</td><td>{a.title}{a.source !== 'generated' && <Badge tone="accent" className="ml-1.5">{a.source}</Badge>}</td><td>{a.kindLabel}</td>
                      <td className="tabular-nums">{a.score === null ? '—' : `${a.score}/${a.maxScore} (${a.percent}%)`}</td><td><Badge tone={statusTone(a.status)}>{a.status}</Badge></td>
                      <td className="text-right"><RowActions onEdit={() => open(assessmentForm(d.subjects), 'Edit assessment', (b) => api(`${base}/assessments/${a.id}`, { method: 'PATCH', body: b }), a)} onDelete={() => del(`${base}/assessments/${a.id}`, a.title)} /></td></tr>
                  ))}
                </tbody></table>
              </div>
            </Card>
          </>
        )}

        {tab === 'activities' && (
          <>
            <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => open(activityForm, 'Add sport / activity', (b) => api(`${base}/activities`, { method: 'POST', body: b }), { kind: 'gym', days: '1, 3', minutes: 60, weeklyTargetMinutes: 120 })}><Plus className="size-3.5" />Activity</Button></div>
            {d.activities.map((a: any) => (
              <Card key={a.id} title={<span>{a.name} <span className="font-normal text-[var(--text-muted)]">· {a.detail}{a.role ? ` · ${a.role}` : ''}</span></span>}
                action={<>
                  <Button size="sm" onClick={() => open(sessionForm(a.metricDefs.map((m: any) => m.key)), `Log ${a.name} session`, (b) => api(`${base}/activities/${a.id}/sessions`, { method: 'POST', body: toSession(b) }), { date: d.tasks.week[0]?.date, minutes: a.minutesPerSession, type: 'training' })}><Plus className="size-3.5" />Session</Button>
                  <RowActions onEdit={() => open(activityForm, `Edit ${a.name}`, (b) => { const { kind: _k, ...rest } = b; return api(`${base}/activities/${a.id}`, { method: 'PATCH', body: rest }); }, { ...a, kind: a.id, days: a.days, minutes: a.minutesPerSession })} onDelete={() => del(`${base}/activities/${a.id}`, a.name)} />
                </>}>
                <div className="grid grid-cols-[1fr_1.4fr] gap-6">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <Kv k="Schedule" v={a.schedule} /><Kv k="Weekly target" v={`${a.weeklyTargetMinutes} min`} />
                    <Kv k="This week" v={`${a.totals.thisWeekMinutes} min`} /><Kv k="Year" v={`${a.totals.sessions} sessions · ${a.totals.hours} h`} />
                    {a.metricDefs.map((m: any) => <Kv key={m.key} k={`${m.label} (best)`} v={a.bestMetrics[m.key] !== undefined ? `${a.bestMetrics[m.key]} ${m.unit}` : '—'} />)}
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    <table className="tbl text-xs"><thead><tr><th>Date</th><th>Type</th><th>Min</th><th>Metrics / note</th><th /></tr></thead><tbody>
                      {(a.sessions ?? []).map((x: any) => (
                        <tr key={x.id}><td className="tabular-nums">{x.date}</td><td>{x.type ?? 'training'}</td><td>{x.minutes}</td>
                          <td>{Object.entries(x.metrics).map(([k, v]) => `${k} ${v}`).join(' · ')}{x.note ? ` — ${x.note}` : ''}</td>
                          <td className="text-right"><Button size="sm" variant="danger" aria-label="Delete session" onClick={() => del(`${base}/sessions/${x.id}`, 'this session')}><Trash2 className="size-3" /></Button></td></tr>
                      ))}
                    </tbody></table>
                  </div>
                </div>
              </Card>
            ))}
            {!d.activities.length && <Empty>No activities yet.</Empty>}
          </>
        )}

        {tab === 'tasks' && (
          <>
            <Card title="Tasks & deadlines added by staff, Murshid or the student" pad={false} action={<Button size="sm" onClick={() => open(taskForm(d.subjects), 'Add task / deadline', (b) => api(`${base}/tasks`, { method: 'POST', body: b }), { date: d.tasks.week[0]?.date, time: '17:00', durationMinutes: 30, kind: 'assignment' })}><Plus className="size-3.5" />Task</Button>}>
              {!d.tasks.custom.length ? <Empty>None yet. Tasks you add here appear in the student’s Today and Planner.</Empty> : (
                <table className="tbl"><thead><tr><th>Due</th><th>Title</th><th>Kind</th><th>Source</th><th>Status</th><th /></tr></thead><tbody>
                  {d.tasks.custom.map((t: any) => (
                    <tr key={t.id}><td className="whitespace-nowrap tabular-nums">{t.date} {t.time}</td><td>{t.title}{t.notes && <div className="text-xs text-[var(--text-muted)]">{t.notes}</div>}</td><td>{t.kind}</td>
                      <td><Badge tone={t.source === 'murshid' ? 'accent' : t.source === 'admin' ? 'info' : 'neutral'}>{t.source}</Badge></td><td><Badge tone={statusTone(t.status)}>{t.status}</Badge></td>
                      <td className="whitespace-nowrap text-right">
                        <Button size="sm" variant="ghost" onClick={() => run(() => api(`${base}/tasks/${t.id}`, { method: 'PATCH', body: { status: t.status === 'done' ? 'todo' : 'done' } }))}><Check className="size-3.5" />{t.status === 'done' ? 'Reopen' : 'Done'}</Button>
                        <RowActions onEdit={() => open(taskForm(d.subjects), 'Edit task', (b) => { const { kind: _k, subjectId: _s, ...rest } = b; return api(`${base}/tasks/${t.id}`, { method: 'PATCH', body: rest }); }, t)} onDelete={() => del(`${base}/tasks/${t.id}`, t.title)} />
                      </td></tr>
                  ))}
                </tbody></table>
              )}
            </Card>
            <Card title="What the student sees for the next 7 days" pad={false}>
              <table className="tbl text-xs"><thead><tr><th>Date</th><th>Time</th><th>Task</th><th>Source</th><th>Status</th></tr></thead><tbody>
                {[...d.tasks.overdue, ...d.tasks.week].map((t: any) => (
                  <tr key={t.id + t.date}><td className="tabular-nums">{t.date}</td><td>{t.time}</td><td>{t.title}</td><td>{t.source ?? 'generated'}</td><td>{t.overdue ? <Badge tone="danger">overdue</Badge> : <Badge tone={statusTone(t.status)}>{t.status}</Badge>}</td></tr>
                ))}
              </tbody></table>
            </Card>
          </>
        )}

        {tab === 'goals' && (
          <Card title="Goals" pad={false} action={<Button size="sm" onClick={() => open(goalForm, 'Add goal', (b) => api(`${base}/goals`, { method: 'POST', body: b }), { category: 'academic', better: 'higher', start: 0, current: 0 })}><Plus className="size-3.5" />Goal</Button>}>
            <table className="tbl"><thead><tr><th>Goal</th><th>Category</th><th>Measured from</th><th>Progress</th><th>Current / target</th><th>Due</th><th /></tr></thead><tbody>
              {d.goals.map((g: any) => (
                <tr key={g.id}><td className="font-medium">{g.title}</td><td>{g.category}</td><td><Badge>{g.sourceKind}</Badge></td>
                  <td className="w-40"><div className="flex items-center gap-2"><Bar value={g.progress} tone={g.progress >= 100 ? 'success' : 'accent'} /><span className="text-xs tabular-nums">{g.progress}%</span></div></td>
                  <td className="tabular-nums">{g.current} / {g.target} {g.unit}</td><td className="tabular-nums">{g.dueDate}</td>
                  <td className="text-right"><RowActions onEdit={() => open(goalForm, 'Edit goal', (b) => { const { start: _s, better: _b, ...rest } = b; if (g.sourceKind !== 'manual') delete rest.current; return api(`${base}/goals/${g.id}`, { method: 'PATCH', body: rest }); }, g)} onDelete={() => del(`${base}/goals/${g.id}`, g.title)} /></td></tr>
              ))}
            </tbody></table>
          </Card>
        )}

        {tab === 'opportunities' && (
          <>
            <Card title="In the student's feed (best match first)" pad={false} action={<Link href="/opportunities" className="text-sm text-[var(--accent)] hover:underline">Publish a new opportunity →</Link>}>
              <table className="tbl"><thead><tr><th>Opportunity</th><th>Type</th><th>Deadline</th><th>Match</th><th>Source</th><th /></tr></thead><tbody>
                {d.opportunities.map((o: any) => (
                  <tr key={o.id}><td><div className="font-medium">{o.title}</div><div className="text-xs text-[var(--text-muted)]">{o.organizer} · {o.why}</div></td><td>{o.typeLabel}</td>
                    <td className="whitespace-nowrap tabular-nums">{o.deadline} <span className="text-xs text-[var(--text-muted)]">({o.daysLeft}d)</span></td><td className="tabular-nums">{o.matchScore}</td>
                    <td><Badge tone={o.source === 'admin' ? 'info' : 'neutral'}>{o.source === 'admin' ? 'published by school' : 'matched'}</Badge></td>
                    <td className="text-right">{o.source !== 'admin' && <Button size="sm" variant="danger" onClick={() => del(`${base}/opportunities/${o.id}`, `${o.title} from this feed`)}><Trash2 className="size-3" /></Button>}</td></tr>
                ))}
              </tbody></table>
            </Card>
            <Card title="Applications & outcomes" pad={false} action={<Button size="sm" onClick={() => open(applicationForm, 'Record application', (b) => api(`${base}/applications`, { method: 'POST', body: b }), { type: 'competition', status: 'submitted' })}><Plus className="size-3.5" />Application</Button>}>
              <table className="tbl"><thead><tr><th>Applied</th><th>Title</th><th>Status</th><th>Outcome</th><th /></tr></thead><tbody>
                {d.applications.map((a: any) => (
                  <tr key={a.id}><td className="whitespace-nowrap tabular-nums">{a.appliedAt ?? '—'}</td><td><div className="font-medium">{a.title}</div><div className="text-xs text-[var(--text-muted)]">{a.organizer}</div></td>
                    <td><Badge tone={statusTone(a.status)}>{a.status}</Badge></td><td>{a.outcome ?? '—'}</td>
                    <td className="text-right"><Button size="sm" variant="ghost" aria-label="Edit" onClick={() => open(applicationForm, 'Update application', (b) => api(`${base}/applications/${a.id}`, { method: 'PATCH', body: { status: b.status, outcome: b.outcome, appliedAt: b.appliedAt } }), a)}><Pencil className="size-3.5" /></Button></td></tr>
                ))}
              </tbody></table>
            </Card>
          </>
        )}

        {tab === 'projects' && (
          <>
            <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => open(projectForm, 'Add side project', (b) => api(`${base}/projects`, { method: 'POST', body: b }), { kind: 'business', status: 'active', role: 'Founder' })}><Plus className="size-3.5" />Side project</Button></div>
            {d.projects.map((p: any) => (
              <Card key={p.id} title={<span>{p.name} <span className="font-normal text-[var(--text-muted)]">· {p.role} · {p.tagline}</span></span>}
                action={<>
                  <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>{p.status}</Badge>
                  <Button size="sm" onClick={() => open(milestoneForm, 'Add milestone', (b) => api(`${base}/projects/${p.id}/milestones`, { method: 'POST', body: b }), { done: false })}><Plus className="size-3.5" />Milestone</Button>
                  <RowActions onEdit={() => open(projectForm, `Edit ${p.name}`, (b) => api(`${base}/projects/${p.id}`, { method: 'PATCH', body: b }), p)} onDelete={() => del(`${base}/projects/${p.id}`, p.name)} />
                </>}>
                <div className="grid grid-cols-[1fr_1fr] gap-6">
                  <div>
                    {p.totals ? (
                      <>
                        <div className="mb-3 grid grid-cols-3 gap-3 text-sm"><Kv k="Revenue" v={`AED ${p.totals.revenueAed.toLocaleString()}`} /><Kv k="Orders" v={p.totals.orders} /><Kv k="Customers" v={p.totals.customers} /></div>
                        <div className="eyebrow mb-1">Monthly revenue (AED)</div>
                        <MiniBars values={p.metrics.map((m: any) => m.revenue)} labels={p.metrics.map((m: any) => MONTHS[Number(m.month.slice(5)) - 1])} height={90} />
                      </>
                    ) : <p className="text-sm text-[var(--text-muted)]">Non-commercial project. Started {p.startDate}. Skills: {p.skills.join(', ')}</p>}
                  </div>
                  <ol className="max-h-60 space-y-1.5 overflow-y-auto text-sm">
                    {p.milestones.map((m: any) => (
                      <li key={m.id} className="flex items-center gap-2">
                        <button aria-label={m.done ? 'Mark not done' : 'Mark done'} onClick={() => run(() => api(`${base}/projects/${p.id}/milestones/${m.id}`, { method: 'PATCH', body: { done: !m.done } }))}
                          className={`grid size-4 shrink-0 place-items-center rounded-full border ${m.done ? 'border-[var(--success)] bg-[var(--success)] text-white' : 'border-[var(--border)]'}`}>{m.done && <Check className="size-3" />}</button>
                        <span className="tabular-nums text-xs text-[var(--text-muted)]">{m.date}</span><span className={m.done ? '' : 'font-medium'}>{m.title}</span>
                        {m.source !== 'generated' && <Badge tone="accent">{m.source}</Badge>}
                        <button aria-label="Delete milestone" className="ml-auto text-[var(--text-muted)] hover:text-[var(--danger)]" onClick={() => del(`${base}/projects/${p.id}/milestones/${m.id}`, m.title)}><Trash2 className="size-3" /></button>
                      </li>
                    ))}
                  </ol>
                </div>
              </Card>
            ))}
            {!d.projects.length && <Empty>No side projects yet.</Empty>}
          </>
        )}

        {tab === 'cv' && (
          <div className="grid grid-cols-2 gap-4">
            <Card title="CV fields" action={<Button size="sm" variant="outline" onClick={() => open(cvForm, 'Edit CV fields', (b) => api(`${base}/cv`, { method: 'PUT', body: b }), d.cv)}><Pencil className="size-3.5" />Edit</Button>}>
              <dl className="space-y-2.5 text-sm">
                <Kv k="Headline" v={d.cv.headline} /><Kv k="Summary" v={d.cv.summary || '—'} /><Kv k="Email" v={d.cv.email ?? '—'} /><Kv k="Location" v={d.cv.location} />
                <Kv k="Skills" v={d.cv.skills.join(', ') || '—'} /><Kv k="Predicted" v={d.cv.predicted ?? '—'} /><Kv k="University goal" v={d.cv.universityGoal ?? '—'} />
                <Kv k="Certifications" v={d.cv.certifications.map((c: any) => `${c.name} (${c.issuer})`).join('; ') || '—'} />
              </dl>
            </Card>
            <div className="flex flex-col gap-4">
              <Card title="Social & portfolio links" action={<Button size="sm" variant="outline" onClick={() => open(linksForm, 'Edit links', (b) => api(`${base}/links`, { method: 'PUT', body: b }), d.links)}><Pencil className="size-3.5" />Edit</Button>}>
                <dl className="space-y-2 text-sm">
                  {['linkedin', 'github', 'instagram', 'portfolio', 'website'].map((k) => <Kv key={k} k={k} v={d.links[k] ? <a href={d.links[k]} className="text-[var(--accent)] hover:underline" target="_blank" rel="noreferrer">{d.links[k]}</a> : '—'} />)}
                  {Object.keys(d.links.restrictions ?? {}).length > 0 && <p className="text-xs text-[var(--text-muted)]">Restricted by age: {Object.entries(d.links.restrictions).map(([k, v]) => `${k} (${v})`).join(', ')}</p>}
                </dl>
              </Card>
              <Card title="LinkedIn pack" action={<>
                <Button size="sm" onClick={() => run(() => api(`${base}/linkedin`, { method: 'POST' }))}>Regenerate</Button>
                <Button size="sm" variant="outline" onClick={() => void openPdf(id)}><ExternalLink className="size-3.5" />PDF</Button>
              </>}>
                {d.linkedin ? (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">{d.linkedin.headline}</div>
                    <p className="whitespace-pre-wrap text-[var(--text-muted)]">{d.linkedin.about}</p>
                    <div className="text-xs text-[var(--text-muted)]">{d.linkedin.experience.length} experience entries · {d.linkedin.skills.length} skills · generated by {d.linkedin.generatedBy} at {d.linkedin.generatedAt.slice(0, 16).replace('T', ' ')}</div>
                  </div>
                ) : <p className="text-sm text-[var(--text-muted)]">Not generated yet. Regenerate here, or the student asks Murshid “make my LinkedIn CV”.</p>}
              </Card>
              <Card title="Achievements" pad={false} action={<Button size="sm" onClick={() => open(achievementForm, 'Add achievement', (b) => api(`${base}/achievements`, { method: 'POST', body: b }), { category: 'award' })}><Plus className="size-3.5" />Add</Button>}>
                <ul className="divide-y divide-[var(--border)] text-sm">
                  {d.achievements.map((a: any) => (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-2.5"><span className="tabular-nums text-xs text-[var(--text-muted)]">{a.date}</span><span className="flex-1"><span className="font-medium">{a.title}</span> <Badge>{a.category}</Badge><div className="text-xs text-[var(--text-muted)]">{a.description}</div></span>
                      <button aria-label="Delete achievement" className="text-[var(--text-muted)] hover:text-[var(--danger)]" onClick={() => del(`${base}/achievements/${a.id}`, a.title)}><Trash2 className="size-3.5" /></button></li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        )}

        {tab === 'audit' && <AuditTable items={d.audit} />}
      </div>

      <Modal open={Boolean(editor)} title={editor?.title ?? ''} onClose={() => setEditor(null)} wide>
        {editor && <EntityForm def={editor.def} initial={editor.initial} onCancel={() => setEditor(null)} onSubmit={async (data) => { await editor.submit(data); setEditor(null); await reload(); }} />}
      </Modal>
    </>
  );
}

function toSession(b: Record<string, unknown>) {
  const metrics = Object.fromEntries(Object.entries(b).filter(([k, v]) => k.startsWith('m_') && v !== null).map(([k, v]) => [k.slice(2), v]));
  const rest = Object.fromEntries(Object.entries(b).filter(([k]) => !k.startsWith('m_')));
  return { ...rest, metrics };
}

async function openPdf(id: string) {
  const res = await fetch(studentUrl('/student/cv/linkedin.pdf'), { headers: { 'x-dev-user': id } });
  const blob = await res.blob();
  window.open(URL.createObjectURL(blob), '_blank');
}

function Kv({ k, v }: { k: string; v: ReactNode }) {
  return <div><dt className="eyebrow">{k}</dt><dd className="mt-0.5">{v}</dd></div>;
}

function RowActions({ onEdit, onDelete }: { onEdit?: () => void; onDelete?: () => void }) {
  return (
    <span className="inline-flex gap-0.5">
      {onEdit && <Button size="sm" variant="ghost" aria-label="Edit" onClick={onEdit}><Pencil className="size-3.5" /></Button>}
      {onDelete && <Button size="sm" variant="danger" aria-label="Delete" onClick={onDelete}><Trash2 className="size-3.5" /></Button>}
    </span>
  );
}

const PROFILE_LABELS: Record<string, string> = { nameAr: 'Name (Arabic)', classLabel: 'Class', studyStreakDays: 'Study streak (days)' };
/** "preferredName" -> "Preferred name" so raw API keys never show as run-together caps. */
function profileLabel(k: string) {
  if (PROFILE_LABELS[k]) return PROFILE_LABELS[k];
  const words = k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
