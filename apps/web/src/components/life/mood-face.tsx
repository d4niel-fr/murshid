import type { Mood } from '@/lib/life-api';
import { cn } from '@/lib/utils';

/** A drawn face for each of the five check-in moods (the same on every device, unlike emoji). */
export function MoodFace({ mood, className, filled }: { mood: Mood; className?: string; filled?: boolean }) {
  const curve = (mood - 3) * 4.2;
  const mouthY = 26.5 - curve * 0.35;
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={cn('size-10', className)}>
      <circle cx="20" cy="20" r="18.5" fill="currentColor" opacity={filled ? 0.22 : 0.1} />
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1.5" opacity={filled ? 0.9 : 0.35} />
      {mood === 5
        ? <><path d="M11.5 16.5q2.5-3 5 0" /><path d="M23.5 16.5q2.5-3 5 0" /></>
        : <><circle cx="14.2" cy="16" r="1.9" fill="currentColor" stroke="none" /><circle cx="25.8" cy="16" r="1.9" fill="currentColor" stroke="none" /></>}
      {mood === 1 && <><path d="M10.5 11.5l5 2" /><path d="M29.5 11.5l-5 2" /></>}
      <path d={mood === 3 ? 'M13.5 26h13' : `M12.5 ${mouthY} Q20 ${mouthY + curve} 27.5 ${mouthY}`} />
      <style>{'path{fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}'}</style>
    </svg>
  );
}
