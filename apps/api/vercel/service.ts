// Entry for the "api" service in the root vercel.json. Vercel's Hono builder loads the bundle built from this file
// (server.mjs at the service root, see scripts/build-service.mjs). Requests arrive as /api/...; the API's routes start at /.
// NOTE: demo state (posted assignments, edits, logged sessions) lives in memory per function instance and resets on a
// cold start; survey responses go to Supabase.
import { Hono } from 'hono';
import { createSeededApp } from '../src/app';
import { stripPrefix } from '../src/lib/mount';

const ready = createSeededApp();
const app = new Hono();
app.all('*', async (c) => (await ready).app.fetch(stripPrefix(c.req.raw, '/api')));

export default app;
