/**
 * The flagship "ideal student" persona (synthetic). Ahamed Mehta is a fictional Grade 11 student in the proposed Grade 11 pilot (not agreed) at
 * GEMS Our Own High School Al Warqa'a, Dubai (in the demo the school licenses Murshid for its students; the student and his data are synthetic): two serious sports (football for the school 1st XI, competitive club swimming),
 * a small online business he is growing (Tideline: custom swim caps and team kit for school clubs), strong A Level
 * grades and a university goal. Every name, number, school, club and customer here is invented.
 */
import type { MetricGen, DemoProfile, SubjectDef } from './profiles';

const m = (key: string, label: string, unit: string, better: 'higher' | 'lower', start: number, end: number, decimals = 0): MetricGen =>
  ({ key, label, unit, better, start, end, decimals });
const sub = (id: string, name: string, nameAr: string, teacher: string, base: number, slope: number, target: number, every = 2): SubjectDef =>
  ({ id, name, nameAr, teacher, base, slope, target, every });

export const IDEAL_PROFILE: DemoProfile = {
  id: 'demo-ideal', name: 'Ahamed Mehta', preferredName: 'Ahamed', nameAr: 'أحمد ميهتا', grade: 11, band: 'g11-12', age: 16,
  school: "GEMS Our Own High School Al Warqa'a", curriculum: 'indian_cbse', classLabel: 'Grade 11 (11B)', emirate: 'dubai',
  nationality: 'Indian', flagship: true,
  languages: ['English', 'Hindi', 'Arabic (basic)'],
  interests: ['football', 'swimming', 'entrepreneurship', 'economics', 'design'],
  studyStreakDays: 21,
  subjects: [
    sub('maths', 'Mathematics', 'الرياضيات', 'Mr. Vikram Desai', 84, 0.1, 93),
    sub('economics', 'Economics', 'الاقتصاد', 'Ms. Ritu Bansal', 79, 0.1, 92),
    sub('business', 'Business Studies', 'دراسات الأعمال', "Mr. Joel D'Souza", 86, 0.08, 93, 3),
    sub('physics', 'Physics', 'الفيزياء', 'Dr. Leena George', 78, 0.1, 88),
    sub('english', 'English', 'اللغة الإنجليزية', 'Ms. Sana Thomas', 80, 0.1, 90),
  ],
  activities: [
    {
      id: 'football', days: [1, 3], minutes: 90, weeklyTargetMinutes: 250, role: 'Vice-captain, U18 1st XI (central midfield)',
      detail: 'School 1st XI football (U18)', detailAr: 'الفريق الأول لكرة القدم بالمدرسة (تحت 18)',
      metrics: [
        m('sprint30m', '30m sprint', 's', 'lower', 4.46, 4.17, 2),
        m('yoyoLevel', 'Yo-Yo IR1 level', 'level', 'higher', 17.2, 19.6, 1),
        m('goals', 'Goals', 'goals', 'higher', 0, 1),
        m('assists', 'Assists', 'assists', 'higher', 0, 1),
        m('passPct', 'Pass completion', '%', 'higher', 78, 88),
      ],
      trainingMetricKeys: ['sprint30m', 'yoyoLevel'],
      fixtures: {
        kind: 'match', day: 4, everyWeeks: 1, minutes: 80, metricKeys: ['goals', 'assists', 'passPct'], offMonths: [6, 7, 8],
        names: ['Demo Hills School', 'Example International', 'Sample College Dubai', 'Test Academy', 'Demo Marina School', 'Example Grammar', 'Sample Heights School', 'Test British School'],
      },
    },
    {
      id: 'swimming', days: [0, 2, 4, 6], minutes: 75, weeklyTargetMinutes: 300, role: 'Club squad swimmer (freestyle / IM)',
      detail: 'Competitive club swimming (Demo Aquatics Club)', detailAr: 'سباحة تنافسية في النادي',
      metrics: [
        m('free100', '100m freestyle', 's', 'lower', 58.9, 55.4, 2),
        m('im200', '200m IM', 's', 'lower', 144.6, 137.9, 1),
        m('distanceKm', 'Session distance', 'km', 'higher', 3.2, 4.6, 1),
      ],
      trainingMetricKeys: ['distanceKm'],
      fixtures: {
        kind: 'race', day: 6, everyWeeks: 5, minutes: 240, metricKeys: ['free100', 'im200'], offMonths: [8],
        names: ['Dubai Schools Swim Gala', 'Demo Aquatics Open', 'Emirates Age-Group Meet (Demo)', 'Winter Long-Course Meet (Demo)', 'Sprint Invitational (Demo)', 'UAE Club Championships (Demo)'],
      },
    },
  ],
  goals: [
    { id: 'goal-free100', title: '100m freestyle under 55.0s', titleAr: '100 متر حرة في أقل من 55 ثانية', category: 'sport', unit: 's',
      start: 58.9, target: 55.0, better: 'lower', dueInDays: 150, source: { kind: 'metric', activity: 'swimming', metric: 'free100' } },
    { id: 'goal-yoyo20', title: 'Yo-Yo level 20 (U18 squad standard)', titleAr: 'المستوى 20 في اختبار يو-يو', category: 'sport', unit: 'level',
      start: 17.2, target: 20, better: 'higher', dueInDays: 120, source: { kind: 'metric', activity: 'football', metric: 'yoyoLevel' } },
    { id: 'goal-econ-astar', title: 'A* in Economics (90%+)', titleAr: 'A* في الاقتصاد (90٪ فأكثر)', category: 'academic', unit: '%',
      start: 79, target: 90, better: 'higher', dueInDays: 240, source: { kind: 'subject', subject: 'economics' } },
    { id: 'goal-tideline-25k', title: 'Tideline: AED 25,000 revenue in 12 months', titleAr: 'تايدلاين: 25 ألف درهم إيرادات خلال 12 شهرًا', category: 'career', unit: 'AED',
      start: 0, target: 25000, better: 'higher', dueInDays: 90, source: { kind: 'project', project: 'tideline', metric: 'revenue' } },
    { id: 'goal-ucas', title: 'UCAS application ready (Economics & Management)', titleAr: 'جاهزية طلب UCAS (الاقتصاد والإدارة)', category: 'university', unit: '%',
      start: 0, target: 100, better: 'higher', dueInDays: 360, source: { kind: 'manual', current: 35 } },
  ],
  links: {
    linkedin: 'https://www.linkedin.com/in/ahamed-mehta-demo',
    instagram: 'https://www.instagram.com/tideline.demo',
    website: 'https://tideline-demo.example.com',
    portfolio: 'https://ahamed-demo.example.com',
  },
  opportunities: [
    { id: 'opp-ideal-pitch', title: 'Young Founders Pitch Night (Demo)', organizer: 'Example Startup Hub', type: 'competition', emirate: 'dubai', deadlineInDays: 12, minGrade: 9, maxGrade: 12, costAed: 0, tags: ['entrepreneurship', 'business'], why: 'Tideline has real revenue and customers — exactly what judges look for.' },
    { id: 'opp-ideal-econ', title: 'Gulf Economics Essay Prize (Demo)', organizer: 'Example Economics Society', type: 'competition', emirate: null, deadlineInDays: 26, minGrade: 10, maxGrade: 12, costAed: 0, tags: ['economics', 'university'], why: 'Supports your A* Economics goal and your UCAS personal statement.' },
    { id: 'opp-ideal-summer', title: 'Business & Economics Summer School (Demo)', organizer: 'Example University London', type: 'summer_program', emirate: null, deadlineInDays: 70, minGrade: 11, maxGrade: 12, costAed: 9800, tags: ['economics', 'university', 'business'], why: 'A university-level taster for Economics & Management.' },
    { id: 'opp-ideal-coach', title: 'Junior Swim Coaching Volunteer (Demo)', organizer: 'Demo Aquatics Club', type: 'volunteering', emirate: 'dubai', deadlineInDays: 18, minGrade: 10, maxGrade: 12, costAed: 0, tags: ['swimming', 'volunteering', 'leadership'], why: 'Leadership hours using a sport you already excel at.' },
    { id: 'opp-ideal-intern', title: 'E-commerce Ops Work Shadow (Demo)', organizer: 'Example Retail Group', type: 'internship', emirate: 'dubai', deadlineInDays: 33, minGrade: 11, maxGrade: 12, costAed: 0, tags: ['business', 'entrepreneurship'], why: 'See how a large online retailer runs fulfilment — useful for Tideline.' },
    { id: 'opp-ideal-football', title: 'Elite U18 Football Showcase Camp (Demo)', organizer: 'Example Football Academy', type: 'summer_program', emirate: 'dubai', deadlineInDays: 45, minGrade: 10, maxGrade: 12, costAed: 1500, tags: ['football', 'sport'], why: 'Scouts attend; your Yo-Yo and sprint numbers are at squad level.' },
  ],
  projects: [
    {
      id: 'tideline', name: 'Tideline', tagline: 'Custom swim caps and team kit for Dubai school clubs', kind: 'business', role: 'Founder',
      startInDays: -305, url: 'https://tideline-demo.example.com',
      growth: { revenueStart: 380, revenueEnd: 4200, aov: 165, repeatRate: 0.35, followersEnd: 1850 },
      skills: ['E-commerce (Shopify)', 'Supplier negotiation', 'Instagram marketing', 'Bookkeeping', 'Canva / Figma'],
      milestones: [
        { title: 'Validated the idea with a 40-swimmer survey', inDays: -320 },
        { title: 'First sale: 12 custom caps for my own club', inDays: -298 },
        { title: 'Online store live', inDays: -284 },
        { title: 'First school-club order (AED 2,400)', inDays: -236 },
        { title: 'Parent-supervised business account and bookkeeping set up', inDays: -210 },
        { title: 'Instagram reaches 1,000 followers', inDays: -168 },
        { title: 'Switched supplier: unit cost down 22%', inDays: -121 },
        { title: 'Team-kit range added (training tops, towels)', inDays: -75 },
        { title: '10 school and club customers', inDays: -41 },
        { title: 'Kit configurator v2 on the website', inDays: 21, done: false },
        { title: 'Pitch Tideline at a founders event', inDays: 40, done: false },
      ],
    },
  ],
  cv: {
    headline: 'Grade 11 student | Founder, Tideline | Vice-captain U18 football | Competitive swimmer | Aspiring economist',
    email: 'ahamed.mehta@example.com',
    phone: null,
    location: 'Dubai, UAE',
    skills: ['Leadership', 'Entrepreneurship', 'E-commerce', 'Financial modelling (Excel)', 'Public speaking', 'Teamwork', 'Time management', 'Data analysis'],
    certifications: [
      { name: 'Pool Lifeguard Award (Demo)', issuer: 'Example Lifesaving Society', date: '2026-04' },
      { name: 'Introduction to Financial Accounting (online, Demo)', issuer: 'Example Online University', date: '2026-02' },
    ],
    featured: [
      { title: 'Tideline online store', url: 'https://tideline-demo.example.com', description: 'Custom swim caps and team kit for 10+ Dubai school clubs.' },
      { title: 'Economics project: Do school sports clubs in Dubai price kit efficiently?', url: null, description: 'Research project using Tideline order data and a 120-student survey.' },
      { title: 'Dubai Schools Swim Gala, 100m freestyle silver', url: null, description: 'Personal best and podium finish.' },
    ],
    predicted: 'Predicted 95%+ (CBSE Class XII: Mathematics, Economics, Business Studies)',
    universityGoal: 'Economics & Management (UK) or Business Economics (US)',
  },
  pastOpportunities: [
    { title: 'Dubai Schools Swimming Championships (Demo)', organizer: 'Example Schools Sports Association', type: 'competition', appliedInDays: -330, status: 'accepted', outcome: 'Selected; silver in 100m freestyle' },
    { title: 'Teen Entrepreneurs Bootcamp (Demo)', organizer: 'Example Startup Hub', type: 'course', appliedInDays: -270, status: 'accepted', outcome: 'Completed; best pitch award' },
    { title: 'Junior Economics Olympiad (Demo)', organizer: 'Example Economics Society', type: 'olympiad', appliedInDays: -200, status: 'accepted', outcome: 'Merit (top 15%)' },
    { title: 'Banking Summer Internship for Students (Demo)', organizer: 'Example Bank', type: 'internship', appliedInDays: -150, status: 'rejected', outcome: 'Not selected (Year 13 only); feedback: reapply next year' },
    { title: 'Regional U18 Football Trials (Demo)', organizer: 'Example Football Association', type: 'competition', appliedInDays: -95, status: 'accepted', outcome: 'Invited to the regional training squad' },
    { title: 'Young Leaders Volunteering Programme (Demo)', organizer: 'Example Charity', type: 'volunteering', appliedInDays: -30, status: 'submitted' },
  ],
  achievements: [
    { title: 'Silver, 100m freestyle, Dubai Schools Swim Gala (Demo)', category: 'sport', inDays: -320, description: 'Podium finish in a personal-best time.' },
    { title: 'Best Pitch, Teen Entrepreneurs Bootcamp (Demo)', category: 'award', inDays: -255, description: 'Pitched Tideline to a panel of founders.' },
    { title: 'Junior Economics Olympiad: Merit (Demo)', category: 'academic', inDays: -180, description: 'Top 15% of entrants.' },
    { title: 'Appointed vice-captain, U18 1st XI', category: 'leadership', inDays: -40, description: 'Leads warm-ups and mentors Year 9 players.' },
    { title: 'Pool Lifeguard Award (Demo)', category: 'certificate', inDays: -175, description: 'Lifesaving qualification.' },
    { title: 'Tideline passes AED 15,000 lifetime revenue', category: 'project', inDays: -20, description: 'Ten school and club customers and 70+ individual buyers.' },
  ],
};
