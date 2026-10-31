import type { ChecklistItem, Opportunity } from '../domain';

/** Default application checklists per opportunity type. AI-LATER: tailor from eligibility_text. */
export const CHECKLIST_TEMPLATES: Record<Opportunity['type'], string[]> = {
  competition: ['Read rules and eligibility', 'Form team / confirm partners', 'Register before deadline', 'Prepare submission or entry', 'Get teacher sign-off if required', 'Submit entry'],
  internship: ['Check eligibility and age requirements', 'Update CV (internship version)', 'Write cover letter', 'Ask a teacher for a reference', 'Get guardian consent', 'Submit application', 'Prepare for interview'],
  scholarship: ['Check eligibility (grade, nationality, grades)', 'Gather transcripts / report cards', 'Write personal statement', 'Request recommendation letter(s)', 'Collect ID / passport / Emirates ID copies', 'Get guardian signature', 'Submit application'],
  summer_program: ['Check dates, cost and visa needs', 'Discuss with guardian (cost & travel)', 'Update CV (university version)', 'Write statement of interest', 'Request recommendation letter', 'Submit application', 'Arrange payment / scholarship'],
  volunteering: ['Confirm dates and hours', 'Get guardian consent', 'Register / sign up', 'Log hours for your record'],
  olympiad: ['Confirm eligibility and exam date', 'Register through school coordinator', 'Collect past papers', 'Build a revision plan', 'Sit the exam'],
  mun: ['Register delegation / individual', 'Receive country & committee', 'Research country position', 'Write position paper', 'Practice opening speech', 'Pay fee / get guardian consent'],
  hackathon: ['Register', 'Form a team', 'Pick a problem / idea', 'Set up tools and repo', 'Build the prototype', 'Prepare demo and pitch', 'Submit project'],
  course: ['Check prerequisites and schedule', 'Enroll', 'Plan weekly study time', 'Complete course', 'Download certificate'],
};

export function defaultChecklist(type: Opportunity['type']): ChecklistItem[] {
  return CHECKLIST_TEMPLATES[type].map((item) => ({ item, done: false }));
}
