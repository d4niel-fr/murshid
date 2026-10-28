import { z } from 'zod';
import { currentStudent, notFound, type Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import type { Collection, Repository } from '../repo/types';

type OwnedRow = { id: string; student_id: string };
type Key = { [K in keyof Repository]: Repository[K] extends Collection<infer R> ? (R extends OwnedRow ? K : never) : never }[keyof Repository];

/**
 * Standard student-owned CRUD: GET list, POST, GET/:id, PATCH/:id, DELETE/:id.
 * Rows of other students return 404 (existence is not revealed).
 */
export function ownedCrud<Q extends z.ZodType, C extends z.ZodType, U extends z.ZodType>(api: Api, o: {
  path: string;
  tag: string;
  name: string;
  key: Key;
  create: C;
  update: U;
  listQuery: Q;
  filter?: (rows: any[], query: z.output<Q>) => any[];
  validate?: (c: Ctx, body: Record<string, unknown>, existing?: any) => Promise<void> | void;
}) {
  const col = (c: Ctx) => c.get('deps').repo[o.key] as unknown as Collection<OwnedRow>;
  const own = async (c: Ctx, id: string) => {
    const s = await currentStudent(c);
    const row = await col(c).get(id);
    if (!row || row.student_id !== s.id) return notFound(o.name);
    return row;
  };
  api.route({ method: 'get', path: o.path, tag: o.tag, summary: `List my ${o.tag}`, query: o.listQuery }, async (c, { query }) => {
    const s = await currentStudent(c);
    const rows = await col(c).list({ student_id: s.id });
    return c.json({ items: o.filter ? o.filter(rows, query) : rows });
  });
  api.route({ method: 'post', path: o.path, tag: o.tag, summary: `Create a ${o.name}`, body: o.create }, async (c, { body }) => {
    const s = await currentStudent(c);
    await o.validate?.(c, body as Record<string, unknown>);
    return c.json(await col(c).create({ ...(body as object), student_id: s.id }), 201);
  });
  api.route({ method: 'get', path: `${o.path}/:id`, tag: o.tag, summary: `Get a ${o.name}` }, async (c) => c.json(await own(c, c.req.param('id')!)));
  api.route({ method: 'patch', path: `${o.path}/:id`, tag: o.tag, summary: `Update a ${o.name}`, body: o.update }, async (c, { body }) => {
    const row = await own(c, c.req.param('id')!);
    await o.validate?.(c, body as Record<string, unknown>, row);
    return c.json(await col(c).update(row.id, body as object));
  });
  api.route({ method: 'delete', path: `${o.path}/:id`, tag: o.tag, summary: `Delete a ${o.name}` }, async (c) => {
    const row = await own(c, c.req.param('id')!);
    await col(c).delete(row.id);
    return c.body(null, 204);
  });
}
