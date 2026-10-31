// Builds the "api" Vercel service (root vercel.json): bundles vercel/service.ts, the API and the workspace packages
// into server.mjs at the service root, where Vercel's Hono builder looks for its entry. The TypeScript sources use
// extension-less imports that Node cannot load directly, so everything is inlined except hono, which stays an import:
// the builder only accepts an entry that imports hono, and it resolves from apps/api/node_modules at runtime.
//   node scripts/build-service.mjs        (writes server.mjs and data/, both gitignored)
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(apiDir, '../..');

function loadEsbuild() {
  const req = createRequire(join(apiDir, 'package.json'));
  try { return req('esbuild'); } catch { /* not a direct dependency: use the copy in the pnpm store */ }
  const store = join(root, 'node_modules/.pnpm');
  for (const d of readdirSync(store).filter((x) => /^esbuild@\d/.test(x)).sort().reverse()) {
    const p = join(store, d, 'node_modules/esbuild');
    if (existsSync(p)) return createRequire(join(root, 'package.json'))(p);
  }
  throw new Error('esbuild not found (run pnpm install at the repo root)');
}
const esbuild = loadEsbuild();

// Prompt templates (packages/agent-gateway/prompts/**/*.md) go inside the bundle, so the function never depends on
// where a prompts folder ends up next to it.
const promptsDir = join(root, 'packages/agent-gateway/prompts');
const prompts = {};
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.md')) prompts[relative(promptsDir, p).replace(/\\/g, '/').replace(/\.md$/, '')] = readFileSync(p, 'utf8');
  }
})(promptsDir);
const embedPrompts = {
  name: 'embed-prompts',
  setup(build) {
    build.onLoad({ filter: /[\\/]agent-gateway[\\/]src[\\/]prompts\.ts$/ }, (args) => {
      const src = readFileSync(args.path, 'utf8');
      const read = "return readFileSync(join(PROMPTS_DIR, `${name}.md`), 'utf8');";
      if (!src.includes(read)) throw new Error('agent-gateway/src/prompts.ts changed: update embed-prompts in apps/api/scripts/build-service.mjs');
      const contents = src.replace(read, `const embedded = (${JSON.stringify(prompts)} as Record<string, string>)[name];\n  if (embedded !== undefined) return embedded;\n  ${read}`);
      return { contents, loader: 'ts' };
    });
  },
};

const outfile = join(apiDir, 'server.mjs');
const dataDir = join(apiDir, 'data');
rmSync(outfile, { force: true });
rmSync(dataDir, { recursive: true, force: true });

await esbuild.build({
  entryPoints: [join(apiDir, 'vercel/service.ts')],
  outfile,
  bundle: true, platform: 'node', format: 'esm', target: 'node22', sourcemap: false, minify: false, logLevel: 'info',
  external: ['hono', 'hono/*'],
  plugins: [embedPrompts],
  // CommonJS deps (pdfkit, fontkit…) need require/__dirname inside an ES module bundle.
  banner: { js: "import { createRequire as __cr } from 'node:module'; import { fileURLToPath as __fu } from 'node:url'; import { dirname as __dn } from 'node:path'; const require = __cr(import.meta.url); const __filename = __fu(import.meta.url); const __dirname = __dn(__filename);" },
});

// pdfkit (bundled) reads its font metrics from <bundle dir>/data at runtime.
const pdfkitDir = readdirSync(join(root, 'node_modules/.pnpm')).find((d) => /^pdfkit@/.test(d));
if (!pdfkitDir) throw new Error('pdfkit not found in node_modules/.pnpm (CV PDFs need its font metrics)');
cpSync(join(root, 'node_modules/.pnpm', pdfkitDir, 'node_modules/pdfkit/js/data'), dataDir, { recursive: true });
console.log(`api service bundle ready: ${relative(root, outfile)} (${Object.keys(prompts).length} prompts embedded)`);
