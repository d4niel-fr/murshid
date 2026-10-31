// Vercel Edge Function entry. All paths are rewritten here by vercel.json.
// NOTE: in-memory repo state lives per isolate and resets on cold start (demo only) until the
// Supabase-backed Repository from packages/db is wired in.
import { handle } from 'hono/vercel';
import { createSeededApp } from '../src/app';

export const config = { runtime: 'edge' };
const ready = createSeededApp();
export default handle({ fetch: async (req: Request) => (await ready).app.fetch(req) } as never);
