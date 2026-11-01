#!/usr/bin/env python3
"""Load the compacted OCR word positions (data/ocr) into Neon: tables `ocr_books` and `page_words`."""
import json
import os
import psycopg
from common import env

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, "data", "ocr")

SCHEMA = """
CREATE TABLE IF NOT EXISTS ocr_books (
  id text PRIMARY KEY,
  name text NOT NULL,          -- matches chunks.book
  stem text NOT NULL,
  pages int NOT NULL,
  aspects jsonb NOT NULL       -- per-page width/height, used to recognise an uploaded PDF
);
CREATE TABLE IF NOT EXISTS page_words (
  book_id text NOT NULL REFERENCES ocr_books(id) ON DELETE CASCADE,
  page int NOT NULL,
  words jsonb NOT NULL,        -- [[text, x0, y0, x1, y1], ...] as fractions of the page
  PRIMARY KEY (book_id, page)
);
"""

with psycopg.connect(env("DATABASE_URL_UNPOOLED"), autocommit=True) as conn:
    conn.execute(SCHEMA)
    index = json.load(open(os.path.join(DIR, "index.json"), encoding="utf-8"))
    for b in index:
        have = conn.execute("SELECT count(*) FROM page_words WHERE book_id=%s", (b["id"],)).fetchone()[0]
        if have == b["pages"]:
            print(f"{b['id']}: already loaded")
            continue
        pages = json.load(open(os.path.join(DIR, b["id"] + ".json"), encoding="utf-8"))["pages"]
        with conn.transaction():
            conn.execute("DELETE FROM page_words WHERE book_id=%s", (b["id"],))
            conn.execute(
                "INSERT INTO ocr_books (id,name,stem,pages,aspects) VALUES (%s,%s,%s,%s,%s) "
                "ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, stem=EXCLUDED.stem, pages=EXCLUDED.pages, aspects=EXCLUDED.aspects",
                (b["id"], b["name"], b["stem"], b["pages"], json.dumps(b["aspects"])),
            )
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO page_words (book_id, page, words) VALUES (%s,%s,%s)",
                    [(b["id"], i + 1, json.dumps(w, ensure_ascii=False, separators=(",", ":"))) for i, w in enumerate(pages)],
                )
        print(f"{b['id']}: loaded {len(pages)} pages", flush=True)
    r = conn.execute("SELECT count(*), pg_size_pretty(pg_total_relation_size('page_words')) FROM page_words").fetchone()
    print("page_words rows:", r[0], "size:", r[1])
