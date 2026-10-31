'use client';

import { Building2, CheckCircle2, Home, Link2, RefreshCw, Users } from 'lucide-react';
import { useState } from 'react';
import { MicrosoftMark, PageHeader } from '@/components/shell';
import { Badge, Button, Card, Empty, ErrorBox } from '@/components/ui';
import { api } from '@/lib/api';
import { useData } from '@/lib/use-data';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ORG = 'demo-school';
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dubai' }) : '\u2014');

export default function SchoolPage() {
  const org = useData<any>(`/orgs/${ORG}`);
  const lic = useData<any>('/licensing/overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connect = async (on: boolean) => {
    setBusy(true); setError(null);
    try { await api(`/orgs/${ORG}/microsoft/${on ? 'connect' : 'disconnect'}`, { method: 'POST' }); await org.reload(); await lic.reload(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const o = org.data;
  const ms = o?.microsoft;
  return (
    <>
      <PageHeader title="School & licence" sub="How your school gets Murshid, and how it connects to Microsoft 365." />
      <ErrorBox error={org.error ?? lic.error ?? error} />
      {!o ? <Empty>Loading…</Empty> : (
        <div className="space-y-4">
          <div className="grid grid-cols-[1.1fr_1fr] gap-4">
            <Card title={<span className="flex items-center gap-2"><Building2 className="size-4" />{o.name}</span>} action={<Badge tone="accent">Institution licence</Badge>}>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div><dt className="eyebrow eyebrow-plain">Group</dt><dd className="mt-0.5">{o.group?.name}</dd></div>
                <div><dt className="eyebrow eyebrow-plain">Licence</dt><dd className="mt-0.5">Murshid for Schools &middot; <span className="capitalize">{o.licence.status === 'pilot' ? 'proposed pilot (demo tenant)' : o.licence.status}</span></dd></div>
                <div><dt className="eyebrow eyebrow-plain">Price</dt><dd className="mt-0.5">AED {o.licence.priceAed} per student per year</dd></div>
                <div><dt className="eyebrow eyebrow-plain">Term</dt><dd className="mt-0.5">{o.licence.startDate} &rarr; {o.licence.endDate}</dd></div>
                <div><dt className="eyebrow eyebrow-plain">Seats</dt><dd className="mt-0.5 tabular-nums">{o.usage.rosterStudents} of {o.usage.seats} students</dd></div>
                <div><dt className="eyebrow eyebrow-plain">Student join code</dt><dd className="mt-0.5 font-mono text-[13px]">{o.joinCode}</dd></div>
              </dl>
              <p className="mt-4 rounded-[var(--radius-sm)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-muted)]">{o.licence.note}. Students under this licence are linked to the school; their teachers post work directly here or through Microsoft Teams.</p>
            </Card>
            <Card title={<span className="flex items-center gap-2"><MicrosoftMark className="size-4" />Microsoft 365</span>} action={ms?.connected ? <Badge tone="success"><CheckCircle2 className="size-3" />Connected</Badge> : <Badge>Not connected</Badge>}>
              {ms?.connected ? (
                <>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    {[['Classes', ms.synced?.classes], ['Teachers', ms.synced?.teachers], ['Students', ms.synced?.students], ['Assignments', ms.synced?.assignments]].map(([l, v]) => (
                      <div key={l as string} className="rounded-[var(--radius-sm)] bg-[var(--surface-2)] p-2"><div className="text-lg font-semibold tabular-nums">{v as number}</div><div className="text-[11px] text-[var(--text-muted)]">{l as string}</div></div>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-1 text-xs text-[var(--text-muted)]">
                    <li>Staff and students sign in with their school Microsoft account (Entra ID).</li>
                    <li>Teams classes, members and assignments sync into Murshid. Tenant: {ms.domain}</li>
                    <li>Last sync {fmt(ms.lastSyncAt)}</li>
                  </ul>
                  <div className="mt-3 flex gap-2"><Button variant="outline" size="sm" onClick={() => connect(true)} disabled={busy}><RefreshCw className="size-3.5" />Sync now</Button><Button variant="ghost" size="sm" onClick={() => connect(false)} disabled={busy}>Disconnect</Button></div>
                </>
              ) : (
                <>
                  <p className="text-sm">Let staff and students sign in with Microsoft and bring Teams classes and assignments into Murshid. Teachers can also post work directly in this portal.</p>
                  <button onClick={() => connect(true)} disabled={busy} className="mt-5 flex h-11 items-center gap-2.5 rounded-full border border-[var(--border)] bg-white px-5 text-sm font-medium text-[var(--text)] transition-colors hover:border-[var(--text)] disabled:opacity-60">
                    <MicrosoftMark className="size-4" />{busy ? 'Connecting…' : 'Connect Microsoft 365'}
                  </button>
                  <p className="mt-3 text-[11px] text-[var(--text-muted)]">Asks your IT admin for one-time consent (EduRoster.ReadBasic, EduAssignments.ReadBasic). Simulated in this demo: {ms?.connector}.</p>
                </>
              )}
            </Card>
          </div>

          <Card pad={false} title={<span className="flex items-center gap-2"><Link2 className="size-4" />Classes ({o.classes.length})</span>}>
            <table className="tbl">
              <thead><tr><th>Class</th><th>Teacher</th><th>Students</th><th>Source</th></tr></thead>
              <tbody>{o.classes.map((c: any) => (
                <tr key={c.id}><td className="font-medium">{c.name}</td><td>{c.teacher.name}</td><td className="tabular-nums">{c.students}</td><td>{c.teamsClassId ? <Badge tone="info">Teams</Badge> : <Badge>Murshid portal</Badge>}</td></tr>
              ))}</tbody>
            </table>
          </Card>

          {lic.data && (
            <div className="grid grid-cols-2 gap-4">
              <Card title={<span className="flex items-center gap-2"><Building2 className="size-4" />Schools <span className="font-normal text-[var(--text-muted)]">&middot; institution licences</span></span>} action={<Badge tone="accent">{lic.data.totals.institutionStudents} students</Badge>}>
                <ul className="space-y-2.5">{lic.data.institutions.map((i: any) => (
                  <li key={i.id} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0"><span className="block font-medium">{i.name}</span><span className="text-xs text-[var(--text-muted)]">{i.group ? `${i.group.name} \u00b7 ` : ''}{i.licence.note}</span></span><Badge tone={i.licence.status === 'pilot' ? 'success' : 'neutral'}>{i.licence.status === 'pilot' ? 'proposed pilot' : i.licence.status}</Badge></li>
                ))}</ul>
              </Card>
              <Card title={<span className="flex items-center gap-2"><Home className="size-4" />Families <span className="font-normal text-[var(--text-muted)]">&middot; bought by a parent or a student</span></span>} action={<Badge>{lic.data.totals.familyStudents} students</Badge>}>
                <ul className="space-y-2.5">{lic.data.families.map((f: any) => (
                  <li key={f.id} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0"><span className="block font-medium">{f.name}</span><span className="text-xs text-[var(--text-muted)]">{f.licence.boughtBy === 'parent' ? 'Parent account' : 'Student account'} &middot; {f.students.map((s: any) => s.name).join(', ')}</span></span><Badge>AED {f.licence.priceAed}/mo</Badge></li>
                ))}</ul>
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]"><Users className="size-3" />Separate tenants: family data never appears in a school&rsquo;s portal.</p>
              </Card>
            </div>
          )}
        </div>
      )}
    </>
  );
}
