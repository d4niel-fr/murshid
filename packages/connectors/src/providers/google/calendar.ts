import type { ApprovalInfo, ConnectorDeps, SyncContext } from '../../core/connector';
import { getJson, sendJson, withQuery } from '../../core/http';
import { paginate } from '../../core/normalize';
import { OAuthConnector } from '../../core/oauth-connector';
import { emptySyncResult, type NormalizedCalendarEvent, type SyncResult } from '../../core/types';
import type { TokenSet } from '../../core/vault';
import { googleOAuthConfig, googleRevoke } from './oauth';

export const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/** calendar.events = read + write events (needed to create study blocks). */
export const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

export interface GEventTime { dateTime?: string; date?: string; timeZone?: string }
export interface GEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  start: GEventTime;
  end: GEventTime;
  extendedProperties?: { private?: Record<string, string> };
}

/**
 * All-day events carry only a date; interpret them in the student's zone
 * (Asia/Dubai = UTC+4, no DST) so the event spans the local day.
 */
export function googleTimeToIso(t: GEventTime, tzOffsetMinutes = 240): string {
  if (t.dateTime) return new Date(t.dateTime).toISOString();
  if (t.date) {
    const [y, m, d] = t.date.split('-').map(Number) as [number, number, number];
    return new Date(Date.UTC(y, m - 1, d) - tzOffsetMinutes * 60_000).toISOString();
  }
  throw new Error('Google event time without date or dateTime');
}

export function normalizeGoogleEvent(studentId: string, e: GEvent, tzOffsetMinutes = 240): NormalizedCalendarEvent | null {
  if (e.status === 'cancelled') return null;
  return {
    student_id: studentId,
    title: e.summary ?? '(no title)',
    start_at: googleTimeToIso(e.start, tzOffsetMinutes),
    end_at: googleTimeToIso(e.end, tzOffsetMinutes),
    source: 'google_calendar',
    external_id: e.id,
  };
}

export interface StudyBlockInput {
  title: string;
  start_at: string; // ISO
  end_at: string; // ISO
  description?: string;
  /** Murshid task id, stored in private extended properties for round-tripping */
  taskId?: string;
  timeZone?: string;
}

export function studyBlockBody(b: StudyBlockInput) {
  return {
    summary: b.title,
    description: b.description ?? 'Study block planned by Murshid',
    start: { dateTime: b.start_at, timeZone: b.timeZone ?? 'Asia/Dubai' },
    end: { dateTime: b.end_at, timeZone: b.timeZone ?? 'Asia/Dubai' },
    reminders: { useDefault: true },
    transparency: 'opaque',
    extendedProperties: { private: { murshid: 'study_block', ...(b.taskId ? { murshid_task_id: b.taskId } : {}) } },
  };
}

export class GoogleCalendarConnector extends OAuthConnector {
  readonly provider = 'google_calendar' as const;
  readonly displayName = 'Google Calendar';
  readonly status = 'implemented' as const;
  readonly approval: ApprovalInfo = {
    required: ['Google OAuth consent screen verification (calendar.events is a sensitive scope)'],
    schoolAdminApproval: false,
    notes: 'For school-managed Google accounts the Workspace admin may still need to allow the app.',
  };

  constructor(deps: ConnectorDeps) {
    super(googleOAuthConfig(deps.env ?? process.env, CALENDAR_SCOPES), deps);
  }

  /** options.windowDays (default 30) forward from now; options.calendarId (default primary). */
  async sync(ctx: SyncContext): Promise<SyncResult> {
    const out = emptySyncResult();
    const now = ctx.now ?? new Date();
    const days = Number(ctx.options?.windowDays ?? 30);
    const calendarId = encodeURIComponent(ctx.options?.calendarId ?? 'primary');
    const h = await this.bearer(ctx.tokenRef);
    const items = await paginate<{ items?: GEvent[]; nextPageToken?: string }, GEvent>(
      (pageToken) =>
        getJson(
          withQuery(`${CALENDAR_API}/calendars/${calendarId}/events`, {
            timeMin: now.toISOString(),
            timeMax: new Date(now.getTime() + days * 86_400_000).toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 250,
            pageToken,
          }),
          h,
          this.deps.http,
        ),
      (p) => p.items,
      (p) => p.nextPageToken,
    );
    for (const e of items) {
      const n = normalizeGoogleEvent(ctx.studentId, e);
      if (n) out.events.push(n);
    }
    return out;
  }

  /** Create a study block on the student's calendar. Returns the normalized event. */
  async createStudyBlock(tokenRef: string, studentId: string, block: StudyBlockInput, calendarId = 'primary'): Promise<NormalizedCalendarEvent> {
    const { data } = await sendJson<GEvent>(
      'POST',
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      studyBlockBody(block),
      await this.bearer(tokenRef),
      this.deps.http,
    );
    return normalizeGoogleEvent(studentId, data)!;
  }

  protected override async providerRevoke(tokens: TokenSet) {
    await googleRevoke(tokens.refresh_token ?? tokens.access_token, this.deps.http);
    return { providerRevoked: true };
  }
}
