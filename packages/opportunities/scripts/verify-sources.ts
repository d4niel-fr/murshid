/**
 * Re-verify every URL in sources.json (NETWORK). Prints status per source and, with --write,
 * updates each source's `verification` block. Bot-challenge pages (HTTP 202/403 with a challenge)
 * are reported, not removed: some sites block datacenter IPs but work in a browser.
 * Usage: pnpm verify:sources [--write]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Source } from '../src/types.js';

const UA = 'Mozilla/5.0 (compatible; MurshidBot/0.1; +https://murshid.example/bot)';
const path = join(process.cwd(), 'sources.json');
const sources = JSON.parse(readFileSync(path, 'utf8')) as Source[];
const write = process.argv.includes('--write');

async function check(s: Source): Promise<[Source, number, string]> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(s.url, { headers: { 'User-Agent': UA }, redirect: 'follow', signal: ctrl.signal });
    clearTimeout(t);
    const body = await res.text();
    const title = /<title[^>]*>([^<]*)/i.exec(body)?.[1]?.trim().slice(0, 80) ?? '';
    return [s, res.status, title];
  } catch (e) {
    return [s, 0, (e as Error).message];
  }
}

const today = new Date().toISOString().slice(0, 10);
const results: Array<[Source, number, string]> = [];
for (let i = 0; i < sources.length; i += 10) results.push(...(await Promise.all(sources.slice(i, i + 10).map(check))));
let ok = 0;
for (const [s, status, title] of results) {
  const good = status >= 200 && status < 300 && status !== 202;
  if (good) ok++;
  console.log(`${good ? 'OK ' : '!! '} ${String(status).padEnd(3)} ${s.id.padEnd(28)} ${title}`);
  if (write && good) s.verification = { status: 'ok', method: `http-${status} (verify-sources.ts)`, checked_at: today };
}
console.log(`${ok}/${sources.length} returned 2xx`);
if (write) writeFileSync(path, JSON.stringify(sources, null, 2) + '\n');
