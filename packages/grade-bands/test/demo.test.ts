import { describe, expect, it } from 'vitest';
import { BAND_IDS, BANDS, bandForGrade, classLabel, demoStudentById, demoStudents } from '../src/index.js';

const TODAY = '2026-10-10';

describe('demoStudents', () => {
  it('one per band with contract ids', () => {
    expect(Object.keys(demoStudents).sort()).toEqual([...BAND_IDS].sort());
    expect(BAND_IDS.map((b) => demoStudents[b].id)).toEqual(['demo-g5', 'demo-g7', 'demo-g9', 'demo-g11']);
    expect(demoStudentById('demo-g9')?.firstName).toBe('Priya');
    expect(demoStudentById('nope')).toBeUndefined();
  });

  it.each(BAND_IDS)('%s student is synthetic and consistent with its band and curriculum', (band) => {
    const s = demoStudents[band];
    expect(s.synthetic).toBe(true);
    expect(s.band).toBe(band);
    expect(bandForGrade(s.grade)).toBe(band);
    expect(s.classLabel).toBe(classLabel(s.curriculum, s.grade).replace(/\s*\(.*\)$/, ''));
    expect(s.school).toMatch(/\(demo\)$/);
    expect(s.nameAr).toMatch(/[\u0600-\u06FF]/);
  });

  it.each(BAND_IDS)('%s has subjects, activities with dated sessions, goals and future upcoming items', (band) => {
    const s = demoStudents[band];
    expect(s.subjects.length).toBeGreaterThanOrEqual(5);
    for (const sub of s.subjects) {
      expect(sub.trend).toHaveLength(4);
      const max = sub.scale === 'ib7' ? 7 : 100;
      for (const v of [sub.current, sub.target, ...sub.trend]) expect(v).toBeGreaterThan(0), expect(v).toBeLessThanOrEqual(max);
    }
    expect(s.activities.length).toBeGreaterThanOrEqual(2);
    for (const a of s.activities) {
      expect(a.sessions.length).toBeGreaterThanOrEqual(6);
      for (const sess of a.sessions) {
        expect(sess.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(sess.date <= TODAY).toBe(true);
        expect(sess.minutes).toBeGreaterThan(0);
      }
      const dates = a.sessions.map((x) => x.date);
      expect([...dates].sort()).toEqual(dates);
    }
    for (const g of s.goals) expect(g.progress).toBeGreaterThanOrEqual(0), expect(g.progress).toBeLessThanOrEqual(1);
    for (const u of s.upcoming) expect(u.date > TODAY).toBe(true);
    expect(s.streaks.current).toBeLessThanOrEqual(s.streaks.best);
  });

  it.each(BAND_IDS)('%s badges exist in the band catalogue', (band) => {
    const ids = new Set(BANDS[band].rewards.badgeCatalog.map((b) => b.id));
    for (const b of demoStudents[band].badges) expect(ids.has(b), b).toBe(true);
  });

  it('activity coverage includes athletics, gym, hackathon, football, piano', () => {
    const areas = new Set(Object.values(demoStudents).flatMap((s) => s.activities.map((a) => a.area)));
    for (const a of ['athletics', 'gym', 'hackathon', 'football', 'piano']) expect(areas.has(a as never), a).toBe(true);
  });

  it('profile links only where the band allows them', () => {
    expect(demoStudents['g5-6'].links).toBeUndefined();
    expect(demoStudents['g7-8'].links).toBeUndefined();
    expect(demoStudents['g9-10'].links?.linkedin).toBeUndefined(); // portfolio/github only, no LinkedIn
    expect(demoStudents['g11-12'].links?.linkedin).toMatch(/^https:\/\/www\.linkedin\.com\//);
  });

  it('metrics trend in the right direction (athletics times fall, gym loads rise)', () => {
    const run = demoStudents['g7-8'].activities.find((a) => a.id === 'athletics')!.sessions;
    expect(run.at(-1)!.metric!.value).toBeLessThan(run[0]!.metric!.value);
    const gym = demoStudents['g11-12'].activities.find((a) => a.id === 'gym')!.sessions;
    expect(gym.at(-1)!.metric!.value).toBeGreaterThan(gym[0]!.metric!.value);
  });
});
