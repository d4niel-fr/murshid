---
title: "Murshid — Go-to-Market & Integrations Plan"
subtitle: "AI companion and manager for UAE students, Grades 5–12 · Outreach playbook Oct 2026 – May 2027"
date: "Prepared 10 October 2026 · Dubai"
---

# 0. The plan on one page

**What Murshid is.** It's a personal AI manager for UAE students in Grades 5–12. It keeps track of a student's goals, timetable and deadlines, and finds opportunities (competitions, programmes, scholarships). It builds study plans and keeps a live CV and portfolio. V1 is a working demo for the Create AI Agents Championship. V2 connects to school systems (Microsoft 365 / Teams, Google Classroom, and later GEMS Phoenix) once a school or sponsor backs it.

**Founder.** Sam (Vardan Kapur), 17, Grade 11/12 at GEMS Our Own High School, Al Warqa'a, Dubai.

**Main conclusions from the research**

1. **GEMS first, and through the student route rather than the vendor route.** Sam is a GEMS student, so he qualifies for two things outside vendors can't get. The first is the **GEMS Global Innovation Challenge (GIC)**, which is "designed exclusively for students across the GEMS network". The second is the **USD 1M Next Billion Innovation seed fund**, which GEMS opened to GIC entrants. The **GEMS Global Education AI Hub** (corporate pilots) comes second, once there is evidence from a pilot at his own school.
2. **Phoenix is GEMS' own closed platform.** Phoenix RISE (the student management system) and Phoenix Classroom (the LMS) were built in-house, partly on OutSystems through a software-factory partner, and run on Azure. I found no public API or LTI documentation. So a Phoenix integration has to be a **partnership ask**, not something to build now. GEMS student accounts are Microsoft accounts (`@gemselearning.com`), so the **Microsoft Graph route** (calendar, Teams, OneDrive, and possibly Teams Assignments) is technically realistic. It needs **GEMS IT to give admin consent**.
3. **Every school integration in Microsoft or Google needs an IT admin to approve it.** The Microsoft Graph education permissions (e.g. `EduAssignments.ReadBasic`) need admin consent, even as delegated permissions. Google Workspace for Education admins have to allow-list third-party apps before users under 18 can use them at all. The pitch therefore goes to **the principal plus the head of IT/digital**, never to students alone.
4. **The rules are tightening during the pilot window.** The **Child Digital Safety Law** (Decree-Law 26/2025) has been in force since 1 Jan 2026. Platforms must comply within one year, i.e. by about **1 Jan 2027**. It requires verifiable parental consent for under-13s, and bans using children's data for ads or commercial purposes. **KHDA** says its AI and technology policy for schools should be ready "hopefully by next year". **ADEK** already requires Abu Dhabi private schools to use only *ADEK-approved* AI learning tools, under its Technology & AI Policy. The **PDPL**'s Executive Regulations are still not issued, but the law itself has applied since 2 Jan 2022.
5. **Don't form a company yet.** The UAE age of majority dropped to **18 on 1 June 2026**. Sam turns 18 in Sep 2027. Until then, a **parent holds anything legal**: the competition grant, any contract, the Microsoft Partner account. A **school staff sponsor** owns the pilot. The free-zone licence (e.g. in5 / DDA FZ-LLC) comes after the Grand Final, or at 18.

**Top 5 next actions (next 14 days)**

| # | Action | Owner | By |
|---|---|---|---|
| 1 | Ask a teacher at OOW Al Warqa'a to act as **staff sponsor**, and ask how to enter the **GEMS Global Innovation Challenge 2027** and the Next Billion pathway | Sam | 17 Oct |
| 2 | Write the **privacy one-pager** and the **parent consent form** (Appendix C/D). Build the consent flow into the demo, because the competition rules require data protection | Sam + parent | 24 Oct |
| 3 | Record a **90-second demo video** using a synthetic student, with no real data | Sam | 7 Nov |
| 4 | Send the **principal email** (Template 1) with the one-pager and the video, asking for a 20-minute meeting and permission for a 1-class pilot | Sam (parent in cc) | 10 Nov |
| 5 | Register a **Microsoft Entra test tenant** and build the Graph read-only connector (`EduRoster.ReadBasic`, `EduAssignments.ReadBasic`, `Calendars.Read`) against test data, so it is ready the moment a school says yes | Sam | 30 Nov |

---

# 1. The championship: what V1 must hit

Source: official programme page, <https://www.dubaichamberdigital.com/en/create-ai-agents> (fetched 10 Oct 2026); launch coverage, <https://www.thenationalnews.com/news/uae/2026/10/07/dubai-launches-create-ai-agents-championship-with-prize-money-exceeding-dh25m/>.

- **Youth category:** "Best Youth AI Agent – Top Youth-Led Venture". The lead applicant must be **under 21 at registration**. There is no minimum age. Individuals or teams of up to 6 can enter. Entries must be in English and are free.
- **Prize:** **USD 150,000 grant** per category winner (AED 550,000). One of the four winners also becomes *Dubai AI Agent of the Year*, which is reported as AED 1M.
- **Timeline (the official page contradicts itself, so plan for the earlier date):**
  - Registration closes **Dec 2026** according to the FAQ and press release, or **Jan 2027** according to the timeline graphic.
  - Prototype, pitch deck and demo video are due in **Jan 2027**.
  - **24 semi-finalists** are announced in Jan or Feb 2027, then the Tech Accelerator Programme starts.
  - Semi-final pitch is in **Mar 2027**, and **12 finalists** are announced in Mar 2027.
  - The **Grand Final is in the first week of May 2027**. It needs "a fully functional AI agent — not an MVP" shown live.
