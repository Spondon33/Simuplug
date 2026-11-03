#!/usr/bin/env python3
"""Embed every chunk in rag/chunks.jsonl with EmbeddingGemma 2 and store it in Neon (pgvector)."""
import json
import os
import sys
import psycopg
import torch
from common import load_model, env, vec_literal, DIM

CHUNKS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chunks.jsonl")

SCHEMA = f"""
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS chunks (
  id serial PRIMARY KEY,
  book text NOT NULL,
  chapter text NOT NULL DEFAULT '',
  section text NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  figures jsonb NOT NULL DEFAULT '[]',
  embedding vector({DIM}) NOT NULL,
  UNIQUE (book, section)
);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
CREATE TABLE IF NOT EXISTS simulations (
  id serial PRIMARY KEY,
  chunk_id int NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,  -- several simulations per section, one per topic
  title text NOT NULL,
  openui_code text NOT NULL,
  embedding vector({DIM}) NOT NULL,        -- the section's vector
  query text,                              -- the search this simulation was made for
  topic_embedding vector({DIM}),           -- that search's vector (used to find the right stored simulation)
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS simulations_embedding_idx ON simulations USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS simulations_chunk_idx ON simulations (chunk_id);
CREATE INDEX IF NOT EXISTS simulations_topic_idx ON simulations USING hnsw (topic_embedding vector_cosine_ops);
"""


def main():
    rows = [json.loads(l) for l in open(CHUNKS, encoding="utf-8")]
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    if limit:
        rows = rows[:limit]
    url = env("DATABASE_URL_UNPOOLED")  # direct connection for bulk writes / DDL
    model = load_model()
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute(SCHEMA)
        done = {(b, s) for b, s in conn.execute("SELECT book, section FROM chunks")}
        todo = [r for r in rows if (r["book"], r["section"]) not in done]
        print(f"{len(rows)} chunks, {len(done)} already stored, embedding {len(todo)}", flush=True)
        B = 4
        for i in range(0, len(todo), B):
            batch = todo[i:i + B]
            texts = [f"{r['book']} — {r['section']} {r['title']}\n{r['text']}" for r in batch]
            embs = model.encode(texts, prompt_name="Document", normalize_embeddings=True, batch_size=B)
            with conn.transaction():
                for r, e in zip(batch, embs):
                    conn.execute(
                        "INSERT INTO chunks (book, chapter, section, title, content, figures, embedding) "
                        "VALUES (%s,%s,%s,%s,%s,%s,%s::vector) ON CONFLICT (book, section) DO NOTHING",
                        (r["book"], r["chapter"], r["section"], r["title"], r["text"], json.dumps(r["figures"]), vec_literal(e)),
                    )
            if torch.backends.mps.is_available():
                torch.mps.empty_cache()
            print(f"  {min(i + B, len(todo))}/{len(todo)}", flush=True)
        n = conn.execute("SELECT count(*) FROM chunks").fetchone()[0]
        print("chunks in Neon:", n)


if __name__ == "__main__":
    main()
