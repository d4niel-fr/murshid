'use client';

import { ChevronLeft, ChevronRight, Download, File, FileImage, FileSpreadsheet, FileText, Presentation, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { fileUrl, sizeLabel, type FileKind, type FileRef } from '@/lib/classroom';
import { cn, useFocusTrap } from './ui';

const ICON: Record<FileKind, typeof File> = { image: FileImage, pdf: FileText, slides: Presentation, doc: FileText, sheet: FileSpreadsheet, text: FileText };
const LABEL: Record<FileKind, string> = { image: 'Photo', pdf: 'PDF', slides: 'Slides', doc: 'Document', sheet: 'Spreadsheet', text: 'Text' };

/** Photos as a grid that opens full screen; other files as rows that open or download. */
export function Files({ files, onRemove, compact, className }: { files: FileRef[]; onRemove?: (id: string) => void; compact?: boolean; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const photos = files.filter((f) => f.kind === 'image');
  const others = files.filter((f) => f.kind !== 'image');
  if (!files.length) return null;
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {photos.length > 0 && (
        <ul className={cn('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}>
          {photos.map((f, i) => (
            <li key={f.id} className="group relative">
              <button type="button" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1}: ${f.name}`} className="block aspect-[3/4] w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.preview ?? fileUrl(f)} alt={f.name} loading="lazy" className="size-full object-cover" />
              </button>
              {onRemove && <button type="button" onClick={() => onRemove(f.id)} aria-label={`Remove ${f.name}`} className="absolute end-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white"><X className="size-3.5" /></button>}
            </li>
          ))}
        </ul>
      )}
      {others.map((f) => {
        const Icon = ICON[f.kind] ?? File;
        return (
          <div key={f.id} className="flex items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--deep)_9%,transparent)] text-[var(--deep)]"><Icon className="size-4" /></span>
            <a href={fileUrl(f)} target="_blank" rel="noreferrer" className="min-w-0 flex-1"><span className="block truncate text-sm font-medium hover:underline">{f.name}</span><span className="block text-xs text-[var(--text-muted)]">{LABEL[f.kind]} · {sizeLabel(f.size)}</span></a>
            <a href={fileUrl(f)} download={f.name} aria-label={`Download ${f.name}`} className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)]"><Download className="size-4" /></a>
            {onRemove && <button type="button" onClick={() => onRemove(f.id)} aria-label={`Remove ${f.name}`} className="grid size-9 shrink-0 place-items-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface)]"><X className="size-4" /></button>}
          </div>
        );
      })}
      {open !== null && photos[open] && <Lightbox photos={photos} index={open} onIndex={setOpen} />}
    </div>
  );
}

export function Lightbox({ photos, index, onIndex }: { photos: FileRef[]; index: number; onIndex: (i: number | null) => void }) {
  const f = photos[index]!;
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, true);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); onIndex(null); }
      if (e.key === 'ArrowRight') onIndex(Math.min(photos.length - 1, index + 1));
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
    };
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [index, photos.length, onIndex]);
  return (
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-label={f.name} className="fixed inset-0 z-[60] flex flex-col bg-black/90 outline-none">
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <p className="min-w-0 flex-1 truncate text-sm">{f.name}{photos.length > 1 ? ` · ${index + 1} / ${photos.length}` : ''}</p>
        <a href={fileUrl(f)} download={f.name} aria-label="Download" className="grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20"><Download className="size-4" /></a>
        <button type="button" data-autofocus onClick={() => onIndex(null)} aria-label="Close" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"><X className="size-4" /></button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-4" onClick={(e) => { if (e.target === e.currentTarget) onIndex(null); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.preview ?? fileUrl(f)} alt={f.name} className="max-h-full max-w-full rounded-lg object-contain" />
        {index > 0 && <button type="button" onClick={() => onIndex(index - 1)} aria-label="Previous photo" className="absolute start-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"><ChevronLeft className="size-5" /></button>}
        {index < photos.length - 1 && <button type="button" onClick={() => onIndex(index + 1)} aria-label="Next photo" className="absolute end-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"><ChevronRight className="size-5" /></button>}
      </div>
    </div>
  );
}
