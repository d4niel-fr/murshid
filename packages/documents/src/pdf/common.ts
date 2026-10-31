import PDFDocument from 'pdfkit';

export type PDFDoc = InstanceType<typeof PDFDocument>;

export interface FontSet {
  regular: string;
  bold: string;
  italic: string;
}

export const HELVETICA: FontSet = { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique' };
export const TIMES: FontSet = { regular: 'Times-Roman', bold: 'Times-Bold', italic: 'Times-Italic' };

export interface PdfRenderOptions {
  /** Page size; UAE schools mostly print A4. */
  size?: 'A4' | 'LETTER';
  /**
   * Optional TTF/OTF font files with wider Unicode coverage (e.g. Noto Sans + Noto Sans Arabic).
   * Without them the 14 standard PDF fonts are used, which only cover Latin-1 (WinAnsi);
   * other characters are transliterated or replaced (see sanitize()).
   */
  fonts?: { regular: string; bold?: string; italic?: string };
  /** Fixed creation date for reproducible output in tests. */
  creationDate?: Date;
}

export interface DocMeta {
  title: string;
  author: string;
  subject?: string;
  keywords?: string;
}

/** Create a pdfkit doc and a promise of its bytes. */
export function createDoc(meta: DocMeta, opts: PdfRenderOptions = {}, margin = 50) {
  const doc = new PDFDocument({
    size: opts.size ?? 'A4',
    margins: { top: margin, bottom: margin, left: margin, right: margin },
    // pdfkit chokes on undefined info values, so only pass the ones we have.
    info: Object.fromEntries(
      Object.entries({
        Title: meta.title,
        Author: meta.author,
        Subject: meta.subject,
        Keywords: meta.keywords,
        Creator: 'Murshid (@murshid/documents)',
        Producer: 'pdfkit',
        CreationDate: opts.creationDate ?? new Date(),
      }).filter(([, v]) => v !== undefined && v !== ''),
    ) as PDFKit.DocumentInfo,
    pdfVersion: '1.7',
    lang: 'en',
    displayTitle: true,
    bufferPages: false,
  });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  return { doc, done };
}

/** Register custom fonts if provided; returns the font set to use. */
export function resolveFonts(doc: PDFDoc, fallback: FontSet, opts: PdfRenderOptions = {}): FontSet & { unicode: boolean } {
  if (!opts.fonts) return { ...fallback, unicode: false };
  doc.registerFont('U-Regular', opts.fonts.regular);
  doc.registerFont('U-Bold', opts.fonts.bold ?? opts.fonts.regular);
  doc.registerFont('U-Italic', opts.fonts.italic ?? opts.fonts.regular);
  return { regular: 'U-Regular', bold: 'U-Bold', italic: 'U-Italic', unicode: true };
}

const TRANSLIT: Record<string, string> = {
  '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2212': '-',
  '\u00a0': ' ', '\u2009': ' ', '\u200b': '',
  // narrow / figure / en / em spaces that models emit in "AED 18,990" or "100 m"
  '\u202f': ' ', '\u2007': ' ', '\u2002': ' ', '\u2003': ' ', '\u2004': ' ', '\u2005': ' ', '\u2006': ' ', '\u2008': ' ', '\u2060': '',
  '\u2192': '->', '\u2190': '<-', '\u2713': 'v', '\u2714': 'v', '\u2022': '\u2022',
};

/**
 * Standard PDF fonts only encode WinAnsi. Map common punctuation, strip accents where possible,
 * and replace anything else with '?' so we never emit garbage glyphs.
 */
export function sanitize(text: string, unicode = false): string {
  if (unicode) return text;
  let out = '';
  for (const ch of text) {
    if (TRANSLIT[ch] !== undefined) {
      out += TRANSLIT[ch];
      continue;
    }
    const code = ch.codePointAt(0)!;
    // WinAnsi = Latin-1 + a handful of cp1252 extras (quotes, dashes, euro, bullet, ellipsis...)
    if (code <= 0xff || '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.includes(ch)) {
      out += ch;
      continue;
    }
    const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    out += [...base].every((c) => c.codePointAt(0)! <= 0xff) && base !== ch ? base : '?';
  }
  return out;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-03-14" → "Mar 2026"; "2026" → "2026". */
export function fmtDate(d?: string): string {
  if (!d) return '';
  const [y, m] = d.split('-');
  if (!m) return y ?? '';
  return `${MONTHS[Number(m) - 1] ?? ''} ${y}`.trim();
}

export function dateRange(start?: string, end?: string): string {
  const s = fmtDate(start);
  const e = fmtDate(end);
  if (s && e && s !== e) return `${s} – ${e}`;
  return s || e;
}

/**
 * Tiny single-column layout helper. Everything is real text in reading order:
 * no tables, columns, text boxes or images — the safest layout for ATS parsers.
 */
export class Writer {
  constructor(
    public doc: PDFDoc,
    public fonts: FontSet & { unicode: boolean },
    public accent = '#1f3a5f',
    public body = 10,
  ) {}

  get width(): number {
    return this.doc.page.width - this.doc.page.margins.left - this.doc.page.margins.right;
  }

  get left(): number {
    return this.doc.page.margins.left;
  }

  s(t: string): string {
    return sanitize(t, this.fonts.unicode);
  }

  ensureSpace(h: number): void {
    const bottom = this.doc.page.height - this.doc.page.margins.bottom;
    if (this.doc.y + h > bottom) this.doc.addPage();
  }

  name(text: string, opts: { align?: 'left' | 'center'; size?: number } = {}): void {
    this.doc
      .font(this.fonts.bold)
      .fontSize(opts.size ?? 22)
      .fillColor('#111111')
      .text(this.s(text), this.left, this.doc.y, { width: this.width, align: opts.align ?? 'left' });
  }

  line(text: string, opts: { align?: 'left' | 'center'; size?: number; italic?: boolean; color?: string } = {}): void {
    if (!text) return;
    this.doc
      .font(opts.italic ? this.fonts.italic : this.fonts.regular)
      .fontSize(opts.size ?? this.body)
      .fillColor(opts.color ?? '#222222')
      .text(this.s(text), this.left, this.doc.y, { width: this.width, align: opts.align ?? 'left' });
  }

  heading(text: string, style: 'rule' | 'caps' | 'plain' = 'rule'): void {
    this.ensureSpace(40);
    this.doc.moveDown(0.6);
    const label = style === 'plain' ? text : text.toUpperCase();
    this.doc
      .font(this.fonts.bold)
      .fontSize(this.body + 1.5)
      .fillColor(this.accent)
      .text(this.s(label), this.left, this.doc.y, { width: this.width, characterSpacing: style === 'caps' ? 0.6 : 0 });
    if (style === 'rule') {
      const y = this.doc.y + 1;
      this.doc.moveTo(this.left, y).lineTo(this.left + this.width, y).lineWidth(0.7).strokeColor(this.accent).stroke();
      this.doc.y = y + 4;
    } else {
      this.doc.moveDown(0.2);
    }
    this.doc.fillColor('#222222');
  }

  /** Entry headline: bold title, then " | " separated meta (org, dates) on the same line. */
  entry(title: string, meta: (string | undefined)[] = []): void {
    this.ensureSpace(28);
    const m = meta.filter((x): x is string => !!x && !!x.trim());
    this.doc.font(this.fonts.bold).fontSize(this.body).fillColor('#111111');
    this.doc.text(this.s(title), this.left, this.doc.y + 2, { width: this.width, continued: m.length > 0 });
    if (m.length) {
      this.doc.font(this.fonts.regular).fillColor('#444444').text(this.s(`  |  ${m.join('  |  ')}`));
    }
    this.doc.fillColor('#222222');
  }

  paragraph(text?: string): void {
    if (!text) return;
    this.doc
      .font(this.fonts.regular)
      .fontSize(this.body)
      .fillColor('#222222')
      .text(this.s(text), this.left, this.doc.y, { width: this.width, lineGap: 1.5 });
  }

  bullets(items?: string[]): void {
    if (!items?.length) return;
    for (const it of items) {
      this.ensureSpace(14);
      this.doc
        .font(this.fonts.regular)
        .fontSize(this.body)
        .fillColor('#222222')
        .text(this.s(`•  ${it}`), this.left + 10, this.doc.y, { width: this.width - 10, lineGap: 1, indent: 0 });
    }
  }

  /** "Label: a, b, c" line — plain text keeps skills keyword-searchable for ATS. */
  labelled(label: string, values?: string[]): void {
    if (!values?.length) return;
    this.doc.font(this.fonts.bold).fontSize(this.body).fillColor('#111111');
    this.doc.text(this.s(`${label}: `), this.left, this.doc.y, { width: this.width, continued: true });
    this.doc.font(this.fonts.regular).fillColor('#222222').text(this.s(values.join(', ')));
  }

  gap(lines = 0.3): void {
    this.doc.moveDown(lines);
  }
}
