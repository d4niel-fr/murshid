import type { Opportunity } from '../types.js';
import { todayIso } from '../util.js';

/**
 * Expiry: close anything whose deadline has passed. Items with no deadline that have not been seen
 * for `staleAfterDays` become 'unknown' (we can't confirm they're still open).
 */
export function applyExpiry(list: Opportunity[], now: Date, staleAfterDays = 45): Opportunity[] {
  const today = todayIso(now);
  return list.map((o) => {
    if (o.deadline && o.deadline < today) return o.status === 'closed' ? o : { ...o, status: 'closed' as const };
    if (o.deadline && o.deadline >= today) return o.status === 'open' ? o : { ...o, status: 'open' as const };
    const ageDays = (now.getTime() - new Date(o.last_seen_at).getTime()) / 86400e3;
    if (ageDays > staleAfterDays && o.status !== 'unknown') return { ...o, status: 'unknown' as const };
    return o;
  });
}

/**
 * Freshness 0..1: how much we trust the record is current.
 * Decays with days since last seen (half-life 30d) and is boosted by having a concrete future deadline.
 */
export function freshnessScore(o: Opportunity, now: Date): number {
  const days = Math.max(0, (now.getTime() - new Date(o.last_seen_at).getTime()) / 86400e3);
  let s = Math.pow(0.5, days / 30);
  if (o.status === 'closed') return 0;
  if (o.deadline && o.deadline >= todayIso(now)) s = Math.min(1, s + 0.15);
  if (!o.deadline) s *= 0.8;
  return Math.round(s * 100) / 100;
}
