"""Render manifest.json as MANIFEST.md."""
import json
from pathlib import Path

KB = Path(__file__).resolve().parent.parent
m = json.loads((KB / "manifest.json").read_text())
s = m["stats"]
out = ["# Murshid UAE education-policy knowledge base: manifest", "",
       f"{s['documents']} official documents, {s['total_pages']} pages, {s['total_words']:,} words -> "
       f"{s['chunks_kb_main']} policy chunks (kb_main) + {s['chunks_kb_usecase']} use-case/standards chunks (kb_usecase) + "
       f"{s['chunks_kb_framework']} ITU AI Readiness framework entries (kb_framework).", "",
       f"Pipeline: ITU AI Readiness reference ingest (PyMuPDF parse -> {s['chunk_words']}-word chunks, {s['overlap_words']}-word overlap, "
       f"{s['max_chars']}-char cap -> embeddings ({s['embedding_model']}, {s['embedding_dim']}-d) -> ChromaDB). chunks.jsonl SHA-256 `{s['chunks_sha256'][:16]}...`.", "",
       "Retrieval method: `primary` = downloaded by script from the official URL; `fallback` = Internet Archive capture of the same official URL (original bytes) "
       "because the official site blocks automated clients; `browser` = saved through a remote browser from the official site (or its archive capture). "
       "Times are UTC.", "",
       "| # | Document | Issuer | Jurisdiction | Type | Pages | Chunks | Retrieved (UTC) | Method | Official source |",
       "|---|---|---|---|---|---|---|---|---|---|"]
for i, d in enumerate(m["documents"], 1):
    out.append(f"| {i} | {d['title']} | {d['issuer']} | {d['jurisdiction']} | {d['doc_type']} | {d['pages']} | {d['chunks']} | "
               f"{d['retrieved_at'][:16].replace('T', ' ')} | {d['retrieval_method']} | {d['official_url']} |")
out += ["", "## Notes per document", ""]
for d in m["documents"]:
    line = f"- **{d['id']}**: download URL `{d['download_url']}`; SHA-256 `{d['sha256'][:16]}...`; {d['bytes']:,} bytes."
    if d.get("notes"):
        line += " " + d["notes"]
    out.append(line)
(KB / "MANIFEST.md").write_text("\n".join(out) + "\n")
print("wrote MANIFEST.md")
