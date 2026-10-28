# Knowledge base: UAE education policy for AI agents

22 public, official documents (UAE federal laws and Cabinet resolution, national AI strategy/charter/ethics, MoE AI curriculum framework, KHDA guidance, cybersecurity strategy, plus UNESCO, UNICEF, OECD, EU AI Act, US COPPA, UK Children's Code, ITU-T Y.3172 and the ITU AI Readiness report), 1,058 pages, about 330,000 words.
Full list with official URLs, retrieval dates, methods and SHA-256 hashes: [`MANIFEST.md`](MANIFEST.md) (machine-readable: `manifest.json`).

## Built with the ITU reference approach

Following https://github.com/CrashingGuru/ITUAIReadiness (`simulation/server/knowledge/ingest.py`, MIT):

1. **Parse**: PyMuPDF per page (HTML stripped for the eCFR page).
2. **Chunk**: paragraph-aware 256-word windows with 30-word overlap and a 2,000-character cap (the reference `config.py` values), keeping page ranges and the legal article/section headings each chunk covers.
3. **Embed**: `BAAI/bge-small-en-v1.5` (384-d) via fastembed on CPU. The reference uses Ollama `nomic-embed-text`; `--embedder ollama` restores that.
4. **Store**: ChromaDB with the reference collection names: `kb_main` (1,384 policy chunks), `kb_usecase` (Y.3172: 50, AI Readiness report: 86, Murshid use case: 2; 138 chunks), `kb_framework` (13 dimensions + 6 factors from the reference `dimensions.json`).

Each chunk carries: source id, title, issuer, jurisdiction, document type, topics, official URL, download URL, retrieval timestamp, file SHA-256, page range, section/article.

## Files

| Path | What |
|---|---|
| `sources.json` | the source registry (official URLs, fallbacks, notes) |
| `raw/` | downloaded originals + `download_log.json` (status, bytes, SHA-256, time). Not committed to git (73 MB); rebuild with the script |
| `chunks.jsonl` | every chunk with its metadata (the structured KB) |
| `embeddings.f16.npy` | vectors aligned with `chunks.jsonl` (used by the agents) |
| `vectorstore/` | the ChromaDB persistent store |
| `framework/dimensions.json` | ITU AI Readiness dimensions (copied from the reference repo, MIT) |
| `usecase/murshid-use-case.md` | the team's own use-case description (labelled as such) |

## Rebuild

```bash
pip install -r ../solution/requirements.txt
python scripts/download.py            # official URLs; see notes for blocked sites
python scripts/ingest.py              # parse, chunk, embed, store; writes manifest.json
python scripts/make_manifest_md.py
python scripts/query.py "verifiable parental consent for children under 13"
```

Sandboxes with short command limits can pre-fill the embedding cache in steps: `python scripts/ingest.py --warm 90` (repeat until "ALL CACHED").

## Retrieval caveats

- `uaelegislation.gov.ae` and `ai.gov.ae` block scripted clients. The three UAE legislation PDFs were saved through a remote browser from Internet Archive captures of the official download URLs; the four ai.gov.ae PDFs come from Internet Archive `id_` captures (original bytes) of the official URLs. The official URL is recorded for each.
- `web.khda.gov.ae` serves an incomplete TLS chain; files were fetched with verification off and hashed.
- The UAE Cyber Security Council link to the 2025-2031 cybersecurity strategy was unreachable; the KB holds TDRA's official 2019 strategy instead.
- The PDPL Executive Regulations, the Cabinet resolution under Decree-Law 26/2025 Art. 7(3) and KHDA's announced AI policy were not published at build time, so they are not in the KB. Their absence is one of the gaps the agents report.
