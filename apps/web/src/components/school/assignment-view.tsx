'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Camera, CheckCircle2, Clock3, Link2, Loader2, MessageCircle, NotebookPen, Paperclip, PenLine, RotateCcw, Send, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page } from '@/components/shared/page';
import { LoadingState } from '@/components/shared/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { friendlyDates } from '@/lib/friendly-dates';
import { ApiError, newIdempotencyKey } from '@/lib/http';
import { getAssignment, handIn, sendMessage, undoHandIn, uploadFile, type AssignmentDetail, type FileRef, type Message } from '@/lib/school-api';
import { notebooks } from '@/lib/notebook';
import { ACCEPT_HANDIN, prepareFile, UploadError, type Prepared } from '@/lib/upload';
import { useAutosave } from '@/lib/use-autosave';
import { subjectName } from '@/lib/subjects';
import { cn } from '@/lib/utils';
import { Files } from './files';
import { AssignmentAction } from './form-assignment';
import { NotebookPicker } from './notebook-picker';
import { nAr } from '@/lib/plural';

type Pending = { key: string; name: string; preview?: string; state: 'uploading' | 'error'; error?: string };
type Attached = FileRef & { preview?: string };

/** Upload prepared files one by one; returns the refs that made it and reports the ones that did not. */
function useUploader(devUser: string) {
  const [pending, setPending] = useState<Pending[]>([]);
  const upload = useCallback(async (items: (Prepared | File)[], onDone: (f: Attached) => void) => {
    for (const it of items) {
      const key = Math.random().toString(36).slice(2);
      const name = it.name;
      setPending((p) => [...p, { key, name, state: 'uploading', preview: 'preview' in it ? it.preview : undefined }]);
      try {
        const prepared = it instanceof File ? await prepareFile(it) : it;
        setPending((p) => p.map((x) => (x.key === key ? { ...x, preview: prepared.preview } : x)));
        const ref = await uploadFile(devUser, { name: prepared.name, mime: prepared.mime, data: prepared.data });
        onDone({ ...ref, preview: prepared.preview });
        setPending((p) => p.filter((x) => x.key !== key));
      } catch (e) {
        const msg = e instanceof UploadError || e instanceof ApiError ? e.message : 'Upload failed. Check your connection and try again.';
        setPending((p) => p.map((x) => (x.key === key ? { ...x, state: 'error', error: msg } : x)));
      }
    }
  }, [devUser]);
  const dismiss = (key: string) => setPending((p) => p.filter((x) => x.key !== key));
  return { pending, upload, dismiss, busy: pending.some((p) => p.state === 'uploading') };
}

const STATUS: Record<AssignmentDetail['status'], { en: string; ar: string; tone: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'navy' }> = {
  assigned: { en: 'Assigned', ar: 'مُسند', tone: 'neutral' },
  overdue: { en: 'Overdue', ar: 'متأخر', tone: 'danger' },
  handed_in: { en: 'Handed in', ar: 'سُلّم', tone: 'success' },
  returned: { en: 'Returned for changes', ar: 'أُعيد للتعديل', tone: 'warning' },
  marked: { en: 'Marked', ar: 'مُصحّح', tone: 'navy' },
};

