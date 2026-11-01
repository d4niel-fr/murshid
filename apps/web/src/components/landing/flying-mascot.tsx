'use client';

import { useEffect, useRef } from 'react';
import { Mascot } from '@/components/mascot/mascot';
import { cn } from '@/lib/utils';

/**
 * A small Murshid bot keeping the star company in the hero: a slow, lazy loop with a slight tilt and a gentle hover.
 * Secondary on purpose (small, behind the title, no ground shadow); it pauses off screen and stays still when the
 * visitor prefers less motion. The eyes follow the pointer, so it glances at whatever you are about to click.
 */
export function FlyingMascot({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => { el.dataset.paused = e!.isIntersecting ? 'false' : 'true'; });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} aria-hidden className={cn('fly-path', className)}>
      <div className="fly-hover">
        <Mascot shape="orb" face="round" color="royal" glow="sky" accessory="antenna" grounded={false} className="h-auto w-full" label="" />
      </div>
    </div>
  );
}
