'use client';

import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { DropdownMenu } from 'radix-ui';
import { Bookmark, BookmarkCheck, Check, ChevronDown, Ellipsis, Keyboard, Languages, Link2, Menu, Moon, Printer, Search, Share2, Sun, Type } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { copyText } from '@/components/shared/actions';
import { library, useLibrary } from '@/lib/library';
import type { TextSize } from '@/lib/prefs';
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
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--deep)] text-[0.75rem] font-medium text-white">{s.firstName[0]}</span>
          <span className="hidden text-start leading-tight md:block">
            <span className="block text-[0.8125rem] font-medium">{locale === 'ar' ? s.nameAr : s.firstName}</span>
            <span className="block text-[0.6875rem] text-muted-foreground">{BANDS[band].label[locale]}</span>
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

function IconButton({ label, onClick, children, className }: { label: string; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <Tip label={label} side="bottom">
      <button onClick={onClick} aria-label={label} className={cn('relative inline-flex size-10 items-center justify-center overflow-hidden rounded-full bg-surface text-muted-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--surface)_80%,var(--text)_6%)] hover:text-foreground', className)}>
        {children}
      </button>
    </Tip>
  );
}

/** Page actions: save for later, share, copy link, print, text size and the shortcuts list. */
function PageMenu({ onShortcuts }: { onShortcuts: () => void }) {
  const { tx, t, toast, prefs, setPrefs } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const lib = useLibrary();
  const id = `page:${pathname}`;
  const saved = lib.saved.some((s) => s.id === id);
  const item = 'flex cursor-pointer items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-surface';
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: document.title, url }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
    toast({ title: (await copyText(url)) ? tx('Link copied', 'تم نسخ الرابط') : tx('Could not share', 'تعذّرت المشاركة') });
  };
  const sizes: [TextSize, string][] = [['sm', 'A−'], ['md', 'A'], ['lg', 'A+'], ['xl', 'A++']];
  return (
    <DropdownMenu.Root>
      <Tip label={tx('Page options', 'خيارات الصفحة')} side="bottom">
        <DropdownMenu.Trigger asChild>
          <button aria-label={tx('Page options', 'خيارات الصفحة')} className="inline-flex size-10 items-center justify-center rounded-full bg-surface text-muted-foreground transition-colors hover:text-foreground"><Ellipsis className="size-4" /></button>
        </DropdownMenu.Trigger>
      </Tip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-[22px] bg-popover p-2 shadow-lift data-[state=open]:animate-in data-[state=open]:fade-in-0">
          {/* phones: the language and theme buttons live here instead of the top bar */}
          <div className="sm:hidden">
            <DropdownMenu.Item className={item} onSelect={() => { setPrefs({ locale: prefs.locale === 'ar' ? 'en' : 'ar' }); router.refresh(); }}><Languages className="size-4" />{t('top.language')}<span className="ms-auto text-xs text-muted-foreground">{prefs.locale === 'ar' ? 'English' : 'العربية'}</span></DropdownMenu.Item>
            <DropdownMenu.Item className={item} onSelect={() => setPrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' })}>{prefs.theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}{prefs.theme === 'dark' ? tx('Light mode', 'الوضع الفاتح') : tx('Dark mode', 'الوضع الداكن')}</DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
          </div>
          <DropdownMenu.Item className={item} onSelect={() => { const on = library.toggle({ id, kind: 'page', title: document.title, href: pathname }); toast({ title: on ? tx('Saved for later', 'حُفظ لوقت لاحق') : tx('Removed from saved', 'أُزيل من المحفوظات'), tone: on ? 'success' : 'info' }); }}>
            {saved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}{saved ? tx('Saved (remove)', 'محفوظ (إزالة)') : tx('Save page for later', 'حفظ الصفحة لوقت لاحق')}
          </DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={share}><Share2 className="size-4" />{tx('Share page', 'مشاركة الصفحة')}</DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={async () => toast({ title: (await copyText(window.location.href)) ? tx('Link copied', 'تم نسخ الرابط') : tx('Could not copy', 'تعذّر النسخ') })}><Link2 className="size-4" />{tx('Copy link', 'نسخ الرابط')}</DropdownMenu.Item>
          <DropdownMenu.Item className={item} onSelect={() => setTimeout(() => window.print(), 50)}><Printer className="size-4" />{tx('Print', 'طباعة')}</DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
          <div className="px-3 pb-1 pt-1.5">
            <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><Type className="size-3.5" />{tx('Text size', 'حجم النص')}</p>
            <div role="radiogroup" aria-label={tx('Text size', 'حجم النص')} className="grid grid-cols-4 gap-1 rounded-full bg-surface p-1">
              {sizes.map(([k, l]) => (
                <button key={k} role="radio" aria-checked={(prefs.textSize ?? 'md') === k} onClick={() => setPrefs({ textSize: k })}
                  className={cn('h-8 rounded-full text-xs font-medium transition-colors', (prefs.textSize ?? 'md') === k ? 'bg-[var(--deep)] text-white' : 'text-muted-foreground hover:text-foreground')}>{l}</button>
              ))}
            </div>
          </div>
          <DropdownMenu.Separator className="my-1.5 h-px bg-border" />
          <DropdownMenu.Item className={item} onSelect={onShortcuts}><Keyboard className="size-4" />{tx('Keyboard shortcuts', 'اختصارات لوحة المفاتيح')}<kbd className="ms-auto rounded-md border border-border px-1.5 text-[0.6875rem]">?</kbd></DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function TopBar({ onMenu, onSearch, onShortcuts }: { onMenu: () => void; onSearch: () => void; onShortcuts: () => void }) {
  const { prefs, setPrefs, t, tx, apiStatus } = useApp();
  const router = useRouter();
  const dark = prefs.theme === 'dark';
  return (
    <header data-chrome className="sticky top-0 z-30 flex h-[var(--topbar-h)] shrink-0 items-center gap-2.5 bg-[var(--bg)] px-4 pt-[var(--inset)] md:bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] md:px-8 md:backdrop-blur-xl">
      <button onClick={onMenu} aria-label="Menu" className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--deep)] text-white lg:hidden">
        <Menu className="size-[18px]" />
      </button>
      <button onClick={onSearch} className="group flex h-10 min-w-0 max-w-[380px] flex-1 items-center gap-2.5 rounded-full bg-surface px-4 text-[0.8438rem] text-muted-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--surface)_80%,var(--text)_6%)] hover:text-foreground">
        <Search className="size-4 shrink-0" />
        <span className="truncate">{t('top.search')}</span>
        <kbd className="ms-auto hidden rounded-full bg-surface-2 px-2 py-0.5 font-sans text-[0.6875rem] leading-4 text-muted-foreground sm:inline">⌘K</kbd>
      </button>
      <div className="ms-auto flex items-center gap-1.5">
        <Tip label={apiStatus === 'up' ? tx('Connected to the Murshid API', 'متصل بواجهة مرشد') : tx('Using bundled demo data (API offline or disabled)', 'بيانات تجريبية مدمجة (الواجهة غير متاحة)')} side="bottom">
          <button onClick={() => router.push('/app/settings#data')} className="me-0.5 hidden h-10 items-center gap-2 rounded-full bg-surface px-4 text-[0.6875rem] font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground md:inline-flex rtl:tracking-normal">
            <span className="relative flex size-2">
              <span className={cn('relative size-2 rounded-full', apiStatus === 'up' ? 'bg-[var(--spark)] ring-2 ring-[color-mix(in_oklab,var(--spark)_35%,transparent)]' : 'bg-[var(--text-muted)]')} />
            </span>
            {apiStatus === 'up' ? t('common.live') : t('common.demo')}
          </button>
        </Tip>
        <IconButton className="hidden sm:inline-flex" label={t('top.language')} onClick={() => { setPrefs({ locale: prefs.locale === 'ar' ? 'en' : 'ar' }); router.refresh(); }}>
          <Languages className="size-4" />
        </IconButton>
        <IconButton className="hidden sm:inline-flex" label={t('top.theme')} onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={dark ? 'moon' : 'sun'} {...iconSwap} className="inline-flex">
              {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </motion.span>
          </AnimatePresence>
        </IconButton>
        <PageMenu onShortcuts={onShortcuts} />
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <BandSwitcher />
      </div>
    </header>
  );
}
