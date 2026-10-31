import type { ApprovalInfo, ConnectorDeps, SyncContext } from '../../core/connector';
import { getJson, withQuery } from '../../core/http';
import { classifyKind, firstLine, paginate, taskFromMaterial } from '../../core/normalize';
import { OAuthConnector } from '../../core/oauth-connector';
import { emptySyncResult, type NormalizedCourse, type NormalizedMaterial, type SyncResult } from '../../core/types';
import type { TokenSet } from '../../core/vault';
import { googleOAuthConfig, googleRevoke } from './oauth';

export const CLASSROOM_API = 'https://classroom.googleapis.com/v1';

/** Read-only scopes only. Docs: https://developers.google.com/workspace/classroom/guides/auth */
export const CLASSROOM_SCOPES = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.me.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
];

// --- Raw API shapes (subset) -------------------------------------------------
export interface GDate { year?: number; month?: number; day?: number }
export interface GTime { hours?: number; minutes?: number; seconds?: number }
export interface GMaterial {
  driveFile?: { driveFile?: { id?: string; title?: string; alternateLink?: string } };
  youtubeVideo?: { id?: string; title?: string; alternateLink?: string };
  link?: { url?: string; title?: string };
  form?: { formUrl?: string; title?: string };
}
export interface GCourse { id: string; name: string; section?: string; courseState?: string; alternateLink?: string; ownerId?: string }
export interface GCourseWork {
  id: string; courseId: string; title: string; description?: string; state?: string;
  workType?: 'ASSIGNMENT' | 'SHORT_ANSWER_QUESTION' | 'MULTIPLE_CHOICE_QUESTION' | string;
  dueDate?: GDate; dueTime?: GTime; alternateLink?: string; materials?: GMaterial[]; updateTime?: string;
}
export interface GCourseWorkMaterial {
  id: string; courseId: string; title: string; description?: string; state?: string; alternateLink?: string; materials?: GMaterial[];
}
export interface GAnnouncement { id: string; courseId: string; text?: string; state?: string; alternateLink?: string; materials?: GMaterial[]; updateTime?: string }

/** Classroom dueDate/dueTime are in UTC. A due date with no time = end of that UTC day. */
export function classroomDue(d?: GDate, t?: GTime): string | null {
  if (!d?.year || !d.month || !d.day) return null;
  const hasTime = t && (t.hours !== undefined || t.minutes !== undefined);
  const ms = hasTime
    ? Date.UTC(d.year, d.month - 1, d.day, t!.hours ?? 0, t!.minutes ?? 0, t!.seconds ?? 0)
    : Date.UTC(d.year, d.month - 1, d.day, 23, 59, 0);
  return new Date(ms).toISOString();
}

export function firstMaterialUrl(ms?: GMaterial[]): string | null {
  for (const m of ms ?? []) {
    const url = m.driveFile?.driveFile?.alternateLink ?? m.link?.url ?? m.youtubeVideo?.alternateLink ?? m.form?.formUrl;
    if (url) return url;
  }
  return null;
}

// --- Normalizers (pure, unit tested) -----------------------------------------
export function normalizeCourse(studentId: string, c: GCourse): NormalizedCourse {
  return {
    student_id: studentId,
    name: c.section ? `${c.name} (${c.section})` : c.name,
    // Teacher names need classroom.rosters.readonly; deliberately not requested (least privilege).
    teacher: null,
    source: 'google_classroom',
    external_id: c.id,
  };
}

export function normalizeCourseWork(w: GCourseWork): NormalizedMaterial {
  return {
    title: w.title,
    kind: classifyKind(w.title, 'assignment'),
    body_text: w.description ?? null,
    file_url: firstMaterialUrl(w.materials) ?? w.alternateLink ?? null,
    due_at: classroomDue(w.dueDate, w.dueTime),
    source: 'google_classroom',
    external_id: `coursework:${w.id}`,
    course_external_id: w.courseId,
  };
}

export function normalizeCourseWorkMaterial(m: GCourseWorkMaterial): NormalizedMaterial {
  return {
    title: m.title,
    kind: 'note',
    body_text: m.description ?? null,
    file_url: firstMaterialUrl(m.materials) ?? m.alternateLink ?? null,
    due_at: null,
    source: 'google_classroom',
    external_id: `material:${m.id}`,
    course_external_id: m.courseId,
  };
}

export function normalizeAnnouncement(a: GAnnouncement): NormalizedMaterial {
  const text = a.text ?? '';
  return {
    title: firstLine(text) || 'Announcement',
    kind: 'announcement',
    body_text: text || null,
    file_url: firstMaterialUrl(a.materials) ?? a.alternateLink ?? null,
    due_at: null,
    source: 'google_classroom',
    external_id: `announcement:${a.id}`,
    course_external_id: a.courseId,
  };
}

// --- Connector ---------------------------------------------------------------
export class GoogleClassroomConnector extends OAuthConnector {
  readonly provider = 'google_classroom' as const;
  readonly displayName = 'Google Classroom';
  readonly status = 'implemented' as const;
  readonly approval: ApprovalInfo = {
    required: [
      'Google OAuth consent screen verification (Classroom scopes are sensitive)',
      'Google Workspace for Education admin must allow the app (third-party app access; under-18 accounts require the app to be marked Trusted/allowed by the admin)',
    ],
    schoolAdminApproval: true,
    notes: 'Read-only scopes. Teacher names omitted to avoid rosters scope.',
  };

  constructor(deps: ConnectorDeps) {
    super(googleOAuthConfig(deps.env ?? process.env, CLASSROOM_SCOPES), deps);
  }

  private async list<T>(path: string, key: string, headers: Record<string, string>, params: Record<string, string> = {}): Promise<T[]> {
    return paginate<Record<string, unknown>, T>(
      (pageToken) => getJson(withQuery(`${CLASSROOM_API}${path}`, { ...params, pageSize: 100, pageToken }), headers, this.deps.http),
      (p) => p[key] as T[] | undefined,
      (p) => p.nextPageToken as string | undefined,
    );
  }

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const out = emptySyncResult();
    const h = await this.bearer(ctx.tokenRef);
    const courses = await this.list<GCourse>('/courses', 'courses', h, { studentId: 'me', courseStates: 'ACTIVE' });
    for (const c of courses) {
      out.courses.push(normalizeCourse(ctx.studentId, c));
      const id = encodeURIComponent(c.id);
      const [work, mats, anns] = await Promise.all([
        this.list<GCourseWork>(`/courses/${id}/courseWork`, 'courseWork', h, { courseWorkStates: 'PUBLISHED' }),
        this.list<GCourseWorkMaterial>(`/courses/${id}/courseWorkMaterials`, 'courseWorkMaterial', h, { courseWorkMaterialStates: 'PUBLISHED' }),
        this.list<GAnnouncement>(`/courses/${id}/announcements`, 'announcements', h, { announcementStates: 'PUBLISHED' }),
      ]);
      for (const w of work) {
        const m = normalizeCourseWork(w);
        out.materials.push(m);
        if (m.due_at) out.tasks.push(taskFromMaterial(ctx.studentId, m));
      }
      out.materials.push(...mats.map(normalizeCourseWorkMaterial), ...anns.map(normalizeAnnouncement));
    }
    return out;
  }

  protected override async providerRevoke(tokens: TokenSet) {
    await googleRevoke(tokens.refresh_token ?? tokens.access_token, this.deps.http);
    return { providerRevoked: true };
  }
}
