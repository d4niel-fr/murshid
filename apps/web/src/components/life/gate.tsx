'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Empty, Page, PageHeader } from '@/components/shared/page';
import { ErrorState, LoadingState } from '@/components/shared/states';
import { SchoolTabs } from './school-tabs';

/** Page frame for the school sections: title, the section pills, and loading / error / no-school states. */
export function SchoolSection<T>({ title, subtitle, actions, load, children, wide }: {
  title: string; subtitle?: ReactNode; actions?: ReactNode; wide?: boolean;
  load: { data: T | null; error: string | null; noSchool: boolean; reload: () => void };
  children: (data: T) => ReactNode;
}) {
  const { tx } = useApp();
  return (
    <Page wide={wide}>
      <PageHeader eyebrow={tx('School', 'المدرسة')} title={title} subtitle={subtitle} actions={actions} />
      <SchoolTabs />
      {load.noSchool ? (
        <Empty action={<Link href="/app/school" className="text-sm font-medium text-primary">{tx('About school accounts', 'عن حسابات المدارس')}</Link>}>
          {tx('This comes with a school account. When your school uses Murshid, your teachers’ timetable, registers, points and reports show up here.', 'يأتي هذا مع حساب المدرسة. عندما تستخدم مدرستك مرشد يظهر هنا الجدول والحضور والنقاط والتقارير.')}
        </Empty>
      ) : load.error && !load.data ? <ErrorState detail={load.error} onRetry={load.reload} />
        : !load.data ? <LoadingState rows={4} /> : children(load.data)}
    </Page>
  );
}

/** Dates in the student's language, Dubai calendar days. */
export const dayLabel = (d: string, locale: 'en' | 'ar', opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-GB', { ...opts, timeZone: 'UTC' });
