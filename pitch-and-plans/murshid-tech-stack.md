# Murshid: tech stack and integrations brief (researched 10 Oct 2026)

**Timing first:** official sources say registration closes in **December 2026**, and entries need a prototype, a pitch deck and a demo video (mediaoffice.ae/en/news/2026/october/07-10/hamdan-bin-mohammed-launches-create-ai-agents-championship; gulftoday.ae). Some timeline pages say January (veritygulf.com). Plan for a demo-ready MVP by **mid-December**.

## 1. Recommended stack
| Layer | Pick | Why / source |
|---|---|---|
| App | **Expo (React Native) + Expo Router**: one codebase for iOS, Android and web/PWA | Expo SDK is free; EAS Free tier gives 15 Android + 15 iOS builds a month, and Starter is $19/mo (expo.dev/pricing, docs.expo.dev/billing/faq) |
| Marketing site / admin | Next.js on Vercel | Vercel has a **Dubai function region, dxb1** (vercel.com/changelog/introducing-the-dubai-vercel-region-dxb1). Pro is $20/mo per seat |
| DB + auth + storage + vectors | **Supabase** (Postgres + pgvector + Auth + Storage) | Pro is $25/mo and includes 100k MAU and 8 GB (supabase.com/pricing). It has **no Middle East region** (supabase.com/docs/guides/platform/regions), so use Mumbai (ap-south-1) or Frankfurt. If schools require UAE residency, move to Postgres on AWS me-central-1 (UAE) |
| Agent layer | TypeScript: Vercel AI SDK or LangGraph.js, with tool calls to Supabase, connectors and search APIs; a cheap model for routing (Gemini Flash-class), a stronger model for plans and CVs | Gemini 3.8 Flash costs $0.75 in / $3.75 out per 1M tokens until 31 Dec 2026, then **doubles on 1 Jan 2027** (ai.google.dev/gemini-api/docs/pricing). GPT-5.4 nano costs $0.20 / $1.25 (simonwillison.net/2026/Mar/17/mini-and-nano) |
| Jobs / schedulers | **Inngest** (cron, retries, step functions) or Trigger.dev | Inngest free tier: 50k–100k executions a month (sources differ); Trigger.dev bills by compute-seconds (ondelva.com, apiscout.dev) |
| Push | Expo Push → APNs/FCM | Free and unlimited, capped at 600 notifications/sec (courier.com/blog/expo-notifications) |
| Email | Resend / Postmark (weekly briefing) | — |
| WhatsApp | Meta Cloud API, used only for opt-in reminders | UAE rates from 1 Oct 2026: utility **$0.0157**, marketing $0.0576; service replies are free for the first 1,000 a month per number, then charged (purands.com/whatsapp-pricing/united-arab-emirates, chatmaxima.com). Rates exclude 5% VAT. **Needs Meta Business verification with a trade licence** (nateq.io) |
| Observability | **Langfuse** | Hobby is free for 50k units; Core is $29 + $8 per 100k units; self-hosting is free (langfuse.com/pricing) |
| Web search / scraping | Exa + Firecrawl (Tavily as an alternative) | Exa: $7 per 1k searches, $10/mo free credit. Firecrawl: 1 credit per page, $16/mo for 5k pages. Tavily: $0.008 per credit (exa.ai/pricing, docs.tavily.com/documentation/api-credits, pondero.ai) |

**Rough monthly cost.** These are my own estimates. The model assumes about 300k input and 60k output tokens per student per month, mostly on Flash-class models, which is roughly $0.3–1 per student. Opportunity ingestion is a shared cost and doesn't grow with student numbers.
- **100 students:** ~$50–120 (Supabase free or Pro, Vercel, LLM ~$30–100, everything else on free tiers).
- **1,000 students:** ~$700–1,500 (LLM $300–1,000; Langfuse $29; EAS $19; search/scraping $20–80). WhatsApp adds about $270 at 4 messages a week, so make push the default channel.
- **10,000 students:** ~$6k–13k (LLM $3k–9k is the main cost; Supabase compute $100–300; Inngest Pro $75+). WhatsApp would add about $2.7k, so offer it as an opt-in or premium feature only.

