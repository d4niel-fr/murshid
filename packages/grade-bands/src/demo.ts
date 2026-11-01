import type { BandId, DemoSession, DemoStudent } from './types.js';

/**
 * Synthetic demo students, one per band. Names, schools and numbers are invented.
 * Term window: 2026-08-31 → 2026-10-09 (Asia/Dubai). Upcoming items fall after 2026-10-10.
 */

const DAY = 86_400_000;
function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

/**
 * Deterministic weekly sessions on given weekday offsets (0 = Monday of the week starting 2026-08-31).
 * `metric(i)` returns the metric value for session i so progress curves are believable.
 */
function weekly(
  weeks: number,
  dayOffsets: number[],
  minutes: (i: number) => number,
  metric?: { name: string; unit: string; value: (i: number) => number },
): DemoSession[] {
  const out: DemoSession[] = [];
  let i = 0;
  for (let w = 0; w < weeks; w++) {
    for (const d of dayOffsets) {
      const s: DemoSession = { date: addDays('2026-08-31', w * 7 + d), minutes: minutes(i) };
      if (metric) s.metric = { name: metric.name, unit: metric.unit, value: Math.round(metric.value(i) * 100) / 100 };
      out.push(s);
      i++;
    }
  }
  return out;
}

export const DEMO_G5: DemoStudent = {
  id: 'demo-g5',
  synthetic: true,
  firstName: 'Layla',
  lastName: 'Haddad',
  nameAr: 'ليلى حداد',
  grade: 5,
  band: 'g5-6',
  curriculum: 'british',
  classLabel: 'Year 6',
  school: 'Palm Grove British School (demo)',
  emirate: 'Dubai',
  subjects: [
    { id: 'english', name: 'English', scale: 'percent', current: 82, target: 85, trend: [74, 78, 80, 82] },
    { id: 'maths', name: 'Maths', scale: 'percent', current: 76, target: 80, trend: [70, 72, 75, 76] },
    { id: 'science', name: 'Science', scale: 'percent', current: 88, target: 85, trend: [84, 86, 85, 88] },
    { id: 'arabic', name: 'Arabic', scale: 'percent', current: 71, target: 78, trend: [66, 68, 70, 71] },
    { id: 'islamic', name: 'Islamic Studies', scale: 'percent', current: 90, target: 88, trend: [86, 88, 89, 90] },
  ],
  activities: [
    {
      id: 'piano', name: 'Piano', kind: 'music', area: 'piano', weeklyTargetMinutes: 90,
      sessions: weekly(6, [0, 2, 4], (i) => 20 + (i % 3) * 5, { name: 'pieces mastered', unit: 'pieces', value: (i) => Math.floor(i / 4) }),
    },
    {
      id: 'football', name: 'Football (school team)', kind: 'sport', area: 'football', weeklyTargetMinutes: 120,
      sessions: weekly(6, [1, 5], () => 60, { name: 'passes completed', unit: 'passes', value: (i) => 12 + i }),
    },
  ],
  goals: [
    { id: 'g5-times-tables', title: 'Know my 6–9 times tables', area: 'academics', progress: 0.6, due: '2026-11-15', milestones: ['6 times table', '7 times table', '8 times table', '9 times table', 'Mixed quiz with no mistakes'] },
    { id: 'g5-piano-grade1', title: 'Play my Grade 1 piano piece', area: 'extracurriculars', progress: 0.45, due: '2026-12-10', milestones: ['Learn the right hand', 'Learn the left hand', 'Hands together, slowly', 'Play it for my teacher'] },
    { id: 'g5-reading', title: 'Read 4 books this term', area: 'academics', progress: 0.5, due: '2026-12-11', milestones: ['Book 1', 'Book 2', 'Book 3', 'Book 4'] },
  ],
  upcoming: [
    { id: 'u5-1', title: 'Spelling test', date: '2026-10-13', type: 'test' },
    { id: 'u5-2', title: 'Science poster homework', date: '2026-10-15', type: 'homework' },
    { id: 'u5-3', title: 'Inter-house football match', date: '2026-10-18', type: 'event' },
    { id: 'u5-4', title: 'School maths challenge', date: '2026-10-22', type: 'competition' },
  ],
  streaks: { current: 9, best: 12 },
  badges: ['first-steps', 'streak-7', 'team-player'],
};

