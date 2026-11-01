#!/usr/bin/env python3
"""Chunk OCR-converted textbook HTML into sub-topic chunks (3.1, 3.2, 5.1 ...).

Books with numbered sub-topic headings ("3.1 Heading") are split exactly on those.
Books without numbering fall back to heading-based chunks inside detected chapters.
Writes rag/chunks.jsonl (one chunk per line).
"""
import glob
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "OCR-Converted-HTML")
OUT = os.path.join(ROOT, "rag", "chunks.jsonl")

MAX_CHARS = 6500   # ~1.6k tokens, well under the 8192-token embedding limit
MIN_CHARS = 250    # drop fragments smaller than this
FALLBACK_MIN = 1400  # un-numbered books: don't start a new chunk before this much text

BLOCK_RE = re.compile(r"<(h[1-6]|header|footer|p|table|figure|ul|ol|li)\b([^>]*)>(.*?)</\1>", re.S | re.I)
SEC_RE = re.compile(r"^(\d{1,2})\.(\d{1,2})\.?\s+(?=[A-Za-z(\"'“])(.+)$", re.S)
CHAPTER_RE = re.compile(
    r"^(chapter|unit)\s+([0-9]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b|"
    r"^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth)\s+(chapter|unit)\b",
    re.I,
)
NOISE_HEAD = re.compile(
    r"^(example|exercise|activity|sample questions?|solution|group (work|activity)|do yourself|individual work|"
    r"multiple choice|creative questions?|at the end|by the end|work\b|answer|questions?\b|\d+\.\s|[a-z]\)|"
    r"contents|preface|national curriculum|learning outcomes?)",
    re.I,
)
FRONT_MATTER = re.compile(r"national curriculum and textbook board|all rights reserved|prescribed by|first edition", re.I)


def clean(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"</(td|th)>", " | ", s, flags=re.I)
    s = re.sub(r"</(tr|li)>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\s*\|\s*\n", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def book_name(path: str) -> str:
    n = os.path.basename(path)
    n = re.sub(r"\.html$", "", n)
    n = re.sub(r"_compressed(-\d+)?", "", n)
    n = re.sub(r"Secondary \(BV\)-2026_Class 9-10_", "", n)
    n = re.sub(r",?\s*com\b\.?\s*(pdf)?", "", n)
    n = re.sub(r"\s+", " ", n).strip(" ,.-_")
    return n


def parse_blocks(s: str):
    """Return ordered blocks: (kind, text, extra)."""
    blocks = []
    for m in BLOCK_RE.finditer(s):
        tag, attrs, inner = m.group(1).lower(), m.group(2), m.group(3)
        if tag == "footer":
            continue
        if tag == "figure":
            d = re.search(r'class="figure-description">(.*?)</p>', inner, re.S)
            o = re.search(r'class="figure-ocr-text">(.*?)</p>', inner, re.S)
            t = re.search(r'class="figure-type">(.*?)</p>', inner, re.S)
            fig = {
                "type": clean(t.group(1)).replace("Figure Type:", "").strip() if t else "",
                "description": clean(d.group(1)) if d else "",
                "ocr": clean(o.group(1)) if o else "",
            }
            if fig["description"] or fig["ocr"]:
                blocks.append(("figure", "", fig))
        elif tag.startswith("h") and tag != "header":
            txt = clean(inner)
            if txt and CHAPTER_RE.match(txt) and len(txt) < 80 and int(tag[1]) <= 2:
                blocks.append(("chapter", txt, {}))
            elif txt:
                blocks.append(("heading", txt, {"level": int(tag[1])}))
        elif tag == "header":
            txt = clean(inner)
            if CHAPTER_RE.match(txt) and len(txt) < 120:
                blocks.append(("chapter", txt, {}))
            # other headers are running page titles / page numbers: dropped
        elif tag == "li":
            # <li> that is not inside a matched ul/ol (those are consumed whole)
            txt = clean(inner)
            if txt:
                blocks.append(("para", "• " + txt, {}))
        else:
            txt = clean(inner)
            if tag in ("ul", "ol"):
                txt = "\n".join("• " + l for l in txt.split("\n") if l.strip())
            if txt:
                blocks.append(("para", txt, {}))
    return blocks


class Chunk:
    def __init__(self, section, title, chapter):
        self.section, self.title, self.chapter = section, title, chapter
        self.parts, self.figures = [], []

    def add(self, kind, text, extra):
        if kind == "figure":
            self.figures.append(extra)
            desc = extra["description"]
            ocr = f" Text in figure: {extra['ocr']}" if extra["ocr"] else ""
            self.parts.append(f"[Figure ({extra['type'] or 'figure'}): {desc}{ocr}]")
        else:
            self.parts.append(text)

    @property
    def body(self):
        return "\n".join(self.parts).strip()

    @property
    def prose_len(self):
        return sum(len(p) for p in self.parts if not p.startswith("[Figure"))


def chunk_book(blocks):
    numbered = sum(1 for k, t, e in blocks if k == "heading" and SEC_RE.match(t)) >= 8
    chunks, cur = [], None
    chapter = ""
    chap_pending = False
    chapter_norm = ""
    started = not numbered  # numbered books start at their first chapter/section heading

    def flush():
        nonlocal cur
        if cur and (cur.prose_len >= MIN_CHARS or (cur.figures and cur.prose_len >= 80)) and not FRONT_MATTER.search(cur.body[:600]):
            chunks.append(cur)
        cur = None

    for kind, text, extra in blocks:
        if kind == "chapter":
            norm = re.sub(r"[\s\d]+$", "", text).strip().lower()  # running headers repeat "Chapter 1. X 13"
            if norm == chapter_norm:
                continue
            flush()
            chapter, chapter_norm, chap_pending, started = re.sub(r"\s+\d+$", "", text), norm, not re.search(r"[.:\-–]\s*\S", text), True
            continue
        if kind == "heading":
            if chap_pending and not SEC_RE.match(text) and not NOISE_HEAD.match(text):
                chapter = f"{chapter}: {text}"
                chap_pending = False
                if cur and not numbered:
                    cur.title = chapter
                continue
            m = SEC_RE.match(text)
            if numbered and m:
                flush()
                chap_pending = False
                started = True
                cur = Chunk(f"{m.group(1)}.{m.group(2)}", m.group(3).strip(), chapter)
                continue
            if not numbered and extra["level"] <= 2 and not NOISE_HEAD.match(text) and len(text) >= 3 and len(text) < 110:
                if started and (cur is None or cur.prose_len >= FALLBACK_MIN):
                    flush()
                    cur = Chunk("", text, chapter)
                    continue
            if cur:
                cur.add("para", f"## {text}", {})
            continue
        if not started:
            continue
        if cur is None:
            cur = Chunk("", chapter or "Introduction", chapter)
        cur.add(kind, text, extra)
    flush()
    return chunks, numbered


def split_oversize(c: Chunk):
    body = c.body
    if len(body) <= MAX_CHARS * 1.3:
        return [(c, body)]
    parts, buf = [], ""
    for para in body.split("\n"):
        if len(buf) + len(para) > MAX_CHARS and buf:
            parts.append(buf)
            buf = ""
        buf += para + "\n"
    if buf.strip():
        parts.append(buf)
    return [(c, p.strip()) for p in parts]


WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
         "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"]
ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh",
       "twelfth", "thirteenth", "fourteenth", "fifteenth"]


