# @murshid/documents

Turns a student's profile + achievements into CVs, a one-page portfolio and printable application checklists. Fully local: no network, no AI.

## What it does

| Export | Purpose |
|---|---|
| `toJsonResume({ student, achievements, school?, contact?, target?, courses?, score?, includePersonalDetails?, now? })` | Maps Murshid data → [JSON Resume v1.0.0](https://jsonresume.org/schema). This is what goes into `CvVersion.json`. |
| `validateJsonResume(resume)` | Lightweight structural check (required name, arrays, ISO-8601 dates). Returns a list of problems. |
| `renderCvPdf(resume, template, opts?)` | PDF bytes (`Buffer`) for `'clean' \| 'academic' \| 'internship'`. |
| `TEMPLATE_FOR_TARGET` | `general→clean`, `university→academic`, `internship→internship`. |
| `renderPortfolioHtml(resume, { showContact?, accent?, tagline? })` | One self-contained HTML page (inline CSS, no JS/external assets, print-friendly, `noindex`). |
| `renderApplicationChecklistPdf({ student, opportunity, application, now? })` | Printable checklist with tick boxes, progress bar and Dubai-time deadline countdown. |
| `defaultChecklist(opportunityType, { needsGuardian?, hasFee? })` | Rule-based starter checklist per opportunity type (for `Application.checklist`). |

### Achievement → JSON Resume mapping
| Achievement.category | JSON Resume section |
|---|---|
| `work` | `work` ("Role at Org" / "Role — Org" split into position + name) |
| `volunteering` | `volunteer` |
| `award`, `academic` | `awards` (awarder parsed from the title) |
| `certificate` | `certificates` (issuer parsed from the title) |
| `project`, `sport`, `leadership` | `projects` with `type` set to the category |
Student `strengths → skills`, `languages → languages`, `interests → interests`; school/curriculum/grade → `education` with expected graduation year (British = Year 13, others Grade 12; UAE year rolls over in August).

### Templates
- **clean**: general CV, Helvetica, profile → education → experience → projects → awards → certificates → skills.
- **academic**: university applications, Times, education + honours first, research/projects, leadership & co-curriculars, volunteering.
- **internship**: objective + skills first, then experience, projects, volunteering, education.

### ATS + minor-safety rules
- Single column, real selectable text in reading order, standard section headings, no tables/images/icons/text boxes, contact details in the body (not a PDF header), PDF title/author metadata set. Tests run `pdftotext` (when poppler is installed) to confirm the text is extractable.
- Date of birth and nationality are **left out by default** (minors; ATS doesn't need them). `includePersonalDetails: true` stores them only in `meta.murshid.personal`.
- The portfolio hides email/phone unless `showContact: true`; only http(s)/mailto links are emitted and all text is HTML-escaped.

## Run
```bash
pnpm install --filter @murshid/documents...
cd packages/documents
pnpm test        # 19 tests; writes sample PDFs + portfolio HTML to ./out/ (git-ignored)
pnpm typecheck
```
Sample outputs after a test run: `out/cv-aisha-{clean,academic,internship}.pdf`, `out/checklist-aisha-summer.pdf`, `out/portfolio-aisha.html` (synthetic "Aisha Test" / "Rohan Test").

## Env vars (`.env.example`)
None required. Optional `DOCUMENTS_FONT_REGULAR/BOLD/ITALIC` (TTF/OTF paths) → `fontsFromEnv()` → pass as `renderCvPdf(r, t, { fonts })`.
Without them the 14 standard PDF fonts are used, which only cover Latin-1: Arabic/Devanagari characters are replaced with `?` (accents are stripped where possible) rather than producing broken glyphs. Ship Noto Sans + Noto Sans Arabic before supporting Arabic names on CVs.

## Library choice
`pdfkit` (one runtime dependency) instead of `@react-pdf/renderer` (pulls React + yoga layout, much heavier, and the server doesn't need JSX). `pdf-lib` is a dev-only dependency used by tests to parse the PDFs.

## AI-LATER
Marked `// AI-LATER` in code:
- `buildSummary()` – rule-based profile/objective line → student-voiced, tone-checked summary.
- `splitTitle()` / `toHighlights()` – regex parsing of titles/descriptions → better role/org extraction and action-verb bullet rewriting.
- `defaultChecklist()` – type-based items → items tailored from `eligibility_text`.
- Portfolio tagline.

## Integration notes
- `@murshid/core` didn't exist when this was written, so `src/types.ts` holds local copies of `Student`, `School`, `Achievement`, `Opportunity`, `Application`, `CvVersion` from `docs/CONTRACT.md`. Swap to core imports when it lands.
- apps/api: build `resume = toJsonResume(...)`, store it in `CvVersion.json`, upload `renderCvPdf(resume, template)` to storage and set `pdf_url`. The resume's `meta.murshid` holds `{ studentId, target, grade, generator }`.
- Checklist status/notes come from `Application`; deadlines are shown in Asia/Dubai time.