export function AssignmentView({ id }: { id: string }) {
  const { client, tx, toast, locale } = useApp();
  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => getAssignment(client.devUser, id).then(setData).catch((e) => setError((e as Error).message)), [client.devUser, id]);
  useEffect(() => { void load(); }, [load]);

  if (error) return (
    <Page>
      <Back />
      <Card><p className="text-sm">{error.includes('not found') ? tx('This assignment isn’t here any more.', 'هذا الواجب لم يعد موجوداً.') : error}</p><Button className="mt-4" variant="secondary" onClick={() => { setError(null); void load(); }}>{tx('Try again', 'حاول مجدداً')}</Button></Card>
    </Page>
  );
  if (!data) return <Page><Back /><LoadingState label={tx('Opening the assignment…', 'جارٍ فتح الواجب…')} rows={4} /></Page>;

  const a = data.assignment;
  const st = STATUS[data.status];
  const isTask = a.format === 'task';
  const feedbackCard = (cls: string) => data.handIn && data.handIn.state !== 'handed_in' && data.handIn.feedback ? (
            <Card className={cn(cls, data.handIn.state === 'returned' && 'ring-1 ring-[color-mix(in_oklab,var(--warning)_45%,transparent)]')}>
              <CardHeader title={data.handIn.state === 'marked' ? tx('Feedback', 'الملاحظات') : tx('Changes requested', 'تعديلات مطلوبة')} icon={data.handIn.state === 'marked' ? <CheckCircle2 /> : <RotateCcw />}
                action={data.handIn.grade !== null && data.handIn.state === 'marked' ? <span className="text-2xl font-semibold tabular-nums">{data.handIn.grade}%</span> : undefined} />
              <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed [overflow-wrap:anywhere]">{data.handIn.feedback}</p>
              <p className="mt-3 text-xs text-muted-foreground">{data.handIn.reviewer}</p>
            </Card>
  ) : null;
  return (
    <Page>
      <Back />
      <header className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={st.tone}>{tx(st.en, st.ar)}{data.status === 'marked' && data.handIn?.grade !== null && data.handIn?.grade !== undefined ? ` · ${data.handIn.grade}%` : ''}</Badge>
          {data.handIn?.late && <Badge tone="warning">{tx('Late', 'متأخر')}</Badge>}
          <span className="text-sm text-muted-foreground">{subjectName(a.subject, locale)} · <bdi>{a.teacher}</bdi></span>
        </div>
        <h1 dir="auto" className="text-[1.75rem] font-medium leading-tight tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[2.25rem]">{a.title}</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Clock3 className="size-4" />{tx(`Due ${friendlyDates(a.dueDate, 'en')}, ${a.dueTime}`, `التسليم ${friendlyDates(a.dueDate, 'ar')}، ${a.dueTime}`)} · {tx(`about ${a.minutes} min`, `حوالي ${nAr(a.minutes, 'minute', true)}`)}</p>
      </header>

      {data.reminders.length > 0 && (
        <div role="status" className="mb-4 rounded-2xl border border-[color-mix(in_oklab,var(--warning)_35%,transparent)] tint-warning px-4 py-3 text-sm">
          <strong className="font-medium">{tx(`${data.reminders[0]!.teacherName} sent a reminder`, `أرسل ${data.reminders[0]!.teacherName} تذكيراً`)}</strong>{data.reminders[0]!.note ? `: “${data.reminders[0]!.note}”` : ''}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          <Card>
            <CardHeader title={tx('Instructions', 'التعليمات')} />
            <p dir={a.instructions ? 'auto' : undefined} className="whitespace-pre-wrap text-[0.9375rem] leading-relaxed [overflow-wrap:anywhere]">{a.instructions ? friendlyDates(a.instructions, locale) : tx('No written instructions. Check the attachments or ask your teacher below.', 'لا تعليمات مكتوبة. راجع المرفقات أو اسأل معلمك أدناه.')}</p>
            {a.format === 'task' && <NotesButton id={a.id} title={a.title} subject={a.subject} />}
            {a.photosRequired && (
              <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-[color-mix(in_oklab,var(--deep)_7%,transparent)] px-3.5 py-3 text-sm"><Camera className="mt-0.5 size-4 shrink-0" />{tx('Hand in photos of your notes. Take them with your camera, or add pages from your Murshid notebook.', 'سلّم صوراً لملاحظاتك. التقطها بالكاميرا أو أضف صفحات من دفتر مرشد.')}</p>
            )}
            {(a.attachments.length > 0 || a.links.length > 0) && (
              <div className="mt-5 flex flex-col gap-2.5">
                <p className="eyebrow">{tx('From your teacher', 'من معلمك')}</p>
                <Files files={a.attachments} />
                {a.links.map((l) => (
                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-sm hover:bg-surface">
                    <Link2 className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate font-medium">{l.label}</span><span className="sr-only">{tx('(opens in a new tab)', '(يفتح في علامة تبويب جديدة)')}</span>
                  </a>
                ))}
              </div>
            )}
            {a.rubric && (
              <div className="mt-5">
                <p className="eyebrow mb-2">{tx('How it’s marked', 'معايير التصحيح')}</p>
                <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                  {a.rubric.map((r) => <li key={r.id} className="flex justify-between gap-3 px-3.5 py-2.5"><span>{r.label}</span><span className="shrink-0 tabular-nums text-muted-foreground">{data.handIn?.scores ? `${data.handIn.scores[r.id] ?? 0} / ` : ''}{r.points} {tx('pts', 'نقاط')}</span></li>)}
                </ul>
              </div>
            )}
          </Card>

          {feedbackCard('lg:hidden')}
          {isTask ? <HandInCard data={data} onChange={setData} /> : (
            <Card>
              <CardHeader title={tx('Your answer', 'إجابتك')} />
              <AssignmentAction a={{ ...a, response: data.response }} onAnswered={(r) => { setData({ ...data, response: r, status: 'handed_in' }); toast({ title: tx('Answers sent', 'أُرسلت الإجابات'), tone: 'success' }); }} />
            </Card>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-5">
          {feedbackCard('hidden lg:block')}
          <Thread id={id} teacher={a.teacher} messages={data.messages} onSent={(m) => setData((d) => (d ? { ...d, messages: [...d.messages, m] } : d))} />
        </div>
      </div>
    </Page>
  );
}

/** Opens (or creates) a Cornell-paper notebook for this assignment; its pages come back here to hand in. */
function NotesButton({ id, title, subject }: { id: string; title: string; subject: string }) {
  const { tx } = useApp();
  const router = useRouter();
  return (
    <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.push(`/app/study/notebook/${notebooks.forAssignment(id, title, subject)}`)}>
      <PenLine />{tx('Take notes in my notebook', 'دوّن الملاحظات في دفتري')}
    </Button>
  );
}

function Back() {
  const { tx } = useApp();
  return <Link href="/app/school" className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{tx('School', 'المدرسة')}</Link>;
}

/** Writing an answer and adding photos/files, then handing in (and updating or undoing it). */
function HandInCard({ data, onChange }: { data: AssignmentDetail; onChange: (d: AssignmentDetail) => void }) {
  const { client, tx, toast } = useApp();
  const a = data.assignment;
  const h = data.handIn;
  // the draft keeps the answer and the files already uploaded, so a reload (a phone camera often causes one) loses nothing
  const draft = useAutosave<{ text: string; files: FileRef[] }>(`handin:${a.id}`, { text: h?.text ?? '', files: h?.files ?? [] });
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const files: Attached[] = (draft.value.files ?? []).map((f) => (previews[f.id] ? { ...f, preview: previews[f.id] } : f));
  const setFiles = (fn: (x: FileRef[]) => FileRef[]) => draft.setValue((v) => ({ ...v, files: fn(v.files ?? []) }));
  const keep = (f: Attached) => { const { preview, ...ref } = f; if (preview) setPreviews((p) => ({ ...p, [f.id]: preview })); setFiles((x) => [...x, ref]); };
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const picker2 = useRef<HTMLInputElement>(null);
  const up = useUploader(client.devUser);
  const marked = h?.state === 'marked';
  const handedIn = h?.state === 'handed_in';
  const text = draft.value.text;
  const changed = !h || text.trim() !== h.text || files.map((f) => f.id).join() !== h.files.map((f) => f.id).join();

  const add = (list: (File | Prepared)[]) => { setErr(null); void up.upload(list, keep); };
  const submit = async () => {
    setErr(null);
    if (!text.trim() && !files.length) { setErr(tx('Write your answer or add a photo first.', 'اكتب إجابتك أو أضف صورة أولاً.')); return; }
    if (a.photosRequired && !files.some((f) => f.kind === 'image')) { setErr(tx('Your teacher asked for photos of your notes: add at least one.', 'طلب معلمك صوراً لملاحظاتك: أضف صورة واحدة على الأقل.')); return; }
    setSending(true);
    try {
      const r = await handIn(client.devUser, a.id, { text: text.trim(), fileIds: files.map((f) => f.id) }, newIdempotencyKey());
      draft.clear();
      onChange({ ...data, handIn: r.handIn, status: 'handed_in', overdue: false });
      toast({ title: r.updated ? tx('Hand-in updated', 'حُدّث التسليم') : tx('Handed in. Nice work.', 'تم التسليم. عمل رائع.'), tone: 'success' });
    } catch (e) { setErr((e as Error).message); } finally { setSending(false); }
  };
  const undo = async () => {
    setSending(true);
    try {
      await undoHandIn(client.devUser, a.id);
      onChange({ ...data, handIn: null, status: a.dueDate < new Date().toISOString().slice(0, 10) ? 'overdue' : 'assigned' });
      toast({ title: tx('Hand-in undone. You can change it and hand in again.', 'أُلغي التسليم. يمكنك التعديل والتسليم مجدداً.') });
    } catch (e) { setErr((e as Error).message); } finally { setSending(false); }
  };

  return (
    <Card>
      <CardHeader title={tx('Your work', 'عملك')} action={h ? <span className="text-xs text-muted-foreground">{handedIn ? tx('Handed in', 'سُلّم') : marked ? tx('Marked', 'مُصحّح') : tx('Returned', 'أُعيد')} · v{h.versions}</span> : draft.status === 'saved' ? <span className="text-xs text-muted-foreground">{tx('Draft saved', 'حُفظت المسودة')}</span> : undefined} />
      <label className="sr-only" htmlFor={`answer-${a.id}`}>{tx('Your answer', 'إجابتك')}</label>
      <Textarea id={`answer-${a.id}`} dir="auto" value={text} disabled={marked} onChange={(e) => { const t = e.target.value; draft.setValue((v) => ({ ...v, text: t })); }} rows={5} maxLength={8000}
        placeholder={a.photosRequired ? tx('Add a note for your teacher (optional)', 'أضف ملاحظة لمعلمك (اختياري)') : tx('Write your answer, or add photos of your work', 'اكتب إجابتك أو أضف صوراً لعملك')} />
      <div className="mt-1 text-end text-2xs text-muted-foreground tabular-nums">{text.trim() ? text.trim().split(/\s+/).length : 0} {tx('words', 'كلمة')}</div>

      {!marked && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input ref={camera} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ''; }} />
          <input ref={picker2} type="file" accept={ACCEPT_HANDIN} multiple hidden onChange={(e) => { add([...(e.target.files ?? [])]); e.target.value = ''; }} />
          <Button variant="secondary" size="sm" onClick={() => camera.current?.click()}><Camera />{tx('Take photo', 'التقط صورة')}</Button>
          <Button variant="secondary" size="sm" onClick={() => setPicker(true)}><NotebookPen />{tx('From my notebook', 'من دفتري')}</Button>
          <Button variant="secondary" size="sm" onClick={() => picker2.current?.click()}><Paperclip />{tx('Add files', 'أضف ملفات')}</Button>
        </div>
      )}
      <NotebookPicker open={picker} onOpenChange={setPicker} onPick={(list) => add(list)} assignmentId={a.id} />

      {(files.length > 0 || up.pending.length > 0) && (
        <div className="mt-4 flex flex-col gap-2">
          <Files files={files} onRemove={marked ? undefined : (fid) => setFiles((x) => x.filter((f) => f.id !== fid))} />
          {up.pending.map((p) => (
            <div key={p.key} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2 text-sm', p.state === 'error' ? 'border-[color-mix(in_oklab,var(--danger)_40%,transparent)] tint-danger' : 'border-border')}>
              {p.state === 'uploading' ? <Loader2 className="size-4 animate-spin" /> : <span aria-hidden>!</span>}
              <span className="min-w-0 flex-1 truncate">{p.state === 'uploading' ? tx(`Uploading ${p.name}…`, `جارٍ رفع ${p.name}…`) : p.error}</span>
              {p.state === 'error' && <button type="button" className="text-xs underline" onClick={() => up.dismiss(p.key)}>{tx('Dismiss', 'إخفاء')}</button>}
            </div>
          ))}
        </div>
      )}

      {err && <p role="alert" className="mt-3 text-sm text-danger">{err}</p>}
      {!marked && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button onClick={() => void submit()} disabled={sending || up.busy || (handedIn && !changed)}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            {h?.state === 'returned' ? tx('Hand in again', 'سلّم مجدداً') : handedIn ? (changed ? tx('Update hand-in', 'حدّث التسليم') : tx('Handed in', 'سُلّم')) : tx('Hand in', 'سلّم')}
          </Button>
          {handedIn && <Button variant="ghost" onClick={() => void undo()} disabled={sending}><Undo2 />{tx('Undo hand-in', 'تراجع عن التسليم')}</Button>}
          {up.busy && <span className="text-xs text-muted-foreground">{tx('Waiting for uploads…', 'بانتظار اكتمال الرفع…')}</span>}
        </div>
      )}
    </Card>
  );
}

