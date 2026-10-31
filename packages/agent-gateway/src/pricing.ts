/**
 * Cost accounting in USD from per-1M-token prices, including off-peak discounts.
 */
import type { ModelConfig } from './registry.js';

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
}

/** True if `at` (UTC) falls inside [start, end), handling windows that wrap midnight. */
export function inUtcWindow(at: Date, window: [string, string]): boolean {
  const t = at.getUTCHours() * 60 + at.getUTCMinutes();
  const s = minutes(window[0]);
  const e = minutes(window[1]);
  return s <= e ? t >= s && t < e : t >= s || t < e;
}

export function priceMultiplier(model: ModelConfig, at: Date): number {
  if (model.off_peak && inUtcWindow(at, model.off_peak.window_utc)) return model.off_peak.multiplier;
  return 1;
}

export function costUsd(model: ModelConfig, usage: { input_tokens: number; output_tokens: number }, at: Date): number {
  const mult = priceMultiplier(model, at);
  const raw = (usage.input_tokens / 1e6) * model.price.input_per_m + (usage.output_tokens / 1e6) * model.price.output_per_m;
  return round6(raw * mult);
}

/** Rough token estimate (~4 chars/token EN; Arabic tends higher, so we use 3). AI-LATER: real tokenizer per model. */
export function estimateTokens(text: string): number {
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const other = text.length - arabic;
  return Math.ceil(other / 4 + arabic / 3);
}

export function round6(n: number) {
  return Math.round(n * 1e6) / 1e6;
}
