"""Build the Murshid UAE education-policy knowledge base.

Follows the ITU AI Readiness reference pipeline
(https://github.com/CrashingGuru/ITUAIReadiness, simulation/server/knowledge/ingest.py, MIT):

    parse (PyMuPDF; HTML stripped) -> chunk (word windows, overlap, paragraph-aware,
    hard char cap) -> embed -> store in ChromaDB collections with metadata

Collections (same names as the ITU reference):
    kb_main       policy, law and guidance chunks (UAE + global best practice)
    kb_framework  ITU AI Readiness Framework dimensions/factors (dimensions.json from the ITU repo)
    kb_usecase    ITU-T Y.3172 + AI Readiness report + the Murshid use-case description

Differences from the reference, and why:
  * Embeddings: local fastembed BAAI/bge-small-en-v1.5 (384-d, ONNX, CPU, zero cost) instead of
    Ollama nomic-embed-text, so the KB builds anywhere without a GPU or an Ollama server.
    `--embedder ollama` restores the reference behaviour when Ollama is available.
  * Richer source attribution metadata per chunk: source id, title, issuer, jurisdiction,
    doc type, official URL, retrieval date, SHA-256 of the file, page range, and the
    nearest legal article / section heading, so agents can cite "PDPL Art. 9, p.13".

Usage:
    python scripts/ingest.py            # rebuild everything (resets collections)
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import sys
import time
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

KB = Path(__file__).resolve().parent.parent
RAW = KB / "raw"
STORE = Path(__import__("os").environ.get("KB_STORE", str(KB / "vectorstore")))
CHUNK_WORDS = 256      # ITU reference config.chunk_size
OVERLAP_WORDS = 30     # ITU reference config.chunk_overlap
MAX_CHARS = 2000       # ITU reference hard cap
EMBED_MODEL = "BAAI/bge-small-en-v1.5"
CACHE = KB / ".embed_cache"
DEADLINE = float("inf")

ARTICLE_RE = re.compile(
    r"^\s*(Article\s*\(?\s*\d+[A-Za-z]?\s*\)?|ARTICLE\s+\d+|§\s*312\.\d+|Standard\s+\d+|"
    r"Principle\s+\d+|Requirement\s+\d+|\d+\.\d*\s+[A-Z][^\n]{3,80})",
    re.M,
)


LINE_HEAD_RE = re.compile(r"^\s*(Article\s*\(?\s*\d+[A-Za-z]?\s*\)?|§\s*312\.\d+)\s*$|^\s*(?:ANNEX\s+[IVX]+)\s*$")


# ---------------------------------------------------------------- parsing
def parse_pdf(path: Path) -> list[str]:
    import fitz  # PyMuPDF

    with fitz.open(path) as doc:
        return [p.get_text() for p in doc]


def parse_html(path: Path) -> list[str]:
    raw = path.read_text(encoding="utf-8", errors="replace")
    raw = re.sub(r"(?is)<(script|style).*?</\1>", " ", raw)
    raw = re.sub(r"(?i)<\s*(br|/p|/div|/h\d|/li)\s*>", "\n", raw)
    text = html.unescape(re.sub(r"<[^>]+>", " ", raw))
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n\n", text)
    # one pseudo-page per ~3000 chars so page refs stay meaningful
    return [text[i : i + 3000] for i in range(0, len(text), 3000)]


def clean(t: str) -> str:
    t = t.replace("\u00a0", " ").replace("\ufb01", "fi").replace("\ufb02", "fl")
    t = re.sub(r"(\w)-\n(\w)", r"\1\2", t)          # de-hyphenate line breaks
    t = re.sub(r"[ \t]+", " ", t)
    return t.strip()


# ---------------------------------------------------------------- chunking
def chunk_pages(pages: list[str]) -> list[dict]:
    """ITU-style word-window chunking, paragraph-aware, tracking pages + headings."""
    words: list[tuple[str, int]] = []   # (word, page_no)
    heading_at: dict[int, str] = {}     # word index -> heading seen there
    for pno, page in enumerate(pages, start=1):
        page = clean(page)
        for para in re.split(r"\n\s*\n", page):
            # line-level legal headings ("Article 73" on its own line, "§ 312.5 ...")
            for line in para.split("\n")[1:]:
                lm = LINE_HEAD_RE.match(line)
                if lm:
                    pos = len(words) + len(para[: para.find(line)].split())
                    heading_at[pos] = re.sub(r"\s+", " ", lm.group(1)).strip()[:90]
            m = ARTICLE_RE.match(para)
            if m and re.match(r"\s*\d", m.group(1)) and len(para) > 120:
                m = None   # numbered paragraph, not a heading
            if m:
                heading_at[len(words)] = re.sub(r"\s+", " ", m.group(1)).strip()[:90]
            for w in para.split():
                words.append((w, pno))
    chunks, start, current_heading = [], 0, ""
    head_idx = sorted(heading_at)
    while start < len(words):
        end = min(start + CHUNK_WORDS, len(words))
        piece = words[start:end]
        before = [heading_at[i] for i in head_idx if i <= start]
        inside = [heading_at[i] for i in head_idx if start < i < end]
        covered = ([before[-1]] if before else []) + inside
        current_heading = " | ".join(covered)[:200]
        text = " ".join(w for w, _ in piece)
        if len(piece) > 20 or not chunks:
            for k in range(0, len(text), MAX_CHARS):
                chunks.append({
                    "text": text[k : k + MAX_CHARS],
                    "page_start": piece[0][1],
                    "page_end": piece[-1][1],
                    "section": current_heading,
                })
        elif chunks:
            chunks[-1]["text"] += " " + text
        if end == len(words):
            break
        start = end - OVERLAP_WORDS
    return chunks


# ---------------------------------------------------------------- embedding
class Embedder:
    def __init__(self, kind: str = "fastembed"):
        self.kind = kind
        if kind == "fastembed":
            from fastembed import TextEmbedding

            self.model = TextEmbedding(EMBED_MODEL)
            self.name = EMBED_MODEL
        else:
            import ollama

            self.client = ollama.Client()
            self.name = "nomic-embed-text"

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed with an on-disk cache keyed by model + text hash (rebuilds are incremental)."""
        CACHE.mkdir(exist_ok=True)
        keys = [hashlib.sha256((self.name + "\x00" + t).encode()).hexdigest() for t in texts]
        out: dict[str, list[float]] = {}
        todo = []
        for k, t in zip(keys, texts):
            f = CACHE / f"{k[:2]}" / f"{k}.json"
            if f.exists():
                out[k] = json.loads(f.read_text())
            else:
                todo.append((k, t))
        if todo:
            if time.time() > DEADLINE:
                raise TimeoutError("embedding time budget used; re-run to continue")
            vecs = self._embed_raw([t for _, t in todo])
            for (k, _), v in zip(todo, vecs):
                f = CACHE / f"{k[:2]}" / f"{k}.json"
                f.parent.mkdir(exist_ok=True)
                f.write_text(json.dumps([round(x, 6) for x in v]))
                out[k] = v
        return [out[k] for k in keys]

    def _embed_raw(self, texts: list[str]) -> list[list[float]]:
        if self.kind == "fastembed":
            return [v.tolist() for v in self.model.embed(texts, batch_size=32)]
        return self.client.embed(model=self.name, input=texts)["embeddings"]

    def embed_query(self, q: str) -> list[float]:
        if self.kind == "fastembed":
            return next(iter(self.model.query_embed([q]))).tolist()
        return self.embed([q])[0]


