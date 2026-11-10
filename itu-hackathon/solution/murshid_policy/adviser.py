"""Policy and legal adviser agent.

`ask()` answers a free-form question during a scenario from the whole KB (UAE first, then
global best practice), returning the answer with source attribution. `gap_analysis()` takes
the gaps that match the scenario, resolves each piece of evidence to a KB chunk (so every
claim points at a page of an official document), adds the coordinator's findings, and in LLM
mode asks a low-cost model for a short synthesis that may only use those chunk ids.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from .agents import ADVISER_SOURCES, GLOBAL
from .kb import KnowledgeBase
from .llm import LLM

ROOT = Path(__file__).resolve().parents[1]
UAE = [s for s in ADVISER_SOURCES if s not in GLOBAL]


def resolve(kb: KnowledgeBase, source_id: str, pattern: str) -> dict | None:
    rx = re.compile(pattern)
    for r in kb.rows:
        if r["source_id"] == source_id and rx.search(r["text"]):
            h = kb.get(r["id"])
            m = rx.search(r["text"])
            s = max(0, m.start() - 160)
            return {"id": h.id, "cite": h.cite(), "url": h.meta.get("source_url"), "quote": " ".join(r["text"][s: m.end() + 260].split())}
    return None


def gap_analysis(kb: KnowledgeBase, llm: LLM, tags: list[str], findings: list[dict], scenario: dict) -> dict:
    catalogue = json.loads((ROOT / "gaps.json").read_text())
    selected = []
    for g in catalogue:
        if set(g["tags"]) & set(tags):
            ue = [e for e in (resolve(kb, s, p) for s, p in g["uae_evidence"]) if e]
            ge = [e for e in (resolve(kb, s, p) for s, p in g["global_examples"]) if e]
            selected.append({**{k: g[k] for k in ("id", "type", "title", "finding", "global_note", "recommendation")},
                             "uae_evidence": ue, "global_examples": ge, "evidence_complete": len(ue) == len(g["uae_evidence"]) and len(ge) == len(g["global_examples"])})
    result = {"engine": "rules", "gaps": selected, "narrative": None}
    if llm.available and selected:
        ev = "\n".join(f"[{e['id']}] {e['quote'][:420]}" for g in selected for e in g["uae_evidence"] + g["global_examples"])
        gl = "\n".join(f"{g['id']}: {g['title']} - {g['finding'][:300]}" for g in selected)
        fl = "\n".join(f"- {f['type']}: {f['detail']}" for f in findings) or "- none"
        system = ("You are the policy and legal adviser in an ITU AI for Good policy simulation about Murshid, an AI education agent for UAE students. "
                  "Use only the evidence excerpts given; cite their ids in square brackets; do not invent law. Reply with ONE JSON object: "
                  '{"narrative": str (120-180 words: which gaps this scenario exposed, the most urgent fix, and the closest global example), '
                  '"priority_gaps": [gap ids, most urgent first], "new_gaps": [{"title": str, "why": str, "citations": [ids]}]}')
        user = f"SCENARIO: {scenario['title']}\n\nCOORDINATION FINDINGS:\n{fl}\n\nCANDIDATE GAPS:\n{gl}\n\nEVIDENCE:\n{ev}"
        out, info = llm.chat_json(system, user, max_tokens=2500)
        result["llm"] = info
        if out:
            allowed = {e["id"] for g in selected for e in g["uae_evidence"] + g["global_examples"]}
            result["engine"] = f"llm:{info['model']}"
            result["narrative"] = out.get("narrative")
            order = [x for x in out.get("priority_gaps", []) if any(g["id"] == x for g in selected)]
            if order:
                selected.sort(key=lambda g: order.index(g["id"]) if g["id"] in order else 99)
            result["new_gaps"] = [ng for ng in out.get("new_gaps", []) or [] if isinstance(ng, dict) and set(ng.get("citations", [])) <= allowed]
    return result


def ask(question: str, kb: KnowledgeBase, llm: LLM, k: int = 6) -> dict:
    uae = kb.search(question, k=k, sources=UAE, per_source=2)
    glob = kb.search(question, k=3, sources=GLOBAL, per_source=1)
    hits = uae + glob
    answer, info = None, None
    if llm.available:
        ex = "\n\n".join(f"[{h.id}] {h.meta['title']} | {h.meta.get('section','')} | p.{h.meta.get('page_start')}\n{h.text[:900]}" for h in hits)
        system = ("You are a policy and legal adviser on AI in UAE education. Answer from the excerpts only, UAE rules first, then the closest global practice; "
                  "cite excerpt ids in square brackets after each claim; say plainly when the excerpts do not answer the question. "
                  'Reply with ONE JSON object: {"answer": str, "citations": [ids], "gaps": [str]}')
        out, info = llm.chat_json(system, f"QUESTION: {question}\n\nEXCERPTS:\n{ex}", max_tokens=2500)
        if out:
            allowed = {h.id for h in hits}
            out["citations"] = [c for c in out.get("citations", []) if c in allowed]
            answer = out
    if answer is None:
        answer = {"answer": "Rules mode (no model): the most relevant passages are listed below, UAE first, then global practice.",
                  "citations": [h.id for h in hits], "gaps": []}
    return {"question": question, "engine": f"llm:{info['model']}" if info and info.get("ok") else "rules", **answer,
            "sources": [h.brief(400) for h in hits], "llm": info}