/** Private messages with the teacher about this assignment (text and photos). */
function Thread({ id, teacher, messages, onSent }: { id: string; teacher: string; messages: Message[]; onSent: (m: Message) => void }) {
  const { client, tx, locale } = useApp();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attached[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const up = useUploader(client.devUser);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [messages.length]);
  const send = async () => {
    if (!text.trim() && !files.length) return;
    setBusy(true); setErr(null);
    try {
      const m = await sendMessage(client.devUser, id, { text: text.trim(), fileIds: files.map((f) => f.id) }, newIdempotencyKey());
      onSent(m); setText(''); setFiles([]);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const time = (iso: string) => new Date(iso).toLocaleString(locale === 'ar' ? 'ar-AE' : 'en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <Card>
      <CardHeader title={tx(`Private chat with ${teacher}`, `محادثة خاصة مع ${teacher}`)} icon={<MessageCircle />} />
      <div className="flex max-h-[26rem] flex-col gap-3 overflow-y-auto pe-1" aria-live="polite">
        {!messages.length && <p className="text-sm text-muted-foreground">{tx('Stuck, or want to check something? Ask here. Only you and your teacher see this.', 'عالق أو تريد التأكد من شيء؟ اسأل هنا. لا يرى هذه المحادثة إلا أنت ومعلمك.')}</p>}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('flex max-w-[88%] flex-col gap-1', m.from === 'student' ? 'self-end items-end' : 'self-start items-start')}>
              {m.review ? (
                <p className="whitespace-pre-wrap rounded-2xl bg-surface-2 px-3.5 py-2.5 text-sm [overflow-wrap:anywhere]">
                  <span className="mb-0.5 block text-xs font-medium text-muted-foreground">{m.review.action === 'mark' ? (m.review.grade !== null ? tx(`Marked ${m.review.grade}%`, `صُحّح: ${m.review.grade}٪`) : tx('Marked', 'صُحّح')) : tx('Returned for changes', 'أُعيد للتعديل')}</span>
                  <span dir="auto" className="block">{m.review.feedback}</span>
                </p>
              ) : m.text && <p dir="auto" className={cn('whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm [overflow-wrap:anywhere]', m.from === 'student' ? 'bg-[var(--deep)] text-white' : 'bg-surface-2')}>{m.text}</p>}
              {m.files.length > 0 && <Files files={m.files} compact className="w-56" />}
              <span className="text-2xs text-muted-foreground">{m.from === 'teacher' ? `${m.name} · ` : ''}{time(m.at)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={end} />
      </div>
      {(files.length > 0 || up.pending.length > 0) && (
        <div className="mt-3"><Files files={files} compact onRemove={(fid) => setFiles((x) => x.filter((f) => f.id !== fid))} />{up.pending.map((p) => <p key={p.key} className="mt-1 text-xs text-muted-foreground">{p.state === 'uploading' ? tx(`Uploading ${p.name}…`, `جارٍ رفع ${p.name}…`) : p.error}</p>)}</div>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
      <form className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { void up.upload([...(e.target.files ?? [])], (f) => setFiles((x) => [...x, f])); e.target.value = ''; }} />
        <Button type="button" size="icon" variant="secondary" aria-label={tx('Attach a photo', 'إرفاق صورة')} onClick={() => input.current?.click()}><Camera /></Button>
        <label htmlFor={`msg-${id}`} className="sr-only">{tx('Message', 'رسالة')}</label>
        <Textarea id={`msg-${id}`} dir="auto" value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} placeholder={tx('Message your teacher…', 'راسل معلمك…')} className="min-h-11 flex-1 resize-none py-2.5"
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
        <Button type="submit" size="icon" aria-label={tx('Send', 'إرسال')} disabled={busy || up.busy || (!text.trim() && !files.length)}>{busy ? <Loader2 className="animate-spin" /> : <Send className="rtl:-scale-x-100" />}</Button>
      </form>
    </Card>
  );
}
