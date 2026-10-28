'use client';

import { useState } from 'react';
import { AuditTable } from '@/components/audit-table';
import { PageHeader } from '@/components/shell';
import { ErrorBox } from '@/components/ui';
import { useData } from '@/lib/use-data';

export default function AuditPage() {
  const [studentId, setStudentId] = useState('');
  const students = useData<{ items: { id: string; name: string }[] }>('/admin/students');
  const log = useData<{ items: any[] }>(`/admin/audit?limit=300${studentId ? `&studentId=${studentId}` : ''}`);
  return (
    <>
      <PageHeader title="Audit log" sub="Every edit by staff and every change Murshid made for a student (tasks, plans, applications, CV packs)."
        action={<select aria-label="Filter by student" className="input w-56" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">All students</option>
          {students.data?.items.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>} />
      <ErrorBox error={log.error} />
      <AuditTable items={log.data?.items ?? []} />
    </>
  );
}
