/**
 * The shared in-memory store behind the student API (/dashboard, /academics, /chat …) and the admin portal
 * (/admin/*). Generated history (cached per Dubai day and profile version) plus everything staff, the student
 * or Murshid changed: one source of truth, so an admin edit is visible to the student app and the agent at once.
 */
import {
  DEMO_STUDENT_IDS, PROFILE_LINK_KEYS, type ActivitySession, type AssessmentResult, type ProfileLinkKey, type ProfileLinks,
} from '@murshid/core';
import { addDays, dubaiDate } from '../lib/time';
import { generateDemoData, type DemoData, type DemoTask } from './data';
import { DEMO_PROFILES, bandForGrade, type CvFields, type DemoProfile, type OppDef } from './profiles';
import type { LinkedInPack } from './linkedin';

export interface Application {
  id: string;
  opportunityId: string | null;
  title: string;
  organizer: string;
  type: string;
  status: 'saved' | 'preparing' | 'submitted' | 'accepted' | 'rejected';
  outcome: string | null;
  appliedAt: string | null;
  updatedAt: string;
  source: 'generated' | 'admin' | 'murshid' | 'student';
}
export interface Milestone { id: string; title: string; date: string; done: boolean; source: Application['source'] }
export interface SideProject {
  id: string;
  name: string;
  tagline: string;
  kind: 'business' | 'app' | 'club' | 'creative' | 'research';
  role: string;
  startDate: string;
  url: string | null;
  status: 'active' | 'paused' | 'done';
  skills: string[];
  milestones: Milestone[];
}
export interface Achievement {
  id: string;
  title: string;
  category: 'academic' | 'award' | 'sport' | 'project' | 'volunteering' | 'work' | 'certificate' | 'leadership';
  date: string;
  description: string;
  source: Application['source'];
}
export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  actorRole: 'admin' | 'agent' | 'student' | 'guardian';
  studentId: string | null;
  action: 'create' | 'update' | 'delete' | 'publish';
  resource: string;
  resourceId: string;
  summary: string;
  changes?: Record<string, unknown>;
}
/** Opportunity in the admin catalog, published to all students in a grade range or to listed students. */
export interface CatalogOpportunity extends OppDef {
  audience: { studentIds: string[] | 'all'; minGrade: number; maxGrade: number };
  status: 'draft' | 'published' | 'closed';
  createdAt: string;
}

export interface StudentRecord {
  profile: DemoProfile;
  version: number;
  sessionsAdded: ActivitySession[];
  sessionEdits: Map<string, ActivitySession | null>;
  assessmentsAdded: AssessmentResult[];
  assessmentEdits: Map<string, AssessmentResult | null>;
  customTasks: DemoTask[];
  taskStatus: Record<string, 'todo' | 'done'>;
  hiddenTasks: string[];
  applications: Application[];
  projects: SideProject[];
  achievements: Achievement[];
  cv: CvFields;
  links: ProfileLinks | null;
  createdBy: 'seed' | 'admin';
  /** latest generated LinkedIn pack (career agent / student / admin) */
  linkedin?: LinkedInPack;
}

export interface DemoView {
  profile: DemoProfile;
  data: DemoData;
  /** generated + logged sessions (with edits), ascending by date */
  sessions: ActivitySession[];
  now: Date;
  record: StudentRecord;
}

const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'student';

export function defaultCv(p: DemoProfile): CvFields {
  return {
    headline: `${p.classLabel} student at ${p.school}`,
    summary: '',
    email: null,
    phone: null,
    location: `${p.emirate === 'abu_dhabi' ? 'Abu Dhabi' : p.emirate === 'sharjah' ? 'Sharjah' : 'Dubai'}, UAE`,
    skills: [],
    certifications: [],
    featured: [],
    predicted: null,
    universityGoal: null,
    ...p.cv,
  };
}

