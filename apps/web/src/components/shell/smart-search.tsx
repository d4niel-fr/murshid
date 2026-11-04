'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { BookOpen, Bookmark, ClipboardList, Clock, CornerDownLeft, FileText, HelpCircle, Languages, Layers, MessageCircle, Moon, PenLine, Plus, Presentation, Radio, Search, Sparkles, Timer, Type, WandSparkles } from 'lucide-react';
import { Dialog as D } from 'radix-ui';
import { useApp } from '@/components/providers/app-provider';
import { DialogContent } from '@/components/ui/dialog';
import { FAQS } from '@/lib/faq';
import { rank } from '@/lib/fuzzy';
import { useLibrary } from '@/lib/library';
import { getSchool } from '@/lib/school-api';
import { subjectName } from '@/lib/subjects';
import { TEXT_SIZES } from '@/lib/prefs';
import { study, useStudy } from '@/lib/study';
import { boards as boardsApi, useBoards } from '@/lib/whiteboard';
import { useNotebooks } from '@/lib/notebook';
import { cn } from '@/lib/utils';
import { NAV_ICONS } from './icons';
import { appNav } from './nav';

type Group = 'ask' | 'recent' | 'pages' | 'assignments' | 'notes' | 'decks' | 'boards' | 'opportunities' | 'help' | 'actions';
interface Item { id: string; group: Group; label: string; hint?: string; icon: ReactNode; run: () => void; text?: string }

const GROUP_LABEL: Record<Group, [string, string]> = {
  ask: ['', ''], recent: ['Recently viewed', 'شوهد مؤخراً'], pages: ['Pages', 'الصفحات'], assignments: ['From your teachers', 'من معلميك'], notes: ['Notes', 'الملاحظات'], decks: ['Flashcards', 'البطاقات'], boards: ['Boards and notebooks', 'السبورات والدفاتر'],
  opportunities: ['Opportunities', 'الفرص'], help: ['Help', 'المساعدة'], actions: ['Actions', 'إجراءات'],
};

/** Other words people use for each page (the nav label alone misses them: the planner is labelled "Today"). */
const ALIAS: Record<string, string> = {
  home: 'home dashboard overview start الرئيسية',
  today: 'planner plan today tasks to do schedule calendar week agenda مخطط مهام اليوم',
  planner: 'planner study plan revision schedule timetable مخطط',
  schoolwork: 'schoolwork academics grades marks subjects results الدرجات',
  activities: 'activities extracurriculars clubs sport training gym الأنشطة',
  goals: 'goals targets aims الأهداف',
  opportunities: 'opportunities competitions programmes internships summer courses الفرص',
  portfolio: 'portfolio projects achievements',
  cv: 'cv resume',
  links: 'profile links linkedin github accounts',
  chat: 'chat ask murshid assistant tutor question help',
  settings: 'settings preferences privacy theme language account mascot الإعدادات',
  school: 'school assignments homework teachers classes hand in submit المدرسة واجبات',
  study: 'study tools flashcards notes focus timer notebook quiz',
  insights: 'insights charts graphs analytics progress trends',
  saved: 'saved bookmarks recent history',
};

function Highlight({ text, hits }: { text: string; hits: number[] }) {
  if (!hits.length) return <>{text}</>;
  const set = new Set(hits);
  return <>{[...text].map((ch, i) => (set.has(i) ? <mark key={i} className="bg-transparent font-semibold text-inherit underline decoration-[var(--brand-light)] decoration-2 underline-offset-2">{ch}</mark> : <Fragment key={i}>{ch}</Fragment>))}</>;
}

