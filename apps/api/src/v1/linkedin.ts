/**
 * LinkedIn-ready CV for a student: a LinkedIn profile pack (headline, About, experience, education, skills,
 * featured, certifications) and an ATS-safe PDF rendered with @murshid/documents. Built only from store data,
 * so admin edits (CV fields, projects, achievements) and Murshid's career agent output show up immediately.
 */
import { renderCvPdf, type JsonResume } from '@murshid/documents';
import { enumLabel } from '@murshid/core';
import { addDays } from '../lib/time';
import type { DemoView } from './store';

/** lower-case the first letter only, so proper nouns (Dubai, Tideline) keep their capitals */
const lcFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
import { achievements, projects, subjectSummaries, training } from './views';

export interface LinkedInExperience {
  title: string;
  organization: string;
  type: 'Self-employed' | 'Leadership' | 'Sport' | 'Volunteer' | 'Project';
  start: string; // YYYY-MM
  end: string | null; // null = present
  location: string;
  bullets: string[];
}

export interface LinkedInPack {
  studentId: string;
  name: string;
  headline: string;
  about: string;
  location: string;
  experience: LinkedInExperience[];
  education: { school: string; programme: string; start: string; end: string; grades: string | null; activities: string[] }[];
  skills: string[];
  featured: { title: string; url: string | null; description: string }[];
  certifications: { name: string; issuer: string; date: string }[];
  honors: { title: string; date: string; description: string }[];
  links: Record<string, string>;
  checklist: string[];
  synthetic: true;
  generatedAt: string;
  generatedBy: 'rules' | 'ai';
}

const ym = (d: string) => d.slice(0, 7);
const aed = (n: number) => `AED ${n.toLocaleString('en-US')}`;
const fmtSec = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}` : `${s.toFixed(2)}s`);

function sportBullets(v: DemoView) {
  return training(v, 8).map((t) => {
    const bullets: string[] = [];
    const pb = t.personalBests;
    if (t.id === 'football') {
      if (t.last120dRecord) bullets.push(`${t.last120dRecord.played} school fixtures this season: ${t.last120dRecord.goals} goals, ${t.last120dRecord.assists} assists from central midfield.`);
      if (pb.yoyoLevel) bullets.push(`Yo-Yo IR1 level ${pb.yoyoLevel.value} and a ${pb.sprint30m?.value ?? '-'}s 30m sprint (squad testing).`);
      bullets.push('Lead warm-ups and mentor younger players; train twice a week alongside a full A Level timetable.');
    } else if (t.id === 'swimming') {
      if (pb.free100) bullets.push(`Personal bests: 100m freestyle ${fmtSec(pb.free100.value)}${pb.im200 ? `, 200m IM ${fmtSec(pb.im200.value)}` : ''}.`);
      bullets.push(`Train ${Math.round(t.weeklyTargetMinutes / 60)} hours a week across four early-morning sessions; compete at club galas through the season.`);
    } else {
      const k = Object.values(pb)[0];
      if (k) bullets.push(`Best ${k.label.toLowerCase()}: ${k.value}${k.unit === 's' ? 's' : ` ${k.unit}`}.`);
      bullets.push(`${Math.round(t.weeklyLoad.reduce((s, w) => s + w.minutes, 0) / 60)} hours of training in the last 8 weeks.`);
    }
    return { t, bullets };
  });
}

/** Build the LinkedIn pack. `overrides` lets the career agent supply its own headline / About text. */
export function buildLinkedInPack(v: DemoView, overrides: { headline?: string; about?: string } = {}): LinkedInPack {
  const p = v.profile;
  const cv = v.record.cv;
  const projs = projects(v);
  const acadYear = Number(v.data.today.slice(0, 4)) - (Number(v.data.today.slice(5, 7)) >= 8 ? 0 : 1);
  const subs = subjectSummaries(v);
  const sports = sportBullets(v);
  const location = cv.location;

  const experience: LinkedInExperience[] = [];
  for (const pr of projs) {
    const bullets: string[] = [];
    if (pr.totals) {
      bullets.push(`Built ${pr.name} from idea to ${aed(pr.totals.revenueAed)} in revenue across ${pr.totals.orders} orders and ${pr.totals.customers} customers since ${ym(pr.startDate)}.`);
      if (pr.totals.followers) bullets.push(`Grew the brand's Instagram to ${pr.totals.followers.toLocaleString('en-US')} followers with no paid ads.`);
    } else {
      bullets.push(pr.tagline + '.');
    }
    for (const ms of pr.milestones.filter((m) => m.done).slice(-3)) bullets.push(`${ms.title}.`);
    experience.push({
      title: pr.role, organization: pr.name, type: pr.kind === 'business' ? 'Self-employed' : 'Project', start: ym(pr.startDate),
      end: pr.status === 'done' ? ym(pr.milestones[pr.milestones.length - 1]?.date ?? v.data.today) : null, location, bullets: bullets.slice(0, 5),
    });
  }
  for (const { t, bullets } of sports) {
    const lead = /captain|lead/i.test(t.role ?? '');
    experience.push({
      title: t.role ?? t.name, organization: t.detail, type: lead ? 'Leadership' : 'Sport',
      start: ym(addDays(v.data.today, -364)), end: null, location, bullets,
    });
  }

  const best = [...subs].sort((a, b) => b.current - a.current).slice(0, 3);
  const projectLine = projs[0]?.totals
    ? `I founded ${projs[0].name} (${lcFirst(projs[0].tagline)}), which has made ${aed(projs[0].totals.revenueAed)} from ${projs[0].totals.customers} customers.`
    : projs[0] ? `I'm building ${projs[0].name}: ${lcFirst(projs[0].tagline)}.` : '';
  const sportLine = sports.length
    ? `Outside class I ${sports.map(({ t }) => (t.id === 'football' ? 'play for the school 1st XI' : t.id === 'swimming' ? 'swim competitively for my club' : `train in ${t.name.toLowerCase()}`)).join(' and ')}, which taught me to plan every week carefully.`
    : '';
  const about = overrides.about?.trim() || [
    `${p.classLabel} student at ${p.school} in ${location.split(',')[0]}.`,
    projectLine,
    sportLine,
    best.length ? `Strongest subjects: ${best.map((s) => s.name).join(', ')}${cv.predicted ? ` (${cv.predicted.replace(/^Predicted\s*/i, 'predicted ')})` : ''}.` : '',
    cv.universityGoal ? `Next: applying to study ${cv.universityGoal}.` : '',
    'Open to internships, competitions and mentoring.',
  ].filter(Boolean).join(' ');

  const headline = (overrides.headline?.trim() || cv.headline).slice(0, 220);
  const skills = [...new Set([...cv.skills, ...projs.flatMap((x) => x.skills), ...best.map((s) => s.name)])].slice(0, 15);
  const featured = cv.featured.length ? cv.featured : projs.map((x) => ({ title: x.name, url: x.url, description: x.tagline }));
  const links = Object.fromEntries(Object.entries(v.record.links ?? p.links).filter(([k, val]) => typeof val === 'string' && k !== 'connectedAt' && k !== 'updatedAt')) as Record<string, string>;
  const checklist = [
    p.age < 16 ? 'LinkedIn requires members to be 16+: keep this pack until then.' : 'Profile photo: clear, friendly head-and-shoulders shot.',
    'Paste the headline and About section exactly; LinkedIn allows 220 and 2,600 characters.',
    'Add each experience entry with its dates; add media (store link, gala results) to Featured.',
    'Set your profile to show only what you are comfortable sharing; ask a parent to review before publishing.',
  ];

  return {
    studentId: p.id, name: p.name, headline, about: about.slice(0, 2600), location, experience,
    education: [{
      school: p.school, programme: `${enumLabel('curriculum', p.curriculum)}: ${subs.map((s) => s.name).join(', ')}`,
      // grades are numbered US-style (Grade 11 = Year 12): the final year is Grade 12 in every curriculum
      start: `${acadYear - Math.max(0, p.grade - 11)}-09`, end: `${acadYear + Math.max(0, 12 - p.grade) + 1}-06`,
      grades: cv.predicted, activities: sports.map(({ t }) => t.detail),
    }],
    skills, featured, certifications: cv.certifications,
    honors: achievements(v).filter((a) => ['award', 'academic', 'sport'].includes(a.category)).slice(0, 6).map((a) => ({ title: a.title, date: a.date, description: a.description })),
    links, checklist, synthetic: true, generatedAt: v.now.toISOString(),
    generatedBy: overrides.headline || overrides.about ? 'ai' : 'rules',
  };
}

