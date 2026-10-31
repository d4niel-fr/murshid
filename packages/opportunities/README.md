# @murshid/opportunities

Finds, normalises, de-duplicates and ranks opportunities for UAE high-school students: competitions, olympiads, scholarships, summer programmes, internships, volunteering, MUN and hackathons.

No LLM calls. Everything is rule-based and deterministic. The places where AI will plug in later are marked `// AI-LATER`.

## What's inside

| Path | What it does |
|---|---|
| `sources.json` | A curated list of **93 real source pages**: 30 UAE, 58 global, 4 UK, 1 Europe. Each has `id, name, url, type, region, crawl_frequency, parser ('html-rules'\|'rss'\|'api'\|'manual'), organizer, tags`, plus optional `rules` (CSS) and `notes`, and a `verification` block. |
| `src/crawler/robots.ts` | A robots.txt parser (RFC 9309 subset): agent groups, Allow/Disallow, the `*` and `$` wildcards, longest-match wins, and `Crawl-delay`. |
| `src/crawler/fetcher.ts` | `PoliteFetcher`: checks robots.txt first (a 5xx on robots.txt means disallow), rate-limits per host (`CRAWLER_MIN_INTERVAL_MS`, or Crawl-delay if that is longer), sends conditional GETs (`If-None-Match` / `If-Modified-Since`) and serves the cached body on a 304. The cache is pluggable (`MemoryCache`, `FileCache`, or a DB-backed one later). Tests inject `fetchImpl`. |
| `src/crawler/crawl.ts` | `crawlSource`, `crawlSources` (runs several hosts at once), and `isDue(source, lastCrawledAt)` based on `crawl_frequency`. |
| `src/extract/html.ts` | Cheerio extraction. It supports per-source rules: `item` cards (title/link/description/deadline selectors), or `container`+`split` (e.g. the AUS hub page, whose blocks are separated by `<hr>`), with `requireText` and `eventDateAsDeadline`. Without rules it falls back to treating the page as one item, with nav, header, footer and cookie noise stripped. |
| `src/extract/rss.ts`, `src/extract/api.ts` | RSS/Atom, plus adapters for the Devpost and Codeforces JSON APIs. |
| `src/extract/dates.ts` | Deadline detection in many formats: ISO, `19/06/2026` (day first), `June 19, 2026`, `20th of June 2026`, ranges like `July 6-10, 2026`, and dates with no year. A date counts as a deadline only when it sits within 80 characters after a deadline keyword. A date with no year takes the page's own year. |
| `src/extract/heuristics.ts` | Grade/age eligibility in this order: `Grades 10–12`, then ages (`aged 13–17` → grade = age − 5), then UK `Year 11–13` (→ grade = year − 1), then phrases like "rising seniors" or "high school". Also cost (free/fully funded → 0; AED/USD/GBP/EUR/INR converted to AED; tuition preferred over application fee; prize money ignored), nationality restriction, type, tags, emirate, and an eligibility snippet. |
| `src/extract/build.ts` | Turns a raw item into a contract `Opportunity`. The id is a stable UUID hashed from source + url + title. |
| `src/pipeline/dedupe.ts` | Normalises titles (drops years, ordinals, stopwords and punctuation), normalises organizers, and fuzzy-matches with Dice bigrams (≥0.85 for the same organizer, ≥0.93 across organizers, and the same URL needs a similar title). When merging, the primary source wins over an aggregator and missing fields are filled in. |
| `src/pipeline/lifecycle.ts` | `applyExpiry` closes items past their deadline, reopens ones whose deadline is in the future, and marks undated items not seen for 45+ days as `unknown`. `freshnessScore` runs 0..1 (30-day half-life, boosted by a future deadline). |
| `src/match/rank.ts` | Rule-based ranking. Each score comes with **reason strings** and **warnings** (shown in the table below). |
| `src/scheduler.ts` | `runWeeklyCrawl`, `runNightlyExpiry`, and `scheduleDefinitions` (cron in UTC: `0 23 * * 0` = Mon 03:00 Dubai, `30 20 * * *` = 00:30 Dubai). |
| `src/store.ts` | The `OpportunityStore` port and a `MemoryStore`. |
| `src/ai.ts` | The `OpportunityExtractor` interface (AI-LATER) and `RuleBasedExtractor`, the only implementation for now. |

### How ranking scores points

Default weights add up to 100:

| Factor | Points | How it is scored |
|---|---|---|
| Grade fit | 25 | Partial credit when grade info is missing; less for aggregator posts with no grade info. |
| Interest/goal overlap | 35 | A synonym map turns free-text interests and goals into tags. |
| Deadline urgency | 15 | Highest when the deadline is 7 days away or less. |
| Cost | 10 | Free scores highest. Anything over `budget_aed` gets a warning. |
| Local | 10 | Same emirate, then elsewhere in the UAE, then online. |
| Freshness | 5 | Uses `freshnessScore`. |

A wrong grade, a nationality the student doesn't meet, or a closed opportunity makes the item **ineligible** (score × 0.25). Ineligible items are filtered out unless you pass `includeIneligible`.

