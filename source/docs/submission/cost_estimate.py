"""AI cost per active student per month: cheap model mix WITHOUT DeepSeek (ruled out for personal data).

Prices: OpenRouter /api/v1/models, checked 15 Oct 2026 (USD per 1M tokens: input / output / cached input).
Usage per active student per month is an ASSUMPTION (same usage profile as the earlier estimate).
Run: python3 docs/submission/cost_estimate.py
"""
rows = []

def add(name, calls, tok_in, cache_frac, tok_out, p_in, p_cache, p_out):
    i = calls * tok_in / 1e6
    o = calls * tok_out / 1e6
    rows.append((name, i * (1 - cache_frac) * p_in + i * cache_frac * p_cache + o * p_out))

LUNA = (0.10, 0.01, 0.50)          # openai/gpt-6-luna
LUNA_BATCH = (0.05, 0.005, 0.25)   # openai/gpt-6-luna:batch
FLASH = (0.75, 0.075, 3.75)        # google/gemini-3.8-flash
FLASH_LITE = (0.25, 0.025, 1.50)   # google/gemini-3.1-flash-lite

add("router: GPT-6 Luna (only when keyword rules fail)", 100, 1500, 0.7, 60, *LUNA)
add("everyday chat: GPT-6 Luna", 250, 6000, 0.6, 500, *LUNA)
add("week planning: Gemini 3.8 Flash", 8, 15000, 0.5, 2500, *FLASH)
add("weekly briefing: GPT-6 Luna (batch)", 4, 12000, 0.0, 1500, *LUNA_BATCH)
add("CV / essay help: Gemini 3.8 Flash", 6, 8000, 0.5, 1500, *FLASH)
add("long notes: Gemini 3.1 Flash-Lite", 10, 30000, 0.0, 1500, *FLASH_LITE)
add("photo of notes (OCR): Gemini 3.1 Flash-Lite", 30, 1800, 0.0, 400, *FLASH_LITE)
add("opportunity research over own database: GPT-6 Luna", 15, 10000, 0.0, 800, *LUNA)
rows.append(("embeddings (pgvector, small model)", 0.02))
rows.append(("search: own crawled database, no per-search fee", 0.0))

total = sum(c for _, c in rows)
for n, c in rows:
    print(f"{c:6.3f}  {n}")
print(f"{total:6.3f}  TOTAL USD per active student per month")
print(f"share of AED 150/year licence (~USD 3.40/month): {total / 3.40:.0%}")
