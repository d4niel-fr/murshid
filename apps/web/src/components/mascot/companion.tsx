'use client';

import type { AssistantRuntime } from '@assistant-ui/react';
import { AnimatePresence, motion } from 'motion/react';
import { Smile, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { DEFAULT_MASCOT } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import type { Mood } from './mascot';
import { MyMascot } from './my-mascot';

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
  const [talk, setTalk] = useState(0);
  const pulse = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const stop = () => { if (supported) window.speechSynthesis.cancel(); setSpeaking(false); setTalk(0); };
  const speak = (text: string, locale: 'en' | 'ar') => {
    if (!supported || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(plain(text).slice(0, 1400));
    u.lang = locale === 'ar' ? 'ar-SA' : 'en-GB';
    const v = pickVoice(u.lang); if (v) u.voice = v;
    u.rate = 1.02; u.pitch = 1.05;
    // the mouth opens on every word boundary and closes between words
    u.onboundary = () => { setTalk(0.55 + Math.random() * 0.45); if (pulse.current) clearTimeout(pulse.current); pulse.current = setTimeout(() => setTalk(0.15), 140); };
    u.onstart = () => setSpeaking(true);
    u.onend = u.onerror = () => { setSpeaking(false); setTalk(0); };
    window.speechSynthesis.speak(u);
  };
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  return { speak, stop, speaking, talk, supported };
}

export function CompanionToggles() {
  const { prefs, setPrefs, tx } = useApp();
  const on = Boolean(prefs.companion);
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setPrefs({ companion: !on })} aria-pressed={on}
        className={cn('inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] transition-colors', on ? 'bg-[var(--deep)] text-white' : 'bg-surface text-muted-foreground hover:text-foreground')}>
        <Smile className="size-4" />{tx('Companion', 'الرفيق')}
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
export function CompanionStage({ runtime, compact }: { runtime: AssistantRuntime; compact?: boolean }) {
  const { prefs, locale, tx } = useApp();
  const thread = useThread(runtime);
  const typing = useComposerText(runtime).trim().length > 0;
  const { speak, stop, speaking, talk } = useSpeech();
  const name = (prefs.mascot ?? DEFAULT_MASCOT).name;

  const last = thread.messages[thread.messages.length - 1];
  const reply = last?.role === 'assistant' ? last.content.map((p) => (p.type === 'text' ? p.text : '')).join(' ').trim() : '';
  const running = thread.isRunning;
  const [cheer, setCheer] = useState(false);
  const spoken = useRef<string | null>(null);
  const wasRunning = useRef(false);
  // streaming text: the mouth moves with it
  const [flap, setFlap] = useState(0);
  useEffect(() => {
    if (!running || !reply) return;
    const id = setInterval(() => setFlap((f) => (f > 0.3 ? 0.1 : 0.5 + Math.random() * 0.5)), 120);
    return () => clearInterval(id);
  }, [running, reply]);

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
  const line = running && !reply ? tx('Let me check your week…', 'دعني أراجع أسبوعك…') : reply ? plain(reply) : tx(`Hi, I'm ${name}. Ask me anything about your week.`, `مرحباً، أنا ${name}. اسألني أي شيء عن أسبوعك.`);
  const short = line.length > 240 ? `${line.slice(0, 237).trimEnd()}…` : line;

  return (
    <div className={cn('flex items-start gap-4', compact ? 'flex-row' : 'flex-col items-center text-center md:flex-row md:items-start md:text-start')}>
      <div className="shrink-0 text-[var(--deep)]">
        <MyMascot size={compact ? 84 : 168} mood={mood} talk={speaking ? talk : flap} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={running && !reply ? 'wait' : last?.id ?? 'hello'} initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }}
          className={cn('bubble max-w-[32rem] px-5 py-4 text-start text-[0.9375rem] leading-relaxed', compact && 'mt-2')} aria-live="polite">
          <p className="eyebrow mb-1.5">{name}</p>
          <p>{short}</p>
          {speaking && <button type="button" onClick={stop} className="mt-2 text-xs text-muted-foreground underline underline-offset-2">{tx('Stop reading', 'إيقاف القراءة')}</button>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
