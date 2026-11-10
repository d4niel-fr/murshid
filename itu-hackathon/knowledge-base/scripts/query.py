"""Query the ChromaDB collections built by ingest.py (ITU reference style).

    python scripts/query.py "breach notification children" [--collection kb_main] [-k 5]
"""
import argparse
import os
import shutil
import tempfile
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")
KB = Path(__file__).resolve().parent.parent

ap = argparse.ArgumentParser()
ap.add_argument("query")
ap.add_argument("--collection", default="kb_main", choices=["kb_main", "kb_usecase", "kb_framework"])
ap.add_argument("-k", type=int, default=5)
args = ap.parse_args()

import chromadb
from chromadb.config import Settings
from fastembed import TextEmbedding

# Chroma needs a writable directory; work on a temporary copy so the committed store stays untouched
tmp = Path(tempfile.mkdtemp()) / "vs"
shutil.copytree(KB / "vectorstore", tmp)
client = chromadb.PersistentClient(path=str(tmp), settings=Settings(anonymized_telemetry=False))
col = client.get_collection(args.collection)
q = next(iter(TextEmbedding("BAAI/bge-small-en-v1.5").query_embed([args.query]))).tolist()
res = col.query(query_embeddings=[q], n_results=args.k, include=["documents", "metadatas", "distances"])
for doc, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
    print(f"{1 - dist:.3f}  {meta.get('title')} | {meta.get('section', '')} | p.{meta.get('page_start', '')}  [{meta.get('chunk_id')}]")
    print(f"       {doc[:200]}\n")