export const DEMO_G7: DemoStudent = {
  id: 'demo-g7',
  synthetic: true,
  firstName: 'Omar',
  lastName: 'Siddiqui',
  nameAr: 'عمر صدّيقي',
  grade: 7,
  band: 'g7-8',
  curriculum: 'american',
  classLabel: 'Grade 7',
  school: 'Desert Rose American Academy (demo)',
  emirate: 'Sharjah',
  subjects: [
    { id: 'ela', name: 'English Language Arts', scale: 'percent', current: 79, target: 85, trend: [75, 77, 78, 79] },
    { id: 'math', name: 'Math (Pre-Algebra)', scale: 'percent', current: 84, target: 88, trend: [80, 82, 85, 84] },
    { id: 'science', name: 'Life Science', scale: 'percent', current: 81, target: 85, trend: [77, 79, 80, 81] },
    { id: 'social', name: 'Social Studies', scale: 'percent', current: 86, target: 85, trend: [83, 85, 84, 86] },
    { id: 'arabic', name: 'Arabic B', scale: 'percent', current: 73, target: 80, trend: [70, 71, 72, 73] },
  ],
  activities: [
    {
      id: 'football', name: 'Football club', kind: 'sport', area: 'football', weeklyTargetMinutes: 150,
      sessions: weekly(6, [1, 3, 5], (i) => (i % 3 === 2 ? 90 : 60), { name: 'goals scored', unit: 'goals', value: (i) => (i % 4 === 0 ? 1 : 0) }),
    },
    {
      id: 'athletics', name: 'Athletics (800 m)', kind: 'sport', area: 'athletics', weeklyTargetMinutes: 90,
      sessions: weekly(6, [0, 4], () => 45, { name: '800 m time', unit: 's', value: (i) => 178 - i * 1.2 }),
    },
    {
      id: 'robotics', name: 'Robotics club', kind: 'club', area: 'coding', weeklyTargetMinutes: 60,
      sessions: weekly(6, [2], () => 60),
    },
  ],
  goals: [
    { id: 'g7-800m', title: 'Run 800 m under 2:50', area: 'extracurriculars', progress: 0.55, due: '2026-12-01', milestones: ['Run 800 m under 3:10', 'Run 800 m under 3:00', 'Run 800 m under 2:55', 'Run 800 m under 2:50'] },
    { id: 'g7-math', title: 'Reach 88% in Math', area: 'academics', progress: 0.7, due: '2026-12-11', milestones: ['Fix my ratio mistakes', '80% on a practice test', '85% on a practice test', '88% on the unit test'] },
    { id: 'g7-planner', title: 'Plan my week every Sunday', area: 'wellbeing', progress: 0.8, due: '2026-12-11', milestones: ['Sunday 1', 'Sunday 2', 'Sunday 3', 'Sunday 4', 'Sunday 5'] },
  ],
  upcoming: [
    { id: 'u7-1', title: 'Math unit test: ratios', date: '2026-10-14', type: 'test' },
    { id: 'u7-2', title: 'ELA book report draft', date: '2026-10-16', type: 'homework' },
    { id: 'u7-3', title: 'Inter-school athletics meet', date: '2026-10-24', type: 'competition' },
    { id: 'u7-4', title: 'Robotics club showcase', date: '2026-11-05', type: 'event' },
  ],
  streaks: { current: 15, best: 15 },
  badges: ['planner', 'club-regular', 'personal-best', 'streak-14'],
};

