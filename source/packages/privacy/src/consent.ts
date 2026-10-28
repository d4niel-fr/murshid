/**
 * Consent records with versioned, separately revocable purposes.
 *
 * Records are append-only: granting and revoking each add a row; the current
 * state of a purpose is the latest row for (student, purpose). A grant only
 * counts if it was given for the *current* version of the purpose text; bump
 * the version when the purpose wording materially changes to force re-consent.
 */
import { randomUUID } from 'node:crypto';
import type { Clock, IsoDateTime, Uuid } from './types.js';
import { systemClock } from './types.js';

export type ConsentPurposeId =
  | 'core_service'
  | 'school_connector'
  | 'guardian_summaries'
  | 'notifications'
  | 'opportunity_sharing_universities';

export interface ConsentPurpose {
  id: ConsentPurposeId;
  version: number;
  title: string;
  description: string;
  /** Under-18s need a verified guardian to grant this purpose. */
  requiresGuardianIfMinor: boolean;
  /** Purposes that must be granted first. */
  dependsOn: ConsentPurposeId[];
  /** Off unless explicitly turned on (all are, per PDPL/CDS privacy-by-default). */
  defaultOn: false;
}

export const CONSENT_PURPOSES: Record<ConsentPurposeId, ConsentPurpose> = {
  core_service: {
    id: 'core_service',
    version: 1,
    title: 'Core service',
    description:
      'Store the profile, goals, tasks and plans the student enters so Murshid can coach them.',
    requiresGuardianIfMinor: true,
    dependsOn: [],
    defaultOn: false,
  },
  school_connector: {
    id: 'school_connector',
    version: 1,
    title: 'School connector',
    description:
      'Read class lists, assignments, notes and due dates from the school LMS (e.g. Google Classroom, Teams). Read-only.',
    requiresGuardianIfMinor: true,
    dependsOn: ['core_service'],
    defaultOn: false,
  },
  guardian_summaries: {
    id: 'guardian_summaries',
    version: 1,
    title: 'Guardian summaries',
    description:
      'Send the linked guardian a weekly summary of progress (no message contents, no notes text).',
    requiresGuardianIfMinor: true,
    dependsOn: ['core_service'],
    defaultOn: false,
  },
  notifications: {
    id: 'notifications',
    version: 1,
    title: 'Notifications',
    description: 'Reminders and briefings by push, email or WhatsApp.',
    requiresGuardianIfMinor: true,
    dependsOn: ['core_service'],
    defaultOn: false,
  },
  opportunity_sharing_universities: {
    id: 'opportunity_sharing_universities',
    version: 1,
    title: 'Share profile with universities / programmes',
    description:
      'Share selected profile items with a named university or programme when the student applies or asks to be contacted. Never sold, never shared for advertising.',
    requiresGuardianIfMinor: true,
    dependsOn: ['core_service'],
    defaultOn: false,
  },
};

export type ConsentActorRole = 'student' | 'guardian';

export interface ConsentRecord {
  id: Uuid;
  student_id: Uuid;
  purpose: ConsentPurposeId;
  purpose_version: number;
  action: 'grant' | 'revoke';
  actor_role: ConsentActorRole;
  actor_id: Uuid;
  /** Guardian id whose verified consent backs this grant (minors). */
  guardian_id: Uuid | null;
  method: 'in_app' | 'email_otp' | 'uae_pass';
  at: IsoDateTime;
  /** Hash of the exact consent text shown (proof of what was agreed). */
  text_hash?: string;
}

export interface ConsentStore {
  append(record: ConsentRecord): Promise<void>;
  listForStudent(studentId: Uuid): Promise<ConsentRecord[]>;
  deleteForStudent(studentId: Uuid): Promise<number>;
}

export class InMemoryConsentStore implements ConsentStore {
  records: ConsentRecord[] = [];
  async append(r: ConsentRecord) {
    this.records.push(r);
  }
  async listForStudent(studentId: Uuid) {
    return this.records.filter((r) => r.student_id === studentId);
  }
  async deleteForStudent(studentId: Uuid) {
    const before = this.records.length;
    this.records = this.records.filter((r) => r.student_id !== studentId);
    return before - this.records.length;
  }
}

export class ConsentError extends Error {
  constructor(
    public code:
      | 'guardian_required'
      | 'guardian_not_verified'
      | 'dependency_missing'
      | 'unknown_purpose'
      | 'wrong_student',
    message: string,
  ) {
    super(message);
    this.name = 'ConsentError';
  }
}

export interface SubjectContext {
  studentId: Uuid;
  isMinor: boolean;
}

export interface GrantInput {
  subject: SubjectContext;
  purpose: ConsentPurposeId;
  actor: { role: ConsentActorRole; id: Uuid };
  /** Required for minors: the verified guardian backing this grant. */
  guardian?: { id: Uuid; student_id: Uuid; verified_at: string | null };
  method?: ConsentRecord['method'];
  textHash?: string;
}

