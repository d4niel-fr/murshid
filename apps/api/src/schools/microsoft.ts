/**
 * School directory connector: how a school's identity provider and class system plug into Murshid.
 *
 * `SchoolDirectoryConnector` is the seam. `SimulatedMicrosoft365` implements it for the demo (no Azure app,
 * no network): a sign-in page Murshid renders itself, a deterministic code exchange, and Teams classes /
 * assignments read from the seeded roster. A production `GraphMicrosoft365` would implement the same
 * interface against Microsoft Entra ID (OAuth 2.0 auth code + PKCE on login.microsoftonline.com) and Graph
 * education endpoints (/education/classes, /education/classes/{id}/members, /education/classes/{id}/assignments,
 * which need EduRoster.ReadBasic + EduAssignments.ReadBasic with tenant admin consent). See
 * packages/connectors/src/providers/microsoft/graph.ts for the scopes and normalizers already written for that.
 */
import type { Org, RosterStudent, Stream, Teacher } from './catalog';

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student' | 'school_admin';
  orgId: string;
  /** Murshid ids this identity maps to */
  teacherId?: string;
  rosterId?: string;
  appId?: string | null;
}

export interface DirectoryClass { teamsClassId: string; name: string; teacherEmail: string; members: number }

export interface SchoolDirectoryConnector {
  readonly id: 'microsoft365';
  readonly label: string;
  readonly simulated: boolean;
  /** URL the user is sent to for sign-in (or school-wide admin consent). */
  authorizeUrl(input: { orgId: string; role: 'teacher' | 'student' | 'school_admin'; state: string; adminConsent?: boolean }): string;
  /** Accounts offered on the sign-in page (simulated connector only). */
  accounts(orgId: string): DirectoryUser[];
  /** Exchange the code from the redirect for the signed-in identity. */
  exchangeCode(code: string): DirectoryUser | null;
  /** Read classes and assignments for the tenant (Teams). */
  listClasses(orgId: string): DirectoryClass[];
}

export class SimulatedMicrosoft365 implements SchoolDirectoryConnector {
  readonly id = 'microsoft365' as const;
  readonly label = 'Microsoft 365 (simulated for the demo)';
  readonly simulated = true;
  constructor(private readonly src: { orgs: () => Org[]; teachers: () => Teacher[]; roster: () => RosterStudent[]; streams: () => Stream[]; members: () => Record<string, string[]> }) {}

  authorizeUrl({ orgId, role, state, adminConsent }: { orgId: string; role: string; state: string; adminConsent?: boolean }): string {
    const q = new URLSearchParams({ org: orgId, role, state, ...(adminConsent ? { prompt: 'admin_consent' } : {}) });
    // rendered by Murshid itself; a real connector would point at login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize
    return `/microsoft/sign-in?${q.toString()}`;
  }

  accounts(orgId: string): DirectoryUser[] {
    const org = this.src.orgs().find((o) => o.id === orgId);
    if (!org?.microsoft) return [];
    const teachers = this.src.teachers().filter((t) => t.orgId === orgId && t.portal).map((t): DirectoryUser => ({ id: `ms-${t.id}`, name: t.name, email: t.email, role: 'teacher', orgId, teacherId: t.id }));
    const students = this.src.roster().filter((s) => s.orgId === orgId && s.appId).map((s): DirectoryUser => ({
      id: `ms-${s.id}`, name: s.name, email: `${s.name.toLowerCase().replace(/[^a-z]+/g, '.')}@${org.microsoft!.domain}`, role: 'student', orgId, rosterId: s.id, appId: s.appId,
    }));
    const admin: DirectoryUser = { id: `ms-admin-${orgId}`, name: 'Murshid pilot lead', email: `pilot.lead@${org.microsoft.domain}`, role: 'school_admin', orgId };
    return [...teachers, ...students, admin];
  }

  exchangeCode(code: string): DirectoryUser | null {
    // simulated code = "sim:<directory user id>"
    if (!code.startsWith('sim:')) return null;
    const id = code.slice(4);
    for (const o of this.src.orgs()) {
      const hit = this.accounts(o.id).find((a) => a.id === id);
      if (hit) return hit;
    }
    return null;
  }

  listClasses(orgId: string): DirectoryClass[] {
    const members = this.src.members();
    return this.src.streams().filter((s) => s.orgId === orgId).map((s) => ({
      teamsClassId: s.teamsClassId, name: s.name, teacherEmail: this.src.teachers().find((t) => t.id === s.teacherId)?.email ?? '', members: members[s.id]?.length ?? 0,
    }));
  }
}
