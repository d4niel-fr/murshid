#!/usr/bin/env node
/**
 * Crawl the built site and fail on broken internal links.
 *   node scripts/check-links.mjs [baseUrl]     (default http://localhost:3000)
 * Starts from /, every sitemap URL and a few known entry points; follows same-origin <a href>, <link href>,
 * <img src> and <script src>; reports anything that answers 4xx/5xx, plus pages missing an <h1> or a <title>.
 * The 404 page itself is expected to answer 404.
 */
const base = (process.argv[2] ?? process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const origin = new URL(base).origin;
const SEEDS = ['/', '/pricing', '/features', '/faq', '/how-it-works', '/privacy', '/checkout', '/app', '/app/study', '/sitemap.xml', '/robots.txt', '/manifest.webmanifest'];
const MAX = Number(process.env.MAX_PAGES ?? 400);

const seen = new Map();          // url -> status
const from = new Map();          // url -> first page that linked it
const queue = [];
const problems = [];
const add = (u, ref) => {
  let url;
  try { url = new URL(u, ref ?? base); } catch { return; }
  if (url.origin !== origin) return;
  url.hash = '';
  const key = url.pathname + url.search;
  if (/^\/(_next\/image|api\/)/.test(url.pathname)) return;
  if (seen.has(key) || queue.includes(key)) return;
  if (ref) from.set(key, new URL(ref).pathname);
  queue.push(key);
};

async function get(path) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(origin + path, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'murshid-link-check' } });
    const type = res.headers.get('content-type') ?? '';
    const body = type.includes('html') || type.includes('xml') ? await res.text() : (await res.arrayBuffer(), '');
    return { status: res.status, type, body, finalPath: new URL(res.url).pathname };
  } catch (e) {
    return { status: 0, type: '', body: '', error: e.name === 'AbortError' ? 'timeout' : e.message };
  } finally { clearTimeout(t); }
}

SEEDS.forEach((s) => add(s));
while (queue.length && seen.size < MAX) {
  const path = queue.shift();
  const r = await get(path);
  seen.set(path, r.status);
  if (r.status === 0 || r.status >= 400) { problems.push(`${r.status || r.error}  ${path}${from.get(path) ? `   (linked from ${from.get(path)})` : ''}`); continue; }
  if (r.type.includes('xml')) { for (const m of r.body.matchAll(/<loc>([^<]+)<\/loc>/g)) add(new URL(m[1]).pathname); continue; }
  if (!r.type.includes('html')) continue;
  const html = r.body;
  if (!/<title>[^<]+<\/title>/.test(html)) problems.push(`no <title>  ${path}`);
  if (!/<h1[\s>]/.test(html)) problems.push(`no <h1>  ${path}`);
  for (const m of html.matchAll(/<(?:a|link)\s[^>]*?href="([^"#][^"]*)"/g)) { if (!/^(mailto:|tel:|javascript:)/.test(m[1])) add(m[1].replace(/&amp;/g, '&'), origin + r.finalPath); }
  for (const m of html.matchAll(/<(?:img|script|source|video)\s[^>]*?src="([^"]+)"/g)) add(m[1].replace(/&amp;/g, '&'), origin + r.finalPath);
}

// a page that does not exist must answer 404 (not 200), so search engines never index an error page
const missing = await get('/this-page-does-not-exist-' + Date.now());
if (missing.status !== 404) problems.push(`expected 404 for a missing page, got ${missing.status}`);

console.log(`checked ${seen.size} URLs on ${origin}`);
if (problems.length) { console.error(`\n${problems.length} problem(s):\n  ${problems.join('\n  ')}`); process.exit(1); }
console.log('no broken links');
