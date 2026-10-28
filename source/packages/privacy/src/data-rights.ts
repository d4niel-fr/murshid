/**
 * Data-subject rights: export (JSON zip of all student data) and deletion
 * (cascade + tombstone).
 *
 * `StudentDataSource` abstracts the DB (packages/db implements it against
 * Supabase with the service role, in a transaction). In-memory version here.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createZip } from './zip.js';
import type { Clock, IsoDateTime, StudentDataTable, Uuid } from './types.js';
import { STUDENT_DATA_TABLES, systemClock } from './types.js';
import type { AuditWriter } from './audit.js';

export interface StudentDataSource {
  /** All rows in `table` belonging to the student (directly or via parent FK). */
  rowsFor(table: StudentDataTable, studentId: Uuid): Promise<Record<string, unknown>[]>;
  deleteFor(table: StudentDataTable, studentId: Uuid): Promise<number>;
  writeTombstone(t: Tombstone): Promise<void>;
}

/** Hooks run before DB deletion: revoke OAuth tokens, purge files, cancel scheduled notifications. */
export interface DeletionHook {
  name: string;
  run(studentId: Uuid): Promise<void>;
}

export interface Tombstone {
  id: Uuid;
  /** SHA-256(student_id + pepper) so we can answer "was X deleted?" without keeping the id. */
  subject_hash: string;
  deleted_at: IsoDateTime;
  requested_by: 'student' | 'guardian' | 'retention_job' | 'admin';
  tables: Partial<Record<StudentDataTable, number>>;
  hooks_run: string[];
}

/**
 * Deletion order: children first, so FK constraints don't block. audit_logs are
 * deleted last (and only if retention allows; otherwise they're anonymised by
 * the DB team's retention job).
 */
export const DELETION_ORDER: StudentDataTable[] = [
  'milestones',
  'materials',
  'courses',
  'calendar_events',
  'tasks',
  'goals',
  'applications',
  'achievements',
  'cv_versions',
  'notifications',
  'connections',
  'ai_use_logs',
  'consent_records',
  'guardians',
  'audit_logs',
  'students',
];

// Sanity: DELETION_ORDER must cover every table.
for (const t of STUDENT_DATA_TABLES) {
  if (!DELETION_ORDER.includes(t)) throw new Error(`DELETION_ORDER missing ${t}`);
}

export class DataRightsService {
  constructor(
    private source: StudentDataSource,
    private opts: {
      clock?: Clock;
      tombstonePepper: string;
      hooks?: DeletionHook[];
      audit?: AuditWriter;
      /** Keep audit_logs rows (anonymised later by retention). Default true. */
      retainAuditLogs?: boolean;
    },
  ) {}

  private get clock() {
    return this.opts.clock ?? systemClock;
  }

  async exportJson(studentId: Uuid): Promise<Record<string, unknown>> {
    const out: Record<string, unknown> = {};
    for (const t of STUDENT_DATA_TABLES) out[t] = await this.source.rowsFor(t, studentId);
    return out;
  }

  /** Returns a ZIP: one JSON file per table + manifest.json + README.txt. */
  async exportZip(studentId: Uuid): Promise<Buffer> {
    const data = await this.exportJson(studentId);
    const now = this.clock();
    const manifest = {
      format: 'murshid-export',
      version: 1,
      student_id: studentId,
      generated_at: now.toISOString(),
      tables: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, (v as unknown[]).length])),
      note: 'Secrets (OAuth tokens, OTP hashes) are never included; connections list only provider and scopes.',
    };
    const entries = [
      { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
      {
        name: 'README.txt',
        data:
          'This is a copy of the data Murshid holds about you. Each file is one kind of record in JSON.\n' +
          'Questions: privacy@murshid.example (placeholder).\n',
      },
      ...Object.entries(data).map(([t, rows]) => ({ name: `data/${t}.json`, data: JSON.stringify(stripSecrets(rows as Record<string, unknown>[]), null, 2) })),
    ];
    await this.opts.audit?.write({
      actor: 'service:privacy:export',
      action: 'export',
      resource: { type: 'student_profile', studentId },
      decision: { allowed: true, reason: 'data-subject access request' },
    });
    return createZip(entries, now);
  }

  async deleteStudent(studentId: Uuid, requestedBy: Tombstone['requested_by']): Promise<Tombstone> {
    const hooksRun: string[] = [];
    for (const h of this.opts.hooks ?? []) {
      await h.run(studentId);
      hooksRun.push(h.name);
    }
    const retainAudit = this.opts.retainAuditLogs ?? true;
    const tables: Tombstone['tables'] = {};
    for (const t of DELETION_ORDER) {
      if (t === 'audit_logs' && retainAudit) continue;
      tables[t] = await this.source.deleteFor(t, studentId);
    }
    const tomb: Tombstone = {
      id: randomUUID(),
      subject_hash: subjectHash(studentId, this.opts.tombstonePepper),
      deleted_at: this.clock().toISOString(),
      requested_by: requestedBy,
      tables,
      hooks_run: hooksRun,
    };
    await this.source.writeTombstone(tomb);
    return tomb;
  }
}

export function subjectHash(studentId: Uuid, pepper: string) {
  return createHash('sha256').update(`${pepper}:${studentId}`).digest('hex');
}

const SECRET_KEYS = /^(token|access_token|refresh_token|token_ref|otp_hash|otp_salt|password.*)$/i;
function stripSecrets(rows: Record<string, unknown>[]) {
  return rows.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !SECRET_KEYS.test(k))));
}

/** In-memory source for tests/dev. */
export class InMemoryStudentDataSource implements StudentDataSource {
  tables = new Map<StudentDataTable, Record<string, unknown>[]>();
  tombstones: Tombstone[] = [];
  seed(table: StudentDataTable, rows: Record<string, unknown>[]) {
    this.tables.set(table, [...(this.tables.get(table) ?? []), ...rows]);
  }
  private owns(table: StudentDataTable, row: Record<string, unknown>, studentId: Uuid): boolean {
    if (table === 'students') return row.id === studentId;
    if (row.student_id === studentId) return true;
    if (table === 'milestones') return (this.tables.get('goals') ?? []).some((g) => g.id === row.goal_id && g.student_id === studentId);
    if (table === 'materials') return (this.tables.get('courses') ?? []).some((c) => c.id === row.course_id && c.student_id === studentId);
    return false;
  }
  async rowsFor(table: StudentDataTable, studentId: Uuid) {
    return (this.tables.get(table) ?? []).filter((r) => this.owns(table, r, studentId));
  }
  async deleteFor(table: StudentDataTable, studentId: Uuid) {
    const rows = this.tables.get(table) ?? [];
    const keep = rows.filter((r) => !this.owns(table, r, studentId));
    this.tables.set(table, keep);
    return rows.length - keep.length;
  }
  async writeTombstone(t: Tombstone) {
    this.tombstones.push(t);
  }
}