- **Rules that matter for Murshid:**
  - Entries must be at the idea, prototype or early MVP stage, and *not already commercialised*.
  - The agent must not be copied from an existing repo.
  - The solution "must protect personal, confidential and organizational data and prevent information leakage". → **The privacy design is part of the scoring story, not overhead.**
- **Implication:** a school pilot running Feb–Apr 2027 is the single strongest piece of evidence for the semi-final (Mar) and the Grand Final (May). Getting a "yes" by **mid-Jan 2027** is the critical path.

---

# 2. Schools & school groups

## 2.1 GEMS Education (priority 1, Sam's own network)

**What GEMS runs**

| Item | What it is | Source |
|---|---|---|
| **Phoenix RISE** | End-to-end student management system (SMS) | <https://news.microsoft.com/en-xm/2021/07/28/gems-education-accelerates-its-technology-disruption-journey-by-leveraging-microsoft-technologies-in-the-post-pandemic-era> |
| **Phoenix Classroom** | LMS / VLE: assignments, homework, quizzes, timetable, grades. Students sign in at `gems.phoenixclassroom.com` with their GEMS email (`…@gemselearning.com`) | <https://www.wesgreeninternationalschool-sharjah.com/en/-/media/project/gems/wgp_wesgreen_international_school_sharjah/_files-and-documents/notices/classroom_3_ug_student_v01.pdf> |
| **Who builds Phoenix** | Built in-house by GEMS ("our in-house built Phoenix"), as a "unified school management system built using OutSystems" through Netlink's Software-Factory-as-a-Service. It runs on Azure. GEMS lists Phoenix on the Microsoft marketplace (publisher: GEMS Group Holdings Ltd) | <https://xebia.com/customer-stories/gems-digital-transformationsemsem/> · <https://appsource.microsoft.com/en-us/product/web-apps/gemsgroupholdingslimited1606120362322.tmrw001?tab=overview> |
| **Other GEMS IP** | Connect (mobility), Pulse (CRM), AppStore ("unified view of education apps"), HSE (safeguarding), GEMS Alumni | <https://www.gesseducation.com/gess/gess-talks/advertorial%E2%80%A8/top-k-12-private-education-provider-gems-education-embarks-technology-disruption-journey-using-azure> |
| **Microsoft relationship** | One of "the global education industry's largest Microsoft users". Microsoft Elevate UAE covers 10,000 teachers and 150,000 students at GEMS. GEMS is rolling out custom AI agents co-developed with Microsoft | <https://news.microsoft.com/source/emea/2025/11/microsoft-advances-the-uaes-ai-ambition-with-microsoft-elevate-programme/> · <https://www.edarabia.com/gems-education-lead-future-ai-schools-supported-microsoft/> |

**What this means for Phoenix and LTI/API.** I found **no public developer API, LTI registration or partner SDK for Phoenix**. It's proprietary and internal. Realistic options, in order:

1. **Now (V1):** don't touch Phoenix. Murshid takes in timetables and deadlines through things the student already controls: manual entry, photo or OCR of the homework diary, calendar import (ICS), and forwarding school emails.
2. **Pilot (V2a):** use **Microsoft Graph on the GEMS tenant**, with GEMS IT's admin consent. Calendar and Teams are certain to be there. Whether *assignments* live in Teams Assignments or only in Phoenix Classroom differs from school to school. **Ask GEMS IT** (open question).
3. **Partnership (V2b):** ask GEMS for a **read-only Phoenix feed** for consenting students (assignments, due dates, timetable). Possible forms are an export, a webhook, or listing Murshid in the GEMS "AppStore". This needs sign-off from the **Group technology / Innovation & AI team**, which owns the **Intelligence 360** platform.

**Ways in (use them in this order)**

| Route | Why it fits | Status / source |
|---|---|---|
| **A. School staff sponsor at OOW Al Warqa'a** (Head of Digital Learning / ICT, or Head of Innovation / Careers) | Every other route needs a teacher to endorse it. The sponsor also owns the pilot inside safeguarding rules | Internal |
| **B. GEMS Global Innovation Challenge (GIC)** | "Designed exclusively for students across the GEMS network". It has Junior and Senior categories and 100+ industry judges. Winners get mentoring, incubation (Plug and Play) and seed funding. The 2026 edition launched in **Nov 2025**, so the 2027 edition will probably open around **Nov 2026** *(inferred from last cycle)* | <https://menafn.com/1110725075/GEMS-Education-launches-ninth-Global-Innovation-Challenge-with-record-600-student-startup-entries-and-expanded-seed-funding-pipeline> |
| **C. Next Billion Innovation fund (USD 1M)** | It started at GEMS SRI and then "will be expanded to encompass the … GEMS Global Innovation Challenge". About USD 50k had already been awarded to incubated projects by Feb 2026 | <https://www.gemseducation.com/en/News-and-Events/News/GEMS-Education-launches-Next-Billion-Innovation-startup-fund-for-future-creators-and-entrepreneurs> |
| **D. GEMS Global Education AI Hub** | Invites "edtech companies and startups with a clear AI roadmap". It offers anonymised data, testing at GEMS School of Research & Innovation (SRI), "deployment and scaling support", and philanthropic or commercial pathways. Contact is the email on the announcement page | <https://www.gemseducation.com/en/News-and-Events/News/GEMS-Global-Education-AI-Hub-launched-to-transform-the-future-of-learning> |
| **E. Group Innovation, AI & Futurism leadership** (SVP Innovation, AI & Futurism / MD Intelligence 360) | This team owns the Napster AI-agents partnership (Sept 2026). They are actively looking at "AI agents and digital personas" for GEMS schools, so Murshid is directly relevant | <https://www.education-uae.com/gems-education-and-napster-explore-ai-agents-for-schools-across-the-uae> |

