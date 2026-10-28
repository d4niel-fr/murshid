// Synthetic seed data only. No real students, schools or opportunities' private data.
import type {
  Achievement,
  Application,
  AuditLogEntry,
  CalendarEvent,
  Connection,
  Course,
  Goal,
  Material,
  Milestone,
  NotificationPrefs,
  Opportunity,
  School,
  Student,
  Task,
} from './types';

const DAY = 86_400_000;
export const daysFromNow = (d: number, hour = 9) => {
  const t = new Date(Date.now() + d * DAY);
  t.setHours(hour, 0, 0, 0);
  return t.toISOString();
};
const dateOnly = (d: number) => daysFromNow(d).slice(0, 10);

export const STUDENT_ID = '00000000-0000-4000-8000-000000000001';

export const seedSchools: School[] = [
  { id: 'sch-1', name: 'Al Noor Test Academy', emirate: 'dubai', curriculum: 'british', lms: 'google_classroom', domain: 'alnoor-test.ae' },
  { id: 'sch-2', name: 'Desert Rose Test School', emirate: 'sharjah', curriculum: 'indian_cbse', lms: 'teams', domain: 'desertrose-test.ae' },
  { id: 'sch-3', name: 'Corniche Test International', emirate: 'abu_dhabi', curriculum: 'ib', lms: 'managebac', domain: 'corniche-test.ae' },
  { id: 'sch-4', name: 'Falcon Test American School', emirate: 'dubai', curriculum: 'american', lms: 'phoenix', domain: 'falcon-test.ae' },
];

/** Used when the mock is "already onboarded" (e.g. after sign-in with demo account). */
export const demoStudent: Student = {
  id: STUDENT_ID,
  auth_user_id: 'auth-demo-aisha',
  full_name: 'Aisha Test',
  preferred_name: 'Aisha',
  date_of_birth: '2009-03-14',
  grade: 11,
  school_id: 'sch-1',
  curriculum: 'british',
  emirate: 'dubai',
  nationality: 'AE',
  languages: ['English', 'Arabic'],
  interests: ['robotics', 'medicine', 'debate'],
  strengths: ['maths', 'public speaking'],
  created_at: daysFromNow(-30),
  goals_text: 'Get into a good medicine programme and win a robotics competition.',
};

export const seedGoals: Goal[] = [
  { id: 'g1', student_id: STUDENT_ID, title: 'Get into a medicine programme', category: 'university', target_date: '2027-09-01', status: 'active', parent_goal_id: null, progress: 35 },
  { id: 'g1a', student_id: STUDENT_ID, title: 'A* in A-level Biology & Chemistry', category: 'academic', target_date: '2027-06-30', status: 'active', parent_goal_id: 'g1', progress: 50 },
  { id: 'g1b', student_id: STUDENT_ID, title: 'Hospital volunteering hours (40h)', category: 'personal', target_date: '2027-03-01', status: 'active', parent_goal_id: 'g1', progress: 20 },
  { id: 'g2', student_id: STUDENT_ID, title: 'Compete in a robotics championship', category: 'skill', target_date: dateOnly(120), status: 'active', parent_goal_id: null, progress: 60 },
  { id: 'g3', student_id: STUDENT_ID, title: 'Run 5 km under 30 minutes', category: 'sport', target_date: dateOnly(60), status: 'active', parent_goal_id: null, progress: 70 },
];

export const seedMilestones: Milestone[] = [
  { id: 'm1', goal_id: 'g1a', title: 'Finish Biology unit 3 past papers', due_date: dateOnly(5), done: false },
  { id: 'm2', goal_id: 'g1a', title: 'Chemistry mock ≥ 80%', due_date: dateOnly(21), done: false },
  { id: 'm3', goal_id: 'g1b', title: 'Apply to hospital volunteer scheme', due_date: dateOnly(-3), done: true },
  { id: 'm4', goal_id: 'g1b', title: 'Complete first 10 hours', due_date: dateOnly(30), done: false },
  { id: 'm5', goal_id: 'g1', title: 'Shortlist 6 universities', due_date: dateOnly(45), done: false },
  { id: 'm6', goal_id: 'g2', title: 'Build drivetrain prototype', due_date: dateOnly(-10), done: true },
  { id: 'm7', goal_id: 'g2', title: 'Register team', due_date: dateOnly(9), done: false },
  { id: 'm8', goal_id: 'g3', title: 'Run 3 × 5 km this month', due_date: dateOnly(20), done: false },
];

