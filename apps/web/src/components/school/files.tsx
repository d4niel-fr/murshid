'use client';

import { Dialog as D } from 'radix-ui';
import { ChevronLeft, ChevronRight, Download, File, FileImage, FileSpreadsheet, FileText, Presentation, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { fileUrl, type FileKind, type FileRef } from '@/lib/school-api';
import { sizeLabel } from '@/lib/upload';
import { cn } from '@/lib/utils';

const ICON: Record<FileKind, typeof File> = { image: FileImage, pdf: FileText, slides: Presentation, doc: FileText, sheet: FileSpreadsheet, text: FileText };
const LABEL: Record<FileKind, [string, string]> = { image: ['Photo', 'صورة'], pdf: ['PDF', 'PDF'], slides: ['Slides', 'شرائح'], doc: ['Document', 'مستند'], sheet: ['Spreadsheet', 'جدول'], text: ['Text', 'نص'] };

/** Files as tappable rows (slides, PDFs, documents) and photos as a thumbnail grid that opens full screen. */
export function Files({ files, onRemove, compact, className }: { files: (FileRef & { preview?: string })[]; onRemove?: (id: string) => void; compact?: boolean; className?: string }) {
  const { tx } = useApp();
  const [open, setOpen] = useState<number | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const photos = files.filter((f) => f.kind === 'image');
  const others = files.filter((f) => f.kind !== 'image');
  if (!files.length) return null;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {photos.length > 0 && (
        <ul className={cn('grid gap-2', compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4')}>
          {photos.map((f, i) => (
            <li key={f.id} className="group relative">
              <button type="button" onClick={(e) => { opener.current = e.currentTarget; setOpen(i); }} className="block aspect-[3/4] w-full overflow-hidden rounded-xl border border-border bg-surface-2" aria-label={tx(`Open photo ${i + 1}: ${f.name}`, `فتح الصورة ${i + 1}`)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.preview ?? fileUrl(f)} alt={f.name} loading="lazy" className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]" />
              </button>
              {onRemove && (
                <button type="button" onClick={() => onRemove(f.id)} aria-label={tx(`Remove ${f.name}`, `إزالة ${f.name}`)} className="hit absolute end-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/75">
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {others.map((f) => {
            const Icon = ICON[f.kind] ?? File;
            return (
              <li key={f.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 px-3 py-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--deep)_9%,transparent)] text-[var(--deep)] dark:text-[var(--brand-light)]"><Icon className="size-4" /></span>
                <a href={fileUrl(f)} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium hover:underline">{f.name}</span>
                  <span className="block text-xs text-muted-foreground">{tx(...LABEL[f.kind])} · {sizeLabel(f.size)}</span>
                </a>
                <a href={fileUrl(f)} download={f.name} aria-label={tx(`Download ${f.name}`, `تنزيل ${f.name}`)} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground"><Download className="size-4" /></a>
                {onRemove && <button type="button" onClick={() => onRemove(f.id)} aria-label={tx(`Remove ${f.name}`, `إزالة ${f.name}`)} className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground"><X className="size-4" /></button>}
              </li>
            );
          })}
        </ul>
      )}
      <Lightbox photos={photos} index={open} onIndex={setOpen} returnFocus={opener} />
    </div>
  );
}

/** Full-screen photo viewer: arrows / swipe-free buttons, Escape closes, pinch-zoom works natively. */
export function Lightbox({ photos, index, onIndex, returnFocus }: { photos: (FileRef & { preview?: string })[]; index: number | null; onIndex: (i: number | null) => void; returnFocus?: React.RefObject<HTMLElement | null> }) {
  const { tx } = useApp();
  const f = index === null ? null : photos[index];
  useEffect(() => {
    if (index === null) return;
    const key = (e: KeyboardEvent) => {
      // in Arabic the next photo is to the left
      const rtl = document.documentElement.dir === 'rtl';
      const next = rtl ? 'ArrowLeft' : 'ArrowRight';
      const prev = rtl ? 'ArrowRight' : 'ArrowLeft';
      if (e.key === next) onIndex(Math.min(photos.length - 1, index + 1));
      if (e.key === prev) onIndex(Math.max(0, index - 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [index, photos.length, onIndex]);
  return (
    <D.Root open={f !== null && f !== undefined} onOpenChange={(o) => !o && onIndex(null)}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-black/85" />
        <D.Content className="fixed inset-0 z-[61] flex flex-col outline-none" aria-describedby={undefined}
          onCloseAutoFocus={(e) => { const el = returnFocus?.current; if (el && document.contains(el)) { e.preventDefault(); el.focus(); } }}>
          <div className="flex items-center gap-3 px-4 py-3 text-white">
            <D.Title className="min-w-0 flex-1 truncate text-sm">{f?.name}{photos.length > 1 && index !== null ? ` · ${index + 1} / ${photos.length}` : ''}</D.Title>
            {f && <a href={fileUrl(f)} download={f.name} className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label={tx('Download', 'تنزيل')}><Download className="size-4" /></a>}
            <D.Close className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label={tx('Close', 'إغلاق')}><X className="size-4" /></D.Close>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f && <img src={f.preview ?? fileUrl(f)} alt={f.name} className="max-h-full max-w-full rounded-lg object-contain" />}
            {index !== null && index > 0 && <button type="button" onClick={() => onIndex(index - 1)} aria-label={tx('Previous photo', 'الصورة السابقة')} className="absolute start-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"><ChevronLeft className="size-5 rtl:rotate-180" /></button>}
            {index !== null && index < photos.length - 1 && <button type="button" onClick={() => onIndex(index + 1)} aria-label={tx('Next photo', 'الصورة التالية')} className="absolute end-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"><ChevronRight className="size-5 rtl:rotate-180" /></button>}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
