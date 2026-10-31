// Subset of the JSON Resume schema v1.0.0 (https://jsonresume.org/schema).
// All fields optional per the spec; we only emit what we can fill honestly.

export interface JRLocation {
  address?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
  region?: string;
}

export interface JRProfile {
  network: string;
  username?: string;
  url?: string;
}

export interface JRBasics {
  name: string;
  label?: string;
  image?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: JRLocation;
  profiles?: JRProfile[];
}

export interface JRWork {
  name: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface JRVolunteer {
  organization: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

export interface JREducation {
  institution: string;
  url?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
  courses?: string[];
}

export interface JRAward {
  title: string;
  date?: string;
  awarder?: string;
  summary?: string;
}

export interface JRCertificate {
  name: string;
  date?: string;
  issuer?: string;
  url?: string;
}

export interface JRSkill {
  name: string;
  level?: string;
  keywords?: string[];
}

export interface JRLanguage {
  language: string;
  fluency?: string;
}

export interface JRInterest {
  name: string;
  keywords?: string[];
}

export interface JRProject {
  name: string;
  description?: string;
  highlights?: string[];
  keywords?: string[];
  startDate?: string;
  endDate?: string;
  url?: string;
  roles?: string[];
  entity?: string;
  type?: string;
}

export interface JsonResume {
  $schema?: string;
  basics: JRBasics;
  work?: JRWork[];
  volunteer?: JRVolunteer[];
  education?: JREducation[];
  awards?: JRAward[];
  certificates?: JRCertificate[];
  publications?: unknown[];
  skills?: JRSkill[];
  languages?: JRLanguage[];
  interests?: JRInterest[];
  references?: unknown[];
  projects?: JRProject[];
  meta?: {
    canonical?: string;
    version?: string;
    lastModified?: string;
    /** Murshid extension: which CV target this resume was built for. */
    murshid?: { studentId: string; target: string; grade: number; generator: string };
  };
}

export const JSON_RESUME_SCHEMA_URL =
  'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json';

const ISO_DATE = /^([1-2][0-9]{3}-[0-1][0-9]-[0-3][0-9]|[1-2][0-9]{3}-[0-1][0-9]|[1-2][0-9]{3})$/;

/**
 * Lightweight structural validation against the JSON Resume rules we rely on
 * (types + iso8601 date pattern used by the official schema). Returns a list of problems.
 */
export function validateJsonResume(r: JsonResume): string[] {
  const errs: string[] = [];
  if (!r || typeof r !== 'object') return ['resume must be an object'];
  if (!r.basics || typeof r.basics.name !== 'string' || !r.basics.name.trim()) {
    errs.push('basics.name is required');
  }
  if (r.basics?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.basics.email)) {
    errs.push('basics.email is not a valid email');
  }
  const arrays = [
    'work',
    'volunteer',
    'education',
    'awards',
    'certificates',
    'skills',
    'languages',
    'interests',
    'projects',
  ] as const;
  for (const key of arrays) {
    const v = r[key];
    if (v !== undefined && !Array.isArray(v)) errs.push(`${key} must be an array`);
  }
  const checkDate = (path: string, d: unknown) => {
    if (d !== undefined && (typeof d !== 'string' || !ISO_DATE.test(d))) {
      errs.push(`${path} must be an ISO-8601 date (YYYY, YYYY-MM or YYYY-MM-DD)`);
    }
  };
  r.work?.forEach((w, i) => {
    checkDate(`work[${i}].startDate`, w.startDate);
    checkDate(`work[${i}].endDate`, w.endDate);
  });
  r.volunteer?.forEach((w, i) => {
    checkDate(`volunteer[${i}].startDate`, w.startDate);
    checkDate(`volunteer[${i}].endDate`, w.endDate);
  });
  r.education?.forEach((e, i) => {
    checkDate(`education[${i}].startDate`, e.startDate);
    checkDate(`education[${i}].endDate`, e.endDate);
  });
  r.awards?.forEach((a, i) => checkDate(`awards[${i}].date`, a.date));
  r.certificates?.forEach((c, i) => checkDate(`certificates[${i}].date`, c.date));
  r.projects?.forEach((p, i) => {
    checkDate(`projects[${i}].startDate`, p.startDate);
    checkDate(`projects[${i}].endDate`, p.endDate);
  });
  return errs;
}
