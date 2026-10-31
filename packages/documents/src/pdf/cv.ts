import type { JsonResume } from '../jsonresume/schema.js';
import type { CvTemplate } from '../types.js';
import { createDoc, dateRange, fmtDate, HELVETICA, resolveFonts, TIMES, Writer, type PdfRenderOptions } from './common.js';

type Section = (w: Writer, r: JsonResume) => void;

function contactLine(r: JsonResume): string {
  const b = r.basics;
  const loc = [b.location?.city, b.location?.countryCode === 'AE' ? 'UAE' : b.location?.countryCode]
    .filter(Boolean)
    .join(', ');
  const profiles = (b.profiles ?? []).map((p) => p.url ?? `${p.network}: ${p.username ?? ''}`);
  return [b.email, b.phone, loc, b.url, ...profiles].filter(Boolean).join('  |  ');
}

// ---------- sections ----------

const summary =
  (title = 'Profile'): Section =>
  (w, r) => {
    if (!r.basics.summary) return;
    w.heading(title);
    w.paragraph(r.basics.summary);
  };

const education: Section = (w, r) => {
  if (!r.education?.length) return;
  w.heading('Education');
  for (const e of r.education) {
    const grad = e.endDate ? `Expected ${fmtDate(e.endDate)}` : undefined;
    w.entry(e.institution, [e.area, grad]);
    if (e.score) w.line(e.score);
    if (e.courses?.length) w.labelled('Subjects', e.courses);
    w.gap(0.3);
  }
};

const experience =
  (title = 'Experience', includeVolunteer = true): Section =>
  (w, r) => {
    const work = r.work ?? [];
    const vol = includeVolunteer ? r.volunteer ?? [] : [];
    if (!work.length && !vol.length) return;
    w.heading(title);
    for (const j of work) {
      w.entry(j.position ? `${j.position}, ${j.name}` : j.name, [dateRange(j.startDate, j.endDate)]);
      w.bullets(j.highlights);
      w.gap(0.3);
    }
    for (const v of vol) {
      w.entry(`${v.position ?? 'Volunteer'}, ${v.organization}`, ['Volunteer', dateRange(v.startDate, v.endDate)]);
      w.bullets(v.highlights);
      w.gap(0.3);
    }
  };

const volunteering: Section = (w, r) => {
  if (!r.volunteer?.length) return;
  w.heading('Volunteering');
  for (const v of r.volunteer) {
    w.entry(`${v.position ?? 'Volunteer'}, ${v.organization}`, [dateRange(v.startDate, v.endDate)]);
    w.bullets(v.highlights);
    w.gap(0.3);
  }
};

const projectsOf =
  (title: string, types: string[] | 'all'): Section =>
  (w, r) => {
    const items = (r.projects ?? []).filter((p) => types === 'all' || types.includes(p.type ?? 'project'));
    if (!items.length) return;
    w.heading(title);
    for (const p of items) {
      w.entry(p.name, [dateRange(p.startDate, p.endDate)]);
      if (p.description) w.paragraph(p.description);
      w.bullets(p.highlights);
      w.gap(0.3);
    }
  };

const awards =
  (title = 'Awards & Achievements'): Section =>
  (w, r) => {
    if (!r.awards?.length) return;
    w.heading(title);
    for (const a of r.awards) {
      w.entry(a.title, [a.awarder, fmtDate(a.date)]);
      if (a.summary) w.paragraph(a.summary);
      w.gap(0.2);
    }
  };

const certificates =
  (title = 'Certificates'): Section =>
  (w, r) => {
    if (!r.certificates?.length) return;
    w.heading(title);
    for (const c of r.certificates) {
      w.entry(c.name, [c.issuer, fmtDate(c.date)]);
      w.gap(0.2);
    }
  };

