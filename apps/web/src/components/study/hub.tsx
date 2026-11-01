'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, FileText, Flame, Layers, ListChecks, PenLine, Play, Sparkles, Timer } from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { MyMascot, useMascotName } from '@/components/mascot/my-mascot';
import { Page, PageHeader } from '@/components/shared/page';
import { Button } from '@/components/ui/button';
import { fadeUp, stagger } from '@/lib/motion';
import { isDue, studyStreak, useStudy, weekFocusMinutes } from '@/lib/study';
import { cn } from '@/lib/utils';
import { count, countAr } from '@/lib/plural';
import { Ago } from '@/components/shared/ago';
import { useNotebooks } from '@/lib/notebook';

export function StudyHub() {
  const { tx, locale, world } = useApp();
  const s = useStudy();
  const nbs = useNotebooks();
  const name = useMascotName();
  const now = Date.now();
  const due = s.cards.filter((c) => isDue(c, now)).length;
  const streak = studyStreak(s);
  const week = weekFocusMinutes(s.sessions);
  const confident = s.topics.length ? Math.round((s.topics.filter((t) => t.confidence >= 2).length / s.topics.length) * 100) : 0;
  const shaky = s.topics.filter((t) => t.confidence <= 1);
  const decksDue = s.decks.map((d) => ({ d, n: s.cards.filter((c) => c.deckId === d.id && isDue(c, now)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const notes = [...s.notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  const first = world.dashboard.student.firstName;
  // Arabic copy uses the Arabic first name when the student has one
  const firstAr = world.dashboard.student.nameAr?.trim().split(/\s+/)[0] || first;

  const stats: [string, string | number, string][] = [
    [tx('Cards due', 'بطاقات مستحقة'), due, tx('ready to review', 'جاهزة للمراجعة')],
    [tx('Study streak', 'أيام متتالية'), streak, streak === 1 ? tx('day', 'يوم') : tx('days', 'أيام')],
    [tx('Focus this week', 'تركيز هذا الأسبوع'), week, tx('minutes', 'دقيقة')],
    [tx('Topics confident', 'مواضيع متقنة'), `${confident}%`, tx(`of ${count(s.topics.length, 'topic')}`, `من ${s.topics.length} موضوعاً`)],
  ];
  const tools = [
    { href: '/app/study/flashcards', icon: Layers, title: tx('Flashcards', 'البطاقات التعليمية'), body: tx('Spaced repetition: each card comes back just before you would forget it.', 'تكرار متباعد: تعود كل بطاقة قبل أن تنساها مباشرة.'), meta: tx(`${count(s.decks.length, 'deck')} · ${due} due`, `${s.decks.length} مجموعات · ${due} مستحقة`) },
    { href: '/app/study/notes', icon: FileText, title: tx('Notes', 'الملاحظات'), body: tx('Headings, checklists and tables. Saves as you type; turns “term :: meaning” lines into cards.', 'عناوين وقوائم وجداول. تُحفظ أثناء الكتابة؛ وتحوّل سطور «مصطلح :: معنى» إلى بطاقات.'), meta: tx(count(s.notes.length, 'note'), `${s.notes.length} ملاحظات`) },
    { href: '/app/study/notebook', icon: PenLine, title: tx('Notebook', 'الدفتر'), body: tx('Write by hand with a stylus or finger: pen, highlighter, eraser, lined or grid paper.', 'اكتب بخط يدك بالقلم أو الإصبع: قلم وقلم تمييز وممحاة وورق مسطّر أو مربعات.'), meta: tx(count(nbs.notebooks.length, 'notebook'), `${nbs.notebooks.length} دفاتر`) },
    { href: '/app/study/focus', icon: Timer, title: tx('Focus timer', 'مؤقت التركيز'), body: tx('25 minutes on, 5 off. Every session is logged, so you can see your week.', '25 دقيقة عمل و5 راحة. تُسجّل كل جلسة لترى أسبوعك.'), meta: tx(`${week} min this week`, `${week} دقيقة هذا الأسبوع`) },
    { href: '/app/study/topics', icon: ListChecks, title: tx('Topic tracker', 'متتبع المواضيع'), body: tx('Rate each topic from “not started” to “confident” and revise the shaky ones first.', 'قيّم كل موضوع من «لم أبدأ» إلى «متقن» وراجع الضعيفة أولاً.'), meta: tx(`${shaky.length} to revise`, `${shaky.length} للمراجعة`) },
  ];

  return (
    <Page>
      <PageHeader eyebrow={tx('Study tools', 'أدوات الدراسة')} title={tx('Study', 'الدراسة')}
        subtitle={tx('Flashcards, notes, a focus timer and quizzes, all in one place. Everything is saved on this device.', 'بطاقات وملاحظات ومؤقت تركيز واختبارات في مكان واحد. يُحفظ كل شيء على هذا الجهاز.')}
        actions={<Button asChild><Link href="/app/study/focus?start=25"><Play />{tx('Start a 25-min focus', 'ابدأ تركيزاً 25 دقيقة')}</Link></Button>} />

      <motion.section initial="hidden" animate="show" variants={stagger} className="on-deep relative mb-6 overflow-hidden rounded-[var(--radius-band)] bg-[var(--deep)] p-6 text-white md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <motion.div variants={fadeUp} className="flex items-center gap-4 lg:w-[34%]">
            <span className="grid size-[6.5rem] shrink-0 place-items-center rounded-full bg-white/[0.09] text-white"><MyMascot size={92} mood={due > 0 ? 'idle' : 'happy'} /></span>
            <div>
              <p className="eyebrow">{name}</p>
              <p className="mt-1.5 text-[1.0625rem] leading-snug">
                {due > 0 ? tx(`${due === 1 ? '1 card is' : `${due} cards are`} ready, ${first}. Ten minutes now saves an hour later.`, `${countAr(due, { one: 'بطاقة واحدة جاهزة', two: 'بطاقتان جاهزتان', few: 'بطاقات جاهزة', many: 'بطاقةً جاهزة', other: 'بطاقة جاهزة' })} يا ${firstAr}. عشر دقائق الآن توفّر ساعة لاحقاً.`) : tx(`All caught up, ${first}. Nice work.`, `أنهيت كل شيء يا ${firstAr}. عمل رائع.`)}
              </p>
            </div>
          </motion.div>
          <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
            {stats.map(([label, v, sub]) => (
              <motion.div key={label} variants={fadeUp} className="glass rounded-[20px] p-4">
                <p className="eyebrow">{label}</p>
                <p className="figure mt-2 text-[2rem] leading-none">{v}</p>
                <p className="mt-1.5 text-xs text-white/65">{sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.div initial="hidden" animate="show" variants={stagger} className="grid grid-cols-12 gap-4">
        <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tools.map((t) => (
          <motion.div key={t.href} variants={fadeUp}>
            <Link href={t.href} className="lift card group flex h-full flex-col p-5">
              <span className="grid size-10 place-items-center rounded-full bg-[var(--deep)] text-white"><t.icon className="size-4" /></span>
              <h2 className="card-title mt-4">{t.title}</h2>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
              <p className="mt-4 flex items-center justify-between text-[0.8125rem] font-medium">{t.meta}<ArrowRight className="nudge size-4 rtl:rotate-180" /></p>
            </Link>
          </motion.div>
        ))}
        </div>

        <motion.section variants={fadeUp} className="card col-span-12 p-5 lg:col-span-7">
          <div className="mb-4 flex items-center justify-between"><h2 className="card-title flex items-center gap-2"><Flame className="size-4 text-[var(--warning)]" />{tx('Due now', 'مستحق الآن')}</h2><Link href="/app/study/flashcards" className="tap-row text-[0.8125rem] text-muted-foreground hover:text-foreground">{tx('All decks', 'كل المجموعات')}</Link></div>
          {decksDue.length ? (
            <ul className="flex flex-col">
              {decksDue.map(({ d, n }) => (
                <li key={d.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <span className="min-w-0 flex-1"><span className="block truncate text-[0.9375rem] font-medium">{d.title}</span><span className="text-xs text-muted-foreground">{d.subject}</span></span>
                  <span className="tabular text-sm text-muted-foreground">{n} {tx('due', 'مستحقة')}</span>
                  <Button size="sm" asChild><Link href={`/app/study/flashcards/${d.id}?mode=study`}>{tx('Study', 'ادرس')}</Link></Button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">{tx('Nothing due. New cards you add show up here straight away.', 'لا شيء مستحق. تظهر البطاقات الجديدة هنا فوراً.')}</p>}
        </motion.section>

        <motion.section variants={fadeUp} className="card col-span-12 p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="card-title flex items-center gap-2"><FileText className="size-4" />{tx('Recent notes', 'أحدث الملاحظات')}</h2><Link href="/app/study/notes" className="tap-row text-[0.8125rem] text-muted-foreground hover:text-foreground">{tx('All notes', 'كل الملاحظات')}</Link></div>
          <ul className="flex flex-col">
            {notes.map((n) => (
              <li key={n.id}><Link href={`/app/study/notes/${n.id}`} className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 transition-colors hover:bg-[var(--bg)]">
                <span className="min-w-0 flex-1"><span className="block truncate text-[0.9375rem]">{n.title || tx('Untitled note', 'ملاحظة بلا عنوان')}</span><span className="text-xs text-muted-foreground">{n.subject} · <Ago ts={n.updatedAt} locale={locale} /></span></span>
              </Link></li>
            ))}
          </ul>
        </motion.section>

        {shaky.length > 0 && (
          <motion.section variants={fadeUp} className="card col-span-12 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="card-title flex items-center gap-2"><Sparkles className="size-4" />{tx('Revise next', 'راجع التالي')}</h2>
              <Button size="sm" variant="secondary" asChild><Link href={`/app/chat?q=${encodeURIComponent(`Make me a revision plan for ${shaky.slice(0, 3).map((t) => t.name).join(', ')}`)}`}>{tx('Ask Murshid for a plan', 'اطلب خطة من مرشد')}</Link></Button></div>
            <div className="flex flex-wrap gap-2">{shaky.map((t) => <span key={t.id} className={cn('rounded-full px-3 py-1.5 text-[0.8125rem]', t.confidence === 0 ? 'tint-danger' : 'tint-warning')}>{t.subject}: {t.name}</span>)}</div>
          </motion.section>
        )}
      </motion.div>
    </Page>
  );
}
