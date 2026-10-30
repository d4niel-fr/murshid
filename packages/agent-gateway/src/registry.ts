/**
 * Model registry + routing table, loaded from config/*.json and validated.
 */
import modelsJson from '../config/models.json' with { type: 'json' };
import routingJson from '../config/routing.json' with { type: 'json' };

export type TaskType = 'router' | 'chat' | 'planning' | 'notes_reading' | 'ocr' | 'cv_essay' | 'arabic' | 'embeddings';
export const TASK_TYPES: TaskType[] = ['router', 'chat', 'planning', 'notes_reading', 'ocr', 'cv_essay', 'arabic', 'embeddings'];

export type Capability = 'chat' | 'json' | 'tools' | 'vision' | 'reasoning' | 'long_context' | 'embeddings';
export type ModelTier = 'cheap' | 'mid' | 'premium' | 'self_hosted';

export interface ProviderConfig {
  kind: 'openai_compatible';
  base_url_env: string;
  api_key_env: string;
  data_region: string;
}

export interface ModelConfig {
  id: string;
  provider: string;
  provider_model: string;
  price: { input_per_m: number; output_per_m: number };
  off_peak?: { window_utc: [string, string]; multiplier: number };
  infra_cost_per_m?: number | null;
  capabilities: Capability[];
  languages: string[];
  context_tokens: number;
  pii_allowed: boolean;
  tier: ModelTier;
}

export interface TaskRoute {
  primary: string;
  fallbacks: string[];
  economy: string;
  capped: string | null;
  contains_pii: boolean;
  requires: Capability[];
  max_output_tokens: number;
}

export interface BudgetConfig {
  default_monthly_cap_usd: number;
  economy_threshold: number;
  cap_threshold: number;
  month_timezone: string;
}

export interface GatewayConfig {
  providers: Record<string, ProviderConfig>;
  models: Record<string, ModelConfig>;
  tasks: Record<TaskType, TaskRoute>;
  budget: BudgetConfig;
}

export class ConfigError extends Error {}

export function buildConfig(models: unknown, routing: unknown): GatewayConfig {
  const m = models as { providers: Record<string, ProviderConfig>; models: ModelConfig[] };
  const r = routing as { tasks: Record<string, TaskRoute>; budget: BudgetConfig };
  const byId: Record<string, ModelConfig> = {};
  for (const model of m.models) {
    if (byId[model.id]) throw new ConfigError(`Duplicate model id ${model.id}`);
    if (!m.providers[model.provider]) throw new ConfigError(`Model ${model.id}: unknown provider ${model.provider}`);
    if (model.price.input_per_m < 0 || model.price.output_per_m < 0) throw new ConfigError(`Model ${model.id}: negative price`);
    byId[model.id] = model;
  }
  for (const t of TASK_TYPES) {
    const route = r.tasks[t];
    if (!route) throw new ConfigError(`Routing missing task ${t}`);
    for (const id of [route.primary, route.economy, ...route.fallbacks, ...(route.capped ? [route.capped] : [])]) {
      const model = byId[id];
      if (!model) throw new ConfigError(`Task ${t}: unknown model ${id}`);
      for (const cap of route.requires) {
        if (!model.capabilities.includes(cap)) throw new ConfigError(`Task ${t}: model ${id} lacks capability ${cap}`);
      }
    }
  }
  if (!(r.budget.economy_threshold > 0 && r.budget.economy_threshold < r.budget.cap_threshold)) {
    throw new ConfigError('Budget thresholds must satisfy 0 < economy < cap');
  }
  return { providers: m.providers, models: byId, tasks: r.tasks as Record<TaskType, TaskRoute>, budget: r.budget };
}

export const defaultConfig: GatewayConfig = buildConfig(modelsJson, routingJson);
