import { createHash } from 'node:crypto';
import { htmlToText, taskFromMaterial } from '../../core/normalize';
import type { NormalizedMaterial, NormalizedTask } from '../../core/types';
import { findDueDate } from './dates';
import { extractAddress, parseEmail, type ParsedEmail } from './mime';
import { DEFAULT_RULES, type EmailRule, type LmsSource } from './rules';

/**
 * Email-forward inbox: each student gets an address like
 * <student-alias>@inbox.murshid.app (MX/webhook owned by the api team). The raw
 * RFC 822 message is handed here; we return a Material (+ derived Task) or null.
 */
export interface ParsedLmsEmail {
  lms: LmsSource;
  confidence: number;
  courseName: string | null;
  material: NormalizedMaterial;
  task: NormalizedTask | null;
}

/** AI-LATER: an LLM-backed extractor plugs in here for emails no rule understands. */
export interface EmailExtractor {
  extract(email: ParsedEmail): Promise<ParsedLmsEmail | null>;
}

const FWD_MARKERS = /^(?:-{5,}\s*Forwarded message\s*-{5,}|Begin forwarded message:|-{3,}\s*Original Message\s*-{3,})\s*$/im;

/** If the student manually forwarded the email, recover the original sender/subject/date. */
export function unwrapForward(e: ParsedEmail): ParsedEmail {
  const m = FWD_MARKERS.exec(e.text);
  if (!m) return e;
  const after = e.text.slice(m.index + m[0].length).replace(/^\s+/, '');
  const hdr: Record<string, string> = {};
  const bodyLines = after.split(/\r?\n/);
  let i = 0;
  for (; i < bodyLines.length && i < 12; i++) {
    const hm = /^\s*>?\s*(From|Date|Sent|Subject|To|Cc)\s*:\s*(.*)$/i.exec(bodyLines[i]!);
    if (hm) hdr[hm[1]!.toLowerCase()] = hm[2]!.trim();
    else if (bodyLines[i]!.trim() === '' && Object.keys(hdr).length) {
      i++;
      break;
    }
  }
  if (!hdr.from) return e;
  const dateStr = hdr.date ?? hdr.sent;
  const d = dateStr ? new Date(dateStr.replace(/ at /i, ' ')) : null;
  return {
    ...e,
    from: hdr.from,
    fromAddress: extractAddress(hdr.from),
    subject: hdr.subject ?? e.subject,
    date: d && !isNaN(d.getTime()) ? d : e.date,
    text: bodyLines.slice(i).join('\n').replace(/^>\s?/gm, ''),
  };
}

export interface ParseLmsEmailOptions {
  studentId: string;
  rules?: EmailRule[];
  tzOffsetMinutes?: number;
  /** fallback clock if the email has no Date header */
  now?: Date;
  /** minimum rule confidence to accept (default 0.5 => generic rule rejected) */
  minConfidence?: number;
}

export function parseLmsEmail(raw: string, opts: ParseLmsEmailOptions): ParsedLmsEmail | null {
  const email = unwrapForward(parseEmail(raw, htmlToText));
  const rules = opts.rules ?? DEFAULT_RULES;
  const min = opts.minConfidence ?? 0.5;
  for (const rule of rules) {
    if (!rule.matches(email)) continue;
    const hit = rule.extract(email);
    if (!hit || hit.confidence < min) continue;
    const reference = email.date ?? opts.now ?? new Date();
    const due_at = hit.kind === 'announcement' || hit.kind === 'note' ? null : findDueDate(email.text, { reference, tzOffsetMinutes: opts.tzOffsetMinutes ?? 240 });
    const idSeed = email.messageId ?? `${email.fromAddress}|${email.subject}|${reference.toISOString()}`;
    const material: NormalizedMaterial = {
      title: hit.title,
      kind: hit.kind,
      body_text: email.text.trim().slice(0, 8000) || null,
      file_url: hit.url,
      due_at,
      source: 'email_forward',
      external_id: `email:${hit.lms}:${createHash('sha256').update(idSeed).digest('hex').slice(0, 32)}`,
      course_external_id: null, // api layer fuzzy-matches courseName to an existing Course
    };
    const task = due_at && (hit.kind === 'assignment' || hit.kind === 'exam') ? taskFromMaterial(opts.studentId, material) : null;
    return { lms: hit.lms, confidence: hit.confidence, courseName: hit.courseName, material, task };
  }
  return null;
}
