import { describe, expect, it } from 'vitest';
import { assertPublicUrl, assertResolvesPublic, guardedFetch, isPrivateAddress } from '../src/core/net-guard';
import { assertSafeIcsUrl } from '../src/providers/ics/connector';

const publicDns = async () => [{ address: '93.184.216.34' }];

describe('SSRF guard', () => {
  it('knows private, loopback, link-local, metadata and reserved addresses in every spelling', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255',
      '::', '::1', 'fc00::1', 'fd12:3456::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '64:ff9b::a9fe:a9fe', '2002:7f00:1::1', '2001:db8::1', 'not-an-ip']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['93.184.216.34', '8.8.8.8', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it('refuses bad URLs before any lookup', () => {
    for (const u of ['ftp://x.example/a', 'file:///etc/passwd', 'gopher://x.example', 'https://user:pw@x.example/', 'https://x.example:22/', 'https://localhost/', 'https://db.internal/',
      'https://printer.local/', 'https://intranet/', 'https://127.0.0.1/', 'https://2130706433/', 'https://0x7f.1/', 'https://[::1]/', 'https://[::ffff:169.254.169.254]/', 'https://169.254.169.254./latest']) {
      expect(() => assertPublicUrl(u), u).toThrow();
    }
    expect(assertPublicUrl('https://calendar.google.com/calendar/ical/x/basic.ics').hostname).toBe('calendar.google.com');
    expect(() => assertSafeIcsUrl('http://school.example/a.ics')).toThrow();
    expect(assertSafeIcsUrl('webcal://school.example/a.ics')).toBe('https://school.example/a.ics');
  });

  it('refuses a public-looking name that resolves to a private address', async () => {
    await expect(assertResolvesPublic(new URL('https://evil.example/'), async () => [{ address: '93.184.216.34' }, { address: '10.0.0.1' }])).rejects.toThrow();
    await expect(assertResolvesPublic(new URL('https://ok.example/'), publicDns)).resolves.toBeUndefined();
  });

  it('checks every redirect again', async () => {
    const calls: string[] = [];
    const fake = (async (u: string) => {
      calls.push(u);
      if (u.startsWith('https://feed.example/')) return new Response('', { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
      return new Response('ok');
    }) as typeof fetch;
    await expect(guardedFetch('https://feed.example/cal.ics', {}, { fetch: fake, lookup: publicDns })).rejects.toThrow();
    expect(calls).toEqual(['https://feed.example/cal.ics']);
    const ok = (async (u: string) => (u.endsWith('/a') ? new Response('', { status: 301, headers: { location: '/b' } }) : new Response('fine'))) as typeof fetch;
    expect(await (await guardedFetch('https://feed.example/a', {}, { fetch: ok, lookup: publicDns })).text()).toBe('fine');
    const loop = (async () => new Response('', { status: 302, headers: { location: '/again' } })) as typeof fetch;
    await expect(guardedFetch('https://feed.example/a', {}, { fetch: loop, lookup: publicDns, maxRedirects: 2 })).rejects.toThrow('too many redirects');
  });
});
