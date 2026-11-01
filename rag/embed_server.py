#!/usr/bin/env python3
"""Tiny local server that embeds search queries with EmbeddingGemma 2 (same model/dim as the stored chunks)."""
from fastapi import FastAPI
from pydantic import BaseModel
from common import load_model

app = FastAPI()
model = load_model()


class Req(BaseModel):
    texts: list[str]
    kind: str = "query"  # "query" -> SearchQuery prompt, "document" -> Document prompt


@app.post("/embed")
def embed(r: Req):
    name = "SearchQuery" if r.kind == "query" else "Document"
    v = model.encode(r.texts, prompt_name=name, normalize_embeddings=True)
    return {"embeddings": v.tolist()}


@app.get("/health")
def health():
    return {"ok": True}
