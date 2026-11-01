'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BellRing, Camera, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Copy, FileText, Link2, MessageCircle, RotateCcw, Send, Sheet, X } from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Files } from '@/components/files';
import { PageHeader } from '@/components/shell';
import { Badge, Button, Card, cn, dialogOpen, EmptyState, ErrorBox, Modal, SkeletonRows } from '@/components/ui';
import { api, getSession, newIdempotencyKey } from '@/lib/api';
import { uploadAs, type FileRef } from '@/lib/classroom';
import { useData } from '@/lib/use-data';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Filter = 'all' | 'to_review' | 'not_started' | 'late' | 'returned' | 'marked';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everyone' }, { id: 'to_review', label: 'To review' }, { id: 'not_started', label: 'Not handed in' },
  { id: 'late', label: 'Late' }, { id: 'returned', label: 'Returned' }, { id: 'marked', label: 'Marked' },
];
const STATE: Record<string, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' }> = {
  handed_in: { label: 'Handed in', tone: 'success' }, returned: { label: 'Returned', tone: 'warning' }, marked: { label: 'Marked', tone: 'info' }, not_started: { label: 'Not handed in', tone: 'neutral' },
};
const match = (r: any, f: Filter) => f === 'all' || (f === 'to_review' ? r.state === 'handed_in' && !r.synthetic : f === 'late' ? r.late : f === 'not_started' ? r.state === 'not_started' : r.state === f);

/** Reusable feedback, kept on this device. */
const BANK_KEY = 'murshid:feedback-bank';
const BANK_DEFAULT = ['Clear and well organised. Well done.', 'Add a labelled diagram to support this.', 'Use evidence from the text to back up each point.', 'Check your spelling and punctuation before handing in.', 'Good start: develop your conclusion further.'];
function useBank() {
  const [bank, setBank] = useState<string[]>(BANK_DEFAULT);
  useEffect(() => { try { const x = JSON.parse(localStorage.getItem(BANK_KEY) ?? 'null'); if (Array.isArray(x)) setBank(x); } catch { /* ignore */ } }, []);
  const save = (next: string[]) => { setBank(next); try { localStorage.setItem(BANK_KEY, JSON.stringify(next)); } catch { /* ignore */ } };
  return { bank, add: (t: string) => save([t, ...bank.filter((x) => x !== t)].slice(0, 20)), remove: (t: string) => save(bank.filter((x) => x !== t)) };
}

