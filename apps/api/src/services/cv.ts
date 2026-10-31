/**
 * Builds a JSON Resume (https://jsonresume.org/schema) document from the student profile and
 * achievements. Deterministic; AI-LATER: summary/highlight wording. PDF rendering is the
 * documents team's job (packages/documents) — pdf_url stays null here.
 */
import type { Achievement, CvVersion, School, Student } from '../domain';

const CURRICULUM_LABEL: Record<Student['curriculum'], string> = {
  british: 'British curriculum (IGCSE / A-Level)',
  indian_cbse: 'CBSE',
  indian_icse: 'ICSE / ISC',
  american: 'American curriculum (High School Diploma)',
  ib: 'International Baccalaureate',
  uae_moe: 'UAE Ministry of Education curriculum',
  other: 'Secondary education',
};

const ORDER: Record<CvVersion['target'], Achievement['category'][]> = {
  general: ['award', 'academic', 'leadership', 'project', 'work', 'volunteering', 'certificate', 'sport'],
  university: ['academic', 'award', 'project', 'leadership', 'volunteering', 'certificate', 'sport', 'work'],
  internship: ['work', 'project', 'certificate', 'leadership', 'award', 'academic', 'volunteering', 'sport'],
};

const byDateDesc = (a: Achievement, b: Achievement) => (b.date ?? '').localeCompare(a.date ?? '');

export function buildJsonResume(
  student: Student,
  achievements: Achievement[],
  opts: { target: CvVersion['target']; school: School | null; basics?: { email?: string; phone?: string; summary?: string } },
): Record<string, unknown> {
  const of = (...cats: Achievement['category'][]) =>
    achievements.filter((a) => cats.includes(a.category)).sort(byDateDesc);
  const interests = student.interests.slice(0, 5).join(', ');
  const summary = opts.basics?.summary ??
    `Grade ${student.grade} student${opts.school ? ` at ${opts.school.name}` : ''}${interests ? ` with interests in ${interests}` : ''}.`;

  const sections: Record<string, unknown[]> = {
    awards: of('award', 'academic').map((a) => ({ title: a.title, date: a.date ?? undefined, awarder: undefined, summary: a.description ?? undefined })),
    certificates: of('certificate').map((a) => ({ name: a.title, date: a.date ?? undefined, url: a.evidence_url ?? undefined })),
    volunteer: of('volunteering').map((a) => ({ organization: a.title, startDate: a.date ?? undefined, summary: a.description ?? undefined, url: a.evidence_url ?? undefined })),
    work: of('work').map((a) => ({ name: a.title, startDate: a.date ?? undefined, summary: a.description ?? undefined, url: a.evidence_url ?? undefined })),
    projects: of('project', 'leadership', 'sport').map((a) => ({
      name: a.title, startDate: a.date ?? undefined, description: a.description ?? undefined, url: a.evidence_url ?? undefined,
      type: a.category === 'project' ? 'project' : a.category, roles: a.category === 'leadership' ? ['Leader'] : undefined,
    })),
  };
  // section order follows target priority
  const sectionFor: Record<Achievement['category'], string> = {
    award: 'awards', academic: 'awards', certificate: 'certificates', volunteering: 'volunteer', work: 'work',
    project: 'projects', leadership: 'projects', sport: 'projects',
  };
  const orderedKeys = [...new Set(ORDER[opts.target].map((c) => sectionFor[c]))];
  const ordered: Record<string, unknown[]> = {};
  for (const k of orderedKeys) if (sections[k]!.length) ordered[k] = sections[k]!;

  return {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: student.full_name,
      label: `Grade ${student.grade} Student`,
      email: opts.basics?.email,
      phone: opts.basics?.phone,
      summary,
      location: { region: student.emirate ?? undefined, countryCode: 'AE' },
    },
    education: [{
      institution: opts.school?.name ?? 'Secondary school',
      studyType: CURRICULUM_LABEL[student.curriculum],
      area: `Grade ${student.grade}`,
    }],
    ...ordered,
    skills: student.strengths.map((s) => ({ name: s })),
    languages: student.languages.map((l) => ({ language: l })),
    interests: student.interests.map((i) => ({ name: i })),
    meta: { target: opts.target, generator: 'murshid-api/rule-based', ai_use_level: 'none', version: '1.0.0' },
  };
}
