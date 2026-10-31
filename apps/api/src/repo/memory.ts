import type { Collection, Repository, Where } from './types';

export const newId = (): string => crypto.randomUUID();

class MemoryCollection<T extends { id: string }> implements Collection<T> {
  private rows = new Map<string, T>();

  private matches(row: T, where?: Where<T>): boolean {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => v === undefined || (row as Record<string, unknown>)[k] === v);
  }

  async list(where?: Where<T>): Promise<T[]> {
    return [...this.rows.values()].filter((r) => this.matches(r, where)).map((r) => structuredClone(r));
  }
  async get(id: string): Promise<T | null> {
    const r = this.rows.get(id);
    return r ? structuredClone(r) : null;
  }
  async findOne(where: Where<T>): Promise<T | null> {
    return (await this.list(where))[0] ?? null;
  }
  async create(row: Omit<T, 'id'> & { id?: string }): Promise<T> {
    const full = { ...row, id: row.id ?? newId() } as T;
    this.rows.set(full.id, structuredClone(full));
    return structuredClone(full);
  }
  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<T | null> {
    const cur = this.rows.get(id);
    if (!cur) return null;
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const next = { ...cur, ...clean, id } as T;
    this.rows.set(id, structuredClone(next));
    return structuredClone(next);
  }
  async delete(id: string): Promise<boolean> {
    return this.rows.delete(id);
  }
}

export function createMemoryRepository(): Repository {
  return {
    schools: new MemoryCollection(),
    students: new MemoryCollection(),
    guardians: new MemoryCollection(),
    goals: new MemoryCollection(),
    milestones: new MemoryCollection(),
    courses: new MemoryCollection(),
    materials: new MemoryCollection(),
    tasks: new MemoryCollection(),
    calendarEvents: new MemoryCollection(),
    opportunities: new MemoryCollection(),
    applications: new MemoryCollection(),
    achievements: new MemoryCollection(),
    cvVersions: new MemoryCollection(),
    connections: new MemoryCollection(),
    auditLogs: new MemoryCollection(),
  };
}
