# @murshid/agent-gateway

The multi-model orchestration skeleton for Murshid. **It makes no live AI calls in this phase**: the only provider is `MockProvider`, which returns canned replies with estimated token usage so routing, fallbacks and cost accounting can all be tested offline.

```
request → rule-based pre-router ─┬─ canned reply (greeting/thanks)           no model
                                 ├─ tool call (what's due, remind me, find…)  no model
                                 └─ task type → integrity hook (task-linked)
                                               → budget tier (normal/economy/capped)
                                               → model candidates (PII, capability, health, context filters)
                                               → provider.chat with fallbacks → cost ledger
```

## Contents
| Path | What |
|---|---|
| `config/models.json` | Providers and models with USD prices per 1M tokens (input/output): GPT-6 Luna 0.10/0.50 · DeepSeek V4.1-Flash 0.30/1.20 (off-peak ×0.5) · DeepSeek V4-Pro 1.32/3.96 · Gemini 3.1 Flash-Lite 0.25/1.50 · Claude Haiku 5.5 0.10/0.50 · Claude Sonnet 5.5 2/10 · Falcon-H1-Arabic self-hosted 0/0 · `murshid-embed` self-hosted placeholder. Each model also lists its capabilities, context size, `pii_allowed` and tier. |
| `config/routing.json` | Task → model routes, plus budget thresholds (see table below). |
| `config/litellm.config.yaml` | LiteLLM proxy example: same model ids, per-token costs, fallbacks, prompt logging off. |
| `config/openrouter.example.json` | OpenRouter mapping example (`data_collection: deny`). |
| `src/registry.ts` | Loads and **validates** config: unknown models, missing capabilities and bad thresholds fail at import. |
| `src/pre-router.ts` | Keyword and intent rules that run before any model (EN + AR). |
| `src/router.ts` | `selectModels(cfg, task, {tier, containsPii, unhealthy, estimatedInputTokens})`. |
| `src/budget.ts` | `BudgetLedger`: per-student monthly cap (default $1.00, per-student override), calendar months in Asia/Dubai, tiers, usage ledger, report by model and task. |
| `src/pricing.ts` | Cost from per-1M prices, off-peak window (wraps midnight), token estimate. |
| `src/provider.ts` | OpenAI-compatible Chat Completions types, `ChatProvider` interface, `ProviderError`, `MockProvider` (canned rules, simulated outages via `failModels`, deterministic embeddings). |
| `src/tools.ts` | `ToolRegistry` interface + `InMemoryToolRegistry`. Tools are named `<domain>.<verb>` (connectors / opportunities / documents / notify), gated by consent, need confirmation for side-effects, write audit entries, and export in OpenAI `tools` format. `registerStubTools` declares 4 stubs. |
| `src/gateway.ts` | `Gateway.complete()` ties it together: integrity hook, pre-flight budget downgrade, fallbacks with a simple circuit breaker, pseudonymous `user` field. |
| `prompts/system.murshid.md` | Murshid persona: **coach, not ghostwriter**, AI-use levels, safety for minors. |
| `prompts/tasks/*.md` | router, planning, notes_reading, ocr, cv_essay, arabic templates (`{{var}}`, missing vars throw). |

### Routing table
| Task | Primary | Fallbacks | Economy (≥80% of cap) | Capped (≥100%) |
|---|---|---|---|---|
| router | GPT-6 Luna | Haiku 5.5, Gemini FL | Luna | none (rules only) |
| chat | Claude Haiku 5.5 | Luna, Gemini FL | Luna | Falcon-H1-Arabic |
| planning | Claude Sonnet 5.5 | DeepSeek V4-Pro*, Haiku, Luna | Haiku | none |
| notes_reading | Gemini 3.1 Flash-Lite | DeepSeek V4.1-Flash*, Haiku | DeepSeek Flash* | none |
| ocr | Gemini 3.1 Flash-Lite | Luna, Haiku | Gemini FL | none |
| cv_essay | Claude Sonnet 5.5 | DeepSeek V4-Pro*, Haiku | Haiku | none |
| arabic | Falcon-H1-Arabic | Haiku, Gemini FL | Falcon | Falcon |
| embeddings | murshid-embed | none | same | same |

