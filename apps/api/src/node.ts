import { serve } from '@hono/node-server';
import { existsSync } from 'node:fs';
import { createSeededApp, buildApi } from './app';
import { stripPrefix } from './lib/mount';

if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.PORT ?? 8787);
const { app, deps } = process.env.SEED_DATA === 'false' ? buildApi() : await createSeededApp();
// also answers under /api, the path the API has on Vercel (and under `vercel dev`)
// the socket's address goes along (as env.incoming), so rate limits see the real client (see lib/security.ts)
serve({ fetch: (req, env) => app.fetch(stripPrefix(req, '/api'), env), port }, () => {
  console.log(`Murshid API on http://localhost:${port} (auth: ${deps.config.authMode})`);
  if (deps.config.authMode === 'dev') console.log('Dev auth: send header  x-dev-user-id: dev-aisha');
});