export const DEMO_G9: DemoStudent = {
  id: 'demo-g9',
  synthetic: true,
  firstName: 'Priya',
  lastName: 'Menon',
  nameAr: 'بريا مينون',
  grade: 9,
  band: 'g9-10',
  curriculum: 'cbse',
  classLabel: 'Class IX',
  school: 'Crescent Indian School (demo)',
  emirate: 'Dubai',
  subjects: [
    { id: 'maths', name: 'Mathematics', scale: 'percent', current: 91, target: 95, trend: [86, 88, 90, 91] },
    { id: 'science', name: 'Science', scale: 'percent', current: 87, target: 92, trend: [82, 85, 86, 87] },
    { id: 'english', name: 'English', scale: 'percent', current: 84, target: 88, trend: [80, 83, 82, 84] },
    { id: 'sst', name: 'Social Science', scale: 'percent', current: 80, target: 85, trend: [78, 79, 81, 80] },
    { id: 'hindi', name: 'Hindi', scale: 'percent', current: 78, target: 82, trend: [74, 76, 77, 78] },
    { id: 'ai', name: 'Artificial Intelligence (skill subject)', scale: 'percent', current: 93, target: 95, trend: [88, 90, 92, 93] },
  ],
  activities: [
    {
      id: 'gym', name: 'Gym (strength)', kind: 'fitness', area: 'gym', weeklyTargetMinutes: 150,
      sessions: weekly(6, [0, 2, 4], () => 50, { name: 'squat', unit: 'kg', value: (i) => 30 + i * 1.25 }),
    },
    {
      id: 'athletics', name: 'Athletics (100 m)', kind: 'sport', area: 'athletics', weeklyTargetMinutes: 60,
      sessions: weekly(6, [5], () => 60, { name: '100 m time', unit: 's', value: (i) => 14.2 - i * 0.08 }),
    },
    {
      id: 'coding', name: 'Coding club (Python)', kind: 'tech', area: 'coding', weeklyTargetMinutes: 90,
      sessions: weekly(6, [1, 3], (i) => 40 + (i % 2) * 10, { name: 'problems solved', unit: 'problems', value: (i) => 3 + i * 2 }),
    },
  ],
  goals: [
    { id: 'g9-olympiad', title: 'Qualify for the next round of a maths olympiad', area: 'academics', progress: 0.35, due: '2027-01-31', milestones: ['Pick the olympiad and register', 'Do 3 past papers', 'Review number theory and geometry', 'Sit the first round'] },
    { id: 'g9-portfolio', title: 'Add 5 projects to my portfolio', area: 'future', progress: 0.4, due: '2027-03-31', milestones: ['Project 1', 'Project 2', 'Project 3', 'Project 4', 'Project 5'] },
    { id: 'g9-squat', title: 'Squat 40 kg with good form', area: 'extracurriculars', progress: 0.75, due: '2026-12-15', milestones: ['Learn the movement with the coach', 'Squat 25 kg x 5', 'Squat 32.5 kg x 5', 'Squat 40 kg with good form'] },
    { id: 'g9-careers', title: 'Explore 5 careers in tech and medicine', area: 'future', progress: 0.2, due: '2027-02-28', milestones: ['Software engineering', 'Biomedical engineering', 'Medicine', 'Data science', 'Cybersecurity'] },
  ],
  upcoming: [
    { id: 'u9-1', title: 'Periodic Test 1: Science', date: '2026-10-12', type: 'test' },
    { id: 'u9-2', title: 'Maths olympiad registration closes (demo)', date: '2026-10-20', type: 'deadline' },
    { id: 'u9-3', title: 'Coding club mini-hackathon', date: '2026-10-31', type: 'competition' },
    { id: 'u9-4', title: 'Half-yearly exams begin', date: '2026-11-23', type: 'exam' },
  ],
  streaks: { current: 21, best: 30 },
  badges: ['olympiad-entrant', 'portfolio-start'],
  links: { github: 'https://github.com/demo-priya', portfolio: 'https://example.com/priya' },
};

