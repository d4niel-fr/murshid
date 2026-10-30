'use client';

import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Footer, MarketingShell } from '@/components/marketing/chrome';
import { PageHero } from '@/components/marketing/page-hero';
import { CopyButton, SaveButton, ShareButton } from '@/components/shared/actions';
import { EmptyState } from '@/components/shared/states';
import { FAQ_CATEGORIES, FAQS, type FaqCategory } from '@/lib/faq';
import { cn } from '@/lib/utils';

function Mark({ text, q }: { text: string; q: string }) {
  const terms = q.trim().toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  return <>{text.split(re).map((part, i) => (i % 2 ? <mark key={i} className="rounded bg-[color-mix(in_oklab,var(--brand-light)_30%,transparent)] px-0.5 text-inherit">{part}</mark> : <Fragment key={i}>{part}</Fragment>))}</>;
}

/** Searchable FAQs: type to filter questions and answers, narrow by topic, open any answer by link (#id). */
export function FaqView() {
  const { tx, locale } = useApp();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<'all' | FaqCategory>('all');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('q'); if (fromUrl) setQ(fromUrl);
    const id = window.location.hash.slice(1);
    if (id && FAQS.some((f) => f.id === id)) { setOpen(id); setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'center' }), 200); }
  }, []);
  const list = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return FAQS.filter((f) => (cat === 'all' || f.cat === cat) && terms.every((t) => `${f.q[locale]} ${f.a[locale]} ${f.q.en} ${f.a.en}`.toLowerCase().includes(t)));
  }, [q, cat, locale]);
  const cats = Object.keys(FAQ_CATEGORIES) as FaqCategory[];

  return (
    <MarketingShell>
      <main>
        <PageHero eyebrow={tx('Help centre', 'مركز المساعدة')} lines={tx('Questions,|answered', 'أسئلة|وأجوبة').split('|')}
          intro={tx('Search what Murshid does, the plans, the teacher portal and how student data is handled. Can’t find it? Ask in the app.', 'ابحث عما يفعله مرشد والخطط وبوابة المعلم وطريقة التعامل مع بيانات الطالب. لم تجده؟ اسأل في التطبيق.')}
          aside={<ShareButton tone="glass" title={tx('Murshid FAQ', 'أسئلة مرشد')} />} />
        <section className="px-[1.5rem] py-[4rem] sm:px-[2.5rem]" aria-label={tx('Frequently asked questions', 'الأسئلة الشائعة')}>
          <div className="mx-auto max-w-[56rem]">
            <label className="flex h-[3.5rem] items-center gap-[0.75rem] rounded-full bg-[var(--surface)] px-[1.5rem]">
              <Search className="size-[1.125rem] text-[var(--text-muted)]" /><span className="sr-only">{tx('Search the FAQ', 'ابحث في الأسئلة')}</span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('Search: plans, Arabic, privacy, forms…', 'ابحث: الخطط، العربية، الخصوصية، النماذج…')} className="w-full bg-transparent text-[1rem] outline-none placeholder:text-[var(--text-muted)]" />
              {q && <button type="button" onClick={() => setQ('')} aria-label={tx('Clear search', 'مسح البحث')} className="grid size-8 place-items-center rounded-full hover:bg-[var(--border)]"><X className="size-4" /></button>}
            </label>
            <div role="radiogroup" aria-label={tx('Topic', 'الموضوع')} className="mt-[1.25rem] flex flex-wrap gap-[0.5rem]">
              {(['all', ...cats] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={cat === c} onClick={() => setCat(c)}
                  className={cn('rounded-full px-[1rem] py-[0.5rem] text-[0.8125rem] font-medium transition-colors', cat === c ? 'bg-[var(--deep)] text-white' : 'bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)]')}>
                  {c === 'all' ? tx('All', 'الكل') : FAQ_CATEGORIES[c][locale]}
                </button>
              ))}
            </div>
            <p className="mt-[1.25rem] text-[0.8125rem] text-[var(--text-muted)]" aria-live="polite">{tx(`${list.length} of ${FAQS.length} questions`, `${list.length} من ${FAQS.length} سؤالاً`)}</p>
            {list.length ? (
              <div className="mt-[1rem] divide-y divide-[var(--border)] border-y border-[var(--border)]">
                {list.map((f) => (
                  <details key={f.id} id={f.id} open={open === f.id || Boolean(q.trim())} onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) setOpen(f.id); }} className="group scroll-mt-[6rem] py-[1.25rem]">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-[1rem]">
                      <h2 className="text-[1.125rem] font-medium leading-snug"><Mark text={f.q[locale]} q={q} /></h2>
                      <span aria-hidden className="mt-[0.125rem] grid size-[1.75rem] shrink-0 place-items-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-[0.75rem] max-w-[62ch] text-[1rem] leading-relaxed text-[var(--text-muted)]"><Mark text={f.a[locale]} q={q} /></p>
                    <div className="mt-[1rem] flex flex-wrap items-center gap-[0.5rem]">
                      <span className="me-auto rounded-full bg-[var(--surface)] px-[0.75rem] py-[0.25rem] text-[0.75rem] text-[var(--text-muted)]">{FAQ_CATEGORIES[f.cat][locale]}</span>
                      <CopyButton text={() => `${window.location.origin}/faq#${f.id}`} label={tx('Copy link', 'نسخ الرابط')} />
                      <SaveButton id={`faq:${f.id}`} kind="faq" title={f.q[locale]} href={`/faq#${f.id}`} iconOnly />
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <EmptyState className="mt-[1.5rem]" title={tx('No answers match', 'لا توجد إجابات مطابقة')} action={<Link href={`/app/chat?q=${encodeURIComponent(q)}`} className="rounded-full bg-[var(--deep)] px-[1.25rem] py-[0.625rem] text-[0.875rem] font-medium text-white">{tx('Ask Murshid instead', 'اسأل مرشد بدلاً من ذلك')}</Link>}>
                {tx('Try fewer or different words, or pick “All”.', 'جرّب كلمات أقل أو مختلفة، أو اختر «الكل».')}
              </EmptyState>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </MarketingShell>
  );
}
