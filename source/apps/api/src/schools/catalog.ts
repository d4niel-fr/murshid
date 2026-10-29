/**
 * Licensing, tenants and the synthetic school roster behind "Murshid for Schools".
 *
 * Two ways to get Murshid, kept apart in the data:
 *   - family:      a parent buys a plan for their child, or a student buys one for themselves. The tenant is a
 *                  family account (org kind 'family'); the student's licence says who paid.
 *   - institution: a school (or school group) licenses Murshid per student per year. The tenant is the school
 *                  org; teachers and school admins belong to it and only ever see its students.
 *
 * The example institution is the fictional Demo Secondary School (Demo Schools Group), modelled as a proposed Grade 11 pilot.
 * Every student and teacher here is fictional (synthetic demo data); the school tenant models a proposed pilot (not a confirmed partnership).
 */

export type LicenceType = 'family' | 'institution';
export type PlanId = 'family-plus' | 'family-pro' | 'school' | 'school-pilot';
export type BoughtBy = 'parent' | 'student' | 'school';

export interface Plan {
  id: PlanId;
  audience: 'families' | 'schools';
  name: string;
  priceAed: number;
  per: 'month' | 'student-year';
  yearlyAed?: number;
  /** list price range for schools */
  rangeAed?: [number, number];
  featured: boolean;
  blurb: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: 'family-plus', audience: 'families', name: 'Plus', priceAed: 29, per: 'month', yearlyAed: 249, featured: false,
    blurb: 'For a parent buying for their child, or a student buying for themselves.',
    features: ['Weekly plan around classes, sport and exams', 'All homework and tests in one list', 'Progress charts for every subject', 'Opportunities matched to the student', 'Parent summary every week'],
  },
  {
    id: 'family-pro', audience: 'families', name: 'Pro', priceAed: 79, per: 'month', yearlyAed: 699, featured: false,
    blurb: 'Application season: CV, portfolio and university applications.',
    features: ['Everything in Plus', 'LinkedIn-ready CV and portfolio (PDF)', 'Application tracker with deadlines', 'One human review per term'],
  },
  {
    id: 'school', audience: 'schools', name: 'Murshid for Schools', priceAed: 150, per: 'student-year', rangeAed: [120, 180], featured: true,
    blurb: 'Your school licenses Murshid for its students. Teachers post work directly or connect Microsoft 365.',
    features: [
      'Every student gets Murshid, linked to their school',
      'Sign in with Microsoft (Entra ID); Teams classes and assignments sync',
      'Teachers post assignments that land in every student\u2019s plan',
      'Class progress report with at-risk flags',
      'Best day to set homework, with on-time likelihood',
      'Automatic weekly report from every student',
      'Separate school tenant: school data never mixes with family accounts',
    ],
  },
];

export interface MicrosoftLink {
  connected: boolean;
  /** Entra tenant (simulated in the demo) */
  tenantId: string;
  domain: string;
  connectedAt: string | null;
  connectedBy: string | null;
  lastSyncAt: string | null;
  synced: { classes: number; teachers: number; students: number; assignments: number } | null;
}

export interface Org {
  id: string;
  name: string;
  shortName: string;
  kind: 'school_group' | 'school' | 'family';
  parentOrgId: string | null;
  emirate: 'dubai' | 'abu_dhabi' | 'sharjah';
  licence: {
    type: LicenceType;
    plan: PlanId;
    status: 'pilot' | 'active' | 'trial';
    boughtBy: BoughtBy;
    seats: number | null;
    priceAed: number;
    per: Plan['per'];
    startDate: string;
    endDate: string;
    /** short human note, e.g. "Grade 11 pilot" */
    note: string;
  } | null;
  /** school join code students can type instead of signing in with Microsoft */
  joinCode: string | null;
  microsoft: MicrosoftLink | null;
}

export const SCHOOL_GROUP = 'demo-group';
export const DEMO_SCHOOL = 'demo-school';
export const OTHER_SCHOOL = 'demo-british';

