'use client';

import { useApp } from '@/components/providers/app-provider';
import { DEFAULT_MASCOT, MASCOT_NAME } from '@/lib/prefs';
import { Mascot, type Mood } from './mascot';

/** The student's own Murshid bot (shape, eyes and colours from Settings). */
export function MyMascot(props: { size?: number; mood?: Mood; track?: boolean; grounded?: boolean; className?: string }) {
  const { prefs, locale } = useApp();
  const m = prefs.mascot ?? DEFAULT_MASCOT;
  return <Mascot {...props} shape={m.shape} face={m.face} color={m.color} glow={m.glow} label={MASCOT_NAME[locale]} />;
}

/** The mascot is always called Murshid. */
export function useMascotName() {
  const { locale } = useApp();
  return MASCOT_NAME[locale];
}
