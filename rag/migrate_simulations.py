#!/usr/bin/env python3
"""Cache simulations per TOPIC (what the student searched), not one per section.

Before: simulations had UNIQUE(chunk_id), so every topic in a section got the first stored simulation.
After:  several simulations per chunk, each stored with the search it was made for and that search's embedding.
Legacy rows (no topic recorded) can never be matched to a topic, so they are removed and regenerate on demand.
"""
import psycopg
from common import env

with psycopg.connect(env("DATABASE_URL_UNPOOLED"), autocommit=True) as c:
    c.execute("ALTER TABLE simulations DROP CONSTRAINT IF EXISTS simulations_chunk_id_key")
    c.execute("ALTER TABLE simulations ADD COLUMN IF NOT EXISTS query text")
    c.execute("ALTER TABLE simulations ADD COLUMN IF NOT EXISTS topic_embedding vector(768)")
    c.execute("CREATE INDEX IF NOT EXISTS simulations_chunk_idx ON simulations (chunk_id)")
    c.execute("CREATE INDEX IF NOT EXISTS simulations_topic_idx ON simulations USING hnsw (topic_embedding vector_cosine_ops)")
    legacy = c.execute("SELECT count(*) FROM simulations WHERE topic_embedding IS NULL").fetchone()[0]
    c.execute("DELETE FROM simulations WHERE topic_embedding IS NULL")
    print(f"migrated; removed {legacy} legacy simulation(s) that had no topic recorded")
    print("remaining simulations:", c.execute("SELECT count(*) FROM simulations").fetchone()[0])
