# Data Protection Impact Assessment (DPIA) — Murshid — TEMPLATE / DRAFT

> **DRAFT — needs review by the DPO and UAE-qualified legal counsel.** Pre-filled with the current design; replace `[…]` and verify every legal reference marked **[LEGAL CHECK]**.

| Field | Value |
|---|---|
| Product / feature | Murshid student agent app — [feature, e.g. "Google Classroom connector"] |
| Owner | [name, role] |
| DPO / privacy reviewer | [name] |
| Date / version | [date] / v0.1 |
| Status | Draft |

## 1. Why a DPIA
High-risk processing indicators present: data about **children (13–17)**, **systematic** processing of education data, **new technology (AI models)**, potential **cross-border transfer** to AI providers. Applicable frameworks: UAE PDPL (Federal Decree-Law No. 45 of 2021) and Executive Regulations [LEGAL CHECK status]; Federal Decree-Law No. 26 of 2025 on Child Digital Safety (in force 1 Jan 2026; one-year alignment period) [LEGAL CHECK platform classification]; ADEK / KHDA / MoE guidance on AI in schools [LEGAL CHECK current documents]; school data-sharing agreements.

## 2. Description of processing
- **Data subjects:** students 13+ (most under 18), their guardians, school counsellors.
- **Data categories:** identity (name, DOB, school, grade), education (courses, assignments, notes, grades if present), goals/tasks, portfolio (achievements, CV), contact (email, push token, WhatsApp), technical (audit logs), AI-use logs. **No** special-category data intended; free-text may incidentally contain some → see risk R6.
- **Sources:** student input; school LMS via OAuth (read-only); guardian input.
- **Recipients / processors:** hosting [Supabase region], AI model providers via gateway [list], email/push/WhatsApp providers [list].
- **Purposes (each separately consented):** core_service, school_connector, guardian_summaries, notifications, opportunity_sharing_universities.
- **Data flow diagram:** [attach].

## 3. Necessity and proportionality
| Question | Answer |
|---|---|
| Lawful basis per purpose | Consent (student 18+, or verified guardian for under-18s) [LEGAL CHECK] |
| Data minimisation | Connectors read-only, scoped; guardian sees summaries only; audit/AI logs store no content |
| Accuracy | Student can edit; LMS data re-synced |
| Storage limitation | `RETENTION_POLICY` in `packages/privacy/src/retention.ts` |
| Rights | Export ZIP, delete with tombstone, per-purpose withdrawal (`DataRightsService`, `ConsentService.revoke`) |
| Transparency | Privacy policy + parent consent text in plain English/Arabic |

## 4. Risk register
Score likelihood (L) and severity (S) 1–3; risk = L×S.

| # | Risk | L | S | Mitigation (implemented / planned) | Residual |
|---|---|---|---|---|---|
| R1 | Under-13 uses the app | 2 | 3 | Neutral DOB screen, device lock after block; [planned: school-domain sign-in signal] | [ ] |
| R2 | Student fakes guardian consent (own second email) | 2 | 2 | Email OTP; [planned: UAE PASS for guardians]; school-provided guardian email cross-check | [ ] |
| R3 | Over-collection from LMS | 2 | 2 | Read-only scopes, materials retained 6 months, raw payloads 7 days | [ ] |
| R4 | AI provider retains/trains on student data | 2 | 3 | Zero-retention contracts; gateway filters PII to approved models only (`pii_allowed`) | [ ] |
| R5 | AI ghostwrites assessed work (integrity) | 3 | 2 | ai_use_level per task; rule-based integrity checks; AI-use log + declaration | [ ] |
| R6 | Sensitive disclosures in chat (wellbeing, safeguarding) | 2 | 3 | [planned: safeguarding escalation policy with schools; crisis resources] | [ ] |
| R7 | Guardian/counsellor over-access | 1 | 3 | Policy engine + RLS, summary views only, audit log | [ ] |
| R8 | Breach of tokens | 1 | 3 | Vault references only, no raw tokens in DB; revoke on deletion | [ ] |
| R9 | Cross-border transfer | 2 | 2 | [LEGAL CHECK]; region pinning; in-country model (Falcon) for Arabic | [ ] |
| R10 | Data used commercially / for advertising | 1 | 3 | Prohibited by policy and design; no ad SDKs | [ ] |

## 5. Consultation
- Students (pilot group, synthetic data only in testing): [ ]
- Parents: [ ]
- Partner schools / counsellors: [ ]
- Regulator consultation needed? [ ]

## 6. Sign-off
| Role | Name | Decision | Date |
|---|---|---|---|
| DPO | | | |
| Product owner | | | |
| Legal | | | |

Review this DPIA when: a new purpose, connector or AI provider is added; a law or regulation changes; or annually.