**"GEMS Ventures":** I couldn't confirm a separate corporate-VC arm by that name. For a student founder, the GEMS investment vehicle is the **Next Billion Innovation fund** together with the **GIC → Plug and Play incubator** pipeline. Don't put "GEMS Ventures" in any email.

**How to pitch GEMS (positioning).** Pitch it as "a GEMS student built an agent that helps GEMS students act on what Phoenix already tells them, and it is privacy-first and parent-approved". It is not a "replace Phoenix" pitch. Tie it to things GEMS already says publicly:

- KHDA's new **FutuReady academic & career guidance standards** (schools have 3 years to implement): <https://web.khda.gov.ae/en/About-Us/News/2026/>
- GEMS' AI-agent push with Microsoft and Napster
- University and career pathways

## 2.2 Delhi Private School (DPS) Dubai & Sharjah

| | DPS Dubai (The Gardens, Jebel Ali) | DPS Sharjah |
|---|---|---|
| Portal / LMS | **CLP, the "Comprehensive Learning Platform"**. Students and parents get CLP IDs. The back end is the "Comprehensive School Management System", **powered by IYCWorld** | Same **CLP** model: assignments and announcements, plus WhatsApp groups. CSMS is powered by IYCWorld |
| Microsoft | Its IT policy mentions web apps and videoconferencing. Its LinkedIn tech stack lists Microsoft 365 *and* Google Classroom *(weak signal)* | Students have **Office 365 accounts** (`…@dpssharjah.onmicrosoft.com`) through the Microsoft Student Advantage programme |
| Integration route | No public CLP/IYCWorld API found. Use **Graph** if they run Teams classes, or else manual/ICS import | Graph is possible because an O365 tenant exists. Assignments stay in CLP |
| Who to contact | Principal & Director; Head of ICT; Supervisor for Grades 11–12 | Principal; Headmistress for Grades 11–12 or 9–10; ICT department (role inbox `ICT@` is published) |

Sources: <https://website.dpsdubai.com/faq> · <https://csms.dpsdubai.com/> · <https://www.dpssharjah.com/dpssharjah/UserSpace/UserName/admin/DynamicFolder/news_events/Events/Office365/Student_Program.html> · <https://www.bayut.com/schools/delhi-private-school-sharjah/>

**Fit:** DPS runs the CBSE curriculum, like OOW, so the timetables, board-exam pressure and Indian-university/abroad pathways Murshid already models carry over directly. **Priority 2** after GEMS, with the same pitch.

## 2.3 Other groups (lower priority until there is pilot evidence)

| Group | Footprint | Tech / innovation signal | Approach |
|---|---|---|---|
| **Taaleem** | Premium Dubai schools, plus Dubai Schools (PPP) and Ajyal/charter schools | Took part in a DFF + KHDA + Teacherly co-creation (2019). Pilots with Disrupt-X/Intel at GITEX 2025. Its annual report says it "continually explores platforms that provide personalised education" | Group innovation / digital lead, after GEMS results. <https://www.taaleem.ae/wp-content/uploads/2024/10/Taaleem-AR23-24-Integrated-Annual-Report-E-Final.pdf> |
| **Aldar Education** | About 33k students across 31 Abu Dhabi schools, including charter and Ajyal | **ADEK-regulated**, so Murshid must be **ADEK-approved** before any student use | Only after ADEK approval. <https://www.aldar.com/education> |
| **Innoventures Education** | About 9,000 students (DIA, Raffles, Collegiate) | Runs **Microsoft Teams** and O365 (BYOD). Has a **Group Head of Educational Technology**, uses youHQ for wellbeing, and has a KHDA-approved Learning Lab | Good **Graph-ready** target for wave 2. <https://techxmedia.com/en/innoventures-education-enhances-to-be-a-fully-integrated-digital-environment/> · <https://www.innoventureseducation.com/key-management-ive> |
| **Bloom Education** | Brighton College (Abu Dhabi, Al Ain, Dubai), charter schools | Mostly ADEK | Wave 3. <https://www.bloomeducation.com/> |

## 2.4 Regulators: KHDA (Dubai), ADEK (Abu Dhabi), MoE (federal)

**KHDA (Dubai private schools: GEMS, DPS Dubai, Taaleem, Innoventures)**

