'use client';

import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { DropdownMenu } from 'radix-ui';
import { Check, ChevronDown, Database, Languages, Menu, Moon, Search, Sun, Wifi } from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { Tip } from '@/components/ui/tooltip';
import { BANDS, BAND_IDS, demoStudents, type BandId } from '@/lib/bands';
import { iconSwap } from '@/lib/motion';
import { cn } from '@/lib/utils';

export function BandSwitcher() {
  const { band, setPrefs, locale, tx, toast, prefs, world } = useApp();
  const router = useRouter();
  // an active persona (e.g. the flagship student) shows its own identity, not the band's demo student
  const s = prefs.persona ? world.dashboard.student : demoStudents[band];
  const choose = (b: BandId) => {
    if (b === band) return;
    setPrefs({ band: b });
    const ns = demoStudents[b];
    toast({ title: tx(`Switched to ${ns.firstName} (${BANDS[b].label.en})`, `تم التبديل إلى ${ns.nameAr} (${BANDS[b].label.ar})`), tone: 'info' });
    router.refresh();
  };
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface ps-1.5 pe-3 text-sm shadow-soft transition-colors hover:bg-surface-2" aria-label={tx('Switch demo student', 'تبديل الطالب التجريبي')}>
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{s.firstName[0]}</span>
          <span className="hidden text-start leading-tight md:block">
            <span className="block text-[13px] font-medium">{locale === 'ar' ? s.nameAr : s.firstName}</span>
            <span className="block text-[11px] text-muted-foreground">{BANDS[band].label[locale]}</span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-72 rounded-xl border border-border bg-surface p-1.5 shadow-lift data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
          <DropdownMenu.Label className="px-2.5 pb-1.5 pt-1 eyebrow">{tx('Demo students (synthetic)', 'طلاب تجريبيون (بيانات وهمية)')}</DropdownMenu.Label>
          {BAND_IDS.map((b) => {
            const st = demoStudents[b];
            return (
              <DropdownMenu.Item key={b} onSelect={() => choose(b)} data-band={b} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 outline-none data-[highlighted]:bg-surface-2">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{st.firstName[0]}</span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-sm font-medium">{locale === 'ar' ? st.nameAr : `${st.firstName} ${st.lastName}`}</span>
                  <span className="block truncate text-xs text-muted-foreground">{BANDS[b].label[locale]} · {st.classLabel}</span>
                </span>
                {b === band && <Check className="size-4 text-primary" />}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tip label={label} side="bottom">
      <button onClick={onClick} aria-label={label} className="relative inline-flex size-10 items-center justify-center overflow-hidden rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground">
        {children}
      </button>
    </Tip>
  );
}

export function TopBar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { prefs, setPrefs, t, tx, apiStatus } = useApp();
  const router = useRouter();
  const dark = prefs.theme === 'dark';
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background px-4 md:px-6 xl:px-8">
      <button onClick={onMenu} aria-label="Menu" className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-2 lg:hidden">
        <Menu className="size-5" />
      </button>
      <button onClick={onSearch} className="group flex h-10 min-w-0 max-w-[420px] flex-1 items-center gap-2.5 rounded-full bg-surface-2 px-4 text-sm text-muted-foreground ring-1 ring-inset ring-border transition-shadow hover:shadow-soft">
        <Search className="size-4 shrink-0" />
        <span className="truncate">{t('top.search')}</span>
        <kbd className="ms-auto hidden rounded-md border border-border bg-surface px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground sm:inline">⌘K</kbd>
      </button>
      <div className="ms-auto flex items-center gap-1.5">
        <Tip label={apiStatus === 'up' ? tx('Connected to the Murshid API', 'متصل بواجهة مرشد') : tx('Using bundled demo data (API offline or disabled)', 'بيانات تجريبية مدمجة (الواجهة غير متاحة)')} side="bottom">
          <button onClick={() => router.push('/settings#data')} className={cn('hidden h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium md:inline-flex', apiStatus === 'up' ? 'tint-success' : 'bg-surface-2 text-muted-foreground')}>
            {apiStatus === 'up' ? <Wifi className="size-3.5" /> : <Database className="size-3.5" />}
            {apiStatus === 'up' ? t('common.live') : t('common.demo')}
          </button>
        </Tip>
        <IconButton label={t('top.language')} onClick={() => { setPrefs({ locale: prefs.locale === 'ar' ? 'en' : 'ar' }); router.refresh(); }}>
          <Languages className="size-[18px]" />
        </IconButton>
        <IconButton label={t('top.theme')} onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={dark ? 'moon' : 'sun'} {...iconSwap} className="inline-flex">
              {dark ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
            </motion.span>
          </AnimatePresence>
        </IconButton>
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <BandSwitcher />
      </div>
    </header>
  );
}
