'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import {
  ActionBarPrimitive, AssistantRuntimeProvider, ComposerPrimitive, MessagePrimitive, ThreadPrimitive, useLocalRuntime,
  type AssistantRuntime, type ChatModelAdapter,
} from '@assistant-ui/react';
import { ArrowDown, ArrowUp, Check, Copy, Mic, RotateCcw, Square, SquarePen, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { suggestionChips } from '@/components/dashboard/widgets';
import { MurshidMark } from '@/components/shell/icons';
import { Button } from '@/components/ui/button';
import { iconSwap, messageIn, pressable, spring, stagger, fadeUp } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { RenderChartTool, ShowCvTool, ShowOpportunitiesTool, ShowPlanTool, ShowTasksTool } from './tool-uis';
import { Workings } from '@/components/shared/workings';
import { CompanionStage, CompanionToggles } from '@/components/mascot/companion';
import type { WorkTrace } from '@/lib/types';
import type { BuddyStatus, ChatProgress } from '@/lib/types';

/** Live progress for the running turn (fed by SSE events), shown as neutral steps. */
const progress = {
  items: [] as ChatProgress[],
  listeners: new Set<() => void>(),
  reset() { this.items = []; this.emit(); },
  push(p: ChatProgress) { this.items = [...this.items, p]; this.emit(); },
  emit() { for (const l of this.listeners) l(); },
  subscribe(l: () => void) { progress.listeners.add(l); return () => { progress.listeners.delete(l); }; },
};

const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((res, rej) => {
  const t = setTimeout(res, ms);
  signal?.addEventListener('abort', () => { clearTimeout(t); rej(new DOMException('aborted', 'AbortError')); });
});

/** Local runtime adapter: POST /chat (or the bundled rule-based parser) → streamed text + tool-call parts. */
function useMurshidAdapter(): ChatModelAdapter {
  const { client, reportSource, prefs } = useApp();
  const persona = prefs.chatPersona === 'buddy' ? 'buddy' as const : 'tutor' as const;
  const ref = useRef({ client, reportSource, showWorkings: Boolean(prefs.showWorkings), persona });
  ref.current = { client, reportSource, showWorkings: Boolean(prefs.showWorkings), persona };
  return useMemo<ChatModelAdapter>(() => ({
    async *run({ messages, abortSignal }) {
      const last = messages[messages.length - 1];
      const text = last?.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ').trim() ?? '';
      progress.reset();
      // earlier turns go with the message, so both personas can follow the conversation ("that test I mentioned")
      const history = messages.slice(0, -1).slice(-10).map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ').trim(),
      })).filter((m) => m.content);
      const [res] = await Promise.all([ref.current.client.chat(text, abortSignal, (p) => progress.push(p), { history, persona: ref.current.persona }), sleep(380, abortSignal)]);
      ref.current.reportSource(res.source);
      const reply = res.data;
      // Stream word by word (no per-token animation; just text growth).
      const words = reply.text.split(/(\s+)/);
      let acc = '';
      for (let i = 0; i < words.length; i++) {
        acc += words[i];
        if (i % 2 === 0) {
          yield { content: [{ type: 'text' as const, text: acc }] };
          await sleep(16, abortSignal);
        }
      }
      const tools = reply.toolCalls.map((tc, i) => ({
        type: 'tool-call' as const,
        toolCallId: `tc-${Date.now().toString(36)}-${i}`,
        toolName: tc.name as string,
        args: tc.args as never,
        argsText: JSON.stringify(tc.args),
        result: { ok: true },
      }));
      // opt-in: "How Murshid worked this out" (the real plan from the server trace) under the reply
      if (ref.current.showWorkings && reply.trace) {
        tools.push({ type: 'tool-call' as const, toolCallId: `tc-${Date.now().toString(36)}-trace`, toolName: 'murshid_trace', args: reply.trace as never, argsText: '{}', result: { ok: true } });
      }
      progress.reset();
      yield { content: [{ type: 'text' as const, text: reply.text }, ...tools], status: { type: 'complete' as const, reason: 'stop' as const } };
    },
  }), []);
}

