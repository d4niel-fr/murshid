/**
 * The classroom layer on top of assignments: files (teacher attachments, students' photos of their notes),
 * hand-ins with review (mark, return for revision, rubric scores), a private message thread per student per
 * assignment, reminders, class announcements with replies, and rule-based checks that need no AI key.
 *
 * Everything is in memory like the rest of the demo school (one process). Files are served by unguessable id
 * (a capability link) so <img> tags can load them without auth headers.
 */
import { randomBytes } from 'node:crypto';

/* ------------------------------------------------------------------ files */

export type FileKind = 'image' | 'pdf' | 'slides' | 'doc' | 'sheet' | 'text';
export interface StoredFile { id: string; name: string; mime: string; kind: FileKind; size: number; data: Buffer; owner: string; ownerRole: 'student' | 'teacher' | 'school_admin'; at: string }
export interface FileRef { id: string; name: string; mime: string; kind: FileKind; size: number; url: string }

/** Accepted types: what a teacher attaches and what a student hands in. Anything else is refused. */
export const MIME_KIND: Record<string, FileKind> = {
  'image/jpeg': 'image', 'image/png': 'image', 'image/webp': 'image', 'image/gif': 'image',
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'slides', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'slides',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'doc',
  'application/vnd.ms-excel': 'sheet', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'sheet',
  'text/plain': 'text',
};
/** 3 MB per file keeps a base64 upload under the 4.5 MB request limit of serverless hosts. */
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;

const starts = (b: Buffer, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);
/** The bytes must look like the type they claim, so nothing can be served as something it is not. */
export function sniffOk(mime: string, b: Buffer): boolean {
  const kind = MIME_KIND[mime];
  if (!kind || !b.length) return false;
  switch (mime) {
    case 'image/jpeg': return starts(b, [0xff, 0xd8, 0xff]);
    case 'image/png': return starts(b, [0x89, 0x50, 0x4e, 0x47]);
    case 'image/gif': return starts(b, [0x47, 0x49, 0x46, 0x38]);
    case 'image/webp': return starts(b, [0x52, 0x49, 0x46, 0x46]) && starts(b, [0x57, 0x45, 0x42, 0x50], 8);
    case 'application/pdf': return starts(b, [0x25, 0x50, 0x44, 0x46]);
    case 'text/plain': return !b.subarray(0, 4096).includes(0);
    default: // Office files: zip (pptx/docx/xlsx) or the older OLE container (ppt/doc/xls)
      return starts(b, [0x50, 0x4b, 0x03, 0x04]) || starts(b, [0xd0, 0xcf, 0x11, 0xe0]);
  }
}

