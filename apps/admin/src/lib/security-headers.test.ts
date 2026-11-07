import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, securityHeaders } from './security-headers';

describe('portal security headers', () => {
  it('strict CSP with Supabase, no framing, and no microphone or camera', () => {
    const o = { dev: false, https: true, supabaseUrl: 'https://abc.supabase.co', microphone: false, camera: false };
    const csp = contentSecurityPolicy(o);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("connect-src 'self' https://abc.supabase.co wss://abc.supabase.co");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-eval');
    const h = Object.fromEntries(securityHeaders(o).map((x) => [x.key, x.value]));
    expect(h['Permissions-Policy']).toContain('microphone=()');
    expect(h['Permissions-Policy']).toContain('camera=()');
    expect(h['X-Frame-Options']).toBe('DENY');
  });
});