- There's **no KHDA product-approval process for a third-party student app** that I could find. The *school* decides, under KHDA oversight and safeguarding expectations. KHDA permits apply to schools and training institutes, not to software vendors.
- **The AI and technology policy is coming.** The KHDA Director General said on 1 Oct 2026: "We expect, hopefully, by next year, to have our policy and standards ready". It will cover when AI and devices are appropriate and what safeguards apply. <https://gulfnews.com/uae/dubai-khda-to-issue-clear-rules-on-ai-mobile-phone-use-for-students-1.500694604> → **Build to the strictest likely reading now:** teacher/parent oversight, no ads, no model training on student data, and a DPIA.
- **FutuReady Standards** (10 Sep 2026) cover academic and career guidance, including "digital and AI-enabled guidance", with a 3-year implementation window. **This is Murshid's best policy hook in Dubai.**
- **Dubai Students Council** (Grades 9–12, 16 members, second cohort chosen 7 Oct 2026). Parents and Educators Councils have also started. Sam could apply for a future cohort; these councils are also a channel for feedback. <https://www.khaleejtimes.com/uae/education/dubai-khdaparents-and-educators-councils-renews-students-council-2026-27>
- **"What Works"** has been KHDA's school-to-school practice-sharing event series since 2012. It's a speaking or showcase venue *once a school has pilot results*, presented with the sponsor teacher. It is not an approval process. <https://web.khda.gov.ae/getattachment/Resources/Publications/Collaborative-Studies/Collaboration-Road-Dubai%E2%80%99s-Journey-towards-Improve/20190324160314_CollaborationRoad.pdf.aspx?ext=.pdf&lang=en-GB> *(I couldn't confirm a 2026–27 What Works schedule.)*

**ADEK (Abu Dhabi: Aldar, Bloom, GEMS Abu Dhabi schools)**

- The **Technology & AI Policy** requires schools to use "AI learning tools that meet ADEK requirements". It sets safeguards in six areas: data protection and student privacy, cognitive agency, academic integrity, human oversight, content safety and cultural alignment, and algorithmic fairness. <https://www.adek.gov.ae/Media-Centre/News/ADEK-Advances-AI-Literacy-Initiative-across-170-Private-Schools>
- Schools keep an "Approved AI and Digital Tools Register". The AY 2026/27 priority deadline for ADEK approval was 28 Sep 2026 (example school policy): <https://www.universalschool.net/Policies/UPS%20-%20AI%20AND%20TECHNOLOGY%20POLICY.pdf>
- The **School Digital Policy** sets standards for "uploading of student data on external applications" and requires vetting of third-party providers. <https://www.adek.gov.ae/-/media/Project/TAMM/ADEK/Policies/School-Policies/Health-safety-and-wellbeing/ADEK_S_Digital-Policy_EN.pdf>. The Assessment Policy forbids sharing student assessment data with third parties without parental consent *and* ADEK approval.
- → **Keep Abu Dhabi out of scope until 2027–28.** Design the privacy pack around ADEK's six safeguards anyway, because KHDA will probably converge on something similar.

**MoE (federal)**

- AI has been a compulsory K–12 subject in public schools since 2025–26 under the UAE National AI Literacy Curriculum Framework. Its materials rule: "must not require students to input personal or sensitive data into external AI systems". <https://moe.gov.ae/Documents/en/AI-Literacy/AI%20Literacy%20Framework/UAE-National-AI-Literacy-Curriculum-Framework.pdf>
- **Emirates Young Scientist Competition (EYSC) 2026**, run by MoE + ATRC, is for Grades 5–12 in teams of 2–3, with a teacher submitting. It's a possible secondary showcase. <https://challengeon.atrc.ae/en/challenges/eysc2026>

## 2.5 Data protection & child safety: what Murshid must do