export const cleanName = (n: string) => n.replace(/[\u0000-\u001f\u007f/\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'file';
export const refOf = (f: StoredFile): FileRef => ({ id: f.id, name: f.name, mime: f.mime, kind: f.kind, size: f.size, url: `/files/${f.id}` });

/* ------------------------------------------------------------------ hand-ins, messages, stream */

export interface RubricCriterion { id: string; label: string; points: number }
export interface LinkRef { url: string; label: string }
export type HandInState = 'handed_in' | 'returned' | 'marked';
export interface HandIn {
  text: string; files: FileRef[]; state: HandInState; late: boolean; submittedAt: string; updatedAt: string; versions: number;
  grade: number | null; scores: Record<string, number> | null; feedback: string | null; reviewedAt: string | null; reviewer: string | null;
}
export interface Message { id: string; from: 'student' | 'teacher'; authorId: string; name: string; text: string; files: FileRef[]; at: string;
  /** set on the note a review leaves in the thread, so apps can word it in the reader's language */
  review?: { action: 'mark' | 'return'; grade: number | null; feedback: string } }
/** read state is a position (messages read so far), so it stays right even when two messages share a timestamp */
export interface Thread { messages: Message[]; seenByStudent: number; seenByTeacher: number }
export interface Reply { id: string; from: 'student' | 'teacher'; authorId: string; name: string; text: string; at: string }
export interface Announcement { id: string; streamId: string; authorId: string; authorName: string; text: string; files: FileRef[]; links: LinkRef[]; pinned: boolean; at: string; replies: Reply[] }
export interface Reminder { id: string; itemId: string; title: string; subject: string; teacherName: string; note: string | null; dueDate: string; at: string; dismissed: boolean }

export class ClassroomStore {
  readonly files = new Map<string, StoredFile>();
  private total = 0;
  /** assignment id -> roster student id -> hand-in */
  readonly handins: Record<string, Record<string, HandIn>> = {};
  /** assignment id -> roster student id -> private thread */
  readonly threads: Record<string, Record<string, Thread>> = {};
  /** class (stream) id -> announcements, newest last */
  readonly announcements: Record<string, Announcement[]> = {};
  /** roster student id -> reminders */
  readonly reminders: Record<string, Reminder[]> = {};
  private seq = 0;

  id(prefix: string) { return `${prefix}_${(++this.seq).toString(36)}${randomBytes(4).toString('hex')}`; }

  putFile(f: Omit<StoredFile, 'id' | 'size'>): StoredFile {
    const file: StoredFile = { ...f, id: randomBytes(18).toString('base64url'), size: f.data.length };
    this.files.set(file.id, file);
    this.total += file.size;
    // keep memory bounded: drop the oldest uploads first
    for (const [id, old] of this.files) {
      if (this.total <= MAX_TOTAL_BYTES) break;
      this.files.delete(id); this.total -= old.size;
    }
    return file;
  }

  thread(itemId: string, studentId: string): Thread {
    return ((this.threads[itemId] ??= {})[studentId] ??= { messages: [], seenByStudent: 0, seenByTeacher: 0 });
  }
}

/* ------------------------------------------------------------------ rules (no AI key needed) */

export const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const shingles = (t: string) => {
  const w = t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const s = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) s.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return s;
};
/** Jaccard similarity of 3-word shingles (0..1). */
export function similarity(a: string, b: string): number {
  const x = shingles(a); const y = shingles(b);
  if (!x.size || !y.size) return 0;
  let both = 0; for (const s of x) if (y.has(s)) both++;
  return both / (x.size + y.size - both);
}

export interface Check { code: 'late' | 'very_short' | 'similar' | 'resubmitted' | 'no_photos'; label: string; tone: 'warning' | 'danger' | 'info' }
/** Plain checks a teacher can trust, computed from the hand-in itself. */
export function checksFor(h: HandIn, others: { name: string; text: string }[], photosRequired: boolean): Check[] {
  const out: Check[] = [];
  if (h.late) out.push({ code: 'late', label: 'Handed in late', tone: 'warning' });
  const n = words(h.text);
  if (!h.files.length && n > 0 && n < 25) out.push({ code: 'very_short', label: `Very short (${n} words, no files)`, tone: 'warning' });
  if (photosRequired && !h.files.some((f) => f.kind === 'image')) out.push({ code: 'no_photos', label: 'No photos of notes', tone: 'warning' });
  if (n >= 40) {
    const match = others.filter((o) => words(o.text) >= 40).map((o) => ({ o, s: similarity(h.text, o.text) })).sort((a, b) => b.s - a.s)[0];
    if (match && match.s >= 0.5) out.push({ code: 'similar', label: `Very similar to ${match.o.name}'s answer (${Math.round(match.s * 100)}% overlap)`, tone: 'danger' });
  }
  if (h.versions > 1) out.push({ code: 'resubmitted', label: `Resubmitted (version ${h.versions})`, tone: 'info' });
  return out;
}

/** A rubric total as a percentage, with each score kept inside its criterion's range. */
export function rubricGrade(rubric: RubricCriterion[], scores: Record<string, number>): { grade: number; scores: Record<string, number> } {
  const clean: Record<string, number> = {};
  let got = 0; let max = 0;
  for (const c of rubric) {
    const v = Math.max(0, Math.min(c.points, Number(scores[c.id] ?? 0)));
    clean[c.id] = v; got += v; max += c.points;
  }
  return { grade: max ? Math.round((got / max) * 100) : 0, scores: clean };
}

/** Late if handed in after the due date and time (Dubai time). */
export function isLate(day: string, minutes: number, dueDate: string, dueTime: string): boolean {
  if (day !== dueDate) return day > dueDate;
  const [h, m] = dueTime.split(':').map(Number);
  return minutes > h! * 60 + m!;
}

/** CSV with quoting where needed (Excel opens it as UTF-8 thanks to the BOM). */
export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : s;
  };
  return `﻿${rows.map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}
