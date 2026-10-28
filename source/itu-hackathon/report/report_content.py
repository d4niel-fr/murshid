# Content of the technical report (executed by build_report.py with H, P, TABLE).
# Every factual claim is traceable to the KB (chunk ids in solution/outputs) or to the repository.

H("Introduction")
P("Murshid is an AI agent for UAE high-school students (ages 13-18) and their teachers. For a student it plans the week around timetable, assignments, tests and sport, answers study questions, finds competitions and builds a CV; for a teacher it shows class progress, who needs support and the best day to set homework, and re-plans every student's week when work is posted. It is deployed as a working demo with synthetic students (murshid-web, murshid-admin and murshid-api on Vercel). "
  "For this hackathon we added what an education agent needs before it can serve real children: (1) a knowledge base of 22 official UAE and global documents (1,058 pages) built with the ITU reference ingestion code; (2) a policy and legal adviser agent over that KB; (3) five institutional-role agents (the Murshid operator, the school with KHDA, the UAE Data Office, the Ministry of Education, and the Child Digital Safety Council/TDRA) that receive different information at different times during error scenarios; and (4) audit logging with source attribution and a gap analysis mapped to global examples. "
  "Everything runs on a laptop CPU; model calls use free OpenRouter models capped per run, and a deterministic rules-and-retrieval engine gives the same pipeline at zero cost.")

H("Description of the use case")
P(" UAE students juggle several curricula, frequent assessments, sport and activities; teachers set work without seeing a student's whole week, so overload and missed deadlines show up late. Generic chatbots help with single questions but do not see the timetable, do not coordinate with teachers, and are not designed for minors under UAE law.", bold="Problem.", after=2)
P(" Murshid's orchestrator runs a safety pre-check (crisis language never reaches a model and gets a fixed reply with UAE helplines), routes the request to up to three of seven specialist sub-agents, reads the student's own data through tools, acts only on the student's own planner, logs every change, and falls back to a rule engine if models fail. Privacy controls already in the code: a neutral age gate (under-13s blocked), guardian OTP verification for 13-17s, consent per purpose, retention rules, data export/deletion and an audit log.", bold="Solution.", after=2)
P(" Those controls are fixed in code. An education agent operating at scale must also know, at the moment something goes wrong, which rule applies, which authority must be told, and where UAE rules are silent. The policy agents and KB make that knowledge queryable, testable and auditable.", bold="What this submission adds.")

H("Use case requirement")
P(' student and teacher inputs, school systems (Microsoft 365/Teams via Graph, LTI 1.3; simulated in the demo) and 93 public opportunity sources; every student record needs a lawful basis and, for 13-17s, verified guardian consent.', bold='SRC:', after=1)
P(' connectors and the API collect only consented purposes; hosting and model regions must be known for the cross-border rules.', bold='C:', after=1)
P(" each step receives the minimum data it needs, with pseudonymised identifiers and no other students' data; crisis screening runs before any model.", bold='PP:', after=1)
P(' low-cost hosted LLMs plus a rule engine; the model behind each route must be pinned and re-tested, because a silent provider swap changes safety behaviour.', bold='M:', after=1)
P(' the policy node enforces age, consent, integrity and budget rules and requires human approval before anything leaves Murshid; incidents must be classified and escalated to the right authority within the legal time limit.', bold='P:', after=1)
P(' replies, notifications, weekly reports and teacher dashboards must stay available in a degraded (non-AI) mode during exams.', bold='D / SINK:', after=1)
P(' a coordinator runs the policy agents against scripted incidents before and during deployment, and every decision is logged with its sources.', bold='MLFO / sandbox:', after=1)

