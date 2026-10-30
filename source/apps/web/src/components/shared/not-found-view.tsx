'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { MyMascot } from '@/components/mascot/my-mascot';

/** 404: the mascot looks for the page with you, with a search and the most useful places to go next. */
export function NotFoundView() {
  const { tx } = useApp();
  const router = useRouter();
  const [q, setQ] = useState('');
  const links: [string, string][] = [['/', tx('Home', 'الرئيسية')], ['/app', tx('Student app', 'تطبيق الطالب')], ['/features', tx('Study tools', 'أدوات الدراسة')], ['/pricing', tx('Pricing', 'الأسعار')], ['/faq', tx('Help and FAQ', 'المساعدة والأسئلة')]];
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[var(--bg)] p-8 text-center">
      <span className="text-[var(--deep)]"><MyMascot size={128} mood="thinking" /></span>
      <p className="eyebrow">404</p>
      <h1 className="display text-[2.25rem] sm:text-[2.75rem]">{tx('We couldn’t find that page', 'لم نجد هذه الصفحة')}</h1>
      <p className="max-w-[44ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{tx('It may have moved, or the link has a typo. Search the help centre, or pick a place to go.', 'ربما نُقلت أو في الرابط خطأ. ابحث في مركز المساعدة أو اختر وجهة.')}</p>
      <form onSubmit={(e) => { e.preventDefault(); router.push(q.trim() ? `/faq?q=${encodeURIComponent(q.trim())}` : '/faq'); }} className="flex h-12 w-full max-w-md items-center gap-2 rounded-full bg-surface ps-4 pe-1.5">
        <Search className="size-4 text-muted-foreground" /><label className="sr-only" htmlFor="nf-q">{tx('Search help', 'ابحث في المساعدة')}</label>
        <input id="nf-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx('Search help…', 'ابحث في المساعدة…')} className="w-full bg-transparent text-sm outline-none" />
        <button type="submit" className="h-9 rounded-full bg-[var(--deep)] px-4 text-sm font-medium text-white">{tx('Search', 'بحث')}</button>
      </form>
      <nav aria-label={tx('Popular pages', 'صفحات شائعة')} className="flex flex-wrap justify-center gap-2">
        {links.map(([href, label]) => <Link key={href} href={href} className="rounded-full border border-border px-4 py-2 text-sm hover:border-foreground">{label}</Link>)}
      </nav>
    </main>
  );
}
