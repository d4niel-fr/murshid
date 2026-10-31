/**
 * Extra synthetic history for the original four demo students: a side project with milestones, past
 * applications with outcomes, achievements and CV fields. Fictional throughout.
 */
import type { DemoProfile } from './profiles';

type Extras = Pick<DemoProfile, 'projects' | 'pastOpportunities' | 'achievements' | 'cv'>;

export const DEMO_EXTRAS: Record<'demo-g5' | 'demo-g7' | 'demo-g9' | 'demo-g11', Extras> = {
  'demo-g5': {
    projects: [{
      id: 'class-newsletter', name: 'Class Animal Newsletter', tagline: 'A monthly one-page newsletter about animals for Year 6', kind: 'creative', role: 'Editor',
      startInDays: -220, skills: ['Writing', 'Drawing'],
      milestones: [
        { title: 'First issue printed', inDays: -210 }, { title: 'Interviewed the school vet visitor', inDays: -120 },
        { title: '6th issue', inDays: -30 }, { title: 'Add a puzzle page', inDays: 14, done: false },
      ],
    }],
    pastOpportunities: [
      { title: 'School Reading Challenge (Demo)', organizer: 'Demo Primary School', type: 'competition', appliedInDays: -200, status: 'accepted', outcome: 'Read 14 books; gold certificate' },
      { title: 'Junior Art Contest (Demo)', organizer: 'Example Arts Council', type: 'competition', appliedInDays: -90, status: 'rejected', outcome: 'Not shortlisted' },
    ],
    achievements: [
      { title: 'Reading Challenge gold certificate', category: 'award', inDays: -170, description: 'Read 14 books in one term.' },
      { title: 'Running club: 50m personal best', category: 'sport', inDays: -25, description: 'New personal best at running club.' },
    ],
    cv: { headline: 'Year 6 reader, runner and piano learner', email: null, skills: ['Reading', 'Piano', 'Teamwork'] },
  },
  'demo-g7': {
    projects: [{
      id: 'robot-arm', name: 'Cardboard Robot Arm', tagline: 'A servo-driven robot arm built from recycled cardboard', kind: 'creative', role: 'Builder',
      startInDays: -150, skills: ['Arduino basics', 'Design'],
      milestones: [
        { title: 'First servo moving', inDays: -140 }, { title: 'Gripper picks up a cup', inDays: -60 },
        { title: 'Shown at school science fair', inDays: -20 }, { title: 'Add a joystick', inDays: 30, done: false },
      ],
    }],
    pastOpportunities: [
      { title: 'Junior Robotics Open (Demo)', organizer: 'Example Robotics Org', type: 'competition', appliedInDays: -240, status: 'accepted', outcome: 'Reached quarter-finals' },
      { title: 'Space Camp Scholarship (Demo)', organizer: 'Example Space Academy', type: 'scholarship', appliedInDays: -130, status: 'rejected', outcome: 'Waitlisted, not offered' },
      { title: 'Emirates Maths Challenge 2026 (Demo)', organizer: 'Example Maths Society', type: 'olympiad', appliedInDays: -45, status: 'submitted' },
    ],
    achievements: [
      { title: 'Science fair: best engineering project', category: 'award', inDays: -20, description: 'Cardboard robot arm.' },
      { title: 'Track: 100m personal best', category: 'sport', inDays: -60, description: 'Season best at the track squad.' },
    ],
    cv: { headline: 'Grade 7 robotics builder and sprinter', email: null, skills: ['Robotics', 'Teamwork', 'Arabic & English'] },
  },
  'demo-g9': {
    projects: [{
      id: 'study-bot', name: 'StudyBuddy Bot', tagline: 'A Discord bot that quizzes classmates on Science vocabulary', kind: 'app', role: 'Developer',
      startInDays: -260, skills: ['Python', 'APIs', 'Product thinking'],
      milestones: [
        { title: 'Bot answers first quiz', inDays: -250 }, { title: '50 classmates using it', inDays: -160 },
        { title: 'Added spaced repetition', inDays: -70 }, { title: 'Open-source on GitHub', inDays: -15 },
        { title: 'Arabic vocabulary pack', inDays: 25, done: false },
      ],
    }],
    pastOpportunities: [
      { title: 'Girls Who Build Hackathon (Demo)', organizer: 'Example Tech Hub', type: 'hackathon', appliedInDays: -280, status: 'accepted', outcome: '5th of 22 teams' },
      { title: 'National Science Olympiad 2026 (Demo)', organizer: 'Example Science Society', type: 'olympiad', appliedInDays: -180, status: 'accepted', outcome: 'Bronze' },
      { title: 'Summer AI Camp (Demo)', organizer: 'Example University', type: 'summer_program', appliedInDays: -120, status: 'rejected', outcome: 'Grade 10+ only' },
      { title: 'Sharjah Junior MUN 2026 (Demo)', organizer: 'Example MUN Society', type: 'mun', appliedInDays: -20, status: 'preparing' },
    ],
    achievements: [
      { title: 'Science Olympiad bronze (Demo)', category: 'academic', inDays: -150, description: 'National round.' },
      { title: 'StudyBuddy Bot open-sourced', category: 'project', inDays: -15, description: '50+ classmates used it.' },
    ],
    cv: { headline: 'Class 9 coder building study tools with AI', email: null, skills: ['Python', 'Discord bots', 'Debate'] },
  },
  'demo-g11': {
    projects: [{
      id: 'energy-dash', name: 'Campus Energy Dashboard', tagline: 'Live dashboard of school building energy use from smart meters', kind: 'research', role: 'Lead developer',
      startInDays: -210, skills: ['TypeScript', 'Data visualisation', 'IoT'],
      milestones: [
        { title: 'Facilities team approved access to meter data', inDays: -200 }, { title: 'First live chart', inDays: -150 },
        { title: 'Found 9% overnight waste in Block C', inDays: -80 }, { title: 'Presented to the eco-committee', inDays: -35 },
        { title: 'Add solar forecast', inDays: 30, done: false },
      ],
    }],
    pastOpportunities: [
      { title: 'Gulf Student Hackathon 2025 (Demo)', organizer: 'Example Tech Hub', type: 'hackathon', appliedInDays: -330, status: 'accepted', outcome: '3rd place' },
      { title: 'Engineering Taster Week (Demo)', organizer: 'Example University', type: 'summer_program', appliedInDays: -210, status: 'accepted', outcome: 'Completed' },
      { title: 'Energy Co. Summer Internship (Demo)', organizer: 'Example Energy Co.', type: 'internship', appliedInDays: -160, status: 'rejected', outcome: 'Not selected' },
      { title: 'Youth Physics Olympiad 2026 (Demo)', organizer: 'Example Science Society', type: 'olympiad', appliedInDays: -60, status: 'accepted', outcome: 'Honourable mention' },
    ],
    achievements: [
      { title: '3rd place, Gulf Student Hackathon (Demo)', category: 'award', inDays: -320, description: 'Team of four; built a water-use tracker.' },
      { title: 'FTC regional: inspire nomination (Demo)', category: 'award', inDays: -190, description: 'Robotics team.' },
      { title: 'Campus Energy Dashboard presented', category: 'project', inDays: -35, description: 'Adopted by the eco-committee.' },
    ],
    cv: { headline: 'Year 12 engineer: sprinter, hackathon builder, robotics', email: 'zayed.demo@example.com', skills: ['TypeScript', 'Python', 'CAD', 'Teamwork'] },
  },
};