export const DEMO_G11: DemoStudent = {
  id: 'demo-g11',
  synthetic: true,
  firstName: 'Zayed',
  lastName: 'Al Mansoori',
  nameAr: 'زايد المنصوري',
  grade: 11,
  band: 'g11-12',
  curriculum: 'ib',
  classLabel: 'DP1',
  school: 'Gulf Horizons International School (demo)',
  emirate: 'Abu Dhabi',
  subjects: [
    { id: 'math-aa-hl', name: 'Maths AA HL', scale: 'ib7', current: 6, target: 7, trend: [5, 5, 6, 6] },
    { id: 'physics-hl', name: 'Physics HL', scale: 'ib7', current: 6, target: 7, trend: [5, 6, 6, 6] },
    { id: 'cs-hl', name: 'Computer Science HL', scale: 'ib7', current: 7, target: 7, trend: [6, 7, 7, 7] },
    { id: 'english-sl', name: 'English A Lang & Lit SL', scale: 'ib7', current: 5, target: 6, trend: [5, 5, 5, 5] },
    { id: 'arabic-sl', name: 'Arabic A SL', scale: 'ib7', current: 6, target: 6, trend: [6, 6, 6, 6] },
    { id: 'econ-sl', name: 'Economics SL', scale: 'ib7', current: 5, target: 6, trend: [4, 5, 5, 5] },
  ],
  activities: [
    {
      id: 'hackathon', name: 'Hackathons', kind: 'tech', area: 'hackathon', weeklyTargetMinutes: 180,
      sessions: weekly(6, [5], (i) => (i === 3 ? 600 : 120), { name: 'commits', unit: 'commits', value: (i) => (i === 3 ? 64 : 10 + i * 3) }),
    },
    {
      id: 'gym', name: 'Gym', kind: 'fitness', area: 'gym', weeklyTargetMinutes: 180,
      sessions: weekly(6, [0, 2, 4], () => 60, { name: 'bench press', unit: 'kg', value: (i) => 50 + i * 1.25 }),
    },
    {
      id: 'football', name: 'Football (varsity)', kind: 'sport', area: 'football', weeklyTargetMinutes: 120,
      sessions: weekly(6, [1, 3], () => 60),
    },
  ],
  goals: [
    { id: 'g11-predicted', title: 'Predicted 40+ IB points', area: 'academics', progress: 0.6, due: '2027-06-30', milestones: ['Choose IA topics for all 6 subjects', 'Maths AA HL IA draft in', 'Physics HL IA data collected', 'Mock exams 38+', 'Predicted grades 40+'] },
    { id: 'g11-ee', title: 'Extended Essay research question approved', area: 'academics', progress: 0.3, due: '2026-12-15', milestones: ['Pick a subject and supervisor', 'Write 3 candidate questions', 'Supervisor feedback', 'Research question approved'] },
    { id: 'g11-shortlist', title: 'University shortlist of 8 (UK, US, UAE)', area: 'future', progress: 0.5, due: '2027-03-01', milestones: ['List what I want in a university', 'Long list of 15', 'Visit or attend 4 open days online', 'Shortlist of 8'] },
    { id: 'g11-hackathon', title: 'Place top 3 in a hackathon', area: 'extracurriculars', progress: 0.25, due: '2027-04-30', milestones: ['Find a team', 'Enter a hackathon', 'Ship a working demo', 'Place top 3'] },
  ],
  upcoming: [
    { id: 'u11-1', title: 'Physics HL paper 1 mock', date: '2026-10-13', type: 'test' },
    { id: 'u11-2', title: 'Weekend hackathon (demo)', date: '2026-10-17', type: 'competition' },
    { id: 'u11-3', title: 'SAT test date (demo)', date: '2026-11-07', type: 'exam' },
    { id: 'u11-4', title: 'Summer research programme application (demo)', date: '2027-01-15', type: 'deadline' },
    { id: 'u11-5', title: 'IB DP exams begin (demo, May 2028 session for DP1)', date: '2028-04-28', type: 'exam' },
  ],
  streaks: { current: 34, best: 41 },
  badges: [],
  links: { linkedin: 'https://www.linkedin.com/in/demo-zayed', github: 'https://github.com/demo-zayed', portfolio: 'https://example.com/zayed' },
};

/**
 * The flagship persona (what "Try the student app" signs in as): Ahamed Mehta, a fictional Grade 11 CBSE student
 * with football, competitive swimming and a small business. Mirrors the API's demo-ideal profile, so the app shows
 * the same student offline as it does with the API.
 */