## Run

```bash
pnpm install --filter @murshid/opportunities...
pnpm test            # 76 tests, offline (saved HTML/JSON/XML fixtures in test/fixtures)
pnpm typecheck
NODE_USE_ENV_PROXY=1 pnpm crawl:sample           # LIVE crawl of 10 sources → data/sample-run.json
NODE_USE_ENV_PROXY=1 pnpm verify:sources [--write]  # LIVE re-check of every URL in sources.json
```

```ts
import { loadSources, crawlSources, dedupe, applyExpiry, rankOpportunities } from '@murshid/opportunities';
const { opportunities } = await crawlSources(loadSources().filter(s => s.region === 'UAE'));
const ranked = rankOpportunities(applyExpiry(dedupe(opportunities), new Date()), student, goals);
// ranked[0].reasons → ["Open to Grades 10–12 (you're in Grade 11)", "Matches your interests: robotics, ai", "Free to take part", ...]
```

## Env vars (`.env.example`)

- `CRAWLER_USER_AGENT`: defaults to `MurshidBot/0.1 (+url)`. Keep it honest.
- `CRAWLER_MIN_INTERVAL_MS`: minimum gap between requests to the same host. Default 2000.
- `NODE_USE_ENV_PROXY=1`: only needed where outbound traffic goes through `HTTP(S)_PROXY`, because Node 22's `fetch` ignores proxies otherwise.

## Source verification (checked 2026-10-10)

- **90 of 93 sources verified OK.**
  - 85 returned HTTP 200 with the expected page title to a direct request from the sandbox.
  - 5 were blocked by the sandbox proxy (403 or a TLS error) but loaded correctly through a fallback fetch: UAE Space Agency, Arab Reading Challenge, THIMUN, and the two Wharton Global Youth pages.
- **3 are behind a bot challenge.** They answer with HTTP 202 and a JS/cookie wall, so their content could not be verified: UKMT, IPhO, and Emirates Lit Fest. They stay in the registry with `verification.status = "bot-challenge"`.
- Several URLs were swapped for working ones while curating:
  - The NYUAD pre-college URL returned 404, so the high-school-programs pages are used instead.
  - `conradchallenge.org` has a TLS error, so `conradfoundation.org` is used.
  - The AUS summer-programs URL was a soft 404, so the CEN Outreach Hub is used.
  - `eysc.ae` didn't resolve, so the official ChallengeON EYSC 2026 page is used.
- 4 sources are `manual`:
  - volunteers.ae needs a login and renders with JS.
  - Kaggle shows a reCAPTCHA.
  - The IMO UAE country page is reference only.
  - The Duke of Edinburgh's International Award runs year-round.

## Live sample (`data/sample-run.json`)

10 sources were crawled: EYSC, NYUAD HS, KU Ektashif, AUS hub, IOF Math, DFF TKS, Devpost, Codeforces, Opportunity Desk RSS and John Locke.

- **9 succeeded.** They gave 43 extracted items, 41 after dedupe, 23 of them open. The second run got 304s, which shows the ETag/Last-Modified cache working.
- **Khalifa University returned 403** to the honest `MurshidBot` user agent; it accepts browser user agents. We do **not** spoof. Treat it as a weekly manual or browser-agent source, or ask KU to allow-list the bot.
- The file also contains a demo ranking for the synthetic student "Rohan Test".

## Known limitations / AI-LATER

- One-item-per-page extraction misses details on pages rendered with heavy JS (DFF, EYSC tabs), and multi-programme pages without `rules` collapse into one item. AI-LATER: an `LlmOpportunityExtractor` behind `OpportunityExtractor`, and embeddings for interest matching inside `scoreOpportunity`.
- Many pages still show last cycle's dates. The extractor reports what the page says. For example, the KU Ektashif page shows "Application Deadline: [20 June 2025]" for a 2026 camp, so the item is marked closed.
- Currency rates in `extractCost` are fixed numbers, which is fine for ranking.
- Aggregators (Opportunity Desk) are mostly aimed at adults. Their posts score low when grade info is missing.
- The URLs for EYSC (`eysc2026`) and the MLH season change every year; update them each year.

## Integration notes

- **Types:** `src/types.ts` copies the contract's `Opportunity` and a subset of `Student`/`Goal`. Swap these for `@murshid/core` once it is published. `Opportunity` has `emirate` and `country` as separate fields, matching the contract's "emirate/country".
- **db team:** implement `OpportunityStore` over the `opportunities` table, upserting on `id` (stable). It also needs a small `opportunity_sources(last_crawled_at)` table, or a KV store, for `get/setSourceLastCrawled`. A DB-backed `HttpCache` (etag, last_modified, body hash) is recommended.
- **notify/api team:** wire `scheduleDefinitions` into Inngest (`inngest.createFunction({ id }, { cron }, () => handler(ctx))`) or any cron runner. Handlers are plain async functions.
- **gateway team:** `OpportunityExtractor` is the seam for AI extraction later.
- **Privacy:** this package reads no student data except the `StudentProfile` passed into ranking. Audit logging of that read belongs to the caller (agent or api).
