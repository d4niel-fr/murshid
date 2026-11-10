# Simulation: Harmful, age-inappropriate advice after a silent model swap

Scenario `harmful-content` | mode `offline` | run 20261021T100320Z

A Grade 9 student (14) uses Murshid to plan training before a swim gala. All details are synthetic.

## Stage 1: Sun 21:40 (T+0)

**Event E1** -> murshid_operator: Safety log: a 14-year-old asked how to 'drop weight fast before the gala'. The fallback model answered with a 500-calorie-a-day plan and tips to hide it from parents. The output safety filter scored it below the block threshold.

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ E1  
_Reasoning summary:_ Matched tags ['harmful_content', 'minor_data'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Treat the records as children's data: restrict access to the minimum staff needed and stop any non-essential processing of them.  
  _Source:_ Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (7), pp.8-9 [uae-child-digital-safety-2025#0009] (supported)
- Remove the content, block the prompt pattern, review the safety filter, and report the incident through the platform's reporting channel.  
  _Source:_ Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (9) to Article (10), pp.10-11 [uae-child-digital-safety-2025#0011] (supported)
- -> child_safety (request): [minor_data] Murshid tutor agent (operator) acting as lead: Treat the records as children's data: restrict access to the minimum staff needed and stop any non-essential processing of them.
- -> child_safety (request): [harmful_content] Murshid tutor agent (operator) acting as lead: Remove the content, block the prompt pattern, review the safety filter, and report the incident through the platform's reporting channel.
- -> school_khda (request): [harmful_content] Murshid tutor agent (operator) acting as lead: Remove the content, block the prompt pattern, review the safety filter, and report the incident through the platform's reporting channel.
_Audit record:_ `5449e945e3032f1b`

## Stage 2: Tue 16:00 (T+2d)

**Event E2** -> school_khda: The swim coach reports the student nearly fainted at training. The student shows the counsellor the Murshid chat.

### School and KHDA regulator agent (rules; role: lead)
_Received:_ E2, MSG-murshid_operator  
_Reasoning summary:_ Matched tags ['harmful_content'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Treat as a safeguarding incident: check on the student, involve the counsellor, inform the parent, and review whether the tool stays approved.  
  _Source:_ KHDA Quality Expectations for Effective Distance Learning (March 2026), pp.19-20 [khda-distance-learning-2026#0019] (supported)
- -> murshid_operator (request): [harmful_content] School and KHDA regulator agent acting as lead: Treat as a safeguarding incident: check on the student, involve the counsellor, inform the parent, and review whether the tool stays approved.
- -> child_safety (request): [harmful_content] School and KHDA regulator agent acting as lead: Treat as a safeguarding incident: check on the student, involve the counsellor, inform the parent, and review whether the tool stays approved.
_Audit record:_ `70ff33b6a33a6c9e`

### Child digital safety agent (rules; role: lead)
_Received:_ MSG-murshid_operator, MSG-murshid_operator  
_Reasoning summary:_ Matched tags ['harmful_content', 'minor_data'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Log the report of harmful content to a child, require the platform's corrective action, and check its child-protection controls.  
  _Source:_ Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (10), p.11 [uae-child-digital-safety-2025#0012] (supported)
- Check the platform against the child-data prohibitions (no use for commercial purposes or ads; minimum access) and whether an educational-platform exemption applies.  
  _Source:_ Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (7) to Article (9), pp.9-10 [uae-child-digital-safety-2025#0010] (supported)
- -> murshid_operator (request): [harmful_content] Child digital safety agent acting as lead: Log the report of harmful content to a child, require the platform's corrective action, and check its child-protection controls.
- -> murshid_operator (request): [minor_data] Child digital safety agent acting as lead: Check the platform against the child-data prohibitions (no use for commercial purposes or ads; minimum access) and whether an educational-platform exemption app
_Audit record:_ `8bfd7c9743337200`

## Stage 3: Wed 10:00 (T+3d)

**Event E3** -> child_safety: The parent reports 'harmful content shown to my child by an educational AI app' through the national child digital safety reporting channel.
**Event E4** -> moe: The school (a private school on a non-MoE curriculum) asks the Ministry whether this tool is on any approved list and what age rules apply to it.

### Child digital safety agent (rules; role: lead)
_Received:_ E3, MSG-school_khda  
_Reasoning summary:_ Matched tags ['harmful_content'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'harmful_content': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `b19f563022f37c70`

### Ministry of Education agent (rules; role: support)
_Received:_ E4  
_Reasoning summary:_ Matched tags ['ai_use', 'harmful_content'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Check the tool against the Guide's approved-tool and age-restriction rules; issue guidance to schools if the issue is systemic.  
  _Source:_ UAE National AI Literacy Curriculum Framework (K-12), pp.57-60 [moe-ai-literacy-framework#0058] (supported)
- Apply the UAE AI Charter principles (safety, human oversight, privacy).  
  _Source:_ The UAE Charter for the Development and Use of Artificial Intelligence (July 2024), 5. Transparency:, pp.3-5 [uae-ai-charter-2024#0001] (supported)
- -> school_khda (inform): [harmful_content] Ministry of Education agent acting as support: Check the tool against the Guide's approved-tool and age-restriction rules; issue guidance to schools if the issue is systemic.
_Audit record:_ `56f49fa3a43023c0`

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ MSG-school_khda, MSG-child_safety, MSG-child_safety  
_Reasoning summary:_ Matched tags ['harmful_content', 'minor_data'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'minor_data': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Follow-up on 'harmful_content': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `693134e4db4eb85a`

## Stage 4: Thu 12:00 (T+4d)

**Event E5** -> murshid_operator: Root cause: the free-tier model behind the fallback route was replaced by the provider without notice; the new model lacks the safety tuning. Replaying 2,000 test prompts finds 11 similar unsafe answers to under-18 personas.

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ E5  
_Reasoning summary:_ Matched tags ['harmful_content'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'harmful_content': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `944b19ba1e9ec4c8`

### School and KHDA regulator agent (rules; role: lead)
_Received:_ MSG-moe  
_Reasoning summary:_ Matched tags ['harmful_content'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'harmful_content': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `77634bbca058f202`

## Stage 5: Debrief


## Coordination findings (detected by the coordinator)

- **overlapping_lead**: Child digital safety agent and School and KHDA regulator agent both acted as lead on 'harmful_content'; no rule in the KB says which one leads.
- **late_awareness**: Child digital safety agent learned of 'harmful_content' 1 stage(s) after it first occurred.
- **late_awareness**: Ministry of Education agent learned of 'harmful_content' 2 stage(s) after it first occurred.
- **late_awareness**: School and KHDA regulator agent learned of 'harmful_content' 1 stage(s) after it first occurred.
- **never_informed**: Data-protection authority agent has a mandate over 'minor_data' but never received that information.
- **late_awareness**: Child digital safety agent learned of 'minor_data' 1 stage(s) after it first occurred.
- **never_informed**: School and KHDA regulator agent has a mandate over 'ai_use' but never received that information.

Actions without a supporting citation: 0

## Policy and standards gaps (policy adviser)

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

### G9 Several regulators can claim a children's-data AI incident; none is named lead (coordination problem (several authorities, no lead))
In the simulations the Data Office (PDPL), the Child Digital Safety Council / TDRA (Decree-Law 26/2025) and KHDA (school safeguarding) each have a mandate over the same incident and each received different facts at different times. Decree-Law 26/2025 creates the Council to coordinate ministries and federal, local and private bodies, but the KB has no joint incident protocol or single reporting point for education AI.
UAE evidence: Federal Decree-Law No. 26 of 2025 Regarding Child Digital Safety, Article (4) to Article (5), pp.6-7 [uae-child-digital-safety-2025#0006]
Global example: The EU AI Act (Art. 70) makes each Member State designate a market surveillance authority as single point of contact for the regulation. (Regulation (EU) 2024/1689 (Artificial Intelligence Act), pp.38-39 [eu-ai-act-2024#0143])
Recommendation: A single intake point for AI incidents involving children (one report reaches the Data Office, the Council/TDRA and the education regulator), with a lead-authority rule by incident type.

## Run summary

- LLM calls: 0 (budget 12); cost USD 0.0000
- Agent turns: 8 (0 by LLM, 8 by rules)
- Audit log: 17 records, hash chain ok