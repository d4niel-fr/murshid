/**
 * Synthetic seed data only (contract: "Aisha Test", "Rohan Test"). Dates are relative to `now`
 * so the demo always has upcoming deadlines. Fixed ids make dev requests easy to type.
 */
import type { Repository } from './types';
import { addDays, dubaiDate, dubaiInstant, mondayOf } from '../lib/time';

export const SEED = {
  schoolId: '00000000-0000-4000-a000-000000000001',
  aisha: { studentId: '00000000-0000-4000-a000-000000000101', authUserId: 'dev-aisha' },
  rohan: { studentId: '00000000-0000-4000-a000-000000000102', authUserId: 'dev-rohan' },
  guardian: { id: '00000000-0000-4000-a000-000000000201', email: 'parent.aisha@example.test' },
  rohanGuardian: { id: '00000000-0000-4000-a000-000000000202', email: 'parent.rohan@example.test' },
  courses: {
    physics: '00000000-0000-4000-a000-000000000301',
    english: '00000000-0000-4000-a000-000000000302',
    maths: '00000000-0000-4000-a000-000000000303',
  },
  goalId: '00000000-0000-4000-a000-000000000401',
} as const;

export async function seedRepository(repo: Repository, now = new Date()): Promise<void> {
  const today = dubaiDate(now);
  const monday = mondayOf(now);
  const at = (dayOffset: number, hh: number, mm = 0) => dubaiInstant(addDays(today, dayOffset), hh * 60 + mm).toISOString();
  const weekAt = (dayOffset: number, hh: number, mm = 0) =>
    dubaiInstant(addDays(monday, dayOffset), hh * 60 + mm).toISOString();
  const created = now.toISOString();

  await repo.schools.create({
    id: SEED.schoolId, name: 'Test Academy Dubai', emirate: 'Dubai', curriculum: 'british', lms: 'google_classroom',
    domain: 'testacademy.example',
  });

  const aisha = await repo.students.create({
    id: SEED.aisha.studentId, auth_user_id: SEED.aisha.authUserId, full_name: 'Aisha Test', preferred_name: 'Aisha',
    date_of_birth: '2010-03-15', grade: 11, school_id: SEED.schoolId, curriculum: 'british', emirate: 'Dubai',
    nationality: 'AE', languages: ['English', 'Arabic'], interests: ['robotics', 'physics', 'coding', 'debate'],
    strengths: ['maths', 'public speaking'], created_at: created,
  });
  const rohan = await repo.students.create({
    id: SEED.rohan.studentId, auth_user_id: SEED.rohan.authUserId, full_name: 'Rohan Test', preferred_name: 'Rohan',
    date_of_birth: '2008-07-02', grade: 12, school_id: SEED.schoolId, curriculum: 'indian_cbse', emirate: 'Sharjah',
    nationality: 'IN', languages: ['English', 'Hindi'], interests: ['economics', 'business', 'volunteering'],
    strengths: ['writing'], created_at: created,
  });

  await repo.guardians.create({
    id: SEED.guardian.id, student_id: aisha.id, name: 'Parent of Aisha', email: SEED.guardian.email, phone: null,
    relation: 'mother', consent_status: 'granted', verified_at: created,
  });
  await repo.guardians.create({
    id: SEED.rohanGuardian.id, student_id: rohan.id, name: 'Parent of Rohan', email: SEED.rohanGuardian.email,
    phone: null, relation: 'father', consent_status: 'pending', verified_at: null,
  });

  await repo.courses.create({ id: SEED.courses.physics, student_id: aisha.id, name: 'Physics', teacher: 'Ms. Test', source: 'google_classroom', external_id: 'gc-phys-1' });
  await repo.courses.create({ id: SEED.courses.english, student_id: aisha.id, name: 'English Literature', teacher: 'Mr. Test', source: 'google_classroom', external_id: 'gc-eng-1' });
  await repo.courses.create({ id: SEED.courses.maths, student_id: aisha.id, name: 'Mathematics', teacher: 'Dr. Test', source: 'manual', external_id: null });
  const econ = await repo.courses.create({ student_id: rohan.id, name: 'Economics', teacher: 'Ms. Example', source: 'teams', external_id: null });

  const essay = await repo.materials.create({
    course_id: SEED.courses.english, title: 'Macbeth essay draft', kind: 'assignment',
    body_text: 'Write a 1200-word essay on ambition in Macbeth.', file_url: null, due_at: at(4, 23, 59),
    source: 'google_classroom', external_id: 'gc-mat-1', ingested_at: created,
  });
  await repo.materials.create({
    course_id: SEED.courses.physics, title: 'Kinematics notes', kind: 'note', body_text: 'SUVAT equations summary.',
    file_url: null, due_at: null, source: 'google_classroom', external_id: 'gc-mat-2', ingested_at: created,
  });
  await repo.materials.create({
    course_id: SEED.courses.maths, title: 'Unit test: Differentiation', kind: 'exam', body_text: null, file_url: null,
    due_at: at(6, 8, 0), source: 'manual', external_id: null, ingested_at: created,
  });
  await repo.materials.create({
    course_id: econ.id, title: 'Market structures worksheet', kind: 'assignment', body_text: null, file_url: null,
    due_at: at(3, 23, 59), source: 'teams', external_id: null, ingested_at: created,
  });

  await repo.goals.create({
    id: SEED.goalId, student_id: aisha.id, title: 'Get into an engineering programme', category: 'university',
    target_date: `${Number(today.slice(0, 4)) + 2}-01-15`, status: 'active', parent_goal_id: null, progress: 33,
  });
  await repo.milestones.create({ goal_id: SEED.goalId, title: 'Shortlist 8 universities', due_date: addDays(today, 30), done: true });
  await repo.milestones.create({ goal_id: SEED.goalId, title: 'Join a robotics competition', due_date: addDays(today, 60), done: false });
  await repo.milestones.create({ goal_id: SEED.goalId, title: 'Draft personal statement', due_date: addDays(today, 120), done: false });
  await repo.goals.create({
    student_id: aisha.id, title: 'Score A* in Physics', category: 'academic', target_date: null, status: 'active',
    parent_goal_id: SEED.goalId, progress: 0,
  });

  const t = (title: string, kind: 'study' | 'assignment' | 'application' | 'activity' | 'habit', due: string | null, est: number | null, extra: Record<string, unknown> = {}) =>
    repo.tasks.create({
      student_id: aisha.id, title, kind, due_at: due, est_minutes: est, status: 'todo', linked_goal_id: null,
      linked_material_id: null, linked_opportunity_id: null, ai_use_level: 'none', ...extra,
    });
  await t('Macbeth essay draft', 'assignment', at(4, 23, 59), 120, { linked_material_id: essay.id, ai_use_level: 'support' });
  await t('Revise differentiation', 'study', at(6, 8, 0), 90);
  await t('Physics problem set 3', 'assignment', at(2, 23, 59), 60);
  await t('Read chapter 5 (English)', 'study', null, 30);
  await t('Robotics club prep', 'activity', at(9, 16, 0), 45, { linked_goal_id: SEED.goalId });
  await repo.tasks.create({
    student_id: rohan.id, title: 'Market structures worksheet', kind: 'assignment', due_at: at(3, 23, 59),
    est_minutes: 45, status: 'todo', linked_goal_id: null, linked_material_id: null, linked_opportunity_id: null,
    ai_use_level: 'none',
  });

  // Recurring-ish calendar for the current week (Mon=0 ... Sun=6), Dubai time.
  for (const d of [0, 2]) {
    await repo.calendarEvents.create({ student_id: aisha.id, title: 'Football training', start_at: weekAt(d, 16, 0), end_at: weekAt(d, 17, 30), source: 'manual', external_id: null });
  }
  await repo.calendarEvents.create({ student_id: aisha.id, title: 'Tutoring (Maths)', start_at: weekAt(3, 18, 0), end_at: weekAt(3, 19, 0), source: 'manual', external_id: null });
  await repo.calendarEvents.create({ student_id: aisha.id, title: 'Family dinner', start_at: weekAt(5, 19, 0), end_at: weekAt(5, 21, 0), source: 'manual', external_id: null });

  const opp = (o: Partial<Parameters<Repository['opportunities']['create']>[0]> & { title: string; organizer: string; type: Parameters<Repository['opportunities']['create']>[0]['type'] }) =>
    repo.opportunities.create({
      url: null, emirate: null, country: 'AE', min_grade: null, max_grade: null, eligibility_text: null,
      nationality_restriction: null, cost_aed: 0, deadline: null, tags: [], source_id: 'seed', last_seen_at: created,
      status: 'open', ...o,
    });
  await opp({ title: 'UAE Robotics Challenge (Test)', organizer: 'Example Robotics Org', type: 'competition', emirate: 'Dubai', min_grade: 9, max_grade: 12, deadline: at(25, 23, 59), tags: ['robotics', 'engineering', 'coding', 'stem'], url: 'https://example.test/robotics' });
  await opp({ title: 'Youth Physics Olympiad (Test)', organizer: 'Example Science Society', type: 'olympiad', min_grade: 10, max_grade: 12, deadline: at(10, 23, 59), tags: ['physics', 'stem', 'maths'] });
  await opp({ title: 'Summer Engineering Programme (Test)', organizer: 'Example University', type: 'summer_program', country: 'GB', min_grade: 11, max_grade: 12, cost_aed: 9000, deadline: at(70, 23, 59), tags: ['engineering', 'university', 'stem'] });
  await opp({ title: 'Dubai MUN (Test)', organizer: 'Example MUN Society', type: 'mun', emirate: 'Dubai', min_grade: 8, max_grade: 13, cost_aed: 350, deadline: at(15, 23, 59), tags: ['debate', 'public speaking', 'international relations'] });
  await opp({ title: 'Emirati Excellence Scholarship (Test)', organizer: 'Example Foundation', type: 'scholarship', min_grade: 12, max_grade: 12, nationality_restriction: ['AE'], deadline: at(40, 23, 59), tags: ['university', 'scholarship'] });
  await opp({ title: 'Community Food Drive Volunteers (Test)', organizer: 'Example Charity', type: 'volunteering', emirate: 'Sharjah', min_grade: 7, max_grade: 13, deadline: at(5, 23, 59), tags: ['volunteering', 'community'] });
  await opp({ title: 'Fintech Internship (Test)', organizer: 'Example Bank', type: 'internship', emirate: 'Abu Dhabi', min_grade: 11, max_grade: 13, deadline: at(30, 23, 59), tags: ['economics', 'business', 'finance'] });
  await opp({ title: 'Student Hackathon (Test)', organizer: 'Example Tech Hub', type: 'hackathon', emirate: 'Dubai', min_grade: 9, max_grade: 13, deadline: at(-2, 23, 59), status: 'closed', tags: ['coding', 'ai'] });

  await repo.achievements.create({ student_id: aisha.id, title: 'School Science Fair – 1st place', category: 'award', date: addDays(today, -200), description: 'Built a solar-tracking panel prototype.', evidence_url: null });
  await repo.achievements.create({ student_id: aisha.id, title: 'Robotics club captain', category: 'leadership', date: addDays(today, -100), description: 'Lead a team of 12 students.', evidence_url: null });
  await repo.achievements.create({ student_id: aisha.id, title: 'Python for Beginners certificate', category: 'certificate', date: addDays(today, -300), description: null, evidence_url: 'https://example.test/cert' });
  await repo.achievements.create({ student_id: aisha.id, title: 'Beach clean-up volunteer', category: 'volunteering', date: addDays(today, -60), description: '20 hours across 4 events.', evidence_url: null });
}
