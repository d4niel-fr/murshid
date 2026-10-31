import type { Achievement, CvTarget, School, Student, Curriculum } from '../types.js';
import {
  JSON_RESUME_SCHEMA_URL,
  type JRAward,
  type JRCertificate,
  type JRProject,
  type JRVolunteer,
  type JRWork,
  type JsonResume,
} from './schema.js';

export interface ResumeContact {
  email?: string;
  phone?: string;
  /** Defaults to the student's emirate. */
  city?: string;
  website?: string;
  profiles?: { network: string; username?: string; url?: string }[];
}

export interface ToJsonResumeInput {
  student: Student;
  achievements: Achievement[];
  school?: School | null;
  contact?: ResumeContact;
  target?: CvTarget;
  /** Subjects / courses to list under education (e.g. from Course rows). */
  courses?: string[];
  /** Predicted / current grades string, e.g. "Predicted: A*AA". Only shown when supplied. */
  score?: string;
  /**
   * Minors' CVs leave out date of birth and nationality by default (safer + ATS doesn't need them).
   * Set true only when an application explicitly requires them.
   */
  includePersonalDetails?: boolean;
  /** Clock injection for deterministic tests. */
  now?: Date;
}

export const CURRICULUM_LABEL: Record<Curriculum, string | undefined> = {
  british: 'British Curriculum (IGCSE / A Level)',
  indian_cbse: 'CBSE',
  indian_icse: 'ICSE / ISC',
  american: 'American Curriculum (High School Diploma)',
  ib: 'International Baccalaureate',
  uae_moe: 'UAE Ministry of Education Curriculum',
  other: undefined,
};

export function gradeLabel(grade: number, curriculum: Curriculum): string {
  return curriculum === 'british' ? `Year ${grade}` : `Grade ${grade}`;
}

/** Final school year for a curriculum (British schools run to Year 13). */
export function finalGrade(curriculum: Curriculum): number {
  return curriculum === 'british' ? 13 : 12;
}

/** UAE academic year ends ~June/July; from August on, the current year ends next calendar year. */
export function expectedGraduationYear(grade: number, curriculum: Curriculum, now = new Date()): number {
  const academicYearEnd = now.getUTCMonth() >= 7 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  return academicYearEnd + Math.max(0, finalGrade(curriculum) - grade);
}

/** "Position at Organisation" / "Title — Organisation" → parts. Rule-based. // AI-LATER: smarter parsing */
export function splitTitle(title: string): { role: string; org?: string } {
  const t = title.trim();
  const m =
    t.match(/^(.+?)\s+at\s+(.+)$/i) ??
    t.match(/^(.+?)\s+[—–]\s+(.+)$/) ??
    t.match(/^(.+?)\s+-\s+(.+)$/) ??
    t.match(/^(.+?),\s+(.+)$/);
  if (m && m[1] && m[2]) return { role: m[1].trim(), org: m[2].trim() };
  return { role: t };
}

