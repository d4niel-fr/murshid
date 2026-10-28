# Murshid: the AI model layer (researched 10 Oct 2026)

## 0. Checking the founder's model names
- **"GPT-6 Luna" is real.** OpenAI released it on 22 Sep 2026 as the cheapest GPT-6 model. API ID: `gpt-6-luna`. Price: $0.10 input / $0.50 output per million tokens. Context window: 1.05M tokens. Sources: openai.com/index/introducing-gpt-6-sol-and-luna/, docs.aws.amazon.com/bedrock/latest/userguide/model-card-openai-gpt-6-luna.html
- **"Sonnet 5" is real but no longer the newest.** Claude Sonnet 5 (`claude-sonnet-5`) came out on 30 Jun 2026. **Claude Sonnet 5.5** (`claude-sonnet-5-5`) replaced it on 28 Sep 2026 at the same $2/$10 price. Use Sonnet 5.5. Sources: anthropic.com/news/claude-sonnet-5, anthropic.com/claude-sonnet-5-5

## 1. Models available as of Oct 2026 (USD per million tokens, input/output)
| Model | Best for | Context | Price |
|---|---|---|---|
| OpenAI GPT-6 Astra | Top quality across the board | not checked | $10 / $50 |
| OpenAI GPT-6.1 Sol | Everyday hard work, agents | 1M (long-context pricing applies) | $2 / $10 (cached input $0.10) |
| OpenAI GPT-6 Luna | Cheap, high-volume work, routing, extraction | 1.05M | $0.10 / $0.50 (cached input $0.01) |
| Anthropic Claude Fable 5.1 | Hardest reasoning and long agent tasks | 1M | $10 / $50 |
| Anthropic Claude Opus 5.5 | Long agentic and knowledge work | 1M | $4 / $20 |
| Anthropic Claude Sonnet 5.5 | Speed plus intelligence; strong writing | 1M | $2 / $10 (cache hit $0.10) |
| Anthropic Claude Haiku 5.5 | Classification and routing | not checked | $0.10 / $0.50 for prompts up to 100k tokens; $0.50 / $2.50 above that |
| Google Gemini 4 Argon | Frontier model, announced 30 Sep | 1M (reported) | $2 / $10 introductory, then $4 / $20. **Not public in the API yet.** |
| Google Gemini 3.1 Pro (preview) | Multimodal reasoning | not checked | $2 / $12 |
| Google Gemini 3.8 Flash | Agents; takes text, image, audio and video | about 1M | $0.75 / $3.75 until 31 Dec, then $1.50 / $7.50 |
| Google Gemini 3.1 Flash-Lite | Cheap multimodal work, OCR | about 1M | $0.25 / $1.50 |
| DeepSeek V4.1-Flash (open weights) | Cheap reasoning, vision | 1M | $0.30 / $1.20 at peak; half that off-peak |
| DeepSeek V4-Pro (open weights, MIT licence) | Strong open model | 1M | $1.32 / $3.96 at peak |
| Mistral Large 4 (open weights due 31 Oct) | EU-hosted option | not checked | $1.36 / $4.18 list ($0.68 / $2.09 launch promo)* |
| Qwen3.8-27B / Llama 4 Maverick | Self-hosted or cheap hosted | 1M / not checked | about $0.05 / $0.90 and about $0.20 / $0.70* |
| Falcon-H1-Arabic 3B/7B/34B (TII); Falcon-Emirati-7B (6 Oct 2026) | Best open Arabic models; Emirati dialect | 128k–256k | Free weights (Falcon licence); you pay for your own hosting |
| Jais 2 8B/70B (Inception/MBZUAI/Cerebras) | Arabic-first, permissive licence | not checked | Open weights; also in the Azure catalog |
| Seraj (Inception42 + Microsoft, built on GPT-4.1) | Arabic for enterprise, served in the UAE | not checked | Through Core42 Compass; price not published |

\*Taken from search excerpts and third-party trackers, not from a fetched vendor page.