function Review() {
  const router = useRouter();
  const params = useParams<{ itemId: string }>();
  const search = useSearchParams();
  const itemId = decodeURIComponent(params.itemId);
  const cls = search.get('class') ?? '';
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!getSession()) router.replace('/login'); else setReady(true); }, [router]);
  const list = useData<any>(ready && cls ? `/teacher/classes/${cls}/assignments/${encodeURIComponent(itemId)}/handins` : null, 'staff');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<string | null>(search.get('student'));
  const [remind, setRemind] = useState(false);
  const [copy, setCopy] = useState(false);
  const pick = (id: string | null) => { setSelected(id); const u = new URL(window.location.href); if (id) u.searchParams.set('student', id); else u.searchParams.delete('student'); window.history.replaceState(null, '', u); };

  const rows: any[] = list.data?.rows ?? [];
  const shown = useMemo(() => rows.filter((r) => match(r, filter)).sort((a, b) => Number(b.state === 'handed_in' && !b.synthetic) - Number(a.state === 'handed_in' && !a.synthetic) || b.unread - a.unread || a.name.localeCompare(b.name)), [rows, filter]);
  const a = list.data?.assignment;
  const k = list.data?.counts;
  const idx = shown.findIndex((r) => r.studentId === selected);
  const go = (d: -1 | 1) => { const n = shown[idx + d]; if (n) pick(n.studentId); };

  if (!cls) return <ErrorBox error="Open this page from a class's assignments list." />;
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
        <Link href={`/teacher?class=${cls}&tab=assignments`} className="inline-flex min-h-10 items-center gap-1 hover:text-[var(--text)]"><ArrowLeft className="size-4" />Assignments</Link>
        <Link href={`/teacher/gradebook?class=${cls}`} className="inline-flex min-h-10 items-center gap-1 hover:text-[var(--text)]"><Sheet className="size-4" />Gradebook</Link>
      </div>
      <ErrorBox error={list.error} />
      {!a ? <Card pad={false}><SkeletonRows rows={6} /></Card> : (
        <>
          <PageHeader title={a.title} sub={<>{list.data.class.name} · due {a.dueLabel}, {a.dueTime}{a.photosRequired ? ' · photos of notes' : ''}{a.rubric ? ` · rubric (${a.rubric.reduce((t: number, r: any) => t + r.points, 0)} pts)` : ''}</>}
            action={<div className="flex flex-wrap gap-2">{a.posted && <Button variant="ghost" onClick={() => setCopy(true)}><Copy />Copy to class</Button>}<Button variant="outline" onClick={() => setRemind(true)} disabled={!k.notStarted && !k.returned}><BellRing />Remind {k.notStarted + k.returned}</Button></div>} />
          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[['To review', k.toReview, 'to_review'], ['Handed in', k.handedIn + k.marked + k.returned, 'all'], ['Not handed in', k.notStarted, 'not_started'], ['Late', k.late, 'late'], ['Marked', k.marked, 'marked'], ['Average', list.data.average === null ? '—' : `${list.data.average}%`, 'marked']].map(([l, v, f]) => (
              <button key={l as string} type="button" onClick={() => setFilter(f as Filter)} className="card px-4 py-3 text-start transition-colors hover:bg-[var(--surface)]">
                <span className="block text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">{l as string}</span>
                <span className="mt-1 block text-2xl font-semibold tabular-nums">{v as string}</span>
              </button>
            ))}
          </div>
          {(a.instructions || a.attachments.length > 0 || a.links.length > 0) && (
            <details className="card mb-5 p-4">
              <summary className="cursor-pointer text-sm font-medium">What students were given</summary>
              {a.instructions && <p className="mt-3 whitespace-pre-wrap text-sm">{a.instructions}</p>}
              <Files files={a.attachments} className="mt-3" compact />
              {a.links.map((l: any) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 text-sm text-[var(--accent)] hover:underline"><Link2 className="size-4" />{l.label}</a>)}
            </details>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <div className={cn('min-w-0', selected && 'hidden lg:block')}>
              <div className="tabs-scroll -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0" role="group" aria-label="Filter students">
                {FILTERS.map((f) => (
                  <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
                    className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium', filter === f.id ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]')}>
                    {f.label}<span className={cn('tabular-nums', filter === f.id ? 'text-white/60' : '')}>{rows.filter((r) => match(r, f.id)).length}</span>
                  </button>
                ))}
              </div>
              <Card pad={false}>
                {!shown.length ? <EmptyState title="Nobody here">Try another filter.</EmptyState> : (
                  <ul className="max-h-[70vh] divide-y divide-[var(--border)] overflow-y-auto">
                    {shown.map((r) => (
                      <li key={r.studentId}>
                        <button type="button" onClick={() => pick(r.studentId)} aria-current={selected === r.studentId || undefined}
                          className={cn('flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[var(--surface)]', selected === r.studentId && 'bg-[var(--surface)]')}>
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[11px] font-medium">{r.initials}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{r.name}</span>
                            <span className="block truncate text-xs text-[var(--text-muted)]">{r.section}{r.photos ? ` · ${r.photos} photo${r.photos === 1 ? '' : 's'}` : ''}{r.words ? ` · ${r.words} words` : ''}{r.synthetic ? ' · via Teams' : ''}</span>
                          </span>
                          {r.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1.5 text-[11px] font-medium text-white" aria-label={`${r.unread} unread`}>{r.unread}</span>}
                          <span className="flex flex-col items-end gap-1">
                            <Badge tone={STATE[r.state]!.tone}>{r.state === 'marked' && r.grade !== null ? `${r.grade}%` : STATE[r.state]!.label}</Badge>
                            {r.late && <span className="text-[11px] text-[var(--warning)]">Late</span>}
                            {r.overdue && <span className="text-[11px] text-[var(--danger)]">Overdue</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
            <div className={cn('min-w-0', !selected && 'hidden lg:block')}>
              {selected ? (
                <StudentWork key={selected} cls={cls} itemId={itemId} studentId={selected} onBack={() => pick(null)} onPrev={idx > 0 ? () => go(-1) : undefined} onNext={idx >= 0 && idx < shown.length - 1 ? () => go(1) : undefined} onChanged={list.reload} />
              ) : (
                <Card><EmptyState icon={<FileText />} title="Pick a student">Their work, photos and your private chat open here. Use ← and → to move through the class.</EmptyState></Card>
              )}
            </div>
          </div>
          <CopyModal open={copy} onClose={() => setCopy(false)} cls={cls} itemId={itemId} dueDate={a.dueDate} />
          <RemindModal open={remind} onClose={() => setRemind(false)} cls={cls} itemId={itemId} count={k.notStarted + k.returned} onDone={list.reload} />
        </>
      )}
    </>
  );
}

/** Unsaved marking per student (kept while the teacher moves around the class; cleared once saved). */
type Draft = { grade: string; scores: Record<string, string>; feedback: string };
const drafts = new Map<string, Draft>();

function StudentWork({ cls, itemId, studentId, onBack, onPrev, onNext, onChanged }: { cls: string; itemId: string; studentId: string; onBack: () => void; onPrev?: () => void; onNext?: () => void; onChanged: () => void }) {
  const base = `/teacher/classes/${cls}/assignments/${encodeURIComponent(itemId)}`;
  const d = useData<any>(`${base}/handins/${studentId}`, 'staff');
  const { bank, add, remove } = useBank();
  const [grade, setGrade] = useState<string>('');
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const key = `${itemId}:${studentId}`;
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    const h = d.data?.handIn;
    if (!h) return;
    const kept = drafts.get(key);
    if (kept) { setGrade(kept.grade); setScores(kept.scores); setFeedback(kept.feedback); setSeeded(true); return; }
    setGrade(h.grade !== null && !h.scores ? String(h.grade) : '');
    setScores(h.scores ? Object.fromEntries(Object.entries(h.scores).map(([k, v]) => [k, String(v)])) : {});
    // only an existing mark's feedback is edited in place; an earlier "please change" note is shown as history instead
    setFeedback(h.state === 'marked' ? (h.feedback ?? '') : '');
    setSeeded(true);
  }, [d.data?.handIn, key]);
  // remember what the teacher has typed but not saved
  useEffect(() => {
    const h = d.data?.handIn;
    if (!seeded || !h) return;
    const saved: Draft = { grade: h.grade !== null && !h.scores ? String(h.grade) : '', scores: h.scores ? Object.fromEntries(Object.entries(h.scores).map(([k, v]) => [k, String(v)])) : {}, feedback: h.state === 'marked' ? (h.feedback ?? '') : '' };
    const same = grade === saved.grade && feedback === saved.feedback && JSON.stringify(scores) === JSON.stringify(saved.scores);
    if (same) drafts.delete(key); else drafts.set(key, { grade, scores, feedback });
  }, [grade, scores, feedback, seeded, key, d.data?.handIn]);
  // ← → move through the class (not while typing)
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select,[contenteditable]') || dialogOpen()) return;
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
      if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onPrev, onNext]);

  if (d.error) return <ErrorBox error={d.error} />;
  if (!d.data) return <Card pad={false}><SkeletonRows rows={5} /></Card>;
  const { student, handIn: h, row, assignment: a } = d.data;
  const rubric: any[] | null = a.rubric;
  const total = rubric?.reduce((t, r) => t + r.points, 0) ?? 0;
  const got = rubric?.reduce((t, r) => t + (Number(scores[r.id]) || 0), 0) ?? 0;
  // a score must be a whole or half point between 0 and the row's maximum
  const scoreError = (r: { points: number }, v: string | undefined) => {
    if (v === undefined || v.trim() === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 'Use 0 or more';
    if (n > r.points) return `Max ${r.points}`;
    if (Math.round(n * 2) !== n * 2) return 'Use whole or half points';
    return null;
  };
  const badScores = rubric?.filter((r) => scoreError(r, scores[r.id])) ?? [];
  const gradeError = grade.trim() === '' ? null : !Number.isFinite(Number(grade)) || Number(grade) < 0 || Number(grade) > 100 ? 'Use a number from 0 to 100' : null;
  const unsaved = drafts.has(key);

  const review = async (action: 'mark' | 'return') => {
    setErr(null); setDone(null);
    const body: any = { action, feedback: feedback.trim() || undefined };
    if (badScores.length) { setErr(`Fix the score for ${badScores.map((r) => r.label).join(', ')}.`); return; }
    if (gradeError) { setErr(gradeError); return; }
    if (rubric) { if (Object.values(scores).some((v) => v.trim() !== '')) body.scores = Object.fromEntries(rubric.map((r) => [r.id, Number(scores[r.id]) || 0])); }
    else if (grade.trim() !== '') body.grade = Math.round(Number(grade));
    if (action === 'mark' && body.grade === undefined && !body.scores) { setErr(rubric ? 'Score the rubric to mark it.' : 'Add a grade (0–100) to mark it.'); return; }
    if (action === 'return' && !body.feedback) { setErr('Say what to change when you return it.'); return; }
    setBusy(action);
    try {
      await api(`${base}/handins/${studentId}/review`, { method: 'POST', as: 'staff', body, headers: { 'idempotency-key': newIdempotencyKey('rev') } });
      drafts.delete(key);
      setDone(action === 'mark' ? `Marked and returned to ${student.name.split(' ')[0]}.` : `Returned to ${student.name.split(' ')[0]} for changes.`);
      await d.reload(); onChanged();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)] lg:hidden"><ArrowLeft className="size-4" />All students</button>
          <div className="ms-auto flex gap-1">
            <button type="button" onClick={onPrev} disabled={!onPrev} aria-label="Previous student" className="grid size-10 place-items-center rounded-full border border-[var(--border)] disabled:opacity-30"><ChevronLeft className="size-4" /></button>
            <button type="button" onClick={onNext} disabled={!onNext} aria-label="Next student" className="grid size-10 place-items-center rounded-full border border-[var(--border)] disabled:opacity-30"><ChevronRight className="size-4" /></button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-[var(--surface-2)] text-sm font-medium">{student.initials}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-medium">{student.name}</h2>
            <p className="text-sm text-[var(--text-muted)]">{student.section}{row.submittedAt ? ` · handed in ${new Date(row.submittedAt).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}{h && h.versions > 1 ? ` · version ${h.versions}` : ''}</p>
          </div>
          <Badge tone={STATE[row.state]!.tone}>{row.state === 'marked' && row.grade !== null ? `Marked ${row.grade}%` : STATE[row.state]!.label}</Badge>
        </div>
        {row.checks?.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Murshid checks">
            {row.checks.map((c: any) => <li key={c.code}><Badge tone={c.tone === 'danger' ? 'danger' : c.tone === 'info' ? 'info' : 'warning'}>{c.label}</Badge></li>)}
          </ul>
        )}

        {h ? (
          <div className="mt-5 flex flex-col gap-4">
            {h.text && <div className="rounded-[var(--radius-sm)] bg-[var(--surface)] p-4"><p className="whitespace-pre-wrap text-[15px] leading-relaxed [overflow-wrap:anywhere]">{h.text}</p></div>}
            {h.files.length > 0 ? <Files files={h.files} /> : a.photosRequired ? <p className="text-sm text-[var(--warning)]">No photos were attached.</p> : null}
          </div>
        ) : row.synthetic ? (
          <p className="mt-5 rounded-[var(--radius-sm)] bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">Handed in through Microsoft Teams (synthetic demo data), so there is nothing to show here. Use the chat below to follow up.</p>
        ) : d.data.response ? (
          <p className="mt-5 text-sm text-[var(--text-muted)]">Answered the form. See the answers in the assignments list.</p>
        ) : (
          <p className="mt-5 flex items-center gap-2 text-sm text-[var(--text-muted)]"><Clock3 className="size-4" />Not handed in yet{row.overdue ? ' (overdue)' : ''}.</p>
        )}
      </Card>

      {h && (
        <Card title={h.state === 'marked' ? 'Marked' : 'Mark or return'}>
          {rubric ? (
            <div className="mb-4">
              <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-sm)] border border-[var(--border)]">
                {rubric.map((r) => {
                  const bad = scoreError(r, scores[r.id]);
                  return (
                    <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5">
                      <span className="min-w-0 flex-1 text-sm">{r.label}</span>
                      <input aria-label={`${r.label} score`} aria-invalid={bad ? true : undefined} aria-describedby={bad ? `err-${r.id}` : undefined} inputMode="decimal" type="number" min={0} max={r.points} step={0.5} className={cn('input h-9 w-20 text-sm', bad && 'border-[var(--danger)]')} value={scores[r.id] ?? ''} onChange={(e) => setScores((x) => ({ ...x, [r.id]: e.target.value }))} />
                      <span className="w-14 text-xs text-[var(--text-muted)]">/ {r.points}</span>
                      {bad && <span id={`err-${r.id}`} className="basis-full text-end text-xs text-[var(--danger)]">{bad}</span>}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-sm">{badScores.length ? <span className="text-[var(--danger)]">Fix the scores above to see the total.</span> : <><span className="font-medium tabular-nums">{got} / {total}</span> <span className="text-[var(--text-muted)]">= {total ? Math.round((got / total) * 100) : 0}%</span></>}</p>
            </div>
          ) : (
            <label className="field mb-4 max-w-[12rem]"><span>Grade (%)</span><input aria-label="Grade" aria-invalid={gradeError ? true : undefined} inputMode="numeric" type="number" min={0} max={100} className={cn('input', gradeError && 'border-[var(--danger)]')} value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 85" />{gradeError && <span className="text-xs text-[var(--danger)]">{gradeError}</span>}</label>
          )}
          {h.state !== 'marked' && h.feedback && (
            <div className="mb-4 rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] p-3 text-sm">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{h.state === 'returned' ? 'You asked for changes' : 'Your earlier request'}</p>
              <p className="whitespace-pre-wrap text-[var(--text-muted)] [overflow-wrap:anywhere]" dir="auto">{h.feedback}</p>
            </div>
          )}
          <label className="field"><span>Feedback</span>
            <textarea aria-label="Feedback" className="input min-h-28" value={feedback} maxLength={2000} onChange={(e) => setFeedback(e.target.value)} placeholder="What went well, and what to do next" />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Saved comments">
            {bank.map((t) => (
              <span key={t} className="group inline-flex max-w-full items-center rounded-full border border-[var(--border)] text-xs">
                <button type="button" onClick={() => setFeedback((f) => (f.trim() ? `${f.trim()} ${t}` : t))} className="max-w-[22rem] truncate px-3 py-1.5 text-start hover:text-[var(--accent)]">{t}</button>
                <button type="button" aria-label={`Remove saved comment: ${t}`} onClick={() => remove(t)} className="grid size-6 place-items-center rounded-full pe-1 text-[var(--text-muted)] opacity-60 hover:opacity-100"><X className="size-3" /></button>
              </span>
            ))}
            {feedback.trim().length > 3 && !bank.includes(feedback.trim()) && <button type="button" onClick={() => add(feedback.trim())} className="rounded-full px-3 py-1.5 text-xs font-medium text-[var(--accent)] hover:underline">+ Save this comment</button>}
          </div>
          {unsaved && !done && <p className="mt-3 text-xs text-[var(--text-muted)]">Not saved yet. Your notes stay here while you look at other students.</p>}
          {err && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{err}</p>}
          {done && <p role="status" className="mt-3 flex items-center gap-1.5 text-sm text-[var(--success)]"><CheckCircle2 className="size-4" />{done}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void review('mark')} disabled={Boolean(busy)}>{busy === 'mark' ? 'Saving…' : h.state === 'marked' ? 'Update mark' : 'Mark and return'}</Button>
            {h.state !== 'marked' && <Button variant="outline" onClick={() => void review('return')} disabled={Boolean(busy)}><RotateCcw />{busy === 'return' ? 'Returning…' : 'Return for changes'}</Button>}
            {onNext && <Button variant="ghost" onClick={onNext}>Next student<ChevronRight /></Button>}
          </div>
        </Card>
      )}

      <Chat base={base} studentId={studentId} name={student.name} messages={d.data.messages} onSent={() => void d.reload()} />
    </div>
  );
}

function Chat({ base, studentId, name, messages, onSent }: { base: string; studentId: string; name: string; messages: any[]; onSent: () => void }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<FileRef[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);
  const attach = async (list: File[]) => { setErr(null); for (const f of list) { try { const ref = await uploadAs(f); setFiles((x) => [...x, ref]); } catch (e) { setErr((e as Error).message); } } };
  const send = async () => {
    if (!text.trim() && !files.length) return;
    setBusy(true); setErr(null);
    try {
      await api(`${base}/messages/${studentId}`, { method: 'POST', as: 'staff', body: { text: text.trim(), fileIds: files.map((f) => f.id) }, headers: { 'idempotency-key': newIdempotencyKey('msg') } });
      setText(''); setFiles([]); onSent();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Card title={<span className="inline-flex items-center gap-2"><MessageCircle className="size-4" />Private chat with {name.split(' ')[0]}</span> as any}>
      <div className="flex max-h-[24rem] flex-col gap-3 overflow-y-auto">
        {!messages.length && <p className="text-sm text-[var(--text-muted)]">No messages yet. Only you and {name.split(' ')[0]} see this chat.</p>}
        {messages.map((m) => (
          <div key={m.id} className={cn('flex max-w-[88%] flex-col gap-1', m.from === 'teacher' ? 'items-end self-end' : 'items-start self-start')}>
            {m.text && <p className={cn('whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm [overflow-wrap:anywhere]', m.from === 'teacher' ? 'bg-[var(--deep)] text-white' : 'bg-[var(--surface)]')}>{m.text}</p>}
            {m.files?.length > 0 && <Files files={m.files} compact className="w-56" />}
            <span className="text-[11px] text-[var(--text-muted)]">{m.from === 'student' ? `${m.name} · ` : ''}{new Date(m.at).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      {files.length > 0 && <Files files={files} compact className="mt-3" onRemove={(id) => setFiles((x) => x.filter((f) => f.id !== id))} />}
      {err && <p role="alert" className="mt-2 text-sm text-[var(--danger)]">{err}</p>}
      <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input ref={input} type="file" multiple accept="image/*,application/pdf,.ppt,.pptx,.doc,.docx" hidden onChange={(e) => { void attach([...(e.target.files ?? [])]); e.target.value = ''; }} />
        <button type="button" aria-label="Attach a file" onClick={() => input.current?.click()} className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]"><Camera className="size-4" /></button>
        <textarea aria-label={`Message ${name}`} rows={1} className="input min-h-11 flex-1 resize-none py-2.5" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder={`Message ${name.split(' ')[0]}…`}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
        <Button type="submit" disabled={busy || (!text.trim() && !files.length)} aria-label="Send"><Send /></Button>
      </form>
    </Card>
  );
}

function RemindModal({ open, onClose, cls, itemId, count, onDone }: { open: boolean; onClose: () => void; cls: string; itemId: string; count: number; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const close = useCallback(() => { setMsg(null); onClose(); }, [onClose]);
  const send = async () => {
    setBusy(true);
    try {
      const r = await api<any>(`/teacher/classes/${cls}/assignments/${encodeURIComponent(itemId)}/remind`, { method: 'POST', as: 'staff', body: { note: note.trim() || undefined }, headers: { 'idempotency-key': newIdempotencyKey('rem') } });
      setMsg(`Reminded ${r.reminded} student${r.reminded === 1 ? '' : 's'}. It shows at the top of their School page.`); setNote(''); onDone();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title="Send a reminder" onClose={close}>
      <p className="text-sm text-[var(--text-muted)]">Goes to the {count} student{count === 1 ? '' : 's'} who haven't handed in (or were asked for changes). Murshid also keeps it in their plan.</p>
      <label className="field mt-4"><span>Note (optional)</span><input aria-label="Note" className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Bring your notebook to class tomorrow" /></label>
      {msg && <p role="status" className="mt-3 text-sm">{msg}</p>}
      <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={close}>Close</Button><Button onClick={() => void send()} disabled={busy || !count}><BellRing />{busy ? 'Sending…' : `Remind ${count}`}</Button></div>
    </Modal>
  );
}

function CopyModal({ open, onClose, cls, itemId, dueDate }: { open: boolean; onClose: () => void; cls: string; itemId: string; dueDate: string }) {
  const me = useData<any>(open ? '/teacher/me' : null, 'staff');
  const others: any[] = (me.data?.classes ?? []).filter((c: any) => c.id !== cls);
  const [to, setTo] = useState('');
  const [due, setDue] = useState(dueDate);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { if (!to && others[0]) setTo(others[0].id); }, [others, to]);
  const close = () => { setDone(null); setErr(null); onClose(); };
  const send = async () => {
    setBusy(true); setErr(null);
    try { setDone(await api<any>(`/teacher/classes/${cls}/assignments/${encodeURIComponent(itemId)}/copy`, { method: 'POST', as: 'staff', body: { toClassId: to, dueDate: due }, headers: { 'idempotency-key': newIdempotencyKey('copy') } })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} title="Copy to another class" onClose={close}>
      {done ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 text-sm text-[var(--success)]"><CheckCircle2 className="size-4" />Copied to {done.class.name}: {done.students} students, due {done.assignment.dueLabel}.</p>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={close}>Close</Button><Link href={`/teacher/assignments/${encodeURIComponent(done.assignment.id)}?class=${done.class.id}`} className="inline-flex h-10 items-center rounded-full bg-[var(--deep)] px-4 text-sm font-medium text-white" onClick={close}>Open it</Link></div>
        </div>
      ) : (
        <>
          <p className="text-sm text-[var(--text-muted)]">Same instructions, slides and files, links, rubric and photo setting. Murshid replans each student's week in the other class too.</p>
          {!others.length && me.data ? <p className="mt-4 text-sm">You don't teach another class.</p> : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="field"><span>Class</span><select aria-label="Class" className="input" value={to} onChange={(e) => setTo(e.target.value)}>{others.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.students})</option>)}</select></label>
              <label className="field"><span>Due</span><input aria-label="Due" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} /></label>
            </div>
          )}
          {err && <p role="alert" className="mt-3 text-sm text-[var(--danger)]">{err}</p>}
          <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={close}>Cancel</Button><Button onClick={() => void send()} disabled={busy || !to}><Copy />{busy ? 'Copying…' : 'Copy'}</Button></div>
        </>
      )}
    </Modal>
  );
}

export default function ReviewPage() {
  return <Suspense fallback={<SkeletonRows rows={6} />}><Review /></Suspense>;
}
