import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApi } from '../src/app';

/**
 * Every string and list a client can send has a maximum size, so no single field can make the server parse or store
 * megabytes (the whole body is also capped at 5 MB). Walks the JSON schema of every route's body and query.
 */
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export function unbounded(schema: J, path = '$', out: string[] = []): string[] {
  if (!schema || typeof schema !== 'object') return out;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  // an anchored pattern with no open-ended repeat (dates, times, codes) bounds the length too
  const fixedPattern = typeof schema.pattern === 'string' && /^\^.*\$$/.test(schema.pattern) && !/[*+]|\{\d+,\}/.test(schema.pattern.replace(/\\./g, ''));
  const bounded = schema.enum || schema.const !== undefined || fixedPattern || schema.format === 'date' || schema.format === 'time';
  if (types.includes('string') && schema.maxLength === undefined && !bounded) out.push(`${path}: string without maxLength`);
  if (types.includes('array') && schema.maxItems === undefined && !(schema.prefixItems && schema.items === false)) out.push(`${path}: array without maxItems`);
  if (types.includes('object') && schema.additionalProperties && typeof schema.additionalProperties === 'object' && schema.maxProperties === undefined) {
    // records (z.record): the keys must be bounded too
    const keys = schema.propertyNames as J | undefined;
    if (!keys || (keys.maxLength === undefined && !keys.enum && !keys.pattern)) out.push(`${path}: record keys without a limit`);
  }
  for (const [k, v] of Object.entries(schema.properties ?? {})) unbounded(v as J, `${path}.${k}`, out);
  if (schema.items && typeof schema.items === 'object') unbounded(schema.items as J, `${path}[]`, out);
  for (const k of ['anyOf', 'oneOf', 'allOf'] as const) (schema[k] ?? []).forEach((s: J, i: number) => unbounded(s, `${path}<${k}${i}>`, out));
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') unbounded(schema.additionalProperties as J, `${path}{}`, out);
  return out;
}

describe('input limits', () => {
  it('every body and query field has a maximum size', () => {
    const { api } = buildApi({ rateLimit: false });
    const problems: string[] = [];
    for (const r of api.routes as unknown as { method: string; path: string; body?: z.ZodType; query?: z.ZodType }[]) {
      for (const [where, s] of [['body', r.body], ['query', r.query]] as const) {
        if (!s) continue;
        const js = z.toJSONSchema(s, { io: 'input', unrepresentable: 'any' }) as J;
        for (const p of unbounded(js)) problems.push(`${r.method.toUpperCase()} ${r.path} ${where} ${p}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('links people will click are http(s) only', async () => {
    const { createSeededApp } = await import('../src/app');
    const { app } = await createSeededApp({ config: { authMode: 'dev', jwtSecret: '' } });
    const send = (method: string, path: string, body: unknown) => app.request(path, { method, headers: { 'content-type': 'application/json', 'x-dev-user': 'demo-g11', 'x-dev-role': 'admin' }, body: JSON.stringify(body) });
    for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'vbscript:msgbox(1)']) {
      expect((await send('POST', '/student/me/projects', { name: 'P', tagline: 'T', kind: 'app', role: 'Lead', startDate: '2026-01-01', url })).status, url).toBe(400);
      expect((await send('PUT', '/student/me/cv', { featured: [{ title: 'X', url, description: '' }] })).status, url).toBe(400);
    }
    expect((await send('POST', '/student/me/projects', { name: 'P', tagline: 'T', kind: 'app', role: 'Lead', startDate: '2026-01-01', url: 'https://example.com/p' })).status).toBe(201);
  });
});
