"""Download every source in sources.json from its official URL into raw/.

Records HTTP status, final URL, size, SHA-256 and retrieval timestamp in
raw/download_log.json. Only official / primary publishers are listed in
sources.json; a source with a `fallback` uses the fallback only if the
primary URL fails, and says so in the log.

Usage:  python scripts/download.py [--only ID ...]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

KB = Path(__file__).resolve().parent.parent
RAW = KB / "raw"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 MurshidKB/1.0"


def looks_ok(content: bytes, ext: str) -> bool:
    if ext == "pdf":
        return content[:5] == b"%PDF-" and len(content) > 10_000
    return len(content) > 2_000


def fetch(url: str, insecure: bool = False) -> httpx.Response:
    with httpx.Client(follow_redirects=True, timeout=120, verify=not insecure, headers={"User-Agent": UA, "Accept": "*/*"}) as c:
        return c.get(url)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*")
    args = ap.parse_args()
    sources = json.loads((KB / "sources.json").read_text())
    RAW.mkdir(parents=True, exist_ok=True)
    log_path = RAW / "download_log.json"
    log = json.loads(log_path.read_text()) if log_path.exists() else {}

    for s in sources:
        if args.only and s["id"] not in args.only:
            continue
        out = RAW / f"{s['id']}.{s['ext']}"
        if s.get("retrieval"):
            # obtained by the browser agent (site blocks scripted clients); just hash + log it
            f = RAW / s["retrieval"]["file"]
            if f.exists():
                b = f.read_bytes()
                log[s["id"]] = {"id": s["id"], "ok": True, "used": "browser", "url": s["retrieval"]["from"], "file": s["retrieval"]["file"],
                                "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest(),
                                "retrieved_at": log.get(s["id"], {}).get("retrieved_at") or datetime.fromtimestamp(f.stat().st_mtime, timezone.utc).isoformat(timespec="seconds")}
                print(f"OK  {s['id']:38s} {len(b)} (browser)")
                continue
        attempts = [("primary", s["url"])]
        if s.get("fallback"):
            attempts.append(("fallback", s["fallback"]["url"]))
        entry = {"id": s["id"], "ok": False, "attempts": []}
        for kind, url in attempts:
            try:
                r = fetch(url, s.get("insecure_tls", False))
                ok = r.status_code == 200 and looks_ok(r.content, s["ext"])
                entry["attempts"].append({"kind": kind, "url": url, "status": r.status_code, "bytes": len(r.content), "ok": ok})
                if ok:
                    out.write_bytes(r.content)
                    entry.update({
                        "ok": True,
                        "used": kind,
                        "url": url,
                        "final_url": str(r.url),
                        "file": out.name,
                        "bytes": len(r.content),
                        "sha256": hashlib.sha256(r.content).hexdigest(),
                        "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    })
                    break
            except Exception as e:  # network errors are logged, not fatal
                entry["attempts"].append({"kind": kind, "url": url, "error": repr(e)[:200]})
        log[s["id"]] = entry
        print(f"{'OK ' if entry['ok'] else 'ERR'} {s['id']:38s} {entry.get('bytes', '-')}", flush=True)

    log_path.write_text(json.dumps(log, indent=2))
    bad = [k for k, v in log.items() if not v["ok"]]
    if bad:
        print("FAILED:", ", ".join(bad), file=sys.stderr)


if __name__ == "__main__":
    main()