export function seedOrgs(): Org[] {
  return [
    { id: SCHOOL_GROUP, name: 'Demo Schools Group', shortName: 'Demo group', kind: 'school_group', parentOrgId: null, emirate: 'dubai', licence: null, joinCode: null, microsoft: null },
    {
      id: DEMO_SCHOOL, name: 'Demo Secondary School', shortName: 'DSS', kind: 'school', parentOrgId: SCHOOL_GROUP, emirate: 'dubai',
      licence: { type: 'institution', plan: 'school-pilot', status: 'pilot', boughtBy: 'school', seats: 120, priceAed: 150, per: 'student-year', startDate: '2026-09-01', endDate: '2027-06-30', note: 'Proposed Grade 11 pilot (demo tenant; not a confirmed partnership)' },
      joinCode: 'DSS-G11',
      microsoft: { connected: false, tenantId: 'sim-tenant-demo-school', domain: 'dss-demo.example', connectedAt: null, connectedBy: null, lastSyncAt: null, synced: null },
    },
    {
      id: OTHER_SCHOOL, name: 'Demo British School', shortName: 'DBS', kind: 'school', parentOrgId: null, emirate: 'dubai',
      licence: { type: 'institution', plan: 'school', status: 'trial', boughtBy: 'school', seats: 40, priceAed: 150, per: 'student-year', startDate: '2026-10-01', endDate: '2026-12-31', note: 'Term trial' },
      joinCode: 'DBS-TRIAL',
      microsoft: { connected: false, tenantId: 'sim-tenant-dbs', domain: 'dbs-demo.example', connectedAt: null, connectedBy: null, lastSyncAt: null, synced: null },
    },
    familyOrg('fam-haddad', 'Haddad family', 'parent', 'family-plus'),
    familyOrg('fam-siddiqui', 'Siddiqui family', 'parent', 'family-plus'),
    familyOrg('fam-menon', 'Priya Menon (self)', 'student', 'family-plus'),
  ];
}

export function familyOrg(id: string, name: string, boughtBy: 'parent' | 'student', plan: 'family-plus' | 'family-pro', startDate = '2026-09-01'): Org {
  const p = PLANS.find((x) => x.id === plan)!;
  return {
    id, name, shortName: name, kind: 'family', parentOrgId: null, emirate: 'dubai',
    licence: { type: 'family', plan, status: 'active', boughtBy, seats: 1, priceAed: p.priceAed, per: 'month', startDate, endDate: '2027-08-31', note: boughtBy === 'parent' ? 'Bought by a parent for their child' : 'Bought by the student' },
    joinCode: null, microsoft: null,
  };
}

/** Which tenant each app student (DemoStore id) belongs to. */
export const STUDENT_TENANT: Record<string, string> = {
  'demo-ideal': DEMO_SCHOOL,
  'demo-g11': OTHER_SCHOOL,
  'demo-g9': 'fam-menon',
  'demo-g7': 'fam-siddiqui',
  'demo-g5': 'fam-haddad',
};

export interface Account {
  id: string;
  orgId: string;
  role: 'parent' | 'student' | 'teacher' | 'school_admin';
  name: string;
  email: string;
  /** parent: linked children; student: themselves */
  studentIds: string[];
  via: 'email' | 'microsoft' | 'join_code';
  createdAt: string;
}

export function seedAccounts(): Account[] {
  return [
    { id: 'acc-parent-haddad', orgId: 'fam-haddad', role: 'parent', name: 'Rana Haddad', email: 'rana.haddad@example.com', studentIds: ['demo-g5'], via: 'email', createdAt: '2026-09-01' },
    { id: 'acc-parent-siddiqui', orgId: 'fam-siddiqui', role: 'parent', name: 'Imran Siddiqui', email: 'imran.siddiqui@example.com', studentIds: ['demo-g7'], via: 'email', createdAt: '2026-09-03' },
    { id: 'acc-student-menon', orgId: 'fam-menon', role: 'student', name: 'Priya Menon', email: 'priya.menon@example.com', studentIds: ['demo-g9'], via: 'email', createdAt: '2026-09-05' },
    { id: 'acc-dss-admin', orgId: DEMO_SCHOOL, role: 'school_admin', name: 'Murshid pilot lead (DSS)', email: 'pilot.lead@dss-demo.example', studentIds: [], via: 'microsoft', createdAt: '2026-09-01' },
  ];
}

// ---------------- school roster (synthetic) ----------------

export type SubjectId = 'english' | 'maths' | 'physics' | 'chemistry' | 'biology' | 'economics' | 'business' | 'cs';
export const SUBJECT_NAMES: Record<SubjectId, string> = {
  english: 'English', maths: 'Mathematics', physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology',
  economics: 'Economics', business: 'Business Studies', cs: 'Computer Science',
};

