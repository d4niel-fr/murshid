'use client';

import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { DropdownMenu } from 'radix-ui';
import { Check, ChevronDown, Languages, Menu, Moon, Search, Sun } from 'lucide-react';
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
        <button className="inline-flex h-10 items-center gap-2.5 rounded-full bg-surface ps-1 pe-3 text-sm transition-colors hover:bg-[color-mix(in_oklab,var(--surface)_80%,var(--text)_6%)]" aria-label={tx('Switch demo student', 'تبديل الطالب التجريبي')}>
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--deep)] text-[12px] font-medium text-white">{s.firstName[0]}</span>
          <span className="hidden text-start leading-tight md:block">
            <span className="block text-[13px] font-medium">{locale === 'ar' ? s.nameAr : s.firstName}</span>
            <span className="block text-[11px] text-muted-foreground">{BANDS[band].label[locale]}</span>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-72 rounded-[24px] bg-popover p-2 shadow-lift data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
          <DropdownMenu.Label className="eyebrow px-3 pb-2 pt-2">{tx('Demo students (synthetic)', 'طلاب تجريبيون (بيانات وهمية)')}</DropdownMenu.Label>
          {BAND_IDS.map((b) => {
            const st = demoStudents[b];
            return (
              <DropdownMenu.Item key={b} onSelect={() => choose(b)} data-band={b} className="flex cursor-pointer items-center gap-3 rounded-[16px] px-2.5 py-2 outline-none data-[highlighted]:bg-surface">
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
      <button onClick={onClick} aria-label={label} className="relative inline-flex size-10 items-center justify-center overflow-hidden rounded-full bg-surface text-muted-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--surface)_80%,var(--text)_6%)] hover:text-foreground">
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
    <header className="sticky top-0 z-30 flex h-[var(--topbar-h)] shrink-0 items-center gap-2.5 bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] px-4 pt-[var(--inset)] backdrop-blur-xl md:px-8">
      <button onClick={onMenu} aria-label="Menu" className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--deep)] text-white lg:hidden">
        <Menu className="size-[18px]" />
      </button>
      <button onClick={onSearch} className="group flex h-10 min-w-0 max-w-[380px] flex-1 items-center gap-2.5 rounded-full bg-surface px-4 text-[13.5px] text-muted-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--surface)_80%,var(--text)_6%)] hover:text-foreground">
        <Search className="size-4 shrink-0" />
        <span className="truncate">{t('top.search')}</span>
        <kbd className="ms-auto hidden rounded-full bg-surface-2 px-2 py-0.5 font-sans text-[11px] leading-4 text-muted-foreground sm:inline">⌘K</kbd>
      </button>
      <div className="ms-auto flex items-center gap-1.5">
        <Tip label={apiStatus === 'up' ? tx('Connected to the Murshid API', 'متصل بواجهة مرشد') : tx('Using bundled demo data (API offline or disabled)', 'بيانات تجريبية مدمجة (الواجهة غير متاحة)')} side="bottom">
          <button onClick={() => router.push('/settings#data')} className="me-0.5 hidden h-10 items-center gap-2 rounded-full bg-surface px-4 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground md:inline-flex rtl:tracking-normal">
            <span className="relative flex size-2">
              {apiStatus === 'up' && <span className="absolute inset-0 animate-ping rounded-full bg-[var(--spark)] opacity-70" />}
              <span className={cn('relative size-2 rounded-full', apiStatus === 'up' ? 'bg-[var(--spark)] ring-2 ring-[color-mix(in_oklab,var(--spark)_35%,transparent)]' : 'bg-[var(--text-muted)]')} />
            </span>
            {apiStatus === 'up' ? t('common.live') : t('common.demo')}
          </button>
        </Tip>
        <IconButton label={t('top.language')} onClick={() => { setPrefs({ locale: prefs.locale === 'ar' ? 'en' : 'ar' }); router.refresh(); }}>
          <Languages className="size-4" />
        </IconButton>
        <IconButton label={t('top.theme')} onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={dark ? 'moon' : 'sun'} {...iconSwap} className="inline-flex">
              {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </motion.span>
          </AnimatePresence>
        </IconButton>
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <BandSwitcher />
      </div>
    </header>
  );
}
