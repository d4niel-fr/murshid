import type {
  Achievement, Application, AuditLog, CalendarEvent, Connection, Course, CvVersion, Goal, Guardian, Material,
  Milestone, Opportunity, School, Student, Task,
} from '../domain';

/** Equality filter over a row's fields. Arrays/objects are not supported as filter values. */
export type Where<T> = Partial<{ [K in keyof T]: T[K] }>;

/**
 * Async CRUD over one table. Async on purpose: the Supabase/Postgres implementation
 * (packages/db, db team) will satisfy the same interface.
 */
export interface Collection<T extends { id: string }> {
  list(where?: Where<T>): Promise<T[]>;
  get(id: string): Promise<T | null>;
  findOne(where: Where<T>): Promise<T | null>;
  create(row: Omit<T, 'id'> & { id?: string }): Promise<T>;
  update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

export interface Repository {
  schools: Collection<School>;
  students: Collection<Student>;
  guardians: Collection<Guardian>;
  goals: Collection<Goal>;
  milestones: Collection<Milestone>;
  courses: Collection<Course>;
  materials: Collection<Material>;
  tasks: Collection<Task>;
  calendarEvents: Collection<CalendarEvent>;
  opportunities: Collection<Opportunity>;
  applications: Collection<Application>;
  achievements: Collection<Achievement>;
  cvVersions: Collection<CvVersion>;
  connections: Collection<Connection>;
  auditLogs: Collection<AuditLog>;
}