function useRuntimeValue<T>(runtime: AssistantRuntime, pick: (r: AssistantRuntime) => T, sub: 'thread' | 'composer' = 'thread'): T {
  return useSyncExternalStore(
    (cb) => (sub === 'thread' ? runtime.thread.subscribe(cb) : runtime.thread.composer.subscribe(cb)),
    () => pick(runtime),
    () => pick(runtime),
  );
}

/** Neutral progress labels: what Murshid is checking, never which internal part is doing it. */
const STEP_LABELS: Record<string, [string, string]> = {
  get_student_overview: ['Looking over your week', 'أراجع أسبوعك'],
  get_academics: ['Checking your grades', 'أراجع درجاتك'],
  get_training: ['Checking your training', 'أراجع تدريبك'],
  get_tasks: ['Checking your tasks', 'أراجع مهامك'],
  get_upcoming: ['Checking your timetable', 'أراجع جدولك'],
  get_goals: ['Checking your goals', 'أراجع أهدافك'],
  find_opportunities: ['Finding opportunities that fit you', 'أبحث عن فرص تناسبك'],
  get_applications: ['Checking your applications', 'أراجع طلباتك'],
  get_side_projects: ['Looking at your side project', 'أراجع مشروعك'],
  get_cv_profile: ['Reading your profile', 'أقرأ ملفك'],
  get_wellbeing_signals: ['Checking your workload', 'أراجع حجم عملك'],
  create_task: ['Adding it to your planner', 'أضيفها إلى مخططك'],
  build_week_plan: ['Building your week', 'أبني أسبوعك'],
  save_opportunity: ['Saving it for you', 'أحفظها لك'],
  add_project_milestone: ['Adding a milestone', 'أضيف مرحلة'],
  generate_linkedin_cv: ['Writing your CV', 'أكتب سيرتك الذاتية'],
  render_chart: ['Drawing your chart', 'أرسم الرسم البياني'],
};

function Thinking() {
  const { tx } = useApp();
  const items = useSyncExternalStore(progress.subscribe, () => progress.items, () => progress.items);
  const steps: string[] = [];
  for (const p of items) {
    if (p.type !== 'agent-tool') continue;
    const l = STEP_LABELS[p.tool];
    if (!l) continue;
    const label = tx(l[0], l[1]);
    if (!steps.includes(label)) steps.push(label);
  }
  if (steps.length) {
    return (
      <ul className="flex flex-col gap-1 text-sm text-muted-foreground" aria-live="polite">
        {steps.map((label, i) => {
          const current = i === steps.length - 1;
          return (
            <li key={label} className={cn('inline-flex items-center gap-2', current && 'text-foreground')}>
              {current
                ? <motion.span className="size-1.5 rounded-full bg-[var(--accent)]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }} />
                : <Check className="size-3.5 text-[var(--success)]" />}
              {label}{current ? '…' : ''}
            </li>
          );
        })}
      </ul>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="size-1.5 rounded-full bg-[var(--text-muted)]" animate={{ opacity: [0.25, 1, 0.25] }} transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.15 }} />
        ))}
      </span>
      {items.length ? tx('Working on it…', 'أعمل على ذلك…') : tx('Thinking…', 'أفكّر…')}
    </span>
  );
}

function TextPart({ text }: { text: string }) {
  // replies that cover several topics label each part with **Heading**; render those as bold
  const parts = text.split(/(\*\*[^*\n]{1,60}\*\*)/g);
  return (
    <p className="whitespace-pre-wrap text-base leading-relaxed">
      {parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>))}
    </p>
  );
}

function TraceTool({ args }: { args: unknown }) {
  const t = args as WorkTrace | null;
  return t && typeof t.goal === 'string' ? <Workings trace={t} /> : null;
}

