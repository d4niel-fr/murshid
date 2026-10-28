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

export type StudentInput = Omit<Student, 'id' | 'auth_user_id' | 'created_at'>;
export type GuardianInput = Pick<Guardian, 'name' | 'email' | 'relation'> & { phone?: string | null };

/** Every screen talks to this interface only. Adapters: HttpApi (apps/api) and MockApi (synthetic). */
export interface MurshidApi {
  readonly kind: 'http' | 'mock';
  setAccessToken(token: string | null): void;

  // Student / onboarding
  getMe(): Promise<Student | null>;
  saveStudent(input: StudentInput): Promise<Student>;
  listSchools(query?: string): Promise<School[]>;

  // Guardian consent
  getGuardian(): Promise<Guardian | null>;
  requestGuardianConsent(input: GuardianInput): Promise<Guardian>;

  // Dashboard
  getWeekSummary(): Promise<WeekSummary>;

  // Goals
  listGoals(): Promise<Goal[]>;
  listMilestones(goalId?: string): Promise<Milestone[]>;
  toggleMilestone(id: string, done: boolean): Promise<Milestone>;
  createGoal(input: Pick<Goal, 'title' | 'category' | 'parent_goal_id' | 'target_date'>): Promise<Goal>;

  // Planner
  listTasks(from: string, to: string): Promise<Task[]>;
  updateTask(id: string, patch: Partial<Pick<Task, 'status' | 'due_at'>>): Promise<Task>;
  listEvents(from: string, to: string): Promise<CalendarEvent[]>;

  // Classes / materials
  listCourses(): Promise<Course[]>;
  listMaterials(courseId?: string): Promise<Material[]>;
  uploadMaterial(input: { course_id: string; title: string; file: UploadFile }): Promise<Material>;

  // Opportunities / applications
  listOpportunities(filter?: OpportunityFilter): Promise<Opportunity[]>;
  getOpportunity(id: string): Promise<Opportunity | null>;
  listApplications(): Promise<Application[]>;
  saveOpportunity(opportunityId: string): Promise<Application>;
  updateApplication(id: string, patch: Partial<Pick<Application, 'status' | 'checklist' | 'notes'>>): Promise<Application>;

  // CV
  listAchievements(): Promise<Achievement[]>;
  addAchievement(input: Omit<Achievement, 'id' | 'student_id'>): Promise<Achievement>;
  generateCv(target: CvTarget): Promise<CvVersion>;

  // Connections
  listConnections(): Promise<Connection[]>;
  connect(provider: ConnectionProvider): Promise<{ connection: Connection; authUrl: string | null }>;
  disconnect(provider: ConnectionProvider): Promise<Connection>;

  // Notifications
  getNotificationPrefs(): Promise<NotificationPrefs>;
  updateNotificationPrefs(patch: Partial<NotificationPrefs>): Promise<NotificationPrefs>;

  // Privacy
  listAiUseLog(): Promise<AuditLogEntry[]>;
  exportData(): Promise<DataExport>;
  deleteAccount(): Promise<{ scheduled_for: string }>;
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}