\* DeepSeek models are `pii_allowed: false` (data region CN). They're skipped whenever a request contains student personal data (the per-task default is in `contains_pii`, and callers can override it with `containsPii`). In practice they're used only for non-personal content like class notes. For notes_reading in economy mode, if the request is flagged as PII, it falls through to Haiku.

**Budget behaviour:** below 80% of the cap, the primary model is used. From 80%, the economy model (plus any fallbacks no more expensive than it). From 100%, only the zero-marginal-cost self-hosted model, or a friendly "allowance used" message. There's also a **pre-flight check**: if one call's worst-case cost (input estimate + `max_output_tokens`) would cross a threshold, the gateway steps down one tier first.

## Run
```bash
pnpm install --filter @murshid/agent-gateway
cd packages/agent-gateway && pnpm test && pnpm typecheck
```
31 vitest tests, no network.

## Env vars
See `.env.example`. Tests need none. `GATEWAY_MODE` is `mock` (the only mode implemented). Provider keys and base URLs, `SELF_HOSTED_BASE_URL` (Falcon and the embedder), `LITELLM_*` and `OPENROUTER_API_KEY` are listed for later.

## AI-LATER
- `OpenAICompatibleProvider` (HTTP to LiteLLM, OpenRouter or a direct provider). Not implemented, so no call path exists.
- `router` task: model-based intent classification when no rule matches (unmatched requests currently go to `chat`).
- Real tokenizers in place of `estimateTokens`.
- Reminder time parsing (`R-REMIND` currently passes the raw text to the notify tool).

## Assumptions to confirm
- Model ids and prices come from the brief; **provider slugs are placeholders**. Check them against provider pricing pages before launch.
- The DeepSeek off-peak window is set to 16:30–00:30 UTC, based on DeepSeek's historical discount hours, and is configurable.
- Capabilities (e.g. vision on Luna, Haiku and Gemini; long context on Gemini) are assumptions for routing validation.
- No embedding model was named in the brief, so `murshid-embed` is a self-hosted bge-m3 placeholder.
- The default $1.00 per student per month cap and the 80%/100% thresholds are placeholders for the business to set.
- Falcon's infra cost isn't counted per token (`infra_cost_per_m: null`).

## Integration notes
- **@murshid/privacy:** pass `integrity: ({taskId, text}) => aiUseLogger.check(task, text).then(r => r.result)` to `Gateway`. Use `can()` and `ConsentSnapshot` to build `ToolContext.consent`, and `AuditWriter` for `ToolContext.audit`. Consent purpose ids are copied locally in `src/tools.ts`.
- **packages/connectors / opportunities / documents / notify:** implement the stub tools (`connectors.list_upcoming`, `opportunities.search`, `documents.render_cv`, `notify.create_reminder`) with the same names and JSON schemas, or register new `<domain>.<verb>` tools.
- **packages/db:** persist `UsageRecord` via a `UsageStore` (table suggestion: `ai_usage`, keyed by student_id and month).
- **apps/api:** build one `Gateway` per process. Render `prompts/system.murshid.md` with `PersonaVars` (preferred name and grade only, never DOB or contact details).

## Orchestrator and sub-agents (Oct 2026)

`Orchestrator` (src/orchestrator.ts) is Murshid's "manager". `routeByRules` picks 1-3 specialists from
`SUB_AGENTS` (src/sub-agents.ts): academics coach, sports & training coach, opportunities scout, career & CV agent,
planner, side-hustle mentor, wellbeing (+ a general manager). Each has its own system prompt, toolset (from
`ORCHESTRATOR_TOOLS`: read / write / ui) and model preference from `OPENROUTER_FREE_MODELS`. The host supplies tool
handlers (apps/api implements them on its store). Agents prefetch their read tools, call their model chain with tools,
and fall back to rules (tool summaries + the requested write, run once) if the models fail. In compound requests only
the lead agent may write. Crisis language never reaches a model (fixed reply with UAE helplines 800-HOPE, 999, 116111).
`OpenAICompatibleProvider` adds per-request chains, 429 backoff, pacing and a daily-quota circuit breaker.
Tests use scripted providers (no network): `test/orchestrator.test.ts`.
