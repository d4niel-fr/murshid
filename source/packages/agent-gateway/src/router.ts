/**
 * Model router: task + budget tier + constraints → ordered candidate models.
 *
 * Order of candidates:
 *   normal  : primary, then fallbacks
 *   economy : economy model, then fallbacks cheaper than or equal to it
 *   capped  : capped model only (null → no model allowed)
 * Then filtered by: PII policy (pii_allowed), required capabilities,
 * provider health, and context window.
 */
import type { BudgetTier } from './budget.js';
import type { GatewayConfig, ModelConfig, TaskType } from './registry.js';

export interface RouteConstraints {
  tier: BudgetTier;
  containsPii?: boolean; // default from routing table
  unhealthy?: Set<string>; // model ids currently failing
  estimatedInputTokens?: number;
}

export interface RouteDecision {
  task: TaskType;
  tier: BudgetTier;
  candidates: string[];
  excluded: { model: string; reason: string }[];
}

/** Blended price used to order "cheaper" models (assumes 3:1 input:output). */
export function blendedPrice(m: ModelConfig): number {
  return (3 * m.price.input_per_m + m.price.output_per_m) / 4;
}

export function selectModels(cfg: GatewayConfig, task: TaskType, c: RouteConstraints): RouteDecision {
  const route = cfg.tasks[task];
  const pii = c.containsPii ?? route.contains_pii;
  let ordered: string[];

  if (c.tier === 'capped') {
    ordered = route.capped ? [route.capped] : [];
  } else if (c.tier === 'economy') {
    const econ = cfg.models[route.economy]!;
    const cheaperFallbacks = [route.primary, ...route.fallbacks].filter((id) => blendedPrice(cfg.models[id]!) <= blendedPrice(econ));
    ordered = [route.economy, ...cheaperFallbacks];
  } else {
    ordered = [route.primary, ...route.fallbacks];
  }
  ordered = [...new Set(ordered)];

  const excluded: RouteDecision['excluded'] = [];
  const candidates = ordered.filter((id) => {
    const m = cfg.models[id]!;
    if (pii && !m.pii_allowed) return void excluded.push({ model: id, reason: 'pii_not_allowed' }), false;
    if (!route.requires.every((cap) => m.capabilities.includes(cap))) return void excluded.push({ model: id, reason: 'missing_capability' }), false;
    if (c.unhealthy?.has(id)) return void excluded.push({ model: id, reason: 'unhealthy' }), false;
    if (c.estimatedInputTokens && c.estimatedInputTokens + route.max_output_tokens > m.context_tokens) {
      return void excluded.push({ model: id, reason: 'context_too_small' }), false;
    }
    return true;
  });

  return { task, tier: c.tier, candidates, excluded };
}
