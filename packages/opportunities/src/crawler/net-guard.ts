/**
 * SSRF guard for server-side fetches of URLs that come from users or from the web (calendar feeds, crawled pages).
 * Only public http(s) hosts: no credentials in the URL, no odd ports, no private, loopback, link-local (cloud
 * metadata 169.254.169.254), carrier-grade NAT, multicast or reserved addresses, whether written as an IP or reached
 * through DNS, and every redirect is checked again.
 * The same file lives in packages/connectors/src/core/net-guard.ts (the packages do not depend on each other).
 * Remaining risk: DNS can change between the check and the connection (rebinding); see docs/SECURITY.md.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class UnsafeUrlError extends Error { constructor(msg: string) { super(msg); this.name = 'UnsafeUrlError'; } }

const v4 = (ip: string) => ip.split('.').map(Number) as [number, number, number, number];
function privateV4(ip: string): boolean {
  const [a, b, c] = v4(ip);
  return a === 0 || a === 10 || a === 127 || a >= 224 // this network, private, loopback, multicast + reserved
    || (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT
    || (a === 169 && b === 254) // link-local, cloud metadata
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && (b === 18 || b === 19)) // IETF, test, benchmarking
    || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113);
}

/** Expand an IPv6 address to 8 groups of numbers. */
function groups6(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0]!;
  // a dotted IPv4 tail (::ffff:127.0.0.1) becomes two hex groups
  const m = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (m) { const [a, b, c, d] = m.slice(1).map(Number) as [number, number, number, number]; s = `${s.slice(0, m.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`; }
  const [h, t] = s.split('::') as [string, string | undefined];
  const head = h ? h.split(':').map((x) => parseInt(x, 16)) : [];
  const rest = t ? t.split(':').map((x) => parseInt(x, 16)) : [];
  const fill = 8 - head.length - rest.length;
  if ((t === undefined && fill !== 0) || fill < 0) return null;
  const all = [...head, ...Array(fill).fill(0), ...rest];
  return all.length === 8 && all.every((x) => Number.isInteger(x) && x >= 0 && x <= 0xffff) ? all : null;
}

/** True for any address a server must not be pointed at by a user-supplied URL. */
export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip.replace(/^\[|\]$/g, ''));
  if (kind === 4) return privateV4(ip);
  if (kind !== 6) return true; // not an address: refuse
  const g = groups6(ip);
  if (!g) return true;
  const embedded = () => `${g[6]! >> 8}.${g[6]! & 255}.${g[7]! >> 8}.${g[7]! & 255}`;
  if (g.slice(0, 6).every((x) => x === 0)) return g[6] === 0 && g[7]! <= 1 ? true : privateV4(embedded()); // ::, ::1, ::a.b.c.d
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return privateV4(embedded()); // ::ffff:a.b.c.d
  if (g[0] === 0x64 && g[1] === 0xff9b) return privateV4(embedded()); // NAT64
  if ((g[0]! & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  if ((g[0]! & 0xffc0) === 0xfe80) return true; // link-local
  if ((g[0]! & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x2002) return privateV4(`${g[1]! >> 8}.${g[1]! & 255}.${g[2]! >> 8}.${g[2]! & 255}`); // 6to4
  return false;
}

const BLOCKED_NAMES = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|home\.arpa)$/i;

/** Check a URL without DNS: protocol, credentials, port, host name or literal IP. Returns the parsed URL. */
export function assertPublicUrl(raw: string, protocols: string[] = ['https:', 'http:']): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new UnsafeUrlError('not a valid URL'); }
  if (!protocols.includes(u.protocol)) throw new UnsafeUrlError(`only ${protocols.join(' or ')} URLs`);
  if (u.username || u.password) throw new UnsafeUrlError('no credentials in URLs');
  if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) throw new UnsafeUrlError('port not allowed');
  const host = u.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || BLOCKED_NAMES.test(host) || !host.includes('.') && !host.includes(':')) throw new UnsafeUrlError('host not allowed');
  if (isIP(host) && isPrivateAddress(host)) throw new UnsafeUrlError('host not allowed');
  return u;
}

type Lookup = (host: string) => Promise<{ address: string }[]>;
const defaultLookup: Lookup = (host) => lookup(host, { all: true, verbatim: true });

/** Resolve the host and refuse it if any of its addresses is private. */
export async function assertResolvesPublic(u: URL, resolve: Lookup = defaultLookup): Promise<void> {
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host)) return; // checked by assertPublicUrl
  let addrs: { address: string }[];
  try { addrs = await resolve(host); } catch { throw new UnsafeUrlError('host does not resolve'); }
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) throw new UnsafeUrlError('host not allowed');
}

/**
 * fetch() for untrusted URLs: checks the URL and its DNS, follows at most `maxRedirects` redirects itself (checking each
 * one), and gives up after `timeoutMs`.
 */
export async function guardedFetch(raw: string, init: RequestInit = {}, opts: { protocols?: string[]; maxRedirects?: number; timeoutMs?: number; fetch?: typeof fetch; lookup?: Lookup } = {}): Promise<Response> {
  const f = opts.fetch ?? fetch;
  let url = raw;
  for (let hop = 0; ; hop++) {
    const u = assertPublicUrl(url, opts.protocols);
    await assertResolvesPublic(u, opts.lookup);
    const res = await f(u.toString(), { ...init, redirect: 'manual', signal: init.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 15_000) });
    if (res.status < 300 || res.status >= 400 || !res.headers.get('location')) return res;
    if (hop >= (opts.maxRedirects ?? 3)) throw new UnsafeUrlError('too many redirects');
    url = new URL(res.headers.get('location')!, u).toString();
  }
}