| Law / rule | What it requires | Murshid response |
|---|---|---|
| **Child Digital Safety Law, Federal Decree-Law 26/2025.** In force 1 Jan 2026. One-year regularisation, so by about 1 Jan 2027 (Cabinet can extend) | Applies to apps "operating in the UAE or directed to users therein". "Child" means under 18. **Under-13s:** no collecting or processing data without "explicit, documented and verifiable" caregiver consent and an easy withdrawal option. **No commercial or targeted-advertising use of children's data.** Age verification and default privacy settings | Verified parent consent for **all** under-18 users, not only under-13s (simpler and stronger). Grades 5–7 (age 10–13) get a parent-linked account. No ads, ever. One-tap consent withdrawal plus data deletion. Age gate at sign-up. <https://uaelegislation.gov.ae/en/legislations/3912> · <https://hzlegal.ae/laws/family-community/federal-decree-law-26-2025-child-digital-safety> |
| **PDPL, Federal Decree-Law 45/2021** | In force since 2 Jan 2022. Executive Regulations still **not issued** as of Sep 2026, and the new AI & Data Authority (June 2026) has taken over the regulator role. Contains a right to object to automated decisions and limits on cross-border transfers | Consent records, a data-subject request process, data minimisation. **UAE or approved-region hosting** (Supabase region choice, model providers with no training on inputs). A DPIA template ready for schools. <https://itsecnow.com/post/uae-pdpl-in-2026-the-executive-regulations-still-arent-issued-heres-what-applies-today> |
| **School-side expectations** (KHDA practice, ADEK policy) | DPIA before deploying AI. Vendors contractually barred from using student inputs for training. No sensitive or health data in public models | Offer a **Data Processing Agreement** template. Put the model-provider "zero retention / no training" settings in writing |
| **Social-media rules** (Cabinet Res. 106/2026: under-15s can't hold personal social accounts) | Murshid isn't social media, but **"grow the student's reach"** features drift that way | V1: CV and portfolio stay **private by default**. No public profiles or feeds for under-15s |

---

# 3. The Microsoft path (and Google)

## 3.1 What the APIs give you

**Microsoft Graph education APIs** are rostering plus Teams Assignments. <https://learn.microsoft.com/en-us/graph/api/resources/education-overview?view=graph-rest-1.0>

| Need | Endpoint | Least-privilege permission | Consent |
|---|---|---|---|
| Student's classes | `GET /education/me/classes` | `EduRoster.ReadBasic` (delegated) | Admin |
| Student's assignments (no grades) | `GET /education/users/{id}/assignments` or `/education/classes/{id}/assignments` | **`EduAssignments.ReadBasic`** (delegated). App-only: `EduAssignments.ReadBasic.All` | **Admin consent required**, even delegated |
| Submissions / status | `/education/classes/{id}/assignments/{id}/submissions` | `EduAssignments.ReadBasic` | Admin |
| Grades | same | `EduAssignments.Read` (higher) | Admin. **Avoid in V2a** |
| Timetable / events | `/me/events`, `/me/calendarView` | `Calendars.Read` | User (if the tenant allows) |

Sources: <https://learn.microsoft.com/en-us/graph/api/educationuser-list-assignments?view=graph-rest-1.0> · <https://graphpermissions.merill.net/permission/EduAssignments.ReadBasic> (AdminConsentRequired: Yes).

Personal Microsoft accounts are **not supported**; only work/school accounts work. Assignments APIs are available in the global cloud only.

**Admin-consent flow, per school tenant**

1. Register Murshid as a **multitenant** Entra app. List all permissions in `requiredResourceAccess` so `.default` works.
2. Send the school's Entra admin the **tenant-wide consent link**: `https://login.microsoftonline.com/{tenant-or-domain}/adminconsent?client_id={murshid-client-id}`. A Privileged Role Admin or Cloud/Application Admin approves once for the whole school. <https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/grant-admin-consent>
3. Admins can limit the app to the pilot class only, using **"Assignment required"** on the enterprise app (assign only the pilot group). *Recommended in the pilot proposal.*
4. **Publisher verification:** since Nov 2020, users often *cannot* consent to unverified multitenant apps, and admins are told to prefer verified publishers. Verification needs a **Microsoft AI Cloud Partner Program (MPN) account**, which means a legal entity. Until one exists, rely on admin consent and explain the "unverified" label in the privacy pack. <https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview>

**Teams-native options (later):** a Teams app can be added as an **assignment resource** if Microsoft enables it on request (app manifest ≥1.6, "Learning and Training" category). Store listing goes through **Partner Center**, which puts the app on the Teams Store and the Microsoft Marketplace (AppSource). <https://github.com/microsoft/edu-assignments-apps-sample/wiki/Assignment-Apps-Integration-Requirements> · <https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/deploy-and-publish/appsource/publish>. **LTI 1.3** matters only if a school runs Canvas or Schoology, and none of the targets do.

## 3.2 Microsoft programmes

| Programme | What you get | Eligibility snag for Sam | When |
|---|---|---|---|
| **Microsoft for Startups** (formerly Founders Hub) | Starter credits while under review, then up to USD 150k Azure credits over time. Joiners after 29 May 2026 get USD 100k on approval through the Azure portal. Investor-network startups get marketplace and co-sell help | Must be a **privately held, for-profit company** that owns its software. Not available to individuals | Apply **after** the company exists (parent-held), or after winning. <https://learn.microsoft.com/en-us/startups/microsoft-for-startups/overview> |
| **Microsoft AI Cloud Partner Program / Partner Center** | Publisher verification, Teams Store / Marketplace listing | Needs a company | Q2–Q3 2027 |
| **Microsoft UAE education** (Microsoft Elevate UAE; Alef + Microsoft trained 25k teachers; GEMS partnership; Showcase Schools / MIE Experts) | Visibility; GEMS is a flagship partner | Approach **through GEMS**, not cold | After the pilot. <https://news.microsoft.com/source/emea/2025/11/microsoft-advances-the-uaes-ai-ambition-with-microsoft-elevate-programme/> · <https://www.wam.ae/en/article/c13o6zq-alef-education-microsoft-empower-25000-educators> |

**Ask to make to Microsoft UAE (education/public-sector team):** a GEMS-endorsed introduction, a note confirming technical feasibility, and access to an M365 Education sandbox. Don't ask for money.

## 3.3 Google Classroom (brief)

- Scopes for a student reading their own work: `classroom.courses.readonly`, `classroom.coursework.me.readonly`. These are **sensitive scopes**, so Google app verification is needed for public use. <https://developers.google.com/workspace/classroom/guides/manage-coursework>
- **Users under 18:** Workspace for Education admins *must configure the app* in the Admin console, or students see "Access blocked". This can't be done through the API. <https://developers.google.com/workspace/classroom/guides/key-concepts/admin-actions>
- Relevance: low for GEMS and DPS, which are Microsoft-heavy. Keep the connector, ship it after Graph.

---

# 4. Government & backing programmes

| Programme | Fit now (17, no company) | Notes / source |
|---|---|---|
| **Create AI Agents Championship (Youth)** | **Core.** Already registered (interest form, 10 Oct) | §1 |
| **GEMS GIC + Next Billion fund + Plug and Play** | **Core.** Student-only | §2.1 |
| **KHDA Dubai Students Council** | Good for voice and network; next cohort application | Grades 9–12 |
| **MBZUAI AI Youth Ambassadors** (Grades 11–12) | Good for credibility and mentors | <https://mbzuai.ac.ae/innovation-partnerships/uae-national-programs-outreach> |
| **DFF TKS Innovation Program** | 2026–27 deadline passed (30 Jul 2026); aim for the next cycle | <https://www.dubaifuture.ae/tks-innovation-program/> |
| **DFF Dubai Future Accelerators / DCAI agentic-AI accelerator** | Not yet. Built for companies co-building *government* services (priority to Dubai AI Seal holders) | <https://www.dubaifuture.ae/dcai-accelerators/> |
| **in5 Tech (TECOM, Dubai Internet City)** | **After the company exists.** Rolling applications, must be Dubai-based, DDA FZ-LLC set-up, subsidised for up to 5 years | <https://infive.ae/in5-tech/> · <https://infive.ae/business-setup/> |
| **Hub71 Access (Abu Dhabi)** | No. Pre-seed to Series A, a founder must relocate to Abu Dhabi. Cohort 21 deadline Feb 2027 | <https://www.hub71.com/program/access-programme> |
| **MBRIF Innovation Accelerator** (Ministry of Finance) | Later. For scaling innovative businesses | <https://mbrif.ae/mbrif-welcomes-11th-cohort-of-innovators-into-the-innovation-accelerator-program/> |
| **Federal Youth Authority / Abu Dhabi Youth Council (Shabab AI, Tamkeen)** | Mostly for Emiratis; Sam is an Indian national | <https://www.wam.ae/en/article/c03y673-abu-dhabi-youth-council-launches-%E2%80%98shabab-ai%E2%80%99> |
| **MoE / ATRC EYSC** | Possible in a team of 2–3, with the school submitting | §2.4 |

---

# 5. Outreach playbook

## 5.1 Who to contact (titles only)

| Organisation | Primary | Secondary | Channel |
|---|---|---|---|
| OOW Al Warqa'a | **Principal / CEO-Principal** | Head of Digital Learning / ICT; Head of Innovation; Careers & University Counsellor; DSL (safeguarding lead) | In person via a teacher, then email |
| GEMS Group | **SVP Innovation, AI & Futurism / MD Intelligence 360**; Global Education AI Hub team | GEMS Innovation Fellow / GIC programme team; Group Technology (Phoenix product owner) | GIC portal; AI Hub email on the announcement page |
| Microsoft UAE | Education / Public-Sector Lead | Microsoft for Startups (after incorporation) | Warm intro via GEMS; LinkedIn |
| DPS Dubai / Sharjah | Principal & Director | Head of ICT; Grades 11–12 supervisor | Official school email |
| Innoventures | Group Head of Educational Technology | School principal | Email after pilot data |
| KHDA | Students Council application; What Works team | — | Official channels only |

## 5.2 Email templates

> Rules for every email: CC a parent. Keep it under 180 words. Attach the one-pager PDF plus a link to the 90-second video. Ask for **one** specific thing. Never attach real student data.

**Template 1: To the principal (own school)**

> **Subject:** Grade 11 student request: 6-week pilot of a student-built AI planner (Create AI Agents Championship)
>
> Dear [Principal title and name],
>
> I'm Vardan Kapur (Sam), Grade [11/12] [section]. I'm entering Murshid, an AI agent that helps students turn deadlines, goals and opportunities into a weekly plan, in the Dubai Chamber's Create AI Agents Championship (Youth category).
>
> I'd like to ask permission to run a **6-week pilot with one class** (about 25 volunteers) from February, with [teacher name] as staff sponsor. Pilot design:
>
> - parent consent first, opt-in only, and students can leave at any time;
> - no grades or sensitive data, no ads, and student data is never used to train AI models;
> - data is deleted at the end unless a family chooses to keep its account.
>
> A one-page privacy summary and a 90-second demo are attached. Could I have 20 minutes with you and the Head of Digital Learning in the week of [date]?
>
> Thank you,
> Vardan Kapur (Sam) · Grade [x] · [student email]
> cc: [Parent name], parent/guardian

**Template 2: To the GEMS innovation / AI Hub lead**

> **Subject:** GEMS student-built AI agent: request to join GIC pathway / AI Hub sandbox
>
> Dear [Title],
>
> I'm a Grade [x] student at GEMS Our Own High School, Al Warqa'a. I've built Murshid, a student "manager" agent that plans study weeks, tracks deadlines and finds competitions and scholarships. It's designed for UAE privacy rules from day one (parent consent, no ads, no training on student data).
>
> [Principal/teacher] has approved a 1-class pilot at OOW from [date]. *(Use only once true.)* I'm asking for two things:
>
> 1. guidance on entering GIC 2027 / the Next Billion Innovation pathway with Murshid; and
> 2. a conversation with the team that owns Phoenix Classroom about a **read-only, consent-based** way to show students their own due dates (export, feed or AppStore listing), or Microsoft Graph consent for the pilot class.
>
> A 90-second demo and a privacy one-pager are attached. I'd value 20 minutes at your convenience.
>
> Kind regards, Vardan Kapur (Sam) · cc parent

**Template 3: To Microsoft UAE Education**

> **Subject:** Student-built Teams/Graph agent for UAE schools: feasibility check and sandbox request
>
> Dear [Title],
>
> I'm a 17-year-old GEMS student and a Create AI Agents Championship entrant. My agent, Murshid, reads a student's own classes and assignments through Microsoft Graph (`EduRoster.ReadBasic`, `EduAssignments.ReadBasic`, no grades) and turns them into a weekly plan, with tenant-wide admin consent restricted to one pilot class.
>
> Could your team (a) confirm we are using the right least-privilege pattern for a K-12 pilot, and (b) point me to an M365 Education sandbox or the right programme for a pre-incorporation student founder? I will apply to Microsoft for Startups once the company is formed.
>
> Demo (90 s) and privacy one-pager attached.
>
> Thank you, Vardan Kapur (Sam) · cc parent

**Follow-up rule:** send one follow-up after 7 working days, then move on. Log each contact in `docs/outreach/CONTACTS.csv` (create it when the first email goes out; titles and official addresses only).

## 5.3 Pilot proposal: 1 class, 6 weeks

| Item | Detail |
|---|---|
| **Who** | 1 class, Grade 9–11 (aged 14+, which avoids the under-13 rules entirely). About 20–30 volunteers. Opt-in, with a non-participant alternative available |
| **Sponsor** | 1 named teacher (owner) plus the school DSL sign-off |
| **Dates** | Wk 0 = consent (late Jan 2027) → Wks 1–6 = 1 Feb – 14 Mar 2027 → results by 20 Mar (in time for the semi-final) |
| **Features in scope** | Weekly planner, deadline capture (manual/ICS, or Graph read-only if IT consents), reminders, opportunity finder, CV builder (private) |
| **Out of scope** | Grades, health or wellbeing data, contacting anyone for the student, public profiles, any chat with strangers |
| **Data** | Name, school email, class, deadlines the student enters, goals. Hosted in [region], encrypted. Model providers on no-retention / no-training settings. **Deleted within 30 days of the pilot ending** unless a family opts to keep it |
| **Consent** | Parent consent form (Appendix D) + student assent. Withdrawal by one tap or one email. Consent records kept |
| **Teacher load** | 15-min briefing + 2 check-ins. Nothing to grade |
| **Safeguarding** | Content filters, escalation of any concerning message to the sponsor/DSL per school policy, human-reviewed prompts, an incident log |

**Success metrics (agree with the sponsor before starting)**

| Metric | Target | How measured |
|---|---|---|
| Weekly active students | ≥ 70% of enrolled in weeks 2–6 | App analytics (aggregated) |
| On-time submission (self-reported) | +15% vs week-0 baseline | Weekly 3-question check-in |
| "I know what's due this week" | ≥ 80% agree by week 6 | Likert survey wk 0 vs wk 6 |
| Opportunities saved / applied | ≥ 1 applied per 3 students | In-app |
| Teacher view | Sponsor would recommend another class | 10-min interview |
| Safety | 0 data incidents; 100% consent coverage | Incident log, consent records |

## 5.4 What to show

1. **90-second demo video.** Use a **synthetic** Grade 10 student. Show: Sunday plan → deadline added → reminder → opportunity matched → CV updated → parent consent screen. Captions in English, Arabic subtitles if possible.
2. **Privacy one-pager** (Appendix C). Plain English, built around ADEK's six safeguards and the CDS Law.
3. **Live demo link** with seeded demo accounts only.
4. **3-slide school deck:** problem (student overload) → Murshid → pilot ask.
5. **Later:** a pilot results sheet (one page, charts) for the semi-final, the GEMS AI Hub and Microsoft.

## 5.5 Timeline, Oct 2026 – May 2027

| Month | Murshid / product | Outreach | External dates |
|---|---|---|---|
| **Oct 2026** | Consent flow, privacy page, demo seed data | Find staff sponsor; draft one-pager, consent form | Championship Explore phase; KHDA councils formed (7 Oct) |
| **Nov 2026** | Graph connector on test tenant; record demo video | Principal email + meeting; GEMS GIC entry (expected to open ~Nov) | Championship Build phase; Digital Academy |
| **Dec 2026** | **Demo-ready (mid-Dec)**; DPIA pack | School IT meeting; AI Hub / innovation email; **confirm championship registration** | Registration may close in Dec |
| **Jan 2027** | Pilot build-hardening; parent consent collection | Consent letters out via school; Microsoft email | **Submit prototype + deck + video**; CDS Law regularisation (about 1 Jan) |
| **Feb 2027** | **Pilot weeks 1–4** | Weekly sponsor check-ins | Semi-finalists announced (Jan/Feb); Hub71 C21 deadline (not applying) |
| **Mar 2027** | Pilot weeks 5–6, results | Results one-pager to principal and GEMS | **Semi-final pitch; 12 finalists** |
| **Apr 2027** | Fully functional agent (not MVP) | DPS + Innoventures outreach with evidence | Finalists' pitch training |
| **May 2027** | Live Grand Final demo | Post-final: Microsoft for Startups / in5 prep (entity) | **Grand Final, week 1** |

## 5.6 Founder structure for a 17-year-old

- **Legal capacity.** The UAE age of majority has been **18 since 1 June 2026** (Federal Decree-Law 25/2025). From 18 you can own a company, sign contracts and open bank accounts without a guardian. At 15, minors can seek *court* authorisation to manage assets, which isn't worth it here. <https://www.thenationalnews.com/news/uae/2026/05/31/uae-law-lowering-age-of-adulthood-to-18-comes-into-effect-on-monday>
- **Until Sam turns 18 (Sep 2027):**
  1. **Parent/guardian** signs any grant agreement, prize paperwork, cloud or billing accounts, and data-processing agreements. A simple family agreement records that **Sam owns the IP** and that shares or IP transfer to him at 18.
  2. A **school sponsor** (a named teacher) owns the pilot inside school safeguarding. Murshid runs as a **student project** with the school's permission, not as a vendor contract.
  3. **Grant money:** clarify with the organisers how a Youth winner under 18 receives USD 150k (paid to a guardian, or to a company formed later). **Ask early (open question).**
- **Company (when it's needed: winning, Microsoft for Startups, Partner Center, paid school contracts):**
  - Either a parent-owned free-zone company (e.g. **DDA FZ-LLC through in5**), with a shareholder agreement transferring shares to Sam at 18; or wait until Sep 2027 and incorporate in Sam's name.
  - Check KHDA: an *app* for students doesn't need a KHDA educational permit, but **paid tutoring/training activity might**. Confirm the licence activity (software/IT) with the free zone.
- **Brand:** check "Murshid" against Abwaab's "Morshed" before any public launch, and file a trademark through the entity later.

## 5.7 Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| School says no, or is slow (safeguarding, policy uncertainty before the KHDA AI policy) | High | Ask small (1 class, opt-in, 6 weeks, no grades). Get the sponsor first. Fall back to an **after-school club / home pilot with parents' consent** (no school data) |
| IT won't grant Graph admin consent | Medium–High | The pilot works without integration (manual/ICS). Treat Graph as an upgrade, not a dependency |
| CDS Law / PDPL non-compliance | Medium | Parent consent for all users, no ads, deletion, DPIA, no-training model settings, UAE-friendly hosting. Get a review from a lawyer (pro bono through in5 or the championship mentors) |
| Data incident with minors | Low but severe | Least privilege, no grades or health data, encryption, incident runbook, sponsor and DSL notification |
| Overreach ("government-backed", "GEMS-approved") | Medium | Only claim what is signed. Say "partnership-ready", not "endorsed" |
| AI gives harmful or academic-dishonest help | Medium | Planner/coach mode (no essay writing), content filters, academic-integrity rules aligned with school AI policy |
| Founder overload (Grade 11/12 + boards) | High | Freeze the scope in Dec. One school, one class. Parent is the admin co-pilot |
| Phoenix never opens up | High | Graph + ICS + manual cover 80% of the value. Phoenix stays a partnership upside |

---

# Appendix A. Integration build order

1. **V1 (now):** manual entry, ICS calendar import, email forward-in, opportunity crawler (already built).
2. **V2a:** Microsoft Graph: `User.Read`, `Calendars.Read`, `EduRoster.ReadBasic`, `EduAssignments.ReadBasic`. Multitenant app, tenant-wide admin consent, "assignment required" limited to the pilot group.
3. **V2b:** Google Classroom: `classroom.courses.readonly`, `classroom.coursework.me.readonly` (verification + admin allow-list).
4. **V2c:** Phoenix read-only feed (partnership) / DPS CLP (partnership).
5. **V3:** Teams app (assignment resource), Partner Center listing, publisher verification (needs the entity).

# Appendix B. Open questions to resolve

- Do OOW Al Warqa'a classes use **Teams Assignments** at all, or only **Phoenix Classroom**? (Ask the Head of Digital Learning.)
- How is the **Youth grant paid to an under-18 winner**? (Ask the championship organisers.)
- When does the **GIC 2027** entry window open, and can a solo Senior entrant join? (Ask the school's innovation coordinator.)
- Which **Supabase/LLM regions** will meet the school's data-residency expectations?

# Appendix C. Privacy one-pager (draft)

**Murshid — how we protect students**

- **Who it's for:** students in Grades 5–12 *with a parent's permission*. Under-13s can only use Murshid through a parent-linked account.
- **What we collect:** name, school email, grade, the deadlines and goals a student adds, and saved opportunities. **Not** grades, health data, location, contacts or photos of other people.
- **What we never do:** show ads, sell data, use student data to train AI models, or make a student's profile public.
- **Where data lives:** encrypted, in [region]. AI providers are used on settings that don't retain or train on inputs.
- **Control:** parents see what's stored. Consent can be withdrawn in one tap, and data is deleted within 30 days.
- **School integrations:** read-only. They are switched on only by the school's IT administrator, for named classes, and can be revoked at any time.
- **Human oversight:** Murshid suggests and reminds; students and teachers decide. Concerns go to the school's safeguarding lead.
- **Built for:** UAE Child Digital Safety Law (26/2025), UAE PDPL (45/2021), and ADEK's six AI safeguards.
- **Contact:** [project email] · Parent/guardian contact: [name]

# Appendix D. Parent consent form (outline)

1. Pilot purpose, sponsor teacher, dates.
2. Data collected and not collected (from Appendix C).
3. Checkboxes (separate, all optional):
   - ☐ My child may take part.
   - ☐ Murshid may read my child's class list and assignment due dates from the school's Microsoft account (read-only).
   - ☐ Anonymised, aggregated results may be used in the Create AI Agents Championship pitch.
4. Withdrawal: by email or in-app at any time, with no effect on grades or school standing.
5. Deletion date.
6. Signatures: parent/guardian, student assent, sponsor teacher.

---

*Sources were checked on 10 Oct 2026. Items marked "inferred" are judgements, not published facts. No personal contact details were collected; contact people by title through official channels.*