const tools = { by_name: { render_chart: RenderChartTool, show_tasks: ShowTasksTool, show_opportunities: ShowOpportunitiesTool, show_plan: ShowPlanTool, show_cv: ShowCvTool, murshid_trace: TraceTool } };

function UserMessage() {
  return (
    <MessagePrimitive.Root className="flex justify-end">
      <motion.div {...messageIn} className="max-w-[80%] rounded-[22px] rounded-ee-[8px] bg-[var(--deep)] px-4 py-2.5 text-[0.9375rem] text-white">
        <MessagePrimitive.Parts components={{ Text: TextPart }} />
      </motion.div>
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  const { toast, tx } = useApp();
  return (
    <MessagePrimitive.Root className="group/msg flex gap-3">
      <MurshidMark className="mt-0.5 size-7 shrink-0" />
      <motion.div {...messageIn} className="flex min-w-0 flex-1 flex-col gap-3">
        <MessagePrimitive.Parts components={{ Text: TextPart, Empty: Thinking, tools }} unstable_showEmptyOnNonTextEnd={false} />
        <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="-ms-1.5 flex gap-0.5 opacity-100 transition-opacity data-[floating]:opacity-0 group-hover/msg:data-[floating]:opacity-100">
          <ActionBarPrimitive.Copy asChild>
            <button aria-label={tx('Copy', 'نسخ')} title={tx('Copy', 'نسخ')} className="group/copy inline-flex size-7 pointer-coarse:size-10 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground">
              <Copy className="size-3.5 group-data-[copied]/copy:hidden" /><Check className="hidden size-3.5 group-data-[copied]/copy:block" />
            </button>
          </ActionBarPrimitive.Copy>
          <ActionBarPrimitive.Reload asChild>
            <button aria-label={tx('Retry', 'إعادة')} title={tx('Retry', 'إعادة')} className="inline-flex size-7 pointer-coarse:size-10 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"><RotateCcw className="size-3.5" /></button>
          </ActionBarPrimitive.Reload>
          <button aria-label={tx('Helpful', 'مفيد')} title={tx('Helpful', 'مفيد')} onClick={() => toast({ title: tx('Thanks for the feedback', 'شكراً على ملاحظتك') })} className="inline-flex size-7 pointer-coarse:size-10 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"><ThumbsUp className="size-3.5" /></button>
          <button aria-label={tx('Not helpful', 'غير مفيد')} title={tx('Not helpful', 'غير مفيد')} onClick={() => toast({ title: tx("Thanks, we'll use that to improve", 'شكراً، سنستخدمها للتحسين'), tone: 'info' })} className="inline-flex size-7 pointer-coarse:size-10 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"><ThumbsDown className="size-3.5" /></button>
        </ActionBarPrimitive.Root>
      </motion.div>
    </MessagePrimitive.Root>
  );
}

/** Speech-to-text via the Web Speech API when the browser has it. */
function useDictation(onText: (t: string) => void) {
  const { toast, tx, locale } = useApp();
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const start = () => {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) { toast({ title: tx('Voice input isn’t available in this browser', 'الإدخال الصوتي غير متاح في هذا المتصفح'), description: tx('Try Safari on iPad or Chrome on desktop.', 'جرّب Safari على iPad أو Chrome على الكمبيوتر.'), tone: 'info' }); return; }
    const rec = new Ctor();
    rec.lang = locale === 'ar' ? 'ar-AE' : 'en-GB';
    rec.interimResults = true;
    rec.onresult = (e) => onText(Array.from(e.results).map((r) => r[0]!.transcript).join(''));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  };
  const stop = () => { recRef.current?.stop(); setListening(false); };
  return { listening, start, stop };
}
interface SpeechRec { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void }

