import type { Application, ChecklistItem, Opportunity, OpportunityType, Student } from '../types.js';
import { gradeLabel } from '../jsonresume/mapper.js';
import { createDoc, HELVETICA, resolveFonts, Writer, type PdfRenderOptions } from './common.js';

const COMMON: string[] = [
  'Check eligibility (grade, age, nationality, emirate)',
  'Ask a parent/guardian to approve the application',
];

const BY_TYPE: Record<OpportunityType, string[]> = {
  competition: ['Register team / individual entry', 'Read the rules and judging criteria', 'Prepare submission', 'Submit before the deadline'],
  olympiad: ['Register through school coordinator', 'Download past papers', 'Plan weekly practice sessions', 'Confirm exam centre and date'],
  hackathon: ['Form a team (or sign up solo)', 'Read the problem statements', 'Set up GitHub repo and dev tools', 'Prepare demo video and pitch', 'Submit project before the deadline'],
  mun: ['Choose committee and country preferences', 'Research country position', 'Write position paper', 'Practise opening speech', 'Arrange dress code (western business attire)'],
  internship: ['Update CV (internship template)', 'Write a short cover letter', 'Ask a teacher for a reference', 'Prepare for a short interview', 'Submit application form'],
  scholarship: ['Gather latest report card / transcripts', 'Write personal statement / essay', 'Request recommendation letter(s)', 'Collect financial documents if needed', 'Submit application form'],
  summer_program: ['Update CV (academic template)', 'Write statement of interest', 'Request teacher recommendation', 'Gather transcripts', 'Check fees and payment deadline', 'Check visa / travel requirements'],
  volunteering: ['Complete volunteer sign-up form', 'Get guardian permission slip signed', 'Confirm shift dates and location', 'Log hours for service record'],
  course: ['Check course schedule and time commitment', 'Enrol / create account', 'Pay fee or confirm it is free', 'Add sessions to calendar'],
};

/** Rule-based default checklist for an opportunity type. // AI-LATER: tailor items from eligibility_text */
export function defaultChecklist(type: OpportunityType, opts: { needsGuardian?: boolean; hasFee?: boolean } = {}): ChecklistItem[] {
  const items = [COMMON[0]!, ...(opts.needsGuardian === false ? [] : [COMMON[1]!]), ...BY_TYPE[type]];
  if (opts.hasFee && !items.some((i) => /fee|pay/i.test(i))) items.push('Arrange payment of fee');
  return items.map((item) => ({ item, done: false }));
}

const TYPE_LABEL: Record<OpportunityType, string> = {
  competition: 'Competition',
  internship: 'Internship',
  scholarship: 'Scholarship',
  summer_program: 'Summer programme',
  volunteering: 'Volunteering',
  olympiad: 'Olympiad',
  mun: 'Model United Nations',
  hackathon: 'Hackathon',
  course: 'Course',
};

export function daysUntil(deadline: string, now: Date): number {
  const d = new Date(deadline);
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

export function fmtDubai(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export interface ChecklistPdfInput {
  student: Pick<Student, 'full_name' | 'preferred_name' | 'grade'> & Partial<Pick<Student, 'curriculum'>>;
  opportunity: Opportunity;
  application: Pick<Application, 'status' | 'checklist' | 'notes'>;
  now?: Date;
}

/** Printable application checklist with tick boxes, deadline countdown and progress. */
export async function renderApplicationChecklistPdf(input: ChecklistPdfInput, opts: PdfRenderOptions = {}): Promise<Buffer> {
  const { student, opportunity: o, application: a } = input;
  const now = input.now ?? new Date();
  const { doc, done } = createDoc(
    { title: `Application checklist - ${o.title}`, author: student.full_name, subject: 'Application checklist' },
    opts,
  );
  const fonts = resolveFonts(doc, HELVETICA, opts);
  const w = new Writer(doc, fonts, '#1f3a5f', 11);

  w.line('APPLICATION CHECKLIST', { size: 9, color: '#1f3a5f' });
  w.name(o.title, { size: 18 });
  w.line(`${TYPE_LABEL[o.type]}  |  ${o.organizer}`, { color: '#444444' });
  w.gap(0.4);

  const facts: [string, string][] = [];
  facts.push(['Student', `${student.preferred_name || student.full_name} (${gradeLabel(student.grade, student.curriculum ?? 'other')})`]);
  facts.push(['Status', a.status[0]!.toUpperCase() + a.status.slice(1)]);
  if (o.deadline) {
    const left = daysUntil(o.deadline, now);
    const when = left < 0 ? 'deadline passed' : left === 0 ? 'due today' : `${left} day${left === 1 ? '' : 's'} left`;
    facts.push(['Deadline', `${fmtDubai(o.deadline)} (Dubai time) - ${when}`]);
  }
  if (o.cost_aed != null) facts.push(['Cost', o.cost_aed === 0 ? 'Free' : `AED ${o.cost_aed.toLocaleString('en-US')}`]);
  if (o.min_grade || o.max_grade) facts.push(['Grades', `${o.min_grade ?? '?'} - ${o.max_grade ?? '?'}`]);
  if (o.url) facts.push(['Link', o.url]);
  for (const [k, v] of facts) w.labelled(k, [v]);
  if (o.eligibility_text) {
    w.gap(0.3);
    w.labelled('Eligibility', [o.eligibility_text]);
  }

  const total = a.checklist.length;
  const doneCount = a.checklist.filter((c) => c.done).length;
  w.heading(`Checklist (${doneCount} of ${total} done)`);

  // progress bar
  const barY = doc.y + 2;
  doc.roundedRect(w.left, barY, w.width, 6, 3).fillColor('#e6e9ef').fill();
  if (total) doc.roundedRect(w.left, barY, Math.max(6, (w.width * doneCount) / total), 6, 3).fillColor('#2e7d5b').fill();
  doc.y = barY + 16;

  for (const c of a.checklist) {
    w.ensureSpace(22);
    const y = doc.y;
    const box = 11;
    doc.lineWidth(1).strokeColor('#1f3a5f').rect(w.left, y, box, box).stroke();
    if (c.done) {
      doc
        .lineWidth(1.8)
        .strokeColor('#2e7d5b')
        .moveTo(w.left + 2, y + 6)
        .lineTo(w.left + 4.5, y + 9)
        .lineTo(w.left + 9.5, y + 2)
        .stroke();
    }
    doc
      .font(c.done ? fonts.italic : fonts.regular)
      .fontSize(11)
      .fillColor(c.done ? '#777777' : '#222222')
      .text(w.s(c.item), w.left + box + 8, y - 0.5, { width: w.width - box - 8 });
    doc.y = Math.max(doc.y, y + box) + 7;
  }

  if (a.notes) {
    w.heading('Notes');
    w.paragraph(a.notes);
  }

  w.gap(1);
  w.line(`Generated by Murshid on ${fmtDubai(now.toISOString())} (Dubai time). Always confirm details on the organiser's website.`, {
    size: 8,
    color: '#888888',
  });

  doc.end();
  return done;
}
