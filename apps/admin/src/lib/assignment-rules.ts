/** Rules for posting an assignment, shared by the form and its tests. They mirror the API's checks. */

export type Format = 'task' | 'form' | 'google_form' | 'microsoft_form';
export type QType = 'short' | 'long' | 'choice';
export interface Question { id: string; type: QType; prompt: string; options: string[]; required: boolean }

/** Same hosts the API accepts (apps/api/src/schools/routes.ts FORM_HOSTS). */
export const FORM_HOSTS = {
  google: /^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/,
  microsoft: /^https:\/\/(forms\.office\.com\/|forms\.microsoft\.com\/|forms\.cloud\.microsoft\/)/,
};

/** Checks the form the way the API will, so the teacher sees problems before posting. */
export function validateAssignment(v: { title: string; format: Format; formUrl: string; questions: Question[] }): Record<string, string> {
  const e: Record<string, string> = {};
  if (v.title.trim().length < 3) e.title = 'Give it a title of at least 3 characters.';
  const url = v.formUrl.trim();
  if (v.format === 'google_form' && !FORM_HOSTS.google.test(url)) e.formUrl = 'Paste a Google Forms link (docs.google.com/forms/… or forms.gle/…).';
  if (v.format === 'microsoft_form' && !FORM_HOSTS.microsoft.test(url)) e.formUrl = 'Paste a Microsoft Forms link (forms.office.com/… or forms.microsoft.com/…).';
  if (v.format === 'form') {
    if (!v.questions.length) e.questions = 'Add at least one question.';
    v.questions.forEach((q, i) => {
      if (q.prompt.trim().length < 2) e[`q${i}`] = 'Write the question.';
      else if (q.type === 'choice') {
        const opts = q.options.map((o) => o.trim()).filter(Boolean);
        if (opts.length < 2) e[`q${i}`] = 'A multiple-choice question needs at least 2 options.';
        else if (new Set(opts).size !== opts.length) e[`q${i}`] = 'Each option must be different.';
      }
    });
  }
  return e;
}

