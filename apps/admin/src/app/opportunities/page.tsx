'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { EntityForm } from '@/components/entity-form';
import { PageHeader } from '@/components/shell';
import { Badge, Button, Card, Empty, ErrorBox, Modal } from '@/components/ui';
import { api } from '@/lib/api';
import { opportunityForm } from '@/lib/forms';
import { useData } from '@/lib/use-data';

export default function OpportunitiesPage() {
  const cat = useData<{ items: any[] }>('/admin/opportunities');
  const students = useData<{ items: { id: string; name: string }[] }>('/admin/students');
  const [editing, setEditing] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const names = new Map((students.data?.items ?? []).map((s) => [s.id, s.name]));
  const def = opportunityForm(students.data?.items ?? []);
  const save = async (b: any) => {
    if (editing?.id) await api(`/admin/opportunities/${editing.id}`, { method: 'PATCH', body: { title: b.title, organizer: b.organizer, type: b.type, deadline: b.deadline, costAed: b.costAed, tags: b.tags, why: b.why, status: b.status, minGrade: b.minGrade, maxGrade: b.maxGrade, audience: b.audience } });
    else await api('/admin/opportunities', { method: 'POST', body: b });
    setEditing(null);
    await cat.reload();
  };
  return (
    <>
      <PageHeader title="Opportunities" sub="Publish competitions, programmes and internships. Students in the audience see them at the top of their feed, and Murshid's scout recommends them."
        action={<Button onClick={() => setEditing({})}><Plus className="size-4" />New opportunity</Button>} />
      <ErrorBox error={cat.error ?? error} />
      <Card pad={false}>
        {!cat.data?.items.length ? <Empty>Nothing published yet. Seeded demo opportunities are matched per student; see a student’s Opportunities tab.</Empty> : (
          <table className="tbl"><thead><tr><th>Opportunity</th><th>Type</th><th>Deadline</th><th>Audience</th><th>Reaches</th><th>Status</th><th /></tr></thead><tbody>
            {cat.data.items.map((o) => (
              <tr key={o.id}>
                <td><div className="font-medium">{o.title}</div><div className="text-xs text-[var(--text-muted)]">{o.organizer} · {o.why}</div></td>
                <td>{o.type}</td><td className="tabular-nums">{o.deadline}</td>
                <td className="text-xs">{o.audience.studentIds === 'all' ? `Grades ${o.audience.minGrade}–${o.audience.maxGrade}` : o.audience.studentIds.map((id: string) => names.get(id) ?? id).join(', ')}</td>
                <td className="text-xs">{o.reach.map((id: string) => names.get(id) ?? id).join(', ') || '—'}</td>
                <td><Badge tone={o.status === 'published' ? 'success' : o.status === 'closed' ? 'danger' : 'neutral'}>{o.status}</Badge></td>
                <td className="whitespace-nowrap text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ ...o, audienceIds: o.audience.studentIds === 'all' ? '' : o.audience.studentIds })}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => { if (window.confirm(`Delete ${o.title}?`)) void api(`/admin/opportunities/${o.id}`, { method: 'DELETE' }).then(cat.reload).catch((e) => setError(e.message)); }}>Delete</Button>
                </td>
              </tr>
            ))}
          </tbody></table>
        )}
      </Card>
      <Modal open={Boolean(editing)} title={editing?.id ? 'Edit opportunity' : 'New opportunity'} onClose={() => setEditing(null)} wide>
        {editing && <EntityForm def={def} initial={editing.id ? editing : { type: 'competition', minGrade: 9, maxGrade: 12, costAed: 0, status: 'published' }} submitLabel={editing.id ? 'Save' : 'Publish'} onCancel={() => setEditing(null)} onSubmit={save} />}
      </Modal>
    </>
  );
}
