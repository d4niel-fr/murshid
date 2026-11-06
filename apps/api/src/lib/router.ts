import type { Hono, MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AppEnv, Ctx } from './context';
import { authMiddleware } from './auth';
import type { Durable } from './durable';

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

export interface RouteSpec<B extends z.ZodType, Q extends z.ZodType> {
  method: Method;
  path: string; // hono style: /goals/:id
  tag: string;
  summary: string;
  description?: string;
  body?: B;
  query?: Q;
  /** 'none' = public, 'custom' = handler authenticates itself (webhooks). Default: bearer/dev auth. */
  auth?: 'required' | 'none' | 'custom';
  successStatus?: number;
  /** Response body schema (documentation only; not enforced at runtime). */
  response?: z.ZodType;
  /**
   * How a change is saved (durable state, see durable.ts). 'tx' (default for writes): one at a time, re-run on fresh
   * data if another server saved first. 'late': slow work (AI models, streams) runs outside the queue and is saved when
   * it ends. 'none': the route changes nothing that is saved.
   */
  durable?: 'tx' | 'late' | 'none';
}

export interface Input<B extends z.ZodType, Q extends z.ZodType> {
  body: z.output<B>;
  query: z.output<Q>;
}

interface Registered {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  description?: string;
  body?: z.ZodType;
  query?: z.ZodType;
  auth: 'required' | 'none' | 'custom';
  successStatus: number;
  response?: z.ZodType;
}

function validationError(err: z.ZodError, where: string): HTTPException {
  return new HTTPException(400, {
    message: `invalid ${where}`,
    cause: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}

/** Registers a Hono route with zod validation and records it for the OpenAPI document. */
export class Api {
  readonly routes: Registered[] = [];
  /** saved state shared by every server (null: memory only, one process) */
  durable: Durable | null = null;
  /** resolves once saved state has loaded */
  ready: Promise<void> = Promise.resolve();
  constructor(readonly app: Hono<AppEnv>) {}

  route<B extends z.ZodType = z.ZodUndefined, Q extends z.ZodType = z.ZodUndefined>(
    spec: RouteSpec<B, Q>,
    handler: (c: Ctx, input: Input<B, Q>) => Response | Promise<Response>,
  ): void {
    const auth = spec.auth ?? 'required';
    this.routes.push({ ...spec, auth, successStatus: spec.successStatus ?? (spec.method === 'post' ? 201 : 200) });
    const mws: MiddlewareHandler<AppEnv>[] = auth === 'required' ? [authMiddleware] : [];
    const h: MiddlewareHandler<AppEnv> = async (c) => {
      let body: unknown = undefined;
      let query: unknown = undefined;
      if (spec.body) {
        let raw: unknown;
        try {
          raw = await c.req.json();
        } catch {
          throw new HTTPException(400, { message: 'request body must be JSON' });
        }
        const r = spec.body.safeParse(raw);
        if (!r.success) throw validationError(r.error, 'body');
        body = r.data;
      }
      if (spec.query) {
        const r = spec.query.safeParse(c.req.query());
        if (!r.success) throw validationError(r.error, 'query');
        query = r.data;
      }
      const run = () => Promise.resolve(handler(c as Ctx, { body, query } as Input<B, Q>));
      const d = this.durable;
      if (!d) return run();
      await this.ready;
      const mode = spec.durable ?? (spec.method === 'get' ? 'none' : 'tx');
      if (mode === 'tx') return d.transaction(run);
      await d.sync();
      const res = await run();
      if (mode === 'none') return res;
      // 'late': save once the work (and any streamed reply) has finished
      if (!res.body || !(res.headers.get('content-type') ?? '').includes('text/event-stream')) { await d.commitNow(); return res; }
      const done = new TransformStream({ flush: async () => { await d.commitNow(); } });
      return new Response(res.body.pipeThrough(done), res);
    };
    (this.app.on as (m: string, p: string, ...h: MiddlewareHandler<AppEnv>[]) => unknown)(spec.method.toUpperCase(), spec.path, ...mws, h);
  }

  openapi(): Record<string, unknown> {
    const paths: Record<string, Record<string, unknown>> = {};
    const toJson = (s: z.ZodType) => z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
    for (const r of this.routes) {
      const oaPath = r.path.replace(/:(\w+)/g, '{$1}');
      const params: unknown[] = [...r.path.matchAll(/:(\w+)/g)].map((m) => ({
        name: m[1], in: 'path', required: true, schema: { type: 'string' },
      }));
      if (r.query) {
        const js = toJson(r.query);
        const props = (js.properties ?? {}) as Record<string, Record<string, unknown>>;
        const req = new Set((js.required as string[] | undefined) ?? []);
        for (const [name, schema] of Object.entries(props)) {
          params.push({ name, in: 'query', required: req.has(name) && !('default' in schema), schema, description: schema.description });
        }
      }
      const op: Record<string, unknown> = {
        tags: [r.tag],
        summary: r.summary,
        ...(r.description ? { description: r.description } : {}),
        operationId: `${r.method}_${r.path.replace(/[/:{}]+/g, '_').replace(/^_|_$/g, '')}`,
        parameters: params,
        responses: {
          [String(r.successStatus)]: {
            description: 'Success',
            content: {
              'application/json': { schema: r.response ? toJson(r.response) : { type: 'object' } },
              ...(r.path === '/chat' ? { 'text/event-stream': { schema: { type: 'string', description: 'SSE: meta, text-delta, tool-call, done' } } } : {}),
            },
          },
          '400': { $ref: '#/components/responses/Error' },
          ...(r.auth !== 'none' ? { '401': { $ref: '#/components/responses/Error' }, '403': { $ref: '#/components/responses/Error' } } : {}),
          '404': { $ref: '#/components/responses/Error' },
        },
        security: r.auth === 'required' ? [{ bearerAuth: [] }, { devUser: [] }]
          : r.tag === 'v1' && r.auth === 'custom' ? [{ bearerAuth: [] }, { demoUser: [] }, {}] : [],
      };
      if (r.body) op.requestBody = { required: true, content: { 'application/json': { schema: toJson(r.body) } } };
      (paths[oaPath] ??= {})[r.method] = op;
    }
    return {
      openapi: '3.1.0',
      info: {
        title: 'Murshid API',
        version: '0.1.0',
        description: 'Personal agent API for UAE high-school students. Times are ISO-8601; planning uses Asia/Dubai (UTC+4).',
      },
      servers: [{ url: 'http://localhost:8787' }],
      paths,
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Supabase access token' },
          devUser: { type: 'apiKey', in: 'header', name: 'x-dev-user-id', description: 'Dev mode only' },
          demoUser: {
            type: 'apiKey', in: 'header', name: 'x-dev-user',
            description: 'Dev mode only: synthetic demo student for the v1 endpoints (demo-g5 | demo-g7 | demo-g9 | demo-g11, default demo-g11)',
          },
        },
        responses: {
          Error: {
            description: 'Error',
            content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' }, details: {} } } } },
          },
        },
      },
    };
  }
}