function Composer({ runtime, docked }: { runtime: AssistantRuntime; docked: boolean }) {
  const { bt, t, band } = useApp();
  const text = useRuntimeValue(runtime, (r) => r.thread.composer.getState().text, 'composer');
  const running = useRuntimeValue(runtime, (r) => r.thread.getState().isRunning);
  const dict = useDictation((s) => runtime.thread.composer.setText(s));
  const empty = text.trim().length === 0;
  const ph = bt('chat.placeholder');
  const mode: 'stop' | 'send' | 'mic' = running ? 'stop' : !empty ? 'send' : 'mic';
  return (
    <motion.div layoutId="composer" transition={spring.layout} className={cn('w-full', docked ? '' : 'max-w-[680px]')}>
      <ComposerPrimitive.Root
        data-empty={empty} data-running={running}
        className={cn(
          'flex w-full items-end gap-2 rounded-[28px] bg-surface py-2 ps-5 pe-2 ring-1 ring-transparent transition-[box-shadow] focus-within:ring-[var(--brand-light)] focus-within:shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand-light)_18%,transparent)]',
          band === 'g5-6' ? 'min-h-[60px]' : 'min-h-[56px]',
        )}
      >
        <ComposerPrimitive.Input
          autoFocus
          rows={1}
          maxRows={8}
          placeholder={ph !== 'chat.placeholder' ? ph : t('dash.askPh')}
          className="min-h-10 flex-1 resize-none self-center bg-transparent py-2 text-[0.9375rem] outline-none placeholder:text-muted-foreground"
        />
        {dict.listening && <span className="mb-3.5 size-2 animate-pulse rounded-full bg-[var(--danger)]" aria-label="Listening" />}
        <div className="relative size-10 shrink-0">
          <AnimatePresence mode="popLayout" initial={false}>
            {mode === 'stop' ? (
              <motion.span key="stop" {...iconSwap} className="absolute inset-0">
                <ComposerPrimitive.Cancel asChild>
                  <button aria-label={t('chat.stop')} className="inline-flex size-10 items-center justify-center rounded-full bg-foreground text-background"><Square className="size-3.5 fill-current" /></button>
                </ComposerPrimitive.Cancel>
              </motion.span>
            ) : mode === 'send' ? (
              <motion.span key="send" {...iconSwap} className="absolute inset-0">
                <ComposerPrimitive.Send asChild>
                  <button aria-label={t('chat.send')} className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--deep)] text-white"><ArrowUp className="size-4" /></button>
                </ComposerPrimitive.Send>
              </motion.span>
            ) : (
              <motion.span key="mic" {...iconSwap} className="absolute inset-0">
                <button type="button" onClick={dict.listening ? dict.stop : dict.start} aria-label={t('chat.mic')} aria-pressed={dict.listening}
                  className={cn('inline-flex size-10 items-center justify-center rounded-full transition-colors', dict.listening ? 'bg-[var(--danger)] text-white' : 'bg-surface-2 text-muted-foreground hover:text-foreground')}>
                  <Mic className="size-4" />
                </button>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </ComposerPrimitive.Root>
    </motion.div>
  );
}

