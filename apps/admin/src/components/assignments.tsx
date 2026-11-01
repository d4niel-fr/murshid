'use client';

import { Files } from './files';
import { ACCEPT_ATTACH, uploadAs, type FileRef } from '@/lib/classroom';
import { ArrowDown, ArrowUp, ClipboardList, Copy, Download, ExternalLink, FileText, Link2, ListChecks, Paperclip, Plus, Search, Send, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, newIdempotencyKey } from '@/lib/api';
import { useData } from '@/lib/use-data';
import { validateAssignment, type Format, type QType, type Question } from '@/lib/assignment-rules';
import { MicrosoftMark } from './shell';
import { Badge, Bar, Button, Card, cn, EmptyState, ErrorBox, Modal, SkeletonRows, SortHeader } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: 'task', label: 'Written task', hint: 'Instructions only. Students hand in as usual.' },
  { id: 'form', label: 'Murshid form', hint: 'Build short, long and multiple-choice questions here.' },
  { id: 'google_form', label: 'Google Form', hint: 'Paste a link. Answers stay in Google Forms.' },
  { id: 'microsoft_form', label: 'Microsoft Form', hint: 'Paste a link. Answers stay in Microsoft Forms.' },
];
const FORMAT_LABEL: Record<Format, string> = { task: 'Task', form: 'Murshid form', google_form: 'Google Form', microsoft_form: 'Microsoft Form' };
const Q_LABEL: Record<QType, string> = { short: 'Short answer', long: 'Long answer', choice: 'Multiple choice' };

function FormatIcon({ f, className = 'size-4' }: { f: Format; className?: string }) {
  if (f === 'microsoft_form') return <MicrosoftMark className={className} />;
  if (f === 'google_form') return <Link2 className={className} aria-hidden />;
  if (f === 'form') return <ListChecks className={className} aria-hidden />;
  return <FileText className={className} aria-hidden />;
}

let qSeq = 0;
const newQuestion = (type: QType = 'short'): Question => ({ id: `q${Date.now().toString(36).slice(-4)}${(qSeq++).toString(36)}`, type, prompt: '', options: type === 'choice' ? ['', ''] : [], required: true });

interface Draft { title: string; instructions: string; format: Format; formUrl: string; questions: Question[]; attachments?: FileRef[]; links?: { url: string; label: string }[]; photos?: boolean; useRubric?: boolean; rubric?: { label: string; points: number }[] }
const draftKey = (classId: string) => `murshid:assignment-draft:${classId}`;
function readDraft(classId: string): Draft | null {
  try { const raw = localStorage.getItem(draftKey(classId)); return raw ? (JSON.parse(raw) as Draft) : null; } catch { return null; }
}

