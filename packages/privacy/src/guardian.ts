/**
 * Guardian invite + verification.
 *
 * Flow: student (13-17) enters guardian email -> invite created -> 6-digit OTP
 * emailed to guardian -> guardian enters OTP on the consent page -> guardian
 * marked verified -> guardian reviews purposes and grants consent (ConsentService).
 *
 * OTPs are never stored in clear: we keep salted SHA-256 hashes, compare in
 * constant time, expire after 15 minutes and lock after 5 wrong tries.
 *
 * UAE PASS: `UaePassVerifier` is a placeholder hook for a stronger identity
 * check (UAE PASS OIDC). Not wired to any real endpoint in this phase.
 */
import { createHash, randomInt, randomUUID, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Clock, Guardian, IsoDateTime, Uuid } from './types.js';
import { systemClock } from './types.js';

export interface GuardianInvite {
  id: Uuid;
  student_id: Uuid;
  guardian_id: Uuid;
  email: string;
  otp_hash: string;
  otp_salt: string;
  expires_at: IsoDateTime;
  attempts: number;
  status: 'sent' | 'verified' | 'expired' | 'locked' | 'cancelled';
  created_at: IsoDateTime;
}

export interface EmailSender {
  /** Implemented by @murshid/notify. Must not log the OTP. */
  sendGuardianOtp(input: { to: string; studentPreferredName: string; otp: string; expiresMinutes: number }): Promise<void>;
}

/** Test/dev sender: records sends in memory (never use in prod). */
export class MockEmailSender implements EmailSender {
  sent: { to: string; otp: string }[] = [];
  async sendGuardianOtp(input: { to: string; otp: string }) {
    this.sent.push({ to: input.to, otp: input.otp });
  }
}

export interface UaePassVerifier {
  /** Returns a verified identity assertion for the guardian, or null. */
  verify(input: { guardianId: Uuid; authorizationCode: string }): Promise<{
    verified: boolean;
    level: 'SOP1' | 'SOP2' | 'SOP3' | null;
    uaePassUuid?: string;
  }>;
}

/** Placeholder: UAE PASS integration is a later phase (requires TDRA onboarding). */
export class UaePassPlaceholder implements UaePassVerifier {
  async verify(): Promise<{ verified: boolean; level: null }> {
    return { verified: false, level: null };
  }
}

export interface GuardianStore {
  createGuardian(g: Guardian): Promise<void>;
  getGuardian(id: Uuid): Promise<Guardian | undefined>;
  updateGuardian(id: Uuid, patch: Partial<Guardian>): Promise<Guardian>;
  createInvite(i: GuardianInvite): Promise<void>;
  getInvite(id: Uuid): Promise<GuardianInvite | undefined>;
  updateInvite(id: Uuid, patch: Partial<GuardianInvite>): Promise<GuardianInvite>;
}

export class InMemoryGuardianStore implements GuardianStore {
  guardians = new Map<Uuid, Guardian>();
  invites = new Map<Uuid, GuardianInvite>();
  async createGuardian(g: Guardian) {
    this.guardians.set(g.id, g);
  }
  async getGuardian(id: Uuid) {
    return this.guardians.get(id);
  }
  async updateGuardian(id: Uuid, patch: Partial<Guardian>) {
    const g = { ...this.guardians.get(id)!, ...patch };
    this.guardians.set(id, g);
    return g;
  }
  async createInvite(i: GuardianInvite) {
    this.invites.set(i.id, i);
  }
  async getInvite(id: Uuid) {
    return this.invites.get(id);
  }
  async updateInvite(id: Uuid, patch: Partial<GuardianInvite>) {
    const i = { ...this.invites.get(id)!, ...patch };
    this.invites.set(id, i);
    return i;
  }
}

