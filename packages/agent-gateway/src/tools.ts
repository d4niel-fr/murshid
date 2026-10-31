/**
 * Tool registry: functions the agent may call. Tools are implemented by other
 * packages (connectors / opportunities / documents / notify); this package
 * only defines the interface, registry, consent gating and OpenAI tool export.
 */
import type { OpenAITool } from './provider.js';

export type ToolDomain = 'connectors' | 'opportunities' | 'documents' | 'notify';

/** Consent purpose ids (mirror @murshid/privacy ConsentPurposeId). */
export type ConsentPurposeId = 'core_service' | 'school_connector' | 'guardian_summaries' | 'notifications' | 'opportunity_sharing_universities';

export interface ToolContext {
  studentId: string;
  consent: Partial<Record<ConsentPurposeId, boolean>>;
  /** Writes AuditLog rows (privacy AuditWriter adapter). */
  audit?: (entry: { action: string; resource: string; allowed: boolean; reason: string }) => Promise<void>;
}

export interface ToolDefinition<A = Record<string, unknown>, R = unknown> {
  name: string; // "<domain>.<verb>", e.g. "connectors.list_upcoming"
  domain: ToolDomain;
  description: string;
  /** JSON Schema for arguments. */
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
  requiredConsent: ConsentPurposeId[];
  /** Side-effecting tools need explicit student confirmation in UI before running. */
  sideEffect: boolean;
  handler: (args: A, ctx: ToolContext) => Promise<R>;
}

export class ToolError extends Error {
  constructor(
    public code: 'unknown_tool' | 'consent_missing' | 'invalid_args' | 'needs_confirmation',
    message: string,
  ) {
    super(message);
    this.name = 'ToolError';
  }
}

export interface ToolRegistry {
  register(tool: ToolDefinition<any, any>): void;
  get(name: string): ToolDefinition<any, any> | undefined;
  list(): ToolDefinition<any, any>[];
  /** Tools whose consents are all granted, in OpenAI `tools` format. */
  available(ctx: Pick<ToolContext, 'consent'>): OpenAITool[];
  invoke(name: string, args: Record<string, unknown>, ctx: ToolContext, opts?: { confirmed?: boolean }): Promise<unknown>;
}

const NAME_RE = /^(connectors|opportunities|documents|notify)\.[a-z_]+$/;

export class InMemoryToolRegistry implements ToolRegistry {
  private tools = new Map<string, ToolDefinition<any, any>>();

  register(tool: ToolDefinition<any, any>) {
    if (!NAME_RE.test(tool.name) || !tool.name.startsWith(`${tool.domain}.`)) throw new Error(`Bad tool name ${tool.name}`);
    if (this.tools.has(tool.name)) throw new Error(`Duplicate tool ${tool.name}`);
    this.tools.set(tool.name, tool);
  }
  get(name: string) {
    return this.tools.get(name);
  }
  list() {
    return [...this.tools.values()];
  }
  available(ctx: Pick<ToolContext, 'consent'>): OpenAITool[] {
    return this.list()
      .filter((t) => t.requiredConsent.every((p) => ctx.consent[p]))
      .map((t) => ({
        type: 'function' as const,
        // OpenAI function names can't contain dots.
        function: { name: t.name.replace('.', '__'), description: t.description, parameters: t.parameters },
      }));
  }

  async invoke(name: string, args: Record<string, unknown>, ctx: ToolContext, opts: { confirmed?: boolean } = {}) {
    const tool = this.tools.get(name) ?? this.tools.get(name.replace('__', '.'));
    if (!tool) throw new ToolError('unknown_tool', `Unknown tool ${name}`);
    const missing = tool.requiredConsent.filter((p) => !ctx.consent[p]);
    if (missing.length) {
      await ctx.audit?.({ action: `tool:${tool.name}`, resource: tool.domain, allowed: false, reason: `consent missing: ${missing.join(',')}` });
      throw new ToolError('consent_missing', `Missing consent: ${missing.join(', ')}`);
    }
    for (const req of tool.parameters.required ?? []) {
      if (args[req] === undefined) throw new ToolError('invalid_args', `Missing argument ${req}`);
    }
    if (tool.sideEffect && !opts.confirmed) throw new ToolError('needs_confirmation', `${tool.name} needs the student's confirmation`);
    await ctx.audit?.({ action: `tool:${tool.name}`, resource: tool.domain, allowed: true, reason: 'consented' });
    return tool.handler(args, ctx);
  }
}

/** Stub declarations matching what other teams will implement. Handlers return mock data. */
export function registerStubTools(reg: ToolRegistry) {
  reg.register({
    name: 'connectors.list_upcoming',
    domain: 'connectors',
    description: "List the student's upcoming assignments, exams and events from connected school systems.",
    parameters: { type: 'object', properties: { days: { type: 'integer', minimum: 1, maximum: 60 } }, required: ['days'] },
    requiredConsent: ['core_service', 'school_connector'],
    sideEffect: false,
    handler: async () => ({ items: [], stub: true }),
  });
  reg.register({
    name: 'opportunities.search',
    domain: 'opportunities',
    description: 'Search competitions, internships, scholarships and programmes that fit the student (grade, emirate, interests).',
    parameters: { type: 'object', properties: { query: { type: 'string' }, type: { type: 'string' } }, required: ['query'] },
    requiredConsent: ['core_service'],
    sideEffect: false,
    handler: async () => ({ results: [], stub: true }),
  });
  reg.register({
    name: 'documents.render_cv',
    domain: 'documents',
    description: "Render the student's CV to PDF from their achievements and profile.",
    parameters: { type: 'object', properties: { target: { type: 'string', enum: ['general', 'university', 'internship'] } }, required: ['target'] },
    requiredConsent: ['core_service'],
    sideEffect: true,
    handler: async () => ({ pdf_url: null, stub: true }),
  });
  reg.register({
    name: 'notify.create_reminder',
    domain: 'notify',
    description: 'Schedule a reminder for the student.',
    parameters: { type: 'object', properties: { text: { type: 'string' }, at: { type: 'string', format: 'date-time' } }, required: ['text'] },
    requiredConsent: ['core_service', 'notifications'],
    sideEffect: true,
    handler: async () => ({ scheduled: false, stub: true }),
  });
}
