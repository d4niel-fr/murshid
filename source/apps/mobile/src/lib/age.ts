export const MIN_AGE = 13;
export const ADULT_AGE = 18;

/** Parse YYYY-MM-DD strictly. Returns null if invalid or in the future. */
export function parseDob(input: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  if (date.getTime() > Date.now()) return null;
  return date;
}

export function ageOn(dob: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < dob.getUTCMonth() || (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export type AgeGate = { ok: false; reason: 'invalid' | 'too_young' } | { ok: true; age: number; needsGuardian: boolean };

// Mirrors the privacy package's age gate (13+, guardian consent under 18). Swap for @murshid/privacy when available.
export function checkAge(input: string, now = new Date()): AgeGate {
  const dob = parseDob(input);
  if (!dob) return { ok: false, reason: 'invalid' };
  const age = ageOn(dob, now);
  if (age < MIN_AGE) return { ok: false, reason: 'too_young' };
  return { ok: true, age, needsGuardian: age < ADULT_AGE };
}