/** Tutor / Study buddy switch. The buddy is optional, clearly an AI, and a guardian or the school can switch it off. */
export function PersonaToggle({ onSwitch }: { onSwitch?: () => void }) {
  const { tx, prefs, setPrefs, client } = useApp();
  const [status, setStatus] = useState<BuddyStatus | null>(null);
  useEffect(() => { let on = true; client.getBuddy().then((r) => { if (on) setStatus(r.data); }); return () => { on = false; }; }, [client]);
  const persona = prefs.chatPersona === 'buddy' ? 'buddy' : 'tutor';
  const blocked = status ? !status.available : false;
  useEffect(() => { if (blocked && persona === 'buddy') setPrefs({ chatPersona: 'tutor' }); }, [blocked, persona, setPrefs]);
  const why = !status || status.available ? null
    : status.reason === 'school_off' ? tx('Switched off by your school', 'أوقفته مدرستك')
    : status.reason === 'guardian_off' ? tx('Switched off by your parent or guardian', 'أوقفه وليّ أمرك')
    : status.reason === 'needs_guardian' ? tx('A parent or guardian needs to switch this on for your grade (Settings)', 'يحتاج إلى تفعيل من وليّ الأمر لمرحلتك (الإعدادات)')
    : tx('Needs the Murshid server', 'يحتاج إلى خادم مرشد');
  const set = (p: 'tutor' | 'buddy') => { if (p === persona || (p === 'buddy' && blocked)) return; setPrefs({ chatPersona: p }); onSwitch?.(); };
  return (
    <div className="flex flex-col items-center gap-1">
      <div role="radiogroup" aria-label={tx('Who answers', 'من يجيب')} className="inline-flex rounded-full bg-surface p-1 text-[0.8125rem]">
        {(['tutor', 'buddy'] as const).map((p) => {
          const on = p === persona;
          const dis = p === 'buddy' && blocked;
          return (
            <button key={p} role="radio" aria-checked={on} aria-disabled={dis || undefined} title={dis ? why ?? undefined : undefined} onClick={() => set(p)}
              className={cn('h-8 rounded-full px-4 font-medium transition-colors pointer-coarse:h-10', on ? 'bg-[var(--deep)] text-white' : 'text-muted-foreground hover:text-foreground', dis && 'cursor-not-allowed opacity-50')}>
              {p === 'tutor' ? tx('Tutor', 'المعلّم') : tx('Study buddy', 'رفيق الدراسة')}
            </button>
          );
        })}
      </div>
      {persona === 'buddy' && <p className="text-2xs text-muted-foreground">{tx("AI study buddy: friendly, but not a person. Your school or parent can switch it off.", 'رفيق دراسة بالذكاء الاصطناعي: ودود لكنه ليس شخصاً. يمكن لمدرستك أو وليّ أمرك إيقافه.')}</p>}
      {blocked && why && <p className="text-2xs text-muted-foreground">{tx('Study buddy', 'رفيق الدراسة')}: {why}</p>}
    </div>
  );
}

const BUDDY_CHIPS = { en: ['Tell me a study joke', "I can't focus today", 'Hype me up for my next test', 'Are you a real person?'], ar: ['احكِ لي نكتة عن الدراسة', 'لا أستطيع التركيز اليوم', 'شجّعني لاختباري القادم', 'هل أنت شخص حقيقي؟'] };

function Chips({ runtime }: { runtime: AssistantRuntime }) {
  const { world, tx, prefs, locale } = useApp();
  const tutorChips = useMemo(() => suggestionChips(world, tx, prefs.persona), [world, tx, prefs.persona]);
  const chips = prefs.chatPersona === 'buddy' ? BUDDY_CHIPS[locale === 'ar' ? 'ar' : 'en'] : tutorChips;
  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className="flex flex-wrap justify-center gap-2">
      {chips.map((c) => (
        <motion.button key={c} variants={fadeUp} {...pressable} onClick={() => runtime.thread.append(c)}
          className="rounded-full bg-surface px-4 py-2 text-[0.8125rem] text-foreground transition-colors hover:bg-[var(--deep)] hover:text-white">
          {c}
        </motion.button>
      ))}
    </motion.div>
  );
}