/** JSON Resume for the PDF renderer (packages/documents). */
export function packToJsonResume(v: DemoView, pack: LinkedInPack): JsonResume {
  const [city] = pack.location.split(',');
  const profiles = Object.entries(pack.links).filter(([k]) => ['linkedin', 'github', 'instagram'].includes(k)).map(([network, url]) => ({ network, url }));
  return {
    basics: {
      name: pack.name, label: pack.headline, email: v.record.cv.email ?? undefined, phone: v.record.cv.phone ?? undefined,
      url: pack.links.website ?? pack.links.portfolio, summary: pack.about,
      location: { city: city?.trim(), countryCode: 'AE' }, profiles,
    },
    work: pack.experience.filter((e) => e.type === 'Self-employed').map((e) => ({ name: e.organization, position: e.title, startDate: e.start, endDate: e.end ?? undefined, highlights: e.bullets })),
    projects: pack.experience.filter((e) => e.type !== 'Self-employed').map((e) => ({
      name: `${e.title}, ${e.organization}`, description: e.bullets[0], highlights: e.bullets.slice(1), startDate: e.start, endDate: e.end ?? undefined,
      type: e.type === 'Leadership' ? 'leadership' : e.type === 'Sport' ? 'sport' : 'project',
    })),
    education: pack.education.map((e) => ({ institution: e.school, area: e.programme, studyType: 'Secondary', startDate: e.start, endDate: e.end, score: e.grades ?? undefined })),
    awards: pack.honors.map((h) => ({ title: h.title, date: h.date, summary: h.description })),
    certificates: pack.certifications.map((c) => ({ name: c.name, issuer: c.issuer, date: c.date })),
    skills: [{ name: 'Skills', keywords: pack.skills }, ...(pack.synthetic ? [{ name: 'Note', keywords: ['Synthetic demo profile generated by Murshid. All people', ' organisations and figures are fictional.'] }] : [])],
    languages: v.profile.languages.map((l) => ({ language: l })),
    meta: { murshid: { studentId: v.profile.id, target: 'general', grade: v.profile.grade, generator: 'murshid-linkedin-pack' } },
  };
}

export async function renderLinkedInCvPdf(v: DemoView, pack = buildLinkedInPack(v)): Promise<Buffer> {
  return renderCvPdf(packToJsonResume(v, pack), 'clean', { creationDate: new Date(Date.parse(`${v.data.today}T00:00:00Z`)) });
}
