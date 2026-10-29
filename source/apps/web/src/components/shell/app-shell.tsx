'use client';

import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CornerDownLeft, MessageCircle, Search } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import { useApp } from '@/components/providers/app-provider';
import { DialogContent } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { MurshidMark, NAV_ICONS } from './icons';
import { appNav } from './nav';
import { NavList, Sidebar } from './sidebar';
import { TopBar } from './topbar';

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { band, locale, tx } = useApp();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useMemo(() => {
    const pages = appNav(band, locale).map((n) => ({ key: n.key, label: n.label, icon: n.icon, run: () => router.push(n.href) }));
    pages.push({ key: 'profile', label: tx('Profile & links', 'الملف والروابط'), icon: 'Link', run: () => router.push('/profile') });
    const filtered = q ? pages.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())) : pages;
    const ask = q.trim() ? [{ key: 'ask', label: `${tx('Ask Murshid', 'اسأل مرشد')}: “${q.trim()}”`, icon: 'MessageCircle', run: () => router.push(`/chat?q=${encodeURIComponent(q.trim())}`) }] : [];
    return [...ask, ...filtered];
  }, [band, locale, q, router, tx]);

  useEffect(() => { if (open) { setQ(''); setIdx(0); } }, [open]);
  useEffect(() => setIdx(0), [q]);

  const run = (i: number) => { items[i]?.run(); onOpenChange(false); };
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent title={tx('Go to…', 'انتقل إلى…')} className="top-[18%] translate-y-0 p-3 sm:w-[560px]">
        <div className="flex items-center gap-2.5 rounded-full bg-surface px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef} autoFocus value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter') { e.preventDefault(); run(idx); }
            }}
            placeholder={tx('Search pages or ask Murshid…', 'ابحث في الصفحات أو اسأل مرشد…')}
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <ul className="mt-2 max-h-[50vh] overflow-y-auto">
          {items.map((it, i) => {
            const Icon = it.key === 'ask' ? MessageCircle : (NAV_ICONS[it.icon] ?? NAV_ICONS.House!);
            return (
              <li key={it.key}>
                <button onMouseEnter={() => setIdx(i)} onClick={() => run(i)} className={cn('flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-start text-sm transition-colors', i === idx ? 'bg-[var(--deep)] text-white' : 'text-muted-foreground')}>
                  <Icon className={cn('size-4', i === idx ? 'text-white' : it.key === 'ask' ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="flex-1 truncate">{it.label}</span>
                  {i === idx && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
                </button>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </D.Root>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { prefs, setPrefs, t } = useApp();
  const [overlay, setOverlay] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((v) => !v); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        if (window.matchMedia('(min-width: 1280px)').matches) setPrefs({ sidebar: prefs.sidebar === 'collapsed' ? 'expanded' : 'collapsed' });
        else setOverlay((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prefs.sidebar, setPrefs]);

  return (
    <TooltipProvider>
      <div data-collapsed={prefs.sidebar === 'collapsed' ? 'true' : 'false'} data-overlay={overlay ? 'true' : 'false'} className="min-h-dvh bg-background">
        <Suspense fallback={null}>
          <Sidebar overlayOpen={overlay} setOverlayOpen={setOverlay} />
        </Suspense>
        {overlay && <button aria-label="Close menu" onClick={() => setOverlay(false)} className="fixed inset-0 z-30 hidden bg-[rgb(15_47_99/0.25)] backdrop-blur-[2px] lg:block xl:hidden" />}
        <div className="shell-main flex min-h-dvh flex-col">
          <TopBar onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
          <main id="main" className="flex-1">{children}</main>
        </div>
      </div>
      <D.Root open={drawer} onOpenChange={setDrawer}>
        <DialogContent side="start" title={<span className="flex items-center gap-2.5 text-[15px] font-medium uppercase tracking-[0.2em]"><MurshidMark tone="light" className="size-8" />{t('app.name')}</span>} className="on-deep flex flex-col">
          <Suspense fallback={null}>
            <NavList labels="always" layoutId="drawer-active" onNavigate={() => setDrawer(false)} />
          </Suspense>
        </DialogContent>
      </D.Root>
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </TooltipProvider>
  );
}
