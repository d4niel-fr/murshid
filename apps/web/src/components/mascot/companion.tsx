'use client';

import type { AssistantRuntime } from '@assistant-ui/react';
import { AnimatePresence, motion } from 'motion/react';
import { Smile, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { cn } from '@/lib/utils';
import type { Mood } from './mascot';
import { friendlyDates } from '@/lib/friendly-dates';
import { MyMascot, useMascotName } from './my-mascot';

/** Companion mode: the mascot answers beside the chat, like a character you talk to (and can read replies aloud). */
function useThread(runtime: AssistantRuntime) {
  return useSyncExternalStore((cb) => runtime.thread.subscribe(cb), () => runtime.thread.getState(), () => runtime.thread.getState());
}
function useComposerText(runtime: AssistantRuntime) {
  return useSyncExternalStore((cb) => runtime.thread.composer.subscribe(cb), () => runtime.thread.composer.getState().text, () => '');
}

const plain = (s: string) => s.replace(/[*_`#>|]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();

function pickVoice(lang: string) {
  const voices = typeof window !== 'undefined' && window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
  const same = voices.filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  return same.find((v) => /natural|neural|google|samantha|daniel|serena|libby/i.test(v.name)) ?? same[0];
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const stop = () => { if (supported) window.speechSynthesis.cancel(); setSpeaking(false); };
  const speak = (text: string, locale: 'en' | 'ar') => {
    if (!supported || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plain(text).slice(0, 1400));
    u.lang = locale === 'ar' ? 'ar-SA' : 'en-GB';
    const v = pickVoice(u.lang); if (v) u.voice = v;
    u.rate = 1.02; u.pitch = 1.05;
    u.onstart = () => setSpeaking(true);
    u.onend = u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
  };
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  return { speak, stop, speaking, supported };
}

/** Companion on/off and read-aloud. `compact` (the chat header on phones) shows the icon only. */
export function CompanionToggles({ compact }: { compact?: boolean }) {
  const { prefs, setPrefs, tx } = useApp();
  const on = Boolean(prefs.companion);
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button type="button" onClick={() => setPrefs({ companion: !on })} aria-pressed={on} aria-label={compact ? tx('Companion', 'الرفيق') : undefined} title={compact ? tx('Companion', 'الرفيق') : undefined}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-full text-[0.8125rem] transition-colors', compact ? 'w-9 justify-center md:w-auto md:px-3' : 'px-3', on ? 'bg-[var(--deep)] text-white' : 'bg-surface text-muted-foreground hover:text-foreground')}>
        <Smile className="size-4 shrink-0" /><span className={cn(compact && 'hidden md:inline')}>{tx('Companion', 'الرفيق')}</span>
      </button>
      {on && (
        <button type="button" onClick={() => setPrefs({ voice: !prefs.voice })} aria-pressed={Boolean(prefs.voice)} aria-label={prefs.voice ? tx('Stop reading replies aloud', 'إيقاف قراءة الردود') : tx('Read replies aloud', 'قراءة الردود بصوت عالٍ')}
          className={cn('inline-flex size-9 items-center justify-center rounded-full transition-colors', prefs.voice ? 'bg-[var(--deep)] text-white' : 'bg-surface text-muted-foreground hover:text-foreground')}>
          {prefs.voice ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      )}
    </div>
  );
}

/** The stage: the mascot and its latest line, with the mood following the conversation. */
/** Short screens (a phone on its side): the companion shrinks to a strip so the conversation keeps the room. */
function useShortScreen() {
  const [short, setShort] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(max-height: 560px)');
    const sync = () => setShort(m.matches);
    sync(); m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  }, []);
  return short;
}

export function CompanionStage({ runtime, compact }: { runtime: AssistantRuntime; compact?: boolean }) {
  const { prefs, locale, tx } = useApp();
  const shortScreen = useShortScreen();
  const strip = Boolean(compact && shortScreen);
  const thread = useThread(runtime);
  const typing = useComposerText(runtime).trim().length > 0;
  const { speak, stop, speaking } = useSpeech();
  const name = useMascotName();

  const last = thread.messages[thread.messages.length - 1];
  const reply = last?.role === 'assistant' ? last.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ').trim() : '';
  const running = thread.isRunning;
  const [cheer, setCheer] = useState(false);
  const spoken = useRef<string | null>(null);
  const wasRunning = useRef(false);

  useEffect(() => {
    if (wasRunning.current && !running && last?.role === 'assistant') {
      setCheer(true); const t = setTimeout(() => setCheer(false), 1800);
      if (prefs.voice && spoken.current !== last.id) { spoken.current = last.id; speak(reply, locale); }
      wasRunning.current = running;
      return () => clearTimeout(t);
    }
    wasRunning.current = running;
  }, [running, last, prefs.voice, reply, locale, speak]);
  useEffect(() => { if (!prefs.voice) stop(); }, [prefs.voice]); // eslint-disable-line react-hooks/exhaustive-deps

  const mood: Mood = speaking ? 'talking' : running ? (reply ? 'talking' : 'thinking') : typing ? 'listening' : cheer ? 'happy' : 'idle';
  const line = running && !reply ? tx('Let me check your week…', 'دعني أراجع أسبوعك…') : reply ? friendlyDates(plain(reply), locale) : tx('Hi, I’m Murshid. Ask me anything about your week.', 'مرحباً، أنا مرشد. اسألني أي شيء عن أسبوعك.');
  const short = line.length > 240 ? `${line.slice(0, 237).trimEnd()}…` : line;

  return (
    <div className={cn('flex items-start', strip ? 'items-center gap-3' : 'gap-4', compact ? 'flex-row' : 'flex-col items-center text-center md:flex-row md:items-start md:text-start')}>
      <div className="shrink-0 text-[var(--deep)]">
        <MyMascot size={strip ? 40 : compact ? 84 : shortScreen ? 112 : 168} mood={mood} grounded={!strip} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={running && !reply ? 'wait' : last?.id ?? 'hello'} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
          className={cn('bubble min-w-0 max-w-[32rem] text-start leading-relaxed', strip ? 'px-3.5 py-2 text-sm' : 'px-5 py-4 text-[0.9375rem]', compact && !strip && 'mt-2')} aria-live="polite">
          {!strip && <p className="eyebrow mb-1.5">{name}</p>}
          <p dir="auto" className={cn(strip ? 'line-clamp-1' : compact && 'line-clamp-4')}>{short}</p>
          {speaking && <button type="button" onClick={stop} className="mt-2 text-xs text-muted-foreground underline underline-offset-2">{tx('Stop reading', 'إيقاف القراءة')}</button>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
