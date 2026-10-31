'use client';

import { Badge, Card, Empty } from './ui';

export function AuditTable({ items }: { items: any[] }) {
  if (!items.length) return <Empty>No changes recorded yet.</Empty>;
  return (
    <Card pad={false}>
      <table className="tbl"><thead><tr><th>When (UTC)</th><th>Who</th><th>Action</th><th>What</th><th>Changes</th></tr></thead><tbody>
        {items.map((e) => (
          <tr key={e.id}><td className="whitespace-nowrap tabular-nums text-xs">{e.at.slice(0, 16).replace('T', ' ')}</td>
            <td><Badge tone={e.actorRole === 'agent' ? 'accent' : 'info'}>{e.actorRole === 'agent' ? 'Murshid' : e.actor}</Badge></td><td>{e.action} {e.resource}</td><td>{e.summary}</td>
            <td className="max-w-[320px] text-xs text-[var(--text-muted)]">{e.changes ? Object.entries(e.changes).map(([k, v]: [string, any]) => (v && typeof v === 'object' && 'to' in v ? `${k}: ${JSON.stringify(v.from)} → ${JSON.stringify(v.to)}` : `${k}: ${JSON.stringify(v)}`)).join('; ') : ''}</td></tr>
        ))}
      </tbody></table>
    </Card>
  );
}