/** Smart search: pages, notes, decks, opportunities, help and actions, fuzzy-matched, with "Ask Murshid" for anything else. */
export function SmartSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { band, locale, tx, world, prefs, setPrefs, toast, client } = useApp();
  // teachers' assignments, fetched once when search first opens
  const [work, setWork] = useState<{ id: string; title: string; subject: string; teacher: string }[] | null>(null);
  useEffect(() => {
    if (!open || work) return;
    let live = true;
    getSchool(client.devUser).then((d) => { if (live) setWork(d?.licence?.type === 'institution' ? (d.school?.assignments ?? []) : []); }).catch(() => { if (live) setWork([]); });
    return () => { live = false; };
  }, [open, work, client.devUser]);
  const router = useRouter();
  const st = useStudy();
  const wb = useBoards();
  const nbs = useNotebooks();
  const lib = useLibrary();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const go = (href: string) => () => router.push(href);
  const I = (name: string) => { const C = NAV_ICONS[name] ?? NAV_ICONS.House!; return <C className="size-4" />; };

  const all = useMemo<Item[]>(() => {
    const pages: Item[] = [];
    const seen = new Set<string>();
    for (const n of appNav(band, locale)) {
      if (seen.has(n.href)) continue;
      seen.add(n.href);
      pages.push({ id: `p:${n.href}`, group: 'pages', label: n.label, icon: I(n.icon), run: go(n.href), text: `${n.label} ${ALIAS[n.key] ?? ''}` });
    }
    const extra: [string, string, string, ReactNode][] = [
      ['/app/study', tx('Study tools', 'أدوات الدراسة'), 'study hub flashcards notes focus timer quiz topics', <BookOpen key="i" className="size-4" />],
      ['/app/study/create', tx('Create with Murshid', 'أنشئ مع مرشد'), 'make generate ai flashcards notes from slides pdf powerpoint lecture quizlet anki upload paste اصنع بطاقات ملاحظات', <WandSparkles key="i" className="size-4" />],
      ['/app/study/flashcards', tx('Flashcards', 'البطاقات التعليمية'), 'cards spaced repetition decks revise learn write match test challenge', <Layers key="i" className="size-4" />],
      ['/app/study/whiteboard', tx('Whiteboard', 'السبورة'), 'whiteboard board draw diagram mind map sketch canvas sticky سبورة رسم', <Presentation key="i" className="size-4" />],
      ['/app/study/live', tx('Join a live quiz', 'انضم إلى اختبار مباشر'), 'live quiz game code join kahoot class multiplayer اختبار مباشر رمز', <Radio key="i" className="size-4" />],
      ['/app/study/notes', tx('Notes', 'الملاحظات'), 'notes write summary', <FileText key="i" className="size-4" />],
      ['/app/study/focus', tx('Focus timer', 'مؤقت التركيز'), 'pomodoro timer focus concentrate', <Timer key="i" className="size-4" />],
      ['/app/study/notebook', tx('Notebook (handwriting)', 'الدفتر (كتابة يدوية)'), 'handwriting pen stylus pencil draw write goodnotes notebook ink', <PenLine key="i" className="size-4" />],
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
    for (const [href, label, text, icon] of extra) {
      const same = pages.find((p) => p.id === `p:${href}`);
      if (same) { same.text = `${same.text ?? same.label} ${label} ${text}`; continue; }
      pages.push({ id: `p:${href}`, group: 'pages', label, icon, run: go(href), text: `${label} ${text}` });
    }
    const assignments: Item[] = (work ?? []).map((a) => ({ id: `w:${a.id}`, group: 'assignments', label: a.title, hint: subjectName(a.subject, locale), icon: <ClipboardList className="size-4" />, run: go(`/app/school/assignments/${encodeURIComponent(a.id)}`), text: `${a.title} ${a.subject} ${subjectName(a.subject, locale)} ${a.teacher}` }));
    const notes: Item[] = st.notes.map((n) => ({ id: `n:${n.id}`, group: 'notes', label: n.title || tx('Untitled note', 'ملاحظة بلا عنوان'), hint: subjectName(n.subject, locale), icon: <FileText className="size-4" />, run: go(`/app/study/notes/${n.id}`), text: `${n.title} ${n.subject} ${n.tags.join(' ')} ${n.body.slice(0, 600)}` }));
    const decks: Item[] = st.decks.map((d) => ({ id: `d:${d.id}`, group: 'decks', label: d.title, hint: `${subjectName(d.subject, locale)} · ${st.cards.filter((c) => c.deckId === d.id).length}`, icon: <Layers className="size-4" />, run: go(`/app/study/flashcards/${d.id}`), text: `${d.title} ${d.subject} ${subjectName(d.subject, locale)}` }));
    const boardItems: Item[] = [
      ...wb.boards.map((b) => ({ id: `b:${b.id}`, group: 'boards' as const, label: b.title, hint: tx('Whiteboard', 'سبورة'), icon: <Presentation className="size-4" />, run: go(`/app/study/whiteboard/${b.id}`), text: `${b.title} ${b.subject} ${subjectName(b.subject, locale)} whiteboard board ${b.elements.flatMap((e) => (e.type === 'text' || e.type === 'sticky' ? [e.text] : [])).join(' ').slice(0, 400)}` })),
      ...nbs.notebooks.map((n) => ({ id: `k:${n.id}`, group: 'boards' as const, label: n.title, hint: tx('Notebook', 'دفتر'), icon: <PenLine className="size-4" />, run: go(`/app/study/notebook/${n.id}`), text: `${n.title} ${n.subject} ${subjectName(n.subject, locale)} notebook handwriting ${n.pages.flatMap((p) => (p.texts ?? []).map((t) => t.text)).join(' ').slice(0, 400)}` })),
    ];
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
      { id: 'a:make', group: 'actions', label: tx('Make flashcards from my material', 'اصنع بطاقات من موادي'), icon: <WandSparkles className="size-4" />, run: go('/app/study/create'), text: 'create make generate flashcards notes quiz from slides pdf upload' },
      { id: 'a:board', group: 'actions', label: tx('New whiteboard', 'سبورة جديدة'), icon: <Plus className="size-4" />, run: () => { const id = boardsApi.create(tx('Untitled board', 'سبورة بلا عنوان'), 'Other'); router.push(`/app/study/whiteboard/${id}`); }, text: 'create new whiteboard board draw diagram' },
      { id: 'a:focus', group: 'actions', label: tx('Start a 25-minute focus', 'ابدأ تركيزاً لمدة 25 دقيقة'), icon: <Timer className="size-4" />, run: () => router.push('/app/study/focus?start=25'), text: 'pomodoro timer focus start' },
    ];
    return [...pages, ...assignments, ...notes, ...decks, ...boardItems, ...opps, ...help, ...actions];
  }, [band, locale, st, wb, nbs, world, prefs.theme, prefs.textSize, tx, work]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const order: Group[] = ['pages', 'actions', 'assignments', 'notes', 'decks', 'boards', 'opportunities', 'help'];
    out.sort((a, b) => order.indexOf(a.item.group) - order.indexOf(b.item.group));
    const ask = { item: { id: 'ask', group: 'ask' as const, hint: undefined as string | undefined, label: `${tx('Ask Murshid', 'اسأل مرشد')}: “${query}”`, icon: <MessageCircle className="size-4 text-primary" />, run: go(`/app/chat?q=${encodeURIComponent(query)}`) }, hits: [] as number[] };
    // a page, action or assignment whose name or keywords contain the words typed goes first, so Enter opens it;
    // a question (several words) goes to Murshid first
    const ql = query.toLowerCase();
    const sentence = query.split(/\s+/).length >= 3 || /[?؟]$/.test(query);
    const exact = sentence ? [] : out.filter(({ item }) => ['pages', 'actions', 'assignments'].includes(item.group) && (item.text ?? item.label).toLowerCase().split(/[\s&:·,()]+/).some((w) => w.startsWith(ql) || (ql.length > 3 && item.label.toLowerCase().includes(ql))));
    const rest = out.filter((r) => !exact.includes(r));
    return [...exact, ask, ...rest];
  }, [q, all, lib.recent, tx]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) { setQ(''); setIdx(0); } }, [open]);
  useEffect(() => setIdx(0), [q]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' }); }, [idx]);
  const run = (i: number) => { results[i]?.item.run(); onOpenChange(false); };

  let last: Group | null = null;
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent instant title={tx('Search', 'بحث')} className="top-3 flex max-h-[calc(100dvh-1.5rem)] translate-y-0 flex-col p-3 sm:top-[min(14%,6rem)] sm:max-h-[min(80dvh,calc(100dvh-2rem))] sm:w-[620px]">
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
        <ul ref={listRef} id="smart-search-list" role="listbox" className="mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain sm:max-h-[56vh]">
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
