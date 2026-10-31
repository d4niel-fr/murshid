/**
 * Prewarm the demo replay cache: asks the real models each scripted demo question once (as Ahamed, demo-ideal)
 * and writes the saved answers to src/v1/demo-cache.ts. Costs roughly 2-4 model requests per question.
 *   GATEWAY_MODE=openrouter OPENROUTER_API_KEY=... pnpm --filter @murshid/api prewarm
 */
import { writeFileSync } from 'node:fs';
import { DemoStore } from '../src/v1/store';
import { createChatEngine, runChat } from '../src/v1/chat';

const PROMPTS = (process.env.PREWARM_PROMPTS ?? 'Plan my week around my mid-term and both sports|Find opportunities for Tideline and save the best one|Generate my LinkedIn CV').split('|');
const engine = createChatEngine({ ...process.env, GATEWAY_MODE: process.env.GATEWAY_MODE ?? 'openrouter' });
if (!engine.guard) throw new Error('set GATEWAY_MODE=openrouter and OPENROUTER_API_KEY');
const store = new DemoStore();
for (const message of PROMPTS) {
  const v = store.view('demo-ideal', new Date());
  const t0 = Date.now();
  const r = await runChat(engine, store, v, { message } as never);
  console.log(`${message} -> ${r.generatedBy} (${r.trace?.engine.mode}) in ${Date.now() - t0} ms; fallback=${r.fallback}`);
}
const entries = engine.guard.export();
console.log('status', engine.guard.status());
writeFileSync(new URL('../src/v1/demo-cache.ts', import.meta.url), `/**
 * Saved model answers for the demo personas' scripted questions (see DEMO_PROMPTS in chat.ts), replayed by
 * ModelGuard so a live demo does not spend the free daily model limit. Regenerate with
 * \`pnpm --filter @murshid/api prewarm\` (calls the real models once). Generated ${new Date().toISOString()}.
 */
import type { CacheEntry } from '@murshid/agent-gateway';

export const DEMO_CACHE = ${JSON.stringify(entries, null, 1)} as unknown as CacheEntry[];
`);
console.log(`wrote ${entries.length} entries`);
