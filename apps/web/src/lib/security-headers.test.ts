import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, permissionsPolicy, securityHeaders } from './security-headers';

const prod = { dev: false, https: true, supabaseUrl: 'https://abc.supabase.co', microphone: true, camera: true };
const dir = (csp: string, name: string) => csp.split('; ').find((d) => d.startsWith(`${name} `))?.split(' ').slice(1) ?? [];

describe('security headers', () => {
  it('a strict CSP: own origin, Supabase (https + wss), workers, no framing, no plugins, no eval in production', () => {
    const csp = contentSecurityPolicy(prod);
    expect(dir(csp, 'default-src')).toEqual(["'self'"]);
    expect(dir(csp, 'connect-src')).toEqual(["'self'", 'https://abc.supabase.co', 'wss://abc.supabase.co']);
    expect(dir(csp, 'script-src')).not.toContain("'unsafe-eval'");
    expect(dir(csp, 'script-src').filter((s) => !s.startsWith("'"))).toEqual([]); // no other script origins
    expect(dir(csp, 'worker-src')).toContain("'self'");
    expect(dir(csp, 'img-src')).toEqual(["'self'", 'data:', 'blob:']);
    expect(dir(csp, 'object-src')).toEqual(["'none'"]);
    expect(dir(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(dir(csp, 'base-uri')).toEqual(["'self'"]);
    expect(dir(csp, 'form-action')).toEqual(["'self'"]);
    expect(csp).toContain('upgrade-insecure-requests');
  });
  it('dev allows eval and the dev websocket; a separate API origin is allowed for calls only', () => {
    const csp = contentSecurityPolicy({ ...prod, dev: true, https: false, apiUrl: 'https://api.example.com/v1' });
    expect(dir(csp, 'script-src')).toContain("'unsafe-eval'");
    expect(dir(csp, 'connect-src')).toEqual(expect.arrayContaining(['https://api.example.com', 'ws:']));
    expect(csp).not.toContain('upgrade-insecure-requests');
    // a relative API base or a missing Supabase URL adds nothing
    expect(dir(contentSecurityPolicy({ ...prod, supabaseUrl: '', apiUrl: '/api' }), 'connect-src')).toEqual(["'self'"]);
    expect(dir(contentSecurityPolicy({ ...prod, supabaseUrl: 'javascript:alert(1)' }), 'connect-src')).toEqual(["'self'"]);
  });
  it('microphone and camera only for this site, everything else off', () => {
    expect(permissionsPolicy(prod)).toContain('microphone=(self)');
    expect(permissionsPolicy(prod)).toContain('camera=(self)');
    expect(permissionsPolicy(prod)).toContain('geolocation=()');
    expect(permissionsPolicy({ microphone: false, camera: false })).toContain('microphone=()');
  });
  it('the full set', () => {
    const h = Object.fromEntries(securityHeaders(prod).map((x) => [x.key, x.value]));
    expect(h['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains; preload');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin');
  });
});
