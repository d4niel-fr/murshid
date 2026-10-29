'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Fragment } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Tip } from '@/components/ui/tooltip';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/lib/use-media-query';
import { MurshidMark, NAV_ICONS } from './icons';
import { appNav, isActive, navSection, SECTION_LABEL, type AppNavItem, type NavSection } from './nav';

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

const ORDER: NavSection[] = ['main', 'learn', 'grow'];

/** Nav list shared by the desktop sidebar and the tablet drawer. `labels` = 'always' | 'responsive'. */
export function NavList({ labels, onNavigate, layoutId = 'nav-active', tooltips = false }: { labels: 'always' | 'responsive'; onNavigate?: () => void; layoutId?: string; tooltips?: boolean }) {
  const { band, locale } = useApp();
  const items = appNav(band, locale);
  const active = useActive();
  const settings = items.filter((i) => i.key === 'settings');
  const main = items.filter((i) => i.key !== 'settings');
  const groups = ORDER.map((sec) => ({ sec, items: main.filter((i) => navSection(i.key) === sec) })).filter((g) => g.items.length);
  const responsive = labels === 'responsive';

  const render = (item: AppNavItem) => {
    const Icon = NAV_ICONS[item.icon] ?? NAV_ICONS.House!;
    const on = active(item);
    const link = (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={on ? 'page' : undefined}
        className={cn(
          'group/nav relative flex h-10 items-center gap-3 rounded-full px-3.5 text-[14px] outline-none transition-colors',
          on ? 'font-medium text-[var(--deep)]' : 'text-white/70 hover:bg-white/[0.08] hover:text-white',
        )}
      >
        {on && <motion.span layoutId={layoutId} transition={spring.layout} className="absolute inset-0 rounded-full bg-white" />}
        <Icon className={cn('relative z-10 size-[18px] shrink-0 transition-colors', on ? 'text-[var(--deep)]' : 'text-white/60 group-hover/nav:text-white')} strokeWidth={1.7} />
        <span className={cn('relative z-10 truncate', responsive && 'nav-label')}>{item.label}</span>
      </Link>
    );
    return (
      <li key={item.key}>
        {tooltips ? <Tip label={item.label} side={locale === 'ar' ? 'left' : 'right'}><span className="block">{link}</span></Tip> : link}
      </li>
    );
  };

  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto no-scrollbar" aria-label="Main">
      {groups.map(({ sec, items: list }, gi) => {
        const label = SECTION_LABEL[sec];
        return (
          <Fragment key={sec}>
            {gi > 0 && (
              <>
                {label && <p className={cn('px-3.5 pb-2 pt-6 text-[10.5px] font-medium uppercase tracking-[0.2em] text-white/60 rtl:tracking-normal', responsive && 'nav-section')}>{label[locale]}</p>}
                {responsive && <div className="nav-divider mx-3 my-3 h-px bg-white/15" aria-hidden />}
              </>
            )}
            <ul className="flex flex-col gap-1">{list.map(render)}</ul>
          </Fragment>
        );
      })}
      <ul className="mt-auto flex flex-col gap-1 pt-4">{settings.map(render)}</ul>
    </nav>
  );
}

/**
 * Desktop/iPad-landscape sidebar: a navy card inset from the page edge. Pure CSS breakpoints decide the default (no hydration flash):
 *  ≥1280 expanded (256) unless collapsed by the user · 1024–1279 icon rail (80) that can expand as an overlay · <1024 hidden (drawer).
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
    <aside className="sidebar on-deep fixed inset-y-0 start-0 z-40 hidden flex-col px-3 pb-3 pt-5 transition-[width,box-shadow] duration-200 ease-[cubic-bezier(.22,1,.36,1)] lg:flex">
      <div className="mb-6 flex h-10 items-center gap-2.5 px-2.5">
        <MurshidMark tone="light" className="size-8 shrink-0" />
        <span className="nav-label text-[15px] font-medium uppercase tracking-[0.2em]">{t('app.name')}</span>
      </div>
      <NavList labels="responsive" tooltips={rail} onNavigate={() => setOverlayOpen(false)} />
      <div className="mt-3 flex items-center gap-2.5 border-t border-white/15 px-1 pt-3">
        <span className="nav-avatar size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-light)] text-[12px] font-medium text-white">{s.firstName[0]}{s.lastName[0]}</span>
        <div className="nav-label min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-medium">{locale === 'ar' ? s.nameAr : `${s.firstName} ${s.lastName}`}</p>
          <p className="truncate text-xs text-white/60">{s.classLabel}</p>
        </div>
        <button onClick={toggle} aria-label={collapsedLabel} className="nav-toggle mx-auto inline-flex size-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/[0.1] hover:text-white">
          <PanelLeftClose className="nav-label-icon size-4 rtl:-scale-x-100" />
          <PanelLeftOpen className="nav-rail-icon size-4 rtl:-scale-x-100" />
        </button>
      </div>
    </aside>
  );
}
