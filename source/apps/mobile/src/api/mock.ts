import type { GuardianInput, MurshidApi, StudentInput } from './client';
import { startOfWeek as weekStart } from '../lib/dates';
import * as seed from './mockData';
import type {
  Achievement,
  Application,
  AuditLogEntry,
  Connection,
  ConnectionProvider,
  CvTarget,
  CvVersion,
  Goal,
  Guardian,
  JsonResume,
  Material,
  NotificationPrefs,
  Opportunity,
  OpportunityFilter,
  Student,
  Task,
  UploadFile,
} from './types';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const wait = (ms = 180) => new Promise((r) => setTimeout(r, ms));
let counter = 1000;
const uid = (p: string) => `${p}-${++counter}`;
const startOfWeek = () => weekStart(new Date());

/** In-memory adapter with synthetic data. Deterministic, no network, no AI. */
export class MockApi implements MurshidApi {
  readonly kind = 'mock' as const;
  private student: Student | null = null;
  private guardian: Guardian | null = null;
  private goals = clone(seed.seedGoals);
  private milestones = clone(seed.seedMilestones);
  private tasks = clone(seed.seedTasks);
  private events = clone(seed.seedEvents);
  private courses = clone(seed.seedCourses);
  private materials = clone(seed.seedMaterials);
  private opportunities = clone(seed.seedOpportunities);
  private applications = clone(seed.seedApplications);
  private achievements = clone(seed.seedAchievements);
  private connections = clone(seed.seedConnections);
  private prefs = clone(seed.seedNotificationPrefs);
  private log = clone(seed.seedAiLog);

  setAccessToken(_token: string | null) {}

  /** Dev helper: preload the demo student "Aisha Test". */
  useDemoStudent() {
    this.student = clone(seed.demoStudent);
  }
  /** Dev helper used by the consent-pending screen in mock mode. */
  simulateGuardianApproval() {
    if (this.guardian) this.guardian = { ...this.guardian, consent_status: 'granted', verified_at: new Date().toISOString() };
  }

  private audit(actor: string, action: string, resource: string, ai_use_level?: AuditLogEntry['ai_use_level']) {
    this.log.unshift({ id: uid('l'), actor, action, resource, at: new Date().toISOString(), ai_use_level });
  }

  async getMe() {
    await wait();
    return clone(this.student);
  }
  async saveStudent(input: StudentInput) {
    await wait();
    this.student = {
      ...input,
      id: this.student?.id ?? seed.STUDENT_ID,
      auth_user_id: this.student?.auth_user_id ?? 'auth-mock',
      created_at: this.student?.created_at ?? new Date().toISOString(),
    };
    return clone(this.student);
  }
  async listSchools(query?: string) {
    await wait(80);
    const q = query?.trim().toLowerCase();
    return clone(q ? seed.seedSchools.filter((s) => s.name.toLowerCase().includes(q)) : seed.seedSchools);
  }

  async getGuardian() {
    await wait();
    return clone(this.guardian);
  }
  async requestGuardianConsent(input: GuardianInput) {
    await wait(300);
    this.guardian = {
      id: uid('gd'),
      student_id: seed.STUDENT_ID,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      relation: input.relation,
      consent_status: 'pending',
      verified_at: null,
    };
    return clone(this.guardian);
  }

  async getWeekSummary() {
    await wait();
    const from = startOfWeek();
    const to = new Date(from.getTime() + 7 * 86_400_000);
    const inWeek = (iso: string | null) => !!iso && new Date(iso) >= from && new Date(iso) < to;
    const tasks = this.tasks.filter((t) => inWeek(t.due_at)).sort(byDue);
    const deadlines = [
      ...this.materials
        .filter((m) => (m.kind === 'assignment' || m.kind === 'exam') && inWeek(m.due_at))
        .map((m) => ({ id: m.id, title: m.title, due_at: m.due_at!, kind: m.kind as 'assignment' | 'exam' })),
      ...this.applications
        .map((a) => this.opportunities.find((o) => o.id === a.opportunity_id))
        .filter((o): o is Opportunity => !!o && !!o.deadline && new Date(o.deadline) > new Date() && new Date(o.deadline).getTime() < Date.now() + 14 * 86_400_000)
        .map((o) => ({ id: o.id, title: o.title, due_at: o.deadline!, kind: 'application' as const })),
    ].sort((a, b) => a.due_at.localeCompare(b.due_at));
    const fresh = this.opportunities
      .filter((o) => o.status === 'open' && this.isEligible(o))
      .filter((o) => !this.applications.some((a) => a.opportunity_id === o.id))
      .slice(0, 3);
    return clone({
      week_start: from.toISOString(),
      tasks,
      deadlines,
      new_opportunities: fresh,
      goals: this.goals.filter((g) => g.parent_goal_id === null),
    });
  }

