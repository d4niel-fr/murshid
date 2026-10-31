/**
 * Prompt templates live in /prompts as Markdown with {{variable}} slots.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROMPTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'prompts');

export function loadTemplate(name: string): string {
  if (!/^[a-z0-9_/.-]+$/i.test(name) || name.includes('..')) throw new Error(`Bad template name ${name}`);
  return readFileSync(join(PROMPTS_DIR, `${name}.md`), 'utf8');
}

export function render(template: string, vars: Record<string, string | number>): string {
  const missing = new Set<string>();
  const out = template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, key: string) => {
    if (vars[key] === undefined) {
      missing.add(key);
      return '';
    }
    return String(vars[key]);
  });
  if (missing.size) throw new Error(`Missing template variables: ${[...missing].join(', ')}`);
  return out;
}

export function renderPrompt(name: string, vars: Record<string, string | number>) {
  return render(loadTemplate(name), vars);
}

/** Variables the system prompt needs. Use preferred name + grade only; never DOB, email, etc. */
export interface PersonaVars extends Record<string, string | number> {
  preferred_name: string;
  grade: number;
  curriculum: string;
  language: 'English' | 'Arabic';
  ai_use_level: 'none' | 'support' | 'led' | 'not_task_linked';
  today: string;
}