/** Snapshot of current consent state; pure data so the policy engine can use it. */
export type ConsentSnapshot = Partial<Record<ConsentPurposeId, boolean>>;

export class ConsentService {
  constructor(
    private store: ConsentStore,
    private clock: Clock = systemClock,
    private purposes: Record<ConsentPurposeId, ConsentPurpose> = CONSENT_PURPOSES,
  ) {}

  async grant(input: GrantInput): Promise<ConsentRecord> {
    const purpose = this.purposes[input.purpose];
    if (!purpose) throw new ConsentError('unknown_purpose', `Unknown purpose ${input.purpose}`);

    if (input.subject.isMinor && purpose.requiresGuardianIfMinor) {
      if (!input.guardian) {
        throw new ConsentError('guardian_required', `${purpose.id} needs guardian consent for under-18s`);
      }
      if (input.guardian.student_id !== input.subject.studentId) {
        throw new ConsentError('wrong_student', 'Guardian is not linked to this student');
      }
      if (!input.guardian.verified_at) {
        throw new ConsentError('guardian_not_verified', 'Guardian must be verified first');
      }
    }

    const snapshot = await this.snapshot(input.subject.studentId);
    for (const dep of purpose.dependsOn) {
      if (!snapshot[dep]) {
        throw new ConsentError('dependency_missing', `${purpose.id} requires ${dep} first`);
      }
    }

    const record: ConsentRecord = {
      id: randomUUID(),
      student_id: input.subject.studentId,
      purpose: purpose.id,
      purpose_version: purpose.version,
      action: 'grant',
      actor_role: input.actor.role,
      actor_id: input.actor.id,
      guardian_id: input.guardian?.id ?? null,
      method: input.method ?? 'in_app',
      at: this.clock().toISOString(),
      ...(input.textHash ? { text_hash: input.textHash } : {}),
    };
    await this.store.append(record);
    return record;
  }

  /**
   * Revoke one purpose. Either the student or a linked guardian may revoke
   * (revocation is never harder than granting). Revoking a purpose also
   * revokes purposes that depend on it.
   */
  async revoke(
    studentId: Uuid,
    purposeId: ConsentPurposeId,
    actor: { role: ConsentActorRole; id: Uuid },
  ): Promise<ConsentRecord[]> {
    const snapshot = await this.snapshot(studentId);
    const toRevoke = new Set<ConsentPurposeId>([purposeId]);
    for (const p of Object.values(this.purposes)) {
      if (p.dependsOn.includes(purposeId) && snapshot[p.id]) toRevoke.add(p.id);
    }
    const out: ConsentRecord[] = [];
    for (const pid of toRevoke) {
      const rec: ConsentRecord = {
        id: randomUUID(),
        student_id: studentId,
        purpose: pid,
        purpose_version: this.purposes[pid].version,
        action: 'revoke',
        actor_role: actor.role,
        actor_id: actor.id,
        guardian_id: actor.role === 'guardian' ? actor.id : null,
        method: 'in_app',
        at: this.clock().toISOString(),
      };
      await this.store.append(rec);
      out.push(rec);
    }
    return out;
  }

  /** Current effective state: granted AND on the current purpose version. */
  async snapshot(studentId: Uuid): Promise<ConsentSnapshot> {
    const records = await this.store.listForStudent(studentId);
    const latest = new Map<ConsentPurposeId, ConsentRecord>();
    for (const r of records) {
      const prev = latest.get(r.purpose);
      if (!prev || prev.at <= r.at) latest.set(r.purpose, r);
    }
    const snap: ConsentSnapshot = {};
    for (const p of Object.values(this.purposes)) {
      const r = latest.get(p.id);
      snap[p.id] = !!r && r.action === 'grant' && r.purpose_version === p.version;
    }
    return snap;
  }

  async isGranted(studentId: Uuid, purpose: ConsentPurposeId): Promise<boolean> {
    return (await this.snapshot(studentId))[purpose] === true;
  }

  /** Purposes whose stored grant is on an older version (need re-consent). */
  async needsReconsent(studentId: Uuid): Promise<ConsentPurposeId[]> {
    const records = await this.store.listForStudent(studentId);
    const out = new Set<ConsentPurposeId>();
    const latest = new Map<ConsentPurposeId, ConsentRecord>();
    for (const r of records) {
      const prev = latest.get(r.purpose);
      if (!prev || prev.at <= r.at) latest.set(r.purpose, r);
    }
    for (const [pid, r] of latest) {
      if (r.action === 'grant' && r.purpose_version < this.purposes[pid].version) out.add(pid);
    }
    return [...out];
  }
}
