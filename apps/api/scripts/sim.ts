/**
 * End-to-end simulation runner: drives the LIVE Murshid API (with real models when it was started with
 * GATEWAY_MODE=openrouter) through two scripted sessions and grades every turn.
 *
 *   Simulation A: the flagship "ideal student" (demo-ideal) in one multi-turn session.
 *   Simulation B: an admin edits the student's data through /admin/*, then the student asks Murshid about it.
 *
 * Every turn records: route + sub-agents, tools called (read / write / ui), latency, models tried and used,
 * whether the turn fell back to rules, and pass/fail checks. Output: docs/simulations/sim-report.{json,md}
 * plus the generated LinkedIn CV PDF (docs/simulations/ahamed-linkedin-cv.pdf).
 *
 * Usage:  pnpm sim                 (both)      SIM_ONLY=A|B  SIM_API=http://localhost:8787  SIM_PAUSE_MS=4000
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = process.env.SIM_API ?? 'http://localhost:8787';
const PAUSE = Number(process.env.SIM_PAUSE_MS ?? 4000);
const ONLY = process.env.SIM_ONLY?.toUpperCase();
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/simulations');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AgentRun { agent: string; name: string; model: string | null; modelsTried: { model: string; ok: boolean; status?: number; ms: number }[]; ms: number; fallback: boolean; error?: string; rounds: number; tools: { name: string; access: string; ok: boolean; prefetch: boolean; args: Record<string, unknown>; error?: string }[]; text: string }
interface ChatRes { text: string; toolCalls: { name: string; args: Record<string, unknown> }[]; route?: { agents: string[]; reason: string; router: string }; agents?: AgentRun[]; generatedBy: string; fallback?: boolean; safety?: string | null; ms?: number }
interface Check { name: string; pass: boolean; detail?: string; soft?: boolean }
interface TurnRecord {
  sim: 'A' | 'B'; turn: number; actor: string; message: string; route: string[]; router: string | null;
  agents: { name: string; model: string | null; ms: number; fallback: boolean; rounds: number; modelsTried: string[]; tools: string[]; error?: string }[];
  toolsCalled: string[]; writes: string[]; uiCards: string[]; latencyMs: number; firstAgentEventMs: number | null; generatedBy: string; fallback: boolean;
  modelsUsed: string[]; text: string; checks: Check[]; pass: boolean; httpStatus: number;
}
interface StepRecord { sim: 'B'; step: string; method: string; path: string; status: number; ok: boolean; id?: string }

async function http(method: string, path: string, opts: { as?: string; admin?: boolean; body?: unknown; accept?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.as) headers['x-dev-user'] = opts.as;
  if (opts.admin) { headers['x-dev-role'] = 'admin'; headers['x-dev-user-id'] = 'sim-admin'; }
  if (opts.accept) headers.accept = opts.accept;
  const res = await fetch(`${API}${path}`, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: AbortSignal.timeout(420_000) });
  return res;
}

const history: Record<string, { role: 'user' | 'assistant'; content: string }[]> = {};

async function chat(as: string, message: string): Promise<{ res: ChatRes | null; status: number; ms: number; firstAgentMs: number | null }> {
  const t0 = Date.now();
  const res = await http('POST', '/chat', { as, accept: 'text/event-stream', body: { message, history: (history[as] ?? []).slice(-6) } });
  if (!res.ok || !res.body) return { res: null, status: res.status, ms: Date.now() - t0, firstAgentMs: null };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let all = '';
  let firstAgentMs: number | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    all += dec.decode(value, { stream: true });
    if (firstAgentMs === null && all.includes('event: agent-start')) firstAgentMs = Date.now() - t0;
  }
  const doneFrame = [...all.matchAll(/event: done\ndata: (.*)\n/g)].pop();
  const parsed = doneFrame ? (JSON.parse(doneFrame[1]!) as ChatRes) : null;
  if (parsed) {
    (history[as] ??= []).push({ role: 'user', content: message }, { role: 'assistant', content: parsed.text.slice(0, 1200) });
  }
  return { res: parsed, status: res.status, ms: Date.now() - t0, firstAgentMs };
}

interface Expect {
  agents?: string[]; // all must run
  agentsAny?: string[]; // at least one must run
  tools?: string[]; // all must be called OK (incl. prefetch)
  toolsAny?: string[];
  writes?: string[]; // write tools that must succeed
  ui?: string[];
  text?: RegExp[]; // all must match
  textNot?: RegExp[];
  soft?: Partial<Pick<Expect, 'tools' | 'writes' | 'ui' | 'text'>>;
  verify?: (r: ChatRes) => Promise<Check[]>;
  safety?: 'crisis' | null;
}

function grade(r: ChatRes, e: Expect): Check[] {
  const ran = (r.agents ?? []).map((a) => a.agent);
  const okTools = (r.agents ?? []).flatMap((a) => a.tools.filter((t) => t.ok).map((t) => t.name));
  const writes = (r.agents ?? []).flatMap((a) => a.tools.filter((t) => t.ok && t.access === 'write').map((t) => t.name));
  const ui = r.toolCalls.map((t) => t.name);
  const checks: Check[] = [];
  const add = (name: string, pass: boolean, detail?: string, soft = false) => checks.push({ name, pass, ...(detail ? { detail } : {}), ...(soft ? { soft } : {}) });
  add('non-empty reply', r.text.trim().length > 20, `${r.text.length} chars`);
  add('clean text (no raw tool-call markup or tables)', !/<tool_call>|<function=|^\s*\|.*\|\s*$/m.test(r.text));
  add('every sub-agent answered (no empty section)', (r.agents ?? []).every((a) => a.text.trim().length > 10));
  if (e.agents) add(`agents ran: ${e.agents.join(', ')}`, e.agents.every((a) => ran.includes(a)), `ran: ${ran.join(', ')}`);
  if (e.agentsAny) add(`one of: ${e.agentsAny.join(' | ')}`, e.agentsAny.some((a) => ran.includes(a)), `ran: ${ran.join(', ')}`);
  if (e.tools) add(`tools used: ${e.tools.join(', ')}`, e.tools.every((t) => okTools.includes(t)), `ok tools: ${[...new Set(okTools)].join(', ')}`);
  if (e.toolsAny) add(`one of tools: ${e.toolsAny.join(' | ')}`, e.toolsAny.some((t) => okTools.includes(t)), `ok tools: ${[...new Set(okTools)].join(', ')}`);
  if (e.writes) add(`writes: ${e.writes.join(', ')}`, e.writes.every((t) => writes.includes(t)), `writes: ${writes.join(', ') || 'none'}`);
  if (e.ui) add(`UI cards: ${e.ui.join(', ')}`, e.ui.every((u) => ui.includes(u)), `cards: ${ui.join(', ') || 'none'}`);
  for (const re of e.text ?? []) add(`text matches ${re}`, re.test(r.text), undefined);
  for (const re of e.textNot ?? []) add(`text avoids ${re}`, !re.test(r.text));
  if (e.safety !== undefined) add(`safety=${e.safety}`, (r.safety ?? null) === e.safety);
  const s = e.soft ?? {};
  if (s.tools) add(`(soft) tools: ${s.tools.join(', ')}`, s.tools.every((t) => okTools.includes(t)), `ok tools: ${[...new Set(okTools)].join(', ')}`, true);
  if (s.writes) add(`(soft) writes: ${s.writes.join(', ')}`, s.writes.every((t) => writes.includes(t)), `writes: ${writes.join(', ') || 'none'}`, true);
  if (s.ui) add(`(soft) UI: ${s.ui.join(', ')}`, s.ui.every((u) => ui.includes(u)), `cards: ${ui.join(', ') || 'none'}`, true);
  for (const re of s.text ?? []) add(`(soft) text matches ${re}`, re.test(r.text), undefined, true);
  return checks;
}

const turns: TurnRecord[] = [];
const steps: StepRecord[] = [];

async function turn(sim: 'A' | 'B', as: string, message: string, e: Expect) {
  const n = turns.filter((t) => t.sim === sim).length + 1;
  process.stdout.write(`\n[${sim}${n}] ${as}: ${message}\n`);
  let out: Awaited<ReturnType<typeof chat>>;
  try {
    out = await chat(as, message);
  } catch (err) {
    out = { res: null, status: 0, ms: 0, firstAgentMs: null };
    process.stdout.write(`  ! request failed: ${(err as Error).message}\n`);
  }
  const r = out.res;
  const checks: Check[] = r ? grade(r, e) : [{ name: 'HTTP 200 with a done event', pass: false, detail: `status ${out.status}` }];
  if (r && e.verify) {
    try { checks.push(...(await e.verify(r))); } catch (err) { checks.push({ name: 'verify', pass: false, detail: (err as Error).message }); }
  }
  const agents = (r?.agents ?? []).map((a) => ({
    name: a.name, model: a.model, ms: a.ms, fallback: a.fallback, rounds: a.rounds, modelsTried: a.modelsTried.map((m) => `${m.model.split('/').pop()}${m.ok ? '' : `:${m.status ?? 'err'}`}`),
    tools: a.tools.map((t) => `${t.name}${t.prefetch ? '(prefetch)' : ''}${t.access === 'write' ? '[write]' : t.access === 'ui' ? '[ui]' : ''}${t.ok ? '' : '[failed]'}`), ...(a.error ? { error: a.error } : {}),
  }));
  const rec: TurnRecord = {
    sim, turn: n, actor: as, message, route: r?.route?.agents ?? [], router: r?.route?.router ?? null, agents,
    toolsCalled: [...new Set((r?.agents ?? []).flatMap((a) => a.tools.map((t) => t.name)))],
    writes: (r?.agents ?? []).flatMap((a) => a.tools.filter((t) => t.access === 'write' && t.ok).map((t) => t.name)),
    uiCards: (r?.toolCalls ?? []).map((t) => t.name), latencyMs: out.ms, firstAgentEventMs: out.firstAgentMs,
    generatedBy: r?.generatedBy ?? 'error', fallback: Boolean(r?.fallback),
    modelsUsed: [...new Set((r?.agents ?? []).map((a) => a.model).filter((m): m is string => Boolean(m)))],
    text: r?.text ?? '', checks, pass: checks.filter((c) => !c.soft).every((c) => c.pass), httpStatus: out.status,
  };
  turns.push(rec);
  process.stdout.write(`  → ${rec.pass ? 'PASS' : 'FAIL'} in ${(rec.latencyMs / 1000).toFixed(1)}s · agents: ${agents.map((a) => `${a.name}${a.fallback ? '(rules)' : ''}@${a.model?.split('/').pop() ?? '-'}`).join(', ')} · writes: ${rec.writes.join(', ') || '-'} · cards: ${rec.uiCards.join(', ') || '-'}\n`);
  for (const c of checks.filter((x) => !x.pass)) process.stdout.write(`    ✗ ${c.name}${c.detail ? ` (${c.detail})` : ''}\n`);
  process.stdout.write(`  "${rec.text.slice(0, 220).replace(/\s+/g, ' ')}${rec.text.length > 220 ? '…' : ''}"\n`);
  await sleep(PAUSE);
  return rec;
}

async function step(name: string, method: string, path: string, body?: unknown): Promise<any> {
  const res = await http(method, path, { admin: true, body });
  const json = await res.json().catch(() => null);
  steps.push({ sim: 'B', step: name, method, path, status: res.status, ok: res.ok, ...(json?.id ? { id: json.id } : {}) });
  process.stdout.write(`[B admin] ${name}: ${method} ${path} → ${res.status}\n`);
  if (!res.ok) throw new Error(`${name} failed: ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// ---------- Simulation A: the ideal student ----------
async function simulationA() {
  const S = 'demo-ideal';
  await turn('A', S, 'How am I doing in football and swimming lately, and how are my grades looking?', {
    agents: ['sports', 'academics'], tools: ['get_training', 'get_academics'], text: [/\d/],
    soft: { text: [/swim|freestyle|100m/i, /football|match|yo-?yo|sprint/i] },
  });
  await turn('A', S, 'Plan my week around my exams and both sports. Keep some time for Tideline but grades come first.', {
    agents: ['planner'], agentsAny: ['academics', 'sports'], writes: ['build_week_plan'], ui: ['show_plan'],
    verify: async () => {
      const t = await (await http('GET', '/student/tasks?scope=week', { as: S })).json();
      const mine = t.items.filter((x: any) => x.source === 'murshid');
      const audit = await (await http('GET', `/admin/audit?studentId=${S}&limit=20`, { admin: true })).json();
      return [
        { name: 'plan items visible in the student API', pass: mine.length >= 3, detail: `${mine.length} Murshid tasks this week` },
        { name: 'plan visible to admin (audit, actor murshid)', pass: audit.items.some((e: any) => e.actorRole === 'agent' && e.resource === 'plan') },
      ];
    },
  });
  await turn('A', S, 'Find me opportunities that fit my business and my sports, and save the best one to my applications.', {
    agents: ['opportunities'], tools: ['find_opportunities'], text: [/\(Demo\)|Pitch|Founders|Showcase|Coaching|Summer/i],
    soft: { writes: ['save_opportunity'] },
  });
  await turn('A', S, 'How can I grow Tideline over the next month without hurting my grades or training?', {
    agents: ['business'], tools: ['get_side_projects'], text: [/AED|customer|order|revenue/i],
  });
  await turn('A', S, 'Generate my LinkedIn CV, with my business and my sports leadership.', {
    agents: ['career'], writes: ['generate_linkedin_cv'], ui: ['show_cv'],
    verify: async () => {
      const res = await http('GET', '/student/cv/linkedin.pdf', { as: S });
      const buf = Buffer.from(await res.arrayBuffer());
      mkdirSync(OUT, { recursive: true });
      if (res.ok) writeFileSync(resolve(OUT, 'ahamed-linkedin-cv.pdf'), buf);
      const pack = await (await http('GET', '/student/cv/linkedin', { as: S })).json();
      writeFileSync(resolve(OUT, 'ahamed-linkedin-pack.json'), JSON.stringify(pack, null, 2));
      return [
        { name: 'CV PDF downloads (application/pdf, %PDF)', pass: res.ok && buf.subarray(0, 4).toString() === '%PDF', detail: `${buf.length} bytes` },
        { name: 'LinkedIn pack: headline ≤ 220, About mentions Tideline, 3+ experience entries', pass: pack.headline.length <= 220 && /Tideline/.test(pack.about) && pack.experience.length >= 3, detail: `generatedBy=${pack.generatedBy}` },
      ];
    },
  });
  await turn('A', S, "Honestly I'm really stressed. I can't sleep before the mocks and the gala, and I feel like I'm letting everyone down.", {
    agentsAny: ['wellbeing'], tools: ['get_wellbeing_signals'],
    text: [/counsel|parent|trusted|talk to|800/i], textNot: [/\b\d+\s?mg\b|melatonin|sleeping pill|diagnos/i],
    verify: async (r) => [{ name: 'wellbeing answered first', pass: r.route?.agents[0] === 'wellbeing', detail: r.route?.agents.join(', ') }],
  });
  await turn('A', S, 'Add a task to email my swim coach about the gala tomorrow at 5pm.', {
    toolsAny: ['create_task'], writes: ['create_task'],
    verify: async () => {
      const t = await (await http('GET', '/student/tasks?scope=week', { as: S })).json();
      const hit = t.items.find((x: any) => x.source === 'murshid' && /coach|gala/i.test(x.title));
      return [{ name: 'task saved for tomorrow 17:00', pass: Boolean(hit && hit.time === '17:00'), detail: hit ? `${hit.title} ${hit.date} ${hit.time}` : 'not found' }];
    },
  });
}

// ---------- Simulation B: admin + student ----------
async function simulationB() {
  const S = 'demo-g11';
  const today = (await (await http('GET', '/dashboard', { as: S })).json()).date as string;
  const plus = (d: number) => new Date(Date.parse(`${today}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);
  await step('admin adds an assessment', 'POST', `/admin/students/${S}/assessments`, { subjectId: 'physics', title: 'Physics practical: projectile motion', kind: 'test', date: plus(3), maxScore: 40 });
  await step('admin adds a task', 'POST', `/admin/students/${S}/tasks`, { title: 'Submit FTC engineering notebook to Mr. Sample', date: plus(1), time: '15:30', kind: 'assignment', notes: 'Set by the robotics coach' });
  await step('admin publishes an opportunity to this student', 'POST', '/admin/opportunities', { title: 'Dubai Future Engineers Challenge (Demo)', organizer: 'Example Engineering Council', type: 'competition', emirate: 'dubai', deadline: plus(16), minGrade: 10, maxGrade: 12, costAed: 0, tags: ['engineering', 'robotics'], why: 'Build a working prototype with your FTC skills.', audience: { studentIds: [S] } });
  const detail = await (await http('GET', `/admin/students/${S}`, { admin: true })).json();
  steps.push({ sim: 'B', step: 'admin detail shows the 3 edits in the change log', method: 'GET', path: `/admin/students/${S}`, status: 200, ok: detail.audit.length >= 3 });

  await turn('B', S, 'Do I have any new exams or tests coming up this week?', {
    agents: ['academics'], text: [/projectile|practical/i], tools: ['get_academics'],
  });
  await turn('B', S, 'What tasks and deadlines do I have this week? Anything my teachers set?', {
    agentsAny: ['planner', 'academics', 'general'], text: [/notebook|FTC/i],
  });
  await turn('B', S, 'Has my school shared any new competitions or opportunities with me?', {
    agents: ['opportunities'], tools: ['find_opportunities'], text: [/Future Engineers/i],
  });
}

function markdown(health: any, started: string) {
  const byS = (s: 'A' | 'B') => turns.filter((t) => t.sim === s);
  const rate = (xs: TurnRecord[]) => `${xs.filter((t) => t.pass).length}/${xs.length}`;
  const lines: string[] = [];
  lines.push('# Murshid end-to-end simulations', '');
  lines.push(`Run: ${started} · API: ${API} · chat engine: ${health?.chat?.mode ?? '?'} (${(health?.chat?.models ?? []).join(' > ') || 'no models'})`, '');
  lines.push('All students are synthetic. Turns are graded against hard checks; "(soft)" checks are reported but do not fail a turn.', '');
  lines.push('| Simulation | Turns passed | Fallback turns | Avg latency | Models used |', '|---|---|---|---|---|');
  for (const s of ['A', 'B'] as const) {
    const xs = byS(s);
    if (!xs.length) continue;
    lines.push(`| ${s === 'A' ? 'A: ideal student (demo-ideal)' : 'B: admin + student (demo-g11)'} | ${rate(xs)} | ${xs.filter((t) => t.fallback).length} | ${(xs.reduce((a, t) => a + t.latencyMs, 0) / xs.length / 1000).toFixed(1)}s | ${[...new Set(xs.flatMap((t) => t.modelsUsed.map((m) => m.split('/').pop())))].join(', ') || 'rules'} |`);
  }
  if (steps.length) {
    lines.push('', '## Simulation B: admin steps', '', '| Step | Request | Status |', '|---|---|---|');
    for (const st of steps) lines.push(`| ${st.step} | \`${st.method} ${st.path}\` | ${st.status} ${st.ok ? '✓' : '✗'} |`);
  }
  for (const s of ['A', 'B'] as const) {
    const xs = byS(s);
    if (!xs.length) continue;
    lines.push('', `## Simulation ${s} turns`, '');
    for (const t of xs) {
      lines.push(`### ${s}${t.turn} ${t.pass ? '✅ PASS' : '❌ FAIL'} · ${(t.latencyMs / 1000).toFixed(1)}s${t.fallback ? ' · fell back to rules' : ''}`, '');
      lines.push(`**${t.actor}:** ${t.message}`, '');
      lines.push(`- Route (${t.router}): ${t.route.join(' + ') || '-'}`);
      for (const a of t.agents) lines.push(`- **${a.name}** · ${a.model ?? 'rules'} · ${(a.ms / 1000).toFixed(1)}s · rounds ${a.rounds}${a.fallback ? ' · FALLBACK' : ''}${a.modelsTried.length ? ` · tried: ${a.modelsTried.join(' → ')}` : ''}${a.error ? ` · error: ${a.error.slice(0, 120)}` : ''}\n  - tools: ${a.tools.join(', ') || 'none'}`);
      lines.push(`- UI cards: ${t.uiCards.join(', ') || 'none'} · writes: ${t.writes.join(', ') || 'none'} · first agent event after ${t.firstAgentEventMs ?? '-'} ms`);
      lines.push('- Checks:');
      for (const c of t.checks) lines.push(`  - ${c.pass ? '✓' : c.soft ? '○' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
      lines.push('', '> ' + t.text.replace(/\n+/g, '\n> '), '');
    }
  }
  return lines.join('\n');
}

async function main() {
  const started = new Date().toISOString();
  const health = await (await fetch(`${API}/health`)).json().catch(() => null);
  if (!health?.ok) throw new Error(`API not reachable at ${API}`);
  process.stdout.write(`Murshid simulation · API ${API} · chat: ${JSON.stringify(health.chat)}\n`);
  if (!ONLY || ONLY === 'A') await simulationA();
  if (!ONLY || ONLY === 'B') await simulationB();
  mkdirSync(OUT, { recursive: true });
  const suffix = process.env.SIM_TAG ? `-${process.env.SIM_TAG}` : ONLY ? `-${ONLY.toLowerCase()}` : '';
  const summary = (['A', 'B'] as const).map((s) => { const xs = turns.filter((t) => t.sim === s); return { sim: s, turns: xs.length, passed: xs.filter((t) => t.pass).length, fallbackTurns: xs.filter((t) => t.fallback).length, avgLatencyMs: xs.length ? Math.round(xs.reduce((a, t) => a + t.latencyMs, 0) / xs.length) : 0 }; }).filter((x) => x.turns);
  writeFileSync(resolve(OUT, `sim-report${suffix}.json`), JSON.stringify({ startedAt: started, finishedAt: new Date().toISOString(), api: API, health, summary, adminSteps: steps, turns }, null, 2));
  writeFileSync(resolve(OUT, `sim-report${suffix}.md`), markdown(health, started));
  process.stdout.write(`\n${summary.map((s) => `Simulation ${s.sim}: ${s.passed}/${s.turns} passed (${s.fallbackTurns} fallback)`).join('\n')}\nReport: ${resolve(OUT, `sim-report${suffix}.md`)}\n`);
  if (turns.some((t) => !t.pass)) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(2); });