export const seedCourses: Course[] = [
  { id: 'c1', student_id: STUDENT_ID, name: 'A-level Biology', teacher: 'Ms. Test Rahman', source: 'google_classroom', external_id: 'gc-101' },
  { id: 'c2', student_id: STUDENT_ID, name: 'A-level Chemistry', teacher: 'Mr. Test Iyer', source: 'google_classroom', external_id: 'gc-102' },
  { id: 'c3', student_id: STUDENT_ID, name: 'A-level Maths', teacher: 'Ms. Test Haddad', source: 'teams', external_id: 'tm-201' },
  { id: 'c4', student_id: STUDENT_ID, name: 'Arabic Language', teacher: 'Ustadh Test Saleh', source: 'manual', external_id: null },
];

export const seedMaterials: Material[] = [
  { id: 'mt1', course_id: 'c1', title: 'Cell transport worksheet', kind: 'assignment', body_text: 'Answer Q1–12 on osmosis and active transport.', file_url: null, due_at: daysFromNow(2, 23), source: 'google_classroom', external_id: 'gc-a1', ingested_at: daysFromNow(-1) },
  { id: 'mt2', course_id: 'c1', title: 'Unit 3 revision notes', kind: 'note', body_text: 'Enzymes, kinetics, inhibition.', file_url: null, due_at: null, source: 'google_classroom', external_id: 'gc-n1', ingested_at: daysFromNow(-4) },
  { id: 'mt3', course_id: 'c2', title: 'Organic chemistry quiz', kind: 'exam', body_text: 'Covers alkanes, alkenes and halogenoalkanes.', file_url: null, due_at: daysFromNow(4, 8), source: 'google_classroom', external_id: 'gc-e1', ingested_at: daysFromNow(-2) },
  { id: 'mt4', course_id: 'c3', title: 'Integration problem set', kind: 'assignment', body_text: 'Exercises 7A–7C.', file_url: null, due_at: daysFromNow(6, 23), source: 'teams', external_id: 'tm-a1', ingested_at: daysFromNow(-1) },
  { id: 'mt5', course_id: 'c3', title: 'Lesson moved to Lab 2 on Thursday', kind: 'announcement', body_text: null, file_url: null, due_at: null, source: 'teams', external_id: 'tm-an1', ingested_at: daysFromNow(0) },
];

export const seedTasks: Task[] = [
  { id: 't1', student_id: STUDENT_ID, title: 'Cell transport worksheet', kind: 'assignment', due_at: daysFromNow(2, 23), est_minutes: 45, status: 'todo', linked_goal_id: 'g1a', linked_material_id: 'mt1', linked_opportunity_id: null, ai_use_level: 'none' },
  { id: 't2', student_id: STUDENT_ID, title: 'Revise organic chemistry (45 min)', kind: 'study', due_at: daysFromNow(1, 17), est_minutes: 45, status: 'todo', linked_goal_id: 'g1a', linked_material_id: 'mt3', linked_opportunity_id: null, ai_use_level: 'support' },
  { id: 't3', student_id: STUDENT_ID, title: 'Draft personal statement for summer programme', kind: 'application', due_at: daysFromNow(3, 18), est_minutes: 60, status: 'doing', linked_goal_id: 'g1', linked_material_id: null, linked_opportunity_id: 'o3', ai_use_level: 'support' },
  { id: 't4', student_id: STUDENT_ID, title: 'Robotics club build session', kind: 'activity', due_at: daysFromNow(2, 15), est_minutes: 90, status: 'todo', linked_goal_id: 'g2', linked_material_id: null, linked_opportunity_id: null, ai_use_level: 'none' },
  { id: 't5', student_id: STUDENT_ID, title: '5 km run', kind: 'habit', due_at: daysFromNow(0, 6), est_minutes: 35, status: 'done', linked_goal_id: 'g3', linked_material_id: null, linked_opportunity_id: null, ai_use_level: 'none' },
  { id: 't6', student_id: STUDENT_ID, title: 'Integration problem set', kind: 'assignment', due_at: daysFromNow(6, 23), est_minutes: 60, status: 'todo', linked_goal_id: 'g1a', linked_material_id: 'mt4', linked_opportunity_id: null, ai_use_level: 'none' },
  { id: 't7', student_id: STUDENT_ID, title: 'Register robotics team', kind: 'application', due_at: daysFromNow(5, 12), est_minutes: 20, status: 'todo', linked_goal_id: 'g2', linked_material_id: null, linked_opportunity_id: 'o1', ai_use_level: 'none' },
];