## 2. School integrations
| Platform | Public API? | Access path | Notes |
|---|---|---|---|
| **GEMS Phoenix Classroom** (LMS) / **GEMS Connect** (parent app) | **No public API found** | Partnership with GEMS only. Phoenix signs in with Microsoft/Google (gems.phoenixclassroom.com) and is 1EdTech-certified (site.imsglobal.org), so LTI is possible through GEMS | Some GEMS schools are **moving from Phoenix to Microsoft Teams** (GEMS Legacy School circular, 2026). GEMS runs a Global Education AI Hub for pilots (gemseducation.com news, 30 Jun 2025), which is a good partnership pitch |
| **Google Classroom** | Yes | Student scopes: `classroom.courses.readonly`, `classroom.coursework.me.readonly`, `classroom.courseworkmaterials.readonly`, `classroom.announcements.readonly` (developers.google.com/workspace/classroom/guides/auth) | Needs Google OAuth verification. Sensitive scopes take about 3–5 business days per Google's guide (FAQ says ~10); restricted scopes take ~6 weeks plus a security assessment (support.google.com/cloud/answer/13463817). Confirm the classification in Cloud Console. **School admins can block third-party apps**, so allow-listing is needed (developers.google.com/workspace/classroom/best-practices/access-control-enhancements) |
| **Microsoft Teams / Education** | Yes (Graph education API) | `EduAssignments.ReadBasic` (delegated) | **Requires tenant admin consent** (graphpermissions.merill.net/permission/EduAssignments.ReadBasic; learn.microsoft.com/en-us/graph/api/resources/education-overview), so each school's IT has to approve |
| **ManageBac** (IB) | Yes | School admin creates a token (client-credentials) | School-level only, not per student (help.managebac.com …/360018226931; guide.fariaedu.com) |
| **Toddle** | No public student API found | Uses OneRoster, Edlink, Wonde, Clever (toddleapp.com/integrations) | Partnership |
| **iSAMS** (MIS) | Yes, partners only | Paid Standard/Enterprise partner plans; the school must enable access (marketplace.isams.com/pricing) | Later stage |
| **Arbor** | Yes (REST/GraphQL), partners only | api@arbor-education.com (arbor-education.com/become-a-partner) | Mostly UK schools |
| **Firefly** | SSO API for partners | partnerships@fireflylearning.com (lantern.fireflycloud.net) | — |
| **Seesaw** | Partner-only (unverified; only a third-party source) | — | Primary school, low priority |
| **Edunation** | An API page exists (edu-nation.net/edunation-api); terms unclear | Contact the vendor | — |

**Shortcut:** **Edlink** is a single unified LMS API (ManageBac documents an Edlink flow). It's worth considering once schools sign up.

**Fallback for every school, and the core of the MVP:** photo or PDF upload with OCR in a vision LLM; a per-student forwarding address (e.g. `sam@in.murshid.app`) that parses LMS notification emails; share-sheet import on the phone; and ICS/calendar import.

