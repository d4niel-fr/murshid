import { describe, expect, it } from 'vitest';
import {
  BANDS,
  aiAllows,
  bandConfigForGrade,
  canAccessRoute,
  chatMessagesRemaining,
  copyFor,
  gateChat,
  greetingKey,
  guardianCanSee,
  isBandId,
  isFeatureEnabled,
  opportunityDecision,
  t,
  visibleNav,
  visibleWidgets,
} from '../src/index.js';

describe('lookup helpers', () => {
  it('bandConfigForGrade / isBandId / isFeatureEnabled', () => {
    expect(bandConfigForGrade(8).id).toBe('g7-8');
    expect(isBandId('g9-10')).toBe(true);
    expect(isBandId('g4')).toBe(false);
    expect(isFeatureEnabled('g5-6', 'cv')).toBe(false);
    expect(isFeatureEnabled('g11-12', 'cv')).toBe(true);
  });

  it('visibleNav and visibleWidgets keep band order and drop nothing for authored bands', () => {
    for (const id of Object.keys(BANDS) as Array<keyof typeof BANDS>) {
      expect(visibleNav(id)).toEqual(BANDS[id].nav);
      expect(visibleWidgets(id)).toEqual(BANDS[id].dashboardWidgets);
    }
  });
});

describe('canAccessRoute', () => {
  it('blocks CV and links below g11-12', () => {
    expect(canAccessRoute('g5-6', '/cv')).toBe(false);
    expect(canAccessRoute('g9-10', '/profile/links')).toBe(false);
    expect(canAccessRoute('g11-12', '/cv')).toBe(true);
    expect(canAccessRoute('g11-12', '/profile/links')).toBe(true);
  });
  it('matches nested paths and root exactly', () => {
    expect(canAccessRoute('g5-6', '/')).toBe(true);
    expect(canAccessRoute('g7-8', '/planner/week/2026-10-12')).toBe(true);
    expect(canAccessRoute('g5-6', '/planner')).toBe(false);
    expect(canAccessRoute('g5-6', '/opportunities')).toBe(false);
    expect(canAccessRoute('g9-10', '/opportunities/abc')).toBe(true);
  });
});

describe('copy', () => {
  it('interpolates and localises', () => {
    expect(t('g5-6', 'greeting.morning', 'en', { name: 'Layla' })).toBe('Good morning, Layla! ☀️');
    expect(t('g11-12', 'greeting.morning', 'ar', { name: 'زايد' })).toBe('صباح الخير يا زايد.');
  });
  it('falls back to EN then key; leaves unknown vars intact', () => {
    expect(t('g7-8', 'does.not.exist', 'ar')).toBe('does.not.exist');
    expect(t('g7-8', 'greeting.morning', 'en')).toContain('{name}');
  });
  it('copyFor strips prefix and has equal EN/AR key sets', () => {
    for (const id of Object.keys(BANDS) as Array<keyof typeof BANDS>) {
      expect(Object.keys(copyFor(id, 'en')).sort()).toEqual(Object.keys(copyFor(id, 'ar')).sort());
    }
  });
  it('greetingKey by Dubai hour', () => {
    expect(greetingKey(7)).toBe('greeting.morning');
    expect(greetingKey(13)).toBe('greeting.afternoon');
    expect(greetingKey(20)).toBe('greeting.evening');
    expect(greetingKey(1)).toBe('greeting.evening');
  });
});

describe('AI gating', () => {
  it('task permissions by band', () => {
    expect(aiAllows('g5-6', 'explain-concept')).toBe(true);
    expect(aiAllows('g5-6', 'find-opportunities')).toBe(false);
    expect(aiAllows('g5-6', 'essay-feedback')).toBe(false);
    expect(aiAllows('g7-8', 'plan-my-week')).toBe(true);
    expect(aiAllows('g7-8', 'cv-review')).toBe(false);
    expect(aiAllows('g9-10', 'subject-choice-advice')).toBe(true);
    expect(aiAllows('g9-10', 'personal-statement-feedback')).toBe(false);
    expect(aiAllows('g11-12', 'personal-statement-feedback')).toBe(true);
  });
  it('daily caps', () => {
    expect(chatMessagesRemaining('g5-6', 0)).toBe(20);
    expect(chatMessagesRemaining('g5-6', 25)).toBe(0);
    expect(chatMessagesRemaining('g11-12', -3)).toBe(100);
  });
  it('gateChat', () => {
    expect(gateChat('g5-6', 19)).toEqual({ ok: true, remaining: 0 });
    expect(gateChat('g5-6', 20)).toMatchObject({ ok: false, reason: 'cap-reached', messageKey: 'chat.capReached' });
    expect(gateChat('g7-8', 0, 'cv-review')).toMatchObject({ ok: false, reason: 'task-not-allowed' });
    expect(gateChat('g11-12', 10, 'cv-review')).toMatchObject({ ok: true });
  });
});

describe('opportunityDecision', () => {
  it('g5-6: school competitions only, guardian-free for school scope', () => {
    expect(opportunityDecision('g5-6', { kind: 'competition', scope: 'school' })).toEqual({ allowed: true, needsGuardianApproval: false });
    expect(opportunityDecision('g5-6', { kind: 'competition', scope: 'school', paid: true }).needsGuardianApproval).toBe(true);
    expect(opportunityDecision('g5-6', { kind: 'competition', scope: 'uae' }).allowed).toBe(false);
    expect(opportunityDecision('g5-6', { kind: 'olympiad', scope: 'international' }).allowed).toBe(false);
  });
  it('g7-8: UAE competitions with guardian approval; no summer programmes', () => {
    expect(opportunityDecision('g7-8', { kind: 'competition', scope: 'uae' })).toEqual({ allowed: true, needsGuardianApproval: true });
    expect(opportunityDecision('g7-8', { kind: 'summer-program', scope: 'international' }).allowed).toBe(false);
  });
  it('g9-10: olympiads and summer programmes; no internships', () => {
    expect(opportunityDecision('g9-10', { kind: 'olympiad', scope: 'international' }).allowed).toBe(true);
    expect(opportunityDecision('g9-10', { kind: 'summer-program', scope: 'international' }).needsGuardianApproval).toBe(true);
    expect(opportunityDecision('g9-10', { kind: 'internship', scope: 'uae' }).allowed).toBe(false);
  });
  it('g11-12: everything, no guardian approval; respects minAge', () => {
    expect(opportunityDecision('g11-12', { kind: 'internship', scope: 'uae', paid: true })).toEqual({ allowed: true, needsGuardianApproval: false });
    expect(opportunityDecision('g11-12', { kind: 'internship', scope: 'uae', minAge: 18 }, 16).allowed).toBe(false);
  });
});

describe('guardianCanSee', () => {
  it('full band sees chat; summary/digest do not', () => {
    expect(guardianCanSee('g5-6', 'chat')).toBe(true);
    expect(guardianCanSee('g7-8', 'chat')).toBe(false);
    expect(guardianCanSee('g9-10', 'grades')).toBe(true);
  });
  it('opt-in band depends on student share, never chat', () => {
    expect(guardianCanSee('g11-12', 'grades')).toBe(false);
    expect(guardianCanSee('g11-12', 'grades', true)).toBe(true);
    expect(guardianCanSee('g11-12', 'chat', true)).toBe(false);
  });
});
