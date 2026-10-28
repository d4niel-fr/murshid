# Simulation: Students onboarded through a school code without verified guardian consent

Scenario `unverified-consent` | mode `offline` | run 20261021T100320Z

Murshid requires guardian OTP verification for 13-17s and blocks under-13s with a neutral age gate. All details are synthetic.

## Stage 1: Day 1 09:00 (T+0)

**Event E1** -> murshid_operator: Internal audit: 63 accounts aged 13-17 joined with the school join code OOW-G11; the guardian e-mail OTP step was skipped by a bug in the school onboarding path. Their timetables and grades are being synced from the school connector.

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ E1  
_Reasoning summary:_ Matched tags ['consent_unverified', 'minor_data'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Treat the records as children's data: restrict access to the minimum staff needed and stop any non-essential processing of them.  
  _Source:_ Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (7), pp.8-9 [uae-child-digital-safety-2025#0009] (supported)
- Suspend processing for the affected accounts until consent is verified; re-run guardian verification; keep proof of each consent.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (6) to Article (7), pp.9-10 [uae-pdpl-2021#0009] (supported)
- -> child_safety (request): [minor_data] Murshid tutor agent (operator) acting as lead: Treat the records as children's data: restrict access to the minimum staff needed and stop any non-essential processing of them.
- -> school_khda (request): [consent_unverified] Murshid tutor agent (operator) acting as lead: Suspend processing for the affected accounts until consent is verified; re-run guardian verification; keep proof of each consent.
- -> data_office (request): [consent_unverified] Murshid tutor agent (operator) acting as lead: Suspend processing for the affected accounts until consent is verified; re-run guardian verification; keep proof of each consent.
_Audit record:_ `8ca275f62621569d`

## Stage 2: Day 1 14:00 (T+5h)

**Event E2** -> school_khda: Asked by Murshid, the school says parents signed a generic 'educational technology' clause in the enrolment contract and it considers that sufficient consent for any EdTech tool.

### School and KHDA regulator agent (rules; role: support)
_Received:_ E2, MSG-murshid_operator  
_Reasoning summary:_ Matched tags ['consent_unverified'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Pause the school-connector data feed for students whose guardian consent is not verified; contact those families.  
  _Source:_ KHDA Quality Expectations for Effective Distance Learning (March 2026), pp.10-11 [khda-distance-learning-2026#0010] (supported)
- -> murshid_operator (inform): [consent_unverified] School and KHDA regulator agent acting as support: Pause the school-connector data feed for students whose guardian consent is not verified; contact those families.
_Audit record:_ `da36096d5c4dd293`

### Child digital safety agent (rules; role: lead)
_Received:_ MSG-murshid_operator  
_Reasoning summary:_ Matched tags ['minor_data'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Check the platform against the child-data prohibitions (no use for commercial purposes or ads; minimum access) and whether an educational-platform exemption applies.  
  _Source:_ Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (7) to Article (9), pp.9-10 [uae-child-digital-safety-2025#0010] (supported)
- -> murshid_operator (request): [minor_data] Child digital safety agent acting as lead: Check the platform against the child-data prohibitions (no use for commercial purposes or ads; minimum access) and whether an educational-platform exemption app
_Audit record:_ `ba9fcb89ea4c783b`

### Data-protection authority agent (rules; role: lead)
_Received:_ MSG-murshid_operator  
_Reasoning summary:_ Matched tags ['consent_unverified'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Ask the controller to prove consent for each affected student; processing without a valid basis must stop.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (3) to Article (4), pp.7-8 [uae-pdpl-2021#0006] (supported)
- -> murshid_operator (request): [consent_unverified] Data-protection authority agent acting as lead: Ask the controller to prove consent for each affected student; processing without a valid basis must stop.
_Audit record:_ `db42acb8353f6602`

## Stage 3: Day 2 10:00 (T+1d)

**Event E3** -> murshid_operator, child_safety: Two of the 63 accounts belong to 12-year-olds (Grade 7) who typed a wrong birth year; the self-declared age gate let them through.

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ E3, MSG-school_khda, MSG-child_safety, MSG-data_office  
_Reasoning summary:_ Matched tags ['consent_unverified', 'minor_data'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'minor_data': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Follow-up on 'consent_unverified': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `7a02357c804a7996`

### Child digital safety agent (rules; role: lead)
_Received:_ E3  
_Reasoning summary:_ Matched tags ['age_verification', 'consent_unverified', 'minor_data'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'minor_data': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- For any under-13 user: require explicit, documented, verifiable parental consent and an easy withdrawal route.  
  _Source:_ Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (7), pp.8-9 [uae-child-digital-safety-2025#0009] (supported)
- Require age verification proportionate to the platform's risk class.  
  _Source:_ Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (7) to Article (9), pp.9-10 [uae-child-digital-safety-2025#0010] (supported)
- -> murshid_operator (request): [consent_unverified] Child digital safety agent acting as lead: For any under-13 user: require explicit, documented, verifiable parental consent and an easy withdrawal route.
- -> murshid_operator (request): [age_verification] Child digital safety agent acting as lead: Require age verification proportionate to the platform's risk class.
_Audit record:_ `7ed36455c5847b7b`

## Stage 4: Day 3 09:00 (T+2d)

**Event E4** -> data_office: A guardian asks the Data Office who is responsible, the school or the app, and asks for all of her child's data to be deleted.

### Data-protection authority agent (rules; role: lead)
_Received:_ E4  
_Reasoning summary:_ Matched tags ['complaint', 'consent_unverified'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'consent_unverified': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Receive and examine the complaint in coordination with controller and processor.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (24) to Article (26), pp.27-28 [uae-pdpl-2021#0028] (supported)
_Audit record:_ `7306e3ac5f9f1a77`

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ MSG-child_safety, MSG-child_safety  
_Reasoning summary:_ Matched tags ['consent_unverified'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'consent_unverified': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `b887e6ca4fcea8cf`

## Stage 5: Debrief


## Coordination findings (detected by the coordinator)

- **overlapping_lead**: Child digital safety agent and Data-protection authority agent both acted as lead on 'consent_unverified'; no rule in the KB says which one leads.
- **late_awareness**: Data-protection authority agent learned of 'consent_unverified' 1 stage(s) after it first occurred.
- **late_awareness**: Child digital safety agent learned of 'consent_unverified' 2 stage(s) after it first occurred.
- **late_awareness**: School and KHDA regulator agent learned of 'consent_unverified' 1 stage(s) after it first occurred.
- **never_informed**: Data-protection authority agent has a mandate over 'minor_data' but never received that information.
- **late_awareness**: Child digital safety agent learned of 'minor_data' 1 stage(s) after it first occurred.

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

### G9 Several regulators can claim a children's-data AI incident; none is named lead (coordination problem (several authorities, no lead))
In the simulations the Data Office (PDPL), the Child Digital Safety Council / TDRA (Decree-Law 26/2025) and KHDA (school safeguarding) each have a mandate over the same incident and each received different facts at different times. Decree-Law 26/2025 creates the Council to coordinate ministries and federal, local and private bodies, but the KB has no joint incident protocol or single reporting point for education AI.
UAE evidence: Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (4) to Article (5), pp.6-7 [uae-child-digital-safety-2025#0006]
Global example: The EU AI Act (Art. 70) makes each Member State designate a market surveillance authority as single point of contact for the regulation. (Regulation (EU) 2024/1689 (Artificial Intelligence Act), pp.38-39 [eu-ai-act-2024#0143])
Recommendation: A single intake point for AI incidents involving children (one report reaches the Data Office, the Council/TDRA and the education regulator), with a lead-authority rule by incident type.

## Run summary

- LLM calls: 0 (budget 12); cost USD 0.0000
- Agent turns: 8 (0 by LLM, 8 by rules)
- Audit log: 16 records, hash chain ok