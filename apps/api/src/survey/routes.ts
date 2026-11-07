/**
 * Validation survey (public form at /survey in the web app; results in the admin portal).
 *   POST /survey          public: one anonymous response (student or teacher version), consent required
 *   GET  /survey/questions public: the question list
 *   GET  /admin/survey    admin: counts per option, scale means, free-text answers
 * Responses are kept in memory and, when SUPABASE_URL + SUPABASE_ANON_KEY are set, inserted into the
 * `survey_responses` table (insert-only for the public key; results read through the survey_results(code) RPC
 * with SURVEY_ADMIN_CODE). See supabase/survey.sql.
 */
import { HTTPException } from 'hono/http-exception';
import { SURVEYS, SURVEY_VERSION_ID, summarizeSurvey, validateSurvey, type SurveyRow } from '@murshid/survey';
import type { Api } from '../lib/router';
import { requireAdmin } from '../admin/routes';
import { clientIp, ipKey, trustFromEnv } from '../lib/security';

export interface SurveySink {
  name: string;
  insert(row: SurveyRow): Promise<void>;
  list(): Promise<SurveyRow[]>;
}

export class MemorySurveySink implements SurveySink {
  readonly name = 'memory';
  rows: SurveyRow[] = [];
  async insert(row: SurveyRow) { this.rows.push(row); }
  async list() { return [...this.rows]; }
}

export class SupabaseSurveySink implements SurveySink {
  readonly name = 'supabase';
  constructor(private url: string, private key: string, private adminCode: string, private f: typeof fetch = fetch) {}
  private headers() { return { apikey: this.key, authorization: `Bearer ${this.key}`, 'content-type': 'application/json' }; }
  async insert(row: SurveyRow) {
    const res = await this.f(`${this.url}/rest/v1/survey_responses`, { method: 'POST', headers: { ...this.headers(), prefer: 'return=minimal' }, body: JSON.stringify({ version: row.version, answers: { ...row.answers, _v: SURVEY_VERSION_ID }, consent: true }) });
    if (!res.ok) throw new Error(`supabase insert ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  async list() {
    if (!this.adminCode) throw new Error('SURVEY_ADMIN_CODE is not set');
    const res = await this.f(`${this.url}/rest/v1/rpc/survey_results`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ code: this.adminCode }) });
    if (!res.ok) throw new Error(`supabase results ${res.status}`);
    return (await res.json()) as SurveyRow[];
  }
}

export function surveySinkFromEnv(env: Record<string, string | undefined>): SurveySink {
  return env.SUPABASE_URL && env.SUPABASE_ANON_KEY
    ? new SupabaseSurveySink(env.SUPABASE_URL.replace(/\/$/, ''), env.SUPABASE_ANON_KEY, env.SURVEY_ADMIN_CODE ?? '')
    : new MemorySurveySink();
}

export function registerSurvey(api: Api, sink: SurveySink, now: () => Date = () => new Date()) {
  const recent = new Map<string, number[]>(); // light per-IP rate limit: 20 responses / 10 min
  const trust = trustFromEnv((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {});
  api.route({ method: 'get', path: '/survey/questions', tag: 'survey', auth: 'none', summary: 'Validation survey questions (student and teacher versions)' },
    (c) => c.json({ version: SURVEY_VERSION_ID, surveys: SURVEYS }));

  api.route({ method: 'post', path: '/survey', tag: 'survey', auth: 'none', summary: 'Submit one anonymous survey response (consent required; no personal data)' }, async (c) => {
    // the real client address (a client-sent x-forwarded-for is not trusted off Vercel)
    const ip = ipKey(clientIp(c, trust));
    const t = now().getTime();
    if (recent.size > 20_000) for (const [k, v] of recent) if (!v.some((x) => t - x < 600_000)) recent.delete(k);
    const hits = (recent.get(ip) ?? []).filter((x) => t - x < 600_000);
    if (hits.length >= 20) throw new HTTPException(429, { message: 'too many responses from this connection; try again later' });
    recent.set(ip, [...hits, t]);
    let body: unknown;
    try { body = await c.req.json(); } catch { throw new HTTPException(400, { message: 'invalid JSON' }); }
    const r = validateSurvey(body);
    if (!r.ok) throw new HTTPException(400, { message: r.error });
    try {
      await sink.insert({ version: r.value.version, answers: r.value.answers, created_at: now().toISOString() });
    } catch (e) {
      console.error('[survey]', (e as Error).message);
      throw new HTTPException(502, { message: 'could not save your response; please try again' });
    }
    return c.json({ ok: true }, 201);
  });

  api.route({ method: 'get', path: '/admin/survey', tag: 'admin', auth: 'custom', summary: 'Survey results: responses per version, counts per option, scale means, free text' }, async (c) => {
    await requireAdmin(c);
    let rows: SurveyRow[];
    try { rows = await sink.list(); } catch (e) {
      // the reason goes to the server log, not to the browser
      console.error('[survey] results', (e as Error).message);
      throw new HTTPException(502, { message: 'the survey results are not available right now', cause: { code: 'survey_store' } });
    }
    return c.json({ store: sink.name, ...summarizeSurvey(rows.filter((r) => (r.answers as Record<string, unknown> | null)?._test !== true).map((r) => ({ ...r, answers: Object.fromEntries(Object.entries(r.answers ?? {}).filter(([k]) => k !== '_v')) }))) });
  });
}
