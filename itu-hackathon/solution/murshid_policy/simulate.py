"""Multi-agent error-scenario simulation with progressive information release.

Coordinator (the ITU-T Y.3172 MLFO analogue) releases each scenario stage only to the agents
named in `visible_to`. Messages an agent sends are delivered at the NEXT stage (information
arrives late and unevenly), and a final debrief round lets agents act on their remaining
inbox. Every step is written to a hash-chained audit log; a Markdown transcript and a JSON
result are written next to it.
"""
from __future__ import annotations

import json
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from .adviser import gap_analysis
from .agents import AGENTS, llm_turn, offline_turn
from .audit import AuditLog, Timer, verify
from .kb import load
from .llm import LLM

ROOT = Path(__file__).resolve().parents[1]
REGULATORS = {"school_khda", "data_office", "moe", "child_safety"}


def load_scenario(sid: str) -> dict:
    return json.loads((ROOT / "scenarios" / f"{sid}.json").read_text())


def run(scenario_id: str, mode: str = "offline", max_calls: int = 12, out_dir: Path | None = None) -> dict:
    kb = load()
    sc = load_scenario(scenario_id)
    llm = LLM(mode, max_calls)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = out_dir or (ROOT / "outputs" / f"{scenario_id}-{llm.mode}-{stamp}")
    out.mkdir(parents=True, exist_ok=True)
    log = AuditLog(out / "audit.jsonl")
    log.write("run_start", "coordinator", scenario=sc["id"], title=sc["title"], mode=llm.mode, max_calls=max_calls,
              kb={"documents": kb.manifest["stats"]["documents"], "chunks": len(kb.rows), "chunks_sha256": kb.manifest["stats"]["chunks_sha256"]})

    inbox: dict[str, list[dict]] = defaultdict(list)
    handled: dict[str, set] = {}
    known: dict[str, dict[str, int]] = defaultdict(dict)     # agent -> tag -> stage first known
    tag_first: dict[str, int] = {}
    turns, lines = [], [f"# Simulation: {sc['title']}", "", f"Scenario `{sc['id']}` | mode `{llm.mode}` | run {stamp}", "", sc["setting"], ""]

    stages = sc["stages"] + [{"t": "Debrief", "events": [], "debrief": True}]
    for si, stage in enumerate(stages):
        lines += [f"## Stage {si + 1}: {stage['t']}", ""]
        receivers: dict[str, list[dict]] = defaultdict(list)
        for ev in stage["events"]:
            log.write("event_release", "coordinator", stage=si + 1, event=ev["id"], visible_to=ev["visible_to"], tags=ev["tags"], text=ev["text"])
            lines.append(f"**Event {ev['id']}** -> {', '.join(ev['visible_to'])}: {ev['text']}")
            for a in ev["visible_to"]:
                receivers[a].append(ev)
            for t in ev["tags"]:
                tag_first.setdefault(t, si + 1)
        for a, msgs in inbox.items():
            if msgs:
                receivers[a] += [{"id": f"MSG-{m['from']}", "text": f"Message from {AGENTS[m['from']].name} ({m['type']}): {m['content']}",
                                  "tags": m.get("tags", []), "message": True} for m in msgs]
        inbox = defaultdict(list)
        lines.append("")
        def compute(agent_id: str, items: list[dict]):
            spec = AGENTS[agent_id]
            tags = sorted({t for it in items for t in it["tags"]})
            text = "\n".join(f"- {it['text']}" for it in items)
            engine, info, result = "rules", None, None
            with Timer() as tm:
                if llm.available and llm.budget.max_calls - llm.budget.calls > 1 and not stage.get("debrief"):
                    result, info, hits = llm_turn(llm, kb, spec, text, tags)
                    if result is not None:
                        engine = f"llm:{info['model']}"
                        result["_hits"] = hits
                        handled.setdefault(agent_id, set()).update(t for t in tags if any(r.tag == t for r in spec.rules))
                if result is None:
                    result = offline_turn(kb, spec, text, tags, handled)
            return agent_id, items, tags, engine, info, result, tm.ms

        with ThreadPoolExecutor(max_workers=5) as pool:
            computed = list(pool.map(lambda kv: compute(*kv), list(receivers.items())))
        for agent_id, items, tags, engine, info, result, ms in computed:
            spec = AGENTS[agent_id]
            for t in tags:
                known[agent_id].setdefault(t, si + 1)
            hits = result.pop("_hits", [])
            cited = sorted({c for a in result.get("actions", []) for c in (a.get("citations") or [])})
            for m in result.get("messages", []):
                m.setdefault("tags", tags)
                inbox[m["to"]].append({"from": agent_id, **m})
            rec = log.write(
                "agent_turn", agent_id, stage=si + 1, engine=engine, inputs=[it["id"] for it in items], tags=tags,
                retrieved=[{"id": h.id, "score": round(h.score, 4)} for h in hits], cited=cited,
                rationale=result.get("rationale"), role=result.get("role"), actions=result.get("actions"),
                deadlines=result.get("deadlines"), uncertainties=result.get("uncertainties"),
                messages=[{"to": m["to"], "type": m.get("type"), "content": m.get("content")} for m in result.get("messages", [])],
                confidence=result.get("confidence"), llm=info, latency_ms=ms,
            )
            turns.append({"stage": si + 1, "agent": agent_id, "engine": engine, "tags": tags, "result": result, "hash": rec["hash"]})
            lines.append(f"### {spec.name} ({engine}; role: {result.get('role')})")
            lines.append(f"_Received:_ {', '.join(it['id'] for it in items)}  ")
            lines.append(f"_Reasoning summary:_ {result.get('rationale')}")
            for a in result.get("actions", []):
                cites = "; ".join(kb.get(c).cite() for c in a.get("citations", []) if kb.get(c)) or "no supporting citation"
                lines.append(f"- {a.get('action')}  \n  _Source:_ {cites} ({a.get('citation_check')})")
            for d in result.get("deadlines", []):
                lines.append(f"- Deadline: {d}")
            for u in result.get("uncertainties", []):
                lines.append(f"- Open question: {u}")
            for m in result.get("messages", []):
                lines.append(f"- -> {m['to']} ({m.get('type')}): {m.get('content')}")
            lines.append(f"_Audit record:_ `{rec['hash'][:16]}`")
            lines.append("")

    # ---- coordination diagnostics
    findings = []
    leads = defaultdict(set)
    for t in turns:
        for a in t["result"].get("actions", []):
            tag = a.get("rule_tag")
            role = a.get("role") or t["result"].get("role")
            if role == "lead" and t["agent"] in REGULATORS:
                for tg in ([tag] if tag else t["tags"]):
                    leads[tg].add(t["agent"])
    for tag, ags in leads.items():
        if len(ags) > 1:
            findings.append({"type": "overlapping_lead", "tag": tag, "agents": sorted(ags),
                             "detail": f"{' and '.join(AGENTS[x].name for x in sorted(ags))} {'both' if len(ags) == 2 else 'all'} acted as lead on '{tag}'; no rule in the KB says which one leads."})
    for tag, first in tag_first.items():
        mandated = [a for a in REGULATORS if any(r.tag == tag for r in AGENTS[a].rules)]
        for a in mandated:
            k = known[a].get(tag)
            if k is None:
                findings.append({"type": "never_informed", "tag": tag, "agent": a,
                                 "detail": f"{AGENTS[a].name} has a mandate over '{tag}' but never received that information."})
            elif k > first:
                findings.append({"type": "late_awareness", "tag": tag, "agent": a, "stages_late": k - first,
                                 "detail": f"{AGENTS[a].name} learned of '{tag}' {k - first} stage(s) after it first occurred."})
    for t in turns:
        for d in t["result"].get("deadlines", []):
            if "Executive Regulations" in d:
                findings.append({"type": "deadline_undefined", "agent": t["agent"], "detail": d})
    weak = [(t["agent"], a.get("action", "")[:60]) for t in turns for a in t["result"].get("actions", []) if not str(a.get("citation_check", "")).startswith(("supported", "not_needed"))]
    bad_deadlines = sum(t["result"].get("unsupported_deadlines", 0) for t in turns)
    if bad_deadlines:
        findings.append({"type": "unsupported_deadline", "count": bad_deadlines,
                         "detail": f"{bad_deadlines} deadline(s) stated by LLM agents use a number of hours/days found in none of the sources they were given (flagged in the transcript)."})
    log.write("coordination_findings", "coordinator", findings=findings, unsupported_or_weak_citations=len(weak))

    # ---- policy adviser: gap identification mapped to global examples
    scenario_tags = sorted(tag_first)
    gaps = gap_analysis(kb, llm, scenario_tags, findings, sc)
    log.write("gap_analysis", "policy_adviser", engine=gaps["engine"], llm=gaps.get("llm"),
              gaps=[{"id": g["id"], "title": g["title"], "uae_evidence": [e["id"] for e in g["uae_evidence"]],
                     "global_examples": [e["id"] for e in g["global_examples"]]} for g in gaps["gaps"]],
              narrative=gaps.get("narrative"))

    lines += ["## Coordination findings (detected by the coordinator)", ""]
    lines += [f"- **{f['type']}**: {f['detail']}" for f in findings] or ["- none"]
    lines += ["", f"Actions without a supporting citation: {len(weak)}", "", "## Policy and standards gaps (policy adviser)", ""]
    if gaps.get("narrative"):
        lines += [f"_Adviser summary ({gaps['engine']}):_ {gaps['narrative']}", ""]
    for g in gaps["gaps"]:
        lines.append(f"### {g['id']} {g['title']} ({g['type']})")
        lines.append(g["finding"])
        lines.append("UAE evidence: " + "; ".join(e["cite"] for e in g["uae_evidence"]))
        lines.append(f"Global example: {g['global_note']} (" + "; ".join(e["cite"] for e in g["global_examples"]) + ")")
        lines.append(f"Recommendation: {g['recommendation']}")
        lines.append("")
    ok, n, msg = verify(out / "audit.jsonl")
    log.write("run_end", "coordinator", llm_calls=llm.budget.calls, cost_usd=round(llm.budget.cost, 6),
              tokens_in=llm.budget.tokens_in, tokens_out=llm.budget.tokens_out, audit_chain_before_end=msg)
    ok, n, msg = verify(out / "audit.jsonl")
    lines += ["## Run summary", "", f"- LLM calls: {llm.budget.calls} (budget {max_calls}); cost USD {llm.budget.cost:.4f}",
              f"- Agent turns: {len(turns)} ({sum(1 for t in turns if t['engine'].startswith('llm'))} by LLM, {sum(1 for t in turns if t['engine'] == 'rules')} by rules)",
              f"- Audit log: {n} records, hash chain {msg}"]
    (out / "transcript.md").write_text("\n".join(lines))
    result = {"scenario": sc["id"], "mode": llm.mode, "out_dir": str(out), "turns": len(turns), "llm_calls": llm.budget.calls,
              "cost_usd": llm.budget.cost, "findings": findings, "gaps": [g["id"] for g in gaps["gaps"]], "audit_ok": ok, "audit_records": n}
    (out / "result.json").write_text(json.dumps(result, indent=2))
    return result
