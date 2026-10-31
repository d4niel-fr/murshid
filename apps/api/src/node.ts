import { serve } from '@hono/node-server';
import { existsSync } from 'node:fs';
import { createSeededApp, buildApi } from './app';

if (existsSync('.env')) process.loadEnvFile('.env');

const port = Number(process.env.PORT ?? 8787);
const { app, deps } = process.env.SEED_DATA === 'false' ? buildApi() : await createSeededApp();
serve({ fetch: app.fetch, port }, () => {
  console.log(`Murshid API on http://localhost:${port} (auth: ${deps.config.authMode})`);
  if (deps.config.authMode === 'dev') console.log('Dev auth: send header  x-dev-user-id: dev-aisha');
});
