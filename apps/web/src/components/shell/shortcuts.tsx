'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { Dialog as D } from 'radix-ui';
import { useApp } from '@/components/providers/app-provider';
import { DialogContent } from '@/components/ui/dialog';
import { TEXT_SIZES } from '@/lib/prefs';
import { study } from '@/lib/study';

export const GOTO: Record<string, [string, string, string]> = {
  h: ['/app', 'Home', 'الرئيسية'], s: ['/app/study', 'Study tools', 'أدوات الدراسة'], f: ['/app/study/flashcards', 'Flashcards', 'البطاقات'],
  n: ['/app/study/notes', 'Notes', 'الملاحظات'], p: ['/app/planner', 'Planner', 'المخطط'], c: ['/app/chat', 'Ask Murshid', 'اسأل مرشد'],
  a: ['/app/academics', 'Schoolwork', 'الدراسة'], o: ['/app/opportunities', 'Opportunities', 'الفرص'], v: ['/app/saved', 'Saved', 'المحفوظات'], t: ['/app/settings', 'Settings', 'الإعدادات'],
};

export const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

/** Global keyboard shortcuts for the student app (ignored while typing). */
export function useShortcuts({ onSearch, onHelp, onSidebar }: { onSearch: () => void; onHelp: () => void; onSidebar: () => void }) {
  const { prefs, setPrefs, locale, tx, toast } = useApp();
  const router = useRouter();
  const pendingG = useRef(0);
  const ref = useRef({ prefs, locale });
  ref.current = { prefs, locale };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); onSearch(); return; }
      if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); onSidebar(); return; }
      if (mod || e.altKey || isTyping(e)) return;
      const { prefs: p, locale: l } = ref.current;
      if (Date.now() - pendingG.current < 1200 && GOTO[e.key.toLowerCase()]) {
        e.preventDefault(); pendingG.current = 0; router.push(GOTO[e.key.toLowerCase()]![0]); return;
      }
      if (e.key === 'g' && !e.shiftKey) { pendingG.current = Date.now(); return; }
      if (e.key === '/') { e.preventDefault(); onSearch(); return; }
      if (e.key === '?') { e.preventDefault(); onHelp(); return; }
      if (e.shiftKey && e.key === 'D') { setPrefs({ theme: p.theme === 'dark' ? 'light' : 'dark' }); return; }
      if (e.shiftKey && e.key === 'L') { setPrefs({ locale: l === 'ar' ? 'en' : 'ar' }); return; }
      if (e.shiftKey && e.key === 'N') { const id = study.addNote(); router.push(`/app/study/notes/${id}`); return; }
      if (e.key === '+' || e.key === '=' || e.key === '-') {
        const i = TEXT_SIZES.indexOf(p.textSize ?? 'md'); const next = TEXT_SIZES[Math.max(0, Math.min(TEXT_SIZES.length - 1, i + (e.key === '-' ? -1 : 1)))]!;
        if (next !== p.textSize) { setPrefs({ textSize: next }); toast({ title: tx('Text size', 'حجم النص'), description: { sm: tx('Small', 'صغير'), md: tx('Default', 'افتراضي'), lg: tx('Large', 'كبير'), xl: tx('Extra large', 'كبير جداً') }[next], tone: 'info', duration: 1400 }); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSearch, onHelp, onSidebar, router, setPrefs, toast, tx]);
}

function Keys({ k }: { k: string[] }) {
  return <span className="flex shrink-0 items-center gap-1">{k.map((x, i) => <kbd key={i} className="min-w-6 rounded-md border border-border bg-surface px-1.5 py-0.5 text-center text-[0.6875rem] font-medium">{x}</kbd>)}</span>;
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { tx, locale } = useApp();
  const mod = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform) ? '⌘' : 'Ctrl';
  const groups: [string, [string[], string][]][] = [
    [tx('Anywhere', 'في أي مكان'), [
      [[mod, 'K'], tx('Search everything', 'البحث في كل شيء')], [['/'], tx('Search', 'بحث')], [['?'], tx('Show these shortcuts', 'عرض هذه الاختصارات')],
      [['Shift', 'D'], tx('Dark or light mode', 'الوضع الداكن أو الفاتح')], [['Shift', 'L'], tx('Switch language', 'تغيير اللغة')],
      [['+', '−'], tx('Bigger or smaller text', 'نص أكبر أو أصغر')], [[mod, 'B'], tx('Collapse the sidebar', 'طي الشريط الجانبي')], [['Shift', 'N'], tx('New note', 'ملاحظة جديدة')],
    ]],
    [tx('Go to (press G, then…)', 'انتقل إلى (اضغط G ثم…)'), Object.entries(GOTO).map(([k, v]) => [['G', k.toUpperCase()], locale === 'ar' ? v[2] : v[1]])],
    [tx('Study', 'الدراسة'), [
      [['Space'], tx('Flip a flashcard / start or pause the timer', 'اقلب البطاقة / ابدأ المؤقت أو أوقفه')], [['1', '2', '3', '4'], tx('Rate a card: again, hard, good, easy', 'قيّم البطاقة: مجدداً، صعبة، جيدة، سهلة')],
      [['R'], tx('Reset the focus timer', 'إعادة ضبط مؤقت التركيز')], [['Esc'], tx('Close a dialog or end a session', 'إغلاق نافذة أو إنهاء جلسة')],
    ]],
  ];
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent title={tx('Keyboard shortcuts', 'اختصارات لوحة المفاتيح')} className="sm:w-[640px]">
        <div className="grid gap-6 sm:grid-cols-2">
          {groups.map(([h, rows]) => (
            <section key={h} className={h.startsWith(tx('Go to', 'انتقل')) ? 'sm:row-span-2' : undefined}>
              <h3 className="eyebrow mb-2">{h}</h3>
              <ul className="flex flex-col">
                {rows.map(([k, label]) => <li key={label} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-0"><span>{label}</span><Keys k={k} /></li>)}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </D.Root>
  );
}