export interface Teacher {
  id: string;
  orgId: string;
  name: string;
  email: string;
  subject: SubjectId;
  /** can sign in to the teacher portal in the demo */
  portal: boolean;
}

/** A teaching group: one teacher, one subject, a list of roster students. */
export interface Stream {
  id: string;
  orgId: string;
  subject: SubjectId;
  teacherId: string;
  name: string;
  /** weekdays (1=Mon..5=Fri) this stream usually sets homework */
  setDays: number[];
  /** typical homework length (minutes) */
  minutes: number;
  /** Teams class id once Microsoft 365 is connected (simulated) */
  teamsClassId: string;
}

export interface RosterActivity { name: string; days: number[]; minutes: number }
export interface RosterStudent {
  id: string;
  orgId: string;
  name: string;
  section: '11A' | '11B' | '11C';
  /** fixed key the synthetic numbers are generated from (kept stable so ids can change) */
  seed?: string;
  /** the student's id in the Murshid app (DemoStore), when they use it in this demo */
  appId: string | null;
  electives: SubjectId[];
  activities: RosterActivity[];
  /** event tags, e.g. 'football' (Thu fixtures), 'swim-gala', 'mun' */
  events: string[];
  /** 0..1 habits: how reliably they hand work in */
  diligence: number;
  /** 0..1 typical attainment */
  ability: number;
}

const T = (id: string, name: string, subject: SubjectId, portal = false): Teacher =>
  ({ id, orgId: DEMO_SCHOOL, name, email: `${name.replace(/^(Ms|Mr|Dr)\.\s*/, '').toLowerCase().replace(/[^a-z]+/g, '.')}@dss-demo.example`, subject, portal });

export const TEACHERS: Teacher[] = [
  T('t-thomas', 'Ms. Sana Thomas', 'english', true),
  T('t-desai', 'Mr. Vikram Desai', 'maths', true),
  T('t-pereira', 'Mr. Alan Pereira', 'english'),
  T('t-shetty', 'Ms. Kavya Shetty', 'maths'),
  T('t-george', 'Dr. Leena George', 'physics'),
  T('t-karim', 'Mr. Faisal Karim', 'chemistry'),
  T('t-saleh', 'Ms. Hiba Saleh', 'biology'),
  T('t-bansal', 'Ms. Ritu Bansal', 'economics'),
  T('t-dsouza', "Mr. Joel D'Souza", 'business'),
  T('t-bhat', 'Mr. Nikhil Bhat', 'cs'),
  // another tenant: proves teachers never see students from a school they don't belong to
  { id: 't-dbs-clarke', orgId: OTHER_SCHOOL, name: 'Mr. Tom Clarke', email: 'tom.clarke@dbs-demo.example', subject: 'english', portal: true },
];

/** 38 synthetic Grade 11 students. English (Ms. Thomas) = first 30; Maths (Mr. Desai) = last 30; 22 take both. */
const NAMES: [string, RosterStudent['section']][] = [
  ['Zara Sheikh', '11A'], ['Arjun Nair', '11A'], ['Mariam Al Hashimi', '11A'], ['Kabir Malhotra', '11A'], ['Diya Patel', '11A'],
  ['Yusuf Rahman', '11A'], ['Ananya Iyer', '11A'], ['Omar Farooq', '11A'], ['Saanvi Reddy', '11B'], ['Rayan Chaudhry', '11B'],
  ['Ahamed Mehta', '11B'], ['Meera Joshi', '11B'], ['Hamdan Al Falasi', '11B'], ['Ishaan Gupta', '11B'], ['Fatima Ali', '11B'],
  ['Dev Kulkarni', '11B'], ['Noor Hassan', '11B'], ['Aditya Verma', '11B'], ['Layan Haddad', '11B'], ['Vihaan Sinha', '11B'],
  ['Sara Abdullah', '11B'], ['Aryan Kapoor', '11B'], ['Hessa Al Nuaimi', '11C'], ['Krish Agarwal', '11C'], ['Aisha Siddiqui', '11C'],
  ['Neel Banerjee', '11C'], ['Riya Fernandes', '11C'], ['Khalid Mansour', '11C'], ['Tara Pillai', '11C'], ['Samir Qadri', '11C'],
  ['Ira Chatterjee', '11C'], ['Faris Al Zarooni', '11C'], ['Anika Bose', '11C'], ['Zayan Mirza', '11C'], ['Lina Odeh', '11C'],
  ['Rehan Shah', '11C'], ['Maya Krishnan', '11C'], ['Eshan Thakur', '11C'],
];

