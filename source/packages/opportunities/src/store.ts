import type { Opportunity } from './types.js';

/**
 * Persistence port. The db team's Supabase `opportunities` table should implement this
 * (upsert on id; id is a stable hash of source_id + url + title).
 */
export interface OpportunityStore {
  upsertMany(list: Opportunity[]): Promise<void>;
  listAll(): Promise<Opportunity[]>;
  replaceAll?(list: Opportunity[]): Promise<void>;
  getSourceLastCrawled(sourceId: string): Promise<string | null>;
  setSourceLastCrawled(sourceId: string, at: string): Promise<void>;
}

export class MemoryStore implements OpportunityStore {
  private rows = new Map<string, Opportunity>();
  private crawled = new Map<string, string>();
  async upsertMany(list: Opportunity[]) {
    for (const o of list) this.rows.set(o.id, o);
  }
  async listAll() {
    return [...this.rows.values()];
  }
  async replaceAll(list: Opportunity[]) {
    this.rows = new Map(list.map((o) => [o.id, o]));
  }
  async getSourceLastCrawled(id: string) {
    return this.crawled.get(id) ?? null;
  }
  async setSourceLastCrawled(id: string, at: string) {
    this.crawled.set(id, at);
  }
}
