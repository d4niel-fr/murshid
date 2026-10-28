import { ApiError, type GuardianInput, type MurshidApi, type StudentInput } from './client';
import type {
  Achievement,
  Application,
  AuditLogEntry,
  CalendarEvent,
  Connection,
  ConnectionProvider,
  Course,
  CvTarget,
  CvVersion,
  DataExport,
  Goal,
  Guardian,
  Material,
  Milestone,
  NotificationPrefs,
  Opportunity,
  OpportunityFilter,
  School,
  Student,
  Task,
  UploadFile,
  WeekSummary,
} from './types';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** REST adapter for apps/api. Paths are the app team's proposal; see README → Integration notes. */
export class HttpApi implements MurshidApi {
  readonly kind = 'http' as const;
  private token: string | null = null;

  constructor(private baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  setAccessToken(token: string | null) {
    this.token = token;
  }

  private async req<T>(method: Method, path: string, body?: unknown, query?: Record<string, string | boolean | undefined>): Promise<T> {
    const qs = query
      ? '?' +
        Object.entries(query)
          .filter(([, v]) => v !== undefined && v !== '')
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    const res = await fetch(`${this.baseUrl}/v1${path}${qs}`, { method, headers, body: payload });
    const text = await res.text();
    const json = text ? safeJson(text) : undefined;
    if (!res.ok) throw new ApiError(`${method} ${path} failed (${res.status})`, res.status, json);
    return json as T;
  }

  getMe = () => this.req<Student | null>('GET', '/me');
  saveStudent = (input: StudentInput) => this.req<Student>('PUT', '/me', input);
  listSchools = (query?: string) => this.req<School[]>('GET', '/schools', undefined, { q: query });

  getGuardian = () => this.req<Guardian | null>('GET', '/me/guardian');
  requestGuardianConsent = (input: GuardianInput) => this.req<Guardian>('POST', '/me/guardian/consent-request', input);

  getWeekSummary = () => this.req<WeekSummary>('GET', '/me/week');

  listGoals = () => this.req<Goal[]>('GET', '/goals');
  listMilestones = (goalId?: string) => this.req<Milestone[]>('GET', '/milestones', undefined, { goal_id: goalId });
  toggleMilestone = (id: string, done: boolean) => this.req<Milestone>('PATCH', `/milestones/${id}`, { done });
  createGoal = (input: Pick<Goal, 'title' | 'category' | 'parent_goal_id' | 'target_date'>) => this.req<Goal>('POST', '/goals', input);

  listTasks = (from: string, to: string) => this.req<Task[]>('GET', '/tasks', undefined, { from, to });
  updateTask = (id: string, patch: Partial<Pick<Task, 'status' | 'due_at'>>) => this.req<Task>('PATCH', `/tasks/${id}`, patch);
  listEvents = (from: string, to: string) => this.req<CalendarEvent[]>('GET', '/calendar-events', undefined, { from, to });

  listCourses = () => this.req<Course[]>('GET', '/courses');
  listMaterials = (courseId?: string) => this.req<Material[]>('GET', '/materials', undefined, { course_id: courseId });
  uploadMaterial = (input: { course_id: string; title: string; file: UploadFile }) => {
    const form = new FormData();
    form.append('course_id', input.course_id);
    form.append('title', input.title);
    // React Native FormData accepts {uri,name,type}; web pickers give a blob/data URI uri as well.
    form.append('file', { uri: input.file.uri, name: input.file.name, type: input.file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
    return this.req<Material>('POST', '/materials/upload', form);
  };

  listOpportunities = (filter?: OpportunityFilter) =>
    this.req<Opportunity[]>('GET', '/opportunities', undefined, {
      type: filter?.type && filter.type !== 'all' ? filter.type : undefined,
      q: filter?.query,
      free: filter?.freeOnly,
      eligible: filter?.eligibleOnly,
    });
  getOpportunity = (id: string) => this.req<Opportunity | null>('GET', `/opportunities/${id}`);
  listApplications = () => this.req<Application[]>('GET', '/applications');
  saveOpportunity = (opportunityId: string) => this.req<Application>('POST', '/applications', { opportunity_id: opportunityId });
  updateApplication = (id: string, patch: Partial<Pick<Application, 'status' | 'checklist' | 'notes'>>) =>
    this.req<Application>('PATCH', `/applications/${id}`, patch);

  listAchievements = () => this.req<Achievement[]>('GET', '/achievements');
  addAchievement = (input: Omit<Achievement, 'id' | 'student_id'>) => this.req<Achievement>('POST', '/achievements', input);
  generateCv = (target: CvTarget) => this.req<CvVersion>('POST', '/cv/generate', { target });

  listConnections = () => this.req<Connection[]>('GET', '/connections');
  connect = (provider: ConnectionProvider) =>
    this.req<{ connection: Connection; authUrl: string | null }>('POST', `/connections/${provider}/start`);
  disconnect = (provider: ConnectionProvider) => this.req<Connection>('DELETE', `/connections/${provider}`);

  getNotificationPrefs = () => this.req<NotificationPrefs>('GET', '/notification-prefs');
  updateNotificationPrefs = (patch: Partial<NotificationPrefs>) => this.req<NotificationPrefs>('PATCH', '/notification-prefs', patch);

  listAiUseLog = () => this.req<AuditLogEntry[]>('GET', '/privacy/ai-use-log');
  exportData = () => this.req<DataExport>('POST', '/privacy/export');
  deleteAccount = () => this.req<{ scheduled_for: string }>('POST', '/privacy/delete');
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
