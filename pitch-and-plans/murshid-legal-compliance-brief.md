# Murshid: legal, compliance and partnership brief (as of 10 Oct 2026)

Murshid is a personal AI agent for UAE students aged about 13 to 18. It holds identity details, grades, class notes, goals and CVs, and may connect to school portals and parents. This brief is not legal advice. ⚠ marks a point that is uncertain or that I could not verify.

## 1. Data protection

- **Federal PDPL (Decree-Law 45/2021).** It has been in force since 2 Jan 2022 and covers mainland firms, plus foreign firms that process data of people in the UAE.
  - Consent is the default basis: it must be provable and easy to withdraw (Arts 4 and 6). There is no "legitimate interests" basis.
  - Other duties: a DPO for high-risk or profiling-heavy processing (Art 10), breach notice to the Data Office (Art 9), and a DPIA for high-risk new technology (Art 21).
  - **The Executive Regulations and the penalties decision have still not been issued.** The six-month grace period only starts once they are. https://trytrustable.com/uae-pdpl
  - In June 2026 the UAE created a Federal Authority for AI and Data, which absorbs the Data Office's functions. It is expected to take over PDPL enforcement ⚠. https://www.morganlewis.com/pubs/2026/06/uae-establishes-federal-authority-for-artificial-intelligence-and-data
- **Children's data: the Child Digital Safety Law (Decree-Law 26/2025) is the binding rule.** This is the law that matters most for Murshid.
  - Effective 1 Jan 2026, with one year to comply, so about Jan 2027. It reaches any app that operates in or targets the UAE.
  - **No collecting data from under-13s without verified parental consent.** No advertising use of children's data. Parents must be able to withdraw consent easily.
  - Platforms need age verification, high-privacy default settings and parental tools, all scaled to a risk classification the Cabinet has yet to publish. https://www.lexismiddleeast.com/pn/UnitedArabEmirates/UAE_Federal_Decree-Law_No._26_2025_on_Child_Digital_Safety/en · https://uaelegislation.gov.ae/en/legislations/3912 · https://www.lw.com/en/insights/uaes-child-digital-safety-law-what-every-digital-platform-and-isp-should-know
  - **Cabinet Resolution 106/2026** bars social-media accounts for under-15s and rules out self-declared age. Keep Murshid free of social or posting features so it stays outside this resolution ⚠. https://uaelegislation.gov.ae/en/legislations/4506
- **Cross-border transfers and residency.**
  - Transfers are allowed to "adequate" countries (Art 22). Otherwise they need a contract, explicit consent and the other Art 23 grounds.
  - There is no blanket localisation rule. Still, hosting in the UAE (Azure UAE North, AWS me-central-1, G42/Core42) is the easiest thing to defend to schools and government.
- **DIFC and ADGM.** A company set up in DIFC (for example under the AI licence below) falls under DIFC Data Protection Law 5/2020 instead of the PDPL. ADGM has its own 2021 regulations. https://trytrustable.com/uae-pdpl
- **Dubai-specific rules.** I found none for private edtech beyond federal law and KHDA ⚠.

## 2. Education regulators and AI-in-schools rules

- **KHDA (Dubai private schools).**
  - On 1 Oct 2026 KHDA said it is drafting an AI and technology policy, expected in force for **2027–28**. It will be age and stage based and cover safeguards and the role of parents.
  - KHDA will **not prescribe platforms**. It will set safeguards that schools must check before adopting one. https://www.thenationalnews.com/news/uae/2026/10/01/dubai-schools-to-receive-new-rules-on-ai-use-for-children-next-year/
  - ⚠ I found **no public KHDA edtech approval or procurement process, and no edtech sandbox**. Individual schools vet their own vendors. Dubai Future Foundation runs Sandbox Dubai (sandboxdubai.gov.ae), but I have not verified whether it fits Murshid.
