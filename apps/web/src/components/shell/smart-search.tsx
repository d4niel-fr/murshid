'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Bookmark, Clock, CornerDownLeft, FileText, HelpCircle, Layers, MessageCircle, Moon, Plus, Search, Sparkles, Timer, Type, Languages } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import { useApp } from '@/components/providers/app-provider';
import { DialogContent } from '@/components/ui/dialog';
import { FAQS } from '@/lib/faq';
import { rank } from '@/lib/fuzzy';
import { useLibrary } from '@/lib/library';
import { TEXT_SIZES } from '@/lib/prefs';
import { study, useStudy } from '@/lib/study';
import { cn } from '@/lib/utils';
import { NAV_ICONS } from './icons';
import { appNav } from './nav';

type Group = 'ask' | 'recent' | 'pages' | 'notes' | 'decks' | 'opportunities' | 'help' | 'actions';
interface Item { id: string; group: Group; label: string; hint?: string; icon: ReactNode; run: () => void; text?: string }

const GROUP_LABEL: Record<Group, [string, string]> = {
  ask: ['', ''], recent: ['Recently viewed', 'شوهد مؤخراً'], pages: ['Pages', 'الصفحات'], notes: ['Notes', 'الملاحظات'], decks: ['Flashcards', 'البطاقات'],
  opportunities: ['Opportunities', 'الفرص'], help: ['Help', 'المساعدة'], actions: ['Actions', 'إجراءات'],
};

function Highlight({ text, hits }: { text: string; hits: number[] }) {
  if (!hits.length) return <>{text}</>;
  const set = new Set(hits);
  return <>{[...text].map((ch, i) => (set.has(i) ? <mark key={i} className="bg-transparent font-semibold text-inherit underline decoration-[var(--brand-light)] decoration-2 underline-offset-2">{ch}</mark> : <Fragment key={i}>{ch}</Fragment>))}</>;
}

