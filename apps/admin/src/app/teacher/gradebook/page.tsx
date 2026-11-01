'use client';

import { useRouter } from 'next/navigation';
import { Download } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { PageHeader } from '@/components/shell';
import { Button, Card, cn, ErrorBox, SkeletonRows } from '@/components/ui';
import { API_BASE, getAdminPasscode, getSession } from '@/lib/api';
import { useData } from '@/lib/use-data';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Every student and assignment in a class: grades, late and missing work, and a CSV for Excel. */
function Gradebook() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cls, setCls] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!getSession()) { router.replace('/login'); return; }
    setCls(new URLSearchParams(window.location.search).get('class')); setReady(true);
  }, [router]);
  const me = useData<any>(ready ? '/teacher/me' : null, 'staff');
  const id = cls ?? me.data?.classes?.[0]?.id ?? null;
  const book = useData<any>(id ? `/teacher/classes/${id}/gradebook` : null, 'staff');
  const pick = (x: string) => { setCls(x); const u = new URL(window.location.href); u.searchParams.set('class', x); window.history.replaceState(null, '', u); };
  const download = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${API_BASE}/teacher/classes/${id}/gradebook?format=csv`, { headers: { ...(getSession()?.headers ?? {}), ...(getAdminPasscode() ? { 'x-admin-passcode': getAdminPasscode()! } : {}) } });
      if (!res.ok) throw new Error(`Could not export (HTTP ${res.status}).`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = `${id}-gradebook.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const cell = (c: any) => c.state === 'not_assigned' ? <span className="text-[var(--text-muted)]">–</span>
    : c.grade !== null ? <span className={cn('tabular-nums', c.grade < 50 && 'text-[var(--danger)]', c.late && 'underline decoration-[var(--warning)] decoration-2 underline-offset-4')}>{c.grade}</span>
      : c.state === 'missing' ? <span className="text-xs font-medium text-[var(--danger)]">Missing</span>
        : c.state === 'handed_in' ? <span className="text-xs text-[var(--success)]">In</span>
          : c.state === 'returned' ? <span className="text-xs text-[var(--warning)]">Returned</span> : <span className="text-[var(--text-muted)]">·</span>;
  return (
    <>
      <PageHeader title="Gradebook" sub={book.data ? `${book.data.class.name} · ${book.data.rows.length} students · ${book.data.columns.length} assignments` : 'Grades for every student and assignment'}
        action={<Button variant="outline" onClick={() => void download()} disabled={!id || busy}><Download />{busy ? 'Exporting…' : 'Download for Excel'}</Button>} />
      <div className="tabs-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Class">
        {(me.data?.classes ?? []).map((c: any) => (
          <button key={c.id} role="tab" aria-selected={c.id === id} onClick={() => pick(c.id)} className={cn('shrink-0 rounded-2xl border px-4 py-2 text-start', c.id === id ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-[var(--border)] hover:bg-[var(--surface)]')}>
            <span className="block text-sm font-medium">{c.name}</span><span className={cn('block text-xs', c.id === id ? 'text-white/70' : 'text-[var(--text-muted)]')}>{c.students} students</span>
          </button>
        ))}
      </div>
      <ErrorBox error={err ?? book.error ?? me.error} />
      {!book.data ? <Card pad={false}><SkeletonRows rows={8} /></Card> : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="tbl min-w-max">
              <thead><tr>
                <th className="sticky start-0 z-10 bg-[var(--popover)]">Student</th>
                <th className="text-end">Average</th>
                {book.data.columns.map((c: any) => (
                  <th key={c.id} className="max-w-[9rem] text-center align-bottom"><Link href={`/teacher/assignments/${encodeURIComponent(c.id)}?class=${id}`} className="line-clamp-2 block text-xs font-medium normal-case tracking-normal hover:underline" title={c.title}>{c.title}</Link><span className="block text-[11px] font-normal normal-case tracking-normal">due {c.dueLabel}</span></th>
                ))}
              </tr></thead>
              <tbody>
                {book.data.rows.map((r: any) => (
                  <tr key={r.studentId}>
                    <td className="sticky start-0 z-10 whitespace-nowrap bg-[var(--popover)]"><span className="font-medium">{r.name}</span> <span className="text-xs text-[var(--text-muted)]">{r.section}</span>{r.missing > 0 && <span className="ms-2 text-xs text-[var(--danger)]">{r.missing} missing</span>}</td>
                    <td className="text-end font-medium tabular-nums">{r.average === null ? '—' : `${r.average}%`}</td>
                    {r.cells.map((c: any, i: number) => <td key={i} className="text-center">{cell(c)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--text-muted)]">Grades are percentages. Underlined: handed in late. Click an assignment to review it.</p>
        </Card>
      )}
    </>
  );
}

export default function GradebookPage() {
  return <Suspense fallback={<SkeletonRows rows={8} />}><Gradebook /></Suspense>;
}
