// Regression: two screens resolving to the same URL ("/") made Expo web's Back button loop
// (React error #185). Every screen file must map to a unique URL.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';

const appDir = new URL('../app/', import.meta.url).pathname;

function screens(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return screens(p);
    return /\.tsx?$/.test(f) && !f.startsWith('_') ? [p] : [];
  });
}

const urlOf = (file: string) => '/' + relative(appDir, file).replace(/\.tsx?$/, '').split('/')
  .filter((seg) => !/^\(.*\)$/.test(seg)).filter((seg) => seg !== 'index').join('/');

test('every screen has a unique URL', () => {
  const seen = new Map<string, string>();
  for (const f of screens(appDir)) {
    const url = urlOf(f);
    assert.equal(seen.has(url), false, `${relative(appDir, f)} and ${seen.get(url)} both map to ${url}`);
    seen.set(url, relative(appDir, f));
  }
  assert.equal(seen.get('/'), 'index.tsx');
  assert.equal(seen.get('/home'), '(tabs)/home.tsx');
});

test('the session gate sends signed-in students to /home, never to "/(tabs)" (which is "/")', () => {
  const session = readFileSync(new URL('../src/state/session.tsx', import.meta.url), 'utf8');
  assert.match(session, /let nextRoute: Route = '\/home'/);
  assert.doesNotMatch(session, /'\/\(tabs\)'/);
  for (const f of screens(appDir)) assert.doesNotMatch(readFileSync(f, 'utf8'), /['"]\/\(tabs\)['"]/, f);
});