H("Mapping to ITU-T Y.3172, the ITU AI Readiness Framework 2.0, and UAE policies")
TABLE(["Y.3172 node", "Murshid use case", "Readiness 2.0 dimension", "UAE documents (global reference)"], [
    ["SRC", "Student/teacher inputs; school systems (Graph, LTI 1.3); 93 public opportunity sources", "D1 Data/model marketplace; D4 Contextualisation & regional impact",
     "PDPL Arts. 4-6 (lawful basis, provable consent); Decree-Law 26/2025 Art. 7 (under-13 consent); MoE AI Literacy Framework (UNICEF Guidance 3.0)"],
    ["C", "Connectors, Hono API on Vercel, guardian OTP, age gate", "D13 Digital infrastructure",
     "PDPL Art. 7 (records), Art. 8 (processor), Arts. 22-23 (transfers abroad); National Cybersecurity Strategy"],
    ["PP", "Per-step data minimisation, pseudonymised ids, crisis pre-check, grade-band adaptation", "D3 Cross-domain correlation; D6 Human interface",
     "PDPL Art. 5 (purpose, minimisation), Art. 20 (encryption, pseudonymisation) (UK Children's Code std. 8)"],
    ["M", "Free/low-cost LLMs (Nemotron, Gemma) + rule engine; 7 sub-agents", "D2 Generated-content ecosystem; D8 Collaboration with AI",
     "UAE AI Charter 2024; UAE AI Ethics Guidelines 2022; Generative AI Guide 2023 (UNESCO GenAI guidance; EU AI Act Art. 15)"],
    ["P", "Consent per purpose, retention, integrity rules, model budget, human approval; policy agents", "D10 AI & policies; D9 Impacts of humans in AI integration",
     "PDPL Art. 18 (human review), Art. 21 (DPIA); Decree-Law 26/2025 Arts. 8, 10; MoE Guide (approved tools, age, integrity); KHDA: AI must not replace human judgement on students (EU AI Act Art. 14)"],
    ["D", "API replies, notifications, weekly reports", "D5 Integration of AI in workflows",
     "PDPL Art. 9 (breach notice), Art. 13 (information rights); KHDA distance-learning expectations (parent communication)"],
    ["SINK", "Student app, teacher/school portal, guardian summaries", "D6 Human interface; D11 AI for inclusion; D12 Granular priorities",
     "KHDA Exam Contingency Guide 2026; KHDA Future Ready Framework (UK Children's Code: transparency by age)"],
    ["MLFO + sandbox", "Coordinator + institutional agents + scripted error scenarios; hash-chained audit log", "D7 Strategy alignment",
     "National AI Strategy 2031; Child Digital Safety Council (Decree-Law 26/2025 Arts. 4-5) (EU AI Act Arts. 12, 73; OECD AI Principles)"],
], [0.09, 0.27, 0.2, 0.44])
P("Dimension numbers follow the 13 dimensions encoded in the ITU reference code (data/framework/dimensions.json), loaded into our kb_framework collection. How the solution reflects the Readiness perspectives named for this hackathon:", size=10, after=1)
for label, text in [
    ("Open data and open source: ", "all 22 sources are public; the manifest gives official URL, retrieval date, method and SHA-256 per file; ingestion follows the MIT-licensed ITU reference code."),
    ("Generative-AI content ecosystem: ", "models may cite only retrieved chunks; invented deadlines are flagged; free-model behaviour is recorded per call."),
    ("Contextualisation: ", "federal law, Dubai/KHDA and MoE layers for UAE schools. English versions only: Arabic is the authentic language of UAE laws and is not yet ingested."),
    ("Integration across domains: ", "education, child online safety, data protection and cybersecurity agents act on one incident."),
    ("Human interaction and supervision: ", "human approval and PDPL Art. 18 review are in the design; the simulation shows where no human owner is defined."),
    ("Policy opportunity identification: ", "nine gaps with global examples (section 6)."),
    ("Social inclusion: ", "runs on free tiers; production AI cost estimated at about US$0.49 per active student-month."),
    ("Infrastructure and energy: ", "CPU-only embeddings (384-d), small hosted models, no GPU; a full rules-mode run takes about a second."),
]:
    P(" " + text, bold="- " + label.strip(), size=10, after=0)

