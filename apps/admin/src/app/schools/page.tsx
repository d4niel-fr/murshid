'use client';

import { Building2, Plus } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/shell';
import { Badge, Button, Card, Empty, ErrorBox } from '@/components/ui';
import { api } from '@/lib/api';
import { useData } from '@/lib/use-data';

/* eslint-disable @typescript-eslint/no-explicit-any */
const input = 'h-10 w-full rounded-full border border-[var(--border)] bg-white px-4 text-sm outline-none focus:border-[var(--brand-light)]';

/** Murshid admins: every school, and adding a new one with its first school admin. */
export default function SchoolsPage() {
  const list = useData<{ items: any[] }>('/platform/schools', 'staff');
  const [f, setF] = useState({ name: '', shortName: '', emirate: 'dubai', adminName: '', adminEmail: '', seats: '100', status: 'trial' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<any>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      setMade(await api('/platform/schools', { method: 'POST', as: 'staff', body: { ...f, shortName: f.shortName || undefined, seats: Number(f.seats) } }));
      setF({ ...f, name: '', shortName: '', adminName: '', adminEmail: '' });
      await list.reload();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <>
      <PageHeader title="Schools" sub="Every school on Murshid. Add a school and its first admin: they sign in with that email and set up teachers, students and classes." />
      <ErrorBox error={list.error ?? error} />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card title={<span className="flex items-center gap-2"><Plus className="size-4" />Add a school</span>}>
          <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2">
            <input aria-label="School name" required placeholder="School name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={`${input} sm:col-span-2`} />
            <input aria-label="Short name" placeholder="Short name (e.g. ANA)" value={f.shortName} onChange={(e) => setF({ ...f, shortName: e.target.value })} className={input} />
            <select aria-label="Emirate" value={f.emirate} onChange={(e) => setF({ ...f, emirate: e.target.value })} className={input}><option value="dubai">Dubai</option><option value="abu_dhabi">Abu Dhabi</option><option value="sharjah">Sharjah</option></select>
            <input aria-label="Admin name" required placeholder="School admin's name" value={f.adminName} onChange={(e) => setF({ ...f, adminName: e.target.value })} className={input} />
            <input aria-label="Admin email" required type="email" placeholder="admin@school.ae" value={f.adminEmail} onChange={(e) => setF({ ...f, adminEmail: e.target.value })} className={input} dir="ltr" />
            <input aria-label="Seats" required type="number" min={1} max={20000} value={f.seats} onChange={(e) => setF({ ...f, seats: e.target.value })} className={input} />
            <select aria-label="Licence" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={input}><option value="trial">Trial</option><option value="active">Licensed</option></select>
            <Button type="submit" disabled={busy} className="sm:col-span-2 sm:justify-self-start"><Building2 className="size-4" />Add the school</Button>
          </form>
          {made && <p className="mt-3 rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-3 py-2 text-sm">{made.name} is ready. School code <span className="font-mono">{made.joinCode}</span>. Ask the admin to sign in at /admin with their email.</p>}
        </Card>
        <Card title={`Schools (${list.data?.items.length ?? 0})`} pad={false}>
          {!list.data ? <Empty>Loading…</Empty> : !list.data.items.length ? <Empty>No schools yet.</Empty> : (
            <ul className="divide-y divide-[var(--border)]">
              {list.data.items.map((o: any) => (
                <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0 flex-1"><span className="block font-medium">{o.name}</span><span className="block text-xs text-[var(--text-muted)]">{o.teachers} teachers · {o.students} students · {o.classes} classes · code <span className="font-mono">{o.joinCode ?? '—'}</span></span></span>
                  <Badge tone={o.licence?.status === 'active' ? 'success' : 'neutral'}>{o.licence?.status ?? 'no licence'}</Badge>
                  {!o.real && <Badge>Demo</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
