/**
 * Per-student monthly budget caps + cost ledger.
 *
 * Tiers:
 *   normal  - spent < economy_threshold × cap   → task primary model
 *   economy - spent ≥ economy_threshold × cap   → task economy model
 *   capped  - spent ≥ cap_threshold × cap       → task capped model (self-hosted) or no model
 * Months are calendar months in Asia/Dubai.
 */
import type { BudgetConfig, TaskType } from './registry.js';
import { round6 } from './pricing.js';

export type BudgetTier = 'normal' | 'economy' | 'capped';

export interface UsageRecord {
  student_id: string;
  month: string; // YYYY-MM (Asia/Dubai)
  at: string;
  task: TaskType;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface BudgetState {
  studentId: string;
  month: string;
  capUsd: number;
  spentUsd: number;
  remainingUsd: number;
  ratio: number;
  tier: BudgetTier;
}

export interface UsageStore {
  append(r: UsageRecord): Promise<void>;
  spent(studentId: string, month: string): Promise<number>;
  list(studentId: string, month: string): Promise<UsageRecord[]>;
}

export class InMemoryUsageStore implements UsageStore {
  records: UsageRecord[] = [];
  async append(r: UsageRecord) {
    this.records.push(r);
  }
  async spent(studentId: string, month: string) {
    return round6(this.records.filter((r) => r.student_id === studentId && r.month === month).reduce((s, r) => s + r.cost_usd, 0));
  }
  async list(studentId: string, month: string) {
    return this.records.filter((r) => r.student_id === studentId && r.month === month);
  }
}

export function monthKey(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(at);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  return `${y}-${m}`;
}

export function tierFor(ratio: number, cfg: BudgetConfig): BudgetTier {
  if (ratio >= cfg.cap_threshold) return 'capped';
  if (ratio >= cfg.economy_threshold) return 'economy';
  return 'normal';
}

export class BudgetLedger {
  private overrides = new Map<string, number>();

  constructor(
    private cfg: BudgetConfig,
    private store: UsageStore = new InMemoryUsageStore(),
  ) {}

  /** Per-student cap override (e.g. school-sponsored plan). */
  setCap(studentId: string, capUsd: number) {
    this.overrides.set(studentId, capUsd);
  }

  capFor(studentId: string) {
    return this.overrides.get(studentId) ?? this.cfg.default_monthly_cap_usd;
  }

  async state(studentId: string, at: Date): Promise<BudgetState> {
    const month = monthKey(at, this.cfg.month_timezone);
    const capUsd = this.capFor(studentId);
    const spentUsd = await this.store.spent(studentId, month);
    const ratio = capUsd > 0 ? spentUsd / capUsd : 1;
    return { studentId, month, capUsd, spentUsd, remainingUsd: round6(Math.max(0, capUsd - spentUsd)), ratio, tier: tierFor(ratio, this.cfg) };
  }

  /** The tier a call would land in if it cost `projectedUsd` more. */
  tierAfter(state: BudgetState, projectedUsd: number): BudgetTier {
    const ratio = state.capUsd > 0 ? (state.spentUsd + projectedUsd) / state.capUsd : 1;
    return tierFor(ratio, this.cfg);
  }

  async record(r: Omit<UsageRecord, 'month'>, at: Date) {
    await this.store.append({ ...r, month: monthKey(at, this.cfg.month_timezone) });
  }

  async report(studentId: string, at: Date) {
    const month = monthKey(at, this.cfg.month_timezone);
    const rows = await this.store.list(studentId, month);
    const byModel: Record<string, number> = {};
    const byTask: Record<string, number> = {};
    for (const r of rows) {
      byModel[r.model_id] = round6((byModel[r.model_id] ?? 0) + r.cost_usd);
      byTask[r.task] = round6((byTask[r.task] ?? 0) + r.cost_usd);
    }
    return { ...(await this.state(studentId, at)), calls: rows.length, byModel, byTask };
  }
}
