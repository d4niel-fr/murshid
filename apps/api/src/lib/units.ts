/**
 * What each store saves (see durable.ts). Each store is one document; caches and indexes are rebuilt after loading.
 */
import type { BillingStore } from '../billing/routes';
import type { Repository } from '../repo/types';
import type { SchoolStore } from '../schools/store';
import type { DemoStore } from '../v1/store';
import type { NotificationHub } from '../notify/hub';
import { assignFields, fieldsOf, type Unit } from './durable';

export function demoUnit(store: DemoStore): Unit {
  const skip = ['cache'];
  return {
    key: 'demo',
    dump: () => fieldsOf(store, skip),
    restore: (d) => { assignFields(store, d, skip); (store as unknown as { cache: Map<string, unknown> }).cache.clear(); },
  };
}

export function schoolsUnit(schools: SchoolStore): Unit {
  // the classroom is its own document; the Microsoft connector is code, not data; postedById is an index
  const skip = ['classroom', 'microsoft', 'postedById'];
  return {
    key: 'schools',
    dump: () => fieldsOf(schools, skip),
    restore: (d) => {
      assignFields(schools, d, skip);
      schools.postedById.clear();
      for (const p of schools.posted) schools.postedById.set(p.id, p);
    },
  };
}

export function classroomUnit(schools: SchoolStore): Unit {
  const room = schools.classroom;
  const skip = ['blobs'];
  return {
    key: 'classroom',
    dump: () => fieldsOf(room, skip),
    restore: (d) => assignFields(room, d, skip),
  };
}

export function billingUnit(billing: BillingStore): Unit {
  return { key: 'billing', dump: () => fieldsOf(billing), restore: (d) => assignFields(billing, d) };
}

/** The table-shaped repository (students, goals, tasks …): each collection's rows. */
export function repoUnit(repo: Repository): Unit {
  const rowsOf = (col: unknown) => (col as { rows?: Map<string, unknown> }).rows;
  return {
    key: 'repo',
    dump: () => Object.fromEntries(Object.entries(repo).flatMap(([name, col]) => { const r = rowsOf(col); return r ? [[name, r]] : []; })),
    restore: (d) => {
      if (!d || typeof d !== 'object') return;
      for (const [name, rows] of Object.entries(d as Record<string, unknown>)) {
        const col = (repo as unknown as Record<string, unknown>)[name];
        if (col && rows instanceof Map && rowsOf(col)) (col as { rows: Map<string, unknown> }).rows = rows;
      }
    },
  };
}

export function notifyUnit(hub: NotificationHub): Unit {
  const skip = ['cfg', 'now', 'later'];
  return { key: 'notify', dump: () => fieldsOf(hub, skip), restore: (d) => assignFields(hub, d, skip) };
}
