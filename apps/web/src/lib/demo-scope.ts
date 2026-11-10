/**
 * Focused demo: set NEXT_PUBLIC_MURSHID_FOCUSED_DEMO=1 (build time) to show judges only the core manager agent.
 * Hidden pages are removed from the nav and search, and next.config.ts redirects them to /app.
 */
export const FOCUSED_DEMO = process.env.NEXT_PUBLIC_MURSHID_FOCUSED_DEMO === '1';

export const FOCUSED_DEMO_HIDDEN = [
  '/app/health',
  '/app/points',
  '/app/polls',
  '/app/study/whiteboard',
  '/app/study/notebook',
  '/app/study/live',
  '/app/study/maths',
  '/checkout',
] as const;

export function hiddenInDemo(href: string): boolean {
  if (!FOCUSED_DEMO) return false;
  const path = href.split('?')[0]!;
  return FOCUSED_DEMO_HIDDEN.some((p) => path === p || path.startsWith(`${p}/`));
}
