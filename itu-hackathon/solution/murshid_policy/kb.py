"""Hybrid retrieval over the Murshid policy knowledge base.

Dense: cosine similarity on the bge-small vectors produced by knowledge-base/scripts/ingest.py
(the same vectors stored in the ChromaDB collections; loaded here from embeddings.f16.npy so
agents run without a database server). Lexical: BM25 over the same chunks. Results are fused
with reciprocal-rank fusion and can be filtered to an agent's mandate (a list of source ids).
"""
from __future__ import annotations

import json
import math
import re
from collections import Counter
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

import numpy as np

KB_DIR = Path(__file__).resolve().parents[2] / "knowledge-base"
TOKEN = re.compile(r"[a-z0-9]+")
STOP = set(("the of and to a in for or be by is that with on as any this shall are an it its from at which such their his her not may other law decree article "
             "what do does did we us our you your has have had been was were will would should can could now got get past using use used how who why when where there "
             "about into than then them they he she i me my rules rule require required requires countries country uae murshid month week day").split())


def tokens(text: str) -> list[str]:
    return [t for t in TOKEN.findall(text.lower()) if t not in STOP and len(t) > 1]


@dataclass
class Hit:
    id: str
    text: str
    meta: dict
    score: float

    def cite(self) -> str:
        m = self.meta
        parts = [s for s in (m.get("section") or "").split(" | ") if s]
        sec = "" if not parts else (parts[0] if len(parts) == 1 else f"{parts[0]} to {parts[-1]}")
        pages = f"p.{m['page_start']}" if m.get("page_start") == m.get("page_end") else f"pp.{m.get('page_start')}-{m.get('page_end')}"
        return f"{m['title']}{', ' + sec if sec else ''}, {pages} [{self.id}]"

    def brief(self, n: int = 600) -> dict:
        return {"id": self.id, "source_id": self.meta["source_id"], "title": self.meta["title"],
                "section": self.meta.get("section", ""), "pages": [self.meta.get("page_start"), self.meta.get("page_end")],
                "url": self.meta.get("source_url"), "score": round(self.score, 4), "excerpt": self.text[:n]}


class KnowledgeBase:
    def __init__(self, kb_dir: Path = KB_DIR):
        self.dir = kb_dir
        self.rows = [json.loads(l) for l in (kb_dir / "chunks.jsonl").open()]
        self.vecs = np.load(kb_dir / "embeddings.f16.npy").astype(np.float32)
        self.vecs /= np.linalg.norm(self.vecs, axis=1, keepdims=True) + 1e-9
        self.by_id = {r["id"]: i for i, r in enumerate(self.rows)}
        self.manifest = json.loads((kb_dir / "manifest.json").read_text())
        # BM25 index
        self.toks = [tokens(r["text"] + " " + r.get("section", "") + " " + r["title"]) for r in self.rows]
        self.df = Counter(t for ts in self.toks for t in set(ts))
        self.avgdl = sum(map(len, self.toks)) / len(self.toks)
        self._embedder = None

    # -- embedding
    def _embed_query(self, q: str) -> np.ndarray:
        if self._embedder is None:
            from fastembed import TextEmbedding

            self._embedder = TextEmbedding(self.manifest["stats"]["embedding_model"])
        v = np.asarray(next(iter(self._embedder.query_embed([q]))), dtype=np.float32)
        return v / (np.linalg.norm(v) + 1e-9)

    def _bm25(self, q: str, idx: np.ndarray, k1=1.4, b=0.75) -> np.ndarray:
        qt = tokens(q)
        n = len(self.rows)
        out = np.zeros(len(idx), dtype=np.float32)
        for j, i in enumerate(idx):
            tf = Counter(self.toks[i])
            dl = len(self.toks[i])
            s = 0.0
            for t in qt:
                if t in tf:
                    idf = math.log(1 + (n - self.df[t] + 0.5) / (self.df[t] + 0.5))
                    s += idf * tf[t] * (k1 + 1) / (tf[t] + k1 * (1 - b + b * dl / self.avgdl))
            out[j] = s
        return out

    def search(self, query: str, k: int = 6, sources: list[str] | None = None, exclude: list[str] | None = None,
               per_source: int = 2) -> list[Hit]:
        idx = np.arange(len(self.rows))
        if sources:
            ss = set(sources)
            idx = np.array([i for i in idx if self.rows[i]["source_id"] in ss])
        if exclude:
            ex = set(exclude)
            idx = np.array([i for i in idx if self.rows[i]["source_id"] not in ex])
        if len(idx) == 0:
            return []
        dense = self.vecs[idx] @ self._embed_query(query)
        lex = self._bm25(query, idx)
        rd = {int(idx[j]): r for r, j in enumerate(np.argsort(-dense))}
        rl = {int(idx[j]): r for r, j in enumerate(np.argsort(-lex))}
        fused = {i: 1 / (60 + rd[i]) + 1 / (60 + rl[i]) for i in rd}
        hits, count = [], Counter()
        for i in sorted(fused, key=fused.get, reverse=True):
            r = self.rows[i]
            if count[r["source_id"]] >= per_source:
                continue
            count[r["source_id"]] += 1
            meta = {k2: v for k2, v in r.items() if k2 not in ("text",)}
            hits.append(Hit(r["id"], r["text"], meta, fused[i]))
            if len(hits) >= k:
                break
        return hits

    def get(self, chunk_id: str) -> Hit | None:
        i = self.by_id.get(chunk_id)
        if i is None:
            return None
        r = self.rows[i]
        return Hit(r["id"], r["text"], {k: v for k, v in r.items() if k != "text"}, 1.0)


@lru_cache(maxsize=1)
def load() -> KnowledgeBase:
    return KnowledgeBase()
