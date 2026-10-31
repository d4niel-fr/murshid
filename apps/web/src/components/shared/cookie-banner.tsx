'use client';

import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';

const KEY = 'murshid:cookie-consent';

/** A simple, honest banner: Murshid only uses essential storage (your settings and demo data). No ads, no trackers. */
export function CookieBanner() {
  const { tx } = useApp();
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) { const t = setTimeout(() => setShow(true), 900); return () => clearTimeout(t); } } catch { /* storage blocked: say nothing */ }
  }, []);
  const accept = () => { try { localStorage.setItem(KEY, JSON.stringify({ essential: true, at: Date.now() })); } catch { /* ignore */ } setShow(false); };
  return (
    <AnimatePresence>
      {show && (
        <motion.div role="region" aria-label={tx('Cookies', 'ملفات تعريف الارتباط')} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
          className="no-print fixed bottom-4 start-4 z-[70] w-[min(calc(100vw-2rem),25rem)] rounded-[24px] bg-popover p-5 shadow-lift">
          <p className="text-[0.9375rem] font-medium">{tx('Just the essentials', 'الضروري فقط')}</p>
          <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted-foreground">
            {tx('Murshid stores your settings and demo progress on this device so the app remembers you. No ads and no tracking cookies.', 'يحفظ مرشد إعداداتك وتقدّمك التجريبي على هذا الجهاز ليتذكّرك التطبيق. لا إعلانات ولا ملفات تتبّع.')}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={accept} className="h-9 rounded-full bg-[var(--deep)] px-4 text-[0.8125rem] font-medium text-white hover:bg-[var(--brand)]">{tx('Got it', 'حسناً')}</button>
            <Link href="/privacy#cookies" className="h-9 rounded-full px-3 py-2 text-[0.8125rem] text-muted-foreground underline-offset-4 hover:underline">{tx('How we use storage', 'كيف نستخدم التخزين')}</Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
