# Simuplug (OpenUI Lang + RAG)

Search any topic from the class 9–10 textbooks in `OCR-Converted-HTML/`. The site returns a short summary and
interactive simulations built from the matching book sections.

## Built with Muse Spark Open

All text and simulation generation in Simuplug is done by **Muse Spark Open** (Meta's open-weights model, served by
Baseten as `meta-models/muse-spark-open-1026`). It is used for:

- the short, cited **summary** of the matched textbook section, and
- writing each **simulation** as OpenUI Lang (from the section's figure descriptions, or from its text when there is no figure).

Embeddings are separate and come from EmbeddingGemma 2 (see below).

## How it works

1. **Chunking** – `rag/chunk.py` splits each OCR book into sub-topic chunks (`3.1`, `3.2`, `5.1` …). Books without
   numbered headings fall back to heading-based chunks inside detected chapters. Figure descriptions stay in the chunk.
2. **Embedding** – `rag/embed.py` embeds every chunk with **EmbeddingGemma 2** (`google/embeddinggemma-2`, 768-d, run locally
   with sentence-transformers) and stores it in Neon Postgres (`chunks`, pgvector + HNSW).
3. **Search (RAG)** – the query is embedded with the same model (`rag/embed_server.py`) and the nearest chunks are
   fetched by cosine distance.
4. **Summary** – **Muse Spark Open** (Baseten) writes a short, cited summary from the best-matching chunk.
5. **Simulation** – if a simulation already exists for that chunk in the `simulations` table, its stored OpenUI Lang is
   rendered directly. Otherwise **Muse Spark Open** writes a new OpenUI Lang page (using the chunk's figure descriptions, or the chunk text
   plus outside knowledge when there is no figure), it is validated, rendered, and stored next to the chunk's vector.
   The interactive part is a `SimCanvas` component: a short script run in a sandboxed iframe.

## Run it

```bash
pnpm install
python3 -m venv rag/.venv && rag/.venv/bin/pip install sentence-transformers transformers "psycopg[binary]" fastapi uvicorn Pillow torchvision
npm run rag:chunk      # OCR HTML -> rag/chunks.jsonl
npm run rag:embed      # embed + store in Neon (resumable)
python3 rag/prep_ocr.py                      # OCR-Word-Positions -> data/ocr (one-time)
cd rag && .venv/bin/python load_ocr.py && cd ..   # load word positions into Neon (one-time)
npm run embed-server   # terminal 1: query embedding service on :8765
npm run dev            # terminal 2: the website (Turbopack dev server; the first visit to each page compiles it)
# For the fastest experience, run a production build instead:  npm run build && npm start
```

Environment (`.env` / `.env.local`): `BASETEN_API_KEY`, `BASETEN_MODEL`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`.