export const seedEvents: CalendarEvent[] = [
  { id: 'e1', student_id: STUDENT_ID, title: 'School', start_at: daysFromNow(1, 7), end_at: daysFromNow(1, 14), source: 'google_calendar', external_id: null },
  { id: 'e2', student_id: STUDENT_ID, title: 'Tutor – Maths', start_at: daysFromNow(3, 16), end_at: daysFromNow(3, 17), source: 'google_calendar', external_id: null },
  { id: 'e3', student_id: STUDENT_ID, title: 'Family dinner', start_at: daysFromNow(4, 19), end_at: daysFromNow(4, 21), source: 'manual', external_id: null },
];

export const seedOpportunities: Opportunity[] = [
  { id: 'o1', title: 'UAE Schools Robotics Challenge (synthetic)', organizer: 'Test Robotics Foundation', type: 'competition', url: 'https://example.org/robotics', emirate: 'dubai', country: 'AE', min_grade: 9, max_grade: 12, eligibility_text: 'Teams of 3–5 students in grades 9–12 at UAE schools.', nationality_restriction: null, cost_aed: 0, deadline: daysFromNow(12), tags: ['robotics', 'stem', 'team'], source_id: 'mock', last_seen_at: daysFromNow(0), status: 'open' },
  { id: 'o2', title: 'Emirates Junior Maths Olympiad (synthetic)', organizer: 'Test Maths Society', type: 'olympiad', url: 'https://example.org/olympiad', emirate: null, country: 'AE', min_grade: 7, max_grade: 12, eligibility_text: 'Open to all students in UAE schools.', nationality_restriction: null, cost_aed: 50, deadline: daysFromNow(20), tags: ['maths', 'stem'], source_id: 'mock', last_seen_at: daysFromNow(-1), status: 'open' },
  { id: 'o3', title: 'Summer Medicine Taster Programme (synthetic)', organizer: 'Test University Hospital', type: 'summer_program', url: 'https://example.org/medicine-summer', emirate: 'abu_dhabi', country: 'AE', min_grade: 10, max_grade: 12, eligibility_text: 'Grades 10–12 interested in medicine. Personal statement + teacher reference.', nationality_restriction: null, cost_aed: 1200, deadline: daysFromNow(9), tags: ['medicine', 'health', 'university'], source_id: 'mock', last_seen_at: daysFromNow(0), status: 'open' },
  { id: 'o4', title: 'Model UN Dubai (synthetic)', organizer: 'Test MUN Association', type: 'mun', url: 'https://example.org/mun', emirate: 'dubai', country: 'AE', min_grade: 8, max_grade: 12, eligibility_text: 'Delegations or individual delegates.', nationality_restriction: null, cost_aed: 300, deadline: daysFromNow(30), tags: ['debate', 'leadership'], source_id: 'mock', last_seen_at: daysFromNow(-2), status: 'open' },
  { id: 'o5', title: 'Green Futures Hackathon (synthetic)', organizer: 'Test Sustainability Lab', type: 'hackathon', url: 'https://example.org/hack', emirate: 'sharjah', country: 'AE', min_grade: 10, max_grade: 13, eligibility_text: 'Ages 15–19. Bring a laptop.', nationality_restriction: null, cost_aed: 0, deadline: daysFromNow(6), tags: ['coding', 'sustainability', 'stem'], source_id: 'mock', last_seen_at: daysFromNow(0), status: 'open' },
  { id: 'o6', title: 'Hospital Youth Volunteer Scheme (synthetic)', organizer: 'Test Health Network', type: 'volunteering', url: 'https://example.org/volunteer', emirate: 'dubai', country: 'AE', min_grade: 10, max_grade: 13, eligibility_text: 'Age 16+, guardian consent required.', nationality_restriction: null, cost_aed: 0, deadline: null, tags: ['medicine', 'volunteering'], source_id: 'mock', last_seen_at: daysFromNow(-3), status: 'open' },
  { id: 'o7', title: 'National Youth STEM Scholarship (synthetic)', organizer: 'Test Ministry Programme', type: 'scholarship', url: 'https://example.org/scholarship', emirate: null, country: 'AE', min_grade: 12, max_grade: 13, eligibility_text: 'UAE nationals in final year.', nationality_restriction: 'AE', cost_aed: 0, deadline: daysFromNow(60), tags: ['scholarship', 'stem', 'university'], source_id: 'mock', last_seen_at: daysFromNow(-1), status: 'open' },
  { id: 'o8', title: 'Intro to Data Science online course (synthetic)', organizer: 'Test Online Academy', type: 'course', url: 'https://example.org/course', emirate: null, country: 'Online', min_grade: 9, max_grade: 13, eligibility_text: 'Self-paced, free certificate.', nationality_restriction: null, cost_aed: 0, deadline: null, tags: ['coding', 'data'], source_id: 'mock', last_seen_at: daysFromNow(-5), status: 'open' },
  { id: 'o9', title: 'Tech Startup Shadow Internship (synthetic)', organizer: 'Test Ventures', type: 'internship', url: 'https://example.org/internship', emirate: 'dubai', country: 'AE', min_grade: 11, max_grade: 13, eligibility_text: 'Two-week summer internship, age 16+.', nationality_restriction: null, cost_aed: 0, deadline: daysFromNow(-2), tags: ['business', 'tech'], source_id: 'mock', last_seen_at: daysFromNow(-2), status: 'closed' },
];

