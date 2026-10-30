/**
 * Policy engine: `can(actor, action, resource, ctx)`.
 *
 * Pure function, deny-by-default. Mirrors the RLS rules in the contract so the
 * API layer can make the same decision before touching the DB (defence in depth).
 * Every decision carries a reason string for the audit log.
 */
import type { ConsentPurposeId, ConsentSnapshot } from './consent.js';
import type { Uuid } from './types.js';

export type Actor =
  | { role: 'student'; id: Uuid; studentId: Uuid }
  | { role: 'guardian'; id: Uuid; studentId: Uuid; verified: boolean }
  | { role: 'counsellor'; id: Uuid; schoolId: Uuid }
  | { role: 'service'; id: string; service: ServiceName };

/** Back-end callers. Each acts on one student at a time. */
export type ServiceName = 'connector' | 'agent' | 'notify' | 'opportunities' | 'documents' | 'scheduler';

export type Action =
  | 'read'
  | 'write'
  | 'delete'
  | 'export'
  | 'read_summary'
  | 'manage_consent'
  | 'connect'
  | 'notify'
  | 'share_external';

export type ResourceType =
  | 'student_profile'
  | 'goal'
  | 'task'
  | 'material'
  | 'course'
  | 'calendar_event'
  | 'application'
  | 'achievement'
  | 'cv'
  | 'notification'
  | 'connection'
  | 'consent'
  | 'audit_log'
  | 'ai_use_log'
  | 'weekly_summary';

export interface Resource {
  type: ResourceType;
  studentId: Uuid;
  schoolId?: Uuid;
}

export interface PolicyContext {
  /** Effective consent for resource.studentId. */
  consent: ConsentSnapshot;
  isMinor: boolean;
  /** For notify: who receives it. */
  notifyRecipient?: 'student' | 'guardian' | 'other';
}

export interface Decision {
  allowed: boolean;
  reason: string;
  /** Consent purpose the decision depended on, if any. */
  purpose?: ConsentPurposeId;
}

const allow = (reason: string, purpose?: ConsentPurposeId): Decision => ({ allowed: true, reason, ...(purpose ? { purpose } : {}) });
const deny = (reason: string, purpose?: ConsentPurposeId): Decision => ({ allowed: false, reason, ...(purpose ? { purpose } : {}) });

/** Which consent each service needs for which resources. */
const SERVICE_RULES: Record<ServiceName, { actions: Action[]; resources: ResourceType[] | '*'; purpose: ConsentPurposeId }> = {
  connector: {
    actions: ['read', 'write', 'connect'],
    resources: ['course', 'material', 'calendar_event', 'task', 'connection'],
    purpose: 'school_connector',
  },
  agent: {
    actions: ['read', 'write'],
    resources: ['student_profile', 'goal', 'task', 'material', 'course', 'calendar_event', 'application', 'achievement', 'cv', 'ai_use_log'],
    purpose: 'core_service',
  },
  notify: { actions: ['notify', 'read', 'write'], resources: ['notification'], purpose: 'notifications' },
  opportunities: { actions: ['read', 'write'], resources: ['application', 'student_profile'], purpose: 'core_service' },
  documents: { actions: ['read', 'write'], resources: ['cv', 'achievement', 'student_profile'], purpose: 'core_service' },
  scheduler: { actions: ['read', 'notify'], resources: ['task', 'calendar_event', 'goal', 'weekly_summary'], purpose: 'core_service' },
};

export function can(actor: Actor, action: Action, resource: Resource, ctx: PolicyContext): Decision {
  const c = ctx.consent;

  // Sharing outside Murshid needs its own purpose, whoever asks.
  if (action === 'share_external') {
    if (actor.role === 'counsellor') return deny('counsellors cannot share student data externally');
    if (actor.role === 'guardian') return deny('only the student (with consent) can share externally');
    if (!c.opportunity_sharing_universities) return deny('no consent to share with universities', 'opportunity_sharing_universities');
    if (actor.role === 'student' && actor.studentId === resource.studentId) return allow('student sharing own data with consent', 'opportunity_sharing_universities');
    if (actor.role === 'service' && actor.service === 'opportunities') return allow('opportunities service with sharing consent', 'opportunity_sharing_universities');
    return deny('not permitted to share');
  }

  switch (actor.role) {
    case 'student': {
      if (actor.studentId !== resource.studentId) return deny('students can only access their own data');
      // Rights of access, export, erasure and consent management are never consent-gated.
      if (['export', 'delete', 'manage_consent'].includes(action)) return allow('data-subject right');
      if (resource.type === 'audit_log' && action === 'read') return allow('student may read own access log');
      if (action === 'connect') {
        if (!c.school_connector) return deny('school connector consent missing', 'school_connector');
        return allow('own connection with consent', 'school_connector');
      }
      if (action === 'notify') {
        if (!c.notifications) return deny('notification consent missing', 'notifications');
        return allow('own notifications', 'notifications');
      }
      if (!c.core_service) return deny('core service consent missing', 'core_service');
      return allow('own data', 'core_service');
    }

    case 'guardian': {
      if (actor.studentId !== resource.studentId) return deny('guardian not linked to this student');
      if (!actor.verified) return deny('guardian not verified');
      if (action === 'manage_consent') return allow('linked verified guardian manages consent');
      if (action === 'delete' && ctx.isMinor) return allow('guardian may request erasure for a minor');
      if (action === 'export' && ctx.isMinor) return allow('guardian may request a copy for a minor');
      if (action === 'read_summary' && resource.type === 'weekly_summary') {
        if (!c.guardian_summaries) return deny('guardian summaries consent missing', 'guardian_summaries');
        return allow('summary view', 'guardian_summaries');
      }
      return deny('guardians see summary views only');
    }

    case 'counsellor': {
      if (!resource.schoolId || resource.schoolId !== actor.schoolId) return deny('student is not at counsellor school');
      if (action !== 'read_summary') return deny('counsellors have summary read access only');
      if (resource.type !== 'weekly_summary' && resource.type !== 'application') return deny('counsellors see summaries and applications only');
      // Counsellor visibility rides on the school connector consent (student opted into the school link).
      if (!c.school_connector) return deny('student has not consented to school link', 'school_connector');
      return allow('counsellor summary for consenting student at same school', 'school_connector');
    }

    case 'service': {
      const rule = SERVICE_RULES[actor.service];
      if (!rule.actions.includes(action)) return deny(`${actor.service} may not ${action}`);
      if (rule.resources !== '*' && !rule.resources.includes(resource.type)) return deny(`${actor.service} may not touch ${resource.type}`);
      if (!c.core_service) return deny('core service consent missing', 'core_service');
      if (!c[rule.purpose]) return deny(`${rule.purpose} consent missing`, rule.purpose);
      if (action === 'notify' && ctx.notifyRecipient && ctx.notifyRecipient !== 'student') {
        // Contract: under-18 needs guardian consent before notifying anyone but the student.
        if (ctx.notifyRecipient === 'guardian') {
          if (!c.guardian_summaries) return deny('guardian summaries consent missing', 'guardian_summaries');
          return allow('guardian summary notification', 'guardian_summaries');
        }
        return deny('notifications to third parties are not allowed');
      }
      return allow(`${actor.service} with ${rule.purpose} consent`, rule.purpose);
    }
  }
}