const skillsBlock =
  (title = 'Skills & Interests'): Section =>
  (w, r) => {
    const hasAny = r.skills?.length || r.languages?.length || r.interests?.length;
    if (!hasAny) return;
    w.heading(title);
    for (const s of r.skills ?? []) w.labelled(s.name, s.keywords);
    if (r.languages?.length)
      w.labelled(
        'Languages',
        r.languages.map((l) => (l.fluency ? `${l.language} (${l.fluency})` : l.language)),
      );
    if (r.interests?.length) w.labelled('Interests', r.interests.map((i) => i.name));
  };

// ---------- templates ----------

interface TemplateDef {
  fonts: typeof HELVETICA;
  accent: string;
  body: number;
  headingStyle: 'rule' | 'caps' | 'plain';
  align: 'left' | 'center';
  sections: Section[];
}

export const CV_TEMPLATES: Record<CvTemplate, TemplateDef> = {
  /** Clean: balanced general-purpose CV. */
  clean: {
    fonts: HELVETICA,
    accent: '#1f3a5f',
    body: 10,
    headingStyle: 'rule',
    align: 'center',
    sections: [
      summary('Profile'),
      education,
      experience('Experience'),
      projectsOf('Projects & Activities', 'all'),
      awards(),
      certificates(),
      skillsBlock(),
    ],
  },
  /** Academic / university: education and honours first, activities framed for admissions readers. */
  academic: {
    fonts: TIMES,
    accent: '#5a1f1f',
    body: 10.5,
    headingStyle: 'caps',
    align: 'center',
    sections: [
      education,
      awards('Academic Honours & Awards'),
      projectsOf('Projects & Research', ['project']),
      projectsOf('Leadership & Co-curricular Activities', ['leadership', 'sport']),
      volunteering,
      experience('Work Experience', false),
      certificates('Certifications & Courses'),
      summary('Personal Statement Summary'),
      skillsBlock('Skills, Languages & Interests'),
    ],
  },
  /** Internship: objective + skills up top, then experience and projects. */
  internship: {
    fonts: HELVETICA,
    accent: '#0b5d4b',
    body: 10,
    headingStyle: 'rule',
    align: 'left',
    sections: [
      summary('Objective'),
      skillsBlock('Skills'),
      experience('Experience', false),
      projectsOf('Projects', ['project']),
      volunteering,
      projectsOf('Leadership & Activities', ['leadership', 'sport']),
      education,
      certificates('Certifications'),
      awards('Awards'),
    ],
  },
};

/**
 * Render a JSON Resume to an ATS-safe PDF (single column, selectable text, standard headings,
 * no tables/images/icons). Returns the PDF bytes.
 */
export async function renderCvPdf(
  resume: JsonResume,
  template: CvTemplate = 'clean',
  opts: PdfRenderOptions = {},
): Promise<Buffer> {
  const def = CV_TEMPLATES[template];
  if (!def) throw new Error(`Unknown CV template: ${template}`);
  const { doc, done } = createDoc(
    {
      title: `${resume.basics.name} - CV`,
      author: resume.basics.name,
      subject: `Curriculum Vitae (${template})`,
      keywords: [...(resume.skills?.flatMap((s) => s.keywords ?? []) ?? []), ...(resume.interests?.map((i) => i.name) ?? [])].join(', '),
    },
    opts,
    template === 'academic' ? 56 : 50,
  );
  const fonts = resolveFonts(doc, def.fonts, opts);
  const w = new Writer(doc, fonts, def.accent, def.body);

  // Header (plain text lines, not a PDF header region — ATS parsers often skip real headers).
  w.name(resume.basics.name, { align: def.align });
  if (resume.basics.label) w.line(resume.basics.label, { align: def.align, color: def.accent });
  const contact = contactLine(resume);
  if (contact) w.line(contact, { align: def.align, size: def.body - 0.5, color: '#444444' });

  // Patch heading style per template.
  const origHeading = w.heading.bind(w);
  w.heading = (text: string) => origHeading(text, def.headingStyle);

  for (const section of def.sections) section(w, resume);

  doc.end();
  return done;
}
