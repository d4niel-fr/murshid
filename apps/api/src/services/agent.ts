/**
 * AI-LATER: the real agent lives behind packages/agent-gateway (model routing). This interface is
 * what /agent/chat calls; the only implementation today is a deterministic keyword router that
 * never calls a model.
 */
export interface AgentContext {
  studentName: string;
  openTasks: number;
  dueThisWeek: { title: string; due_at: string | null }[];
  topOpportunity: { title: string; score: number } | null;
}

export interface AgentReply {
  reply: string;
  intent: 'plan' | 'deadlines' | 'opportunities' | 'cv' | 'greeting' | 'unknown';
  suggested_actions: { label: string; method: string; path: string }[];
  ai: false;
  stub: true;
}

export interface AgentService {
  chat(message: string, ctx: AgentContext): Promise<AgentReply>;
}

// AI-LATER: replace with gateway-backed implementation.
export const stubAgent: AgentService = {
  async chat(message, ctx) {
    const m = message.toLowerCase();
    const base = { ai: false as const, stub: true as const };
    if (/\b(due|deadline|homework|assignment)\b/.test(m)) {
      const list = ctx.dueThisWeek.slice(0, 5).map((t) => t.title).join(', ');
      return { ...base, intent: 'deadlines',
        reply: ctx.dueThisWeek.length ? `Due this week: ${list}.` : 'Nothing is due this week.',
        suggested_actions: [{ label: 'Open tasks', method: 'GET', path: '/tasks?status=todo' }] };
    }
    if (/\b(plan|schedule|week|timetable|study time)\b/.test(m)) {
      return { ...base, intent: 'plan', reply: `I can lay out your week, ${ctx.studentName}. You have ${ctx.openTasks} open tasks.`,
        suggested_actions: [{ label: 'See weekly plan', method: 'GET', path: '/planner/week' }] };
    }
    if (/\b(opportunit|competition|internship|scholarship|olympiad|mun|hackathon|summer)\w*/.test(m)) {
      return { ...base, intent: 'opportunities',
        reply: ctx.topOpportunity ? `Your best match right now is "${ctx.topOpportunity.title}" (${ctx.topOpportunity.score}%).` : 'I have no strong matches yet — add some interests to your profile.',
        suggested_actions: [{ label: 'Browse matches', method: 'GET', path: '/opportunities?sort=score' }] };
    }
    if (/\b(cv|resume|résumé)\b/.test(m)) {
      return { ...base, intent: 'cv', reply: 'I can build a CV version from your profile and achievements.',
        suggested_actions: [{ label: 'Create CV', method: 'POST', path: '/cv' }] };
    }
    if (/^(hi|hello|hey|salam|marhaba)\b/.test(m)) {
      return { ...base, intent: 'greeting', reply: `Hi ${ctx.studentName}! Ask me about your week, deadlines, or opportunities.`, suggested_actions: [] };
    }
    return { ...base, intent: 'unknown', reply: 'The Murshid assistant is not switched on yet. Try asking about your plan, deadlines, or opportunities.', suggested_actions: [] };
  },
};