- **ADEK (Abu Dhabi), the best template to build to now.**
  - Its Technology and AI Policy requires schools to use AI tools that "meet ADEK requirements".
  - Safeguards cover six areas: data protection, cognitive agency, academic integrity, human oversight, content safety and fit with UAE values, and algorithmic fairness. https://www.adek.gov.ae/Media-Centre/News/ADEK-Advances-AI-Literacy-Initiative-across-170-Private-Schools
  - ⚠ From policy excerpts I did not read in full:
    - The ADEK Digital Policy vets vendors on security and PDPL compliance.
    - The ADEK Assessment Policy bars sharing student assessment data with third parties without parental consent and ADEK approval.
- **MoE.**
  - AI is a K–12 subject in public schools from 2025–26 (https://www.wam.ae/en/article/bji6z2n-ministry-education-introduces-curriculum-public).
  - The Cabinet extended the curriculum to **all public and private schools** in Sept 2026 and plans to train 22,000 teachers (https://www.thenationalnews.com/news/uae/2026/09/02/sheikh-mohammed-bin-rashid-announces-ai-curriculum-for-all-schools-in-uae/).
  - The K–12 framework is at https://www.moe.gov.ae/en/pages/ai.aspx. Positioning Murshid as support for AI literacy and career readiness lines it up with these goals.

## 3. App stores and international users

- **Apple.**
  - Guideline 5.1.4: an app collecting minors' data needs a privacy policy and must comply with COPPA and GDPR.
  - Guideline 5.1.2(i): **sharing data with a third-party AI must be clearly disclosed, with explicit permission.**
  - Account deletion must be available in the app (5.1.1(v)).
  - Do not market Murshid "for kids" unless it is in the Kids Category (2.3.8). https://developer.apple.com/app-store/review/guidelines/
- **Google Play.**
  - Declare 13–15 and 16–17 as target ages.
  - If any target age group counts as children, the Families policy applies (certified ad SDKs only, a neutral age screen).
  - Google warns that users under 21 may be "children" under local law.
  - The Play Age Signals API currently returns age signals only in Brazil and some US states. https://support.google.com/googleplay/android-developer/answer/9867159 · https://developer.android.com/google/play/age-signals/overview
- **COPPA (US, under 13).** The amended rule has been enforceable since **22 Apr 2026**. It requires separate parental consent before disclosing data to third parties and sets data-retention limits. https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule
- **GDPR Art 8 (EU).** Parental consent is needed below age 16 (member states may lower it to 13) and must be verified with "reasonable efforts". https://gdpr-info.eu/art-8-gdpr/
- **Design recommendation.**
  - Launch at 13+ only.
  - Neutral age screen, then parent verification for anyone under 18. UAE PASS or Emirates ID verification is best; a parent account co-signs.
  - A parent dashboard where parents can withdraw consent.
  - No ads and no data sale.
  - LLM provider set to zero retention and no training on user data, disclosed to users.

## 4. Company setup for a 17-year-old

- **The law.**
  - The age to trade is 18 (Commercial Transactions Law 50/2022, Art 18.1).
  - A 15–17-year-old may trade only under conditions set by a Cabinet resolution (Art 18.2). ⚠ I could not find that resolution.
  - Full civil majority at 18 started on 1 Jun 2026 (Civil Transactions Law 25/2025). https://lylawyers.com/blog/understanding-the-new-age-requirements-for-business-ownership-in-the-uae
- **Practical path.**
  - A parent holds the licence or shares now, with a written agreement or side letter on the founder's equity and IP. Shares transfer once the founder turns 18.
  - Until then, keep Murshid as a non-commercial prototype under the founder's name. The championship accepts ideas and prototypes, so no company is needed yet.
- **Options and approximate costs.**
  - **in5 Tech (Dubai Internet City, DDA FZ-LLC):** about AED 1,000 a year licence for 3 years, plus a co-working desk at about AED 15k in year 1. Entry is by committee. https://www.dxbstart.com/licensing/dubai-internet-city (the official infive.ae page was bot-blocked ⚠)
  - **DIFC AI Licence:** USD 1,500 a year, with co-working included and DIFC data law applying. https://www.difc.com/business/establish-a-business/ai-licence
  - **Hub71 (Abu Dhabi):** requires relocating to Abu Dhabi and gives equity through a SAFE. A poor fit now.
  - DSO/DTEC "student rate" of about AED 4k comes from one unofficial source ⚠.
- **No Dubai "student entrepreneur licence" found.**
  - Abu Dhabi's Future Entrepreneurs permit (ages 4–18) covers only exhibition and retail activities, not software. https://www.adra.gov.ae/en/media-centre/news/ADRA-launches-Future-Entrepreneurs-permit
  - Dubai Next crowdfunding allows pitches from age 12 with guardian approval (per LYLAW above).

## 5. Partnership and funding paths, most relevant first

1. **Create AI Agents Championship, Youth category.** Lead applicant must be under 21. The category winner gets USD 150k; the AI Agent of the Year gets AED 1M. The top 24 entries join a Tech Accelerator, and the final is a pitch to government leaders.
   - Rules require the solution to "protect personal… data and prevent information leakage."
   - Registration closes Dec 2026 or Jan 2027 (official pages differ). https://www.dubaichamberdigital.com/en/create-ai-agents
2. **GEMS (the founder's school group).**
   - **Next Billion Innovation fund:** USD 1M for student ventures, run through the GEMS Global Innovation Challenge. https://www.gemseducation.com/en/News-and-Events/News/GEMS-Education-launches-Next-Billion-Innovation-startup-fund-for-future-creators-and-entrepreneurs
   - **Global Education AI Hub:** invites edtech startups; its test bed is GEMS School of Research & Innovation. https://www.gemseducation.com/en/News-and-Events/News/GEMS-Global-Education-AI-Hub-launched-to-transform-the-future-of-learning
   - This is the most realistic first school pilot.
3. **MBRIF Accelerator (Ministry of Finance).** No age or nationality limit, no equity taken, education is a priority sector. It needs a working prototype and gives no cash. The Innovation Trailblazers stream is for university students only. https://mbrif.ae/faq-2/
4. **Dubai Future Foundation / DCAI Agentic AI for Government Services Accelerator.** For AI companies building government-facing agents, with priority to Dubai AI Seal holders. It becomes relevant once there is a company. https://www.dubaifuture.ae/dcai-accelerators/
5. **Dubai AI Campus (DIFC)** for its programmes and licence, and **KHDA–INJAZ** student entrepreneurship programmes for visibility (https://web.khda.gov.ae/en/About-Us/News/2025/KHDA-and-INJAZ-UAE-partner-to-promote-entrepreneur). ⚠ KHDA's "What Works" is a forum where educators share practice, not an edtech pilot channel.

## 6. What schools will demand

- **Academic integrity.**
  - Dubai schools already use tiered AI-use levels: L0 means no AI, L1 means AI support, L2 means AI-led (Nord Anglia). CIS uses a colour-coded scale.
  - The red line is AI producing the substantive work that is submitted. https://whichschooladvisor.com/uae/school-news/ai-homework-essays-and-chatgpt-what-dubai-schools-actually-allow
  - Murshid should:
    - respect each task's AI level;
    - coach rather than write;
    - log how AI was used so students can disclose it;
    - never auto-complete assessed work.
- **AI safety.** Map Murshid to ADEK's six safeguards. Add:
  - content filtering suited to UAE values;
  - escalation to a safeguarding lead;
  - no decisions without human review (PDPL Art 18 lets users object to automated decisions);
  - read-only portal access with the school's sign-off;
  - a DPIA, a DPO contact and a breach plan;
  - parental visibility.

**Biggest open gaps:**
- Missing PDPL Executive Regulations.
- The unpublished risk classification under the Child Digital Safety law.
- KHDA's AI policy, due in 2027.
- The Cabinet resolution on 15–17-year-olds trading.