H("Error scenarios: evaluation of the technical solution and of policy")
IMG("architecture.png", 16.5, "Figure 1. Murshid's Y.3172 pipeline (top) and the policy simulation that backs its policy node (bottom).")
P(" The KB (ChromaDB collections kb_main, kb_usecase, kb_framework; 1,541 chunks with page and article metadata) is searched with hybrid dense (bge-small) + BM25 retrieval. Each institutional agent may only use the documents of its mandate. A coordinator (the Y.3172 MLFO role) releases each stage only to the agents named in it; agents' messages arrive one stage later. Each turn is logged as a JSON line (inputs, retrieved chunk ids and scores, cited ids, the agent's stated reasoning summary, actions, deadlines, messages, model, tokens, latency) chained by SHA-256. LLM outputs are checked: citations outside the retrieved set are removed, and deadlines whose number of hours/days appears in no source are flagged. The coordinator then reports overlapping leads, late or missing awareness and undefined deadlines, and the adviser maps the gaps the run touched to global examples.", bold="Architecture.", after=2)
P(" Step 1 (T+0, operator only): a contractor's debug export of 412 records of 14-17-year-olds, including wellbeing notes, is publicly readable. Step 2 (T+3h, school only): a parent finds her son's wellbeing note in a WhatsApp group; the school did not know these notes were stored. Step 3 (T+23h): a guardian complains to the Data Office; separately the operator learns the bucket is hosted abroad and 37 records came through a school licence. Step 4 (T+2d): media coverage reaches the Child Digital Safety Council and MoE. "
  "Expected: containment, notification to the Data Office and data subjects under PDPL Art. 9, child-data restrictions under Decree-Law 26/2025 Art. 7, cross-border review under PDPL Arts. 22-23, school safeguarding and parent communication. "
  "Observed: agents cited provisions from their own mandates (PDPL Art. 9 and Arts. 22-23; Decree-Law 26/2025 Art. 7; KHDA guidance), and 2 actions had no citation. The Data Office learned of the breach one stage late (in the rules-only run it never learned the data subjects were children: PDPL Art. 9 does not ask the notice to say so); four regulators acted as lead on the same incident; the model stated 72-hour and 24-hour deadlines found in no UAE source, which the checker flagged (7 cases); agents themselves recorded that PDPL leaves the period to the unissued Executive Regulations; and once the Data Office agent drafted the controller's notification to itself (role confusion that a mandate table prevents in the rules engine).", bold="Scenario 1, minor's data leak (free model, 10 calls, US$0).", after=2)
P("Audit record (abridged, from solution/outputs/minor-data-leak-openrouter-20261021T095902Z/audit.jsonl):", size=9, after=0)
CODE('{"seq": 6, "kind": "agent_turn", "actor": "data_office", "stage": 2, "engine": "llm:nvidia/nemotron-3.5-lightning:free", "inputs": ["MSG-murshid_operator"], '
     '"tags": ["breach","minor_data"], "retrieved": [{"id": "uae-pdpl-2021#0014", "score": 0.0333}, ...], "cited": ["uae-pdpl-2021#0014","uae-pdpl-2021#0015"], '
     '"rationale": "Article (9) of the PDPL mandates that the Controller notify the Data Subject ...", "deadlines": ["... within the period set by Executive Regulations ..."], '
     '"llm": {"latency_ms": 5437, "cost_usd": 0.0, "prompt_tokens": 2485, "completion_tokens": 536}, "prev_hash": "9e9ae810c7192024...", "hash": "2cbd5ada84187564..."}')
P(" Harmful content after a silent model swap: the school/KHDA and the Child Digital Safety agent both acted as lead, MoE could only point to a Guide that does not cover non-MoE-curriculum private schools, and the Data Office was never informed. Unverified guardian consent (63 students aged 13-17 plus two 12-year-olds past a self-declared age gate): the Data Office (PDPL) and the Child Digital Safety Council (Decree-Law 26/2025) both claimed the lead, and the school relied on a generic enrolment clause that no UAE text in the KB validates or rejects. Model outage on the first morning of mock exams: KHDA's contingency guide covers cancelled exam boards, not AI outages, and the only fallback model was served from abroad. All six sample runs (two with a model, four rules-only) are in solution/outputs with verified audit chains; the adviser's free-model synthesis ranked the AI-continuity gap first.", bold="Scenarios 2-4 (rules engine, plus one free-model run of scenario 4).", after=2)

