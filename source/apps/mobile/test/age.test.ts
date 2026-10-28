// Dependency-free test (node:test + Node 22 type stripping). Run: pnpm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAge, parseDob } from '../src/lib/age.ts';

const now = new Date(Date.UTC(2026, 9, 10));

test('rejects malformed and impossible dates', () => {
  assert.equal(parseDob('2009-02-30'), null);
  assert.equal(parseDob('14/09/2009'), null);
  assert.deepEqual(checkAge('nope', now), { ok: false, reason: 'invalid' });
});

test('blocks under-13', () => {
  assert.deepEqual(checkAge('2014-01-01', now), { ok: false, reason: 'too_young' });
});

test('13-17 needs guardian, birthday boundary respected', () => {
  assert.deepEqual(checkAge('2013-10-10', now), { ok: true, age: 13, needsGuardian: true });
  assert.deepEqual(checkAge('2013-10-11', now), { ok: false, reason: 'too_young' });
  assert.deepEqual(checkAge('2009-03-14', now), { ok: true, age: 17, needsGuardian: true });
});

test('18+ needs no guardian', () => {
  assert.deepEqual(checkAge('2008-10-10', now), { ok: true, age: 18, needsGuardian: false });
});
