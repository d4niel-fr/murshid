import type { OpportunityType } from '../api/types';

export const OPP_TYPES: { id: OpportunityType | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'competition', label: 'Competitions' },
  { id: 'olympiad', label: 'Olympiads' },
  { id: 'summer_program', label: 'Summer programmes' },
  { id: 'internship', label: 'Internships' },
  { id: 'scholarship', label: 'Scholarships' },
  { id: 'volunteering', label: 'Volunteering' },
  { id: 'mun', label: 'MUN' },
  { id: 'hackathon', label: 'Hackathons' },
  { id: 'course', label: 'Courses' },
];

// Display labels for raw enum values. Mirrors @murshid/core `enumLabel` (packages/core/src/labels.ts);
// the mobile app keeps a local copy until Metro resolves workspace packages.
const OPP_TYPE_LABEL: Record<string, string> = {
  competition: 'Competition', internship: 'Internship', scholarship: 'Scholarship', summer_program: 'Summer programme',
  volunteering: 'Volunteering', olympiad: 'Olympiad', mun: 'Model UN', hackathon: 'Hackathon', course: 'Course',
};
const EMIRATE_LABEL: Record<string, string> = {
  abu_dhabi: 'Abu Dhabi', dubai: 'Dubai', sharjah: 'Sharjah', ajman: 'Ajman', umm_al_quwain: 'Umm Al Quwain',
  ras_al_khaimah: 'Ras Al Khaimah', fujairah: 'Fujairah',
};
const CURRICULUM_LABEL: Record<string, string> = {
  british: 'British', indian_cbse: 'Indian (CBSE)', indian_icse: 'Indian (ICSE)', american: 'American', ib: 'IB',
  uae_moe: 'UAE MoE', other: 'Other',
};

/** "summer_program" → "Summer program" (fallback for values without a label). */
export function humanize(value: string): string {
  const s = value.replace(/[_-]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
const lookup = (map: Record<string, string>) => (v: string | null | undefined) =>
  v ? map[v] ?? map[v.toLowerCase().replace(/[\s-]+/g, '_')] ?? humanize(v) : '';
export const oppTypeLabel = lookup(OPP_TYPE_LABEL);
export const emirateLabel = lookup(EMIRATE_LABEL);
export const curriculumLabel = lookup(CURRICULUM_LABEL);
