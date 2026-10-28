'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { Tip } from '@/components/ui/tooltip';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/lib/use-media-query';
import { MurshidMark, NAV_ICONS } from './icons';
import { appNav, isActive, type AppNavItem } from './nav';

function useActive() {
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = params.get('tab');
  return (item: AppNavItem) => {
    const [path, query] = item.href.split('?');
    if (!isActive(pathname, path!)) return false;
    const want = query ? new URLSearchParams(query).get('tab') : null;
    return want ? tab === want : tab !== 'applications' || path !== '/opportunities';
  };
}

/** Nav list shared by the desktop sidebar and the tablet drawer. `labels` = 'always' | 'responsive'. */
export function NavList({ labels, onNavigate, layoutId = 'nav-active', tooltips = false }: { labels: 'always' | 'responsive'; onNavigate?: () => void; layoutId?: string; tooltips?: boolean }) {
  const { band, locale } = useApp();
  const items = appNav(band, locale);
  const active = useActive();
  const settings = items.filter((i) => i.key === 'settings');
  const main = items.filter((i) => i.key !== 'settings');
  const render = (item: AppNavItem) => {
    const Icon = NAV_ICONS[item.icon] ?? NAV_ICONS.House!;
    const on = active(item);
    const link = (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={on ? 'page' : undefined}
        className={cn(
          'group/nav relative flex h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-medium outline-none transition-colors',
          on ? 'text-foreground' : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground',
        )}
      >
        {on && <motion.span layoutId={layoutId} transition={spring.layout} className="absolute inset-0 rounded-[10px] border border-border bg-surface shadow-soft" />}
        <Icon className={cn('relative z-10 size-[18px] shrink-0', on && 'text-primary')} strokeWidth={1.9} />
        <span className={cn('relative z-10 truncate', labels === 'responsive' && 'nav-label')}>{item.label}</span>
      </Link>
    );
    return (
      <li key={item.key}>
        {tooltips ? <Tip label={item.label} side={locale === 'ar' ? 'left' : 'right'}><span className="block">{link}</span></Tip> : link}
      </li>
    );
  };
  return (
    <nav className="flex min-h-0 flex-1 flex-col" aria-label="Main">
      <ul className="flex flex-col gap-1">{main.map(render)}</ul>
      <ul className="mt-auto flex flex-col gap-1 pt-4">{settings.map(render)}</ul>
    </nav>
  );
}

/**
 * Desktop/iPad-landscape sidebar. Pure CSS breakpoints decide the default (no hydration flash):
 *  ≥1280 expanded (248) unless collapsed by the user · 1024–1279 icon rail (64) that can expand as an overlay · <1024 hidden (drawer).
 */
export function Sidebar({ overlayOpen, setOverlayOpen }: { overlayOpen: boolean; setOverlayOpen: (v: boolean) => void }) {
  const { prefs, setPrefs, t, world, locale } = useApp();
  const s = world.dashboard.student;
  const toggle = () => {
    if (window.matchMedia('(min-width: 1280px)').matches) setPrefs({ sidebar: prefs.sidebar === 'collapsed' ? 'expanded' : 'collapsed' });
    else setOverlayOpen(!overlayOpen);
  };
  const wide = useMediaQuery('(min-width: 1280px)');
  const rail = !overlayOpen && !(wide && prefs.sidebar !== 'collapsed');
  const collapsedLabel = rail ? t('nav.expand') : t('nav.collapse');
  return (
    <aside
      className={cn(
        'sidebar fixed inset-y-0 start-0 z-40 hidden flex-col border-e border-border bg-background px-3 pb-4 pt-4 lg:flex',
        'transition-[width,box-shadow] duration-200 ease-[cubic-bezier(.22,1,.36,1)]',
      )}
    >
      <div className="mb-6 flex h-10 items-center gap-2.5 px-1.5">
        <MurshidMark className="size-8 shrink-0" />
        <span className="nav-label text-[17px] font-semibold tracking-tight">{t('app.name')}</span>
      </div>
      <NavList labels="responsive" tooltips={rail} onNavigate={() => setOverlayOpen(false)} />
      <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
        <span className="nav-avatar size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-primary">{s.firstName[0]}{s.lastName[0]}</span>
        <div className="nav-label min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium">{locale === 'ar' ? s.nameAr : `${s.firstName} ${s.lastName}`}</p>
          <p className="truncate text-xs text-muted-foreground">{s.classLabel}</p>
        </div>
        <button onClick={toggle} aria-label={collapsedLabel} className="nav-toggle inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground">
          <PanelLeftClose className="nav-label-icon size-[18px] rtl:-scale-x-100" />
          <PanelLeftOpen className="nav-rail-icon size-[18px] rtl:-scale-x-100" />
        </button>
      </div>
    </aside>
  );
}