/** Post an assignment: written task, built-in form, or a Google / Microsoft Forms link. The draft autosaves per class. */
export interface ClassStudent { id: string; name: string; status?: string; statusLabel?: string }
export interface PostPreset { title?: string; instructions?: string; minutes?: number; dueDate?: string; studentIds?: string[] }
export function PostAssignmentForm({ classId, initial, minutes, best, onDone, students, preset }: { classId: string; initial: { setDate: string; dueDate: string }; minutes: number; best?: any; onDone: (r: any) => void; students?: ClassStudent[]; preset?: PostPreset }) {
  const [title, setTitle] = useState(preset?.title ?? '');
  const [instructions, setInstructions] = useState(preset?.instructions ?? '');
  // who gets it: the whole class, or chosen students (personalised work)
  const [who, setWho] = useState<'class' | 'chosen'>(preset?.studentIds?.length ? 'chosen' : 'class');
  const [chosen, setChosen] = useState<string[]>(preset?.studentIds ?? []);
  const [find, setFind] = useState('');
  const [format, setFormat] = useState<Format>('task');
  const [formUrl, setFormUrl] = useState('');
  const [questions, setQuestions] = useState<Question[]>([newQuestion('short')]);
  const [setDate, setSetDate] = useState(initial.setDate);
  const [dueDate, setDueDate] = useState(preset?.dueDate ?? initial.dueDate);
  const [mins, setMins] = useState(preset?.minutes ?? minutes);
  const [error, setError] = useState<string | null>(null);
  // what students get with it, and how it is handed in
  const [attachments, setAttachments] = useState<FileRef[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [links, setLinks] = useState<{ url: string; label: string }[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [photos, setPhotos] = useState(false);
  const [useRubric, setUseRubric] = useState(false);
  const [rubric, setRubric] = useState<{ label: string; points: number }[]>([{ label: 'Content and accuracy', points: 6 }, { label: 'Presentation', points: 4 }]);
  const fileInput = useRef<HTMLInputElement>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [restored, setRestored] = useState(false);
  const key = useRef(newIdempotencyKey('post'));
  const loaded = useRef(false);
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) top.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [error]);

  // restore the draft once (not when opened from a suggestion: that brings its own text)
  useEffect(() => {
    if (preset) { loaded.current = true; return; }
    const d = readDraft(classId);
    if (d && (d.title || d.instructions || d.formUrl || d.questions?.some((q) => q.prompt) || d.attachments?.length || d.links?.length)) {
      setTitle(d.title); setInstructions(d.instructions); setFormat(d.format); setFormUrl(d.formUrl);
      if (d.questions?.length) setQuestions(d.questions);
      // files were uploaded already, so their references come back with the rest
      if (d.attachments?.length) setAttachments(d.attachments);
      if (d.links?.length) setLinks(d.links);
      if (d.photos) setPhotos(true);
      if (d.useRubric) setUseRubric(true);
      if (d.rubric?.length) setRubric(d.rubric);
      setRestored(true);
    }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);
  // autosave (debounced)
  useEffect(() => {
    if (!loaded.current) return;
    setSaved('saving');
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey(classId), JSON.stringify({ title, instructions, format, formUrl, questions, attachments, links, photos, useRubric, rubric } satisfies Draft)); setSaved('saved'); } catch { setSaved('idle'); }
    }, 600);
    return () => clearTimeout(t);
  }, [classId, title, instructions, format, formUrl, questions, attachments, links, photos, useRubric, rubric]);
  // any edit makes this a new request
  useEffect(() => { key.current = newIdempotencyKey('post'); }, [title, instructions, format, formUrl, questions, setDate, dueDate, mins, who, chosen, attachments, links, photos, useRubric, rubric]);

  const errors = { ...validateAssignment({ title, format, formUrl, questions }), ...serverErrors };
  if (who === 'chosen' && !chosen.length) errors.who = 'Choose at least one student, or set it for the whole class.';
  if (linkUrl.trim() && !/^https?:\/\/\S+\.\S+/.test(linkUrl.trim())) errors.link = 'Links start with https:// (press Add to attach it).';
  if (useRubric && rubric.some((r) => r.label.trim().length < 2 || !(r.points >= 1 && r.points <= 100))) errors.rubric = 'Each rubric row needs a name and 1 to 100 points.';
  if (dueDate && setDate && dueDate <= setDate) errors.dueDate = 'The due date must be after the set date (students need at least one evening).';
  const show = (k: string) => (touched ? errors[k] : undefined);

  const clearDraft = () => { try { localStorage.removeItem(draftKey(classId)); } catch { /* storage off */ } };
  const reset = () => { clearDraft(); setTitle(''); setInstructions(''); setFormat('task'); setFormUrl(''); setQuestions([newQuestion('short')]); setAttachments([]); setLinks([]); setLinkUrl(''); setPhotos(false); setUseRubric(false); setRubric([{ label: 'Content and accuracy', points: 6 }, { label: 'Presentation', points: 4 }]); setRestored(false); setTouched(false); setServerErrors({}); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setError(null); setServerErrors({});
    if (busy) return;
    if (Object.keys(errors).length) { setError('Check the highlighted fields.'); return; }
    setBusy(true);
    const body: Record<string, unknown> = { title: title.trim(), instructions: instructions.trim() || null, setDate, dueDate, minutes: mins, format };
    if (format === 'google_form' || format === 'microsoft_form') body.formUrl = formUrl.trim();
    if (who === 'chosen') body.studentIds = chosen;
    if (attachments.length) body.attachmentIds = attachments.map((f) => f.id);
    if (links.length) body.links = links;
    if (format === 'task') body.photosRequired = photos;
    if (format === 'task' && useRubric) body.rubric = rubric.map((r) => ({ label: r.label.trim(), points: Math.round(r.points) }));
    if (format === 'form') body.questions = questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt.trim(), required: q.required, ...(q.type === 'choice' ? { options: q.options.map((o) => o.trim()).filter(Boolean) } : {}) }));
    try {
      const r = await api(`/teacher/classes/${classId}/assignments`, { method: 'POST', as: 'staff', body, headers: { 'idempotency-key': key.current } });
      clearDraft();
      onDone(r);
    } catch (err) {
      const ae = err as ApiError;
      if (Array.isArray(ae.details)) {
        const map: Record<string, string> = {};
        for (const d of ae.details as { path?: string; message?: string }[]) {
          const p = String(d.path ?? '');
          const m = /^questions\.(\d+)/.exec(p);
          map[m ? `q${m[1]}` : p.split('.')[0] || 'form'] = d.message ?? 'Check this field.';
        }
        setServerErrors(map);
      }
      // a file from an old draft can expire on the server
      setError(/attachment|file/i.test(ae.message) && attachments.length ? `${ae.message}. Remove the attached files and add them again.` : ae.message);
      setBusy(false);
    }
  };

  const attach = async (list: File[]) => {
    for (const f of list) {
      setUploading(f.name); setError(null);
      try { const ref = await uploadAs(f); setAttachments((a) => [...a, ref]); } catch (e) { setError((e as Error).message); }
    }
    setUploading(null);
  };
  const addLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\/\S+\.\S+/.test(url)) return;
    setLinks((l) => (l.some((x) => x.url === url) ? l : [...l, { url, label: url.replace(/^https?:\/\//, '').slice(0, 60) }])); setLinkUrl('');
  };
  const updateQ = (i: number, patch: Partial<Question>) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const moveQ = (i: number, d: -1 | 1) => setQuestions((qs) => { const n = [...qs]; const j = i + d; if (j < 0 || j >= n.length) return qs; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const isBest = best && best.set === setDate && best.due === dueDate;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5" aria-describedby="post-status">
      {restored && (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--surface)] px-4 py-2.5 text-sm">
          <span>Your unsent draft for this class is back.</span>
          <button type="button" onClick={reset} className="text-sm font-medium text-[var(--accent)] hover:underline">Start fresh</button>
        </div>
      )}
      <div ref={top} role="alert" className="scroll-mt-4 empty:hidden">{error && <ErrorBox error={error} />}</div>

      {(students?.length || preset?.studentIds?.length) ? (
        <fieldset>
          <legend className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Who gets it</legend>
          <div className="seg grid-cols-2">
            <label className="seg-opt"><input type="radio" name="who" checked={who === 'class'} onChange={() => setWho('class')} className="sr-only" />
              <span className="min-w-0"><span className="block text-sm font-medium">Whole class</span><span className="block text-xs text-[var(--text-muted)]">{students?.length ?? 'Every'} students</span></span></label>
            <label className="seg-opt"><input type="radio" name="who" checked={who === 'chosen'} onChange={() => setWho('chosen')} className="sr-only" />
              <span className="min-w-0"><span className="block text-sm font-medium">Chosen students</span><span className="block text-xs text-[var(--text-muted)]">{chosen.length ? `${chosen.length} chosen` : 'Personalised work'}</span></span></label>
          </div>
          {who === 'chosen' && students && (
            <StudentPicker students={students} chosen={chosen} setChosen={setChosen} find={find} setFind={setFind} />
          )}
          {show('who') && <p className="mt-2 text-xs text-[var(--danger)]">{show('who')}</p>}
        </fieldset>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">How students answer</legend>
        <div className="seg grid-cols-2">
          {FORMATS.map((f) => (
            <label key={f.id} className="seg-opt">
              <input type="radio" name="format" value={f.id} checked={format === f.id} onChange={() => { setFormat(f.id); setServerErrors({}); }} className="sr-only" />
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface)]"><FormatIcon f={f.id} /></span>
              <span className="min-w-0"><span className="block text-sm font-medium">{f.label}</span><span className="block text-xs leading-snug text-[var(--text-muted)]">{f.hint}</span></span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field"><span>Title</span>
        <input aria-label="Title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={format === 'task' ? 'e.g. Poem analysis: "Keeping Quiet"' : 'e.g. Reading check: chapter 3'} maxLength={140} aria-invalid={Boolean(show('title'))} aria-describedby={show('title') ? 'err-title' : undefined} />
        {show('title') && <span id="err-title" className="text-xs text-[var(--danger)]">{show('title')}</span>}
      </label>

      {(format === 'google_form' || format === 'microsoft_form') && (
        <label className="field"><span>{format === 'google_form' ? 'Google Forms link' : 'Microsoft Forms link'}</span>
          <div className="relative">
            <input aria-label="Form link" type="url" inputMode="url" className="input ps-11" value={formUrl} onChange={(e) => { setFormUrl(e.target.value); setServerErrors({}); }}
              placeholder={format === 'google_form' ? 'https://docs.google.com/forms/d/e/…/viewform' : 'https://forms.office.com/r/…'} aria-invalid={Boolean(show('formUrl'))} aria-describedby="hint-url" />
            <span className="pointer-events-none absolute inset-y-0 start-4 my-auto grid place-items-center text-[var(--text-muted)]"><FormatIcon f={format} /></span>
          </div>
          <span id="hint-url" className={cn('text-xs', show('formUrl') ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]')}>
            {show('formUrl') ?? (format === 'google_form' ? 'In Google Forms: Send → link icon → copy. Set it so anyone with the link can answer.' : 'In Microsoft Forms: Collect responses → copy link. Choose "Only people in my organisation" for school accounts.')}
          </span>
        </label>
      )}

      <label className="field"><span>Instructions {format !== 'task' && <span className="normal-case tracking-normal">(optional)</span>}</span>
        <textarea aria-label="Instructions" className="input" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={1000} placeholder={format === 'task' ? 'What to do, how long, what to hand in' : 'Anything students should know before they start'} />
      </label>

      <fieldset>
        <legend className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Slides, files and links <span className="normal-case tracking-normal">(optional)</span></legend>
        <Files files={attachments} onRemove={(id) => setAttachments((a) => a.filter((x) => x.id !== id))} compact />
        {links.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">{links.map((l) => <li key={l.url} className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm"><Link2 className="size-4 shrink-0 text-[var(--text-muted)]" /><span className="min-w-0 flex-1 truncate">{l.url}</span><button type="button" aria-label={`Remove ${l.url}`} onClick={() => setLinks((x) => x.filter((y) => y.url !== l.url))} className="grid size-8 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)]"><X className="size-4" /></button></li>)}</ul>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input ref={fileInput} type="file" multiple accept={ACCEPT_ATTACH} hidden onChange={(e) => { void attach([...(e.target.files ?? [])]); e.target.value = ''; }} />
          <Button type="button" size="sm" variant="outline" disabled={Boolean(uploading) || attachments.length >= 10} onClick={() => fileInput.current?.click()}>{uploading ? <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : <Paperclip />}{uploading ? `Uploading ${uploading.slice(0, 24)}…` : 'Attach slides or files'}</Button>
          <div className="flex min-w-[14rem] flex-1 items-center gap-2">
            <input aria-label="Link" type="url" inputMode="url" className="input h-9 flex-1 text-sm" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }} placeholder="https://… (a video, reading, Teams file)" />
            <Button type="button" size="sm" variant="outline" onClick={addLink} disabled={!linkUrl.trim()}>Add</Button>
          </div>
        </div>
        <p className={cn('mt-1.5 text-xs', show('link') ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]')}>{show('link') ?? 'PowerPoint, PDF, Word, Excel or photos, up to 3 MB each. Students open them on their phone or laptop.'}</p>
      </fieldset>

      {format === 'task' && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Handing in</legend>
          <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] p-3.5">
            <input type="checkbox" checked={photos} onChange={(e) => setPhotos(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--deep)]" />
            <span><span className="block text-sm font-medium">Ask for photos of their notes</span><span className="block text-xs text-[var(--text-muted)]">Students must add at least one photo: a notebook page, or pages from their Murshid notebook.</span></span>
          </label>
          <label className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] p-3.5">
            <input type="checkbox" checked={useRubric} onChange={(e) => setUseRubric(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--deep)]" />
            <span><span className="block text-sm font-medium">Mark with a rubric</span><span className="block text-xs text-[var(--text-muted)]">Score each part; the grade is the share of points. Students see the rubric before they start.</span></span>
          </label>
          {useRubric && (
            <div className="space-y-2 ps-1">
              {rubric.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input aria-label={`Rubric row ${i + 1} name`} className="input h-9 flex-1 text-sm" value={r.label} maxLength={80} onChange={(e) => setRubric((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
                  <input aria-label={`Rubric row ${i + 1} points`} type="number" min={1} max={100} className="input h-9 w-20 text-sm" value={r.points} onChange={(e) => setRubric((x) => x.map((y, j) => (j === i ? { ...y, points: Number(e.target.value) } : y)))} />
                  <span className="text-xs text-[var(--text-muted)]">pts</span>
                  <button type="button" aria-label={`Remove rubric row ${i + 1}`} disabled={rubric.length === 1} onClick={() => setRubric((x) => x.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)] disabled:opacity-30"><X className="size-4" /></button>
                </div>
              ))}
              {rubric.length < 8 && <button type="button" onClick={() => setRubric((x) => [...x, { label: '', points: 2 }])} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"><Plus className="size-3.5" />Add a row</button>}
              <p className={cn('text-xs', show('rubric') ? 'text-[var(--danger)]' : 'text-[var(--text-muted)]')}>{show('rubric') ?? `Total ${rubric.reduce((t, r) => t + (Number(r.points) || 0), 0)} points.`}</p>
            </div>
          )}
        </fieldset>
      )}

      {format === 'form' && (
        <fieldset className="space-y-3">
          <legend className="mb-1 flex w-full items-center justify-between text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">Questions <span className="normal-case tracking-normal">{questions.length} of 20</span></legend>
          {show('questions') && <p className="text-xs text-[var(--danger)]">{show('questions')}</p>}
          {questions.map((q, i) => (
            <div key={q.id} className={cn('rounded-[var(--radius)] border p-4', show(`q${i}`) ? 'border-[var(--danger)]' : 'border-[var(--border)]')}>
              <div className="flex items-center gap-2">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--deep)] text-xs font-medium text-white">{i + 1}</span>
                <select aria-label={`Question ${i + 1} type`} className="input h-9 w-44 py-0 text-sm" value={q.type} onChange={(e) => { const t = e.target.value as QType; updateQ(i, { type: t, options: t === 'choice' ? (q.options.length >= 2 ? q.options : ['', '']) : q.options }); }}>
                  {(Object.keys(Q_LABEL) as QType[]).map((t) => <option key={t} value={t}>{Q_LABEL[t]}</option>)}
                </select>
                <label className="ms-auto flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><input type="checkbox" checked={q.required} onChange={(e) => updateQ(i, { required: e.target.checked })} className="size-4 accent-[var(--deep)]" />Required</label>
                <button type="button" aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => moveQ(i, -1)} className="grid size-8 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)] disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
                <button type="button" aria-label={`Move question ${i + 1} down`} disabled={i === questions.length - 1} onClick={() => moveQ(i, 1)} className="grid size-8 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)] disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
                <button type="button" aria-label={`Remove question ${i + 1}`} disabled={questions.length === 1} onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] disabled:opacity-30"><Trash2 className="size-3.5" /></button>
              </div>
              <input aria-label={`Question ${i + 1}`} className="input mt-3" value={q.prompt} maxLength={300} onChange={(e) => updateQ(i, { prompt: e.target.value })} placeholder={q.type === 'choice' ? 'e.g. What is the tone of the poem?' : q.type === 'long' ? 'e.g. Explain the central metaphor in 3 to 4 sentences.' : 'e.g. Who is the narrator?'} />
              {q.type === 'choice' && (
                <div className="mt-3 space-y-2 ps-9">
                  {q.options.map((o, k) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="size-3.5 shrink-0 rounded-full border border-[var(--border)]" aria-hidden />
                      <input aria-label={`Question ${i + 1} option ${k + 1}`} className="input h-9 text-sm" value={o} maxLength={120} placeholder={`Option ${k + 1}`} onChange={(e) => updateQ(i, { options: q.options.map((x, m) => (m === k ? e.target.value : x)) })} />
                      <button type="button" aria-label={`Remove option ${k + 1}`} disabled={q.options.length <= 2} onClick={() => updateQ(i, { options: q.options.filter((_, m) => m !== k) })} className="grid size-8 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)] disabled:opacity-30"><Trash2 className="size-3.5" /></button>
                    </div>
                  ))}
                  {q.options.length < 6 && <button type="button" onClick={() => updateQ(i, { options: [...q.options, ''] })} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline"><Plus className="size-3.5" />Add option</button>}
                </div>
              )}
              {show(`q${i}`) && <p className="mt-2 text-xs text-[var(--danger)]">{show(`q${i}`)}</p>}
            </div>
          ))}
          {questions.length < 20 && (
            <div className="flex flex-wrap gap-2">
              {(Object.keys(Q_LABEL) as QType[]).map((t) => <Button key={t} type="button" size="sm" variant="outline" onClick={() => setQuestions((qs) => [...qs, newQuestion(t)])}><Plus />{Q_LABEL[t]}</Button>)}
            </div>
          )}
        </fieldset>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="field"><span>Set on</span><input aria-label="Set on" type="date" className="input" value={setDate} onChange={(e) => setSetDate(e.target.value)} /></label>
        <label className="field"><span>Due</span><input aria-label="Due" type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-invalid={Boolean(show('dueDate'))} /></label>
        <label className="field"><span>Minutes</span><input aria-label="Minutes" type="number" min={10} max={240} className="input" value={mins} onChange={(e) => setMins(Number(e.target.value))} /></label>
      </div>
      {show('dueDate') && <p className="-mt-3 text-xs text-[var(--danger)]">{show('dueDate')}</p>}
      {best && <p className="text-xs text-[var(--text-muted)]">{isBest ? <span className="font-medium text-[var(--success)]">Recommended window: {best.likelihood}% likely on time.</span> : <>Recommended: set {best.setLabel}, due {best.dueLabel} ({best.likelihood}% likely on time).</>} It appears in each student&rsquo;s Murshid plan as soon as you post.</p>}

      <div className="flex items-center justify-between gap-3">
        <span id="post-status" className="text-xs text-[var(--text-muted)]" aria-live="polite">{saved === 'saving' ? 'Saving draft…' : saved === 'saved' ? 'Draft saved on this device' : ''}</span>
        <Button type="submit" disabled={busy} aria-busy={busy}>{busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : <Send />}{busy ? 'Posting…' : 'Post to class'}</Button>
      </div>
    </form>
  );
}

type SortKey = 'title' | 'set' | 'due' | 'handedIn';

/** Every assignment for the class: search, filter by format, sort any column, open a form's answers. */
export function AssignmentsTable({ items, loading, classId, onPost }: { items: any[] | null; loading: boolean; classId: string; onPost: () => void }) {
  const [q, setQ] = useState('');
  const [fmt, setFmt] = useState<'all' | Format>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'due', dir: 'desc' });
  const [open, setOpen] = useState<any>(null);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = (items ?? []).filter((a) => (fmt === 'all' || (a.format ?? 'task') === fmt) && (!needle || `${a.title} ${a.instructions ?? ''}`.toLowerCase().includes(needle)));
    const val = (a: any) => sort.key === 'title' ? a.title.toLowerCase() : sort.key === 'set' ? a.setDate : sort.key === 'due' ? a.dueDate : a.students ? a.handedIn / a.students : 0;
    return [...list].sort((a, b) => { const x = val(a), y = val(b); const c = x < y ? -1 : x > y ? 1 : 0; return sort.dir === 'asc' ? c : -c; });
  }, [items, q, fmt, sort]);
  const by = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  const counts = useMemo(() => { const c: Record<string, number> = { all: items?.length ?? 0 }; for (const a of items ?? []) c[a.format ?? 'task'] = (c[a.format ?? 'task'] ?? 0) + 1; return c; }, [items]);

  return (
    <Card pad={false} title="Assignments" action={
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
        <label className="relative min-w-0 flex-1 sm:flex-none"><span className="sr-only">Search assignments</span>
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-3.5 text-[var(--text-muted)]" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="input h-9 w-full ps-8 text-sm sm:w-48" />
        </label>
        <select aria-label="Filter by format" className="input h-9 min-w-0 flex-1 py-0 text-sm sm:w-44 sm:flex-none" value={fmt} onChange={(e) => setFmt(e.target.value as typeof fmt)}>
          <option value="all">All formats ({counts.all})</option>
          {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label} ({counts[f.id] ?? 0})</option>)}
        </select>
      </div>}>
      {loading && !items ? <SkeletonRows /> : !items?.length ? (
        <EmptyState icon={<ClipboardList />} title="No assignments yet" action={<Button onClick={onPost}><Plus />Post the first one</Button>}>Post a written task, a quick Murshid form, or a Google or Microsoft Forms link. It lands in every student&rsquo;s plan.</EmptyState>
      ) : !rows.length ? (
        <EmptyState icon={<Search />} title="Nothing matches" action={<Button variant="outline" onClick={() => { setQ(''); setFmt('all'); }}>Clear filters</Button>}>Try another word, or show all formats.</EmptyState>
      ) : (
        <table className="tbl min-w-[860px]">
          <thead><tr>
            <SortHeader label="Assignment" active={sort.key === 'title'} dir={sort.dir} onSort={() => by('title')} />
            <th>Format</th>
            <SortHeader label="Set" active={sort.key === 'set'} dir={sort.dir} onSort={() => by('set')} />
            <SortHeader label="Due" active={sort.key === 'due'} dir={sort.dir} onSort={() => by('due')} />
            <th>Source</th>
            <SortHeader label="Handed in" active={sort.key === 'handedIn'} dir={sort.dir} onSort={() => by('handedIn')} />
          </tr></thead>
          <tbody>
            {rows.map((a) => {
              const f: Format = a.format ?? 'task';
              return (
                <tr key={a.id} className={a.posted ? 'bg-[color-mix(in_oklab,var(--success)_7%,transparent)]' : ''}>
                  <td><Link href={`/teacher/assignments/${encodeURIComponent(a.id)}?class=${classId}`} className="font-medium hover:underline">{a.title}</Link>{a.toReview > 0 && <Badge tone="warning" className="ml-2">{a.toReview} to review</Badge>}{a.unread > 0 && <Badge tone="accent" className="ml-2">{a.unread} new message{a.unread === 1 ? '' : 's'}</Badge>}{a.attachmentCount > 0 && <span className="ml-2 inline-flex items-center gap-0.5 text-xs text-[var(--text-muted)]"><Paperclip className="size-3" />{a.attachmentCount}</span>}{a.posted && <Badge tone="success" className="ml-2">New</Badge>}{a.personalised && <Badge tone="accent" className="ml-2">For {a.students === 1 ? a.assigneeNames?.[0] ?? '1 student' : `${a.students} students`}</Badge>}{a.instructions && <div className="line-clamp-2 text-xs text-[var(--text-muted)]">{a.instructions}</div>}</td>
                  <td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 text-sm"><FormatIcon f={f} className="size-3.5" />{FORMAT_LABEL[f]}</span>
                    {f === 'form' && <button onClick={() => setOpen(a)} className="mt-1 block text-xs font-medium text-[var(--accent)] hover:underline">{a.responses ?? 0} answer{a.responses === 1 ? '' : 's'} &middot; view</button>}
                    {(f === 'google_form' || f === 'microsoft_form') && a.formUrl && <a href={a.formUrl} target="_blank" rel="noopener noreferrer" className="mt-1 flex w-max items-center gap-1 text-xs font-medium text-[var(--accent)] hover:underline">Open form<ExternalLink className="size-3" /></a>}
                  </td>
                  <td className="whitespace-nowrap">{a.setLabel}</td>
                  <td className="whitespace-nowrap">{a.dueLabel}</td>
                  <td>{a.source === 'teams' ? <Badge tone="info">Teams</Badge> : <Badge>Murshid portal</Badge>}</td>
                  <td className="w-40"><div className="flex items-center gap-2"><Bar value={a.handedIn} max={a.students} /><span className="whitespace-nowrap text-xs tabular-nums">{a.handedIn}/{a.students}</span></div>{a.missing > 0 && <div className="text-[11px] text-[var(--danger)]">{a.missing} missing</div>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <Modal open={open !== null} title={open ? `Answers · ${open.title}` : ''} onClose={() => setOpen(null)} wide>
        {open && <ResponsesView classId={classId} itemId={open.id} />}
      </Modal>
    </Card>
  );
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** One row per student with each answer; copy or download as CSV for a markbook. */
export function ResponsesView({ classId, itemId }: { classId: string; itemId: string }) {
  const r = useData<any>(`/teacher/classes/${classId}/assignments/${itemId}/responses`, 'staff');
  const [only, setOnly] = useState<'all' | 'answered' | 'missing'>('all');
  const [copied, setCopied] = useState(false);
  if (r.error) return <ErrorBox error={r.error} />;
  if (!r.data) return <SkeletonRows rows={5} />;
  const qs: any[] = r.data.assignment.questions ?? [];
  // answered first (newest first), then everyone still to answer in register order
  const rows: any[] = r.data.rows.filter((x: any) => only === 'all' || (only === 'answered' ? x.response : !x.response))
    .map((x: any, i: number) => ({ x, i })).sort((a: any, b: any) => (b.x.response ? 1 : 0) - (a.x.response ? 1 : 0) || String(b.x.response?.updatedAt ?? '').localeCompare(String(a.x.response?.updatedAt ?? '')) || a.i - b.i).map((o: any) => o.x);
  const csv = () => [['Student', 'Section', 'Submitted', ...qs.map((q) => q.prompt)], ...r.data.rows.map((x: any) => [x.name, x.section ?? '', x.response?.updatedAt ?? '', ...qs.map((q) => x.response?.answers?.[q.id] ?? '')])].map((row) => row.map((c: string) => csvCell(String(c))).join(',')).join('\n');
  const copy = async () => { try { await navigator.clipboard.writeText(csv()); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* clipboard blocked */ } };
  const download = () => { const url = URL.createObjectURL(new Blob([csv()], { type: 'text/csv' })); const a = document.createElement('a'); a.href = url; a.download = `${r.data.assignment.title.replace(/[^\w]+/g, '-').toLowerCase()}-answers.csv`; a.click(); URL.revokeObjectURL(url); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="figure text-[2rem]">{r.data.responded}/{r.data.students}</div><span className="text-sm text-[var(--text-muted)]">students answered</span></div>
        <div className="flex items-center gap-2">
          <select aria-label="Show" className="input h-9 w-36 py-0 text-sm" value={only} onChange={(e) => setOnly(e.target.value as typeof only)}><option value="all">Everyone</option><option value="answered">Answered</option><option value="missing">Not yet</option></select>
          <Button size="sm" variant="outline" onClick={copy}><Copy />{copied ? 'Copied' : 'Copy CSV'}</Button>
          <Button size="sm" variant="outline" onClick={download}><Download />Download</Button>
        </div>
      </div>
      <div className="max-h-[52vh] overflow-auto rounded-[var(--radius)] border border-[var(--border)]">
        <table className="tbl min-w-[640px]">
          <thead className="sticky top-0 bg-[var(--popover)]"><tr><th>Student</th>{qs.map((q, i) => <th key={q.id} title={q.prompt}>Q{i + 1}</th>)}</tr></thead>
          <tbody>
            {rows.length ? rows.map((x) => (
              <tr key={x.studentId}>
                <td className="whitespace-nowrap"><span className="font-medium">{x.name}</span>{x.section && <span className="ms-1.5 text-xs text-[var(--text-muted)]">{x.section}</span>}</td>
                {qs.map((q) => <td key={q.id} className="text-sm">{x.response ? (x.response.answers?.[q.id] || <span className="text-[var(--text-muted)]">&mdash;</span>) : <span className="whitespace-nowrap text-xs text-[var(--text-muted)]">Not yet</span>}</td>)}
              </tr>
            )) : <tr><td colSpan={qs.length + 1} className="py-8 text-center text-sm text-[var(--text-muted)]">{only === 'answered' ? 'No answers yet.' : 'Everyone has answered.'}</td></tr>}
          </tbody>
        </table>
      </div>
      <ol className="space-y-1 text-xs text-[var(--text-muted)]">{qs.map((q, i) => <li key={q.id}><span className="font-medium text-[var(--text)]">Q{i + 1}.</span> {q.prompt}{q.type === 'choice' && <> &middot; {q.options.join(' / ')}</>}</li>)}</ol>
    </div>
  );
}

/** Pick students for personalised work: search, quick groups (at risk, keep an eye), checkboxes. */
function StudentPicker({ students, chosen, setChosen, find, setFind }: { students: ClassStudent[]; chosen: string[]; setChosen: (v: string[]) => void; find: string; setFind: (v: string) => void }) {
  const q = find.trim().toLowerCase();
  const shown = students.filter((s) => !q || s.name.toLowerCase().includes(q));
  const group = (status: string) => students.filter((s) => s.status === status).map((s) => s.id);
  const toggle = (id: string) => setChosen(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  const quick = (label: string, ids: string[]) => ids.length ? (
    <button type="button" onClick={() => setChosen([...new Set([...chosen, ...ids])])} className="inline-flex h-8 items-center rounded-full border border-[var(--border)] px-3 text-xs font-medium hover:border-[var(--text)]">+ {label} ({ids.length})</button>
  ) : null;
  return (
    <div className="mt-3 rounded-[var(--radius)] border border-[var(--border)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1"><span className="sr-only">Find a student</span>
          <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto size-3.5 text-[var(--text-muted)]" aria-hidden />
          <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a student" className="input h-9 ps-8 text-sm" />
        </label>
        {quick('At risk', group('at_risk'))}
        {quick('Keep an eye', group('watch'))}
        {chosen.length > 0 && <button type="button" onClick={() => setChosen([])} className="h-8 px-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)]">Clear</button>}
      </div>
      <ul className="mt-2 max-h-56 overflow-y-auto" aria-label="Students">
        {shown.map((s) => (
          <li key={s.id}>
            <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-[10px] px-2 py-1.5 hover:bg-[var(--surface)]">
              <input type="checkbox" checked={chosen.includes(s.id)} onChange={() => toggle(s.id)} className="size-4 accent-[var(--deep)]" />
              <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
              {s.statusLabel && s.status !== 'on_track' && <Badge tone={s.status === 'at_risk' ? 'danger' : s.status === 'watch' ? 'warning' : 'success'}>{s.statusLabel}</Badge>}
            </label>
          </li>
        ))}
        {!shown.length && <li className="px-2 py-4 text-center text-sm text-[var(--text-muted)]">No student matches &ldquo;{find}&rdquo;.</li>}
      </ul>
    </div>
  );
}
