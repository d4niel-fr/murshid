'use client';

import type { ReactNode } from 'react';
import { Eyebrow, Masthead, WeekColumns } from './chrome';
import { Lines, Rise } from './motion';

/**
 * The opening block of every inner page: a navy band with the header, the week columns behind,
 * a big uppercase title and the intro opposite it.
 */
export function PageHero({ eyebrow, lines, intro, aside }: { eyebrow: string; lines: string[]; intro: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mk-band relative isolate flex min-h-[34rem] flex-col overflow-hidden bg-[var(--deep)] text-white">
      <WeekColumns labelTop="6.5rem" />
      <Masthead />
      <div className="mt-auto grid gap-[2.5rem] px-[1.5rem] pb-[2.5rem] pt-[6rem] sm:px-[2.5rem] lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-8">
          <Eyebrow tone="light">{eyebrow}</Eyebrow>
          <h1 className="mk-title mt-[1.5rem] text-[3.75rem] leading-[0.88] sm:text-[7.5rem]">
            <Lines lines={lines} stagger={110} delay={80} from="115%" />
          </h1>
        </div>
        <Rise delay={320} className="lg:col-span-4 lg:text-right">
          <div className="text-[1rem] leading-relaxed text-white/70 lg:ml-auto lg:max-w-[26rem]">{intro}</div>
          {aside && <div className="mt-[1.5rem] lg:flex lg:justify-end">{aside}</div>}
        </Rise>
      </div>
    </section>
  );
}

/** A section heading in the house style: eyebrow, stacked title, optional note opposite. */
export function SectionHead({ eyebrow, lines, note, tone = 'light' }: { eyebrow: string; lines: string[]; note?: ReactNode; tone?: 'light' | 'dark' }) {
  return (
    <div className="flex flex-col gap-[1.5rem] sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Eyebrow tone={tone === 'dark' ? 'light' : 'dark'}>{eyebrow}</Eyebrow>
        <h2 className="mk-h2 mt-[1rem] text-[3rem]"><Lines lines={lines} /></h2>
      </div>
      {note && <div className={`max-w-[26rem] text-[0.875rem] leading-relaxed sm:text-right ${tone === 'dark' ? 'text-white/65' : 'text-[var(--text-muted)]'}`}>{note}</div>}
    </div>
  );
}
