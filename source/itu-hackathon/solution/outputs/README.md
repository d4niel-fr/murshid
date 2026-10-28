# Sample runs (evidence)

Each folder holds one simulation run: `transcript.md` (human-readable), `audit.jsonl` (hash-chained audit log, verify with `python -m murshid_policy verify <path>`), `result.json` (summary). All runs were made on 21 Oct 2026. Every student, school and number in the scenarios is synthetic.

| Run | Engine | Agent turns | LLM calls | Audit records (chain ok) | Gaps surfaced | Coordinator findings |
|---|---|---|---|---|---|---|
| `minor-data-leak-openrouter-20261021T095902Z` | free OpenRouter model (`nvidia/nemotron-3.5-lightning:free`) for 10 agent turns, rules for the rest | 17 | 10 | 26 (ok) | G1 G2 G3 G4 G8 G9 | 4 overlapping leads, 5 late awareness, 2 undefined deadlines, 7 invented deadlines flagged |
| `exam-outage-openrouter-20261021T100005Z` | same model for 6 agent turns + adviser synthesis | 14 | 7 | 22 (ok) | G7 G5 G4 G6 G8 (adviser-ranked) | 2 overlapping leads, 4 late awareness, 3 invented deadlines flagged |
| `minor-data-leak-offline-*` | deterministic rules + retrieval | 10 | 0 | 19 (ok) | G1 G2 G3 G4 G8 G9 | 4 late awareness, 1 never informed, 1 undefined deadline |
| `harmful-content-offline-*` | rules + retrieval | 8 | 0 | 17 (ok) | G2 G3 G4 G5 G6 G9 | 1 overlapping lead, 4 late awareness, 2 never informed |
| `unverified-consent-offline-*` | rules + retrieval | 8 | 0 | 16 (ok) | G1 G2 G3 G4 G9 | 1 overlapping lead, 4 late awareness, 1 never informed |
| `exam-outage-offline-*` | rules + retrieval | 8 | 0 | 16 (ok) | G4 G5 G6 G7 G8 | 4 late awareness |
| `adviser/ask-underage-consent.json` | adviser `ask` with the free model | - | 1 | - | - | answer cites CDS Art. 7, UK Children's Code, UNESCO, UNICEF |

Cost of all model calls: USD 0 (free tier). The free tier is shared with the live Murshid demo (50 requests/day), so each run is capped (`--max-calls`) and a wall-clock limit switches agents to the rules engine.

What the LLM runs show (also discussed in the technical report):

- Every LLM action cited a chunk id from its own retrieved excerpts (ids outside that set are stripped and flagged). 2 actions per LLM run had no citation.
- The model invented notification deadlines ("within 24 hours", "72 hours per PDPL") that appear in none of its sources: 7 in the data-leak run, 3 in the outage run. The deadline checker flags them in the transcript. This is the behaviour gap G1 predicts when the law leaves the clock to unissued regulations.
- LLM agents tend to declare themselves "lead"; the coordinator reports these as overlapping leads, which is more than the rule engine (which follows each agent's mandate table) produces.
- Known limitation: the checker verifies that a cited chunk exists and was retrieved, not that the article number written in the prose is right (the adviser answer calls the educational-platform exemption "Article (8)"; it is Art. 7(3), in the same cited chunk).

The KB was re-ingested after the two LLM runs to correct one issuer label in the metadata; chunk ids and texts did not change, so the `kb.chunks_sha256` recorded in those two audit logs differs from the current manifest.
