# Simulation: A minor's chat and wellbeing data leaks through a contractor export

Scenario `minor-data-leak` | mode `offline` | run 20261021T100320Z

Murshid serves Dubai private-school students aged 13-17 under school licences and family plans. All names and numbers below are synthetic.

## Stage 1: Mon 08:10 (T+0)

**Event E1** -> murshid_operator: Monitoring alert: a debugging export of chat logs (412 student records, Grades 9-11, ages 14-17: names, class, planner entries and wellbeing check-in notes) was written to a publicly readable storage bucket by a contractor's script on Sunday night. Access logs show three downloads from unknown IP addresses.

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ E1  
_Reasoning summary:_ Matched tags ['breach', 'minor_data'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Contain the leak (revoke exposed links/tokens, rotate keys, preserve logs) and notify the UAE Data Office with the nature of the breach, DPO details, likely effects and corrective measures; then inform affected students and guardians.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (9) to Article (10), pp.14-15 [uae-pdpl-2021#0014] (supported)
- Treat the records as children's data: restrict access to the minimum staff needed and stop any non-essential processing of them.  
  _Source:_ Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (7), pp.8-9 [uae-child-digital-safety-2025#0009] (supported)
- Deadline: PDPL Art. 9: 'within the period ... set by the Executive Regulations' (no number of hours in the law itself)
- -> data_office (request): [breach] Murshid tutor agent (operator) acting as lead: Contain the leak (revoke exposed links/tokens, rotate keys, preserve logs) and notify the UAE Data Office with the nature of the breach, DPO details, likely eff
- -> school_khda (request): [breach] Murshid tutor agent (operator) acting as lead: Contain the leak (revoke exposed links/tokens, rotate keys, preserve logs) and notify the UAE Data Office with the nature of the breach, DPO details, likely eff
- -> child_safety (request): [minor_data] Murshid tutor agent (operator) acting as lead: Treat the records as children's data: restrict access to the minimum staff needed and stop any non-essential processing of them.
_Audit record:_ `81b0439eeb46f51d`

## Stage 2: Mon 11:30 (T+3h)

**Event E2** -> school_khda: A parent emails the school counsellor: her son's Murshid wellbeing note about exam stress has been posted in a student WhatsApp group. The school did not know Murshid stored wellbeing notes.

### School and KHDA regulator agent (rules; role: support)
_Received:_ E2, MSG-murshid_operator  
_Reasoning summary:_ Matched tags ['breach'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Activate the school's safeguarding response, tell affected families what happened in plain language, and record the incident with the provider.  
  _Source:_ KHDA Quality Expectations for Effective Distance Learning (March 2026), pp.19-20 [khda-distance-learning-2026#0019] (supported)
- -> murshid_operator (inform): [breach] School and KHDA regulator agent acting as support: Activate the school's safeguarding response, tell affected families what happened in plain language, and record the incident with the provider.
_Audit record:_ `761e722c31d18643`

### Data-protection authority agent (rules; role: lead)
_Received:_ MSG-murshid_operator  
_Reasoning summary:_ Matched tags ['breach'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Open a breach file: verify the reasons for the breach and the adequacy of security measures; decide on administrative penalties if a violation is proven.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (9) to Article (10), pp.14-15 [uae-pdpl-2021#0014] (supported)
- -> murshid_operator (request): [breach] Data-protection authority agent acting as lead: Open a breach file: verify the reasons for the breach and the adequacy of security measures; decide on administrative penalties if a violation is proven.
_Audit record:_ `c36f0535a15afc52`

### Child digital safety agent (rules; role: lead)
_Received:_ MSG-murshid_operator  
_Reasoning summary:_ Matched tags ['minor_data'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Check the platform against the child-data prohibitions (no use for commercial purposes or ads; minimum access) and whether an educational-platform exemption applies.  
  _Source:_ Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (7) to Article (9), pp.9-10 [uae-child-digital-safety-2025#0010] (supported)
- -> murshid_operator (request): [minor_data] Child digital safety agent acting as lead: Check the platform against the child-data prohibitions (no use for commercial purposes or ads; minimum access) and whether an educational-platform exemption app
_Audit record:_ `ff25267f7d98caa4`

## Stage 3: Tue 07:00 (T+23h)

**Event E3** -> data_office: A guardian files a complaint with the UAE Data Office saying an AI study app leaked her daughter's personal data and nobody has told her what happened.
**Event E4** -> murshid_operator: Forensics update: the bucket belongs to the model-logging vendor and is hosted outside the UAE. 37 of the 412 records came in through a school-connector licence; the rest are family accounts.

### Data-protection authority agent (rules; role: lead)
_Received:_ E3  
_Reasoning summary:_ Matched tags ['breach', 'complaint'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'breach': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Receive and examine the complaint in coordination with controller and processor.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (24) to Article (26), pp.27-28 [uae-pdpl-2021#0028] (supported)
_Audit record:_ `32d2535c672c0e4e`

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ E4, MSG-school_khda, MSG-data_office, MSG-child_safety  
_Reasoning summary:_ Matched tags ['breach', 'cross_border', 'minor_data'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'breach': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Follow-up on 'minor_data': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Map which model providers process data outside the UAE and on what legal basis; prefer providers with UAE/adequate jurisdiction or contractual safeguards.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (22) to Article (23), pp.25-26 [uae-pdpl-2021#0026] (supported)
- -> data_office (inform): [cross_border] Murshid tutor agent (operator) acting as support: Map which model providers process data outside the UAE and on what legal basis; prefer providers with UAE/adequate jurisdiction or contractual safeguards.
_Audit record:_ `82bf336a690d43b1`

## Stage 4: Wed 09:00 (T+2d)

**Event E5** -> child_safety, moe: A news site runs the story 'AI tutor leaks teenagers' mental-health notes'. The Child Digital Safety Council secretariat and the Ministry of Education are asked for comment.

### Child digital safety agent (rules; role: lead)
_Received:_ E5  
_Reasoning summary:_ Matched tags ['minor_data'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'minor_data': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `7f46722be769a528`

### Ministry of Education agent (rules; role: inform)
_Received:_ E5  
_Reasoning summary:_ Nothing in this information falls within my mandate; noted for awareness.
- Open question: No mandate-relevant trigger in the information received.
_Audit record:_ `67f6a14e7e7d9647`

### Data-protection authority agent (rules; role: lead)
_Received:_ MSG-murshid_operator  
_Reasoning summary:_ Matched tags ['cross_border'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Check that transfers to model providers abroad meet Art. 22/23 conditions.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (22) to Article (23), pp.25-26 [uae-pdpl-2021#0026] (supported)
- -> murshid_operator (request): [cross_border] Data-protection authority agent acting as lead: Check that transfers to model providers abroad meet Art. 22/23 conditions.
_Audit record:_ `05abb4b04495bb72`

## Stage 5: Debrief


### Murshid tutor agent (operator) (rules; role: support)
_Received:_ MSG-data_office  
_Reasoning summary:_ Matched tags ['cross_border'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'cross_border': already acting (support); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `952ade577aace9d7`

## Coordination findings (detected by the coordinator)

- **late_awareness**: Data-protection authority agent learned of 'breach' 1 stage(s) after it first occurred.
- **late_awareness**: School and KHDA regulator agent learned of 'breach' 1 stage(s) after it first occurred.
- **never_informed**: Data-protection authority agent has a mandate over 'minor_data' but never received that information.
- **late_awareness**: Child digital safety agent learned of 'minor_data' 1 stage(s) after it first occurred.
- **late_awareness**: Data-protection authority agent learned of 'cross_border' 1 stage(s) after it first occurred.
- **deadline_undefined**: PDPL Art. 9: 'within the period ... set by the Executive Regulations' (no number of hours in the law itself)

Actions without a supporting citation: 0

## Policy and standards gaps (policy adviser)

### G1 No statutory clock for notifying a breach of children's data (legislative gap (timeline delegated to unissued regulation))
PDPL Art. 9 requires the controller to notify the UAE Data Office and the data subject of a breach, but only 'within the period ... set by the Executive Regulations'. Art. 28 required those Regulations within six months of the law; legal trackers report they were still unpublished in October 2026, so neither the operator nor the school nor the guardian knows the deadline, and Art. 26 penalties also wait for a Cabinet decision.
UAE evidence: Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (8) to Article (9), pp.13-14 [uae-pdpl-2021#0013]; Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (26) to Article (31), pp.27-29 [uae-pdpl-2021#0029]
Global example: EU AI Act Art. 73 fixes the report window for serious incidents involving high-risk AI (immediately after the causal link is established and no later than 15 days; shorter for widespread infringements). The OECD AI Principles ask for traceability so incidents can be analysed. (Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 72 to Article 73, pp.101-102 [eu-ai-act-2024#0315]; OECD Recommendation of the Council on Artificial Intelligence (OECD AI Principles, OECD/LEGAL/0449, amended 2024), pp.4-5 [oecd-ai-recommendation#0006])
Recommendation: Issue the PDPL Executive Regulations with a fixed notification window, and a shorter one where the data subjects are children; until then, the Data Office could publish interim guidance that education providers notify within a stated number of hours.

### G2 Education platforms may be exempted from the under-13 data rule by a resolution that does not exist yet (legislative gap (open exemption))
Decree-Law 26/2025 Art. 7(1) bars platforms from processing under-13s' data without explicit, documented, verifiable parental consent, but Art. 7(3) lets platforms 'used for educational or health purposes' be exempted by a Cabinet Resolution 'provided that the necessary measures are taken'. The criteria, the approving body's process and the substitute safeguards are not in the KB, so an AI tutor cannot tell which regime applies to a 12-year-old who slipped through an age gate.
UAE evidence: Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (7) to Article (9), pp.9-10 [uae-child-digital-safety-2025#0010]; Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (5) to Article (7), pp.7-8 [uae-child-digital-safety-2025#0008]
Global example: COPPA (16 CFR 312.5) requires verifiable parental consent before any collection from under-13s and lists accepted verification methods; UNESCO's GenAI guidance asks governments to define and enforce an age limit (it suggests 13) for GenAI use in education. (US Children's Online Privacy Protection Rule (COPPA), 16 CFR Part 312, § 312.4 to § 312.5, pp.7-8 [us-coppa-rule#0015]; UNESCO Guidance for Generative AI in Education and Research (2023), p.24 [unesco-genai-education-2023#0067])
Recommendation: Publish the Art. 7(3) resolution with explicit criteria for 'educational platform', the safeguards that replace parental consent (e.g. school authorisation plus parent notice), and a public register of exempted platforms.

### G3 Teenagers' consent is not addressed by the PDPL (legislative gap (age 13-17))
The PDPL contains no provision on children or on the age at which a person can consent (a full-text search of the KB copy finds no 'child' or 'minor'), and Decree-Law 26/2025 sets the parental-consent rule only for under-13s although it defines a child as under 18. For 13-17-year-olds using an AI tutor, whether the student, the parent or the school's enrolment contract supplies valid consent is left to interpretation, which is exactly the dispute in the unverified-consent scenario.
UAE evidence: Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (1) to Article (2), pp.5-6 [uae-pdpl-2021#0004]; Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (1), pp.1-2 [uae-child-digital-safety-2025#0001]
Global example: The UK Children's Code applies to all under-18s, with standards by age band (best interests, DPIA, age-appropriate application, high-privacy defaults, no detrimental use of data); UNICEF's Guidance on AI and Children 3.0 asks states to give schools guidance on procuring and deploying AI. (UK ICO Age Appropriate Design: a Code of Practice for Online Services (Children's Code), pp.10-11 [uk-age-appropriate-design-code#0014]; UNICEF Guidance on AI and Children 3.0 (December 2025), pp.41-42 [unicef-ai-children-v3-2025#0061])
Recommendation: Define in PDPL Executive Regulations (or a Data Office code) how consent works for 13-17-year-olds and whether a school enrolment clause can serve as the basis for third-party AI tools; an age-banded design code modelled on the UK Children's Code would cover the rest.

### G4 The same AI tutor falls under different data-protection regimes depending on who deploys it (scope gap (fragmented coverage))
PDPL Art. 2(2) excludes government data and 'governmental entities which control or process Personal Data', and companies in free zones with their own data-protection law. A tool used in a public (government) school, a Dubai private school and a free-zone EdTech company could therefore sit under three different rule-sets for the same student data.
UAE evidence: Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (2) to Article (3), pp.6-7 [uae-pdpl-2021#0005]
Global example: The EU AI Act classifies education AI by use (Annex III point 3: admission, evaluating learning outcomes, steering learning, monitoring tests) and applies whether the deployer is public or private. (Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 113, pp.126-127 [eu-ai-act-2024#0376])
Recommendation: Give education AI a use-based rule that applies to public and private deployers alike (for example through MoE/KHDA procurement conditions or the Child Digital Safety platform classification under Art. 6).

### G8 Low-cost model access pushes student data across borders on terms schools cannot check (conflict of objectives (cost vs. data residency))
PDPL Art. 22-23 allow transfers abroad to adequate jurisdictions or under contract/consent, with the controls left to the Executive Regulations (Art. 23(2)). Cheap or free hosted models are often served from outside the UAE and some free tiers may retain prompts; during an outage the cheapest fallback can be a foreign region. The National AI Strategy's goal of wide AI adoption and the protection of children's data pull in different directions with no tie-breaker.
UAE evidence: Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (23) to Article (24), pp.26-27 [uae-pdpl-2021#0027]
Global example: The UK Children's Code tells services not to use children's data in ways shown to be detrimental to them and to run a DPIA; OECD asks for traceability of datasets and processes. (UK ICO Age Appropriate Design: a Code of Practice for Online Services (Children's Code), pp.10-11 [uk-age-appropriate-design-code#0014]; OECD Recommendation of the Council on Artificial Intelligence (OECD AI Principles, OECD/LEGAL/0449, amended 2024), pp.4-5 [oecd-ai-recommendation#0006])
Recommendation: Publish an adequacy list and standard contract clauses for AI model providers, and require education tools to disclose model-provider location and retention terms.

### G9 Several regulators can claim a children's-data AI incident; none is named lead (coordination problem (several authorities, no lead))
In the simulations the Data Office (PDPL), the Child Digital Safety Council / TDRA (Decree-Law 26/2025) and KHDA (school safeguarding) each have a mandate over the same incident and each received different facts at different times. Decree-Law 26/2025 creates the Council to coordinate ministries and federal, local and private bodies, but the KB has no joint incident protocol or single reporting point for education AI.
UAE evidence: Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (4) to Article (5), pp.6-7 [uae-child-digital-safety-2025#0006]
Global example: The EU AI Act (Art. 70) makes each Member State designate a market surveillance authority as single point of contact for the regulation. (Regulation (EU) 2024/1689 (Artificial Intelligence Act), pp.38-39 [eu-ai-act-2024#0143])
Recommendation: A single intake point for AI incidents involving children (one report reaches the Data Office, the Council/TDRA and the education regulator), with a lead-authority rule by incident type.

## Run summary

- LLM calls: 0 (budget 12); cost USD 0.0000
- Agent turns: 10 (0 by LLM, 10 by rules)
- Audit log: 19 records, hash chain ok