export const defaultChecklist = (o: Opportunity): { item: string; done: boolean }[] => {
  // AI-LATER: tailor checklist from eligibility text. Rule-based by type for now.
  const base = [{ item: 'Read eligibility & rules', done: false }];
  const byType: Record<string, string[]> = {
    competition: ['Form a team', 'Register team online', 'Plan build schedule'],
    olympiad: ['Register with school coordinator', 'Do 3 past papers'],
    summer_program: ['Write personal statement', 'Ask a teacher for a reference', 'Guardian signs consent form', 'Submit application'],
    mun: ['Choose committee preference', 'Write position paper', 'Pay fee'],
    hackathon: ['Register', 'Find teammates', 'Prepare laptop & accounts'],
    volunteering: ['Guardian consent form', 'Submit application', 'Attend induction'],
    scholarship: ['Gather transcripts', 'Write essay', 'Get recommendation letters', 'Submit'],
    internship: ['Update CV', 'Write cover note', 'Submit application'],
    course: ['Enrol', 'Schedule weekly study time'],
  };
  return [...base, ...(byType[o.type] ?? ['Submit application']).map((item) => ({ item, done: false }))];
};

export const seedApplications: Application[] = [
  { id: 'a1', student_id: STUDENT_ID, opportunity_id: 'o3', status: 'preparing', checklist: [
    { item: 'Read eligibility & rules', done: true },
    { item: 'Write personal statement', done: false },
    { item: 'Ask a teacher for a reference', done: true },
    { item: 'Guardian signs consent form', done: false },
    { item: 'Submit application', done: false },
  ], notes: 'Ask Ms. Test Rahman for the reference by Thursday.', submitted_at: null },
  { id: 'a2', student_id: STUDENT_ID, opportunity_id: 'o1', status: 'saved', checklist: [], notes: '', submitted_at: null },
  { id: 'a3', student_id: STUDENT_ID, opportunity_id: 'o9', status: 'rejected', checklist: [], notes: 'Try again next summer.', submitted_at: daysFromNow(-20) },
];
seedApplications[1].checklist = defaultChecklist(seedOpportunities[0]);