export type VerifyResult =
  | { ok: true; guardian: Guardian }
  | { ok: false; reason: 'not_found' | 'expired' | 'locked' | 'wrong_code' | 'already_used'; attemptsLeft?: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashOtp(otp: string, salt: string) {
  return createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

export interface GuardianFlowOptions {
  clock?: Clock;
  otpTtlMinutes?: number;
  maxAttempts?: number;
}

export class GuardianFlow {
  private clock: Clock;
  private ttl: number;
  private maxAttempts: number;

  constructor(
    private store: GuardianStore,
    private email: EmailSender,
    opts: GuardianFlowOptions = {},
    private uaePass: UaePassVerifier = new UaePassPlaceholder(),
  ) {
    this.clock = opts.clock ?? systemClock;
    this.ttl = opts.otpTtlMinutes ?? 15;
    this.maxAttempts = opts.maxAttempts ?? 5;
  }

  async invite(input: {
    studentId: Uuid;
    studentPreferredName: string;
    guardianName: string;
    guardianEmail: string;
    relation: string;
  }): Promise<{ invite: GuardianInvite; guardian: Guardian }> {
    const email = input.guardianEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error('Invalid guardian email');

    const guardian: Guardian = {
      id: randomUUID(),
      student_id: input.studentId,
      name: input.guardianName,
      email,
      relation: input.relation,
      consent_status: 'pending',
      verified_at: null,
    };
    await this.store.createGuardian(guardian);
    const invite = await this.issueOtp(guardian, input.studentPreferredName);
    return { invite, guardian };
  }

  /** Re-send (new code, old one invalidated by replacing the invite). */
  async resend(inviteId: Uuid, studentPreferredName: string): Promise<GuardianInvite> {
    const old = await this.store.getInvite(inviteId);
    if (!old) throw new Error('Invite not found');
    await this.store.updateInvite(inviteId, { status: 'cancelled' });
    const guardian = await this.store.getGuardian(old.guardian_id);
    return this.issueOtp(guardian!, studentPreferredName);
  }

  private async issueOtp(guardian: Guardian, studentPreferredName: string) {
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const salt = randomBytes(16).toString('hex');
    const now = this.clock();
    const invite: GuardianInvite = {
      id: randomUUID(),
      student_id: guardian.student_id,
      guardian_id: guardian.id,
      email: guardian.email,
      otp_hash: hashOtp(otp, salt),
      otp_salt: salt,
      expires_at: new Date(now.getTime() + this.ttl * 60_000).toISOString(),
      attempts: 0,
      status: 'sent',
      created_at: now.toISOString(),
    };
    await this.store.createInvite(invite);
    await this.email.sendGuardianOtp({
      to: guardian.email,
      studentPreferredName,
      otp,
      expiresMinutes: this.ttl,
    });
    return invite;
  }

  async verifyOtp(inviteId: Uuid, code: string): Promise<VerifyResult> {
    const invite = await this.store.getInvite(inviteId);
    if (!invite) return { ok: false, reason: 'not_found' };
    if (invite.status === 'verified' || invite.status === 'cancelled') return { ok: false, reason: 'already_used' };
    if (invite.status === 'locked') return { ok: false, reason: 'locked' };
    if (invite.status === 'expired' || new Date(invite.expires_at) <= this.clock()) {
      await this.store.updateInvite(inviteId, { status: 'expired' });
      return { ok: false, reason: 'expired' };
    }

    const given = Buffer.from(hashOtp(code.trim(), invite.otp_salt), 'hex');
    const expected = Buffer.from(invite.otp_hash, 'hex');
    if (given.length === expected.length && timingSafeEqual(given, expected)) {
      await this.store.updateInvite(inviteId, { status: 'verified' });
      const guardian = await this.store.updateGuardian(invite.guardian_id, {
        verified_at: this.clock().toISOString(),
      });
      return { ok: true, guardian };
    }

    const attempts = invite.attempts + 1;
    const locked = attempts >= this.maxAttempts;
    await this.store.updateInvite(inviteId, { attempts, status: locked ? 'locked' : 'sent' });
    return locked
      ? { ok: false, reason: 'locked' }
      : { ok: false, reason: 'wrong_code', attemptsLeft: this.maxAttempts - attempts };
  }

  /** Optional stronger check. Placeholder returns unverified. */
  async verifyWithUaePass(guardianId: Uuid, authorizationCode: string) {
    return this.uaePass.verify({ guardianId, authorizationCode });
  }

  /** Mark consent_status on the guardian row after ConsentService grants/revokes. */
  async setConsentStatus(guardianId: Uuid, status: Guardian['consent_status']) {
    return this.store.updateGuardian(guardianId, { consent_status: status });
  }
}
