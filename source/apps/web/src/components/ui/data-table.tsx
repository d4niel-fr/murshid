'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { cn } from '@/lib/utils';

/**
 * Interactive table: click a header to sort (again to reverse), type to filter, rows page in 10s.
 * Headers carry aria-sort, so screen readers announce the order.
 */
export interface Column<T> {
  key: string; header: string;
  cell: (row: T) => ReactNode;
  /** value used for sorting and filtering (defaults to the cell text when it is a string) */
  value?: (row: T) => string | number;
  align?: 'start' | 'end'; className?: string; sortable?: boolean;
}

export function DataTable<T>({ rows, columns, rowKey, initialSort, filterPlaceholder, pageSize = 10, empty, caption, onRowClick }: {
  rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; initialSort?: { key: string; dir: 'asc' | 'desc' };
  filterPlaceholder?: string; pageSize?: number; empty?: ReactNode; caption?: string; onRowClick?: (row: T) => void;
}) {
  const { tx } = useApp();
  const [sort, setSort] = useState(initialSort ?? null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const val = (c: Column<T>, r: T) => (c.value ? c.value(r) : (() => { const v = c.cell(r); return typeof v === 'string' || typeof v === 'number' ? v : ''; })());
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle ? rows.filter((r) => columns.some((c) => String(val(c, r)).toLowerCase().includes(needle))) : rows;
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) out = [...out].sort((a, b) => { const x = val(col, a); const y = val(col, b); const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y)); return sort.dir === 'asc' ? r : -r; });
    }
    return out;
  }, [rows, columns, q, sort]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = shown.slice(cur * pageSize, cur * pageSize + pageSize);
  const toggle = (key: string) => { setPage(0); setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null)); };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-full bg-surface px-4">
        <Search className="size-4 text-muted-foreground" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder={filterPlaceholder ?? tx('Filter…', 'تصفية…')} aria-label={filterPlaceholder ?? tx('Filter the table', 'تصفية الجدول')}
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        <span className="shrink-0 text-xs text-muted-foreground tabular">{shown.length}</span>
      </div>
      <div className="overflow-x-auto rounded-[var(--radius)] bg-surface">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border">
              {columns.map((c) => {
                const on = sort?.key === c.key; const can = c.sortable !== false;
                return (
                  <th key={c.key} scope="col" aria-sort={on ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('px-4 py-3 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-muted-foreground rtl:tracking-normal', c.align === 'end' ? 'text-end' : 'text-start')}>
                    {can ? (
                      <button type="button" onClick={() => toggle(c.key)} className={cn('inline-flex items-center gap-1 uppercase hover:text-foreground', on && 'text-foreground')}>
                        {c.header}{on ? (sort!.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : c.header}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slice.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('border-b border-border last:border-0 transition-colors hover:bg-[var(--bg)]', onRowClick && 'cursor-pointer')}>
                {columns.map((c) => <td key={c.key} className={cn('px-4 py-3 align-top', c.align === 'end' && 'text-end tabular', c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!slice.length && <div className="px-4 py-10 text-center text-sm text-muted-foreground">{empty ?? tx('Nothing matches that filter.', 'لا شيء يطابق التصفية.')}</div>}
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} className="h-8 rounded-full px-3 text-muted-foreground hover:bg-surface disabled:opacity-40">{tx('Previous', 'السابق')}</button>
          <span className="tabular text-muted-foreground">{cur + 1} / {pages}</span>
          <button type="button" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="h-8 rounded-full px-3 text-muted-foreground hover:bg-surface disabled:opacity-40">{tx('Next', 'التالي')}</button>
        </div>
      )}
    </div>
  );
}
