import type { MaterialKind, NormalizedTask, SourceId } from './types';

const EXAM_RE = /\b(exam|test|quiz|assessment|mock|midterm|mid-term|finals?|summative)\b/i;

export function classifyKind(title: string, fallback: MaterialKind): MaterialKind {
  if (fallback === 'announcement' || fallback === 'note') return fallback;
  return EXAM_RE.test(title) ? 'exam' : fallback;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function firstLine(text: string, max = 120): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const t = line.trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

/** Default study-task derived from an assignment/exam material. */
export function taskFromMaterial(
  studentId: string,
  m: { title: string; due_at: string | null; external_id: string; kind: MaterialKind; source: SourceId },
): NormalizedTask {
  return {
    student_id: studentId,
    title: m.kind === 'exam' ? `Revise: ${m.title}` : m.title,
    kind: m.kind === 'exam' ? 'study' : 'assignment',
    due_at: m.due_at,
    est_minutes: null, // AI-LATER: effort estimate
    status: 'todo',
    linked_goal_id: null,
    linked_material_external_id: m.external_id,
    linked_opportunity_id: null,
    ai_use_level: 'none',
  };
}

/** Collect every page from a cursor-paginated endpoint. Guards against loops. */
export async function paginate<TPage, TItem>(
  fetchPage: (cursor: string | undefined) => Promise<TPage>,
  items: (p: TPage) => TItem[] | undefined,
  next: (p: TPage) => string | undefined | null,
  maxPages = 50,
): Promise<TItem[]> {
  const out: TItem[] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    out.push(...(items(page) ?? []));
    const n = next(page) ?? undefined;
    if (!n || seen.has(n)) break;
    seen.add(n);
    cursor = n;
  }
  return out;
}