Pages fetched: platform.claude.com/docs/en/about-claude/pricing · developers.openai.com/api/docs/pricing · ai.google.dev/gemini-api/docs/pricing (updated 9 Oct) · api-docs.deepseek.com/quick_start/pricing · blog.google/…/gemini-4-argon (excerpt). Arabic models: tii.ae (Falcon-H1 Arabic, 5 Jan 2026), huggingface.co/blog/tiiuae/falcon-emirati, arxiv.org/abs/2608.13580 (Jais 2), wam.ae (Seraj, 2 Jul 2026).

**Two pricing traps:**
- Claude 4.7 and later use a new tokenizer that produces about 30% more tokens for the same text.
- Gemini 3.8 Flash's price doubles on 1 Jan 2027.

## 2. Routing design
**How a request flows**
1. Client sends the request.
2. Rules run first, at no model cost: intent keywords, attachment type, language detection, and the student's remaining budget.
3. The router model handles anything the rules can't settle. Use GPT-6 Luna or Haiku 5.5 with structured JSON output: {task, complexity, language, needs_web}.
4. The chosen task model runs.
5. A moderation and integrity check runs on both input and output.

**Which model does which job**
| Job | Main model | Fallback |
|---|---|---|
| Router / classifier | GPT-6 Luna | Haiku 5.5 |
| Everyday chat, reminders, portal-note summaries | GPT-6 Luna | Gemini 3.1 Flash-Lite |
| Heavy planning (study plans, application strategy, weekly briefing) | Claude Sonnet 5.5; briefings run overnight through the Batch API at 50% off | GPT-6.1 Sol |
| Long class notes or PDFs | Gemini 3.1 Flash-Lite, or Luna (1M context) | Sonnet 5.5 for synthesis |
| Web research and opportunity finding | Luna to plan and summarise, plus a search tool (OpenAI web search is $10 per 1,000 calls; Gemini grounding gives 5,000 free searches a month across the whole project, then $14 per 1,000) | — |
| CV, essays, LinkedIn outreach (coaching only) | Sonnet 5.5 | GPT-6.1 Sol |
| Arabic | Frontier models for Modern Standard Arabic | Falcon-H1-Arabic or Falcon-Emirati, self-hosted in the UAE, for dialect and sovereign data |
| Embeddings | Gemini Embedding 2 ($0.20) | OpenAI text-embedding-3-large (can be processed in the UAE) |
| Voice | gpt-transcribe ($0.0045/min) for speech-to-text; Gemini 3.8 Flash-Lite TTS (about $0.009/min) for speech; GPT-Live ($0.05/min) only for premium live voice | — |
| Vision (photos of notes) | Gemini 3.1 Flash-Lite | Falcon-OCR-Arabic for Arabic handwriting |

**Controls**
- Keep a per-student token ledger. At 80% of the monthly cap, drop to the cheap tier.
- Cap heavy calls at about 10 per month.
- Cache system prompts and student profiles. Cache reads cost 90–97.5% less than normal input.
- Fall back in a fixed order across providers when one returns 429 or 5xx.
- Cap output length.

**Framework stack**
- **LiteLLM** (self-hosted proxy) or **OpenRouter** as the single gateway. OpenRouter adds model fallbacks, ZDR-only routing per request (`provider.zdr`), and in-region routing (openrouter.ai/docs/features/zdr).
- **Vercel AI SDK** for streaming to web and mobile.
- **LangGraph** for durable multi-step flows such as application pipelines and the weekly briefing.
- **MCP servers** for the school portal, calendar, Gmail and LinkedIn tools.
- The OpenAI Agents SDK or Claude Agent SDK only if you commit to one vendor. Prefer neutral orchestration.

## 3. Cost per active student per month
Assumptions per student per month:
- 250 chat turns at about 6k input tokens (60% cached) and 500 output tokens
- 300 router calls
- 8 heavy planning calls, 4 batched weekly briefings, 6 CV/essay sessions
- 10 long documents of about 30k tokens each, 30 photos
- 15 web searches
- 300k tokens embedded
- 30 minutes of speech-to-text, 10 minutes of text-to-speech