const ELECTIVE_SETS: SubjectId[][] = [
  ['physics', 'chemistry', 'biology'], ['physics', 'chemistry', 'cs'], ['economics', 'business', 'cs'], ['physics', 'economics', 'business'],
  ['economics', 'business', 'biology'], ['physics', 'chemistry', 'economics'],
];
const ACTIVITY_SETS: { acts: RosterActivity[]; events: string[] }[] = [
  { acts: [{ name: 'Football (school team)', days: [1, 3], minutes: 90 }], events: ['football'] },
  { acts: [{ name: 'Swimming squad', days: [0, 2, 4], minutes: 75 }], events: ['swim-gala'] },
  { acts: [{ name: 'MUN club', days: [2], minutes: 60 }], events: ['mun'] },
  { acts: [{ name: 'Robotics club', days: [3], minutes: 90 }], events: [] },
  { acts: [{ name: 'Basketball', days: [2, 4], minutes: 75 }], events: [] },
  { acts: [{ name: 'Music (piano)', days: [1], minutes: 45 }], events: [] },
  { acts: [], events: [] },
  { acts: [{ name: 'Debate society', days: [3], minutes: 60 }], events: ['mun'] },
];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

export function seedRoster(): RosterStudent[] {
  return NAMES.map(([name, section], i) => {
    const slug = name.toLowerCase().replace(/[^a-z]+/g, '-');
    const id = `dss-${slug}`;
    // the synthetic numbers are seeded from this fixed key, so renaming ids never reshuffles the class
    const key = `oow-${slug}`;
    const seed = key;
    if (name === 'Ahamed Mehta') {
      return {
        id, seed, orgId: DEMO_SCHOOL, name, section, appId: 'demo-ideal', electives: ['physics', 'economics', 'business'],
        activities: [
          { name: 'Football, 1st XI (vice-captain)', days: [1, 3], minutes: 90 },
          { name: 'Club swimming', days: [0, 2, 4, 6], minutes: 75 },
          { name: 'Tideline (his business)', days: [5], minutes: 120 },
        ],
        events: ['football', 'swim-gala'], diligence: 0.93, ability: 0.86,
      };
    }
    const h = hash(key);
    const h2 = hash(`${key}:b`);
    const h3 = hash(`${key}:c`);
    const set = ACTIVITY_SETS[Math.floor(h2 * ACTIVITY_SETS.length)]!;
    // a few students carry real risk; most are steady
    const diligence = i % 9 === 4 ? 0.48 + h * 0.12 : i % 11 === 7 ? 0.6 + h * 0.1 : 0.74 + h * 0.24;
    return {
      id, seed, orgId: DEMO_SCHOOL, name, section, appId: null,
      electives: ELECTIVE_SETS[Math.floor(h3 * ELECTIVE_SETS.length)]!,
      activities: set.acts, events: set.events,
      diligence: Math.round(diligence * 100) / 100,
      ability: Math.round((0.45 + h2 * 0.5 + (diligence - 0.75) * 0.3) * 100) / 100,
    };
  });
}

