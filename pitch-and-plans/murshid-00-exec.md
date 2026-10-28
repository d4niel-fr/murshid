---
title: "Murshid — Full Blueprint"
subtitle: "Every athlete has a manager. Now every student does too."
date: "10 October 2026"
---

# Executive summary

**The product.** One AI agent per student, built around their identity and goals. Behind it, several models work together. It reads class material, plans each week, finds and helps with applications, keeps a live CV, and sends a weekly briefing. It runs on phone (iOS and Android) and web from a single Expo codebase, with a Next.js site.

**Deadline.** Official sources (Dubai Media Office, Gulf Today) say registration closes in **December 2026**, and a prototype, pitch deck and demo video are due with it. Some pages say January. **Plan to be demo-ready by mid-December.** Each Youth category winner gets **USD 150,000**. The final (first week of May 2027) needs a fully working agent shown live.

**The models (verified, Oct 2026).**

| Job | Model | Price per 1M tokens (in / out) |
|---|---|---|
| Router and everyday chat | GPT-6 Luna (or Haiku 5.5) | $0.10 / $0.50 |
| Heavy planning, CV and essay coaching | Claude Sonnet 5.5 (replaced Sonnet 5 on 28 Sep) | $2 / $10 |
| Long notes and photos of notes | Gemini 3.1 Flash-Lite | $0.25 / $1.50 |
| Hardest reasoning (rare) | GPT-6.1 Sol / Opus 5.5 | $2/$10, $4/$20 |
| Arabic and Emirati dialect | Falcon-H1-Arabic / Falcon-Emirati (self-hosted) | open weights |
| Gateway | LiteLLM or OpenRouter (fallbacks, providers that keep no data) | — |

A realistic active student costs about **$1.29 a month** in AI, if Sonnet calls and searches are capped and weekly jobs are batched. An uncapped heavy user can reach $4–6.

**The stack.** Expo (React Native) for app and web, Next.js on Vercel (Dubai region), Supabase (Postgres + pgvector, login, storage), LangGraph.js / Vercel AI SDK, Inngest for scheduled jobs, Langfuse for monitoring, Exa/Firecrawl for opportunity crawling, Resend for email, push first with WhatsApp opt-in. Running cost is about $50–120 a month for 100 students and $6k–13k for 10,000.

**School links.** Google Classroom has a public API (needs Google verification). Teams needs each school's IT admin to approve. GEMS Phoenix has no public API, so it takes a GEMS partnership, and some GEMS schools are moving to Teams. The MVP uses photo/PDF upload plus an email-forwarding inbox, which works at every school.

**Identity.** UAE PASS needs a trade licence for live use, but the sandbox is free and fine for the demo. The main login is a Google or Microsoft school account.

**Legal must-haves.**

- The Child Digital Safety law (Decree-Law 26/2025) has been in force since Jan 2026, with about a year to comply.
- Murshid should be 13+ only, with parental consent, no ads, high-privacy defaults and a parent view.
- Leave out social posting features: under-15s are banned from social accounts.
- Follow ADEK's six AI safeguards and respect the AI-use level each school sets for a task.
- **Sam is under 18**, so a parent should hold the company (in5 at about AED 1k a year, or a DIFC AI licence at USD 1,500 a year). Sam's equity should be written down, and shares move to him on 14 Sep 2027.

**How to charge: both, in this order.**

1. A free pilot at Our Own High School (about 4,660 students, about 1 counsellor per 930).
2. Parents: free tier, **Plus at AED 29 a month** (or 249 a year), **Pro at AED 79**.
3. Schools: **AED 120–180 per student per year** (about AED 100 across GEMS: 45 schools, about 146k students). Pitch it as replacing both the guidance platform and the AI tutor.
4. Universities and programmes: labelled listings at AED 1.5k–5k a month. Recommendations stay unaffected, and nothing is shared without consent.
5. Government licence (about AED 50–80 per student) later, in 12–24 months.

**Market.** UAE has 1.277M students. Dubai private schools have 406,563, about 73.5k of them in Grades 9–12. UAE private tutoring was worth $565M in 2025.

**Watch-outs.**

- Abwaab already sells a planner called "Morshed", so check the name.
- Apple's developer account and Meta (WhatsApp) verification likely need an adult or a company.
- Gemini Flash prices double on 1 Jan 2027.

**This week.**

1. Confirm the name.
2. Send a 10-question survey to 100+ students.
3. Book 10 interviews.
4. Ask a teacher for a test Google Classroom.
5. Set up the repo (Expo + Supabase).

---
