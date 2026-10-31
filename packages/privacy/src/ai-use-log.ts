/**
 * AI-use log per task. Every agent request tied to a task is checked against
 * the task's ai_use_level and logged (decision + intents + model id), giving the
 * student an honest record to support their AI-use declaration.
 *
 * The log stores no prompt or response text — only a SHA-256 of the prompt so
 * a student can prove a specific request if a school asks.
 */
import { createHash, randomUUID } from 'node:crypto';
import { evaluateIntegrity, type IntegrityClassifier, type IntegrityResult } from './integrity.js';
import type { Clock, IsoDateTime, Task, Uuid } from './types.js';
import { systemClock } from './types.js';

export interface AiUseLogEntry {
  id: Uuid;
  student_id: Uuid;
  task_id: Uuid;
  ai_use_level: Task['ai_use_level'];
  decision: IntegrityResult['decision'];
  intents: string[];
  matched_rules: string[];
  declare_ai_use: boolean;
  prompt_sha256: string;
  model_id: string | null; // filled by gateway when a model was actually used
  at: IsoDateTime;
}

export interface AiUseLogStore {
  append(e: AiUseLogEntry): Promise<void>;
  listForTask(taskId: Uuid): Promise<AiUseLogEntry[]>;
  listForStudent(studentId: Uuid): Promise<AiUseLogEntry[]>;
  deleteForStudent(studentId: Uuid): Promise<number>;
}

export class InMemoryAiUseLogStore implements AiUseLogStore {
  entries: AiUseLogEntry[] = [];
  async append(e: AiUseLogEntry) {
    this.entries.push(e);
  }
  async listForTask(taskId: Uuid) {
    return this.entries.filter((e) => e.task_id === taskId);
  }
  async listForStudent(studentId: Uuid) {
    return this.entries.filter((e) => e.student_id === studentId);
  }
  async deleteForStudent(studentId: Uuid) {
    const n = this.entries.length;
    this.entries = this.entries.filter((e) => e.student_id !== studentId);
    return n - this.entries.length;
  }
}

export class AiUseLogger {
  constructor(
    private store: AiUseLogStore,
    private clock: Clock = systemClock,
    private classifier?: IntegrityClassifier,
  ) {}

  /** Check + log. Call before routing to any model. */
  async check(task: Task, prompt: string, modelId: string | null = null): Promise<{ result: IntegrityResult; entry: AiUseLogEntry }> {
    const result = evaluateIntegrity(prompt, task.ai_use_level, this.classifier);
    const entry: AiUseLogEntry = {
      id: randomUUID(),
      student_id: task.student_id,
      task_id: task.id,
      ai_use_level: task.ai_use_level,
      decision: result.decision,
      intents: result.intents,
      matched_rules: result.matchedRules,
      declare_ai_use: result.declareAiUse,
      prompt_sha256: createHash('sha256').update(prompt).digest('hex'),
      model_id: result.decision === 'block' ? null : modelId,
      at: this.clock().toISOString(),
    };
    await this.store.append(entry);
    return { result, entry };
  }

  /** Plain-English declaration the student can paste into a submission. */
  async declaration(task: Task): Promise<string> {
    const used = (await this.store.listForTask(task.id)).filter((e) => e.decision !== 'block');
    if (used.length === 0) return `No AI assistance was used for "${task.title}".`;
    const kinds = new Set(used.flatMap((e) => e.intents));
    const human: Record<string, string> = {
      logistics: 'planning and scheduling',
      explain: 'explaining concepts',
      feedback: 'feedback on my own drafts',
      generate_content: 'drafting suggestions',
      ghostwrite: 'AI-led drafting',
    };
    const list = [...kinds].map((k) => human[k] ?? k).join(', ');
    return `I used Murshid (an AI study coach) for "${task.title}" for: ${list || 'general guidance'}. ${used.length} interaction(s) logged; AI-use level set to "${task.ai_use_level}".`;
  }
}
