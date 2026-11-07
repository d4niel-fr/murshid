'use client';

import { Dices, Mic, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { micError, useListen } from '@/components/study/use-listen';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, Muted } from '@/components/ui/card';
import { practice, speakingReport, usePractice, words } from '@/lib/practice';
import { cn } from '@/lib/utils';

const TOPICS: [string, string][] = [
  ['Introduce yourself to a new class in one minute.', 'عرّف بنفسك لصف جديد في دقيقة واحدة.'],
  ['Explain how something you love works (a game, a sport, an app).', 'اشرح كيف يعمل شيء تحبه (لعبة أو رياضة أو تطبيق).'],
  ['Should homework be banned? Give two reasons.', 'هل يجب إلغاء الواجبات المنزلية؟ اذكر سببين.'],
  ['Describe a place in the UAE to someone who has never been.', 'صف مكاناً في الإمارات لشخص لم يزره من قبل.'],
  ['Teach the class one thing you learned this week.', 'علّم الصف شيئاً تعلمته هذا الأسبوع.'],
  ['Pitch an idea that would make your school better.', 'اعرض فكرة تجعل مدرستك أفضل.'],
  ['What would you do with a free day and no screens?', 'ماذا ستفعل في يوم فراغ بلا شاشات؟'],
  ['Practise your next presentation: say your opening.', 'تدرّب على عرضك القادم: قل مقدمتك.'],
];

