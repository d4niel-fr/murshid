'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STEPS = [
  { en: 'Breathe in', ar: 'شهيق', scale: 1 },
  { en: 'Hold', ar: 'احبس', scale: 1 },
  { en: 'Breathe out', ar: 'زفير', scale: 0.55 },
  { en: 'Hold', ar: 'احبس', scale: 0.55 },
];

/** Box breathing: four counts in, hold, out, hold. A minute of it calms most people down. */
export function Breathing() {
  const { tx, locale } = useApp();
  const [on, setOn] = useState(false);
  const [step, setStep] = useState(0);
  const [count, setCount] = useState(4);
  const [rounds, setRounds] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => {
      setCount((c) => {
        if (c > 1) return c - 1;
        setStep((s) => { const n = (s + 1) % 4; if (n === 0) setRounds((r) => r + 1); return n; });
        return 4;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [on]);
  useEffect(() => { if (rounds >= 4) setOn(false); }, [rounds]);
  const s = STEPS[step]!;
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="relative grid size-40 place-items-center">
        <span aria-hidden className={cn('absolute inset-0 rounded-full bg-[color-mix(in_oklab,var(--brand)_16%,transparent)] transition-transform ease-in-out motion-reduce:transition-none', on ? 'duration-[4000ms]' : 'duration-500')} style={{ transform: `scale(${on ? s.scale : 0.7})` }} />
        <span className="relative text-center" aria-live="polite">
          <span className="block text-sm font-medium">{on ? (locale === 'ar' ? s.ar : s.en) : rounds >= 4 ? tx('Well done', 'أحسنت') : tx('Ready?', 'مستعد؟')}</span>
          {on && <span className="block text-3xl font-semibold tabular-nums">{count}</span>}
        </span>
      </div>
      <Button variant={on ? 'secondary' : 'primary'} size="sm" onClick={() => { if (!on) { setStep(0); setCount(4); setRounds(0); } setOn(!on); }}>
        {on ? tx('Stop', 'إيقاف') : rounds >= 4 ? tx('Again', 'مرة أخرى') : tx('Start 1-minute breathing', 'ابدأ تنفّس دقيقة')}
      </Button>
    </div>
  );
}
