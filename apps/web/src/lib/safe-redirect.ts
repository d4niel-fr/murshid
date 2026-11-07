/**
 * Open-redirect and link checks, shared by sign-in (?next=), the notes Markdown renderer and anything else that turns
 * text into a place to go.
 *
 * A "next" path must stay on this site. Browsers are lenient: they drop tabs and newlines inside URLs and read "\" as
 * "/", so "/\t/evil.com", "/\evil.com" and "//evil.com" all leave the site. The check parses the value the way a
 * browser would and keeps it only when it lands on this origin.
 */
const BASE = 'https://murshid.invalid';

/** A same-site path (with its query and #hash), or the fallback. */
export function safeRedirect(next: string | null | undefined, fallback = '/app'): string {
  if (typeof next !== 'string' || !next || next.length > 2000) return fallback;
  // control characters and whitespace never belong in a path we send people to
  if (/[\u0000-\u001f\u007f\s]/.test(next)) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  let u: URL;
  try { u = new URL(next, BASE); } catch { return fallback; }
  if (u.origin !== BASE) return fallback;
  return `${u.pathname}${u.search}${u.hash}`;
}

/**
 * How a link written by a user or by AI may be shown: http(s) and mailto open in a new tab, a same-site path stays in
 * the app, anything else (javascript:, data:, //other-site, /\other-site) is shown as plain text.
 */
export function linkTarget(href: string): { href: string; external: boolean } | null {
  const h = href.trim();
  if (/[\u0000-\u001f\u007f]/.test(h)) return null;
  if (/^(https?:\/\/|mailto:)/i.test(h)) {
    try { const u = new URL(h); return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:' ? { href: h, external: true } : null; } catch { return null; }
  }
  if (h.startsWith('/')) { const p = safeRedirect(h, ''); return p ? { href: p, external: false } : null; }
  return null;
}