def chapter_number(chapter: str) -> str:
    c = (chapter or "").lower()
    m = re.search(r"(?:chapter|unit)\s+(\d+)", c)
    if m:
        return m.group(1)
    for i, w in enumerate(WORDS):
        if re.match(rf"(chapter|unit)\s+{w}\b", c):
            return str(i)
    for i, w in enumerate(ORD):
        if i and re.match(rf"{w}\s+(chapter|unit)", c):
            return str(i)
    return "0"


def main():
    files = sorted(glob.glob(os.path.join(SRC, "*.html")))
    out, total = [], 0
    for f in files:
        s = open(f, encoding="utf-8", errors="replace").read()
        book = book_name(f)
        chunks, numbered = chunk_book(parse_blocks(s))
        seen = {}
        ord_in_chapter = {}
        n_book = 0
        for c in chunks:
            for i, (cc, body) in enumerate(split_oversize(c)):
                chap_key = cc.chapter or "-"
                if cc.section:
                    label = cc.section
                else:
                    ord_in_chapter[chap_key] = ord_in_chapter.get(chap_key, 0) + 1
                    label = f"{chapter_number(cc.chapter)}.{ord_in_chapter[chap_key]}"
                key = (label, i)
                part_label = label + (f" (part {i + 1})" if i else "")
                if key in seen:  # duplicate label (OCR glitch / repeated headings)
                    seen[key] += 1
                    part_label += f" #{seen[key]}"
                else:
                    seen[key] = 1
                out.append({
                    "book": book,
                    "chapter": cc.chapter,
                    "section": part_label,
                    "title": cc.title,
                    "text": body,
                    "figures": cc.figures if i == 0 else [],
                })
                n_book += 1
        total += n_book
        figs = sum(len(o["figures"]) for o in out if o["book"] == book)
        print(f"{book[:40]:40} {'numbered' if numbered else 'headings'} chunks={n_book:4} with_figs={figs}")
    with open(OUT, "w", encoding="utf-8") as fh:
        for o in out:
            fh.write(json.dumps(o, ensure_ascii=False) + "\n")
    print(f"TOTAL {total} chunks -> {OUT}")


if __name__ == "__main__":
    sys.exit(main())