## 3. Identity
- **UAE PASS:** private companies apply through the developer portal and need a **valid UAE trade licence**. The steps are questionnaire → workflow and UI mockups → staging credentials → signing a Service Provider Agreement → assessment → go-live (docs.uaepass.ae initiation and development phases). There's a public sandbox (`sandbox_stage`) for a proof of concept (docs.uaepass.ae/quick-start-guide-uae-pass-staging-environment/testing-credentials-for-poc), which is useful for the demo.
- **Minors:** registration needs an Emirates ID and a UAE mobile number (dgov.tdra.gov.ae/services/uae-pass). I found **no official minimum age**. UAE PASS's own FAQ tells service providers to offer alternative channels for minors (docs.uaepass.ae/faq), so treat it as optional.
- **Primary sign-in:** Google and Microsoft school accounts, which also unlock the Classroom/Graph scopes. Add parent-link consent.
- **Law:** PDPL (Decree-Law 45/2021) consent rules, plus the **Child Digital Safety law (26/2025)**: under-13s need verifiable parental consent and no targeted ads (uaelegislation.gov.ae/en/legislations/3912; u.ae children's digital safety). Grade 9–12 users are mostly 14–18, but get guardian consent anyway.

## 4. Opportunity data
- **UAE sources:** Emirates Youth Opportunities (opportunities.youth.gov.ae; Emirati-focused), volunteers.ae, Dubai Future Foundation programmes such as TKS Dubai (dubaifuture.ae/tks-innovation-program), the MOE/ATRC Emirates Young Scientist Competition for Grades 5–12 (challengeon.atrc.ae), the UAE Space Agency's Arab Space Pioneer talent track from Grade 10 (space.gov.ae), MBRSC (mostly undergraduate, mbrsc.ae), and Dubai Chamber competitions.
- **Global sources:** Devpost, olympiad sites (IMO, IOI, etc.), MUN calendars (e.g. THIMUN), university summer programme pages.
- **Ingestion:** almost none of these have APIs or RSS. Use a curated seed list of URLs, re-crawled weekly with Firecrawl `/crawl` (with change detection) and an Exa monitor at $15 per 1k (exa.ai/pricing). An LLM extracts a fixed schema (title, eligibility, grade, nationality, deadline, cost, URL) into Postgres, vector-embeds it, deduplicates by URL plus title hash, and runs a nightly job that expires past deadlines. Student submissions are reviewed by a human before they go live.

## 5. CV, LinkedIn, calendar
- **CV/portfolio:** JSON Resume schema → React-PDF or Typst templates; the portfolio is a public Next.js page per student.
- **LinkedIn:** posting as the member is **self-serve** with `w_member_social` through "Share on LinkedIn". Reading their posts (`r_member_social`) is **closed** (learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin; learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access). Third-party guides put limits at about 100 calls per member per day, with 60-day tokens (unofficial). Draft posts and have the student approve each one. LinkedIn's minimum age is 16.
- **Calendar:** Google Calendar API (`calendar.events` is a sensitive scope), Microsoft Graph `Calendars.ReadWrite`, and an ICS subscription feed for Apple.

## 6. Architecture and build order
**Data flow in words:** the Expo app (iOS, Android, web) sends requests through Supabase Auth (Google/Microsoft) to Supabase Postgres, which holds the profile, goals, courses, tasks, opportunities, embeddings and CV. The agent API (Vercel, dxb1) calls the LLMs, the search tools and the connectors. Inngest crons run ingestion, the weekly briefing, reminders and deadline sweeps. Output goes to Expo Push, email and opt-in WhatsApp. Langfuse traces every agent call.

**MVP by mid-December 2026:**
1. Onboarding (identity, goals, grade, interests)
2. Upload/forward ingestion and a study plan
3. Opportunity finder over a curated 50–100 sources
4. CV builder → PDF
5. Weekly briefing and push reminders
6. Google Classroom read-only in Testing mode (up to 100 test users is fine for a demo)
7. UAE PASS sandbox login as a "partnership-ready" demo

**Later (2027):** verified Google app, Microsoft Teams with school admin consent, the GEMS partnership or LTI, ManageBac tokens per school, production UAE PASS (needs a trade licence, e.g. through a parent's company or a free-zone/youth licence), WhatsApp (Meta verification), the LinkedIn auto-post flow, application auto-fill, Arabic UI, and UAE data residency.

**Practical blockers for a 17-year-old founder (unverified, not fetched):** Apple's developer program, Meta Business verification and UAE PASS all expect an adult or a licensed entity. A parent or guardian entity is the usual workaround.
