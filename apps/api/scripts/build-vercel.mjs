// Bundles the API into a prebuilt Vercel Build Output (v3) directory: .vercel/output
//   node scripts/build-vercel.mjs && vercel deploy --prebuilt --prod
// esbuild is resolved from the workspace root (it is installed there by the web/admin toolchain).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(here, '..');
const root = resolve(apiDir, '../..');

function loadEsbuild() {
  const req = createRequire(join(apiDir, 'package.json'));
  try { return req('esbuild'); } catch { /* not a direct dependency: fall back to the pnpm store */ }
  const store = join(root, 'node_modules/.pnpm');
  const dirs = readdirSync(store).filter((d) => /^esbuild@\d/.test(d)).sort().reverse();
  for (const d of dirs) {
    const p = join(store, d, 'node_modules/esbuild');
    if (existsSync(p)) return createRequire(join(root, 'package.json'))(p);
  }
  throw new Error('esbuild not found (run pnpm install at the repo root)');
}
const esbuild = loadEsbuild();

const out = join(apiDir, '.vercel/output');
const fn = join(out, 'functions/index.func');
rmSync(out, { recursive: true, force: true });
mkdirSync(join(fn, 'dist'), { recursive: true });

await esbuild.build({
  entryPoints: [join(apiDir, 'vercel/entry.ts')],
  outfile: join(fn, 'dist/index.mjs'),
  bundle: true, platform: 'node', format: 'esm', target: 'node22', sourcemap: false, minify: false,
  // CommonJS deps (pdfkit, fontkit…) need require/__dirname inside an ES module bundle.
  banner: { js: "import { createRequire as __cr } from 'node:module'; import { fileURLToPath as __fu } from 'node:url'; import { dirname as __dn } from 'node:path'; const require = __cr(import.meta.url); const __filename = __fu(import.meta.url); const __dirname = __dn(__filename);" },
  logLevel: 'info',
});

// Runtime data files read relative to the bundle: prompts (agent-gateway: <bundle>/../prompts), pdfkit's font metrics
// (<__dirname>/data), opportunity sources (<bundle>/../sources.json).
cpSync(join(root, 'packages/agent-gateway/prompts'), join(fn, 'prompts'), { recursive: true });
const pdfkitDir = readdirSync(join(root, 'node_modules/.pnpm')).find((d) => /^pdfkit@/.test(d));
if (pdfkitDir) cpSync(join(root, 'node_modules/.pnpm', pdfkitDir, 'node_modules/pdfkit/js/data'), join(fn, 'dist/data'), { recursive: true });
if (existsSync(join(root, 'packages/opportunities/sources.json'))) cpSync(join(root, 'packages/opportunities/sources.json'), join(fn, 'sources.json'));

writeFileSync(join(fn, 'package.json'), JSON.stringify({ type: 'module' }));
writeFileSync(join(fn, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x', handler: 'dist/index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false,
  supportsResponseStreaming: true, maxDuration: 120,
}, null, 2));
writeFileSync(join(out, 'config.json'), JSON.stringify({ version: 3, routes: [{ src: '/(.*)', dest: '/index' }] }, null, 2));
console.log('Vercel build output ready:', out);
