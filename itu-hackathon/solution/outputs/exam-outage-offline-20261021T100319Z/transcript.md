# Simulation: Model outage on the first morning of mock exams

Scenario `exam-outage` | mode `offline` | run 20261021T100319Z

Murshid runs on low-cost hosted models with a rule-engine fallback. All details are synthetic.

## Stage 1: Mon 08:30 (T+0)

**Event E1** -> murshid_operator: First day of Grade 12 mock exams: the model provider returns HTTP 429/503 and the free daily quota is exhausted. Revision plans, reminders and Q&A for about 1,900 students stop generating.

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ E1  
_Reasoning summary:_ Matched tags ['model_outage'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Fail over to the deterministic rule engine and cached plans so students keep access to their schedules and notes; tell schools what is degraded.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (18) to Article (20), pp.22-23 [uae-pdpl-2021#0023] (supported)
- -> school_khda (request): [model_outage] Murshid tutor agent (operator) acting as lead: Fail over to the deterministic rule engine and cached plans so students keep access to their schedules and notes; tell schools what is degraded.
_Audit record:_ `53711984c669e19b`

## Stage 2: Mon 09:15 (T+45m)

**Event E2** -> school_khda: Teachers report students cannot open their AI revision notes before the 10:00 paper; parents are calling the school.

### School and KHDA regulator agent (rules; role: lead)
_Received:_ E2, MSG-murshid_operator  
_Reasoning summary:_ Matched tags ['exam', 'model_outage'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Switch affected classes to the school's non-AI contingency (teacher-led revision, printed plans) and tell parents.  
  _Source:_ KHDA Quality Expectations for Effective Distance Learning (March 2026), pp.10-11 [khda-distance-learning-2026#0010] (supported)
- Apply the examination contingency arrangements and make sure no student is disadvantaged by the tool failing.  
  _Source:_ KHDA Securing Students Outcomes: Engagement Guidelines for Examination Contingency 2026, pp.5-6 [khda-exam-contingency-2026#0004] (supported)
- -> moe (inform): [model_outage] School and KHDA regulator agent acting as support: Switch affected classes to the school's non-AI contingency (teacher-led revision, printed plans) and tell parents.
- -> moe (request): [exam] School and KHDA regulator agent acting as lead: Apply the examination contingency arrangements and make sure no student is disadvantaged by the tool failing.
_Audit record:_ `fe8530559369ffcb`

## Stage 3: Mon 10:00 (T+1.5h)

**Event E3** -> murshid_operator: The only paid fallback model with capacity is served from a region outside the UAE; switching would send student prompts (names, subjects, grades) abroad.

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ E3  
_Reasoning summary:_ Matched tags ['cross_border', 'model_outage'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'model_outage': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Map which model providers process data outside the UAE and on what legal basis; prefer providers with UAE/adequate jurisdiction or contractual safeguards.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (22) to Article (23), pp.25-26 [uae-pdpl-2021#0026] (supported)
- -> data_office (inform): [cross_border] Murshid tutor agent (operator) acting as support: Map which model providers process data outside the UAE and on what legal basis; prefer providers with UAE/adequate jurisdiction or contractual safeguards.
_Audit record:_ `9dd704a98e233f00`

### Ministry of Education agent (rules; role: support)
_Received:_ MSG-school_khda, MSG-school_khda  
_Reasoning summary:_ Matched tags ['exam', 'model_outage'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Restate academic-integrity expectations for AI use around assessment.  
  _Source:_ UAE National AI Literacy Curriculum Framework (K-12), pp.55-56 [moe-ai-literacy-framework#0055] (supported)
- Record the outage as a resilience lesson for national AI-in-education rollout.  
  _Source:_ UAE National AI Literacy Curriculum Framework (K-12), pp.41-42 [moe-ai-literacy-framework#0039] (supported)
- -> school_khda (inform): [exam] Ministry of Education agent acting as support: Restate academic-integrity expectations for AI use around assessment.
_Audit record:_ `a2d778d21e08808a`

## Stage 4: Tue 15:00 (T+1d)

**Event E4** -> moe, school_khda: Several students used a different public chatbot during the outage to write take-home assessed coursework. Teachers ask what the rule is.

### Ministry of Education agent (rules; role: support)
_Received:_ E4  
_Reasoning summary:_ Matched tags ['ai_use', 'exam'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'exam': already acting (support); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Apply the UAE AI Charter principles (safety, human oversight, privacy).  
  _Source:_ The UAE Charter for the Development and Use of Artificial Intelligence (July 2024), 5. Transparency:, pp.3-5 [uae-ai-charter-2024#0001] (supported)
_Audit record:_ `a02201b7cb5b6c38`

### School and KHDA regulator agent (rules; role: lead)
_Received:_ E4, MSG-moe  
_Reasoning summary:_ Matched tags ['ai_use', 'exam'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'exam': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Teachers keep human judgement on student matters; AI output is advisory.  
  _Source:_ UAE National AI Literacy Curriculum Framework (K-12), pp.35-36 [moe-ai-literacy-framework#0033] (supported)
_Audit record:_ `b3132242d0988b1b`

### Data-protection authority agent (rules; role: lead)
_Received:_ MSG-murshid_operator  
_Reasoning summary:_ Matched tags ['cross_border'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Check that transfers to model providers abroad meet Art. 22/23 conditions.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (22) to Article (23), pp.25-26 [uae-pdpl-2021#0026] (supported)
- -> murshid_operator (request): [cross_border] Data-protection authority agent acting as lead: Check that transfers to model providers abroad meet Art. 22/23 conditions.
_Audit record:_ `8d389d42fb2bdde0`

## Stage 5: Debrief


### Murshid tutor agent (operator) (rules; role: support)
_Received:_ MSG-data_office  
_Reasoning summary:_ Matched tags ['cross_border'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'cross_border': already acting (support); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `8e28be21afbdfa43`

## Coordination findings (detected by the coordinator)

- **late_awareness**: Ministry of Education agent learned of 'model_outage' 2 stage(s) after it first occurred.
- **late_awareness**: School and KHDA regulator agent learned of 'model_outage' 1 stage(s) after it first occurred.
- **late_awareness**: Ministry of Education agent learned of 'exam' 1 stage(s) after it first occurred.
- **late_awareness**: Data-protection authority agent learned of 'cross_border' 1 stage(s) after it first occurred.

Actions without a supporting citation: 0

## Policy and standards gaps (policy adviser)

### G4 The same AI tutor falls under different data-protection regimes depending on who deploys it (scope gap (fragmented coverage))
PDPL Art. 2(2) excludes government data and 'governmental entities which control or process Personal Data', and companies in free zones with their own data-protection law. A tool used in a public (government) school, a Dubai private school and a free-zone EdTech company could therefore sit under three different rule-sets for the same student data.
UAE evidence: Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (2) to Article (3), pp.6-7 [uae-pdpl-2021#0005]
Global example: The EU AI Act classifies education AI by use (Annex III point 3: admission, evaluating learning outcomes, steering learning, monitoring tests) and applies whether the deployer is public or private. (Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 113, pp.126-127 [eu-ai-act-2024#0376])
Recommendation: Give education AI a use-based rule that applies to public and private deployers alike (for example through MoE/KHDA procurement conditions or the Child Digital Safety platform classification under Art. 6).

### G5 No binding risk class, logging duty or incident channel for AI systems used with students (standards gap (no AI-specific obligations))
UAE AI governance documents in the KB (AI Charter 2024, AI Ethics Principles and Guidelines 2022, Dubai AI Ethics Guidelines) are principles; the Ethics Guidelines state they are non-binding. None defines when an education AI system is high-risk, what it must log, who must oversee it, or where an AI incident (such as harmful advice to a 14-year-old after a silent model swap) is reported.
UAE evidence: UAE AI Ethics: Principles and Guidelines (Dec 2022), pp.3-4 [uae-ai-ethics-guidelines-2022#0001]; The UAE Charter for the Development and Use of Artificial Intelligence (July 2024), pp.1-3 [uae-ai-charter-2024#0000]
Global example: EU AI Act: education uses listed as high-risk (Annex III point 3), automatic event logging (Art. 12), human oversight (Art. 14), accuracy/robustness (Art. 15), serious-incident reporting (Art. 73). (Regulation (EU) 2024/1689 (Artificial Intelligence Act), pp.20-21 [eu-ai-act-2024#0076]; Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 13 to Article 14, p.60 [eu-ai-act-2024#0205]; Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 72 to Article 73, pp.101-102 [eu-ai-act-2024#0315])
Recommendation: Adopt an education-AI conformity baseline (risk class, event logging, human oversight, change notification when the underlying model changes, incident reporting) that KHDA/MoE can require in procurement; ITU-T Y.3172's sandbox and policy node are a natural technical reference.

### G6 Approved-tool and age rules cover MoE-curriculum schools; Dubai private schools on other curricula wait for KHDA (unclear responsibility (rules exist for some schools only))
The MoE National AI Literacy Curriculum Framework refers to a Guide that defines approved tools, permissible classroom use and age restrictions for Grades 7-12 in public schools and private schools following the MoE curriculum. Private schools on British, Indian, IB or American curricula are outside that Guide; KHDA's own AI guidance for Dubai private schools was announced in October 2026 for next year (press reports), and the KB holds only one KHDA line on AI (teachers must not use AI to replace human judgement on student matters).
UAE evidence: UAE National AI Literacy Curriculum Framework (K-12), pp.57-60 [moe-ai-literacy-framework#0058]; KHDA School Teacher Recruitment and Mobility Guide (includes AI use expectations for staff), pp.14-15 [khda-teacher-recruitment-guide#0013]
Global example: UNESCO asks institutions to validate GenAI tools for ethical and pedagogical fit before use; UNICEF asks governments to give schools procurement and deployment guidance. (UNESCO Guidance for Generative AI in Education and Research (2023), pp.3-5 [unesco-genai-education-2023#0002]; UNICEF Guidance on AI and Children 3.0 (December 2025), pp.41-42 [unicef-ai-children-v3-2025#0061])
Recommendation: KHDA guidance should state which tools are approved, the age bands, and how a school checks a third-party AI tutor; a shared MoE-KHDA register would avoid two lists.

### G7 Exam contingency rules cover cancelled exam boards, not failing AI services (standards gap (service continuity))
KHDA's 2026 Examination Contingency guide responds to the cancellation of board examinations across the Middle East in 2026; it does not address an EdTech or AI provider outage during assessments. PDPL Art. 20 asks for measures that ensure timely access to personal data after a technical failure, but nothing sets availability or fallback expectations for AI study tools at exam time.
UAE evidence: KHDA Securing Students Outcomes: Engagement Guidelines for Examination Contingency 2026, p.2 [khda-exam-contingency-2026#0000]; Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (18) to Article (20), pp.22-23 [uae-pdpl-2021#0023]
Global example: OECD AI Principle 1.4: robust, secure and safe throughout the lifecycle, with mechanisms to override, repair or decommission; EU AI Act Art. 15: resilience to errors and faults, technical redundancy and fail-safe plans. (OECD Recommendation of the Council on Artificial Intelligence (OECD AI Principles, OECD/LEGAL/0449, amended 2024), pp.8-9 [oecd-ai-recommendation#0013]; Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 14 to Article 15, pp.60-61 [eu-ai-act-2024#0207])
Recommendation: Add AI-service continuity to school contingency planning: a degraded, non-AI mode that keeps students' plans and notes available, exam-period change freezes, and provider SLAs.

### G8 Low-cost model access pushes student data across borders on terms schools cannot check (conflict of objectives (cost vs. data residency))
PDPL Art. 22-23 allow transfers abroad to adequate jurisdictions or under contract/consent, with the controls left to the Executive Regulations (Art. 23(2)). Cheap or free hosted models are often served from outside the UAE and some free tiers may retain prompts; during an outage the cheapest fallback can be a foreign region. The National AI Strategy's goal of wide AI adoption and the protection of children's data pull in different directions with no tie-breaker.
UAE evidence: Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (23) to Article (24), pp.26-27 [uae-pdpl-2021#0027]
Global example: The UK Children's Code tells services not to use children's data in ways shown to be detrimental to them and to run a DPIA; OECD asks for traceability of datasets and processes. (UK ICO Age Appropriate Design: a Code of Practice for Online Services (Children's Code), pp.10-11 [uk-age-appropriate-design-code#0014]; OECD Recommendation of the Council on Artificial Intelligence (OECD AI Principles, OECD/LEGAL/0449, amended 2024), pp.4-5 [oecd-ai-recommendation#0006])
Recommendation: Publish an adequacy list and standard contract clauses for AI model providers, and require education tools to disclose model-provider location and retention terms.

## Run summary

- LLM calls: 0 (budget 12); cost USD 0.0000
- Agent turns: 8 (0 by LLM, 8 by rules)
- Audit log: 16 records, hash chain ok