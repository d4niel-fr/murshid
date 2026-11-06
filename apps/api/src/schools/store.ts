/**
 * Tenancy + school state: orgs (families and institutions), accounts, which tenant each app student belongs
 * to, the synthetic school roster, assignments teachers post, and the Microsoft 365 connection.
 */
import { familyOrg, DEMO_SCHOOL, PLANS, seedAccounts, seedOrgs, seedRoster, seedStreams, STUDENT_TENANT, TEACHERS, type Account, type LicenceType, type Org, type PlanId, type RosterStudent, type Stream, type Teacher } from './catalog';
import type { School, WorkItem } from './engine';
import { ClassroomStore } from './classroom';
import { SchoolLife } from './life';
import { SimulatedMicrosoft365, type SchoolDirectoryConnector } from './microsoft';

export interface StudentLicence {
  type: LicenceType;
  orgId: string;
  orgName: string;
  parentOrgName: string | null;
  plan: PlanId;
  planName: string;
  boughtBy: 'parent' | 'student' | 'school';
  status: string;
  connectedVia: 'microsoft365' | 'portal' | null;
}

export class SchoolStore {
  readonly orgs: Org[] = seedOrgs();
  readonly accounts: Account[] = seedAccounts();
  readonly tenant: Record<string, string> = { ...STUDENT_TENANT };
  readonly roster: RosterStudent[] = seedRoster();
  readonly teachers: Teacher[] = TEACHERS.map((t) => ({ ...t }));
  readonly streams: Stream[];
  readonly members: Record<string, string[]>;
  readonly posted: WorkItem[] = [];
  /** automated follow-ups per posted item, per roster student (see automation.ts) */
  readonly automations: Record<string, Record<string, import('./automation').ReplanResult>> = {};
  /** built-in form answers: assignment id -> roster student id -> response (one per student) */
  readonly responses: Record<string, Record<string, import('./engine').FormResponse>> = {};
  /** index: assignment id -> posted item (O(1) lookups instead of scanning every post) */
  readonly postedById = new Map<string, WorkItem>();
  readonly microsoft: SchoolDirectoryConnector;
  /** files, hand-ins, messages, announcements and reminders (see classroom.ts) */
  readonly classroom = new ClassroomStore();
  /** feelings, timetable, attendance, points, polls, events, term reports (see life.ts) */
  readonly life = new SchoolLife();
  private seq = 0;

  constructor() {
    const s = seedStreams(this.roster);
    this.streams = s.streams;
    this.members = s.members;
    this.microsoft = new SimulatedMicrosoft365({
      orgs: () => this.orgs, teachers: () => this.teachers, roster: () => this.roster, streams: () => this.streams, members: () => this.members,
    });
  }

  nextId(prefix: string) { return `${prefix}-${(++this.seq).toString(36)}${Date.now().toString(36).slice(-4)}`; }

  org(id: string): Org | undefined { return this.orgs.find((o) => o.id === id); }

  /** School view for the engine (only one institution has a roster in the demo). */
  school(orgId: string): School {
    const org = this.org(orgId);
    return {
      roster: this.roster.filter((s) => s.orgId === orgId),
      streams: this.streams.filter((s) => s.orgId === orgId),
      members: this.members,
      teachers: this.teachers.filter((t) => t.orgId === orgId),
      posted: this.posted,
      teamsConnected: Boolean(org?.microsoft?.connected),
      real: Boolean(org?.real),
    };
  }

  /** Tenant + licence of an app student. Students created in the school portal belong to the portal's school. */
  licenceOf(studentId: string): StudentLicence {
    const orgId = this.tenant[studentId] ?? DEMO_SCHOOL;
    const org = this.org(orgId)!;
    const lic = org.licence!;
    const parent = org.parentOrgId ? this.org(org.parentOrgId) : undefined;
    return {
      type: lic.type, orgId, orgName: org.name, parentOrgName: parent?.name ?? null, plan: lic.plan,
      planName: PLANS.find((p) => p.id === lic.plan)?.name ?? lic.plan, boughtBy: lic.boughtBy, status: lic.status,
      connectedVia: lic.type === 'institution' ? (org.microsoft?.connected ? 'microsoft365' : 'portal') : null,
    };
  }

  rosterByApp(appId: string): RosterStudent | undefined { return this.roster.find((r) => r.appId === appId); }

  createFamily(name: string, boughtBy: 'parent' | 'student', plan: 'single', today: string): Org {
    const org = familyOrg(this.nextId('fam'), name, boughtBy, plan, today);
    this.orgs.push(org);
    return org;
  }

  addAccount(a: Omit<Account, 'id'>): Account {
    const acc = { ...a, id: this.nextId(`acc-${a.role}`) };
    this.accounts.push(acc);
    return acc;
  }
}
