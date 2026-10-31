import { ConsentRequiredError } from './errors';
import type { Connector, SyncContext } from './connector';
import type { AuditLogEntry, ProviderId, SyncResult } from './types';

/**
 * Implemented by packages/privacy. Contract rule: 13+ only, and under-18s need
 * guardian consent before any connector runs.
 */
export interface ConsentGate {
  canUseConnector(studentId: string, provider: ProviderId): Promise<{ allowed: boolean; reason?: string }>;
}

/** Implemented by packages/privacy (AuditLog table). Every read writes a row. */
export interface AuditSink {
  record(entry: AuditLogEntry): Promise<void>;
}

export class MemoryAuditSink implements AuditSink {
  readonly entries: AuditLogEntry[] = [];
  async record(e: AuditLogEntry) {
    this.entries.push(e);
  }
}

/** Run a sync behind the consent gate and write audit rows for each resource read. */
export async function guardedSync(
  connector: Connector,
  ctx: SyncContext,
  deps: { consent: ConsentGate; audit: AuditSink },
): Promise<SyncResult> {
  const verdict = await deps.consent.canUseConnector(ctx.studentId, connector.provider);
  const at = (ctx.now ?? new Date()).toISOString();
  const actor = `connector:${connector.provider}`;
  if (!verdict.allowed) {
    await deps.audit.record({ actor, action: 'sync.denied', resource: `student:${ctx.studentId}`, at });
    throw new ConsentRequiredError(verdict.reason ?? 'Guardian consent required before connecting accounts');
  }
  const result = await connector.sync(ctx);
  for (const [kind, rows] of Object.entries({
    courses: result.courses,
    materials: result.materials,
    events: result.events,
    tasks: result.tasks,
  })) {
    if (rows.length > 0) {
      await deps.audit.record({ actor, action: 'sync.read', resource: `student:${ctx.studentId}/${kind}?count=${rows.length}`, at });
    }
  }
  return result;
}
