'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Star3D } from '@/components/brand/star-3d';
import { Dots, Masthead, Pill, PlayMark, Shot, WeekColumns, usePage } from '@/components/marketing/chrome';
import { EASE, Lines, Rise, spring, useReady, useScrub } from '@/components/marketing/motion';
import { TEACHER_DEMO_URL, openStudent } from '@/lib/demo';
import { useApp } from '@/components/providers/app-provider';

/** The giant title: each word slides up from behind its own edge once the loader lifts. */
function Title({ text }: { text: string }) {
  const ready = useReady();
  const reduce = useReducedMotion();
  const words = text.split(' ');
  return (
    <h1 id="hero-title" aria-label={text} className="mk-title whitespace-nowrap text-[10.2vw] sm:text-[11.6vw]">
      {words.map((w, i) => (
        <span key={`${i}-${w}`} aria-hidden className="inline-block overflow-hidden pb-[0.04em] align-top">
          <motion.span className="inline-block" initial={reduce ? false : { y: '115%', opacity: 0 }} animate={ready || reduce ? { y: '0%', opacity: 1 } : { y: '115%', opacity: 0 }}
            transition={{ duration: 1.1, ease: EASE.outExpo, delay: i * 0.14 }}>
            {w}{i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </h1>
  );
}

type T = [en: string, ar: string];
const SLIDES: { img: string; focus: string; brand: T; title: T; cta: T; alt: T; go: string }[] = [
  { img: '/shots/m-chat.jpg', focus: '50% 30%', brand: ['Ask Murshid', 'اسأل مرشد'], title: ['Plan my week', 'خطّط أسبوعي'], cta: ['Try it', 'جرّبه'], alt: ['Murshid chat answering “plan my week”', 'محادثة مرشد تجيب عن «خطّط أسبوعي»'], go: 'demo' },
  { img: '/shots/d-bestday.jpg', focus: '64% 30%', brand: ['Teacher portal', 'بوابة المعلم'], title: ['Best day for homework', 'أفضل يوم للواجب'], cta: ['See it', 'شاهده'], alt: ['The best day to set homework, 83% likely on time', 'أفضل يوم لإعطاء الواجب، باحتمال تسليم في الموعد 83%'], go: TEACHER_DEMO_URL },
  { img: '/shots/m-planner.jpg', focus: '50% 20%', brand: ['Student app', 'تطبيق الطالب'], title: ['The week, planned', 'الأسبوع، مخطّطًا'], cta: ['Open it', 'افتحه'], alt: ['Ahamed’s planner for the week', 'مخطط أحمد للأسبوع'], go: 'student' },
];

/** Three glass cards that take turns: what you can open from here. */
function Showcase() {
  const ready = useReady();
  const { open } = usePage();
  const { tx } = useApp();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => setI((v) => (v + 1) % SLIDES.length), 3800);
    return () => clearInterval(t);
  }, [ready]);
  const s = SLIDES[i]!;
  const act = () => (s.go === 'demo' ? open('demo') : s.go === 'student' ? openStudent() : (window.location.href = s.go));
  return (
    <Rise gate={ready} delay={650} y={28} margin="0px" config={spring(200, 26)} className="hidden w-[16rem] flex-col gap-[0.75rem] md:flex">
      <div className="relative h-[5.5rem]">
        <AnimatePresence initial={false}>
          <motion.div key={i} className="mk-glass absolute inset-0 flex gap-[0.75rem] p-[0.75rem]"
            initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10, scale: 0.98 }} transition={spring(210, 24)}>
            <Shot src={s.img} alt={tx(...s.alt)} focus={s.focus} className="size-[3.5rem] shrink-0 !rounded-[0.75rem]" eager />
            <div className="flex min-w-0 flex-col justify-between">
              <div>
                <p className="text-[0.7rem] font-medium uppercase tracking-[0.12em] rtl:tracking-normal">{tx(...s.brand)}</p>
                <p className="truncate text-[0.7rem] uppercase opacity-80">{tx(...s.title)}</p>
              </div>
              <button type="button" onClick={act} className="w-max text-[0.65rem] uppercase underline underline-offset-2">{tx(...s.cta)} <span className="inline-block rtl:-scale-x-100">→</span></button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
      <Dots count={SLIDES.length} active={i} onPick={setI} tone="light" />
    </Rise>
  );
}

