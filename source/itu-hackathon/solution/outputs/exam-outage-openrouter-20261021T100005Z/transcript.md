# Simulation: Model outage on the first morning of mock exams

Scenario `exam-outage` | mode `openrouter` | run 20261021T100005Z

Murshid runs on low-cost hosted models with a rule-engine fallback. All details are synthetic.

## Stage 1: Mon 08:30 (T+0)

**Event E1** -> murshid_operator: First day of Grade 12 mock exams: the model provider returns HTTP 429/503 and the free daily quota is exhausted. Revision plans, reminders and Q&A for about 1,900 students stop generating.

### Murshid tutor agent (operator) (llm:nvidia/nemotron-3.5-lightning:free; role: lead)
_Received:_ E1  
_Reasoning summary:_ The service outage impacts about 1,900 Grade 12 students during mock exams. Under UAE PDPL Article (18), Murshid as controller must protect data subject privacy and confidentiality. Article (20) requires appropriate technical measures for information security suitable for processing risks. The UAE Generative AI Guide (2023) provides pedagogical prompt frameworks used by Murshid. The Child Digital Safety Law (2025) restricts profiling minors for advertising, which may inform acceptable data practices. The MOE AI Literacy Framework (K-12) structures Grade 9-12 learning outcomes. The operator must contain the incident, communicate with relevant institutions, and ensure student learning continues within regulatory bounds.
- Immediately contact data_office to report the quota exhaustion incident, request emergency quota restoration or fallback plan, and confirm whether any student personal data was exposed in the error responses.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (18) to Article (20), pp.22-23 [uae-pdpl-2021#0023]; Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (7), pp.10-11 [uae-pdpl-2021#0010] (supported)
- Notify school_khda about the service disruption affecting Grade 12 mock exam preparation, and seek guidance on alternative revision resources compliant with the UAE Generative AI Guide use cases for students.  
  _Source:_ UAE Generative AI Guide: 100 Practical Applications and Use Cases (April 2023), pp.70-71 [uae-generative-ai-guide-2023#0065]; UAE National AI Literacy Curriculum Framework (K-12), pp.11-12 [moe-ai-literacy-framework#0008] (supported)
- Engage moe to report the platform outage and request system-wide support or alternative AI tutor access for Grade 12 students during the exam period.  
  _Source:_ UAE National AI Literacy Curriculum Framework (K-12), pp.10-11 [moe-ai-literacy-framework#0007] (supported)
- Review the model provider's contract and SLA regarding 429/503 responses, document the incident duration, and assess whether student data privacy was compromised under PDPL Article (18) and Article (20).  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (18) to Article (20), pp.22-23 [uae-pdpl-2021#0023] (supported)
- Deadline: Immediate: Contact data_office and school_khda to report outage and request emergency measures.
- Deadline: Within 24 hours: Submit incident report to moe with documentation of affected students and duration of service disruption.
- Deadline: Within 72 hours: Complete privacy impact assessment of the 429/503 error exposure for student data.  [UNSUPPORTED: '72' not in any cited source]
- Open question: Whether the model provider can restore the free daily quota before the end of the mock exam period.
- Open question: The extent of any personal data exposed in HTTP 429/503 error responses.
- Open question: Whether schools have approved alternative revision resources compliant with the UAE Generative AI Guide.
- Open question: The exact number of students whose revision plans were interrupted.
- -> data_office (request): Report Murshid model provider HTTP 429/503 quota exhaustion incident affecting ~1,900 Grade 12 students during mock exams. Request emergency quota restoration or fallback revision resources. Confirm if any student personal data was exposed in error responses.
- -> school_khda (inform): Notify that Murshid's free daily quota is exhausted, halting revision plans, reminders and Q&A for Grade 12 students during mock exams. Seek guidance on approved alternative revision resources.
- -> moe (directive): Report platform outage affecting Grade 12 mock exam preparation. Request system-wide support or alternative AI tutor access for students during the exam period.
_Audit record:_ `5c1561ffb622628e`

## Stage 2: Mon 09:15 (T+45m)

**Event E2** -> school_khda: Teachers report students cannot open their AI revision notes before the 10:00 paper; parents are calling the school.

### School and KHDA regulator agent (llm:nvidia/nemotron-3.5-lightning:free; role: lead)
_Received:_ E2, MSG-murshid_operator  
_Reasoning summary:_ The school is experiencing a service disruption with Murshid during a critical assessment period (mock exams). Parents are affected, and teachers cannot open revision notes. Per KB #0013, schools must communicate clearly and promptly with parents about expectations and support routes, avoiding fragmented communication. Per KB #0010, staff must understand roles and responsibilities for continuity arrangements. The school needs to determine compliant alternative resources while maintaining safeguarding and data protection standards.
- Verify the scope of the Murshid outage and confirm whether any cached or offline revision materials remain accessible to Grade 12 students prior to the 10:00 paper.  
  _Source:_ KHDA Quality Expectations for Effective Distance Learning (March 2026), pp.10-11 [khda-distance-learning-2026#0010]; KHDA Quality Expectations for Effective Distance Learning (March 2026), p.13 [khda-distance-learning-2026#0013] (supported)
- Issue a consolidated parent communication (via the school's established channel) explaining the temporary unavailability of Murshid revision tools, the reason (quota exhaustion), and the alternative revision resources being provided by teachers.  
  _Source:_ KHDA Quality Expectations for Effective Distance Learning (March 2026), pp.10-11 [khda-distance-learning-2026#0010]; KHDA Quality Expectations for Effective Distance Learning (March 2026), p.13 [khda-distance-learning-2026#0013] (supported)
- Request from the Murshid operator a timeline for quota restoration or an emergency top-up, and simultaneously identify KHDA-approved alternative digital revision platforms that comply with data protection and safeguarding standards.  
  _Source:_ KHDA Quality Expectations for Effective Distance Learning (March 2026), p.13 [khda-distance-learning-2026#0013]; KHDA Securing Students Outcomes: Engagement Guidelines for Examination Contingency 2026, pp.5-6 [khda-exam-contingency-2026#0004] (supported)
- Deadline: Parent communication must be sent before the 10:00 paper begins to prevent further anxiety and repeated calls.
- Deadline: Murshid quota restoration timeline requested within 24 hours.  [UNSUPPORTED: '24' not in any cited source]
- Deadline: Alternative resource identification and vetting to be completed before the next school day.
- Open question: Whether Murshid's quota exhaustion is temporary or systemic; the exact number of Grade 12 students affected and their current revision progress; whether any students have relied exclusively on Murshid for mock exam preparation.
- -> murshid_operator (request): Confirm the cause of the free daily quota exhaustion for Grade 12 users and provide an estimated restoration time or emergency top-up option, as mock exams are in progress and students cannot access revision notes.
- -> data_office (inform): Flag the Murshid service disruption for Grade 12 mock exam revision in the school's EdTech usage log, noting the quota issue and the temporary switch to teacher-provided alternatives.
_Audit record:_ `0f6b3578b4b33e81`

### Data-protection authority agent (llm:nvidia/nemotron-3.5-lightning:free; role: lead)
_Received:_ MSG-murshid_operator  
_Reasoning summary:_ The operator has raised a service availability incident impacting a large student cohort during assessments. Under PDPL Article 13, controllers must inform data subjects about processing purposes and breach notification procedures (0018). Article 16-17 governs data subject rights and correction requests. The incident may constitute a personal data breach if error responses exposed identifiable student information, triggering 72-hour notification requirements under UAE cybersecurity framework (0003, 0004).
- Acknowledge receipt of incident report and request for emergency quota restoration/fallback resources; simultaneously assess whether error responses contained personal data that would constitute a breach under PDPL Article 13(1)(h) and require notification to the Bureau.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (13), pp.17-18 [uae-pdpl-2021#0018]; Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (16) to Article (17), pp.20-21 [uae-pdpl-2021#0021] (supported)
- Request the operator to provide technical details: nature of error responses (429 vs 503), whether any student identifiers or personal data were returned, duration of the incident, and time of first occurrence.  
  _Source:_ no supporting citation (uncited)
- Deadline: Immediate: Request technical details from operator to determine breach status
- Deadline: 72-hour: If personal data breach confirmed, notify UAE Data Office per PDPL requirements
- Open question: Whether HTTP 429/503 error responses inadvertently exposed student personal data
- Open question: Exact number of students whose data may have been compromised
- Open question: Operator's existing incident response and breach assessment procedures
- -> murshid_operator (request): Please provide: (1) nature of error responses (429/503), (2) whether any student personal data (names, IDs, grades) was returned in error responses, (3) duration and timestamp of incident start, (4) current quota status. This information is needed to assess breach reporting obligations under PDPL.
- -> school_khda (inform): Alert: Murshid service experienced HTTP 429/503 quota exhaustion during mock exams affecting ~1,900 Grade 12 students. Technical assessment underway; no confirmation of data exposure yet. Schools should monitor for unusual student data inquiries.
_Audit record:_ `63adc04f5dadeee2`

### Ministry of Education agent (llm:nvidia/nemotron-3.5-lightning:free; role: lead)
_Received:_ MSG-murshid_operator  
_Reasoning summary:_ The Ministry must respond to the outage while ensuring continuity of exam preparation for Grade 12 students. Any alternative access must align with the National AI Literacy Curriculum Framework, generative AI usage cycles, and academic integrity policies. The Ministry's mandate includes setting approved tools and age restrictions, and the outage occurs during a critical exam period requiring urgent but compliant action.
- Acknowledge the outage report and request detailed incident timeline and affected student cohort from the Murshid operator.  
  _Source:_ no supporting citation (rejected_unknown_ids)
- Consult the UAE Generative AI Guide (2023) to verify if Murshid is an approved tool and determine appropriate age-restricted alternatives for Grade 12 mock exam support.  
  _Source:_ UAE Generative AI Guide: 100 Practical Applications and Use Cases (April 2023), pp.70-71 [uae-generative-ai-guide-2023#0065]; UAE Generative AI Guide: 100 Practical Applications and Use Cases (April 2023), pp.32-33 [uae-generative-ai-guide-2023#0030] (supported)
- Issue a directive to school operators (via school_khda) offering approved alternative AI tutor access or non-AI revision resources for Grade 12 mock exam preparation, ensuring compliance with academic integrity and data privacy rules.  
  _Source:_ UAE AI Ethics: Principles and Guidelines (Dec 2022), pp.15-16 [uae-ai-ethics-guidelines-2022#0022] (supported)
- Deadline: Immediate acknowledgment to Murshid operator
- Deadline: Alternative resource directive within 48 hours  [UNSUPPORTED: '48' not in any cited source]
- Open question: Current approval status of Murshid platform for Grade 12 use
- Open question: Availability of approved alternative AI tutor systems during exam period
- Open question: Exact number of students affected by the outage
- -> murshid_operator (inform): Receipt acknowledged. Ministry is assessing approved alternatives and will issue directives within 48 hours. Please provide incident timeline and affected student cohort.
- -> school_khda (directive): Prepare approved non-AI revision materials and alternative AI tutor access for Grade 12 mock exam preparation in event of Murshid platform outage. Ensure compliance with academic integrity and data privacy regulations.
- -> data_office (request): Provide data on Grade 12 mock exam preparation dependency on Murshid platform and student cohort sizes affected.
_Audit record:_ `71b602646c377de3`

## Stage 3: Mon 10:00 (T+1.5h)

**Event E3** -> murshid_operator: The only paid fallback model with capacity is served from a region outside the UAE; switching would send student prompts (names, subjects, grades) abroad.

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ E3, MSG-school_khda, MSG-data_office, MSG-moe  
_Reasoning summary:_ Matched tags ['cross_border', 'exam', 'model_outage'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'model_outage': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Map which model providers process data outside the UAE and on what legal basis; prefer providers with UAE/adequate jurisdiction or contractual safeguards.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (22) to Article (23), pp.25-26 [uae-pdpl-2021#0026] (supported)
- Keep AI help inside the school's academic-integrity rules during exams (no answer generation for assessed work).  
  _Source:_ UAE National AI Literacy Curriculum Framework (K-12), pp.55-56 [moe-ai-literacy-framework#0055] (supported)
- -> data_office (inform): [cross_border] Murshid tutor agent (operator) acting as support: Map which model providers process data outside the UAE and on what legal basis; prefer providers with UAE/adequate jurisdiction or contractual safeguards.
- -> school_khda (inform): [exam] Murshid tutor agent (operator) acting as support: Keep AI help inside the school's academic-integrity rules during exams (no answer generation for assessed work).
_Audit record:_ `1eb81bda70fec876`

### Data-protection authority agent (llm:nvidia/nemotron-3.5-lightning:free; role: lead)
_Received:_ MSG-school_khda, MSG-moe  
_Reasoning summary:_ The school has already flagged the disruption in its EdTech usage log, citing a quota issue and switching to teacher-provided alternatives. The Ministry of Education has formally requested data on Grade 12 mock exam preparation dependency on Murshid and student cohort sizes affected. As the Data-protection authority, I must assess whether the disruption involves personal-data processing violations, quota breaches, or notification obligations under PDPL, and I must respond to the Ministry's request within my mandate.
- Acknowledge the school's EdTech usage log flag and verify if the quota issue constitutes a personal-data processing incident requiring breach notification under PDPL Articles 9 and 12 (uae-pdpl-2021#0014, #0017).  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (9) to Article (10), pp.14-15 [uae-pdpl-2021#0014]; Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (12) to Article (13), pp.16-17 [uae-pdpl-2021#0017] (supported)
- Request from the Ministry of Education the specific data elements needed (cohort sizes, duration of dependency, nature of data processed) to fulfill its request, ensuring any shared data complies with PDPL de-identification and minimization principles.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (9) to Article (10), pp.14-15 [uae-pdpl-2021#0014] (supported)
- Deadline: School EdTech log flag: immediate verification needed
- Deadline: Ministry data request: within statutory response timeframe for regulator inquiries
- Open question: Whether the quota issue involves personal-data breach or service-level failure outside PDPL scope
- Open question: Exact cohort sizes and data-processing details held by the Ministry that I am not privy to
- -> school_khda (inform): Thank you for flagging the Murshid service disruption in the EdTech usage log. Please confirm whether the quota issue involves personal-data processing that would trigger breach notification obligations under PDPL, or is purely a service-level quota limitation.
- -> moe (request): Please specify the data elements required (cohort sizes, duration of Murshid dependency, categories of personal data processed) so that I may provide the requested information while ensuring PDPL compliance regarding de-identification and minimization.
_Audit record:_ `da7d3f92d039977a`

### School and KHDA regulator agent (llm:nvidia/nemotron-3.5-lightning:free; role: lead)
_Received:_ MSG-data_office, MSG-moe  
_Reasoning summary:_ The Murshid quota exhaustion during high-stakes mock exams creates immediate risk to examination continuity and student assessment validity. The Ministry of Education directive requires schools to have approved non-AI revision materials ready. KHDA distance learning expectations require clear parent communication about adjusted delivery and safeguarding/ data protection visibility in online environments. Schools must balance teaching continuity with data privacy compliance and examination contingency deadlines (e.g., April 21 withdrawal/deferral deadlines).
- Direct school data office to verify Murshid service status and document scope of quota exhaustion affecting Grade 12 mock exams; initiate fallback to approved non-AI revision materials per MOE directive.  
  _Source:_ UAE National AI Literacy Curriculum Framework (K-12), pp.57-60 [moe-ai-literacy-framework#0058]; UAE National AI Literacy Curriculum Framework (K-12), pp.59-60 [moe-ai-literacy-framework#0059] (supported)
- Issue parent communication via school channel clarifying Murshid temporary unavailability, alternative revision resources, and safeguarding/ data protection reassurances, per KHDA distance learning communication expectations.  
  _Source:_ KHDA Quality Expectations for Effective Distance Learning (March 2026), pp.10-11 [khda-distance-learning-2026#0010]; KHDA Quality Expectations for Effective Distance Learning (March 2026), p.13 [khda-distance-learning-2026#0013] (supported)
- Confirm with MOE and examination boards that mock exam evidence collection and predicted grade submission timelines remain on track despite Murshid outage; flag any April 21 withdrawal/deferral deadline risks per KHDA exam contingency guidelines.  
  _Source:_ KHDA Securing Students Outcomes: Engagement Guidelines for Examination Contingency 2026, pp.17-19 [khda-exam-contingency-2026#0015]; KHDA Securing Students Outcomes: Engagement Guidelines for Examination Contingency 2026, pp.12-13 [khda-exam-contingency-2026#0011] (supported)
- Data office to audit any unusual student data inquiries following the 429/503 events; report findings to child_safety channel if data exposure is confirmed.  
  _Source:_ KHDA Quality Expectations for Effective Distance Learning (March 2026), p.5 [khda-distance-learning-2026#0004] (supported)
- Deadline: Monitor for Murshid service restoration before next mock exam session
- Deadline: April 21 withdrawal/deferral decision deadline (exam contingency)
- Deadline: Parent communication should be issued promptly upon outage confirmation
- Open question: Technical assessment of Murshid quota exhaustion root cause and data exposure status
- Open question: Exact scope of student records potentially affected by 429/503 errors
- Open question: Whether MOE-approved alternative AI tutor access materials are already prepared at school level
- -> data_office (request): Verify Murshid service status, document quota exhaustion scope affecting Grade 12 mock exams, and initiate fallback to approved non-AI revision materials per MOE directive.
- -> moe (inform): Report Murshid 429/503 incident affecting ~1,900 Grade 12 students; request confirmation of alternative AI tutor access availability and non-AI revision material compliance.
- -> child_safety (inform): Alert: Murshid HTTP 429/503 quota exhaustion during mock exams; no confirmation of data exposure yet. Request audit of unusual student data inquiries and report findings.
- -> murshid_operator (directive): Resolve HTTP 429/503 quota exhaustion in Murshid service; provide timeline for restoration and assurance on student data protection.
_Audit record:_ `8bd87e8072315ed8`

## Stage 4: Tue 15:00 (T+1d)

**Event E4** -> moe, school_khda: Several students used a different public chatbot during the outage to write take-home assessed coursework. Teachers ask what the rule is.

### Ministry of Education agent (rules; role: support)
_Received:_ E4, MSG-data_office, MSG-school_khda  
_Reasoning summary:_ Matched tags ['ai_use', 'exam', 'model_outage'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Restate academic-integrity expectations for AI use around assessment.  
  _Source:_ UAE National AI Literacy Curriculum Framework (K-12), pp.55-56 [moe-ai-literacy-framework#0055] (supported)
- Follow-up on 'model_outage': already acting (inform); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Apply the UAE AI Charter principles (safety, human oversight, privacy).  
  _Source:_ The UAE Charter for the Development and Use of Artificial Intelligence (July 2024), 5. Transparency:, pp.3-5 [uae-ai-charter-2024#0001] (supported)
- -> school_khda (inform): [exam] Ministry of Education agent acting as support: Restate academic-integrity expectations for AI use around assessment.
_Audit record:_ `eb24732913b57604`

### School and KHDA regulator agent (rules; role: lead)
_Received:_ E4, MSG-murshid_operator, MSG-data_office  
_Reasoning summary:_ Matched tags ['ai_use', 'exam', 'model_outage'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'model_outage': already acting (support); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Follow-up on 'exam': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
- Teachers keep human judgement on student matters; AI output is advisory.  
  _Source:_ UAE National AI Literacy Curriculum Framework (K-12), pp.35-36 [moe-ai-literacy-framework#0033] (supported)
_Audit record:_ `2eceae5327978d36`

### Data-protection authority agent (rules; role: lead)
_Received:_ MSG-murshid_operator, MSG-school_khda  
_Reasoning summary:_ Matched tags ['cross_border'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Check that transfers to model providers abroad meet Art. 22/23 conditions.  
  _Source:_ Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (22) to Article (23), pp.25-26 [uae-pdpl-2021#0026] (supported)
- -> murshid_operator (request): [cross_border] Data-protection authority agent acting as lead: Check that transfers to model providers abroad meet Art. 22/23 conditions.
_Audit record:_ `b3ebd39e1c44bd82`

### Child digital safety agent (rules; role: inform)
_Received:_ MSG-school_khda  
_Reasoning summary:_ Nothing in this information falls within my mandate; noted for awareness.
- Open question: No mandate-relevant trigger in the information received.
_Audit record:_ `2db25baf86ad5860`

### Murshid tutor agent (operator) (rules; role: lead)
_Received:_ MSG-school_khda  
_Reasoning summary:_ Matched tags ['model_outage'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'model_outage': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `729cd291f060a63b`

## Stage 5: Debrief


### School and KHDA regulator agent (rules; role: lead)
_Received:_ MSG-moe  
_Reasoning summary:_ Matched tags ['exam'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'exam': already acting (lead); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `d1155e9374eb8c86`

### Murshid tutor agent (operator) (rules; role: support)
_Received:_ MSG-data_office  
_Reasoning summary:_ Matched tags ['cross_border'] to my mandate; actions are taken from my rule table and each is grounded in the best-matching excerpt from my sources.
- Follow-up on 'cross_border': already acting (support); new information added to the case file, no duplicate notifications sent.  
  _Source:_ no supporting citation (not_needed (follow-up))
_Audit record:_ `c97e57c899b474ae`

## Coordination findings (detected by the coordinator)

- **overlapping_lead**: Data-protection authority agent and School and KHDA regulator agent both acted as lead on 'exam'; no rule in the KB says which one leads.
- **overlapping_lead**: Data-protection authority agent and Ministry of Education agent and School and KHDA regulator agent both acted as lead on 'model_outage'; no rule in the KB says which one leads.
- **late_awareness**: Ministry of Education agent learned of 'model_outage' 1 stage(s) after it first occurred.
- **late_awareness**: School and KHDA regulator agent learned of 'model_outage' 1 stage(s) after it first occurred.
- **late_awareness**: Ministry of Education agent learned of 'exam' 2 stage(s) after it first occurred.
- **late_awareness**: Data-protection authority agent learned of 'cross_border' 1 stage(s) after it first occurred.
- **unsupported_deadline**: 3 deadline(s) stated by LLM agents use a number of hours/days found in none of the sources they were given (flagged in the transcript).

Actions without a supporting citation: 2

## Policy and standards gaps (policy adviser)

_Adviser summary (llm:nvidia/nemotron-3.5-lightning:free):_ The model outage during mock exams exposed critical governance gaps: overlapping lead roles between the Data-protection authority, Ministry of Education, and KHDA regulator created confusion on who commands the response; late awareness across all agencies delayed coordination; and existing exam contingency rules do not cover AI service failures. The most urgent fix is clarifying lead agency responsibility for AI outages and establishing mandatory incident reporting. The closest global example is the EU AI Act's mandatory serious incident reporting by high-risk AI providers to market surveillance authorities.

### G7 Exam contingency rules cover cancelled exam boards, not failing AI services (standards gap (service continuity))
KHDA's 2026 Examination Contingency guide responds to the cancellation of board examinations across the Middle East in 2026; it does not address an EdTech or AI provider outage during assessments. PDPL Art. 20 asks for measures that ensure timely access to personal data after a technical failure, but nothing sets availability or fallback expectations for AI study tools at exam time.
UAE evidence: KHDA Securing Students Outcomes: Engagement Guidelines for Examination Contingency 2026, p.2 [khda-exam-contingency-2026#0000]; Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (18) to Article (20), pp.22-23 [uae-pdpl-2021#0023]
Global example: OECD AI Principle 1.4: robust, secure and safe throughout the lifecycle, with mechanisms to override, repair or decommission; EU AI Act Art. 15: resilience to errors and faults, technical redundancy and fail-safe plans. (OECD Recommendation of the Council on Artificial Intelligence (OECD AI Principles, OECD/LEGAL/0449, amended 2024), pp.8-9 [oecd-ai-recommendation#0013]; Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 14 to Article 15, pp.60-61 [eu-ai-act-2024#0207])
Recommendation: Add AI-service continuity to school contingency planning: a degraded, non-AI mode that keeps students' plans and notes available, exam-period change freezes, and provider SLAs.

### G5 No binding risk class, logging duty or incident channel for AI systems used with students (standards gap (no AI-specific obligations))
UAE AI governance documents in the KB (AI Charter 2024, AI Ethics Principles and Guidelines 2022, Dubai AI Ethics Guidelines) are principles; the Ethics Guidelines state they are non-binding. None defines when an education AI system is high-risk, what it must log, who must oversee it, or where an AI incident (such as harmful advice to a 14-year-old after a silent model swap) is reported.
UAE evidence: UAE AI Ethics: Principles and Guidelines (Dec 2022), pp.3-4 [uae-ai-ethics-guidelines-2022#0001]; The UAE Charter for the Development and Use of Artificial Intelligence (July 2024), pp.1-3 [uae-ai-charter-2024#0000]
Global example: EU AI Act: education uses listed as high-risk (Annex III point 3), automatic event logging (Art. 12), human oversight (Art. 14), accuracy/robustness (Art. 15), serious-incident reporting (Art. 73). (Regulation (EU) 2024/1689 (Artificial Intelligence Act), pp.20-21 [eu-ai-act-2024#0076]; Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 13 to Article 14, p.60 [eu-ai-act-2024#0205]; Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 72 to Article 73, pp.101-102 [eu-ai-act-2024#0315])
Recommendation: Adopt an education-AI conformity baseline (risk class, event logging, human oversight, change notification when the underlying model changes, incident reporting) that KHDA/MoE can require in procurement; ITU-T Y.3172's sandbox and policy node are a natural technical reference.

### G4 The same AI tutor falls under different data-protection regimes depending on who deploys it (scope gap (fragmented coverage))
PDPL Art. 2(2) excludes government data and 'governmental entities which control or process Personal Data', and companies in free zones with their own data-protection law. A tool used in a public (government) school, a Dubai private school and a free-zone EdTech company could therefore sit under three different rule-sets for the same student data.
UAE evidence: Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (2) to Article (3), pp.6-7 [uae-pdpl-2021#0005]
Global example: The EU AI Act classifies education AI by use (Annex III point 3: admission, evaluating learning outcomes, steering learning, monitoring tests) and applies whether the deployer is public or private. (Regulation (EU) 2024/1689 (Artificial Intelligence Act), Article 113, pp.126-127 [eu-ai-act-2024#0376])
Recommendation: Give education AI a use-based rule that applies to public and private deployers alike (for example through MoE/KHDA procurement conditions or the Child Digital Safety platform classification under Art. 6).

### G6 Approved-tool and age rules cover MoE-curriculum schools; Dubai private schools on other curricula wait for KHDA (unclear responsibility (rules exist for some schools only))
The MoE National AI Literacy Curriculum Framework refers to a Guide that defines approved tools, permissible classroom use and age restrictions for Grades 7-12 in public schools and private schools following the MoE curriculum. Private schools on British, Indian, IB or American curricula are outside that Guide; KHDA's own AI guidance for Dubai private schools was announced in October 2026 for next year (press reports), and the KB holds only one KHDA line on AI (teachers must not use AI to replace human judgement on student matters).
UAE evidence: UAE National AI Literacy Curriculum Framework (K-12), pp.57-60 [moe-ai-literacy-framework#0058]; KHDA School Teacher Recruitment and Mobility Guide (includes AI use expectations for staff), pp.14-15 [khda-teacher-recruitment-guide#0013]
Global example: UNESCO asks institutions to validate GenAI tools for ethical and pedagogical fit before use; UNICEF asks governments to give schools procurement and deployment guidance. (UNESCO Guidance for Generative AI in Education and Research (2023), pp.3-5 [unesco-genai-education-2023#0002]; UNICEF Guidance on AI and Children 3.0 (December 2025), pp.41-42 [unicef-ai-children-v3-2025#0061])
Recommendation: KHDA guidance should state which tools are approved, the age bands, and how a school checks a third-party AI tutor; a shared MoE-KHDA register would avoid two lists.

### G8 Low-cost model access pushes student data across borders on terms schools cannot check (conflict of objectives (cost vs. data residency))
PDPL Art. 22-23 allow transfers abroad to adequate jurisdictions or under contract/consent, with the controls left to the Executive Regulations (Art. 23(2)). Cheap or free hosted models are often served from outside the UAE and some free tiers may retain prompts; during an outage the cheapest fallback can be a foreign region. The National AI Strategy's goal of wide AI adoption and the protection of children's data pull in different directions with no tie-breaker.
UAE evidence: Federal Decree-Law No. 45 of 2021 on the Protection of Personal Data (PDPL), Article (23) to Article (24), pp.26-27 [uae-pdpl-2021#0027]
Global example: The UK Children's Code tells services not to use children's data in ways shown to be detrimental to them and to run a DPIA; OECD asks for traceability of datasets and processes. (UK ICO Age Appropriate Design: a Code of Practice for Online Services (Children's Code), pp.10-11 [uk-age-appropriate-design-code#0014]; OECD Recommendation of the Council on Artificial Intelligence (OECD AI Principles, OECD/LEGAL/0449, amended 2024), pp.4-5 [oecd-ai-recommendation#0006])
Recommendation: Publish an adequacy list and standard contract clauses for AI model providers, and require education tools to disclose model-provider location and retention terms.

## Run summary

- LLM calls: 7 (budget 7); cost USD 0.0000
- Agent turns: 14 (6 by LLM, 8 by rules)
- Audit log: 22 records, hash chain ok