export function seedStreams(roster: RosterStudent[]): { streams: Stream[]; members: Record<string, string[]> } {
  const ids = roster.map((s) => s.id);
  const streams: Stream[] = [
    { id: 'cls-eng-11ab', orgId: DEMO_SCHOOL, subject: 'english', teacherId: 't-thomas', name: 'Grade 11 English (11A/11B)', setDays: [1, 3], minutes: 45, teamsClassId: 'teams-eng-11ab' },
    { id: 'cls-eng-11c', orgId: DEMO_SCHOOL, subject: 'english', teacherId: 't-pereira', name: 'Grade 11 English (11C)', setDays: [2, 4], minutes: 40, teamsClassId: 'teams-eng-11c' },
    { id: 'cls-math-11bc', orgId: DEMO_SCHOOL, subject: 'maths', teacherId: 't-desai', name: 'Grade 11 Mathematics (11B/11C)', setDays: [2, 4], minutes: 40, teamsClassId: 'teams-math-11bc' },
    { id: 'cls-math-11a', orgId: DEMO_SCHOOL, subject: 'maths', teacherId: 't-shetty', name: 'Grade 11 Mathematics (11A)', setDays: [1, 3], minutes: 40, teamsClassId: 'teams-math-11a' },
    { id: 'cls-phy-11', orgId: DEMO_SCHOOL, subject: 'physics', teacherId: 't-george', name: 'Grade 11 Physics', setDays: [1], minutes: 50, teamsClassId: 'teams-phy-11' },
    { id: 'cls-chem-11', orgId: DEMO_SCHOOL, subject: 'chemistry', teacherId: 't-karim', name: 'Grade 11 Chemistry', setDays: [2], minutes: 45, teamsClassId: 'teams-chem-11' },
    { id: 'cls-bio-11', orgId: DEMO_SCHOOL, subject: 'biology', teacherId: 't-saleh', name: 'Grade 11 Biology', setDays: [3], minutes: 40, teamsClassId: 'teams-bio-11' },
    { id: 'cls-eco-11', orgId: DEMO_SCHOOL, subject: 'economics', teacherId: 't-bansal', name: 'Grade 11 Economics', setDays: [1, 4], minutes: 45, teamsClassId: 'teams-eco-11' },
    { id: 'cls-bus-11', orgId: DEMO_SCHOOL, subject: 'business', teacherId: 't-dsouza', name: 'Grade 11 Business Studies', setDays: [3], minutes: 40, teamsClassId: 'teams-bus-11' },
    { id: 'cls-cs-11', orgId: DEMO_SCHOOL, subject: 'cs', teacherId: 't-bhat', name: 'Grade 11 Computer Science', setDays: [2], minutes: 60, teamsClassId: 'teams-cs-11' },
  ];
  const members: Record<string, string[]> = {
    'cls-eng-11ab': ids.slice(0, 30),
    'cls-eng-11c': ids.slice(30),
    'cls-math-11bc': ids.slice(8),
    'cls-math-11a': ids.slice(0, 8),
  };
  for (const st of streams) {
    if (members[st.id]) continue;
    members[st.id] = roster.filter((s) => s.electives.includes(st.subject)).map((s) => s.id);
  }
  return { streams, members };
}

/**
 * Tests and events relative to the Monday of the current school week (weekOffset, weekday 1..6).
 * Deterministic so the class picture is stable for a given week, and varied enough that the best homework
 * day is a real decision.
 */
export interface CalendarItem { kind: 'test' | 'event'; title: string; weekOffset: number; weekday: number; subject?: SubjectId; eventTag?: string; minutes: number; allStudents?: boolean }
export const CALENDAR: CalendarItem[] = [
  { kind: 'test', title: 'Chemistry unit test', subject: 'chemistry', weekOffset: 0, weekday: 4, minutes: 90 },
  { kind: 'test', title: 'Biology practical assessment', subject: 'biology', weekOffset: 0, weekday: 5, minutes: 60 },
  { kind: 'event', title: 'Inter-house athletics heats (after school)', weekOffset: 0, weekday: 5, minutes: 150, allStudents: true },
  { kind: 'event', title: 'Inter-school football fixture', eventTag: 'football', weekOffset: 0, weekday: 4, minutes: 180 },
  { kind: 'event', title: 'Dubai Schools Swim Gala', eventTag: 'swim-gala', weekOffset: 0, weekday: 6, minutes: 300 },
  { kind: 'test', title: 'Economics mid-term', subject: 'economics', weekOffset: 1, weekday: 1, minutes: 120 },
  { kind: 'test', title: 'Business Studies case quiz', subject: 'business', weekOffset: 1, weekday: 2, minutes: 60 },
  { kind: 'test', title: 'Physics unit test', subject: 'physics', weekOffset: 1, weekday: 3, minutes: 120 },
  { kind: 'event', title: 'Inter-school football fixture', eventTag: 'football', weekOffset: 1, weekday: 4, minutes: 180 },
  { kind: 'test', title: 'Mathematics class test', subject: 'maths', weekOffset: 1, weekday: 5, minutes: 90 },
  { kind: 'event', title: 'MUN conference (Day 1)', eventTag: 'mun', weekOffset: 1, weekday: 5, minutes: 360 },
  { kind: 'test', title: 'Computer Science practical', subject: 'cs', weekOffset: 2, weekday: 2, minutes: 90 },
  { kind: 'event', title: 'Inter-school football fixture', eventTag: 'football', weekOffset: 2, weekday: 4, minutes: 180 },
];
