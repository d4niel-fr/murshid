"""Offline tests: no network, no model calls."""
import json
from pathlib import Path

import pytest

from murshid_policy.adviser import ask, gap_analysis, resolve
from murshid_policy.agents import AGENTS, offline_turn
from murshid_policy.audit import AuditLog, verify
from murshid_policy.kb import load
from murshid_policy.llm import LLM, extract_json
from murshid_policy.simulate import run

KB = load()


def test_kb_manifest_matches_chunks():
    st = KB.manifest["stats"]
    assert st["documents"] == len(KB.manifest["documents"]) >= 20
    assert len(KB.rows) == KB.vecs.shape[0] == sum(d["chunks"] for d in KB.manifest["documents"])
    for d in KB.manifest["documents"]:
        assert d["official_url"].startswith("https://") and len(d["sha256"]) == 64 and d["retrieved_at"]


@pytest.mark.parametrize("query,source,section", [
    ("notify the Bureau of a personal data breach", "uae-pdpl-2021", "(9)"),
    ("parental consent children under thirteen", "uae-child-digital-safety-2025", "(7)"),
    ("transfer personal data outside the State", "uae-pdpl-2021", "(22)"),
])
def test_retrieval_finds_the_right_article(query, source, section):
    hits = KB.search(query, k=3, sources=[source])
    assert any(section in (h.meta.get("section") or "") for h in hits)


def test_global_example_retrieval():
    hits = KB.search("serious incident reporting high-risk AI", k=3, sources=["eu-ai-act-2024"])
    assert any("Article 73" in h.text or "Article 73" in h.meta.get("section", "") for h in hits)


def test_audit_chain_detects_tampering(tmp_path: Path):
    log = AuditLog(tmp_path / "a.jsonl")
    log.write("x", "a", v=1)
    log.write("y", "b", v=2)
    assert verify(tmp_path / "a.jsonl")[0]
    lines = (tmp_path / "a.jsonl").read_text().splitlines()
    rec = json.loads(lines[0]); rec["v"] = 99
    (tmp_path / "a.jsonl").write_text(json.dumps(rec) + "\n" + lines[1] + "\n")
    ok, _, msg = verify(tmp_path / "a.jsonl")
    assert not ok and "modified" in msg


def test_offline_agent_cites_its_own_mandate():
    spec = AGENTS["data_office"]
    out = offline_turn(KB, spec, "breach of student data", ["breach"], {})
    cited = [c for a in out["actions"] for c in a["citations"]]
    assert cited and all(KB.get(c).meta["source_id"] in spec.sources for c in cited)


def test_gap_evidence_resolves_to_real_chunks():
    for g in json.loads((Path(__file__).parents[1] / "gaps.json").read_text()):
        for sid, pat in g["uae_evidence"] + g["global_examples"]:
            assert resolve(KB, sid, pat), f"{g['id']}: no chunk in {sid} matches {pat!r}"


def test_progressive_release_and_audit(tmp_path: Path):
    r = run("minor-data-leak", "offline", out_dir=tmp_path)
    assert r["audit_ok"] and r["llm_calls"] == 0
    recs = [json.loads(l) for l in (tmp_path / "audit.jsonl").read_text().splitlines()]
    stage_of = {rec["event"]: rec["stage"] for rec in recs if rec["kind"] == "event_release"}
    assert stage_of == {"E1": 1, "E2": 2, "E3": 3, "E4": 3, "E5": 4}
    # the Data Office must not act before any information reaches it
    first_do = min(rec["stage"] for rec in recs if rec["kind"] == "agent_turn" and rec["actor"] == "data_office")
    assert first_do == 2  # operator's message from stage 1 arrives at stage 2
    assert {"G1", "G9"} <= set(r["gaps"])


def test_extract_json_handles_fences_and_think_tags():
    assert extract_json('<think>x</think>```json\n{"a": 1}\n```') == {"a": 1}


def test_offline_llm_never_calls_network():
    llm = LLM("offline", 5)
    out, info = llm.chat_json("s", "u")
    assert out is None and llm.budget.calls == 0
    assert ask("breach notification", KB, llm)["engine"] == "rules"
