'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card } from '@/components/ui';
import { API_BASE, getAdminPasscode } from '@/lib/api';

interface Status { available: boolean; reason: string; band: string; controls: { guardian: boolean | null; school: boolean | null }; turnsToday: number }

const REASON: Record<string, string> = { on: 'Available', school_off: 'Off (school)', guardian_off: 'Off (guardian)', needs_guardian: 'Needs guardian (Grades 5-6)' };

/** School switch for the optional study buddy persona (audit-logged by the API). */
export function BuddySwitch({ studentId }: { studentId: string }) {
  const [st, setSt] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const headers = () => ({ 'content-type': 'application/json', 'x-dev-user': studentId, 'x-dev-role': 'admin', 'x-dev-user-id': 'dev-admin', ...(getAdminPasscode() ? { 'x-admin-passcode': getAdminPasscode()! } : {}) });
  useEffect(() => {
    fetch(`${API_BASE}/buddy`, { headers: headers(), cache: 'no-store' }).then(async (r) => (r.ok ? setSt(await r.json()) : setErr(`HTTP ${r.status}`))).catch(() => setErr('API unreachable'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);
  const set = async (enabled: boolean) => {
    setErr(null);
    const r = await fetch(`${API_BASE}/buddy/controls`, { method: 'PUT', headers: headers(), body: JSON.stringify({ by: 'school', enabled }) }).catch(() => null);
    if (!r?.ok) { setErr(!r ? 'API unreachable' : r.status === 401 ? 'Admin passcode required (sign in again on /login)' : `HTTP ${r.status}`); return; }
    setSt(await r.json());
  };
  const schoolOff = st?.controls.school === false;
  return (
    <Card title="Study buddy mode" action={st ? <Badge tone={st.available ? 'success' : 'neutral'}>{REASON[st.reason] ?? st.reason}</Badge> : undefined}>
      <p className="text-sm text-[var(--text-muted)]">
        Optional friendly persona in the student&apos;s chat. Always discloses it is an AI; no romance, secrets or emotional dependence; crisis messages go to UAE helplines.
        Turns and safety flags (never message text) appear in the audit log.{st ? ` Buddy turns today: ${st.turnsToday}.` : ''}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant={schoolOff ? 'primary' : 'outline'} onClick={() => void set(schoolOff)} disabled={!st}>
          {schoolOff ? 'Allow study buddy' : 'Switch off for this student'}
        </Button>
        {err && <span className="text-xs text-[var(--danger)]">{err}</span>}
      </div>
    </Card>
  );
}
