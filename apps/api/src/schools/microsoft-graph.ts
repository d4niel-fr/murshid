/**
 * Microsoft 365 for real schools (on when MS_CLIENT_ID and MS_CLIENT_SECRET are set). People sign in with their school
 * Microsoft account through Supabase (the Azure provider). This connector is the school-wide part: the school's IT
 * admin approves Murshid once for their tenant (admin consent), then Murshid reads Teams classes, their teachers and
 * students, and assignments with Microsoft Graph (app permissions EduRoster.Read.All, EduAssignments.ReadBasic.All,
 * User.Read.All), and fills the same records the school admin can also edit by hand.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { realRosterStudent } from './accounts';
import { SUBJECT_IDS, type Org, type Stream, type SubjectId } from './catalog';
import type { WorkItem } from './engine';
import type { SchoolStore } from './store';

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export interface GraphConfig { clientId: string; clientSecret: string; redirectUri: string; stateSecret: string }

export function graphFromEnv(env: Record<string, string | undefined>): GraphConfig | null {
  const clientId = env.MS_CLIENT_ID?.trim(); const clientSecret = env.MS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  const api = (env.PUBLIC_API_URL?.trim() || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}/api` : 'http://localhost:8787')).replace(/\/+$/, '');
  return { clientId, clientSecret, redirectUri: env.MS_CONSENT_REDIRECT_URI?.trim() || `${api}/auth/microsoft/consent-callback`, stateSecret: env.MS_STATE_SECRET?.trim() || clientSecret };
}

/** Guess the subject from a class name ("Grade 10 Physics - 10B" -> physics). */
export function subjectFromName(name: string): SubjectId {
  const n = name.toLowerCase();
  const pairs: [RegExp, SubjectId][] = [
    [/math/, 'maths'], [/physic/, 'physics'], [/chem/, 'chemistry'], [/bio/, 'biology'], [/econ/, 'economics'], [/business/, 'business'],
    [/comput|ict|\bcs\b|coding/, 'cs'], [/arab|عرب/, 'arabic'], [/islam/, 'islamic'], [/social|moral/, 'social'], [/french/, 'french'], [/histor/, 'history'],
    [/geog/, 'geography'], [/science/, 'science'], [/\bpe\b|physical/, 'pe'], [/\bart\b|design/, 'art'], [/music/, 'music'], [/english|literature/, 'english'],
  ];
  return pairs.find(([re]) => re.test(n))?.[1] ?? 'other';
}

export class GraphConnector {
  constructor(readonly cfg: GraphConfig, private f: FetchLike = fetch) {}

  /** A tamper-proof state for the consent round trip (which school, and when). */
  state(orgId: string, now = Date.now()) {
    const body = `${orgId}.${now}`;
    return `${body}.${createHmac('sha256', this.cfg.stateSecret).update(body).digest('base64url')}`;
  }
  readState(state: string, now = Date.now()): string | null {
    const parts = state.split('.'); if (parts.length !== 3) return null;
    const [orgId, at, sig] = parts as [string, string, string];
    const want = createHmac('sha256', this.cfg.stateSecret).update(`${orgId}.${at}`).digest('base64url');
    const a = Buffer.from(sig); const b = Buffer.from(want);
    if (a.length !== b.length || !timingSafeEqual(a, b) || now - Number(at) > 30 * 60_000) return null;
    return orgId;
  }
  consentUrl(orgId: string) {
    const q = new URLSearchParams({ client_id: this.cfg.clientId, redirect_uri: this.cfg.redirectUri, state: this.state(orgId) });
    return `https://login.microsoftonline.com/organizations/adminconsent?${q}`;
  }

