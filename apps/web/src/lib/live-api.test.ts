/** Contract check against a running API. Skipped unless MURSHID_API_LIVE=http://host:port is set. */
import { describe, expect, it } from 'vitest';
import { BAND_IDS } from './bands';
import { createClient } from './api';

const base = process.env.MURSHID_API_LIVE;

describe.skipIf(!base)('live API (MURSHID_API_LIVE)', () => {
  it.each(BAND_IDS)('serves %s through the typed client', async (band) => {
    const c = createClient({ band, baseUrl: base, timeoutMs: 5000 });
    const d = await c.getDashboard();
    expect(d.source).toBe('api');
    expect(d.data.band).toBe(band);
    const p = await c.getProgress('academics', '12w');
    expect(p.source).toBe('api');
    const a = await c.getAcademics();
    expect(a.source).toBe('api');
    expect(a.data.subjects.length).toBeGreaterThan(0);
    const l = await c.getProfileLinks();
    expect(l.source).toBe('api');
    const chat = await c.chat('Show my progress in maths');
    expect(chat.source).toBe('api');
    expect(chat.data.text.length).toBeGreaterThan(0);
  });
});
