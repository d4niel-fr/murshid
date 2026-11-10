# Murshid policy simulation: adviser, institutional agents, error scenarios

```
                 scenario stages (released one at a time, each to some agents only)
                                   |
                       Coordinator (Y.3172 MLFO role)
        +-------------+-----------+-------------+--------------+
        |             |           |             |              |
  Murshid tutor   School +     UAE Data    Ministry of    Child Digital Safety
  (operator)      KHDA         Office      Education      Council / TDRA
        \_____________ messages, delivered next stage ______________/
                                   |
                 Policy & legal adviser: gaps -> global examples
                                   |
            audit.jsonl (hash chain) + transcript.md + result.json
```

- **Knowledge base**: hybrid retrieval (bge-small dense + BM25, reciprocal-rank fusion) over `../knowledge-base`. Each agent may only reason from the sources in its mandate (e.g. the Data Office agent sees the PDPL and the cybersecurity strategy; the adviser sees all 22 documents).
- **Agents** (`murshid_policy/agents.py`): mandate, legal sources, and a rule table. Two engines:
  - `offline` (default): deterministic rules + retrieval. Zero cost, reproducible, every action cites the best-matching chunk and the citation is checked for supporting words.
  - `openrouter`: a low-cost/free model gets the mandate, the new information and the retrieved excerpts and must answer in a JSON schema. Citations outside the retrieved set are removed; deadlines with numbers that appear in none of the sources are flagged `UNSUPPORTED`. Failures fall back to the rule engine and the reason is logged.
- **Scenarios** (`scenarios/*.json`): `minor-data-leak`, `harmful-content`, `unverified-consent`, `exam-outage`, each 4 stages plus a debrief round. Information is incomplete and reaches agents at different times; agents' messages arrive one stage later.
- **Coordinator diagnostics**: overlapping leads (two regulators both acting as lead), late awareness (a mandated authority learns of an issue stages later), never informed, deadlines that the law delegates to unissued regulations, and invented deadlines.
- **Policy & legal adviser** (`murshid_policy/adviser.py`): `ask` answers questions during a scenario (UAE first, then global practice, with sources); `gap_analysis` selects the gaps in `gaps.json` that the scenario touched, resolves each piece of evidence to a page of an official document, and (LLM mode) writes a short prioritised synthesis.
- **Audit**: every release, turn (inputs, retrieved chunk ids and scores, cited ids, the agent's reasoning summary, actions, messages, model, tokens, latency) and the gap analysis are JSON lines chained by SHA-256. The "reasoning summary" is what the agent is asked to state about its reasoning; hidden model internals are not logged.

## Commands

```bash
python -m murshid_policy list
python -m murshid_policy simulate <scenario|all> [--mode offline|openrouter] [--max-calls N]
python -m murshid_policy ask "question" [--mode openrouter] [--out file.json]
python -m murshid_policy search "query" [--source uae-pdpl-2021 ...]
python -m murshid_policy verify outputs/<run>/audit.jsonl
python -m pytest -q tests
```

Environment: `OPENROUTER_API_KEY` (only for `--mode openrouter`), `MURSHID_POLICY_MODELS` (comma list, default `nvidia/nemotron-3.5-lightning:free,google/gemma-4-31b-it:free`), `MURSHID_POLICY_ALLOW_PAID=1` to add `google/gemini-2.5-flash-lite` as a last resort, `MURSHID_POLICY_WALL_S` (default 70 s of model use per run).