P(" an optional persona beside the tutor that always says it is an AI; a guardian or the school can switch it off (Grades 5-6 start off until a guardian opts in) and only safety flags, never messages, are logged. "
  "On 4 simulated students x 19 turns (12 red-team) against a worst-case compliant model, the layered design (input screen + output screen + nudges) gave 0 unsafe replies of 76 (overall 0.983 vs 0.580 prompt-only).", bold="Guarded study-buddy mode:")

H("Policy and standards gaps from the mapping exercise")
TABLE(["Gap (type)", "UAE evidence in the KB", "Global example (KB)", "Recommendation"], [
    [("G1 ", "No clock for breach notice (delegated to unissued regulation)"), "PDPL Art. 9: notify 'within the period ... set by the Executive Regulations'; Art. 28 required them within 6 months; legal trackers report them unpublished in Oct 2026",
     "EU AI Act Art. 73: serious incidents reported no later than 15 days; OECD traceability", "Fixed window in the Regulations, shorter for children's data; interim Data Office guidance"],
    [("G2 ", "Education-platform exemption pending (open exemption)"), "Decree-Law 26/2025 Art. 7(3): educational platforms may be exempted from the under-13 rule by a Cabinet Resolution not yet issued",
     "COPPA 16 CFR 312.5 verifiable parental consent; UNESCO: define and enforce an age limit", "Criteria for 'educational platform', substitute safeguards, public register"],
    [("G3 ", "Teen consent undefined (legislative)"), "PDPL has no child provisions; Decree-Law 26/2025 defines a child as under 18 but sets the consent rule for under-13s only",
     "UK Children's Code: 15 standards for all under-18s by age band; UNICEF Guidance 3.0", "Age-banded consent rules for 13-17 and for school enrolment clauses"],
    [("G4 ", "Fragmented scope"), "PDPL Art. 2(2) excludes government entities and free-zone companies", "EU AI Act Annex III(3): education AI is high-risk whoever deploys it",
     "Use-based rules for education AI across public and private deployers"],
    [("G5 ", "No binding AI obligations (standards)"), "AI Charter and Ethics Guidelines are principles; the Guidelines say they are non-binding", "EU AI Act Arts. 12 (logs), 14 (human oversight), 15, 73",
     "Education-AI baseline: risk class, logging, oversight, model-change notice, incident report"],
    [("G6 ", "AI rules for some schools only (responsibility)"), "MoE Guide (approved tools, age limits) covers public and MoE-curriculum schools; KHDA AI guidance announced for next year (press, Oct 2026)", "UNESCO: validate GenAI tools; UNICEF: procurement guidance",
     "KHDA list of approved tools and age bands, shared register with MoE"],
    [("G7 ", "No AI continuity standard"), "KHDA Exam Contingency 2026 addresses cancelled exam boards; PDPL Art. 20 only on data access after failure", "OECD Principle 1.4 (robust, override, decommission); EU AI Act Art. 15 (fail-safe)",
     "Degraded non-AI mode, exam-period change freeze, provider SLAs"],
    [("G8 ", "Cost vs. data residency (conflict)"), "PDPL Arts. 22-23: transfer conditions left to the Regulations", "UK Children's Code std. 5 (no detrimental use), DPIA",
     "Adequacy list, model-provider clauses, disclosure of model region and retention"],
    [("G9 ", "Several regulators, no lead (coordination)"), "Data Office, Child Digital Safety Council/TDRA and KHDA all hold a mandate; the Council coordinates (Arts. 4-5) but no joint incident protocol is in the KB",
     "EU AI Act Art. 70: single point of contact", "One intake point for AI incidents involving children; lead-authority rule by incident type"],
], [0.19, 0.31, 0.25, 0.25])
P("Limits. The gap catalogue was written by the team from the KB and is re-grounded by the system on every run; coordinator findings are emergent. The citation check confirms a cited chunk was retrieved, not that the article number in the prose is right. The PDPL Executive Regulations, the Art. 7(3) resolution, KHDA's AI policy and the 2025-2031 cybersecurity strategy text were not available and are not in the KB. Scenario data is synthetic. Next steps: Arabic texts, KHDA guidance once published, contributing the gaps to ITU study groups.", size=9, after=0)
