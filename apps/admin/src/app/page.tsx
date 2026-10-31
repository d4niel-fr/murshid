'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EntityForm } from '@/components/entity-form';
import { AiStatus, PageHeader } from '@/components/shell';
import { Badge, Bar, Button, Card, Empty, ErrorBox, Modal, Stat } from '@/components/ui';
import { api } from '@/lib/api';
import { studentForm } from '@/lib/forms';
import { useData } from '@/lib/use-data';

export default function StudentsPage() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [grade, setGrade] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useData<{ total: number; items: any[] }>('/admin/students');
  const overview = useData<any>('/admin/overview');
  const items = useMemo(() => (list.data?.items ?? []).filter((s) =>
    (!grade || String(s.grade) === grade) &&
    (!q.trim() || [s.name, s.preferredName, s.school, s.id, ...(s.interests ?? []), ...(s.projects ?? [])].join(' ').toLowerCase().includes(q.trim().toLowerCase()))), [list.data, q, grade]);
  const grades = [...new Set((list.data?.items ?? []).map((s) => s.grade))].sort((a, b) => a - b);

  return (
    <>
      <PageHeader title="Students" sub="Everything you edit here appears in the student app and in Murshid's answers immediately."
        action={<Button onClick={() => setCreating(true)}><Plus className="size-4" />New student</Button>} />
      <ErrorBox error={list.error ?? overview.error} />
      {overview.data && (
        <div className="mb-5 grid grid-cols-4 gap-3">
          <Stat label="Students" value={overview.data.students} sub={Object.entries(overview.data.byGrade).map(([g, n]) => `G${g}: ${n}`).join(' · ')} />
          <Stat label="Assessments next 7 days" value={overview.data.upcomingAssessments7d} />
          <Stat label="Overdue tasks" value={overview.data.overdueTasks} />
          <Stat label="Published opportunities" value={overview.data.catalog.published} sub={`${overview.data.editsToday} edits today`} />
        </div>
      )}
      <div className="mb-5"><AiStatus detailed /></div>
      <Card pad={false} title={<span>All students <span className="font-normal text-[var(--text-muted)]">({items.length})</span></span>}
        action={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-[var(--text-muted)]" />
              <input aria-label="Search students" className="input w-64 pl-8" placeholder="Search name, school, interest, project…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select aria-label="Filter by grade" className="input w-28" value={grade} onChange={(e) => setGrade(e.target.value)}>
              <option value="">All grades</option>
              {grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
        }>
        {list.loading && !list.data ? <Empty>Loading…</Empty> : !items.length ? <Empty>No students match.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Student</th><th>Grade</th><th>School &amp; licence</th><th>Average</th><th>Goals</th><th>Activities</th><th>Projects</th><th>Tasks (week)</th></tr></thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="cursor-pointer" onClick={() => router.push(`/students/${s.id}`)}>
                  <td>
                    <Link href={`/students/${s.id}`} className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-xs font-semibold text-[var(--accent)]">{s.initials}</span>
                      <span>
                        <span className="flex items-center gap-1.5 font-medium">{s.name}{s.flagship && <Star className="size-3.5 fill-[var(--warning)] text-[var(--warning)]" aria-label="Flagship persona" />}</span>
                        <span className="text-xs text-[var(--text-muted)]">{s.id}{s.createdBy === 'admin' ? ' · added by staff' : ''}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{s.classLabel}</td>
                  <td className="max-w-[220px]"><div>{s.school}</div><div className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">{s.licence && <Badge tone={s.licence.type === 'institution' ? 'accent' : 'neutral'}>{s.licence.type === 'institution' ? 'School licence' : s.licence.boughtBy === 'parent' ? 'Family · parent' : 'Family · student'}</Badge>}<span className="truncate">{s.curriculumLabel}</span></div></td>
                  <td className="tabular-nums">{s.average ?? '—'}{s.average !== null && '%'}</td>
                  <td className="w-32">{s.goalsProgress === null ? '—' : <div className="flex items-center gap-2"><Bar value={s.goalsProgress} /><span className="text-xs tabular-nums">{s.goalsProgress}%</span></div>}</td>
                  <td><div className="flex flex-wrap gap-1">{s.activities.map((a: string) => <Badge key={a}>{a}</Badge>)}</div></td>
                  <td>{s.projects.join(', ') || '—'}</td>
                  <td className="whitespace-nowrap">{s.openTasksWeek} open{s.overdue > 0 && <Badge tone="danger" className="ml-1.5">{s.overdue} overdue</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Modal open={creating} title="New student" onClose={() => setCreating(false)} wide>
        <EntityForm def={studentForm} initial={{ curriculum: 'british', emirate: 'dubai', grade: 10, age: 15 }} submitLabel="Create student"
          onCancel={() => setCreating(false)}
          onSubmit={async (data) => { const s = await api('/admin/students', { method: 'POST', body: data }); setCreating(false); router.push(`/students/${s.id}`); }} />
      </Modal>
    </>
  );
}
