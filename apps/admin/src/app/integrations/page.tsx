'use client';

import { CheckCircle2, CircleDashed } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Badge, Card, Empty, ErrorBox } from '@/components/ui';
import { useData } from '@/lib/use-data';

interface Item { id: string; name: string; status: 'live' | 'demo'; what: string; keys: { name: string; set: boolean; optional?: boolean }[] }

/** Murshid admins: which services this deployment runs for real, and which settings are still missing. */
export default function IntegrationsPage() {
  const d = useData<{ items: Item[]; live: number; total: number }>('/admin/integrations');
  return (
    <>
      <PageHeader title="Integrations" sub={d.data ? `${d.data.live} of ${d.data.total} services are live. Each one runs as the demo until its settings are added to the server (see docs/SETUP.md). Values are never shown here.` : 'What this deployment runs for real.'} />
      <ErrorBox error={d.error} />
      {!d.data ? <Empty>Loading…</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">
          {d.data.items.map((i) => (
            <Card key={i.id} title={<span className="flex items-center gap-2">{i.status === 'live' ? <CheckCircle2 className="size-4 text-[var(--success)]" /> : <CircleDashed className="size-4 text-[var(--text-muted)]" />}{i.name}</span>} action={<Badge tone={i.status === 'live' ? 'success' : 'neutral'}>{i.status === 'live' ? 'Live' : 'Demo'}</Badge>}>
              <p className="text-sm text-[var(--text-muted)]">{i.what}</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {i.keys.map((k) => <li key={k.name}><span className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 font-mono text-[11px] ${k.set ? 'bg-[color-mix(in_oklab,var(--success)_14%,transparent)]' : 'bg-[var(--surface-2)] text-[var(--text-muted)]'}`}>{k.set ? '✓' : '○'} {k.name}{k.optional ? ' (optional)' : ''}</span></li>)}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
