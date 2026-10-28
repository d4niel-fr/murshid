'use client';

import { GraduationCap, KeyRound, School, UserRound } from 'lucide-react';
import { DEFAULT_PREFS, PREFS_COOKIE, serializePrefs } from '@/lib/prefs';

const ADMIN_URL = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MURSHID_ADMIN_URL) || 'http://localhost:3001';

/** Sign in as the flagship student persona: band Grade 11-12, persona demo-ideal, workings shown. */
function openStudent() {
  const prefs = { ...DEFAULT_PREFS, band: 'g11-12' as const, sidebar: 'expanded' as const, persona: 'demo-ideal', showWorkings: true };
  document.cookie = `${PREFS_COOKIE}=${serializePrefs(prefs)}; path=/; max-age=31536000; samesite=lax`;
  window.location.href = '/';
}

export function DemoLogins() {
  const btn = 'card flex h-full w-full flex-col items-start gap-2 p-5 text-start transition-colors hover:bg-surface-2';
  return (
    <section className="mt-8 grid gap-4 md:grid-cols-3" data-testid="demo-logins">
      <button type="button" onClick={openStudent} className={btn} data-testid="demo-student">
        <span className="grid size-10 place-items-center rounded-full bg-[var(--accent-soft)] text-primary"><UserRound className="size-5" /></span>
        <span className="text-base font-semibold">Student: Ahamed Mehta</span>
        <span className="text-sm text-muted-foreground">Grade 11, football and swimming, mid-terms coming up. The student app.</span>
        <span className="mt-auto pt-2 text-sm font-medium text-primary">Open as student &rarr;</span>
      </button>
      <a href={`${ADMIN_URL}/login?demo=teacher`} className={btn} data-testid="demo-teacher">
        <span className="grid size-10 place-items-center rounded-full bg-[var(--accent-soft)] text-primary"><GraduationCap className="size-5" /></span>
        <span className="text-base font-semibold">Teacher: Ms. Sana Thomas</span>
        <span className="text-sm text-muted-foreground">Grade 11 English. Class progress, who needs support, best day for homework, weekly reports.</span>
        <span className="mt-auto pt-2 text-sm font-medium text-primary">Open as teacher &rarr;</span>
      </a>
      <a href={`${ADMIN_URL}/login?demo=admin`} className={btn} data-testid="demo-admin">
        <span className="grid size-10 place-items-center rounded-full bg-[var(--accent-soft)] text-primary"><School className="size-5" /></span>
        <span className="text-base font-semibold">School admin</span>
        <span className="text-sm text-muted-foreground">School &amp; licence, audit log, survey results.</span>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-primary"><KeyRound className="size-3.5" />Needs the admin passcode &rarr;</span>
      </a>
    </section>
  );
}