def warm(kind: str, seconds: float) -> None:
    """Fill the embedding cache source by source within a time budget (for sandboxes with short command limits)."""
    global DEADLINE
    DEADLINE = time.time() + seconds
    sources = json.loads((KB / "sources.json").read_text())
    log = json.loads((RAW / "download_log.json").read_text())
    emb = Embedder(kind)
    for s in sources:
        e = log.get(s["id"])
        if not e or not e.get("ok"):
            continue
        path = RAW / e["file"]
        texts = [c["text"] for c in chunk_pages(parse_pdf(path) if path.suffix == ".pdf" else parse_html(path))]
        try:
            for i in range(0, len(texts), 64):
                emb.embed(texts[i : i + 64])
            print("cached", s["id"], len(texts), flush=True)
        except TimeoutError:
            print("time budget reached at", s["id"], "- run again", flush=True)
            sys.exit(3)
    print("ALL CACHED")


# ---------------------------------------------------------------- main
def main() -> None:
    import chromadb
    from chromadb.config import Settings

    ap = argparse.ArgumentParser()
    ap.add_argument("--embedder", default="fastembed", choices=["fastembed", "ollama"])
    ap.add_argument("--warm", type=float, default=0, help="only fill the embedding cache for N seconds, then exit")
    args = ap.parse_args()
    if args.warm:
        warm(args.embedder, args.warm)
        return

    sources = {s["id"]: s for s in json.loads((KB / "sources.json").read_text())}
    log = json.loads((RAW / "download_log.json").read_text())
    emb = Embedder(args.embedder)
    client = chromadb.PersistentClient(path=str(STORE), settings=Settings(anonymized_telemetry=False))
    for name in ("kb_main", "kb_framework", "kb_usecase"):
        try:
            client.delete_collection(name)
        except Exception:
            pass
    cols = {n: client.get_or_create_collection(n, metadata={"hnsw:space": "cosine"}) for n in ("kb_main", "kb_framework", "kb_usecase")}

    usecase_ids = {"itu-t-y3172", "itu-ai-ready-framework-2025"}
    all_rows, manifest = [], []
    for sid, s in sources.items():
        entry = log.get(sid)
        if not entry or not entry.get("ok"):
            print(f"SKIP {sid}: not downloaded")
            continue
        path = RAW / entry["file"]
        pages = parse_pdf(path) if path.suffix == ".pdf" else parse_html(path)
        chunks = chunk_pages(pages)
        col = "kb_usecase" if sid in usecase_ids else "kb_main"
        rows = []
        for i, c in enumerate(chunks):
            cid = f"{sid}#{i:04d}"
            meta = {
                "chunk_id": cid, "source_id": sid, "title": s["title"], "issuer": s["issuer"],
                "jurisdiction": s["jurisdiction"], "scope": s["scope"], "doc_type": s["doc_type"],
                "topics": ",".join(s.get("topics", [])), "source_url": s.get("landing") or s["url"],
                "download_url": entry["url"], "retrieved_at": entry["retrieved_at"], "sha256": entry["sha256"],
                "page_start": c["page_start"], "page_end": c["page_end"], "section": c["section"],
                "chunk_index": i, "total_chunks": len(chunks), "collection": col,
            }
            rows.append({"id": cid, "text": c["text"], "meta": meta})
        vecs = emb.embed([r["text"] for r in rows])
        cols[col].add(ids=[r["id"] for r in rows], documents=[r["text"] for r in rows],
                      embeddings=vecs, metadatas=[r["meta"] for r in rows])
        all_rows += rows
        manifest.append({
            "id": sid, "title": s["title"], "issuer": s["issuer"], "jurisdiction": s["jurisdiction"],
            "doc_type": s["doc_type"], "official_url": s.get("landing") or s["url"], "download_url": entry["url"],
            "retrieval_method": entry.get("used", "primary"), "retrieved_at": entry["retrieved_at"],
            "sha256": entry["sha256"], "bytes": entry["bytes"], "pages": len(pages), "chunks": len(chunks),
            "words": sum(len(p.split()) for p in pages), "collection": col,
            "notes": " ".join(filter(None, [s.get("note"), s.get("tls_note"),
                     (s.get("retrieval") or {}).get("note"), (s.get("fallback") or {}).get("note") if entry.get("used") == "fallback" else None])),
        })
        print(f"{sid:38s} pages={len(pages):4d} chunks={len(chunks):4d} -> {col}")

    # ITU framework definitions (dimensions.json vendored from the ITU repo, MIT)
    dims = json.loads((KB / "framework" / "dimensions.json").read_text())
    ftexts, fmeta, fids = [], [], []
    for d in dims["dimensions"]:
        metrics = "\n".join(f"- {m['name']}: {m['description']}" for m in d["metrics"])
        ftexts.append(f"Dimension {d['id']}: {d['name']}\n\n{d['description']}\n\nMapped Factors: {', '.join(d['mapped_factors'])}\n\nMetrics:\n{metrics}")
        fids.append(f"itu-dim-{d['id']:02d}")
        fmeta.append({"chunk_id": fids[-1], "source_id": "itu-ai-readiness-dimensions", "title": f"ITU AI Readiness dimension {d['id']}: {d['name']}",
                      "issuer": "ITU AI Readiness reference code (CrashingGuru/ITUAIReadiness)", "entity_type": "dimension",
                      "dimension_id": d["id"], "factors": ",".join(d["mapped_factors"]), "source_url": "https://github.com/CrashingGuru/ITUAIReadiness"})
    for f in dims["factors"]:
        ftexts.append(f"Factor: {f['name']}\n\n{f['description']}")
        fids.append(f"itu-factor-{f['id']}")
        fmeta.append({"chunk_id": fids[-1], "source_id": "itu-ai-readiness-dimensions", "title": f"ITU AI Readiness factor: {f['name']}",
                      "issuer": "ITU AI Readiness reference code (CrashingGuru/ITUAIReadiness)", "entity_type": "factor",
                      "source_url": "https://github.com/CrashingGuru/ITUAIReadiness"})
    cols["kb_framework"].add(ids=fids, documents=ftexts, embeddings=emb.embed(ftexts), metadatas=fmeta)

    # Murshid use-case description (our own document, so it is labelled as such)
    uc = (KB / "usecase" / "murshid-use-case.md").read_text()
    uc_chunks = chunk_pages([uc])
    ucids = [f"murshid-use-case#{i:04d}" for i in range(len(uc_chunks))]
    cols["kb_usecase"].add(ids=ucids, documents=[c["text"] for c in uc_chunks], embeddings=emb.embed([c["text"] for c in uc_chunks]),
                           metadatas=[{"chunk_id": ucids[i], "source_id": "murshid-use-case", "title": "Murshid use case (team document)",
                                       "issuer": "Team Murshid", "jurisdiction": "UAE", "doc_type": "use_case", "section": c["section"],
                                       "page_start": 1, "page_end": 1, "source_url": "itu-hackathon/knowledge-base/usecase/murshid-use-case.md"} for i, c in enumerate(uc_chunks)])

    # dense vectors aligned with chunks.jsonl (float16) so agents can search without a Chroma server
    import numpy as np
    np.save(KB / "embeddings.f16.npy", np.asarray(emb.embed([r["text"] for r in all_rows]), dtype=np.float16))
    with (KB / "chunks.jsonl").open("w") as fh:
        for r in all_rows:
            fh.write(json.dumps({"id": r["id"], "text": r["text"], **{k: v for k, v in r["meta"].items() if k != "chunk_id"}}, ensure_ascii=False) + "\n")
    stats = {
        "embedding_model": emb.name, "embedding_dim": len(emb.embed_query("test")),
        "chunk_words": CHUNK_WORDS, "overlap_words": OVERLAP_WORDS, "max_chars": MAX_CHARS,
        "documents": len(manifest), "chunks_kb_main": cols["kb_main"].count(),
        "chunks_kb_usecase": cols["kb_usecase"].count(), "chunks_kb_framework": cols["kb_framework"].count(),
        "total_pages": sum(m["pages"] for m in manifest), "total_words": sum(m["words"] for m in manifest),
        "chunks_sha256": hashlib.sha256((KB / "chunks.jsonl").read_bytes()).hexdigest(),
    }
    (KB / "manifest.json").write_text(json.dumps({"stats": stats, "documents": manifest}, indent=2, ensure_ascii=False))
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
