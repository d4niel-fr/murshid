'use client';

import { ArrowUp, Clock } from 'lucide-react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { cn } from '@/lib/utils';

/** Back to top: appears once the page has scrolled a screen or so. */
export function BackToTop({ className }: { className?: string }) {
  const { tx } = useApp();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > Math.max(600, window.innerHeight * 0.9));
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.button type="button" initial={{ opacity: 0, y: 12, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.9 }}
          onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
          aria-label={tx('Back to top', 'العودة إلى الأعلى')}
          className={cn('no-print fixed bottom-[calc(1.25rem+var(--tabbar-h))] end-4 sm:end-5 z-50 grid size-11 place-items-center rounded-full bg-[var(--deep)] text-white shadow-lift transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97]', className)}>
          <ArrowUp className="size-4" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

/** A thin bar along the top that fills as you read. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 32, mass: 0.3 });
  return <motion.div aria-hidden className="scroll-progress" style={{ scaleX }} />;
}

export function ReadingTime({ minutes, className }: { minutes: number; className?: string }) {
  const { tx } = useApp();
  return <span className={cn('inline-flex items-center gap-1.5 text-[0.8125rem] text-muted-foreground', className)}><Clock className="size-3.5" />{tx(`${minutes} min read`, `${minutes} دقائق قراءة`)}</span>;
}

/** Estimated reading time of the text inside `selector` (200 words a minute), measured after render. */
export function useReadingTime(selector: string) {
  const [m, setM] = useState<number | null>(null);
  useEffect(() => {
    const el = document.querySelector(selector);
    if (!el) return;
    const words = (el.textContent ?? '').trim().split(/\s+/).filter(Boolean).length;
    setM(Math.max(1, Math.round(words / 200)));
  }, [selector]);
  return m;
}

/** Table of contents with scroll-spy: the section in view is highlighted. */
export function Toc({ items, className, title }: { items: { id: string; text: string; level?: 2 | 3 }[]; className?: string; title?: string }) {
  const { tx } = useApp();
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);
  useEffect(() => {
    if (!items.length) return;
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: '-15% 0px -70% 0px' });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);
  if (!items.length) return null;
  return (
    <nav aria-label={title ?? tx('On this page', 'في هذه الصفحة')} className={cn('no-print', className)}>
      <p className="eyebrow mb-3">{title ?? tx('On this page', 'في هذه الصفحة')}</p>
      <ol className="flex flex-col gap-1 border-s border-border">
        {items.map((i) => (
          <li key={i.id}>
            <a href={`#${i.id}`} aria-current={active === i.id ? 'location' : undefined}
              className={cn('-ms-px block border-s-2 py-1 text-[0.8125rem] transition-colors', i.level === 3 ? 'ps-6' : 'ps-3', active === i.id ? 'border-[var(--brand)] font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {i.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
