'use client';

import { CheckCircle2, ExternalLink, ListChecks, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { countAr } from '@/lib/plural';
import { useApp } from '@/components/providers/app-provider';
import { MicrosoftMark } from '@/components/shell/icons';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { ApiError, newIdempotencyKey } from '@/lib/http';
import { answerForm, type FormResponse } from '@/lib/school-api';
import { useAutosave } from '@/lib/use-autosave';
import { cn } from '@/lib/utils';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Question { id: string; type: 'short' | 'long' | 'choice'; prompt: string; options?: string[]; required: boolean }

/** What a student can do with an assignment: open a linked Google / Microsoft Form, or answer a Murshid form. */
export function AssignmentAction({ a, onAnswered }: { a: any; onAnswered: (r: FormResponse) => void }) {
  const { tx } = useApp();
  const [open, setOpen] = useState(false);
  if ((a.format === 'google_form' || a.format === 'microsoft_form') && a.formUrl) {
    return (
      <a href={a.formUrl} target="_blank" rel="noopener noreferrer"
        className="lift mt-2 inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium transition-colors hover:border-foreground">
        {a.format === 'microsoft_form' ? <MicrosoftMark className="size-3.5" /> : <ExternalLink className="size-3.5" />}
        {a.format === 'google_form' ? tx('Open Google Form', 'افتح نموذج Google') : tx('Open Microsoft Form', 'افتح نموذج Microsoft')}
        <span className="sr-only">{tx('(opens in a new tab)', '(يفتح في علامة تبويب جديدة)')}</span>
      </a>
    );
  }
  if (a.format !== 'form' || !a.questions?.length) return null;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button onClick={() => setOpen(true)}
        className={cn('lift mt-2 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors',
          a.response ? 'border border-border hover:border-foreground' : 'bg-foreground text-background hover:bg-[var(--deep)]')}>
        {a.response ? <CheckCircle2 className="size-3.5 text-success" /> : <ListChecks className="size-3.5" />}
        {a.response ? tx('Answered · edit', 'تمت الإجابة · تعديل') : tx(`Answer ${a.questions.length} question${a.questions.length > 1 ? 's' : ''}`, `أجب عن ${countAr(a.questions.length, { one: 'سؤال واحد', two: 'سؤالين', few: 'أسئلة', many: 'سؤالاً', other: 'سؤال' })}`)}
      </button>
      <DialogContent title={a.title} description={`${a.subject} · ${a.teacher}`} className="max-h-[88vh] w-[min(94vw,640px)] overflow-y-auto">
        <FormFill a={a} onDone={(r) => { onAnswered(r); setOpen(false); }} />
      </DialogContent>
    </Dialog>
  );
}

function FormFill({ a, onDone }: { a: any; onDone: (r: FormResponse) => void }) {
  const { client, tx, toast } = useApp();
  const qs: Question[] = a.questions;
  const draft = useAutosave<Record<string, string>>(`form:${a.id}`, a.response?.answers ?? {});
  const answers = draft.value;
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());
  useEffect(() => { key.current = newIdempotencyKey(); }, [answers]);

  const missing = qs.filter((q) => q.required && !answers[q.id]?.trim()).map((q) => q.id);
  const set = (id: string, v: string) => draft.setValue({ ...answers, [id]: v });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setTouched(true); setError(null);
    if (busy) return;
    if (missing.length) { document.getElementById(`fq-${missing[0]}`)?.focus(); return; }
    setBusy(true);
    try {
      const clean = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
      const r = await answerForm(client.devUser, a.id, clean, key.current);
      draft.clear();
      toast({ title: r.updated ? tx('Answers updated', 'حُدّثت الإجابات') : tx('Answers sent to your teacher', 'أُرسلت الإجابات إلى معلمك'), description: a.title, tone: 'success' });
      onDone(r.response);
    } catch (err) {
      const ae = err as ApiError;
      setError(ae.code === 'rate_limited' ? tx('Too many tries. Wait a moment and send again.', 'محاولات كثيرة. انتظر قليلاً ثم أرسل مجددًا.') : ae.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {a.instructions && <p className="rounded-[16px] bg-surface p-3.5 text-sm">{a.instructions}</p>}
      {draft.status === 'restored' && !a.response && <p className="text-xs text-muted-foreground">{tx('Your unsent answers are back.', 'عادت إجاباتك غير المرسلة.')}</p>}
      {error && <p role="alert" className="rounded-[14px] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] px-3.5 py-2.5 text-sm text-danger">{error}</p>}
      {qs.map((q, i) => {
        const bad = touched && missing.includes(q.id);
        const label = <span className="text-sm font-medium"><span className="me-1.5 text-muted-foreground">{i + 1}.</span>{q.prompt}{q.required ? <span className="ms-1 text-danger" aria-hidden>*</span> : <span className="ms-1.5 text-xs font-normal text-muted-foreground">{tx('optional', 'اختياري')}</span>}</span>;
        if (q.type === 'choice') {
          return (
            <fieldset key={q.id} aria-invalid={bad || undefined} aria-describedby={bad ? `fe-${q.id}` : undefined}>
              <legend className="mb-2">{label}</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options!.map((o, k) => (
                  <label key={o} className={cn('flex cursor-pointer items-center gap-2.5 rounded-[14px] border px-3.5 py-2.5 text-sm transition-colors has-[:checked]:border-[var(--deep)] has-[:checked]:bg-[color-mix(in_oklab,var(--brand-light)_8%,transparent)] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[var(--brand-light)]', bad ? 'border-danger' : 'border-border hover:border-foreground/40')}>
                    <input id={k === 0 ? `fq-${q.id}` : undefined} type="radio" name={q.id} value={o} checked={answers[q.id] === o} onChange={() => set(q.id, o)} className="size-4 accent-[var(--deep)]" />
                    {o}
                  </label>
                ))}
              </div>
              {bad && <p id={`fe-${q.id}`} className="mt-1.5 text-xs text-danger">{tx('Pick one answer.', 'اختر إجابة واحدة.')}</p>}
            </fieldset>
          );
        }
        const Field = q.type === 'long' ? Textarea : Input;
        return (
          <label key={q.id} className="flex flex-col gap-2">
            {label}
            <Field id={`fq-${q.id}`} value={answers[q.id] ?? ''} maxLength={4000} onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => set(q.id, e.target.value)}
              aria-invalid={bad || undefined} aria-describedby={bad ? `fe-${q.id}` : undefined} className={cn(q.type === 'long' && 'min-h-28', bad && 'border-danger')} />
            {bad && <span id={`fe-${q.id}`} className="text-xs text-danger">{tx('This one is required.', 'هذا السؤال مطلوب.')}</span>}
          </label>
        );
      })}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground" aria-live="polite">{draft.status === 'saving' ? tx('Saving…', 'جارٍ الحفظ…') : draft.status === 'saved' ? tx('Draft saved on this device', 'حُفظت المسودة على هذا الجهاز') : a.response ? tx('You can change your answers until the due date.', 'يمكنك تعديل إجاباتك حتى موعد التسليم.') : ''}</span>
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden /> : <Send className="size-4" />}
          {busy ? tx('Sending…', 'جارٍ الإرسال…') : a.response ? tx('Update answers', 'حدّث الإجابات') : tx('Send answers', 'أرسل الإجابات')}
        </Button>
      </div>
    </form>
  );
}