function ChatInner({ runtime }: { runtime: AssistantRuntime }) {
  const { tx, t, world, locale, prefs } = useApp();
  const count = useRuntimeValue(runtime, (r) => r.thread.getState().messages.length);
  const router = useRouter();
  const params = useSearchParams();
  const sentQ = useRef(false);

  useEffect(() => {
    const q = params.get('q');
    if (!q || sentQ.current) return;
    // The runtime's main thread mounts a tick after the provider; retry briefly until it accepts the message.
    let tries = 0;
    const send = () => {
      if (sentQ.current) return;
      try {
        runtime.thread.append(q);
        sentQ.current = true;
        router.replace('/app/chat', { scroll: false });
      } catch {
        if (tries++ < 40) setTimeout(send, 50);
      }
    };
    const id = setTimeout(send, 0);
    return () => clearTimeout(id);
  }, [params, runtime, router]);

  const name = locale === 'ar' ? world.dashboard.student.nameAr.split(' ')[0] : world.dashboard.student.firstName;

  return (
    <div className="fill-view relative flex flex-col">
      {count > 0 && (
        <div className="flex h-14 shrink-0 items-center justify-between px-4 md:px-8">
          <span className="flex items-center gap-2 text-sm font-medium"><MurshidMark className="size-6" /><span className="hidden sm:inline">{t('chat.title')}</span></span>
          <div className="flex items-center gap-2"><PersonaToggle onSwitch={() => runtime.thread.reset()} /><span className="hidden md:block"><CompanionToggles /></span></div>
          <Button variant="ghost" size="sm" onClick={() => runtime.thread.reset()}><SquarePen /><span className="hidden sm:inline">{t('chat.new')}</span><span className="sr-only sm:hidden">{t('chat.new')}</span></Button>
        </div>
      )}
      {count > 0 && prefs.companion && (
        <div className="no-print shrink-0 border-b border-border px-4 py-4 md:px-8">
          <div className="mx-auto max-w-[760px]"><CompanionStage runtime={runtime} compact /></div>
        </div>
      )}
      {count === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-[12vh]">
          <motion.div initial="hidden" animate="show" variants={fadeUp} className="flex flex-col items-center gap-4 text-center">
            {prefs.companion ? <CompanionStage runtime={runtime} /> : <MurshidMark className="size-12" />}
            <h1 className={cn('display text-[2rem] sm:text-[2.5rem]', prefs.companion && 'sr-only')}>{tx(`What should we work on, ${name}?`, `على ماذا نعمل اليوم يا ${name}؟`)}</h1>
            {!prefs.companion && <p className="text-sm text-muted-foreground">{prefs.chatPersona === 'buddy' ? tx('Your AI study buddy: pep talks, study plans and bad puns.', 'رفيق دراستك بالذكاء الاصطناعي: تشجيع وخطط دراسة ونكات.') : t('chat.sub')}</p>}
          </motion.div>
          <div className="flex flex-wrap items-center justify-center gap-2"><PersonaToggle /><CompanionToggles /></div>
          <Composer runtime={runtime} docked={false} />
          <Chips runtime={runtime} />
        </div>
      ) : (
        <>
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 pt-6 md:px-6">
            <div className="mx-auto flex max-w-[760px] flex-col gap-6 pb-8">
              <ThreadPrimitive.Messages>
                {({ message }) => (message.role === 'user' ? <UserMessage /> : <AssistantMessage />)}
              </ThreadPrimitive.Messages>
            </div>
            <ThreadPrimitive.ScrollToBottom asChild>
              <button aria-label="Scroll to bottom" className="sticky bottom-3 mx-auto flex size-9 items-center justify-center rounded-full border border-border bg-surface shadow-lift disabled:invisible"><ArrowDown className="size-4" /></button>
            </ThreadPrimitive.ScrollToBottom>
          </ThreadPrimitive.Viewport>
          <div className="relative px-4 pb-4 md:px-6" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <div className="pointer-events-none absolute inset-x-0 -top-6 h-6 bg-gradient-to-t from-background to-transparent" />
            <div className="mx-auto max-w-[760px]">
              <Composer runtime={runtime} docked />
              <p className="mt-2 text-center text-2xs text-muted-foreground">{t('chat.disclaimer')}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ChatView() {
  const adapter = useMurshidAdapter();
  const runtime = useLocalRuntime(adapter);
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatInner runtime={runtime} />
    </AssistantRuntimeProvider>
  );
}