export function Hero() {
  const { open } = usePage();
  const { tx } = useApp();
  const ready = useReady();
  const ref = useRef<HTMLElement>(null);
  const drift = useScrub(ref, ['0%', '18%'], ['start start', 'end start']);
  return (
    <section ref={ref} id="top" className="mk-band relative isolate flex h-[calc(100svh-1rem)] min-h-[36rem] flex-col overflow-hidden bg-[var(--deep)] text-white sm:h-[calc(100svh-1.5rem)]">
      <WeekColumns labelTop="calc(5.5rem + 11.5vw)" />
      {/* the mark, as an object, drifting a little as you scroll */}
      <motion.div style={{ y: drift }} className="pointer-events-none absolute left-1/2 top-[10rem] -z-10 w-[min(17rem,calc(100svh-26rem))] -translate-x-1/2 sm:left-[44%] sm:top-[calc(4rem+11vw)] sm:w-[28rem]">
        <Rise gate={ready} delay={250} y="3rem" scale={0.9} margin="0px" config={spring(90, 22)}>
          <Star3D className="aspect-square w-full" />
        </Rise>
      </motion.div>

      <Masthead />
      <div className="px-[1.5rem] pt-[1rem] sm:px-[2.5rem]"><Title text={tx('Own the week', 'امتلك أسبوعك')} /></div>

      <div className="mt-auto flex flex-col gap-[1.5rem] px-[1.5rem] pb-[2rem] sm:flex-row sm:items-end sm:justify-between sm:px-[2.5rem] sm:pb-[2.5rem]">
        <div>
          <p className="mk-title text-[2.4rem] leading-[0.95] text-white/85"><Lines key={tx('en', 'ar')} lines={[tx('Ask once,', 'اسأل مرة،'), tx('plan the week', 'وخطّط الأسبوع')]} delay={350} stagger={110} gate={ready} from="115%" margin="0px" /></p>
          <Rise gate={ready} delay={560} y={16} margin="0px" className="mt-[1.5rem] flex flex-wrap items-center gap-[0.75rem]">
            <Pill variant="light" onClick={() => open('demo')} testid="hero-demo">{tx('Open the demo', 'افتح العرض')}</Pill>
            <Pill variant="glass" arrow={false} onClick={() => open('video')} icon={<PlayMark tone="light" className="-ms-[0.75rem] size-[1.75rem]" />}>{tx('Watch · 01:53', 'شاهد · 01:53')}</Pill>
          </Rise>
        </div>
        <div className="flex items-end gap-[1rem]">
          <Showcase />
          <Rise as="article" gate={ready} delay={780} y={28} margin="0px" config={spring(200, 26)} className="mk-glass hidden w-full max-w-[20rem] items-stretch gap-[0.75rem] p-[0.75rem] sm:flex sm:w-[15rem]">
            <div className="flex flex-1 flex-col justify-between gap-[0.75rem]">
              <p className="mk-figure text-[1.875rem]">30</p>
              <div className="flex -space-x-2" aria-hidden>
                {['#5790e6', '#c2e029', '#0b6e97', '#ffffff'].map((c) => <span key={c} className="size-[1.25rem] rounded-full border border-[rgb(15_47_99/0.4)]" style={{ background: c }} />)}
              </div>
              <p className="text-[0.65rem] leading-snug opacity-80">{tx('Students replanned when a teacher posts work', 'طالبًا يُعاد تخطيط أسبوعهم عندما ينشر المعلم واجبًا')}</p>
            </div>
            <Shot src="/shots/m-home.jpg" alt={tx('Ahamed’s home screen on a phone', 'شاشة أحمد الرئيسية على الهاتف')} focus="top" className="aspect-[3/4] w-[4rem] shrink-0 !rounded-[0.75rem]" eager />
          </Rise>
        </div>
      </div>
    </section>
  );
}