export const DEMO_IDEAL: DemoStudent = {
  id: 'demo-ideal',
  synthetic: true,
  firstName: 'Ahamed',
  lastName: 'Mehta',
  nameAr: 'أحمد ميهتا',
  grade: 11,
  band: 'g11-12',
  curriculum: 'cbse',
  classLabel: 'Grade 11 (11B)',
  school: 'Demo Secondary School',
  emirate: 'Dubai',
  subjects: [
    { id: 'maths', name: 'Mathematics', scale: 'percent', current: 89, target: 93, trend: [84, 86, 87, 89] },
    { id: 'economics', name: 'Economics', scale: 'percent', current: 86, target: 92, trend: [79, 82, 84, 86] },
    { id: 'business', name: 'Business Studies', scale: 'percent', current: 90, target: 93, trend: [86, 87, 89, 90] },
    { id: 'physics', name: 'Physics', scale: 'percent', current: 83, target: 88, trend: [78, 80, 81, 83] },
    { id: 'english', name: 'English', scale: 'percent', current: 85, target: 90, trend: [80, 82, 83, 85] },
  ],
  activities: [
    {
      id: 'football', name: 'Football (U18 1st XI)', kind: 'sport', area: 'football', weeklyTargetMinutes: 250,
      sessions: weekly(6, [1, 3], () => 90, { name: '30m sprint', unit: 's', value: (i) => 4.46 - i * 0.025 }),
    },
    {
      id: 'swimming', name: 'Club swimming', kind: 'sport', area: 'swimming', weeklyTargetMinutes: 300,
      sessions: weekly(6, [0, 2, 4, 6], () => 75, { name: 'session distance', unit: 'km', value: (i) => 3.2 + i * 0.06 }),
    },
  ],
  goals: [
    { id: 'goal-econ-astar', title: 'A* in Economics (90%+)', area: 'academics', progress: 0.6, due: '2027-06-30', milestones: ['Finish elasticity unit notes', 'Two past papers under timed conditions', 'Case study practice with feedback', 'Mock exam 90%+'] },
    { id: 'goal-free100', title: '100m freestyle under 55.0s', area: 'extracurriculars', progress: 0.55, due: '2027-03-31', milestones: ['Under 57.5s at a club meet', 'Under 56.5s', 'Under 55.5s', 'Under 55.0s at a gala'] },
    { id: 'goal-yoyo20', title: 'Yo-Yo level 20 (U18 squad standard)', area: 'extracurriculars', progress: 0.5, due: '2027-02-28', milestones: ['Level 18', 'Level 19', 'Level 19.5', 'Level 20'] },
    { id: 'goal-tideline', title: 'Tideline: AED 25,000 revenue in 12 months', area: 'future', progress: 0.4, due: '2027-01-31', milestones: ['First 5 school clubs as customers', 'AED 10,000', 'AED 18,000', 'AED 25,000'] },
    { id: 'goal-ucas', title: 'UCAS application ready (Economics & Management)', area: 'future', progress: 0.35, due: '2027-10-15', milestones: ['Shortlist 5 universities', 'Personal statement draft', 'Teacher reference requested', 'Application sent'] },
  ],
  upcoming: [
    { id: 'ui-1', title: 'Economics unit test: demand and elasticity', date: '2026-10-21', type: 'test' },
    { id: 'ui-2', title: 'Match vs Test British School (1st XI)', date: '2026-10-22', type: 'competition' },
    { id: 'ui-3', title: 'Physics practical: simple pendulum write-up', date: '2026-10-26', type: 'homework' },
    { id: 'ui-4', title: 'Dubai Schools Swim Gala', date: '2026-11-07', type: 'competition' },
    { id: 'ui-5', title: 'Half-yearly exams begin', date: '2026-11-23', type: 'exam' },
  ],
  streaks: { current: 21, best: 30 },
  badges: [],
  links: { linkedin: 'https://www.linkedin.com/in/ahamed-mehta-demo', portfolio: 'https://ahamed-demo.example.com' },
};

/** Named personas a demo can sign in as (in place of the band's default student). */
export const demoPersonas: Record<string, DemoStudent> = { 'demo-ideal': DEMO_IDEAL };

export const demoStudents: Record<BandId, DemoStudent> = {
  'g5-6': DEMO_G5,
  'g7-8': DEMO_G7,
  'g9-10': DEMO_G9,
  'g11-12': DEMO_G11,
};

export function demoStudentById(id: string): DemoStudent | undefined {
  return Object.values(demoStudents).find((s) => s.id === id);
}
