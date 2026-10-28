/**
 * Audit log writer.
 *
 * Contract: every read of student data by a connector or the agent writes an
 * AuditLog row (actor, action, resource, at). Rows are hash-chained per student
 * so tampering or gaps are detectable. Never put content (note text, messages,
 * tokens) in an audit row — only identifiers and the policy decision.
 */
import { createHash, randomUUID } from 'node:crypto';
import type { Decision, Resource } from './policy.js';
import type { Clock, IsoDateTime, Uuid } from './types.js';
import { systemClock } from './types.js';

export interface AuditLog {
  id: Uuid;
  student_id: Uuid;
  actor: string; // "student:<id>" | "guardian:<id>" | "counsellor:<id>" | "service:<name>:<id>"
  action: string;
  resource: string; // "<type>" or "<type>:<id>"
  allowed: boolean;
  reason: string;
  at: IsoDateTime;
  meta?: Record<string, string | number | boolean>;
  prev_hash: string;
  hash: string;
}

export interface AuditStore {
  append(row: AuditLog): Promise<void>;
  lastForStudent(studentId: Uuid): Promise<AuditLog | undefined>;
  listForStudent(studentId: Uuid): Promise<AuditLog[]>;
}

export class InMemoryAuditStore implements AuditStore {
  rows: AuditLog[] = [];
  async append(row: AuditLog) {
    this.rows.push(row);
  }
  async lastForStudent(studentId: Uuid) {
    for (let i = this.rows.length - 1; i >= 0; i--) if (this.rows[i]!.student_id === studentId) return this.rows[i];
    return undefined;
  }
  async listForStudent(studentId: Uuid) {
    return this.rows.filter((r) => r.student_id === studentId);
  }
}

const FORBIDDEN_META_KEYS = /(token|password|secret|otp|body|text|content|message|dob|email|phone)/i;

function rowHash(row: Omit<AuditLog, 'hash'>): string {
  const { id, student_id, actor, action, resource, allowed, reason, at, meta, prev_hash } = row;
  return createHash('sha256')
    .update(JSON.stringify([id, student_id, actor, action, resource, allowed, reason, at, meta ?? null, prev_hash]))
    .digest('hex');
}

export class AuditWriter {
  constructor(
    private store: AuditStore,
    private clock: Clock = systemClock,
  ) {}

  async write(input: {
    actor: string;
    action: string;
    resource: Resource & { id?: string };
    decision: Pick<Decision, 'allowed' | 'reason'>;
    meta?: Record<string, string | number | boolean>;
  }): Promise<AuditLog> {
    if (input.meta) {
      for (const k of Object.keys(input.meta)) {
        if (FORBIDDEN_META_KEYS.test(k)) throw new Error(`Audit meta key "${k}" may carry personal content; not allowed`);
      }
    }
    const prev = await this.store.lastForStudent(input.resource.studentId);
    const base: Omit<AuditLog, 'hash'> = {
      id: randomUUID(),
      student_id: input.resource.studentId,
      actor: input.actor,
      action: input.action,
      resource: input.resource.id ? `${input.resource.type}:${input.resource.id}` : input.resource.type,
      allowed: input.decision.allowed,
      reason: input.decision.reason,
      at: this.clock().toISOString(),
      ...(input.meta ? { meta: input.meta } : {}),
      prev_hash: prev?.hash ?? 'GENESIS',
    };
    const row: AuditLog = { ...base, hash: rowHash(base) };
    await this.store.append(row);
    return row;
  }

  /** Verify the hash chain for a student. Returns index of first bad row or -1. */
  async verifyChain(studentId: Uuid): Promise<number> {
    const rows = await this.store.listForStudent(studentId);
    let prev = 'GENESIS';
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      const { hash, ...rest } = r;
      if (r.prev_hash !== prev || rowHash(rest) !== hash) return i;
      prev = hash;
    }
    return -1;
  }
}

/** Helper to format an actor id string. */
export function actorKey(actor: { role: string; id: string; service?: string }): string {
  return actor.role === 'service' ? `service:${actor.service}:${actor.id}` : `${actor.role}:${actor.id}`;
}
