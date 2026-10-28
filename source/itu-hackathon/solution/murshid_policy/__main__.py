"""CLI: python -m murshid_policy <command>

  list                                   scenarios and agents
  simulate <scenario|all> [--mode offline|openrouter] [--max-calls N]
  ask "question" [--mode offline|openrouter]
  search "query" [--source ID ...]
  verify <path/to/audit.jsonl>
"""
from __future__ import annotations

import argparse
import json
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")


def main() -> None:
    ap = argparse.ArgumentParser(prog="murshid_policy")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("list")
    s = sub.add_parser("simulate"); s.add_argument("scenario"); s.add_argument("--mode", default="offline"); s.add_argument("--max-calls", type=int, default=12)
    a = sub.add_parser("ask"); a.add_argument("question"); a.add_argument("--mode", default="offline"); a.add_argument("--out")
    q = sub.add_parser("search"); q.add_argument("query"); q.add_argument("--source", nargs="*"); q.add_argument("-k", type=int, default=5)
    v = sub.add_parser("verify"); v.add_argument("path")
    args = ap.parse_args()

    from .agents import AGENTS
    from .simulate import ROOT, run

    if args.cmd == "list":
        for f in sorted((ROOT / "scenarios").glob("*.json")):
            sc = json.loads(f.read_text())
            print(f"scenario {sc['id']:22s} {sc['title']} ({len(sc['stages'])} stages)")
        for a_ in AGENTS.values():
            print(f"agent    {a_.id:22s} {a_.institution[:90]}")
    elif args.cmd == "simulate":
        ids = [f.stem for f in sorted((ROOT / "scenarios").glob("*.json"))] if args.scenario == "all" else [args.scenario]
        for sid in ids:
            r = run(sid, args.mode, args.max_calls)
            print(json.dumps({k: r[k] for k in ("scenario", "mode", "turns", "llm_calls", "cost_usd", "gaps", "audit_ok", "out_dir")}))
    elif args.cmd == "ask":
        from .adviser import ask
        from .kb import load
        from .llm import LLM
        res = ask(args.question, load(), LLM(args.mode, 2))
        txt = json.dumps(res, indent=2, ensure_ascii=False)
        if args.out:
            Path(args.out).write_text(txt)
        print(txt)
    elif args.cmd == "search":
        from .kb import load
        for h in load().search(args.query, k=args.k, sources=args.source):
            print(f"{h.score:.4f}  {h.cite()}\n        {h.text[:240]}\n")
    elif args.cmd == "verify":
        from .audit import verify
        print(verify(Path(args.path)))


if __name__ == "__main__":
    main()