export class DemoStore {
  private records = new Map<string, StudentRecord>();
  private cache = new Map<string, { key: string; data: DemoData }>();
  private order: string[] = [...DEMO_STUDENT_IDS];
  readonly catalog: CatalogOpportunity[] = [];
  readonly auditLog: AuditEntry[] = [];
  private seq = 0;

  private readonly seedProfiles: Record<string, DemoProfile>;
  constructor(seedProfiles: Record<string, DemoProfile> = DEMO_PROFILES) {
    this.seedProfiles = { ...seedProfiles };
  }

  nextId(prefix: string): string {
    return `${prefix}-${(++this.seq).toString(36)}${Date.now().toString(36).slice(-3)}`;
  }

  ids(): string[] { return [...this.order]; }
  has(id: string): boolean { return this.order.includes(id); }

  /** The mutable record for a student (created from the seed profile on first use). */
  record(id: string, now: Date): StudentRecord {
    let rec = this.records.get(id);
    if (rec) return rec;
    const seed = this.seedProfiles[id];
    if (!seed) throw new Error(`unknown student ${id}`);
    const today = dubaiDate(now);
    const profile = structuredClone(seed);
    rec = {
      profile, version: 0, sessionsAdded: [], sessionEdits: new Map(), assessmentsAdded: [], assessmentEdits: new Map(),
      customTasks: [], taskStatus: {}, hiddenTasks: [], links: null, createdBy: 'seed',
      applications: (profile.pastOpportunities ?? []).map((o, i) => ({
        id: `${id}-app${i + 1}`, opportunityId: null, title: o.title, organizer: o.organizer, type: o.type, status: o.status,
        outcome: o.outcome ?? null, appliedAt: addDays(today, o.appliedInDays), updatedAt: addDays(today, Math.min(0, o.appliedInDays + 35)), source: 'generated' as const,
      })),
      projects: (profile.projects ?? []).map((p) => ({
        id: p.id, name: p.name, tagline: p.tagline, kind: p.kind, role: p.role, startDate: addDays(today, p.startInDays), url: p.url ?? null,
        status: 'active' as const, skills: p.skills,
        milestones: p.milestones.map((ms, i) => ({ id: `${p.id}-m${i + 1}`, title: ms.title, date: addDays(today, ms.inDays), done: ms.done ?? ms.inDays <= 0, source: 'generated' as const })),
      })),
      achievements: (profile.achievements ?? []).map((a, i) => ({ id: `${id}-ach${i + 1}`, title: a.title, category: a.category, date: addDays(today, a.inDays), description: a.description, source: 'generated' as const })),
      cv: defaultCv(profile),
    };
    this.records.set(id, rec);
    return rec;
  }

  /** Create a new student (admin portal). Starts with no generated history. */
  createStudent(input: Omit<DemoProfile, 'id' | 'band' | 'subjects' | 'activities' | 'goals' | 'links' | 'opportunities' | 'studyStreakDays'> & Partial<Pick<DemoProfile, 'studyStreakDays'>>, now: Date): StudentRecord {
    let id = `stu-${slug(input.name)}`;
    for (let n = 2; this.has(id); n++) id = `stu-${slug(input.name)}-${n}`;
    const profile: DemoProfile = {
      ...input, id, band: bandForGrade(input.grade), subjects: [], activities: [], goals: [], links: {}, opportunities: [],
      studyStreakDays: input.studyStreakDays ?? 0,
    };
    this.seedProfiles[id] = profile;
    this.order.push(id);
    const rec = this.record(id, now);
    rec.createdBy = 'admin';
    return rec;
  }

  deleteStudent(id: string): boolean {
    if (!this.has(id) || (DEMO_STUDENT_IDS as readonly string[]).includes(id)) return false;
    this.order = this.order.filter((x) => x !== id);
    this.records.delete(id);
    this.cache.delete(id);
    delete this.seedProfiles[id];
    return true;
  }

