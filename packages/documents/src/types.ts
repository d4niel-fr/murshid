// Local copies of the core domain types from docs/CONTRACT.md.
// Replace with imports from @murshid/core once that package lands (see README "Integration notes").

export type Curriculum =
  | 'british'
  | 'indian_cbse'
  | 'indian_icse'
  | 'american'
  | 'ib'
  | 'uae_moe'
  | 'other';

export interface Student {
  id: string;
  auth_user_id?: string;
  full_name: string;
  preferred_name?: string | null;
  date_of_birth?: string | null;
  grade: number; // 6-13
  school_id?: string | null;
  curriculum: Curriculum;
  emirate?: string | null;
  nationality?: string | null;
  languages: string[];
  interests: string[];
  strengths: string[];
  created_at?: string;
}

export interface School {
  id: string;
  name: string;
  emirate?: string | null;
  curriculum?: Curriculum;
  lms?: string;
  domain?: string | null;
}

export type AchievementCategory =
  | 'academic'
  | 'award'
  | 'sport'
  | 'project'
  | 'volunteering'
  | 'work'
  | 'certificate'
  | 'leadership';

export interface Achievement {
  id: string;
  student_id: string;
  title: string;
  category: AchievementCategory;
  date: string | null; // ISO date
  description?: string | null;
  evidence_url?: string | null;
}

export type OpportunityType =
  | 'competition'
  | 'internship'
  | 'scholarship'
  | 'summer_program'
  | 'volunteering'
  | 'olympiad'
  | 'mun'
  | 'hackathon'
  | 'course';

export interface Opportunity {
  id: string;
  title: string;
  organizer: string;
  type: OpportunityType;
  url?: string | null;
  emirate?: string | null;
  country?: string | null;
  min_grade?: number | null;
  max_grade?: number | null;
  eligibility_text?: string | null;
  nationality_restriction?: string | null;
  cost_aed?: number | null;
  deadline?: string | null;
  tags?: string[];
  status?: 'open' | 'closed' | 'unknown';
}

export interface ChecklistItem {
  item: string;
  done: boolean;
}

export interface Application {
  id: string;
  student_id: string;
  opportunity_id: string;
  status: 'saved' | 'preparing' | 'submitted' | 'accepted' | 'rejected';
  checklist: ChecklistItem[];
  notes?: string | null;
  submitted_at?: string | null;
}

export type CvTarget = 'general' | 'university' | 'internship';
export type CvTemplate = 'clean' | 'academic' | 'internship';

/** Shape stored in CvVersion (json column holds the JSON Resume). */
export interface CvVersion {
  id: string;
  student_id: string;
  template: CvTemplate;
  target: CvTarget;
  json: import('./jsonresume/schema.js').JsonResume;
  pdf_url: string | null;
  created_at: string;
}
