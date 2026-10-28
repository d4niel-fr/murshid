"""Tamper-evident audit log and reasoning traces.

Every agent action is one JSON line: who acted, on what information, which KB chunks were
retrieved (ids, scores), which ones the agent cited, the model and cost, the agent's stated
rationale (a short reasoning summary the agent is asked to write, not hidden model
internals), and its outputs. Each record carries the SHA-256 of the previous record, so any
edit to the log breaks the chain (`verify()` checks it).
"""
from __future__ import annotations

import hashlib
import json
import time
from datetime import datetime, timezone
from pathlib import Path


class AuditLog:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("")
        self.prev = "0" * 64
        self.seq = 0

    def write(self, kind: str, actor: str, **data) -> dict:
        self.seq += 1
        rec = {
            "seq": self.seq,
            "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
            "kind": kind,
            "actor": actor,
            **data,
            "prev_hash": self.prev,
        }
        body = json.dumps(rec, sort_keys=True, ensure_ascii=False)
        rec["hash"] = hashlib.sha256(body.encode()).hexdigest()
        self.prev = rec["hash"]
        with self.path.open("a") as fh:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")
        return rec


def verify(path: Path) -> tuple[bool, int, str]:
    prev = "0" * 64
    n = 0
    for line in path.read_text().splitlines():
        rec = json.loads(line)
        h = rec.pop("hash")
        if rec["prev_hash"] != prev:
            return False, n, f"chain broken at seq {rec['seq']}"
        if hashlib.sha256(json.dumps(rec, sort_keys=True, ensure_ascii=False).encode()).hexdigest() != h:
            return False, n, f"record {rec['seq']} was modified"
        prev = h
        n += 1
    return True, n, "ok"


class Timer:
    def __enter__(self):
        self.t = time.perf_counter()
        return self

    def __exit__(self, *a):
        self.ms = round((time.perf_counter() - self.t) * 1000)