  /** Bump after editing profile fields that feed generation (subjects, activities, projects, grade). */
  touch(id: string): void {
    const rec = this.records.get(id);
    if (rec) rec.version++;
  }

  catalogFor(p: DemoProfile): OppDef[] {
    return this.catalog
      .filter((o) => o.status === 'published')
      .filter((o) => (o.audience.studentIds === 'all' ? p.grade >= o.audience.minGrade && p.grade <= o.audience.maxGrade : o.audience.studentIds.includes(p.id)))
      .map(({ audience: _a, status: _s, createdAt: _c, ...o }) => o);
  }

  view(id: string, now: Date): DemoView {
    const rec = this.record(id, now);
    const today = dubaiDate(now);
    const key = `${today}:${rec.version}`;
    let hit = this.cache.get(id);
    if (!hit || hit.key !== key) {
      hit = { key, data: generateDemoData(rec.profile, today) };
      this.cache.set(id, hit);
    }
    const base = hit.data;
    const assessments = [
      ...base.assessments.map((a) => (rec.assessmentEdits.has(a.id) ? rec.assessmentEdits.get(a.id)! : a)).filter((a): a is AssessmentResult => a !== null),
      ...rec.assessmentsAdded.map((a) => (rec.assessmentEdits.has(a.id) ? rec.assessmentEdits.get(a.id)! : a)).filter((a): a is AssessmentResult => a !== null),
    ].map((a) => ({ ...a, status: (a.score === null ? 'upcoming' : 'graded') as AssessmentResult['status'] }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.subjectId.localeCompare(b.subjectId));
    const data: DemoData = {
      ...base, assessments, customTasks: rec.customTasks, taskStatus: rec.taskStatus, hiddenTasks: rec.hiddenTasks,
    };
    const sessions = [...base.sessions, ...rec.sessionsAdded]
      .map((s) => (rec.sessionEdits.has(s.id) ? rec.sessionEdits.get(s.id)! : s))
      .filter((s): s is ActivitySession => s !== null)
      .sort((a, b) => a.date.localeCompare(b.date) || a.activityId.localeCompare(b.activityId));
    const profile: DemoProfile = { ...rec.profile, opportunities: [...rec.profile.opportunities, ...this.catalogFor(rec.profile)] };
    return { profile, data, sessions, now, record: rec };
  }

  // ---------- sessions ----------
  logSession(id: string, s: Omit<ActivitySession, 'id'>, now = new Date()): ActivitySession {
    const session: ActivitySession = { ...s, id: `${id}-${s.activityId}-log${++this.seq}` };
    this.record(id, now).sessionsAdded.push(session);
    return session;
  }

  // ---------- links ----------
  getLinks(id: string, now = new Date()): ProfileLinks {
    const rec = this.record(id, now);
    if (!rec.links) {
      const p = rec.profile;
      const base = Object.fromEntries(PROFILE_LINK_KEYS.map((k) => [k, p.links[k] ?? null])) as Record<ProfileLinkKey, string | null>;
      const seededAt = 'Tue 2026-09-01 9:00 AM (UTC+04:00)';
      const connectedAt = Object.fromEntries(PROFILE_LINK_KEYS.map((k) => [k, p.links[k] ? seededAt : null]));
      rec.links = { ...base, connectedAt, updatedAt: Object.keys(p.links).length ? seededAt : null };
    }
    return structuredClone(rec.links);
  }

  setLinks(id: string, next: ProfileLinks, now = new Date()): ProfileLinks {
    this.record(id, now).links = structuredClone(next);
    return structuredClone(next);
  }

  // ---------- audit ----------
  audit(e: Omit<AuditEntry, 'id' | 'at'> & { at?: string }): AuditEntry {
    const entry: AuditEntry = { id: `audit-${this.auditLog.length + 1}`, at: e.at ?? new Date().toISOString(), ...e };
    this.auditLog.push(entry);
    return entry;
  }
}
