import { describe, expect, it } from 'vitest';
import {
  ageOn,
  DEFAULT_QUIET_HOURS,
  defaultConsentHook,
  isQuiet,
  nextAllowed,
  placeOutsideQuietHours,
  quietHoursFromEnv,
  quietReason,
} from '../src/index.js';
import { aisha, aishaRecipient, dubai, guardianGranted, guardianPending, guardianRecipient, rohan } from './fixtures.js';

describe('quiet hours (Asia/Dubai)', () => {
  it('blocks school hours on school days only', () => {
    expect(quietReason(dubai('2026-10-13 10:00'))).toBe('school_hours'); // Tue
    expect(quietReason(dubai('2026-10-13 07:30'))).toBe('school_hours');
    expect(quietReason(dubai('2026-10-13 14:30'))).toBeNull();
    expect(quietReason(dubai('2026-10-10 10:00'))).toBeNull(); // Sat
  });

  it('blocks school nights after 21:30 but allows later on weekend nights', () => {
    expect(quietReason(dubai('2026-10-13 21:29'))).toBeNull();
    expect(quietReason(dubai('2026-10-13 21:30'))).toBe('school_night'); // Tue → Wed
    expect(quietReason(dubai('2026-10-11 21:45'))).toBe('school_night'); // Sun → Mon
    expect(quietReason(dubai('2026-10-16 21:45'))).toBeNull(); // Fri → Sat
    expect(quietReason(dubai('2026-10-16 22:45'))).toBe('night');
    expect(quietReason(dubai('2026-10-14 05:00'))).toBe('school_night'); // early Wed
  });

  it('only applies to interrupting channels', () => {
    const t = dubai('2026-10-13 10:00');
    expect(isQuiet(t, 'push')).toBe(true);
    expect(isQuiet(t, 'whatsapp')).toBe(true);
    expect(isQuiet(t, 'email')).toBe(false);
    expect(isQuiet(t, 'in_app')).toBe(false);
  });

  it('respects holidays and env config', () => {
    const cfg = { ...DEFAULT_QUIET_HOURS, holidays: ['2026-10-13'] };
    expect(quietReason(dubai('2026-10-13 10:00'), cfg)).toBeNull();
    const env = quietHoursFromEnv({ QUIET_SCHOOL_NIGHT_CUTOFF: '21:00', QUIET_SCHOOL_DAYS: '1,2,3,4' });
    expect(quietReason(dubai('2026-10-13 21:10'), env)).toBe('school_night');
    expect(quietReason(dubai('2026-10-16 10:00'), env)).toBeNull(); // Friday off in this config
  });

  it('moves sends later, or earlier when later would miss the deadline', () => {
    expect(nextAllowed(dubai('2026-10-13 21:45')).toISOString()).toBe(dubai('2026-10-14 06:30').toISOString());
    const p = placeOutsideQuietHours(dubai('2026-10-13 12:00'), 'push', { notAfter: dubai('2026-10-13 14:00') });
    expect(p.moved).toBe('earlier');
    expect(p.at.toISOString()).toBe(dubai('2026-10-13 07:25').toISOString());
    const q = placeOutsideQuietHours(dubai('2026-10-13 12:00'), 'push', { notAfter: dubai('2026-10-13 20:00') });
    expect(q).toMatchObject({ moved: 'later', reason: 'school_hours' });
    expect(q.at.toISOString()).toBe(dubai('2026-10-13 14:30').toISOString());
    expect(placeOutsideQuietHours(dubai('2026-10-13 12:00'), 'email').moved).toBe('none');
  });
});

describe('consent hook', () => {
  const now = dubai('2026-10-10 12:00');
  const base = { now, channel: 'push' as const };

  it('computes age', () => {
    expect(ageOn('2010-03-01', now)).toBe(16);
    expect(ageOn('2010-10-11', now)).toBe(15);
  });

  it('lets a minor be messaged directly', () => {
    expect(defaultConsentHook({ ...base, student: aisha, recipient: aishaRecipient })).toEqual({ allowed: true });
  });

  it('blocks under-13 accounts entirely', () => {
    expect(defaultConsentHook({ ...base, student: { ...aisha, date_of_birth: '2015-01-01' }, recipient: aishaRecipient })).toEqual({ allowed: false, reason: 'under_13' });
  });

  it('requires granted + verified guardian consent before messaging guardians of minors', () => {
    const r = (g: typeof guardianGranted) => defaultConsentHook({ ...base, student: aisha, recipient: guardianRecipient(g), guardian: g });
    expect(r(guardianGranted)).toEqual({ allowed: true });
    expect(r(guardianPending)).toEqual({ allowed: false, reason: 'guardian_consent_missing' });
    expect(r({ ...guardianGranted, consent_status: 'revoked' })).toEqual({ allowed: false, reason: 'guardian_consent_revoked' });
    expect(r({ ...guardianGranted, verified_at: null })).toEqual({ allowed: false, reason: 'guardian_not_verified' });
    expect(defaultConsentHook({ ...base, student: aisha, recipient: guardianRecipient(guardianGranted), guardian: null })).toMatchObject({ allowed: false });
  });

  it('treats unknown DOB as a minor and adults as free to choose', () => {
    expect(defaultConsentHook({ ...base, student: { ...aisha, date_of_birth: null }, recipient: guardianRecipient(guardianPending), guardian: guardianPending })).toMatchObject({ allowed: false });
    expect(defaultConsentHook({ ...base, student: rohan, recipient: guardianRecipient(guardianPending), guardian: guardianPending })).toEqual({ allowed: true });
  });

  it('requires WhatsApp opt-in', () => {
    expect(defaultConsentHook({ ...base, channel: 'whatsapp', student: aisha, recipient: { ...aishaRecipient, whatsappOptIn: null } })).toEqual({ allowed: false, reason: 'whatsapp_no_opt_in' });
  });
});
