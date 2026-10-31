import { describe, expect, it } from 'vitest';
import {
  BAND_IDS,
  BANDS,
  FEATURE_IDS,
  NAV_CATALOG,
  REQUIRED_COPY_KEYS,
  WIDGET_IDS,
  WIDGET_REQUIRES,
  bandForGrade,
  type BandId,
} from '../src/index.js';

const arabic = /[\u0600-\u06FF]/;

describe('BANDS structure', () => {
  it('has exactly the four contract bands, keyed by their own id', () => {
    expect(Object.keys(BANDS).sort()).toEqual([...BAND_IDS].sort());
    for (const id of BAND_IDS) {
      expect(BANDS[id].id).toBe(id);
      expect(BANDS[id].dataBand).toBe(id);
    }
  });

  it('grade ranges are contiguous 5..12 and agree with bandForGrade', () => {
    const ordered = BAND_IDS.map((id) => BANDS[id].grades);
    expect(ordered).toEqual([[5, 6], [7, 8], [9, 10], [11, 12]]);
    for (const id of BAND_IDS) {
      const [min, max] = BANDS[id].grades;
      for (let g = min; g <= max; g++) expect(bandForGrade(g)).toBe(id);
    }
  });

  it.each(BAND_IDS)('%s defines every feature flag as a boolean', (id) => {
    const f = BANDS[id].features;
    expect(Object.keys(f).sort()).toEqual([...FEATURE_IDS].sort());
    for (const v of Object.values(f)) expect(typeof v).toBe('boolean');
  });

  it.each(BAND_IDS)('%s dashboard widgets are valid, unique, start with greeting, and pass feature gates', (id) => {
    const b = BANDS[id];
    expect(b.dashboardWidgets[0]).toBe('greeting');
    expect(new Set(b.dashboardWidgets).size).toBe(b.dashboardWidgets.length);
    for (const w of b.dashboardWidgets) {
      expect(WIDGET_IDS).toContain(w);
      const req = WIDGET_REQUIRES[w];
      if (req) expect(req.some((f) => b.features[f])).toBe(true);
    }
  });

  it.each(BAND_IDS)('%s nav: unique ids, starts at home, ends with settings, gated items enabled, hrefs from catalog', (id) => {
    const b = BANDS[id];
    expect(b.nav[0]!.id).toBe('home');
    expect(b.nav.at(-1)!.id).toBe('settings');
    expect(new Set(b.nav.map((n) => n.id)).size).toBe(b.nav.length);
    for (const n of b.nav) {
      expect(n.href).toBe(NAV_CATALOG[n.id].href);
      if (n.requires) expect(b.features[n.requires]).toBe(true);
      expect(n.label.en.length).toBeGreaterThan(0);
      expect(n.label.ar).toMatch(arabic);
    }
    const primary = b.nav.filter((n) => n.primary).length;
    expect(primary).toBeGreaterThanOrEqual(4);
    expect(primary).toBeLessThanOrEqual(6); // fits iPad-portrait rail
  });

  it.each(BAND_IDS)('%s copy has every required key in EN and AR, AR actually Arabic', (id) => {
    const c = BANDS[id].copy;
    for (const k of REQUIRED_COPY_KEYS) {
      expect(c[`en.${k}`], `en.${k}`).toBeTruthy();
      expect(c[`ar.${k}`], `ar.${k}`).toMatch(arabic);
    }
    for (const g of ['greeting.morning', 'greeting.afternoon', 'greeting.evening']) {
      expect(c[`en.${g}`]).toContain('{name}');
      expect(c[`ar.${g}`]).toContain('{name}');
    }
    expect(c['en.chat.safety']).toContain('116111');
    expect(c['ar.chat.safety']).toContain('116111');
  });

  it.each(BAND_IDS)('%s chart defaults are coherent', (id) => {
    const c = BANDS[id].chartDefaults;
    expect(c.allowedRanges).toContain(c.defaultRange);
    expect(c.maxSeries).toBeGreaterThanOrEqual(1);
    expect(c.colors.length).toBeGreaterThanOrEqual(c.maxSeries);
    expect(c.preferredTypes.length).toBeGreaterThan(0);
  });

  it.each(BAND_IDS)('%s never uses leaderboards, infinite scroll, or ghost-writing; always escalates crises', (id) => {
    const b = BANDS[id];
    expect(b.features.leaderboards).toBe(false);
    expect(b.features.directMessaging).toBe(false);
    expect(b.features.publicProfile).toBe(false);
    expect(b.rewards.leaderboard).toBe(false);
    expect(b.wellbeing.infiniteScroll).toBe(false);
    expect(b.aiPolicy.writesGradedWork).toBe(false);
    expect(b.aiPolicy.crisisEscalation).toBe(true);
    expect(b.guardian.safetyAlerts).toBe(true);
    expect(b.aiPolicy.refusalTopics.some((r) => r.includes('self-harm'))).toBe(true);
  });

  it.each(BAND_IDS)('%s badge catalogue matches the badges flag', (id) => {
    const r = BANDS[id].rewards;
    expect(r.badges).toBe(BANDS[id].features.badges);
    expect(r.streaks).toBe(BANDS[id].features.streaks);
    if (r.badges) expect(r.badgeCatalog.length).toBeGreaterThan(0);
    for (const badge of r.badgeCatalog) expect(badge.label.ar).toMatch(arabic);
  });
});