| Item | Cost |
|---|---|
| Router | $0.03 |
| Chat | $0.13 |
| Heavy planning | $0.33 |
| Briefings | $0.08 |
| CV/essays | $0.14 |
| Documents | $0.10 |
| Photos | $0.03 |
| Research | $0.02 |
| Search fees | $0.15 |
| Embeddings | $0.06 |
| Speech-to-text | $0.14 |
| Text-to-speech | $0.09 |
| **Total** | **about $1.29** |

The calculator is at `/workspace/work/murshid_cost.py`.

**Keeping it under $1–2**
- Sonnet calls and search fees are about half the bill. Cap both.
- Batch every scheduled job (briefings, opportunity scans): 50% off.
- Run DeepSeek V4-Flash jobs off-peak.
- Use caching aggressively.
- Make live voice a paid add-on.
- A heavy user without caps could reach $4–6.

## 4. Safety for minors and data
**OpenAI's under-18 guidance** (developers.openai.com/api/docs/guides/safety-checks/under-18-api-guidance):
- Age-appropriate content filters.
- Monitoring with escalation paths.
- Age assurance where needed.
- Use current flagship models.
- **Don't process personal data of children under 13 (or below the local age of digital consent) without Zero Data Retention.**

**Moderation**
- OpenAI `omni-moderation-latest`: no retention and eligible for ZDR (price not shown on the fetched page).
- Gemini safety settings.
- OpenRouter custom classifiers and guardrails.

**Academic integrity**
- Use a separate "integrity classifier" step: is this a graded assignment?
- In tutor mode, respond with hints, Socratic questions and outlines instead of finished answers.
- For essays and CVs, give feedback and suggest edits on the student's own draft. Never ghost-write from nothing.
- Log what help was given so parents and teachers can see it.

**Data retention**
- **OpenAI:** abuse logs kept 30 days by default. ZDR or Modified Abuse Monitoring needs approval. Image inputs flagged as CSAM are kept even under ZDR. (developers.openai.com/api/docs/guides/your-data)
- **Anthropic:** ZDR by approval for each organisation. Safety-classifier results are still kept. (privacy.claude.com)
- **Gemini:** paid tier doesn't use content for training. Free tier does, so keep it out of production.

**Regional hosting**
- **OpenAI** offers a UAE data residency endpoint, `ae.api.openai.com`. It requires MAM or ZDR plus extra approval. Inference stays in the UAE only for `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.2` and `text-embedding-3-large`. **GPT-6 models are stored in the UAE but processed elsewhere.** There is a 10% price uplift.
- **AWS Bedrock me-central-1 (UAE):** Claude 4.5/4.6 available. Profiles labelled `global.*` route out of the country; use regional model IDs (azrty.com, 1 Oct 2026; aws.amazon.com blog, Feb 2026).
- **Azure UAE North:** GPT-5.x only on Global deployments, which can process anywhere. Regional Provisioned covers gpt-4.1, gpt-5-mini and gpt-5.1 (10n.tech, Sep 2026).
- **Google:** regions in Doha (me-central1) and Dammam (me-central2, KSA customers only, through CNTXT). No UAE region.
- **Core42 Compass:** serves DeepSeek V4 Pro, GLM-5.2, K2, Mistral Small and Seraj in the UAE (core42.ai/compass/documentation/compass-models).

**Recommendation:** start global with ZDR applied for. Keep all student records (the database and embeddings) in a UAE region. Move to UAE-processed models such as Bedrock regional Claude, `ae.api` GPT-5.6 Luna or self-hosted Falcon when schools ask for in-country processing.

## Gaps
- Not verified: Haiku 5.5 and GPT-6 Astra context windows, OpenAI embedding and moderation prices, and a public date for Gemini 4 Argon.
- Qwen, Llama and Mistral prices come from search excerpts only.
- UAE privacy law (PDPL) consent rules for minors were not researched.