/** Description → bullet highlights (split on newlines, bullets, or sentences). */
export function toHighlights(description?: string | null): string[] {
  if (!description) return [];
  const raw = description
    .split(/\r?\n|•|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((s) => s.replace(/^[-*\s]+/, '').trim())
    .filter(Boolean);
  return raw.map((s) => s.replace(/\s+/g, ' ')).slice(0, 4);
}

function isoDate(d: string | null | undefined): string | undefined {
  if (!d) return undefined;
  const m = d.match(/^(\d{4})(-\d{2})?(-\d{2})?/);
  return m ? m[0] : undefined;
}

function byDateDesc(a: Achievement, b: Achievement): number {
  return (b.date ?? '').localeCompare(a.date ?? '');
}

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Rule-based summary line. // AI-LATER: replace with a tone-checked, student-voiced summary. */
export function buildSummary(student: Student, school: School | null | undefined, target: CvTarget): string {
  const where = school?.name ? ` at ${school.name}` : '';
  const curr = CURRICULUM_LABEL[student.curriculum];
  const interests = student.interests.slice(0, 3);
  const strengths = student.strengths.slice(0, 3);
  const parts: string[] = [];
  parts.push(
    `${gradeLabel(student.grade, student.curriculum)} student${where}${curr ? ` (${curr})` : ''}` +
      (interests.length ? ` with a strong interest in ${listJoin(interests)}.` : '.'),
  );
  if (strengths.length) parts.push(`Strengths include ${listJoin(strengths)}.`);
  if (target === 'university') parts.push('Seeking a place on an undergraduate programme aligned with these interests.');
  else if (target === 'internship') parts.push('Looking for a student internship or work-experience placement to build practical skills.');
  return parts.join(' ');
}

export function toJsonResume(input: ToJsonResumeInput): JsonResume {
  const { student, school, contact = {}, target = 'general', now = new Date() } = input;
  const achievements = [...input.achievements].sort(byDateDesc);

  const work: JRWork[] = [];
  const volunteer: JRVolunteer[] = [];
  const awards: JRAward[] = [];
  const certificates: JRCertificate[] = [];
  const projects: JRProject[] = [];

  for (const a of achievements) {
    const date = isoDate(a.date);
    const highlights = toHighlights(a.description);
    const { role, org } = splitTitle(a.title);
    switch (a.category) {
      case 'work':
        work.push({
          name: org ?? role,
          position: org ? role : undefined,
          startDate: date,
          url: a.evidence_url ?? undefined,
          highlights: highlights.length ? highlights : undefined,
        });
        break;
      case 'volunteering':
        volunteer.push({
          organization: org ?? role,
          position: org ? role : 'Volunteer',
          startDate: date,
          url: a.evidence_url ?? undefined,
          highlights: highlights.length ? highlights : undefined,
        });
        break;
      case 'award':
      case 'academic':
        awards.push({
          title: org ? role : a.title,
          awarder: org,
          date,
          summary: a.description?.trim() || undefined,
        });
        break;
      case 'certificate':
        certificates.push({ name: org ? role : a.title, issuer: org, date, url: a.evidence_url ?? undefined });
        break;
      case 'project':
      case 'sport':
      case 'leadership':
        projects.push({
          name: a.title,
          type: a.category,
          description: highlights[0],
          highlights: highlights.length > 1 ? highlights.slice(1) : undefined,
          startDate: date,
          url: a.evidence_url ?? undefined,
        });
        break;
    }
  }

  const gradYear = expectedGraduationYear(student.grade, student.curriculum, now);
  const city = contact.city ?? student.emirate ?? undefined;

  const resume: JsonResume = {
    $schema: JSON_RESUME_SCHEMA_URL,
    basics: {
      name: student.full_name.trim(),
      label: `${gradeLabel(student.grade, student.curriculum)} Student`,
      email: contact.email,
      phone: contact.phone,
      url: contact.website,
      summary: buildSummary(student, school, target),
      location: city ? { city, countryCode: 'AE' } : { countryCode: 'AE' },
      profiles: contact.profiles?.length ? contact.profiles : undefined,
    },
    education: [
      {
        institution: school?.name ?? 'Secondary School',
        studyType: 'High School',
        area: CURRICULUM_LABEL[student.curriculum],
        endDate: String(gradYear),
        score: input.score,
        courses: input.courses?.length ? input.courses : undefined,
      },
    ],
    work: work.length ? work : undefined,
    volunteer: volunteer.length ? volunteer : undefined,
    awards: awards.length ? awards : undefined,
    certificates: certificates.length ? certificates : undefined,
    projects: projects.length ? projects : undefined,
    skills: student.strengths.length ? [{ name: 'Strengths', keywords: [...student.strengths] }] : undefined,
    languages: student.languages.length ? student.languages.map((l) => ({ language: l })) : undefined,
    interests: student.interests.length ? student.interests.map((i) => ({ name: i })) : undefined,
    meta: {
      version: 'v1.0.0',
      lastModified: now.toISOString(),
      murshid: { studentId: student.id, target, grade: student.grade, generator: '@murshid/documents' },
    },
  };

  if (input.includePersonalDetails) {
    // JSON Resume has no DOB/nationality fields; keep them in an extension only when asked.
    (resume.meta!.murshid as Record<string, unknown>).personal = {
      date_of_birth: student.date_of_birth ?? undefined,
      nationality: student.nationality ?? undefined,
    };
  }

  return stripUndefined(resume);
}

/** Remove undefined keys so the JSON stored in CvVersion.json is clean. */
export function stripUndefined<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
