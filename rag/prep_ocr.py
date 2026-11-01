#!/usr/bin/env python3
"""Compact OCR-Word-Positions/*.words.json into data/ocr/<id>.json (+ index.json) for the PDF reader."""
import glob
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from chunk import book_name  # same naming as the chunks table, so book filters line up

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "OCR-Word-Positions")
OUT = os.path.join(ROOT, "data", "ocr")
os.makedirs(OUT, exist_ok=True)

index = []
for f in sorted(glob.glob(os.path.join(SRC, "*.words.json"))):
    d = json.load(open(f, encoding="utf-8"))
    stem = os.path.basename(f)[: -len(".words.json")]
    bid = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    pages = []
    for p in d["pages"]:
        pages.append([[w["text"], round(w["x0"], 4), round(w["y0"], 4), round(w["x1"], 4), round(w["y1"], 4)] for w in p["words"] if w["text"].strip()])
    json.dump({"pages": pages}, open(os.path.join(OUT, bid + ".json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    index.append({
        "id": bid,
        "name": book_name(stem + ".html"),
        "stem": stem,
        "pages": len(pages),
        "aspects": [round(q["width"] / q["height"], 3) for q in d["pages"]],  # per page: used to verify an upload
    })
    print(f"{bid[:50]:50} pages={len(pages)} name={index[-1]['name']}")
json.dump(index, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
print("wrote", len(index), "books")