  async listGoals() {
    await wait();
    return clone(this.goals);
  }
  async listMilestones(goalId?: string) {
    await wait(80);
    return clone(goalId ? this.milestones.filter((m) => m.goal_id === goalId) : this.milestones);
  }
  async toggleMilestone(id: string, done: boolean) {
    await wait(80);
    const m = this.milestones.find((x) => x.id === id);
    if (!m) throw new Error('Milestone not found');
    m.done = done;
    this.recomputeProgress(m.goal_id);
    return clone(m);
  }
  async createGoal(input: Pick<Goal, 'title' | 'category' | 'parent_goal_id' | 'target_date'>) {
    await wait();
    const g: Goal = { ...input, id: uid('g'), student_id: seed.STUDENT_ID, status: 'active', progress: 0 };
    this.goals.push(g);
    return clone(g);
  }
  private recomputeProgress(goalId: string) {
    // Rule-based: progress = share of done milestones (own + children's).
    const g = this.goals.find((x) => x.id === goalId);
    if (!g) return;
    const ms = this.milestones.filter((m) => m.goal_id === goalId);
    if (ms.length) g.progress = Math.round((ms.filter((m) => m.done).length / ms.length) * 100);
    if (g.parent_goal_id) {
      const kids = this.goals.filter((x) => x.parent_goal_id === g.parent_goal_id);
      const parent = this.goals.find((x) => x.id === g.parent_goal_id);
      if (parent && kids.length) parent.progress = Math.round(kids.reduce((s, k) => s + k.progress, 0) / kids.length);
    }
  }

  async listTasks(from: string, to: string) {
    await wait();
    return clone(this.tasks.filter((t) => t.due_at && t.due_at >= from && t.due_at < to).sort(byDue));
  }
  async updateTask(id: string, patch: Partial<Pick<Task, 'status' | 'due_at'>>) {
    await wait(60);
    const t = this.tasks.find((x) => x.id === id);
    if (!t) throw new Error('Task not found');
    Object.assign(t, patch);
    return clone(t);
  }
  async listEvents(from: string, to: string) {
    await wait(80);
    return clone(this.events.filter((e) => e.start_at >= from && e.start_at < to));
  }

  async listCourses() {
    await wait();
    return clone(this.courses);
  }
  async listMaterials(courseId?: string) {
    await wait(80);
    const list = courseId ? this.materials.filter((m) => m.course_id === courseId) : this.materials;
    return clone([...list].sort((a, b) => b.ingested_at.localeCompare(a.ingested_at)));
  }
  async uploadMaterial(input: { course_id: string; title: string; file: UploadFile }) {
    await wait(500);
    const m: Material = {
      id: uid('mt'),
      course_id: input.course_id,
      title: input.title || input.file.name,
      kind: 'note',
      body_text: null, // AI-LATER: OCR / text extraction happens server-side.
      file_url: input.file.uri,
      due_at: null,
      source: 'manual',
      external_id: null,
      ingested_at: new Date().toISOString(),
    };
    this.materials.unshift(m);
    this.audit('student', 'uploaded material', m.title);
    return clone(m);
  }

