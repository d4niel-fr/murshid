'use client';

import { Suspense, useCallback, useState, type ReactNode } from 'react';
import { Dialog as D } from 'radix-ui';
import { BackToTop } from '@/components/shared/page-aids';
import { useApp } from '@/components/providers/app-provider';
import { DialogContent } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MurshidMark } from './icons';
import { ShortcutsDialog, useShortcuts } from './shortcuts';
import { NavList, Sidebar } from './sidebar';
import { SmartSearch } from './smart-search';
import { TabBar } from './tab-bar';
import { TopBar } from './topbar';

export function AppShell({ children }: { children: ReactNode }) {
  const { prefs, setPrefs, t } = useApp();
  const [overlay, setOverlay] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  const [help, setHelp] = useState(false);
  const toggleSidebar = useCallback(() => {
    if (window.matchMedia('(min-width: 1280px)').matches) setPrefs({ sidebar: prefs.sidebar === 'collapsed' ? 'expanded' : 'collapsed' });
    else setOverlay((v) => !v);
  }, [prefs.sidebar, setPrefs]);
  useShortcuts({ onSearch: useCallback(() => setPalette((v) => !v), []), onHelp: useCallback(() => setHelp(true), []), onSidebar: toggleSidebar });

  return (
    <TooltipProvider>
      <div data-collapsed={prefs.sidebar === 'collapsed' ? 'true' : 'false'} data-overlay={overlay ? 'true' : 'false'} className="min-h-dvh bg-background">
        <Suspense fallback={null}>
          <Sidebar overlayOpen={overlay} setOverlayOpen={setOverlay} />
        </Suspense>
        {overlay && <button aria-label="Close menu" onClick={() => setOverlay(false)} className="fixed inset-0 z-30 hidden bg-[rgb(15_47_99/0.25)] backdrop-blur-[2px] lg:block xl:hidden" />}
        <div className="shell-main flex min-h-dvh flex-col">
          <TopBar onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} onShortcuts={() => setHelp(true)} />
          <main id="main" tabIndex={-1} className="flex-1 pb-[var(--tabbar-h)] outline-none">{children}</main>
        </div>
      </div>
      <D.Root open={drawer} onOpenChange={setDrawer}>
        <DialogContent side="start" title={<span className="flex items-center gap-2.5 text-[0.9375rem] font-medium uppercase tracking-[0.2em]"><MurshidMark tone="light" className="size-8" />{t('app.name')}</span>} className="on-deep flex flex-col">
          <Suspense fallback={null}>
            <NavList labels="always" layoutId="drawer-active" onNavigate={() => setDrawer(false)} />
          </Suspense>
        </DialogContent>
      </D.Root>
      <SmartSearch open={palette} onOpenChange={setPalette} />
      <ShortcutsDialog open={help} onOpenChange={setHelp} />
      <TabBar onMore={() => setDrawer(true)} />
      <BackToTop />
    </TooltipProvider>
  );
}
