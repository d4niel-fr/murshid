import { writeFileSync } from 'node:fs';
import { buildApi } from '../src/app';

const doc = buildApi().api.openapi();
writeFileSync(new URL('../openapi.json', import.meta.url), JSON.stringify(doc, null, 2) + '\n');
console.log(`wrote openapi.json (${Object.keys(doc.paths as object).length} paths)`);