  private isEligible(o: Opportunity) {
    const grade = this.student?.grade ?? seed.demoStudent.grade;
    const nat = this.student?.nationality ?? null;
    if (o.min_grade !== null && grade < o.min_grade) return false;
    if (o.max_grade !== null && grade > o.max_grade) return false;
    if (o.nationality_restriction && nat && o.nationality_restriction !== nat) return false;
    return true;
  }
  async listOpportunities(filter: OpportunityFilter = {}) {
    await wait();
    const q = filter.query?.trim().toLowerCase();
    return clone(
      this.opportunities
        .filter((o) => !filter.type || filter.type === 'all' || o.type === filter.type)
        .filter((o) => !filter.freeOnly || o.cost_aed === 0)
        .filter((o) => !filter.eligibleOnly || this.isEligible(o))
        .filter((o) => !q || [o.title, o.organizer, ...o.tags].join(' ').toLowerCase().includes(q))
        .sort((a, b) => (a.status === b.status ? (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999') : a.status === 'open' ? -1 : 1)),
    );
  }
  async getOpportunity(id: string) {
    await wait(80);
    return clone(this.opportunities.find((o) => o.id === id) ?? null);
  }
  async listApplications() {
    await wait();
    return clone(this.applications);
  }
  async saveOpportunity(opportunityId: string) {
    await wait();
    const existing = this.applications.find((a) => a.opportunity_id === opportunityId);
    if (existing) return clone(existing);
    const o = this.opportunities.find((x) => x.id === opportunityId);
    if (!o) throw new Error('Opportunity not found');
    const a: Application = {
      id: uid('a'),
      student_id: seed.STUDENT_ID,
      opportunity_id: opportunityId,
      status: 'saved',
      checklist: seed.defaultChecklist(o),
      notes: '',
      submitted_at: null,
    };
    this.applications.unshift(a);
    return clone(a);
  }
  async updateApplication(id: string, patch: Partial<Pick<Application, 'status' | 'checklist' | 'notes'>>) {
    await wait(60);
    const a = this.applications.find((x) => x.id === id);
    if (!a) throw new Error('Application not found');
    Object.assign(a, patch);
    if (patch.status === 'submitted' && !a.submitted_at) a.submitted_at = new Date().toISOString();
    return clone(a);
  }

  async listAchievements() {
    await wait();
    return clone([...this.achievements].sort((a, b) => b.date.localeCompare(a.date)));
  }
  async addAchievement(input: Omit<Achievement, 'id' | 'student_id'>) {
    await wait();
    const a: Achievement = { ...input, id: uid('ac'), student_id: seed.STUDENT_ID };
    this.achievements.push(a);
    return clone(a);
  }
  async generateCv(target: CvTarget): Promise<CvVersion> {
    await wait(600);
    // AI-LATER: agent rewrites bullets per target. Rule-based mapping to JSON Resume for now.
    const s = this.student ?? seed.demoStudent;
    const school = seed.seedSchools.find((x) => x.id === s.school_id);
    const by = (c: Achievement['category'][]) => this.achievements.filter((a) => c.includes(a.category));
    const json: JsonResume = {
      basics: {
        name: s.full_name,
        label: `Grade ${s.grade} student`,
        summary:
          target === 'university'
            ? `Grade ${s.grade} student interested in ${s.interests.slice(0, 2).join(' and ')}.`
            : target === 'internship'
              ? `Motivated student with strengths in ${s.strengths.join(', ') || 'teamwork'}.`
              : `Student at ${school?.name ?? 'a UAE school'}.`,
        location: { countryCode: 'AE' },
      },
      education: [{ institution: school?.name ?? 'School', studyType: s.curriculum.replace('_', ' ').toUpperCase(), area: `Grade ${s.grade}` }],
      awards: by(['award', 'academic']).map((a) => ({ title: a.title, date: a.date, summary: a.description })),
      projects: by(['project', 'leadership']).map((a) => ({ name: a.title, description: a.description, startDate: a.date })),
      volunteer: by(['volunteering']).map((a) => ({ organization: a.title, summary: a.description, startDate: a.date })),
      work: by(['work']).map((a) => ({ name: a.title, summary: a.description, startDate: a.date })),
      certificates: by(['certificate']).map((a) => ({ name: a.title, date: a.date })),
      skills: s.strengths.map((name) => ({ name })),
      interests: s.interests.map((name) => ({ name })),
      languages: s.languages.map((language) => ({ language })),
    };
    this.audit('cv generator (rule-based)', 'generated CV', target, 'none');
    return { id: uid('cv'), student_id: s.id, template: 'clean', target, json, pdf_url: null, created_at: new Date().toISOString() };
  }

  async listConnections() {
    await wait();
    return clone(this.connections);
  }
  async connect(provider: ConnectionProvider) {
    await wait(500);
    const c = this.connections.find((x) => x.provider === provider) as Connection;
    Object.assign(c, { status: 'connected', token_ref: `vault://mock/${provider}`, last_sync_at: new Date().toISOString() });
    this.audit(`connector:${provider}`, 'connected', provider);
    return { connection: clone(c), authUrl: null };
  }
  async disconnect(provider: ConnectionProvider) {
    await wait(200);
    const c = this.connections.find((x) => x.provider === provider) as Connection;
    Object.assign(c, { status: 'disconnected', token_ref: null, last_sync_at: null });
    this.audit('student', 'disconnected', provider);
    return clone(c);
  }

  async getNotificationPrefs() {
    await wait(80);
    return clone(this.prefs);
  }
  async updateNotificationPrefs(patch: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    await wait(60);
    this.prefs = { ...this.prefs, ...patch, channels: { ...this.prefs.channels, ...(patch.channels ?? {}) } };
    return clone(this.prefs);
  }

  async listAiUseLog() {
    await wait();
    return clone(this.log);
  }
  async exportData() {
    await wait(500);
    this.audit('student', 'requested data export', 'all student data');
    return {
      generated_at: new Date().toISOString(),
      url: null,
      payload: { student: this.student, goals: this.goals, tasks: this.tasks, applications: this.applications, achievements: this.achievements },
    };
  }
  async deleteAccount() {
    await wait(400);
    const when = new Date(Date.now() + 30 * 86_400_000).toISOString();
    this.student = null;
    return { scheduled_for: when };
  }
}

function byDue(a: { due_at: string | null }, b: { due_at: string | null }) {
  return (a.due_at ?? '').localeCompare(b.due_at ?? '');
}
