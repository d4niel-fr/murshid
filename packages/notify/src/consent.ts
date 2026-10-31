import type { Channel, Guardian, Recipient, Student } from './types.js';

export interface ConsentContext {
  student: Student;
  recipient: Recipient;
  channel: Channel;
  /** Guardian row when recipient.kind === 'guardian'. */
  guardian?: Guardian | null;
  /** Whether a guardian of this student has granted consent (needed for minors). */
  guardianConsentGranted?: boolean;
  now: Date;
}

export type ConsentDenyReason =
  | 'under_13'
  | 'age_unknown'
  | 'guardian_consent_missing'
  | 'guardian_consent_revoked'
  | 'guardian_not_verified'
  | 'whatsapp_no_opt_in';

export type ConsentDecision = { allowed: true } | { allowed: false; reason: ConsentDenyReason };

/**
 * Hook the dispatcher calls before every send. @murshid/privacy will provide the real one
 * (ConsentRecord lookups + AuditLog); `defaultConsentHook` implements the contract rules locally.
 */
export type ConsentHook = (ctx: ConsentContext) => Promise<ConsentDecision> | ConsentDecision;

export function ageOn(dob: string, now: Date): number {
  const [y, m, d] = dob.slice(0, 10).split('-').map(Number) as [number, number, number];
  let age = now.getUTCFullYear() - y;
  const beforeBirthday = now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d);
  if (beforeBirthday) age--;
  return age;
}

/**
 * Contract rules:
 *  - Murshid is 13+ only → never message anyone about an under-13 account.
 *  - Under 18 → guardian consent before notifications to anyone but the student.
 *    Messaging a guardian additionally requires that guardian's consent be granted and verified.
 *  - WhatsApp needs an explicit opt-in from the recipient (Meta policy), at any age.
 * Unknown DOB is treated as a minor (fail closed) for guardian messages.
 */
export const defaultConsentHook: ConsentHook = (ctx) => {
  const { student, recipient, channel, guardian, now } = ctx;
  const age = student.date_of_birth ? ageOn(student.date_of_birth, now) : null;
  if (age !== null && age < 13) return { allowed: false, reason: 'under_13' };

  if (channel === 'whatsapp' && !recipient.whatsappOptIn?.optedIn) {
    return { allowed: false, reason: 'whatsapp_no_opt_in' };
  }

  if (recipient.kind === 'guardian') {
    const minor = age === null || age < 18;
    if (minor) {
      if (!guardian) return { allowed: false, reason: 'guardian_consent_missing' };
      if (guardian.consent_status === 'revoked') return { allowed: false, reason: 'guardian_consent_revoked' };
      if (guardian.consent_status !== 'granted') return { allowed: false, reason: 'guardian_consent_missing' };
      if (!guardian.verified_at) return { allowed: false, reason: 'guardian_not_verified' };
    }
  }
  return { allowed: true };
};
