import type { FeatureId, WidgetId } from './types.js';

/** Chart colour tokens from packages/design/tokens.css. */
export const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)'];

/**
 * A widget may appear on a band's dashboard only if at least one of these features is on.
 * Widgets not listed have no gate.
 */
export const WIDGET_REQUIRES: Partial<Record<WidgetId, FeatureId[]>> = {
  streaks: ['streaks'],
  badges: ['badges'],
  opportunities: ['schoolCompetitions', 'externalOpportunities'],
  applications: ['applications'],
  cv: ['cv'],
  'social-links': ['socialLinks'],
  'ai-chat-entry': ['aiChat'],
  'weekly-briefing': ['weeklyBriefing'],
};

/** Refusals shared by every band. The assistant declines, explains briefly, and redirects. */
export const BASE_REFUSALS: string[] = [
  'self-harm or suicide methods (always escalate with help lines + trusted adult)',
  'sexual content',
  'graphic violence, weapons, or making dangerous items',
  'drugs, alcohol, vaping, smoking',
  'gambling and betting',
  'hate speech, bullying or insulting others',
  'political commentary and religious rulings (refer to a teacher or family)',
  'medical, psychological or legal diagnosis (refer to school nurse/counsellor/parent)',
  'completing tests, quizzes or exams in progress',
  'writing graded work for submission (homework answers, essays, coursework)',
  "other people's personal data, tracking or doxxing",
  'bypassing school device management, filters, VPNs or parental controls',
  'contacting strangers or sharing contact details or location',
];

export const ALL_OFF: Record<FeatureId, boolean> = {
  aiChat: false, aiCharts: false, badges: false, streaks: false, leaderboards: false, clubs: false,
  schoolCompetitions: false, externalCompetitions: false, olympiads: false, summerPrograms: false,
  externalOpportunities: false, studyPlanner: false, subjectChoices: false, careerExplorer: false,
  portfolio: false, cv: false, applications: false, universityPlanner: false, examCountdowns: false,
  socialLinks: false, linkedin: false, publicProfile: false, directMessaging: false, weeklyBriefing: false,
  guardianView: false, pushNotifications: false, darkMode: false,
};
