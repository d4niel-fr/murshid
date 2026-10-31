import type { WhatsAppTemplateSpec } from './channels/adapters.js';
import type { EmailContent, InAppContent, PushContent, WhatsAppContent } from './channels/types.js';
import { escapeHtml, fmtLocal, truncate, whenPhrase } from './format.js';

/**
 * WhatsApp templates must be created and approved in Meta Business Manager with these exact
 * names, UTILITY category and parameter counts (see README for the body text to submit).
 */
export const WHATSAPP_TEMPLATES: Record<string, WhatsAppTemplateSpec> = {
  murshid_task_reminder: { name: 'murshid_task_reminder', category: 'UTILITY', params: 3 },
  murshid_application_deadline: { name: 'murshid_application_deadline', category: 'UTILITY', params: 4 },
  murshid_weekly_briefing: { name: 'murshid_weekly_briefing', category: 'UTILITY', params: 6 },
};

export interface RenderedContent {
  push: PushContent;
  email: EmailContent;
  whatsapp: WhatsAppContent;
  inApp: InAppContent;
}

export interface TaskReminderPayload {
  firstName: string;
  taskId: string;
  taskTitle: string;
  dueAt: string;
  /** '48h' | '24h' | '2h' — the rule that produced it (for analytics). */
  offset: string;
  /** Actual send time (after quiet-hours placement); wording is computed from it. */
  sendAt: string;
  timeZone?: string;
}

export function emailShell(title: string, inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#1b1f24">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;border:1px solid #e3e6ea">
<tr><td style="padding:20px 24px;border-bottom:3px solid #1f3a5f"><div style="font-size:12px;letter-spacing:.08em;color:#1f3a5f;text-transform:uppercase">Murshid</div>
<div style="font-size:20px;font-weight:bold;margin-top:4px">${escapeHtml(title)}</div></td></tr>
<tr><td style="padding:20px 24px;font-size:15px;line-height:1.55">${inner}</td></tr>
<tr><td style="padding:14px 24px;font-size:12px;color:#6b7480;border-top:1px solid #e3e6ea">You get this because reminders are on in Murshid. Change channels or quiet hours in Settings &gt; Notifications.</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderTaskReminder(p: TaskReminderPayload): RenderedContent {
  const tz = p.timeZone ?? 'Asia/Dubai';
  const when = whenPhrase(p.dueAt, new Date(p.sendAt), tz);
  const due = fmtLocal(p.dueAt, tz);
  const title = `Due ${when}`;
  const body = truncate(`${p.taskTitle} is due ${due}.`, 178);
  return {
    push: { title, body, data: { taskId: p.taskId, url: `murshid://tasks/${p.taskId}` } },
    email: {
      subject: `Reminder: ${truncate(p.taskTitle, 60)} is due ${when}`,
      html: emailShell(title, `<p>Hi ${escapeHtml(p.firstName)},</p><p><strong>${escapeHtml(p.taskTitle)}</strong> is due <strong>${escapeHtml(due)}</strong> (Dubai time).</p><p>Open Murshid to plan a study block for it.</p>`),
      text: `Hi ${p.firstName},\n\n${p.taskTitle} is due ${due} (Dubai time).\n\nOpen Murshid to plan a study block for it.`,
    },
    whatsapp: { template: 'murshid_task_reminder', language: 'en', bodyParams: [p.firstName, p.taskTitle, due] },
    inApp: { title, body, link: `/tasks/${p.taskId}` },
  };
}

export interface DeadlinePayload {
  firstName: string;
  applicationId: string;
  opportunityTitle: string;
  deadline: string;
  daysLeft: number;
  /** Actual send time; when given, wording is computed from it instead of daysLeft. */
  sendAt?: string;
  checklistDone: number;
  checklistTotal: number;
  timeZone?: string;
}

export function renderApplicationDeadline(p: DeadlinePayload): RenderedContent {
  const tz = p.timeZone ?? 'Asia/Dubai';
  const due = fmtLocal(p.deadline, tz);
  const left = p.sendAt
    ? whenPhrase(p.deadline, new Date(p.sendAt), tz)
    : p.daysLeft <= 0 ? 'today' : p.daysLeft === 1 ? 'tomorrow' : `in ${p.daysLeft} days`;
  const progress = `${p.checklistDone}/${p.checklistTotal} checklist items done`;
  const title = `Deadline ${left}`;
  const body = truncate(`${p.opportunityTitle} closes ${due}. ${progress}.`, 178);
  return {
    push: { title, body, data: { applicationId: p.applicationId, url: `murshid://applications/${p.applicationId}` } },
    email: {
      subject: `${truncate(p.opportunityTitle, 60)} closes ${left}`,
      html: emailShell(title, `<p>Hi ${escapeHtml(p.firstName)},</p><p><strong>${escapeHtml(p.opportunityTitle)}</strong> closes <strong>${escapeHtml(due)}</strong> (Dubai time).</p><p>${escapeHtml(progress)}.</p>`),
      text: `Hi ${p.firstName},\n\n${p.opportunityTitle} closes ${due} (Dubai time).\n${progress}.`,
    },
    whatsapp: {
      template: 'murshid_application_deadline',
      language: 'en',
      bodyParams: [p.firstName, p.opportunityTitle, due, progress],
    },
    inApp: { title, body, link: `/applications/${p.applicationId}` },
  };
}