/** Practise a talk: pace, filler words, repeated words and long pauses, with tips. */
export default function SpeakingCoachPage() {
  const { tx, locale } = useApp();
  const history = usePractice().speaking;
  const [lang, setLang] = useState<'en' | 'ar'>(locale);
  const listen = useListen(lang);
  const [topic, setTopic] = useState(0);
  const [startAt, setStartAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [report, setReport] = useState<ReturnType<typeof speakingReport> | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const start = () => {
    setReport(null); listen.start();
    const t0 = Date.now(); setStartAt(t0); setSeconds(0);
    timer.current = setInterval(() => setSeconds(Math.round((Date.now() - t0) / 1000)), 500);
  };
  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    const { text, pauses } = listen.stop();
    const secs = Math.max(1, Math.round((Date.now() - startAt) / 1000));
    const r = speakingReport(text, secs, pauses);
    setReport(r); setStartAt(0);
    if (r.words >= 10) practice.addSpeaking({ title: tx(...TOPICS[topic]!), seconds: secs, words: r.words, wpm: r.wpm, fillers: r.fillerCount, repeats: r.repeats });
  };
  const running = startAt > 0;
  const liveWpm = running && seconds > 5 ? Math.round((words(`${listen.text} ${listen.interim}`).length / seconds) * 60) : null;

  return (
    <Page>
      <PageHeader eyebrow={tx('Study tools', 'أدوات الدراسة')} title={tx('Speaking coach', 'مدرّب التحدث')}
        subtitle={tx('Practise a presentation or an oral answer. Murshid listens for your pace, filler words and pauses, and gives you tips.', 'تدرّب على عرض أو إجابة شفهية. يستمع مرشد لسرعتك وكلمات الحشو والتوقفات ويقدّم لك نصائح.')} />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 grid content-start gap-4 lg:col-span-8">
          <Card className="p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">{tx('Your topic', 'موضوعك')}</p>
              <div className="flex items-center gap-1.5">
                <div role="radiogroup" aria-label={tx('Language', 'اللغة')} className="flex rounded-full bg-surface p-0.5 text-xs">
                  {(['en', 'ar'] as const).map((l) => <button key={l} role="radio" aria-checked={lang === l} disabled={running} onClick={() => setLang(l)} className={cn('h-8 rounded-full px-3', lang === l && 'bg-[var(--bg)] font-medium shadow-sm')}>{l === 'en' ? 'English' : 'العربية'}</button>)}
                </div>
                <Button size="sm" variant="secondary" disabled={running} onClick={() => setTopic((t) => (t + 1 + Math.floor(Math.random() * (TOPICS.length - 1))) % TOPICS.length)}><Dices className="size-4" />{tx('Another', 'آخر')}</Button>
              </div>
            </div>
            <p className="mt-3 text-xl font-medium leading-snug" dir="auto">{lang === 'ar' ? TOPICS[topic]![1] : TOPICS[topic]![0]}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {!running ? <Button onClick={start} disabled={!listen.supported}><Mic className="size-4" />{report ? tx('Try again', 'حاول مجدداً') : tx('Start speaking', 'ابدأ التحدث')}</Button>
                : <Button variant="danger" onClick={stop}><Square className="size-4" />{tx('Stop', 'إيقاف')}</Button>}
              {running && <span className="text-2xl font-medium tabular-nums">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>}
              {liveWpm !== null && <Badge tone={liveWpm > 170 ? 'warning' : liveWpm < 100 ? 'outline' : 'success'}>{tx(`${liveWpm} words/min`, `${liveWpm} كلمة/دقيقة`)}</Badge>}
            </div>
            {!listen.supported && <Muted className="mt-3 text-xs">{tx('This browser cannot listen. Try Chrome, Edge or Safari.', 'لا يستطيع هذا المتصفح الاستماع. جرّب Chrome أو Edge أو Safari.')}</Muted>}
            {listen.error && <p className="mt-3 text-sm text-danger">{micError(listen.error, tx)}</p>}
            {(running || listen.text) && (
              <p dir="auto" className="mt-5 max-h-48 overflow-y-auto rounded-[18px] bg-surface px-4 py-3 text-[0.9375rem] leading-relaxed">{listen.text}<span className="text-muted-foreground"> {listen.interim}</span>{!listen.text && !listen.interim && <span className="text-muted-foreground">{tx('Start talking…', 'ابدأ الحديث…')}</span>}</p>
            )}
          </Card>

          {report && (
            <Card>
              <CardHeader title={tx('Your feedback', 'ملاحظاتك')} />
              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                {[[tx('Words / min', 'كلمة/دقيقة'), report.wpm], [tx('Filler words', 'كلمات حشو'), report.fillerCount], [tx('Repeated words', 'كلمات مكررة'), report.repeats], [tx('Long pauses', 'توقفات طويلة'), report.longPauses]].map(([l, v]) => (
                  <div key={l as string} className="rounded-[18px] bg-surface p-3"><p className="text-2xl font-medium tabular-nums">{v}</p><p className="text-xs text-muted-foreground">{l}</p></div>
                ))}
              </div>
              <ul className="mt-5 grid gap-2.5 text-sm">
                <li>{report.pace === 'good' ? tx('✓ A comfortable pace (110–170 words a minute) that people can follow.', '✓ سرعة مريحة (110–170 كلمة في الدقيقة) يسهل متابعتها.') : report.pace === 'fast' ? tx('Slow down a little: pause after each main point so it lands.', 'تمهّل قليلاً: توقّف بعد كل فكرة رئيسية لتصل.') : tx('A little slow: practise until the words come without searching for them.', 'بطيء قليلاً: تدرّب حتى تأتي الكلمات دون بحث عنها.')}</li>
                {report.fillerCount > 0 ? <li>{tx(`You said ${report.fillers.slice(0, 3).map((f) => `“${f.word}” ×${f.n}`).join(', ')}. Try a silent pause instead: it sounds more confident.`, `قلت ${report.fillers.slice(0, 3).map((f) => `«${f.word}» ×${f.n}`).join('، ')}. جرّب التوقف بصمت بدلاً منها: يبدو ذلك أكثر ثقة.`)}</li> : <li>{tx('✓ No filler words heard. (Some browsers leave out “um” and “uh”.)', '✓ لم نسمع كلمات حشو. (بعض المتصفحات تحذف «امم».)')}</li>}
                {report.repeats > 1 && <li>{tx('Some words came out twice in a row. Knowing your first sentence by heart helps a strong start.', 'تكرّرت بعض الكلمات مرتين متتاليتين. حفظ جملتك الأولى يساعدك على بداية قوية.')}</li>}
                {report.longPauses > 0 && <li>{tx(`Your longest pause was ${report.longestPause} seconds. A short card with three key words keeps you going.`, `أطول توقف كان ${report.longestPause} ثانية. بطاقة صغيرة فيها ثلاث كلمات مفتاحية تساعدك على الاستمرار.`)}</li>}
                {report.words > 40 && <li>{tx(`You used ${report.variety}% different words.`, `استخدمت ${report.variety}٪ كلمات مختلفة.`)} {report.variety < 45 ? tx('Swap a few repeated words for more precise ones.', 'استبدل بعض الكلمات المكررة بكلمات أدق.') : tx('Good range.', 'تنوع جيد.')}</li>}
              </ul>
            </Card>
          )}
        </div>

        <Card className="col-span-12 lg:col-span-4">
          <CardHeader title={tx('Recent practice', 'آخر التدريبات')} />
          {!history.length ? <Muted>{tx('Your practice talks will show here.', 'ستظهر تدريباتك هنا.')}</Muted> : (
            <ul className="divide-y divide-border text-sm">
              {[...history].reverse().slice(0, 8).map((h) => (
                <li key={h.id} className="py-2.5">
                  <p className="truncate font-medium" dir="auto">{h.title}</p>
                  <p className="text-xs text-muted-foreground">{tx(`${h.wpm} words/min · ${h.fillers} fillers · ${Math.round(h.seconds)}s`, `${h.wpm} كلمة/دقيقة · ${h.fillers} حشو · ${Math.round(h.seconds)} ث`)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Page>
  );
}
