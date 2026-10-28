# @murshid/grade-bands

Class-wise customisation for Murshid v1 web (contract: `docs/V1-WEB-CONTRACT.md`, rationale: `docs/grade-bands/BANDS.md`). Pure TS data + helpers, no runtime deps.

```ts
import { bandForGrade, BANDS, visibleWidgets, t, gateChat, opportunityDecision, demoStudents } from '@murshid/grade-bands';

const band = bandForGrade(7);                 // 'g7-8'
document.documentElement.dataset.band = band; // design tokens hook
BANDS[band].nav;                              // NavItem[] (lucide icon names, EN/AR labels)
visibleWidgets(band);                         // WidgetId[] in dashboard order
t(band, 'greeting.morning', 'ar', { name: 'عمر' });
gateChat(band, usedToday, 'plan-my-week');    // { ok, remaining } | { ok:false, reason, messageKey }
opportunityDecision(band, { kind: 'olympiad', scope: 'international' });
demoStudents['g11-12'];                       // id 'demo-g11'
```

| Module | Contents |
|---|---|
| `types.ts` | `BandId`, `BandConfig`, `WidgetId`, `FeatureId`, `AiPolicy`, `GuardianPolicy`, `ChartDefaults`, `Rewards`, `DemoStudent`… |
| `grades.ts` | `bandForGrade` (clamps <5 / >12, throws on non-integers), `curriculumMapping`, `gradeFromCurriculum`, `bandForCurriculum`, `classLabel` (British Year / IB PYP-MYP-DP / CBSE Class / American / MoE) |
| `bands/*.ts` | The four `BandConfig`s |
| `nav.ts` | `NAV_CATALOG` (hrefs/icons), `REQUIRED_COPY_KEYS`, `flattenCopy` |
| `policy.ts` | `BANDS`, `visibleNav`, `visibleWidgets`, `canAccessRoute`, `t`, `copyFor`, `greetingKey`, `aiAllows`, `gateChat`, `chatMessagesRemaining`, `opportunityDecision`, `guardianCanSee` |
| `demo.ts` | `demoStudents`, `demoStudentById` (synthetic) |

`copy` follows the contract's flat `Record<string,string>` with `en.<key>` / `ar.<key>` keys; use `t()` or `copyFor()`.

## Run
`pnpm --filter @murshid/grade-bands test` (after root install). Before install: `../notify/node_modules/.bin/vitest run` from this folder.
