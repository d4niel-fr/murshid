'use client';

/**
 * Text out of study files, on the device (nothing is uploaded to read them): PDF (pdf.js), PowerPoint and Word
 * (they are zip files of XML), CSV/TSV exports from Quizlet or Anki, and plain text or markdown.
 * Slides come back with one "## title" per slide and the rest as bullets, so the generator sees their structure.
 */
export const IMPORT_ACCEPT = '.pdf,.pptx,.docx,.txt,.md,.csv,.tsv,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv';
export const IMPORT_MAX_BYTES = 25 * 1024 * 1024;

export class ExtractError extends Error {}

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&');

async function unzip(file: File): Promise<Record<string, Uint8Array>> {
  const { unzipSync } = await import('fflate');
  try { return unzipSync(new Uint8Array(await file.arrayBuffer())); } catch { throw new ExtractError('This file looks damaged or is not a real Office file.'); }
}
const xml = (b: Uint8Array | undefined) => (b ? new TextDecoder().decode(b) : '');

async function pptx(file: File): Promise<string> {
  const z = await unzip(file);
  const num = (p: string) => Number(/(\d+)\.xml$/.exec(p)?.[1] ?? 0);
  const slides = Object.keys(z).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => num(a) - num(b));
  if (!slides.length) throw new ExtractError('No slides found in this PowerPoint.');
  return slides.map((p, i) => {
    const paras = [...xml(z[p]).matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)].map((m) => [...m[1]!.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decode(t[1]!)).join('').trim()).filter(Boolean);
    const notes = [...xml(z[`ppt/notesSlides/notesSlide${num(p)}.xml`]).matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((t) => decode(t[1]!)).join(' ').replace(/\s+/g, ' ').trim();
    const [title, ...rest] = paras;
    return [`## ${title ?? `Slide ${i + 1}`}`, ...rest.map((r) => `- ${r}`), ...(notes && !/^\d+$/.test(notes) ? [notes] : [])].join('\n');
  }).join('\n\n');
}

async function docx(file: File): Promise<string> {
  const z = await unzip(file);
  const doc = xml(z['word/document.xml']);
  if (!doc) throw new ExtractError('No text found in this Word document.');
  return [...doc.matchAll(/<w:p[ >]([\s\S]*?)<\/w:p>/g)].map((m) => {
    const body = m[1]!;
    const text = [...body.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map((t) => decode(t[1]!)).join('').trim();
    if (!text) return '';
    if (/<w:pStyle w:val="(Heading|Title)\d?"/.test(body)) return `## ${text}`;
    if (/<w:numPr>/.test(body)) return `- ${text}`;
    return text;
  }).filter(Boolean).join('\n');
}

async function pdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  let doc;
  try { doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise; } catch { throw new ExtractError('This PDF could not be opened (it may be password-protected).'); }
  const pages: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 120); i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    let line = ''; const lines: string[] = []; let lastY: number | null = null;
    for (const it of tc.items as { str?: string; hasEOL?: boolean; transform?: number[] }[]) {
      if (typeof it.str !== 'string') continue;
      const y = it.transform?.[5] ?? null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && line.trim()) { lines.push(line.trim()); line = ''; }
      line += it.str; if (it.hasEOL) { lines.push(line.trim()); line = ''; }
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
    pages.push(lines.filter(Boolean).join('\n'));
  }
  const text = pages.join('\n\n');
  if (text.replace(/\s/g, '').length < 20) throw new ExtractError('This PDF has no text to read (it may be scanned photos). Type the key points, or use a notebook.');
  return text;
}

/** CSV (Quizlet / Anki / spreadsheet export) to tab-separated lines the card generator reads as pairs. */
export function csvToPairs(text: string): string {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === ',' || ch === ';') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.length >= 2 && r[0]!.trim() && r[1]!.trim()).map((r) => `${r[0]!.trim()}\t${r[1]!.trim()}`).join('\n');
}

/** The readable text of a study file. */
export async function extractText(file: File): Promise<string> {
  if (file.size > IMPORT_MAX_BYTES) throw new ExtractError('That file is over 25 MB. Split it, or paste the part you need.');
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') return pdf(file);
  if (name.endsWith('.pptx')) return pptx(file);
  if (name.endsWith('.docx')) return docx(file);
  if (name.endsWith('.csv')) return csvToPairs(await file.text());
  if (/\.(txt|md|tsv|markdown)$/.test(name) || file.type.startsWith('text/')) return file.text();
  if (name.endsWith('.ppt') || name.endsWith('.doc')) throw new ExtractError('Old .ppt / .doc files cannot be read. Save it as .pptx / .docx or PDF first.');
  if (file.type.startsWith('image/')) throw new ExtractError('Photos of notes cannot be read as text yet. Type the key points, or keep the photo in a notebook.');
  throw new ExtractError('Use a PDF, PowerPoint (.pptx), Word (.docx), text or CSV file.');
}
