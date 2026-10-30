import type { ConsentStatus, NotificationRecipient } from "./enums.js";

export const MIN_AGE = 13;
export const AGE_OF_MAJORITY = 18;

function toYmd(d: string | Date): { y: number; m: number; d: number } {
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (!m) throw new Error(`invalid date: ${d}`);
    return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  }
  if (Number.isNaN(d.getTime())) throw new Error("invalid date");
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

/**
 * Whole years between date of birth and `on` (default: today, UTC calendar date).
 * Leap-day birthdays turn a year older on 1 March in non-leap years (matches Postgres age()).
 */
export function ageFromDob(dateOfBirth: string | Date, on: string | Date = new Date()): number {
  const b = toYmd(dateOfBirth);
  const n = toYmd(on);
  let age = n.y - b.y;
  if (n.m < b.m || (n.m === b.m && n.d < b.d)) age -= 1;
  if (age < 0) throw new Error("date of birth is in the future");
  return age;
}

/** Contract: Murshid is 13+ only. */
export function meetsMinimumAge(dateOfBirth: string | Date, on?: string | Date): boolean {
  return ageFromDob(dateOfBirth, on) >= MIN_AGE;
}

export function isMinor(dateOfBirth: string | Date, on?: string | Date): boolean {
  return ageFromDob(dateOfBirth, on) < AGE_OF_MAJORITY;
}

/** Contract: under 18 requires guardian consent before connectors or non-student notifications. */
export function requiresGuardianConsent(
  student: { date_of_birth: string | Date } | string | Date,
  on?: string | Date,
): boolean {
  const dob = typeof student === "object" && !(student instanceof Date) ? student.date_of_birth : student;
  return isMinor(dob, on);
}

/** True when at least one guardian has granted consent. */
export function hasGuardianConsent(guardians: ReadonlyArray<{ consent_status: ConsentStatus }>): boolean {
  return guardians.some((g) => g.consent_status === "granted");
}

/** Mirrors private.blocked_by_missing_consent() in SQL. */
export function isBlockedByMissingConsent(
  student: { date_of_birth: string | Date },
  guardians: ReadonlyArray<{ consent_status: ConsentStatus }>,
  on?: string | Date,
): boolean {
  return requiresGuardianConsent(student, on) && !hasGuardianConsent(guardians);
}

/** May a connector be activated for this student? (mirrors connections_require_consent trigger) */
export function canActivateConnector(
  student: { date_of_birth: string | Date },
  guardians: ReadonlyArray<{ consent_status: ConsentStatus }>,
  on?: string | Date,
): boolean {
  return !isBlockedByMissingConsent(student, guardians, on);
}

/** May a notification go to this recipient? Students can always be notified. */
export function canNotify(
  recipient: NotificationRecipient,
  student: { date_of_birth: string | Date },
  guardians: ReadonlyArray<{ consent_status: ConsentStatus }>,
  on?: string | Date,
): boolean {
  return recipient === "student" || !isBlockedByMissingConsent(student, guardians, on);
}

/** Latest consent record for a scope decides (mirrors private.counsellor_can_view()). */
export function latestConsentStatus(
  records: ReadonlyArray<{ scope: string; status: ConsentStatus; created_at: string; id: string }>,
  scope: string,
): ConsentStatus | null {
  const forScope = records.filter((r) => r.scope === scope);
  // created_at strings may carry different offsets; compare as instants, tie-break on id desc (as SQL does)
  forScope.sort((a, b) => {
    const d = Date.parse(b.created_at) - Date.parse(a.created_at);
    return d !== 0 ? d : b.id.localeCompare(a.id);
  });
  return forScope[0]?.status ?? null;
}

/** Is a student's grade inside an opportunity's grade band (null bounds = open)? */
export function gradeEligible(grade: number, opp: { min_grade: number | null; max_grade: number | null }): boolean {
  return (opp.min_grade === null || grade >= opp.min_grade) && (opp.max_grade === null || grade <= opp.max_grade);
}

/** Percent of milestones done, rounded; null when there are none. */
export function milestoneProgress(milestones: ReadonlyArray<{ done: boolean }>): number | null {
  if (milestones.length === 0) return null;
  return Math.round((milestones.filter((m) => m.done).length / milestones.length) * 100);
}