/** Smart search: pages, notes, decks, opportunities, help and actions, fuzzy-matched, with "Ask Murshid" for anything else. */
export function SmartSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { band, locale, tx, world, prefs, setPrefs, toast } = useApp();
  const router = useRouter();
  const st = useStudy();
  const lib = useLibrary();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const go = (href: string) => () => router.push(href);
  const I = (name: string) => { const C = NAV_ICONS[name] ?? NAV_ICONS.House!; return <C className="size-4" />; };

  const all = useMemo<Item[]>(() => {
    const pages: Item[] = appNav(band, locale).map((n) => ({ id: `p:${n.href}`, group: 'pages', label: n.label, icon: I(n.icon), run: go(n.href) }));
    const extra: [string, string, string, ReactNode][] = [
      ['/app/study', tx('Study tools', 'أدوات الدراسة'), 'study hub flashcards notes focus timer quiz topics', <BookOpen key="i" className="size-4" />],
      ['/app/study/flashcards', tx('Flashcards', 'البطاقات التعليمية'), 'cards spaced repetition decks revise', <Layers key="i" className="size-4" />],
      ['/app/study/notes', tx('Notes', 'الملاحظات'), 'notes write summary', <FileText key="i" className="size-4" />],
      ['/app/study/focus', tx('Focus timer', 'مؤقت التركيز'), 'pomodoro timer focus concentrate', <Timer key="i" className="size-4" />],
      ['/app/study/topics', tx('Topic tracker', 'متتبع المواضيع'), 'topics confidence exam revision', <Sparkles key="i" className="size-4" />],
      ['/app/saved', tx('Saved and recent', 'المحفوظات والأخيرة'), 'bookmarks saved for later history recent', <Bookmark key="i" className="size-4" />],
      ['/app/profile', tx('Profile & links', 'الملف والروابط'), 'cv linkedin portfolio', I('Link')],
      ['/app/settings#mascot', tx('Settings: mascot', 'الإعدادات: التميمة'), 'nour companion colour accessory name', I('Settings')],
      ['/app/settings#plan', tx('Settings: plan', 'الإعدادات: الخطة'), 'billing subscription single cancel', I('Settings')],
      ['/pricing', tx('Pricing', 'الأسعار'), 'plans single school price', I('Wallet')],
      ['/faq', tx('Help & FAQ', 'المساعدة والأسئلة'), 'questions help support', <HelpCircle key="i" className="size-4" />],
      ['/how-it-works', tx('How Murshid works', 'كيف يعمل مرشد'), 'agent loop guardrails', I('Info')],
      ['/privacy', tx('Privacy', 'الخصوصية'), 'data consent cookies', I('Shield')],
    ];
    for (const [href, label, text, icon] of extra) pages.push({ id: `p:${href}`, group: 'pages', label, icon, run: go(href), text: `${label} ${text}` });
    const notes: Item[] = st.notes.map((n) => ({ id: `n:${n.id}`, group: 'notes', label: n.title || tx('Untitled note', 'ملاحظة بلا عنوان'), hint: n.subject, icon: <FileText className="size-4" />, run: go(`/app/study/notes/${n.id}`), text: `${n.title} ${n.subject} ${n.tags.join(' ')} ${n.body.slice(0, 600)}` }));
    const decks: Item[] = st.decks.map((d) => ({ id: `d:${d.id}`, group: 'decks', label: d.title, hint: `${d.subject} · ${st.cards.filter((c) => c.deckId === d.id).length}`, icon: <Layers className="size-4" />, run: go(`/app/study/flashcards/${d.id}`), text: `${d.title} ${d.subject}` }));
    const opps: Item[] = world.opportunities.map((o) => ({ id: `o:${o.id}`, group: 'opportunities', label: o.title, hint: o.org, icon: I('Sparkles'), run: go(`/app/opportunities?q=${encodeURIComponent(o.title)}`), text: `${o.title} ${o.org} ${o.kind} ${o.tags.join(' ')} ${o.location}` }));
    const help: Item[] = FAQS.map((f) => ({ id: `f:${f.id}`, group: 'help', label: f.q[locale], icon: <HelpCircle className="size-4" />, run: go(`/faq#${f.id}`), text: `${f.q[locale]} ${f.a[locale]}` }));
    const ti = TEXT_SIZES.indexOf(prefs.textSize ?? 'md');
    const actions: Item[] = [
      { id: 'a:theme', group: 'actions', label: prefs.theme === 'dark' ? tx('Switch to light mode', 'التبديل إلى الوضع الفاتح') : tx('Switch to dark mode', 'التبديل إلى الوضع الداكن'), hint: 'Shift D', icon: <Moon className="size-4" />, run: () => setPrefs({ theme: prefs.theme === 'dark' ? 'light' : 'dark' }), text: 'theme dark light mode' },
      { id: 'a:lang', group: 'actions', label: locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية', hint: 'Shift L', icon: <Languages className="size-4" />, run: () => setPrefs({ locale: locale === 'ar' ? 'en' : 'ar' }), text: 'language arabic english' },
      { id: 'a:bigger', group: 'actions', label: tx('Bigger text', 'نص أكبر'), hint: '+', icon: <Type className="size-4" />, run: () => setPrefs({ textSize: TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, ti + 1)] }), text: 'text size bigger larger zoom font' },
      { id: 'a:smaller', group: 'actions', label: tx('Smaller text', 'نص أصغر'), hint: '−', icon: <Type className="size-3" />, run: () => setPrefs({ textSize: TEXT_SIZES[Math.max(0, ti - 1)] }), text: 'text size smaller font' },
      { id: 'a:note', group: 'actions', label: tx('New note', 'ملاحظة جديدة'), hint: 'Shift N', icon: <Plus className="size-4" />, run: () => { const id = study.addNote(); router.push(`/app/study/notes/${id}`); }, text: 'create note write' },
      { id: 'a:deck', group: 'actions', label: tx('New flashcard deck', 'مجموعة بطاقات جديدة'), icon: <Plus className="size-4" />, run: () => { const id = study.addDeck(tx('New deck', 'مجموعة جديدة'), 'Other'); router.push(`/app/study/flashcards/${id}`); toast({ title: tx('Deck created', 'أُنشئت المجموعة') }); }, text: 'create deck flashcards' },
      { id: 'a:focus', group: 'actions', label: tx('Start a 25-minute focus', 'ابدأ تركيزاً لمدة 25 دقيقة'), icon: <Timer className="size-4" />, run: () => router.push('/app/study/focus?start=25'), text: 'pomodoro timer focus start' },
    ];
    return [...pages, ...notes, ...decks, ...opps, ...help, ...actions];
  }, [band, locale, st, world, prefs.theme, prefs.textSize, tx]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const query = q.trim();
    if (!query) {
      const recent: Item[] = lib.recent.filter((r) => r.href.startsWith('/')).slice(0, 5).map((r) => ({ id: `r:${r.href}`, group: 'recent', label: r.title, hint: r.href, icon: <Clock className="size-4" />, run: go(r.href) }));
      const pages = all.filter((i) => i.group === 'pages').slice(0, 8);
      const actions = all.filter((i) => i.group === 'actions').slice(0, 3);
      return [...recent, ...pages, ...actions].map((item) => ({ item, hits: [] as number[] }));
    }
    const ranked = rank(query, all, (i) => i.text ?? i.label, 60);
    const per: Partial<Record<Group, number>> = {};
    const out = ranked.filter(({ item }) => { per[item.group] = (per[item.group] ?? 0) + 1; return per[item.group]! <= 5; })
      .map(({ item, hits }) => ({ item, hits: item.text ? [] : hits }));
    const order: Group[] = ['pages', 'actions', 'notes', 'decks', 'opportunities', 'help'];
    out.sort((a, b) => order.indexOf(a.item.group) - order.indexOf(b.item.group));
    return [{ item: { id: 'ask', group: 'ask' as const, hint: undefined as string | undefined, label: `${tx('Ask Murshid', 'اسأل مرشد')}: “${query}”`, icon: <MessageCircle className="size-4 text-primary" />, run: go(`/app/chat?q=${encodeURIComponent(query)}`) }, hits: [] }, ...out];
  }, [q, all, lib.recent, tx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) { setQ(''); setIdx(0); } }, [open]);
  useEffect(() => setIdx(0), [q]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' }); }, [idx]);
  const run = (i: number) => { results[i]?.item.run(); onOpenChange(false); };

  let last: Group | null = null;
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent instant title={tx('Search', 'بحث')} className="top-[14%] translate-y-0 p-3 sm:w-[620px]">
        <div className="flex items-center gap-2.5 rounded-full bg-surface px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)} role="combobox" aria-expanded="true" aria-controls="smart-search-list" aria-activedescendant={`ss-${idx}`}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter') { e.preventDefault(); run(idx); }
            }}
            placeholder={tx('Search pages, notes, cards, opportunities… or ask Murshid', 'ابحث في الصفحات والملاحظات والبطاقات والفرص… أو اسأل مرشد')}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded-md border border-border px-1.5 py-0.5 text-[0.6875rem] text-muted-foreground sm:block">Esc</kbd>
        </div>
        <ul ref={listRef} id="smart-search-list" role="listbox" className="mt-2 max-h-[56vh] overflow-y-auto">
          {results.map(({ item, hits }, i) => {
            const head = item.group !== last && item.group !== 'ask' ? GROUP_LABEL[item.group] : null; last = item.group;
            return (
              <Fragment key={item.id}>
                {head && <li role="presentation" className="eyebrow px-4 pb-1.5 pt-3">{tx(head[0], head[1])}</li>}
                <li role="option" id={`ss-${i}`} aria-selected={i === idx} data-i={i}>
                  <button onMouseMove={() => setIdx(i)} onClick={() => run(i)} className={cn('flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-start text-sm transition-colors', i === idx ? 'bg-[var(--deep)] text-white' : 'text-foreground')}>
                    <span className={cn('shrink-0', i === idx ? 'text-white' : 'text-muted-foreground')}>{item.icon}</span>
                    <span className="min-w-0 flex-1 truncate"><Highlight text={item.label} hits={hits} /></span>
                    {item.hint && <span className={cn('max-w-[40%] shrink-0 truncate text-xs', i === idx ? 'text-white/70' : 'text-muted-foreground')}>{item.hint}</span>}
                    {i === idx && <CornerDownLeft className="size-3.5 shrink-0 text-white/70" />}
                  </button>
                </li>
              </Fragment>
            );
          })}
        </ul>
        <p className="mt-2 px-4 text-[0.6875rem] text-muted-foreground">{tx('↑ ↓ to move · Enter to open · ? for all shortcuts', '↑ ↓ للتنقل · Enter للفتح · ? لكل الاختصارات')}</p>
      </DialogContent>
    </D.Root>
  );
}
