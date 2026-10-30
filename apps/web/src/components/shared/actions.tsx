'use client';

import { Bookmark, BookmarkCheck, Check, Copy, Printer, Share2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { library, useLibrary, type SavedKind } from '@/lib/library';
import { cn } from '@/lib/utils';

const pill = 'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium transition-colors';
const tones = {
  surface: 'bg-surface text-foreground hover:bg-[color-mix(in_oklab,var(--surface)_80%,var(--text)_7%)]',
  outline: 'border border-border text-foreground hover:border-foreground',
  glass: 'border border-white/15 bg-white/10 text-white hover:bg-white/20',
};
type Tone = keyof typeof tones;

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    // older browsers / insecure origins
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
}

/** Copies `text` (or the page link) and confirms with a tick. */
export function CopyButton({ text, label, tone = 'surface', iconOnly, className }: { text?: string | (() => string); label?: string; tone?: Tone; iconOnly?: boolean; className?: string }) {
  const { tx, toast } = useApp();
  const [done, setDone] = useState(false);
  const run = async () => {
    const value = typeof text === 'function' ? text() : text ?? window.location.href;
    const ok = await copyText(value);
    if (ok) { setDone(true); setTimeout(() => setDone(false), 1600); } else toast({ title: tx('Could not copy', 'تعذّر النسخ'), tone: 'danger' });
  };
  const l = label ?? (text ? tx('Copy', 'نسخ') : tx('Copy link', 'نسخ الرابط'));
  return (
    <button type="button" onClick={run} aria-label={iconOnly ? l : undefined} className={cn(pill, tones[tone], iconOnly && 'w-9 justify-center px-0', className)}>
      {done ? <Check className="size-4 text-[var(--success)]" /> : <Copy className="size-4" />}
      {!iconOnly && <span>{done ? tx('Copied', 'تم النسخ') : l}</span>}
    </button>
  );
}

/** Native share sheet where there is one, otherwise copies the link. */
export function ShareButton({ title, text, url, tone = 'surface', iconOnly, className }: { title?: string; text?: string; url?: string; tone?: Tone; iconOnly?: boolean; className?: string }) {
  const { tx, toast } = useApp();
  const run = async () => {
    const href = url ? new URL(url, window.location.origin).toString() : window.location.href;
    const data = { title: title ?? document.title, text, url: href };
    if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
      try { await navigator.share(data); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    const ok = await copyText(href);
    toast({ title: ok ? tx('Link copied', 'تم نسخ الرابط') : tx('Could not share', 'تعذّرت المشاركة'), description: ok ? tx('Paste it anywhere to share this page.', 'الصقه في أي مكان لمشاركة الصفحة.') : undefined, tone: ok ? 'success' : 'danger' });
  };
  const l = tx('Share', 'مشاركة');
  return (
    <button type="button" onClick={run} aria-label={iconOnly ? l : undefined} className={cn(pill, tones[tone], iconOnly && 'w-9 justify-center px-0', className)}>
      <Share2 className="size-4" />{!iconOnly && <span>{l}</span>}
    </button>
  );
}

/** Save for later: the page (default) or any item; listed on the Saved page. */
export function SaveButton({ id, kind = 'page', title, href, tone = 'surface', iconOnly, className }: { id?: string; kind?: SavedKind; title?: string; href?: string; tone?: Tone; iconOnly?: boolean; className?: string }) {
  const { tx, toast } = useApp();
  const pathname = usePathname();
  const lib = useLibrary();
  const key = id ?? `page:${href ?? pathname}`;
  const saved = lib.saved.some((s) => s.id === key);
  const run = () => {
    const on = library.toggle({ id: key, kind, title: title ?? document.title, href: href ?? `${pathname}${window.location.search}` });
    toast({ title: on ? tx('Saved for later', 'حُفظ لوقت لاحق') : tx('Removed from saved', 'أُزيل من المحفوظات'), tone: on ? 'success' : 'info', action: on ? { label: tx('View saved', 'عرض المحفوظات'), onClick: () => { window.location.href = '/app/saved'; } } : undefined });
  };
  const l = saved ? tx('Saved', 'محفوظ') : tx('Save', 'حفظ');
  return (
    <button type="button" onClick={run} aria-pressed={saved} aria-label={iconOnly ? (saved ? tx('Remove from saved', 'إزالة من المحفوظات') : tx('Save for later', 'حفظ لوقت لاحق')) : undefined}
      className={cn(pill, tones[tone], iconOnly && 'w-9 justify-center px-0', className)}>
      {saved ? <BookmarkCheck className="size-4 text-primary" /> : <Bookmark className="size-4" />}{!iconOnly && <span>{l}</span>}
    </button>
  );
}

export function PrintButton({ tone = 'surface', iconOnly, className }: { tone?: Tone; iconOnly?: boolean; className?: string }) {
  const { tx } = useApp();
  const l = tx('Print', 'طباعة');
  return (
    <button type="button" onClick={() => window.print()} aria-label={iconOnly ? l : undefined} className={cn(pill, tones[tone], iconOnly && 'w-9 justify-center px-0', className)}>
      <Printer className="size-4" />{!iconOnly && <span>{l}</span>}
    </button>
  );
}
