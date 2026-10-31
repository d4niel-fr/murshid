'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Check, Minus } from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { MicrosoftMark } from '@/components/shell/icons';
import { Eyebrow, Footer, MarketingShell, Panel, Pill } from '@/components/marketing/chrome';
import { Letters, Rise, spring } from '@/components/marketing/motion';
import { PageHero } from '@/components/marketing/page-hero';
import { ShareButton } from '@/components/shared/actions';
import { price, yearlySaving, type Billing } from '@/lib/billing';
import { FAQS } from '@/lib/faq';
import { PRICES } from '@/lib/site';
import { cn } from '@/lib/utils';

export function PricingView() {
  const { tx, locale } = useApp();
  const [billing, setBilling] = useState<Billing>('yearly');
  const single = [
    tx('A weekly plan around classes, tests, homework and sport', 'خطة أسبوعية حول الحصص والاختبارات والواجبات والرياضة'),
    tx('Ask Murshid, with “how it worked this out” under every reply', '«اسأل مرشد» مع «كيف توصّل إلى ذلك» تحت كل رد'),
    tx('Flashcards, notes, focus timer, quizzes and topic tracker', 'بطاقات وملاحظات ومؤقت تركيز واختبارات ومتتبع مواضيع'),
    tx('Opportunities matched to the student, applications and CV', 'فرص مناسبة للطالب وطلبات وسيرة ذاتية'),
    tx('Companion mode with a mascot you can customise', 'وضع الرفيق مع تميمة يمكنك تخصيصها'),
    tx('A weekly summary for a parent (opt-in)', 'ملخص أسبوعي لوليّ الأمر (اختياري)'),
  ];
  const school = [
    tx('Murshid for every student, linked to the school', 'مرشد لكل طالب ومرتبط بالمدرسة'),
    tx('Teacher portal: class progress, who needs what, best day for homework', 'بوابة المعلم: تقدّم الصف ومن يحتاج ماذا وأفضل يوم للواجب'),
    tx('Assignments as tasks, built-in forms, Google Forms or Microsoft Forms', 'واجبات كمهام أو نماذج مدمجة أو Google Forms أو Microsoft Forms'),
    tx('Weekly reports that send themselves every Friday', 'تقارير أسبوعية تُرسل تلقائياً كل جمعة'),
    tx('Microsoft 365 sign-in and Teams sync', 'تسجيل الدخول عبر Microsoft 365 ومزامنة Teams'),
    tx('A separate school tenant, admin console and audit log', 'مستأجر مدرسي منفصل ولوحة إدارة وسجل تدقيق'),
  ];
  const rows: [string, boolean, boolean][] = [
    [tx('Weekly planning and Ask Murshid', 'التخطيط الأسبوعي و«اسأل مرشد»'), true, true],
    [tx('Study tools (flashcards, notes, focus, quizzes)', 'أدوات الدراسة (بطاقات وملاحظات وتركيز واختبارات)'), true, true],
    [tx('English and Arabic', 'الإنجليزية والعربية'), true, true],
    [tx('Opportunities, applications and CV', 'الفرص والطلبات والسيرة الذاتية'), true, true],
    [tx('Teacher portal and assignments', 'بوابة المعلم والواجبات'), false, true],
    [tx('Best day for homework and weekly reports', 'أفضل يوم للواجب والتقارير الأسبوعية'), false, true],
    [tx('Microsoft 365 sign-in and Teams sync', 'تسجيل Microsoft 365 ومزامنة Teams'), false, true],
    [tx('Buy online', 'الشراء عبر الإنترنت'), true, false],
  ];
  const faqs = FAQS.filter((f) => f.cat === 'plans');
  const amount = price(billing);

  return (
    <MarketingShell>
      <main>
        <PageHero eyebrow={tx('Plans and pricing · UAE dirhams', 'الخطط والأسعار · بالدرهم الإماراتي')} lines={tx('Two plans|one Murshid', 'خطتان|مرشد واحد').split('|')}
          intro={tx('Buy the Single plan for one student today. Schools license Murshid for every student, set up directly with the school.', 'اشترِ الخطة الفردية لطالب واحد اليوم. وترخّص المدارس مرشد لكل طلابها، ويُجهَّز ذلك مباشرة مع المدرسة.')}
          aside={<ShareButton tone="glass" title={tx('Murshid plans and pricing', 'خطط وأسعار مرشد')} />} />
        <section className="px-[1.5rem] py-[5rem] sm:px-[2.5rem]" aria-labelledby="plans-h">
          <h2 id="plans-h" className="sr-only">{tx('Plans', 'الخطط')}</h2>
          <div className="mb-[2rem] flex flex-wrap items-center justify-between gap-[1rem]">
            <div role="radiogroup" aria-label={tx('Billing period', 'فترة الدفع')} className="inline-flex rounded-full bg-[var(--surface)] p-[0.25rem]">
              {(['monthly', 'yearly'] as Billing[]).map((b) => (
                <button key={b} type="button" role="radio" aria-checked={billing === b} onClick={() => setBilling(b)}
                  className={cn('rounded-full px-[1.25rem] py-[0.625rem] text-[0.875rem] font-medium transition-colors', billing === b ? 'bg-[var(--deep)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]')}>
                  {b === 'monthly' ? tx('Monthly', 'شهري') : tx(`Yearly · save ${yearlySaving()}%`, `سنوي · وفّر ${yearlySaving()}%`)}
                </button>
              ))}
            </div>
            <p className="text-[0.8125rem] text-[var(--text-muted)]">{tx('Prices include VAT. Demo: no card is charged.', 'الأسعار شاملة الضريبة. تجريبي: لا تُخصم أي بطاقة.')}</p>
          </div>
          <div className="grid grid-cols-1 items-stretch gap-[1.25rem] lg:grid-cols-2">
            <Rise y={32} config={spring(180, 26)} className="h-full">
              <article className="relative flex h-full flex-col rounded-[2rem] bg-[var(--surface)] p-[2rem]" aria-labelledby="single-h">
                <div className="flex items-center justify-between"><Eyebrow>{tx('For one student · buy online', 'لطالب واحد · شراء عبر الإنترنت')}</Eyebrow><span className="text-[0.75rem] font-medium tabular-nums text-[var(--text-muted)]">01</span></div>
                <h3 id="single-h" className="mt-[1.5rem] text-[2rem] font-medium tracking-[-0.025em]">{tx('Single', 'الفردية')}</h3>
                <div className="mt-[1.5rem] flex items-baseline gap-[0.5rem]">
                  <span className="text-[1rem] font-medium">{tx('AED', 'درهم')}</span>
                  <span className="mk-figure text-[4.5rem]"><Letters key={amount} text={String(amount)} /></span>
                  <span className="text-[0.875rem] text-[var(--text-muted)]">{billing === 'monthly' ? tx('a month', 'شهرياً') : tx('a year', 'سنوياً')}</span>
                </div>
                <p className="mt-[0.5rem] text-[0.8125rem] text-[var(--text-muted)]">{billing === 'monthly' ? tx(`or AED ${PRICES.singleYearly} a year`, `أو ${PRICES.singleYearly} درهماً سنوياً`) : tx(`AED ${(PRICES.singleYearly / 12).toFixed(2)} a month, billed yearly`, `${(PRICES.singleYearly / 12).toFixed(2)} درهماً شهرياً، يُدفع سنوياً`)}</p>
                <p className="mt-[1.5rem] text-[1rem] leading-relaxed">{tx('For a parent buying for their child, or a student buying for themselves. Everything a student needs to plan and study.', 'لوليّ أمر يشتري لطفله أو طالب يشتري لنفسه. كل ما يحتاجه الطالب للتخطيط والدراسة.')}</p>
                <ul className="mt-[1.5rem] flex flex-col border-t border-[var(--border)]">
                  {single.map((f) => <li key={f} className="flex gap-[0.75rem] border-b border-[var(--border)] py-[0.75rem] text-[0.9375rem]"><span className="mt-[0.5rem] size-1.5 shrink-0 rounded-full bg-[var(--brand)]" />{f}</li>)}
                </ul>
                <div className="mt-auto flex flex-wrap items-center gap-[1rem] pt-[2rem]">
                  <Pill variant="solid" href={`/checkout?plan=single&billing=${billing}`} testid="buy-single">{tx('Get Single', 'احصل على الفردية')}</Pill>
                  <span className="text-[0.8125rem] text-[var(--text-muted)]">{tx('Cancel any time', 'ألغِ في أي وقت')}</span>
                </div>
              </article>
            </Rise>
            <Rise delay={110} y={32} config={spring(180, 26)} className="h-full">
              <article className="relative flex h-full flex-col rounded-[2rem] bg-[var(--deep)] p-[2rem] text-white" aria-labelledby="school-h">
                <div className="flex items-center justify-between"><Eyebrow tone="light">{tx('For schools · set up with us', 'للمدارس · يُجهّز معنا')}</Eyebrow><span className="text-[0.75rem] font-medium tabular-nums text-white/60">02</span></div>
                <h3 id="school-h" className="mt-[1.5rem] text-[2rem] font-medium tracking-[-0.025em]">{tx('School', 'المدرسة')}</h3>
                <div className="mt-[1.5rem] flex items-baseline gap-[0.5rem]">
                  <span className="text-[1rem] font-medium">{tx('AED', 'درهم')}</span>
                  <span className="mk-figure text-[4.5rem]">{PRICES.schoolPerStudent}</span>
                  <span className="text-[0.875rem] text-white/65">{tx('per student / year', 'لكل طالب / سنة')}</span>
                </div>
                <p className="mt-[0.5rem] text-[0.8125rem] text-white/60">{tx('List AED 120–180 by size · pilots available', 'السعر من 120 إلى 180 درهماً حسب الحجم · تتوفر تجارب')}</p>
                <p className="mt-[1.5rem] text-[1rem] leading-relaxed">{tx('Your school licenses Murshid for its students. Teachers post work directly or connect Microsoft 365.', 'ترخّص مدرستك مرشد لطلابها. ينشر المعلمون الواجبات مباشرة أو يربطون Microsoft 365.')}</p>
                <ul className="mt-[1.5rem] flex flex-col border-t border-white/15">
                  {school.map((f) => <li key={f} className="flex gap-[0.75rem] border-b border-white/15 py-[0.75rem] text-[0.9375rem]"><span className="mt-[0.5rem] size-1.5 shrink-0 rounded-full bg-[var(--spark)]" />{f}</li>)}
                </ul>
                <div className="mt-auto pt-[2rem]">
                  <Pill variant="light" href="/survey">{tx('Tell us what your school needs', 'أخبرنا بما تحتاجه مدرستك')}</Pill>
                  <p className="mt-[1rem] text-[0.8125rem] text-white/60">{tx('School plans aren’t sold online: they need the school’s approval and a Microsoft 365 connection.', 'لا تُباع خطط المدارس عبر الإنترنت: فهي تحتاج إلى موافقة المدرسة وربط Microsoft 365.')}</p>
                </div>
              </article>
            </Rise>
          </div>

          <Rise delay={120} className="mt-[3rem]">
            <h2 className="mk-h2 text-[2.25rem]">{tx('Compare plans', 'قارن الخطط')}</h2>
            <div className="mt-[1.5rem] overflow-x-auto rounded-[1.5rem] bg-[var(--surface)]">
              <table className="w-full min-w-[34rem] border-collapse text-[0.9375rem]">
                <caption className="sr-only">{tx('What each plan includes', 'ما تتضمنه كل خطة')}</caption>
                <thead><tr className="border-b border-[var(--border)] text-start text-[0.75rem] uppercase tracking-[0.14em] text-[var(--text-muted)] rtl:tracking-normal"><th scope="col" className="px-[1.5rem] py-[1rem] text-start font-medium">{tx('Feature', 'الميزة')}</th><th scope="col" className="px-[1.5rem] py-[1rem] font-medium">{tx('Single', 'الفردية')}</th><th scope="col" className="px-[1.5rem] py-[1rem] font-medium">{tx('School', 'المدرسة')}</th></tr></thead>
                <tbody>{rows.map(([f, a, b]) => (
                  <tr key={f} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg)]"><th scope="row" className="px-[1.5rem] py-[0.875rem] text-start font-normal">{f}</th>
                    {[a, b].map((v, i) => <td key={i} className="px-[1.5rem] py-[0.875rem] text-center">{v ? <Check className="mx-auto size-4 text-[var(--success)]" aria-label={tx('Included', 'متضمن')} /> : <Minus className="mx-auto size-4 text-[var(--text-muted)]" aria-label={tx('Not included', 'غير متضمن')} />}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          </Rise>

          <div className="mt-[1.25rem] grid gap-[1.25rem] md:grid-cols-2">
            <Rise delay={120}><Panel className="!p-[1.75rem]"><div className="flex items-start gap-[1rem]"><MicrosoftMark className="mt-1 size-5 shrink-0" /><p className="text-[1rem] leading-relaxed"><b className="font-medium">{tx('Works with Microsoft 365.', 'يعمل مع Microsoft 365.')}</b> <span className="text-[var(--text-muted)]">{tx('Staff and students sign in with their school accounts; Teams classes and assignments come in automatically.', 'يسجّل الموظفون والطلاب الدخول بحسابات المدرسة، وتصل صفوف Teams وواجباتها تلقائياً.')}</span></p></div></Panel></Rise>
            <Rise delay={200}><Panel className="!p-[1.75rem]"><p className="text-[1rem] leading-relaxed"><b className="font-medium">{tx('Proposed Grade 11 pilot.', 'تجربة مقترحة للصف 11.')}</b> <span className="text-[var(--text-muted)]">{tx('At a Dubai secondary school, subject to the school’s approval. Not a confirmed partnership. The school in the demo is fictional.', 'في مدرسة ثانوية في دبي، رهناً بموافقة المدرسة. ليست شراكة مؤكدة. والمدرسة في العرض وهمية.')}</span></p></Panel></Rise>
          </div>

          <Rise delay={120} className="mt-[3rem]">
            <h2 className="mk-h2 text-[2.25rem]">{tx('Questions about plans', 'أسئلة عن الخطط')}</h2>
            <div className="mt-[1.5rem] divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {faqs.map((f) => (
                <details key={f.id} className="group py-[1.25rem]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-[1rem] text-[1.125rem] font-medium">{f.q[locale]}<span aria-hidden className="text-[var(--text-muted)] transition-transform group-open:rotate-45">+</span></summary>
                  <p className="mt-[0.75rem] max-w-[60ch] text-[1rem] leading-relaxed text-[var(--text-muted)]">{f.a[locale]}</p>
                </details>
              ))}
            </div>
            <p className="mt-[1.25rem] text-[0.9375rem]"><Link href="/faq" className="mk-link font-medium">{tx('All questions', 'كل الأسئلة')}</Link></p>
          </Rise>
        </section>
      </main>
      <Footer />
    </MarketingShell>
  );
}
