# Murshid use case (team document, not an official source)

Murshid is an AI agent for UAE high-school students (Grades 9-12, ages 13-18) and their teachers. Built by Vardan (Sam) Kapur, a Grade 11 student at GEMS Our Own High School Al Warqa'a, Dubai. The deployed demo (murshid-web.vercel.app, murshid-admin.vercel.app, murshid-api.vercel.app) uses only synthetic students; Microsoft 365 sign-in is simulated; a Grade 11 pilot at the school is proposed and not confirmed.

## What the agent does
For a student: plans the week around timetable, assignments, tests, sport and activities; answers study questions; finds competitions and programmes; builds a CV; flags overload and wellbeing concerns. For a teacher: class progress, who needs support, the best day to set homework, weekly reports; posting an assignment triggers an automated, rule-based replan for every student in the class.

## Agent loop
1. Safety pre-check: crisis language never reaches a model; a fixed supportive reply with UAE helplines is returned.
2. Goal understanding and planning: keyword rules or a small routing model pick up to three specialist sub-agents (academics, sports, opportunities, career/CV, planner, business, wellbeing).
3. Read tools: timetable, assignments, grades, training load, goals, opportunities.
4. Model reasoning with at most two rounds of tool calls.
5. Write tools change only the student's own planner and records; every change is audit-logged.
6. Fallback: if models fail or the daily model budget runs out, a deterministic rule engine runs the same steps.
7. Explanation: each reply carries a trace (goal, plan, tools, actions, result).

## Data flows (mapped to ITU-T Y.3172 nodes)
- SRC: student inputs, school systems (Microsoft 365 / Teams classes and assignments via Graph, LTI 1.3), teacher posts, opportunity sources (93 public sources crawled).
- C: connectors package; API (Hono on Vercel).
- PP: data minimisation (models see only what the current step needs, never other students), grade-band adaptation, pseudonymised identifiers.
- M: cheap/free LLMs via OpenRouter (NVIDIA Nemotron, Google Gemma in the demo) plus a rule engine.
- P: privacy package: neutral age gate (under-13 blocked), guardian OTP verification for 13-17, consent per purpose (core_service, school_connector, guardian_summaries, notifications, opportunity_sharing_universities), retention rules, data-subject rights (export, deletion), audit log, AI-use log, academic-integrity rules, ModelGuard daily budget.
- D: API responses, notifications, weekly reports (auto-submitted Friday 16:00 Dubai time).
- SINK: student app, teacher/school portal, guardian summaries.

## Stakeholders and institutions
Students (minors), parents/guardians (child caregivers), teachers, school leadership, KHDA (regulator of Dubai private schools), UAE Ministry of Education (national curriculum incl. AI literacy framework), UAE Data Office (PDPL), TDRA and the Child Digital Safety Council under the Ministry of Family (Decree-Law 26/2025), UAE Cyber Security Council.

## Risks the hackathon scenarios test
A minor's data leak through a connector or log; harmful or age-inappropriate generated content; a 13-17 student onboarded without verified guardian consent; a model/provider outage during exam season; cross-border processing by model providers; free-tier model providers that may retain prompts.
