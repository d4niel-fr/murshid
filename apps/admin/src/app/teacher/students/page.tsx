'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, GraduationCap, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { PageHeader, useSession } from '@/components/shell';
import { STATUS_TONE } from '@/components/teacher';
import { Badge, Bar, Card, cn, EmptyState, ErrorBox, SkeletonRows, SortHeader } from '@/components/ui';
import { getSession } from '@/lib/api';
import { useData } from '@/lib/use-data';

/* eslint-disable @typescript-eslint/no-explicit-any */

const STATUS_LABEL: Record<string, string> = { at_risk: 'At risk', watch: 'Keep an eye', on_track: 'On track', ahead: 'Ahead' };
type SortKey = 'status' | 'name' | 'completion' | 'grade';
const RANK: Record<string, number> = { at_risk: 0, watch: 1, on_track: 2, ahead: 3 };

/** Every student across the teacher's classes: search, filter by class and status, sort, open a student. */
export default function MyStudents() {
  const router = useRouter();
  const session = useSession();
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!getSession()) router.replace('/login'); else setReady(true); }, [router]);
  const data = useData<any>(ready ? '/teacher/students' : null, 'staff');
  const [q, setQ] = useState('');
  const [cls, setCls] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'status', dir: 'asc' });

  const all: any[] = data.data?.students ?? [];
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = all.filter((s) => (cls === 'all' || s.classes.some((c: any) => c.id === cls)) && (status === 'all' || s.status === status) && (!needle || s.name.toLowerCase().includes(needle) || s.section.toLowerCase().includes(needle)));
    const val = (s: any) => sort.key === 'name' ? s.name : sort.key === 'completion' ? s.completion : sort.key === 'grade' ? s.avgGrade ?? -1 : RANK[s.status];
    return [...list].sort((a, b) => { const x = val(a), y = val(b); const c = x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name); return sort.dir === 'asc' ? c : -c; });
  }, [all, q, cls, status, sort]);
  const by = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  const count = (st: string) => all.filter((s) => (cls === 'all' || s.classes.some((c: any) => c.id === cls)) && s.status === st).length;
  const href = (s: any) => `/teacher/students/${s.id}?class=${cls !== 'all' && s.classes.some((c: any) => c.id === cls) ? cls : s.classes[0].id}`;

  return (
    <>
      <PageHeader title={session?.role === 'school_admin' ? 'Student progress' : 'My students'}
        sub={data.data ? `${all.length} students across ${data.data.classes.length} class${data.data.classes.length === 1 ? '' : 'es'} · worst status first` : 'Every student you teach, in one list'} />
      <ErrorBox error={data.error} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[12rem] flex-1 sm:max-w-xs"><span className="sr-only">Find a student</span>
          <Search className="pointer-events-none absolute inset-y-0 start-3.5 my-auto size-4 text-[var(--text-muted)]" aria-hidden />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student or class group" className="input ps-10" />
        </label>
        <select aria-label="Class" className="input w-full sm:w-auto sm:min-w-[16rem]" value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="all">All classes ({all.length})</option>
          {(data.data?.classes ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.students})</option>)}
        </select>
      </div>
      <div className="tabs-scroll -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Status">
        {['all', 'at_risk', 'watch', 'on_track', 'ahead'].map((s) => (
          <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s}
            className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors', status === s ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]')}>
            {s === 'all' ? 'Everyone' : STATUS_LABEL[s]}{s !== 'all' && <span className={cn('tabular-nums', status === s ? 'text-white/60' : '')}>{count(s)}</span>}
          </button>
        ))}
      </div>

      {data.loading && !data.data ? <Card pad={false}><SkeletonRows rows={6} /></Card> : !rows.length ? (
        <Card><EmptyState icon={<GraduationCap />} title="No student matches">Try another name, or show every class and status.</EmptyState></Card>
      ) : (
        <>
          {/* phones: a list of cards */}
          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((s) => (
              <li key={s.id}>
                <Link href={href(s)} className="card flex items-center gap-3 p-4 active:scale-[0.99]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-xs font-medium">{s.initials}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{s.name}</span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">{s.section} · {s.completion}% handed in{s.avgGrade !== null ? ` · avg ${s.avgGrade}%` : ''}</span>
                  </span>
                  <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                  <ChevronRight className="size-4 shrink-0 text-[var(--text-muted)]" />
                </Link>
              </li>
            ))}
          </ul>
          {/* larger screens: a sortable table */}
          <Card pad={false} className="hidden md:block">
            <table className="tbl">
              <thead><tr>
                <SortHeader label="Student" active={sort.key === 'name'} dir={sort.dir} onSort={() => by('name')} />
                <SortHeader label="Status" active={sort.key === 'status'} dir={sort.dir} onSort={() => by('status')} />
                <th>Classes</th>
                <SortHeader label="Handed in" active={sort.key === 'completion'} dir={sort.dir} onSort={() => by('completion')} />
                <SortHeader label="Average" active={sort.key === 'grade'} dir={sort.dir} onSort={() => by('grade')} />
              </tr></thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="cursor-pointer" onClick={() => router.push(href(s))}>
                    <td><Link href={href(s)} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2.5"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface-2)] text-[11px] font-medium">{s.initials}</span><span><span className="block font-medium">{s.name}</span><span className="text-xs text-[var(--text-muted)]">{s.section}</span></span></Link></td>
                    <td><Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge></td>
                    <td className="text-xs text-[var(--text-muted)]">{s.classes.map((c: any) => c.name.replace(/ \(.*\)$/, '')).join(' · ')}</td>
                    <td className="w-40"><div className="flex items-center gap-2"><Bar value={s.completion} tone={s.completion < 70 ? 'warning' : s.completion >= 95 ? 'success' : 'accent'} /><span className="text-xs tabular-nums">{s.completion}%</span></div></td>
                    <td className="tabular-nums">{s.avgGrade === null ? '—' : `${s.avgGrade}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
