# Murshid: ITU AI for Good Lab Hackathon (UAE) submission

Team **Murshid** · domain **Education** · team leader **Vardan (Sam) Kapur**, Grade 11, GEMS Our Own High School Al Warqa'a, Dubai; team member **Daniel Davidson**.
Event: https://aiforgood.itu.int/event/ai-for-good-sandbox-hackathon-united-arab-emirates/ (submission deadline 10 Nov 2026).

Murshid itself (the student/teacher AI agent) lives in this monorepo (`apps/`, `packages/`) and runs at
https://murshid-web.vercel.app, https://murshid-admin.vercel.app and https://murshid-api.vercel.app. Its demo uses synthetic students only.
This folder adds the three hackathon deliverables; nothing here changes the deployed apps.

| Deliverable | Where |
|---|---|
| 1. Knowledge base (22 official UAE + global documents, 1,058 pages, vectorised with the ITU reference pipeline) | [`knowledge-base/`](knowledge-base/) · [`MANIFEST.md`](knowledge-base/MANIFEST.md) |
| 2. Agentic solution: policy & legal adviser, five institutional-role agents, progressive error scenarios, audit log, gap analysis | [`solution/`](solution/) · sample runs in [`solution/outputs/`](solution/outputs/) |
| 3. Technical report (5 pages, official template) | [`report/Murshid-ITU-Technical-Report.pdf`](report/Murshid-ITU-Technical-Report.pdf) and `.docx` |

## Quick start (about 2 minutes, no API key needed)

```bash
cd itu-hackathon/solution
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python -m murshid_policy list
python -m murshid_policy simulate minor-data-leak            # rules + retrieval engine, zero cost
python -m murshid_policy ask "Who must be told about a leak of students' data, and by when?"
python -m pytest -q tests
```

With a model (free OpenRouter models by default, capped at `--max-calls`):

```bash
export OPENROUTER_API_KEY=...        # never commit it
python -m murshid_policy simulate exam-outage --mode openrouter --max-calls 8
```

Rebuild the knowledge base from the official sources: see [`knowledge-base/README.md`](knowledge-base/README.md).

## Honesty notes

- All scenario data is synthetic. No real student data is used anywhere in this folder.
- The relationship with GEMS Our Own High School Al Warqa'a is that it is the team leader's own school; a Grade 11 pilot there is **proposed** and not approved. There is no partnership or contract.
- The gap catalogue (`solution/gaps.json`) was written by the team after reading the KB; the system resolves every piece of evidence to a page of an official document at run time, and the coordinator adds the findings that emerge from each run.
