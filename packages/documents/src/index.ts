export * from './types.js';
export * from './jsonresume/schema.js';
export * from './jsonresume/mapper.js';
export { renderCvPdf, CV_TEMPLATES } from './pdf/cv.js';
export { renderApplicationChecklistPdf, defaultChecklist, daysUntil, type ChecklistPdfInput } from './pdf/checklist.js';
export { sanitize, fmtDate, type PdfRenderOptions } from './pdf/common.js';
export { renderPortfolioHtml, escapeHtml, type PortfolioOptions } from './portfolio/html.js';

import type { CvTarget, CvTemplate } from './types.js';

/** Suggested template for a CV target. */
export const TEMPLATE_FOR_TARGET: Record<CvTarget, CvTemplate> = {
  general: 'clean',
  university: 'academic',
  internship: 'internship',
};

/** Read optional Unicode font paths from env (see .env.example). Pass the result as `opts.fonts`. */
export function fontsFromEnv(env: Record<string, string | undefined> = process.env) {
  const regular = env.DOCUMENTS_FONT_REGULAR;
  if (!regular) return undefined;
  return { regular, bold: env.DOCUMENTS_FONT_BOLD || undefined, italic: env.DOCUMENTS_FONT_ITALIC || undefined };
}
