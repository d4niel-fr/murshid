'use client';

import type { ReactNode } from 'react';
import { Footer, MarketingShell } from '@/components/marketing/chrome';
import { PageHero } from '@/components/marketing/page-hero';
import { PrintButton, ShareButton } from '@/components/shared/actions';
import { ReadingTime, Toc, useReadingTime } from '@/components/shared/page-aids';

export interface Section { id: string; title: string; body: ReactNode }

/** Long-form marketing page: hero, then sections with a sticky table of contents, reading time, share and print. */
export function LongForm({ eyebrow, lines, intro, sections, updated, after }: { eyebrow: string; lines: string[]; intro: ReactNode; sections: Section[]; updated?: string; after?: ReactNode }) {
  const minutes = useReadingTime('#article');
  return (
    <MarketingShell>
      <main>
        <PageHero eyebrow={eyebrow} lines={lines} intro={intro}
          aside={<div className="flex flex-wrap items-center gap-[0.5rem] lg:justify-end">{minutes && <span className="me-[0.5rem] text-white/70 [&_*]:!text-white/70"><ReadingTime minutes={minutes} /></span>}<ShareButton tone="glass" /><PrintButton tone="glass" /></div>} />
        <div className="grid gap-[3rem] px-[1.5rem] py-[4rem] sm:px-[2.5rem] lg:grid-cols-[15rem_1fr]">
          <aside className="lg:sticky lg:top-[6rem] lg:self-start"><Toc items={sections.map((s) => ({ id: s.id, text: s.title }))} /></aside>
          <article id="article" className="max-w-[44rem]">
            {updated && <p className="mb-[2rem] text-[0.8125rem] text-[var(--text-muted)]">{updated}</p>}
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-[6rem] border-t border-[var(--border)] py-[2.5rem] first:border-0 first:pt-0" aria-labelledby={`${s.id}-h`}>
                <h2 id={`${s.id}-h`} className="mk-h2 text-[2rem] sm:text-[2.25rem]">{s.title}</h2>
                <div className="lf mt-[1.25rem] text-[1.0625rem] leading-[1.75] text-[var(--text-muted)]">{s.body}</div>
              </section>
            ))}
            {after}
          </article>
        </div>
      </main>
      <Footer />
    </MarketingShell>
  );
}