describe('progression across bands (older = more autonomy, more scope)', () => {
  const order: BandId[] = ['g5-6', 'g7-8', 'g9-10', 'g11-12'];
  const pairs = order.slice(1).map((b, i) => [order[i]!, b] as const);

  it.each(pairs)('%s → %s: AI cap, response length, reading level, screen-time suggestion all increase', (a, b) => {
    expect(BANDS[b].aiPolicy.dailyMessageCap).toBeGreaterThan(BANDS[a].aiPolicy.dailyMessageCap);
    expect(BANDS[b].aiPolicy.maxResponseWords).toBeGreaterThan(BANDS[a].aiPolicy.maxResponseWords);
    expect(BANDS[b].readingLevel.fkGradeTarget).toBeGreaterThan(BANDS[a].readingLevel.fkGradeTarget);
    expect(BANDS[b].wellbeing.suggestedDailyMinutes).toBeGreaterThan(BANDS[a].wellbeing.suggestedDailyMinutes);
    expect(BANDS[b].chartDefaults.maxSeries).toBeGreaterThanOrEqual(BANDS[a].chartDefaults.maxSeries);
  });

  it.each(pairs)('%s → %s: features only get added, never removed (except subjectChoices, badges, points after choices are made)', (a, b) => {
    const allowedDrops = new Set(['subjectChoices', 'badges']);
    for (const f of FEATURE_IDS) {
      if (BANDS[a].features[f] && !BANDS[b].features[f]) expect(allowedDrops.has(f), `${f} dropped`).toBe(true);
    }
  });

  it.each(pairs)('%s → %s: AI allowed tasks are a superset', (a, b) => {
    for (const t of BANDS[a].aiPolicy.allowedTasks) expect(BANDS[b].aiPolicy.allowedTasks).toContain(t);
  });

  it('guardian levels step full → summary → digest → opt-in', () => {
    expect(order.map((b) => BANDS[b].guardian.level)).toEqual(['full', 'summary', 'digest', 'opt-in']);
  });
});

describe('band-specific rules from the brief', () => {
  it('g5-6: no social links, no external opportunities, no CV; school competitions only; guardian sees everything; explain-dont-answer', () => {
    const b = BANDS['g5-6'];
    expect(b.features.socialLinks).toBe(false);
    expect(b.features.externalOpportunities).toBe(false);
    expect(b.features.externalCompetitions).toBe(false);
    expect(b.features.cv).toBe(false);
    expect(b.features.schoolCompetitions).toBe(true);
    expect(b.guardian.level).toBe('full');
    expect(b.guardian.seesChatTranscripts).toBe(true);
    expect(b.guardian.verifiableConsentRequired).toBe(true);
    expect(b.guardian.studentCanMarkPrivate).toBe(false);
    expect(b.aiPolicy.mode).toBe('homework-helper');
    expect(b.aiPolicy.integrityMode).toBe('explain-dont-answer');
    expect(b.rewards.badges && b.rewards.streaks).toBe(true);
    expect(b.chartDefaults.maxSeries).toBe(1);
    expect(b.aiPolicy.tools).not.toContain('show_opportunities');
  });

  it('g7-8: clubs, competitions, study planner, limited AI, guardian summaries', () => {
    const b = BANDS['g7-8'];
    expect(b.features.clubs && b.features.schoolCompetitions && b.features.studyPlanner).toBe(true);
    expect(b.features.olympiads || b.features.summerPrograms || b.features.cv).toBe(false);
    expect(b.aiPolicy.dailyMessageCap).toBeLessThan(BANDS['g9-10'].aiPolicy.dailyMessageCap);
    expect(b.guardian.level).toBe('summary');
    expect(b.guardian.seesChatTranscripts).toBe(false);
  });

  it('g9-10: subject choices, olympiads, summer programmes, portfolio, career explorer; still no social links (UAE under-15 rule)', () => {
    const f = BANDS['g9-10'].features;
    expect(f.subjectChoices && f.olympiads && f.summerPrograms && f.portfolio && f.careerExplorer).toBe(true);
    expect(f.socialLinks).toBe(false);
    expect(f.linkedin).toBe(false);
    expect(f.cv).toBe(false);
    expect(f.applications).toBe(false);
  });

  it('g11-12: opportunities, applications, CV, LinkedIn, university planner, exam countdowns', () => {
    const f = BANDS['g11-12'].features;
    for (const k of ['externalOpportunities', 'applications', 'cv', 'linkedin', 'socialLinks', 'universityPlanner', 'examCountdowns'] as const) {
      expect(f[k], k).toBe(true);
    }
    expect(BANDS['g11-12'].dashboardWidgets).toEqual(expect.arrayContaining(['applications', 'cv', 'social-links']));
    expect(BANDS['g11-12'].guardian.level).toBe('opt-in');
  });

  it('only g11-12 shows the social-links, cv and applications widgets', () => {
    for (const id of ['g5-6', 'g7-8', 'g9-10'] as const) {
      expect(BANDS[id].dashboardWidgets).not.toContain('social-links');
      expect(BANDS[id].dashboardWidgets).not.toContain('cv');
      expect(BANDS[id].dashboardWidgets).not.toContain('applications');
    }
  });
});
