'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, Award, BookAudio, BookOpenText, Calculator, Mic, FileText, FileUp, Flame, Layers, ListChecks, ListPlus, Lock, PenLine, Play, Presentation, Radio, Sparkles, Timer, Trophy, Video, Wand2, Zap } from 'lucide-react';
import { levelOf } from '@murshid/study';
import { useApp } from '@/components/providers/app-provider';
import { MyMascot, useMascotName } from '@/components/mascot/my-mascot';
import { Page, PageHeader } from '@/components/shared/page';
import { Button } from '@/components/ui/button';
import { fadeUp, stagger } from '@/lib/motion';
import { ACHIEVEMENTS, isDue, study, studyStreak, useStudy, weekFocusMinutes, xpStats } from '@/lib/study';
import { useBoards } from '@/lib/whiteboard';
import { cn } from '@/lib/utils';
import { count, countAr, nAr } from '@/lib/plural';
import { Ago } from '@/components/shared/ago';
import { useNotebooks } from '@/lib/notebook';
import { usePractice } from '@/lib/practice';
import { Subject } from '@/components/shared/subject';

export function StudyHub() {
  const { tx, locale, world } = useApp();
  const s = useStudy();
  const nbs = useNotebooks();
  const boards = useBoards();
  const xp = xpStats(s); const lvl = levelOf(xp.total);
  const name = useMascotName();
  const now = Date.now();
  const due = s.cards.filter((c) => isDue(c, now)).length;
  const streak = studyStreak(s);
  const week = weekFocusMinutes(s.sessions);
  const confident = s.topics.length ? Math.round((s.topics.filter((t) => t.confidence >= 2).length / s.topics.length) * 100) : 0;
  const shaky = s.topics.filter((t) => t.confidence <= 1);
  const decksDue = s.decks.map((d) => ({ d, n: s.cards.filter((c) => c.deckId === d.id && isDue(c, now)).length })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  const practiceState = usePractice();
  const lastRead = practiceState.reading.at(-1);
  const readMeta = lastRead ? tx(`Last: ${lastRead.wcpm} words/min`, `آخر قراءة: ${lastRead.wcpm} كلمة/دقيقة`) : tx('Read aloud', 'اقرأ بصوت عالٍ');
  const mathsDone = practiceState.maths.length;
  const mathsMeta = mathsDone ? tx(`${mathsDone} rounds done`, `${mathsDone} جولات`) : tx('8 skills', '8 مهارات');
  const notes = [...s.notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4);
  const first = world.dashboard.student.firstName;
  // Arabic copy uses the Arabic first name when the student has one
  const firstAr = world.dashboard.student.nameAr?.trim().split(/\s+/)[0] || first;

  const stats: [string, string | number, string][] = [
    [tx('Cards due', 'بطاقات مستحقة'), due, tx('ready to review', 'جاهزة للمراجعة')],
    [tx('Study streak', 'أيام متتالية'), streak, streak === 1 ? tx('day', 'يوم') : tx('days', 'أيام')],
    [tx('Focus this week', 'تركيز هذا الأسبوع'), week, tx('minutes', 'دقيقة')],
    [tx('Topics confident', 'مواضيع متقنة'), `${confident}%`, tx(`of ${count(s.topics.length, 'topic')}`, `من ${nAr(s.topics.length, 'topic', true)}`)],
  ];
  const tools = [
    { href: '/app/study/flashcards', icon: Layers, title: tx('Flashcards', 'البطاقات التعليمية'), body: tx('Spaced repetition: each card comes back just before you would forget it.', 'تكرار متباعد: تعود كل بطاقة قبل أن تنساها مباشرة.'), meta: tx(`${count(s.decks.length, 'deck')} · ${due} due`, `${s.decks.length} مجموعات · ${due} مستحقة`) },
    { href: '/app/study/notes', icon: FileText, title: tx('Notes', 'الملاحظات'), body: tx('Headings, checklists and tables. Saves as you type; turns “term :: meaning” lines into cards.', 'عناوين وقوائم وجداول. تُحفظ أثناء الكتابة؛ وتحوّل سطور «مصطلح :: معنى» إلى بطاقات.'), meta: tx(count(s.notes.length, 'note'), `${s.notes.length} ملاحظات`) },
    { href: '/app/study/notebook', icon: PenLine, title: tx('Notebook', 'الدفتر'), body: tx('Write by hand with a stylus or finger: pen, highlighter, eraser, lined or grid paper.', 'اكتب بخط يدك بالقلم أو الإصبع: قلم وقلم تمييز وممحاة وورق مسطّر أو مربعات.'), meta: tx(count(nbs.notebooks.length, 'notebook'), `${nbs.notebooks.length} دفاتر`) },
    { href: '/app/study/whiteboard', icon: Presentation, title: tx('Whiteboard', 'السبورة'), body: tx('An endless board: draw, add shapes, arrows, sticky notes, text and pictures. Pinch or scroll to zoom.', 'سبورة بلا حدود: ارسم وأضف أشكالاً وأسهماً وملاحظات لاصقة ونصاً وصوراً. كبّر بالقرص أو التمرير.'), meta: tx(count(boards.boards.length, 'board'), `${boards.boards.length} سبورات`) },
    { href: '/app/study/focus', icon: Timer, title: tx('Focus timer', 'مؤقت التركيز'), body: tx('25 minutes on, 5 off. Every session is logged, so you can see your week.', '25 دقيقة عمل و5 راحة. تُسجّل كل جلسة لترى أسبوعك.'), meta: tx(`${week} min this week`, `${nAr(week, 'minute')} هذا الأسبوع`) },
    { href: '/app/study/reader', icon: BookOpenText, title: tx('Immersive Reader', 'القارئ الشامل'), body: tx('Any text, bigger and calmer, read aloud word by word, with line focus and your own colours.', 'أي نص بخط أكبر وأهدأ يُقرأ كلمةً كلمة، مع تركيز السطر وألوانك.'), meta: tx('Read your way', 'اقرأ بطريقتك') },
    { href: '/app/study/reading', icon: BookAudio, title: tx('Reading coach', 'مدرّب القراءة'), body: tx('Read a passage aloud; Murshid follows along and shows words correct per minute and words to practise.', 'اقرأ نصاً بصوت عالٍ؛ يتابعك مرشد ويعرض الكلمات الصحيحة في الدقيقة والكلمات للتدريب.'), meta: readMeta },
    { href: '/app/study/speaking', icon: Mic, title: tx('Speaking coach', 'مدرّب التحدث'), body: tx('Practise a presentation: your pace, filler words, repeats and pauses, with tips.', 'تدرّب على عرض: سرعتك وكلمات الحشو والتكرار والتوقفات مع نصائح.'), meta: tx(`${practiceState.speaking.length} practice talks`, `${practiceState.speaking.length} تدريبات`) },
    { href: '/app/study/maths', icon: Calculator, title: tx('Maths practice', 'تدريب الرياضيات'), body: tx('Ten questions at a time from times tables to equations; the level moves with you and mistakes show the working.', 'عشرة أسئلة من جدول الضرب إلى المعادلات؛ يتغير المستوى معك وتظهر طريقة الحل عند الخطأ.'), meta: mathsMeta },
    { href: '/app/study/topics', icon: ListChecks, title: tx('Topic tracker', 'متتبع المواضيع'), body: tx('Rate each topic from “not started” to “confident” and revise the shaky ones first.', 'قيّم كل موضوع من «لم أبدأ» إلى «متقن» وراجع الضعيفة أولاً.'), meta: tx(`${shaky.length} to revise`, `${shaky.length} للمراجعة`) },
  ];

  return (
    <Page>
      <PageHeader eyebrow={tx('Study tools', 'أدوات الدراسة')} title={tx('Study', 'الدراسة')}
        subtitle={tx('Flashcards, notes, a focus timer and quizzes, all in one place. Everything is saved on this device.', 'بطاقات وملاحظات ومؤقت تركيز واختبارات في مكان واحد. يُحفظ كل شيء على هذا الجهاز.')}
        actions={<><Button variant="secondary" asChild><Link href="/app/study/focus?start=25"><Play />{tx('25-min focus', 'تركيز 25 دقيقة')}</Link></Button><Button asChild><Link href="/app/study/create"><Wand2 />{tx('Create with Murshid', 'أنشئ مع مرشد')}</Link></Button></>} />

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
        <motion.section variants={fadeUp} className="card col-span-12 flex flex-col gap-4 p-5 lg:flex-row lg:items-center">
          <div className="flex items-center gap-4 lg:w-[38%]">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[var(--deep)] text-white"><Wand2 className="size-5" /></span>
            <div><h2 className="card-title">{tx('Create with Murshid', 'أنشئ مع مرشد')}</h2><p className="mt-1 text-sm text-muted-foreground">{tx('Slides, PDFs, notes or a lecture become flashcards and clean notes in seconds.', 'تتحول الشرائح وملفات PDF والملاحظات والمحاضرات إلى بطاقات وملاحظات مرتبة في ثوانٍ.')}</p></div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
            {([['file', FileUp, tx('Upload slides or a PDF', 'ارفع شرائح أو PDF')], ['paste', FileText, tx('Paste text', 'الصق نصاً')], ['import', ListPlus, tx('From Quizlet / Anki', 'من Quizlet / Anki')], ['video', Video, tx('Lecture or video', 'محاضرة أو فيديو')]] as const).map(([from, Icon, label]) => (
              <Link key={from} href={`/app/study/create?from=${from}`} className="flex min-h-14 items-center gap-2.5 rounded-2xl bg-surface px-3.5 text-sm font-medium transition-colors hover:bg-surface-2"><Icon className="size-4 shrink-0" />{label}</Link>
            ))}
            <Link href="/app/study/live" className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-3.5 text-sm font-medium hover:bg-surface sm:col-span-4"><Radio className="size-4" />{tx('Join a live quiz with a code', 'انضم إلى اختبار مباشر برمز')}</Link>
          </div>
        </motion.section>

        <motion.section variants={fadeUp} className="card col-span-12 p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between"><h2 className="card-title flex items-center gap-2"><Zap className="size-4" />{tx(`Level ${lvl.level}`, `المستوى ${lvl.level}`)}</h2><span className="text-xs tabular text-muted-foreground">{xp.total.toLocaleString()} XP</span></div>
          <div className="flex items-center gap-5">
            <GoalRing value={xp.today} goal={xp.goal} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{xp.today >= xp.goal ? tx('Daily goal done!', 'أنجزت هدف اليوم!') : tx(`${xp.goal - xp.today} XP to today’s goal`, `${nAr(xp.goal - xp.today, 'point')} لهدف اليوم`)}</p>
              <p className="mt-1 text-muted-foreground">{tx(`${lvl.need - lvl.into} XP to level ${lvl.level + 1}. Earn XP in Learn, Write, Match, Tests and reviews.`, `${nAr(lvl.need - lvl.into, 'point')} للمستوى ${lvl.level + 1}. اجمع النقاط في التعلم والكتابة والمطابقة والاختبارات والمراجعة.`)}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${(lvl.into / lvl.need) * 100}%` }} /></div>
              <label className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">{tx('Daily goal', 'الهدف اليومي')}
                <select value={xp.goal} onChange={(e) => study.setGoal(Number(e.target.value))} className="rounded-full bg-surface px-2 py-1 text-foreground">{[20, 50, 100, 150, 250].map((g) => <option key={g} value={g}>{g} XP</option>)}</select></label>
            </div>
          </div>
        </motion.section>

        <League week={xp.week} className="col-span-12 lg:col-span-7" />

        <motion.section variants={fadeUp} className="card col-span-12 p-5">
          <h2 className="card-title mb-3 flex items-center gap-2"><Award className="size-4" />{tx('Badges', 'الشارات')} <span className="text-xs font-normal text-muted-foreground">{Object.keys(s.achievements).length}/{ACHIEVEMENTS.length}</span></h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {ACHIEVEMENTS.map((a) => { const got = !!s.achievements[a.key]; return (
              <li key={a.key} title={tx(...a.hint)} className={cn('flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-xs', got ? 'bg-[color-mix(in_oklab,var(--brand)_10%,transparent)]' : 'bg-surface opacity-60')}>
                <span className={cn('grid size-9 place-items-center rounded-full', got ? 'bg-[var(--deep)] text-white' : 'bg-surface-2 text-muted-foreground')}>{got ? <Trophy className="size-4" /> : <Lock className="size-3.5" />}</span>
                <span className="font-medium">{tx(a.en, a.ar)}</span><span className="text-[0.6875rem] text-muted-foreground">{tx(...a.hint)}</span>
              </li>); })}
          </ul>
        </motion.section>

        <div className="col-span-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
                  <span className="min-w-0 flex-1"><span className="block truncate text-[0.9375rem] font-medium">{d.title}</span><span className="text-xs text-muted-foreground"><Subject name={d.subject} /></span></span>
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
                <span className="min-w-0 flex-1"><span className="block truncate text-[0.9375rem]">{n.title || tx('Untitled note', 'ملاحظة بلا عنوان')}</span><span className="text-xs text-muted-foreground"><Subject name={n.subject} /> · <Ago ts={n.updatedAt} locale={locale} /></span></span>
              </Link></li>
            ))}
          </ul>
        </motion.section>

        {shaky.length > 0 && (
          <motion.section variants={fadeUp} className="card col-span-12 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="card-title flex items-center gap-2"><Sparkles className="size-4" />{tx('Revise next', 'راجع التالي')}</h2>
              <Button size="sm" variant="secondary" asChild><Link href={`/app/chat?q=${encodeURIComponent(`Make me a revision plan for ${shaky.slice(0, 3).map((t) => t.name).join(', ')}`)}`}>{tx('Ask Murshid for a plan', 'اطلب خطة من مرشد')}</Link></Button></div>
            <div className="flex flex-wrap gap-2">{shaky.map((t) => <span key={t.id} className={cn('rounded-full px-3 py-1.5 text-[0.8125rem]', t.confidence === 0 ? 'tint-danger' : 'tint-warning')}><Subject name={t.subject} />: {t.name}</span>)}</div>
          </motion.section>
        )}
      </motion.div>
    </Page>
  );
}

function GoalRing({ value, goal }: { value: number; goal: number }) {
  const { tx } = useApp();
  const pct = Math.min(1, value / Math.max(1, goal)); const R = 34; const C = 2 * Math.PI * R;
  return (
    <span className="relative grid size-24 shrink-0 place-items-center" role="img" aria-label={tx(`${value} of ${goal} XP today`, `${value} من ${goal} نقطة اليوم`)}>
      <svg viewBox="0 0 80 80" className="absolute inset-0 -rotate-90"><circle cx="40" cy="40" r={R} fill="none" strokeWidth="8" className="stroke-[var(--surface-2)]" /><circle cx="40" cy="40" r={R} fill="none" strokeWidth="8" strokeLinecap="round" stroke="var(--brand)" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)' }} /></svg>
      <span className="text-center leading-tight"><span className="block text-lg font-semibold tabular">{value}</span><span className="text-[0.6875rem] text-muted-foreground">/ {goal}</span></span>
    </span>
  );
}

/** This week's XP next to classmates (demo classmates; a real school shows its own class). */
function League({ week, className }: { week: number; className?: string }) {
  const { tx, world } = useApp();
  const d = new Date(); const weekNo = Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 86_400_000));
  const dow = ((d.getDay() + 6) % 7) + 1;
  const mates = ['Krish A.', 'Aisha S.', 'Neel B.', 'Riya F.', 'Khalid M.', 'Tara P.', 'Samir Q.'].map((n, i) => {
    let h = (weekNo + 1) * 2654435761 + i * 40503; h = (h ^ (h >>> 13)) >>> 0;
    return { name: n, xp: Math.round(((h % 320) + 40) * (dow / 7)) };
  });
  const me = { name: tx('You', 'أنت'), xp: week, me: true };
  const rows = [...mates.map((m) => ({ ...m, me: false })), me].sort((a, b) => b.xp - a.xp);
  const rank = rows.findIndex((r) => r.me) + 1;
  return (
    <motion.section variants={fadeUp} className={cn('card p-5', className)}>
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="card-title flex items-center gap-2"><Trophy className="size-4" />{tx('Class league this week', 'دوري الصف هذا الأسبوع')}</h2><span className="text-xs text-muted-foreground">{tx(`You are #${rank}`, `ترتيبك ${rank}`)}</span></div>
      <ol className="flex flex-col">
        {rows.slice(0, 6).concat(rank > 6 ? [rows[rank - 1]!] : []).map((r) => {
          const pos = rows.indexOf(r) + 1;
          return (
            <li key={r.name} className={cn('flex items-center gap-3 rounded-[14px] px-2 py-2 text-sm', r.me && 'bg-[color-mix(in_oklab,var(--brand)_10%,transparent)] font-medium')}>
              <span className={cn('grid size-7 place-items-center rounded-full text-xs tabular', pos <= 3 ? 'bg-[var(--deep)] text-white' : 'bg-surface text-muted-foreground')}>{pos}</span>
              <span className="flex-1">{r.me ? `${r.name} (${world.dashboard.student.firstName})` : <bdi>{r.name}</bdi>}</span>
              <span className="tabular text-muted-foreground">{r.xp} XP</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[0.6875rem] text-muted-foreground">{tx('Resets every Monday. Classmates here are demo students.', 'يُعاد كل اثنين. الزملاء هنا طلاب تجريبيون.')}</p>
    </motion.section>
  );
}
