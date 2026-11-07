'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/shell';
import { Badge, Button, Card, Empty, ErrorBox, SkeletonRows } from '@/components/ui';
import { api } from '@/lib/api';
import { useData } from '@/lib/use-data';

const REASON: Record<string, string> = { illness: 'Illness', appointment: 'Appointment', family: 'Family', religious: 'Religious occasion', competition: 'Competition or event', other: 'Other' };
const span = (l: any) => (l.from === l.to ? l.from : `${l.from} to ${l.to}`);

/** Leave requests from students and parents: approve or decline; approved days show as excused in every register. */
export default function LeavePage() {
  const list = useData<any>('/school/leave', 'staff');
  const [reply, setReply] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const decide = async (id: string, decision: 'approved' | 'declined') => {
    setBusy(id); setErr(null);
    try { await api(`/school/leave/${id}`, { method: 'POST', body: { decision, reply: reply[id] ?? '' }, as: 'staff' }); await list.reload(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  const d = list.data;
  return (
    <>
      <PageHeader title="Leave requests" sub={d ? `${d.pending.length} waiting` : 'Absence requests from students and parents'} />
      <ErrorBox error={err ?? list.error} />
      {!d ? <Card pad={false}><SkeletonRows rows={5} /></Card> : (
        <div className="grid gap-4">
          <Card title="Waiting for an answer">
            {!d.pending.length ? <Empty>Nothing waiting.</Empty> : (
              <ul className="divide-y divide-[var(--border)]">
                {d.pending.map((l: any) => (
                  <li key={l.id} className="grid gap-2 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{l.name} <span className="font-normal text-[var(--text-muted)]">· {l.section}</span></p>
                      <p className="text-xs text-[var(--text-muted)]">{span(l)} · {REASON[l.reason]} · asked by {l.by === 'parent' ? `${l.byName} (parent)` : 'the student'}</p>
                      {l.note && <p className="mt-1 text-sm">“{l.note}”</p>}
                      <input value={reply[l.id] ?? ''} onChange={(e) => setReply({ ...reply, [l.id]: e.target.value })} maxLength={300} placeholder="Reply (optional)" className="mt-2 h-9 w-full max-w-md rounded-full border border-[var(--border)] bg-transparent px-3 text-sm" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void decide(l.id, 'approved')} disabled={busy === l.id}><Check />Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => void decide(l.id, 'declined')} disabled={busy === l.id}><X />Decline</Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Answered" pad={false}>
            {!d.answered.length ? <div className="p-6"><Empty>None yet.</Empty></div> : (
              <ul className="divide-y divide-[var(--border)]">
                {d.answered.map((l: any) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
                    <span className="min-w-0 flex-1"><span className="block font-medium">{l.name}</span><span className="block text-xs text-[var(--text-muted)]">{span(l)} · {REASON[l.reason]}{l.reply ? ` · “${l.reply}”` : ''}</span></span>
                    <Badge tone={l.status === 'approved' ? 'success' : 'danger'}>{l.status === 'approved' ? 'Approved' : 'Declined'}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
