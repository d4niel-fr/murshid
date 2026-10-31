'use client';

import { useApp } from '@/components/providers/app-provider';
import { DEFAULT_MASCOT } from '@/lib/prefs';
import { Mascot, type Mood } from './mascot';

/** The student's own mascot (character, colour, skin, hair, accessory and name from Settings). */
export function MyMascot(props: { size?: number; mood?: Mood; talk?: number; track?: boolean; className?: string }) {
  const { prefs } = useApp();
  const m = prefs.mascot ?? DEFAULT_MASCOT;
  return <Mascot {...props} kind={m.kind} color={m.color} accessory={m.accessory} skin={m.skin} hair={m.hair} label={`${m.name}, the Murshid mascot`} />;
}

export function useMascotName() {
  const { prefs } = useApp();
  return (prefs.mascot ?? DEFAULT_MASCOT).name;
}

/** Arabic grammar follows the character: the boy is masculine, the star (نجمة) feminine. */
export function useMascotIsMale() {
  const { prefs } = useApp();
  return (prefs.mascot ?? DEFAULT_MASCOT).kind === 'guide';
}
