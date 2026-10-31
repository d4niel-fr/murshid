import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  defaultChecklist,
  renderApplicationChecklistPdf,
  renderCvPdf,
  renderPortfolioHtml,
  sanitize,
  toJsonResume,
  type CvTemplate,
} from '../src/index.js';
import { achievements, aisha, application, NOW, opportunity, rohan, school } from './fixtures.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'out');

function hasPdftotext(): boolean {
  try {
    execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function assertValidPdf(buf: Buffer, file: string): Promise<number> {
  writeFileSync(join(OUT, file), buf);
  expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(buf.subarray(-6).toString('latin1')).toContain('%%EOF');
  const pdf = await PDFDocument.load(buf); // throws on malformed xref/objects
  expect(pdf.getPageCount()).toBeGreaterThan(0);
  return pdf.getPageCount();
}

/** ATS check: text is extractable, in reading order. Skipped silently if poppler isn't installed. */
function extractText(file: string): string | null {
  if (!hasPdftotext()) return null;
  return execFileSync('pdftotext', ['-layout', join(OUT, file), '-'], { encoding: 'utf8' });
}

beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

const templates: CvTemplate[] = ['clean', 'academic', 'internship'];

describe('CV PDFs', () => {
  const resume = toJsonResume({
    student: aisha,
    achievements,
    school,
    contact: { email: 'aisha.test@example.com', phone: '+971 50 000 0000', profiles: [{ network: 'GitHub', url: 'https://github.com/aisha-test' }] },
    courses: ['Biology', 'Chemistry', 'Mathematics'],
    score: 'Predicted A Levels: A*A*A',
    now: NOW,
  });

  for (const t of templates) {
    it(`renders ${t} template as a valid, text-extractable PDF`, async () => {
      const buf = await renderCvPdf(resume, t, { creationDate: NOW });
      const pages = await assertValidPdf(buf, `cv-aisha-${t}.pdf`);
      expect(pages).toBeLessThanOrEqual(2);
      const text = extractText(`cv-aisha-${t}.pdf`);
      if (text !== null) {
        expect(text).toContain('Aisha Test');
        expect(text).toMatch(/EDUCATION/);
        expect(text).toContain('Test Health Labs');
        expect(text).toContain('Python');
      }
    });
  }

  it('renders a sparse student without crashing', async () => {
    const r = toJsonResume({ student: rohan, achievements: [], now: NOW });
    await assertValidPdf(await renderCvPdf(r, 'internship'), 'cv-rohan-internship.pdf');
  });

  it('survives non-Latin text with standard fonts (sanitized, no crash)', async () => {
    const r = toJsonResume({ student: { ...rohan, full_name: 'Rohan Test رohan', interests: ['Café ☕ culture'] }, achievements: [], now: NOW });
    await assertValidPdf(await renderCvPdf(r, 'clean'), 'cv-unicode-sanitized.pdf');
    expect(sanitize('Café ☕ رو')).toBe('Café ? ??');
  });

  it('long achievement lists paginate', async () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ ...achievements[1]!, id: `x${i}`, title: `Intern ${i} at Test Co ${i}` }));
    const r = toJsonResume({ student: aisha, achievements: many, now: NOW });
    const pages = await assertValidPdf(await renderCvPdf(r, 'clean'), 'cv-long.pdf');
    expect(pages).toBeGreaterThan(1);
  });
});

describe('Application checklist PDF', () => {
  it('renders a valid PDF with deadline countdown', async () => {
    const buf = await renderApplicationChecklistPdf({ student: aisha, opportunity, application, now: NOW });
    await assertValidPdf(buf, 'checklist-aisha-summer.pdf');
    const text = extractText('checklist-aisha-summer.pdf');
    if (text !== null) {
      expect(text.toLowerCase()).toContain('2 of 5 done');
      expect(text).toContain('37 days left');
      expect(text).toContain('Free');
    }
  });

  it('default checklists are type-specific', () => {
    const h = defaultChecklist('hackathon');
    expect(h.some((i) => /GitHub/.test(i.item))).toBe(true);
    expect(h.every((i) => !i.done)).toBe(true);
    expect(defaultChecklist('course', { needsGuardian: false }).some((i) => /guardian/i.test(i.item))).toBe(false);
  });
});

describe('Portfolio HTML', () => {
  const resume = toJsonResume({ student: aisha, achievements, school, contact: { email: 'aisha.test@example.com', phone: '+971500000000' }, now: NOW });

  it('generates a self-contained page and hides contact by default', () => {
    const html = renderPortfolioHtml(resume);
    writeFileSync(join(OUT, 'portfolio-aisha.html'), html);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('Aisha Test');
    expect(html).toContain('Low-cost prosthetic hand prototype');
    expect(html).not.toContain('aisha.test@example.com');
    expect(html).not.toContain('+971500000000');
    expect(html).not.toMatch(/<link |<script src=/);
    expect(existsSync(join(OUT, 'portfolio-aisha.html'))).toBe(true);
  });

  it('shows contact when opted in and escapes HTML', () => {
    const evil = toJsonResume({ student: { ...rohan, full_name: '<img src=x onerror=alert(1)>' }, achievements: [
      { id: 'e', student_id: rohan.id, title: 'P', category: 'project', date: null, evidence_url: 'javascript:alert(1)' },
    ], contact: { email: 'r@example.com' }, now: NOW });
    const html = renderPortfolioHtml(evil, { showContact: true });
    expect(html).toContain('r@example.com');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('javascript:');
  });
});

describe('sanitize: model typography', () => {
  it('maps narrow / figure no-break spaces to plain spaces instead of "?"', () => {
    expect(sanitize('AED\u202f18,990 from 100\u2007m and Sep\u00a02026 \u2011 ok')).toBe('AED 18,990 from 100 m and Sep 2026 - ok');
  });
});