  private async token(tenant: string): Promise<string> {
    const res = await this.f(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }).toString(),
    });
    const j = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string };
    if (!res.ok || !j.access_token) throw new Error(`Microsoft sign-in for the school failed: ${j.error_description?.split('\n')[0] ?? res.status}`);
    return j.access_token;
  }
  /** Every page of a Graph list. */
  private async all<T>(tok: string, url: string, max = 50): Promise<T[]> {
    const out: T[] = []; let next: string | undefined = url;
    for (let i = 0; next && i < max; i++) {
      const res = await this.f(next, { headers: { authorization: `Bearer ${tok}` } });
      if (!res.ok) throw new Error(`Microsoft Graph ${res.status} for ${new URL(next).pathname}`);
      const j = (await res.json()) as { value: T[]; '@odata.nextLink'?: string };
      out.push(...j.value); next = j['@odata.nextLink'];
    }
    return out;
  }

  /** Read Teams classes, teachers, students and assignments into the school (adds and updates; removes nothing). */
  async sync(schools: SchoolStore, org: Org, today: string) {
    const tenant = org.microsoft?.tenantId; if (!tenant) throw new Error('the school has not approved Murshid in Microsoft yet');
    const tok = await this.token(tenant);
    type U = { id: string; displayName: string; mail?: string | null; userPrincipalName?: string };
    const email = (u: U) => (u.mail || u.userPrincipalName || '').toLowerCase();
    const classes = await this.all<{ id: string; displayName: string }>(tok, 'https://graph.microsoft.com/v1.0/education/classes?$select=id,displayName');
    let teachers = 0; let students = 0; let assignments = 0;
    for (const k of classes.slice(0, 400)) {
      const [ts, ms] = await Promise.all([
        this.all<U>(tok, `https://graph.microsoft.com/v1.0/education/classes/${k.id}/teachers?$select=id,displayName,mail,userPrincipalName`),
        this.all<U>(tok, `https://graph.microsoft.com/v1.0/education/classes/${k.id}/members?$select=id,displayName,mail,userPrincipalName`),
      ]);
      const lead = ts[0];
      let teacher = lead ? schools.teachers.find((t) => t.orgId === org.id && t.email.toLowerCase() === email(lead)) : undefined;
      if (lead && !teacher) { teacher = { id: schools.nextId('tch'), orgId: org.id, name: lead.displayName, email: email(lead), subject: subjectFromName(k.displayName), portal: true }; schools.teachers.push(teacher); teachers++; }
      if (!teacher) continue;
      let st = schools.streams.find((s) => s.orgId === org.id && s.teamsClassId === k.id);
      if (!st) { st = { id: schools.nextId('cls'), orgId: org.id, subject: subjectFromName(k.displayName), teacherId: teacher.id, name: k.displayName, setDays: [1, 3], minutes: 40, teamsClassId: k.id } as Stream; schools.streams.push(st); }
      else { st.name = k.displayName; st.teacherId = teacher.id; }
      const memberIds = new Set(schools.members[st.id] ?? []);
      for (const m of ms.filter((x) => !ts.some((t) => t.id === x.id))) {
        const e = email(m); if (!e) continue;
        let r = schools.roster.find((x) => x.orgId === org.id && x.email?.toLowerCase() === e);
        if (!r) { r = realRosterStudent(schools, org.id, { name: m.displayName, grade: Number(/\b(\d{1,2})\b/.exec(k.displayName)?.[1]) || 10, email: e }); schools.roster.push(r); students++; }
        memberIds.add(r.id);
      }
      schools.members[st.id] = [...memberIds];
      // published assignments come in as work in Murshid (once each)
      const work = await this.all<{ id: string; displayName: string; dueDateTime?: string | null; status?: string; instructions?: { content?: string } }>(tok, `https://graph.microsoft.com/v1.0/education/classes/${k.id}/assignments?$select=id,displayName,dueDateTime,status,instructions`, 10).catch(() => []);
      for (const a of work.filter((x) => x.status === 'assigned' && x.dueDateTime)) {
        const id = `${st.id}-teams-${a.id}`;
        if (schools.postedById.has(id)) continue;
        const due = a.dueDateTime!.slice(0, 10);
        if (due < today) continue;
        const item: WorkItem = { id, streamId: st.id, subject: st.subject, teacherId: st.teacherId, title: a.displayName.slice(0, 140), instructions: (a.instructions?.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000) || null,
          setDate: today, dueDate: due, dueTime: a.dueDateTime!.slice(11, 16) || '08:00', minutes: st.minutes, source: 'teams', posted: true, createdAt: new Date().toISOString() };
        schools.posted.push(item); schools.postedById.set(item.id, item); assignments++;
      }
    }
    return { classes: classes.length, teachers, students, assignments };
  }
}

export const SUBJECTS = SUBJECT_IDS;
