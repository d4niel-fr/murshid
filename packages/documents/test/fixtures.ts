// Synthetic data only.
import type { Achievement, Application, Opportunity, School, Student } from '../src/types.js';

export const NOW = new Date('2026-10-10T08:00:00Z');

export const school: School = {
  id: '00000000-0000-4000-8000-000000000101',
  name: 'Test Academy Dubai',
  emirate: 'Dubai',
  curriculum: 'british',
  lms: 'google_classroom',
  domain: 'testacademy.example',
};

export const aisha: Student = {
  id: '00000000-0000-4000-8000-000000000001',
  full_name: 'Aisha Test',
  preferred_name: 'Aisha',
  date_of_birth: '2009-05-02',
  grade: 12,
  school_id: school.id,
  curriculum: 'british',
  emirate: 'Dubai',
  nationality: 'Emirati',
  languages: ['Arabic', 'English', 'French'],
  interests: ['Biomedical engineering', 'Robotics', 'Debate'],
  strengths: ['Python', 'Public speaking', 'Data analysis', 'Teamwork'],
};

export const rohan: Student = {
  id: '00000000-0000-4000-8000-000000000002',
  full_name: 'Rohan Test',
  preferred_name: null,
  grade: 11,
  curriculum: 'indian_cbse',
  emirate: 'Sharjah',
  languages: ['English', 'Hindi'],
  interests: ['Finance'],
  strengths: ['Excel'],
};

const a = (i: number, p: Omit<Achievement, 'id' | 'student_id'>): Achievement => ({
  id: `00000000-0000-4000-8000-0000000002${String(i).padStart(2, '0')}`,
  student_id: aisha.id,
  ...p,
});

export const achievements: Achievement[] = [
  a(1, { title: 'Gold Medal at UAE Science Olympiad', category: 'award', date: '2026-03-14', description: 'Placed first among 400 students in the national round.' }),
  a(2, { title: 'Summer Intern at Test Health Labs', category: 'work', date: '2026-07-01', description: 'Cleaned and charted patient-flow data in Python. Presented findings to the clinic team.\nBuilt a small dashboard used by two nurses.' }),
  a(3, { title: 'Volunteer Tutor — Test Community Centre', category: 'volunteering', date: '2025-11-01', description: 'Tutored Grade 7 students in maths every Saturday for 6 months.' }),
  a(4, { title: 'Low-cost prosthetic hand prototype', category: 'project', date: '2026-01-20', description: '3D-printed a tendon-driven hand for under AED 150. Won school innovation fair.', evidence_url: 'https://example.org/aisha/hand' }),
  a(5, { title: 'Head of Debate Society', category: 'leadership', date: '2025-09-01', description: 'Lead a 35-member society. Organised the first inter-school debate cup.' }),
  a(6, { title: 'School basketball team captain', category: 'sport', date: '2025-09-01', description: null }),
  a(7, { title: 'Google Data Analytics Certificate, Coursera', category: 'certificate', date: '2026-05-10', evidence_url: 'https://example.org/cert' }),
  a(8, { title: 'Top in Year — A Level Biology', category: 'academic', date: '2026-06-30' }),
];

export const opportunity: Opportunity = {
  id: '00000000-0000-4000-8000-000000000301',
  title: 'Test Youth Science Summer Programme',
  organizer: 'Test University Abu Dhabi',
  type: 'summer_program',
  url: 'https://example.org/summer',
  emirate: 'Abu Dhabi',
  min_grade: 10,
  max_grade: 12,
  eligibility_text: 'Open to UAE residents in Grades 10-12 with strong science grades.',
  cost_aed: 0,
  deadline: '2026-11-15T19:59:00Z',
  tags: ['science'],
  status: 'open',
};

export const application: Application = {
  id: '00000000-0000-4000-8000-000000000401',
  student_id: aisha.id,
  opportunity_id: opportunity.id,
  status: 'preparing',
  checklist: [
    { item: 'Check eligibility (grade, age, nationality, emirate)', done: true },
    { item: 'Ask a parent/guardian to approve the application', done: true },
    { item: 'Update CV (academic template)', done: false },
    { item: 'Write statement of interest', done: false },
    { item: 'Request teacher recommendation', done: false },
  ],
  notes: 'Ask Ms. Test (Biology) for the recommendation by 1 Nov.',
};