export const seedAchievements: Achievement[] = [
  { id: 'ac1', student_id: STUDENT_ID, title: 'Gold – School Science Fair (synthetic)', category: 'award', date: '2026-03-10', description: 'Built a low-cost water quality sensor.', evidence_url: null },
  { id: 'ac2', student_id: STUDENT_ID, title: 'Robotics club vice-captain', category: 'leadership', date: '2025-09-01', description: 'Lead a team of 8 on drivetrain design.', evidence_url: null },
  { id: 'ac3', student_id: STUDENT_ID, title: 'Beach clean-up volunteer (12h)', category: 'volunteering', date: '2026-01-20', description: 'Organised two clean-ups with classmates.', evidence_url: null },
  { id: 'ac4', student_id: STUDENT_ID, title: 'IGCSE: 8 × A*/A', category: 'academic', date: '2025-08-20', description: 'Including Biology, Chemistry and Maths.', evidence_url: null },
  { id: 'ac5', student_id: STUDENT_ID, title: 'First Aid certificate', category: 'certificate', date: '2026-05-02', description: 'Basic life support.', evidence_url: null },
];

export const seedConnections: Connection[] = [
  { id: 'cn1', student_id: STUDENT_ID, provider: 'google_classroom', scopes: ['classroom.courses.readonly', 'classroom.coursework.me.readonly'], status: 'connected', token_ref: 'vault://mock/gc', last_sync_at: daysFromNow(0, 7) },
  { id: 'cn2', student_id: STUDENT_ID, provider: 'teams', scopes: [], status: 'disconnected', token_ref: null, last_sync_at: null },
  { id: 'cn3', student_id: STUDENT_ID, provider: 'google_calendar', scopes: ['calendar.readonly'], status: 'connected', token_ref: 'vault://mock/gcal', last_sync_at: daysFromNow(0, 7) },
  { id: 'cn4', student_id: STUDENT_ID, provider: 'uae_pass', scopes: [], status: 'disconnected', token_ref: null, last_sync_at: null },
  { id: 'cn5', student_id: STUDENT_ID, provider: 'linkedin', scopes: [], status: 'disconnected', token_ref: null, last_sync_at: null },
];

export const seedNotificationPrefs: NotificationPrefs = {
  channels: { push: true, email: true, whatsapp: false, in_app: true },
  daily_briefing: true,
  briefing_time: '06:45',
  deadline_reminders: true,
  new_opportunities: true,
  weekly_summary_to_guardian: false,
  quiet_hours: { start: '22:00', end: '06:00' },
};

export const seedAiLog: AuditLogEntry[] = [
  { id: 'l1', actor: 'connector:google_classroom', action: 'read', resource: 'courses + coursework', at: daysFromNow(0, 7) },
  { id: 'l2', actor: 'planner (rule-based)', action: 'scheduled study block', resource: 'task t2', at: daysFromNow(-1, 20), ai_use_level: 'none' },
  { id: 'l3', actor: 'agent (mock)', action: 'suggested checklist', resource: 'application a1', at: daysFromNow(-2, 18), ai_use_level: 'support' },
  { id: 'l4', actor: 'connector:google_calendar', action: 'read', resource: 'calendar events (7 days)', at: daysFromNow(-1, 7) },
];
