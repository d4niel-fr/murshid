'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarCheck, House, Layers, Menu, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { cn } from '@/lib/utils';
import { isActive } from './nav';

/**
 * Phones and small tablets: the four places students go most, in thumb reach, plus More (the full menu).
 * Hidden where the bottom of the screen is the work surface (the chat composer, a notebook page) and while the
 * keyboard is up. It sets --tabbar-h so the page, toasts and floating buttons sit above it.
 */
const HIDE_ON = [/^\/app\/chat/, /^\/app\/study\/notebook\/[^/]+/];

export function TabBar({ onMore }: { onMore: () => void }) {
  const pathname = usePathname() ?? '';
  const { tx } = useApp();
  const [typing, setTyping] = useState(false);
  const hidden = HIDE_ON.some((r) => r.test(pathname));

  useEffect(() => {
    const editable = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) && !(el instanceof HTMLInputElement && /^(checkbox|radio|button|submit|range|color|file)$/.test(el.type));
    const on = (e: FocusEvent) => { if (editable(e.target)) setTyping(true); };
    const off = () => setTimeout(() => setTyping(editable(document.activeElement)), 0);
    document.addEventListener('focusin', on); document.addEventListener('focusout', off);
    return () => { document.removeEventListener('focusin', on); document.removeEventListener('focusout', off); };
  }, []);

  const show = !hidden && !typing;
  useEffect(() => {
    const root = document.documentElement;
    if (show) root.dataset.tabbar = 'on'; else delete root.dataset.tabbar;
    return () => { delete root.dataset.tabbar; };
  }, [show]);

  const items = [
    { href: '/app', label: tx('Home', 'الرئيسية'), Icon: House },
    { href: '/app/planner', label: tx('Today', 'اليوم'), Icon: CalendarCheck },
    { href: '/app/chat', label: tx('Ask', 'اسأل'), Icon: MessageCircle },
    { href: '/app/study', label: tx('Study', 'الدراسة'), Icon: Layers },
  ];

  return (
    <nav aria-label={tx('Quick navigation', 'تنقل سريع')} data-chrome
      className={cn('tab-bar no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[color-mix(in_oklab,var(--bg)_92%,transparent)] backdrop-blur-xl transition-transform duration-200 ease-[cubic-bezier(.22,1,.36,1)] lg:hidden', !show && 'pointer-events-none translate-y-full')}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }} aria-hidden={!show} inert={!show}>
      <ul className="mx-auto flex h-16 max-w-lg items-stretch px-2">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex flex-1">
              <Link href={href} aria-current={active ? 'page' : undefined}
                className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors active:scale-[0.96]', active ? 'text-[var(--deep)] dark:text-[var(--brand-light)]' : 'text-muted-foreground')}>
                <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', active && 'bg-[color-mix(in_oklab,var(--deep)_10%,transparent)]')}><Icon className="size-[18px]" strokeWidth={active ? 2.2 : 1.8} /></span>
                {label}
              </Link>
            </li>
          );
        })}
        <li className="flex flex-1">
          <button type="button" onClick={onMore} className="flex flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium text-muted-foreground active:scale-[0.96]">
            <span className="grid h-7 w-12 place-items-center rounded-full"><Menu className="size-[18px]" strokeWidth={1.8} /></span>
            {tx('More', 'المزيد')}
          </button>
        </li>
      </ul>
    </nav>
  );
}
