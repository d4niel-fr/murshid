// Vercel Node.js function entry (Build Output API, built by scripts/build-vercel.mjs).
// NOTE: demo state (posted assignments, edits, logged sessions) lives in memory per function instance and resets on a
// cold start; survey responses go to Supabase. Every path is routed here by .vercel/output/config.json.
import { getRequestListener } from '@hono/node-server';
import { createSeededApp } from '../src/app';

const ready = createSeededApp();
export default getRequestListener(async (req) => (await ready).app.fetch(req));
