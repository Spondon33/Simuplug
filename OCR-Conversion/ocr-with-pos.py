import os
import json
import sys
import time
from pathlib import Path

import requests

# ---------- CONFIGURATION ----------

API_KEY = os.environ["UPSTAGE_API_KEY"]

INPUT_FOLDER = Path("/Users/nurulaminkh/Desktop/Books-To-Train")
OUTPUT_FOLDER = Path("/Users/nurulaminkh/Desktop/OCR-Word-Positions")
RAW_FOLDER = OUTPUT_FOLDER / "raw"          # untouched API responses, for debugging

BASE_URL = "https://api.upstage.ai/v1"
POLL_INTERVAL = 5

HEADERS = {"Authorization": f"Bearer {API_KEY}"}

OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)
RAW_FOLDER.mkdir(parents=True, exist_ok=True)


# ---------- SUBMIT PDF ----------

def submit_pdf(pdf_path):
    with open(pdf_path, "rb") as file:
        response = requests.post(
            f"{BASE_URL}/document-digitization/async",
            headers=HEADERS,
            files={"document": (pdf_path.name, file, "application/pdf")},
            data={"model": "ocr"},   # OCR model = words + bounding boxes
            timeout=120,
        )
    response.raise_for_status()
    return response.json()["request_id"]


# ---------- WAIT FOR COMPLETION ----------

def wait_for_completion(request_id):
    url = f"{BASE_URL}/document-digitization/requests/{request_id}"

    while True:
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()

        result = response.json()
        status = result["status"]
        print(f"  Status: {status}")

        if status == "completed":
            return result
        if status in ("failed", "cancelled"):
            raise RuntimeError(f"OCR failed: {json.dumps(result)}")

        time.sleep(POLL_INTERVAL)


# ---------- DOWNLOAD BATCH RESULTS ----------

def fetch_batch(request_id, batch):
    """Download one batch; refresh the signed URL if it has expired."""
    response = requests.get(batch["download_url"], timeout=120)

    if response.status_code in (401, 403):
        fresh = requests.get(
            f"{BASE_URL}/document-digitization/requests/{request_id}",
            headers=HEADERS,
            timeout=30,
        )
        fresh.raise_for_status()
        fresh_batches = {str(b["id"]): b for b in fresh.json()["batches"]}
        response = requests.get(
            fresh_batches[str(batch["id"])]["download_url"], timeout=120
        )

    response.raise_for_status()
    return response.json()


# ---------- NORMALIZE WORD POSITIONS ----------

def get_vertices(word):
    """Docs show both `boundingBox` and `bounding_box`; accept either."""
    box = word.get("boundingBox") or word.get("bounding_box") or {}
    return box.get("vertices") if isinstance(box, dict) else box


def normalize_page(page, page_number):
    width, height = page.get("width"), page.get("height")
    words = []
    unit = "normalized"

    for word in page.get("words", []):
        vertices = get_vertices(word)
        if not vertices:
            continue

        xs = [v["x"] for v in vertices]
        ys = [v["y"] for v in vertices]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)

        if max(x1, y1) > 1.5:               # values are pixels, not 0-1
            if width and height:
                x0, x1, y0, y1 = x0 / width, x1 / width, y0 / height, y1 / height
            else:
                unit = "pixels"             # page size unknown: keep pixels

        words.append({
            "text": word.get("text", ""),
            "x0": round(x0, 5), "y0": round(y0, 5),
            "x1": round(x1, 5), "y1": round(y1, 5),
            "confidence": word.get("confidence"),
        })

    return {"page": page_number, "width": width, "height": height,
            "unit": unit, "words": words}


def extract_pages(batch_result):
    return (
            batch_result.get("pages")
            or batch_result.get("content", {}).get("pages")
            or []
    )


# ---------- SAVE ----------

def save_results(pdf_path, request_id, result):
    batches = sorted(result["batches"], key=lambda b: int(b["id"]))
    pages_out = []
    page_counter = 0

    for batch in batches:
        if batch["status"] != "completed":
            raise RuntimeError(f"Batch not completed: {batch['id']}")

        batch_result = fetch_batch(request_id, batch)

        # keep the raw response so the parsing can be corrected later
        raw_path = RAW_FOLDER / f"{pdf_path.stem}.batch{batch['id']}.json"
        raw_path.write_text(json.dumps(batch_result), encoding="utf-8")

        for page in extract_pages(batch_result):
            page_counter += 1                # global page number across batches
            pages_out.append(normalize_page(page, page_counter))

    out_path = OUTPUT_FOLDER / f"{pdf_path.stem}.words.json"
    out_path.write_text(
        json.dumps(
            {"file": pdf_path.name, "request_id": request_id,
             "page_count": len(pages_out), "pages": pages_out},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    return out_path, len(pages_out)


# ---------- PROCESS PDFS ----------

def main():
    # Optional filter: python script.py physics   -> only PDFs whose name contains "physics"
    filters = [a.lower() for a in sys.argv[1:]]

    pdf_files = sorted(
        p for p in INPUT_FOLDER.iterdir()
        if p.is_file() and p.suffix.lower() == ".pdf"
        and (not filters or any(f in p.name.lower() for f in filters))
    )

    if not pdf_files:
        print("No matching PDF files found.")
        return

    print(f"Found {len(pdf_files)} PDF files.\n")
    records = []

    for index, pdf_path in enumerate(pdf_files, start=1):
        print(f"[{index}/{len(pdf_files)}] {pdf_path.name}")

        out_path = OUTPUT_FOLDER / f"{pdf_path.stem}.words.json"
        if out_path.exists():
            print("  Already done, skipping.\n")
            continue

        try:
            request_id = submit_pdf(pdf_path)
            print(f"  Request ID: {request_id}")

            result = wait_for_completion(request_id)
            out_path, pages = save_results(pdf_path, request_id, result)

            records.append({"file": pdf_path.name, "request_id": request_id,
                            "words_file": str(out_path), "pages": pages})
            print(f"  Saved: {out_path} ({pages} pages)")

        except Exception as error:
            print(f"  ERROR: {error}")

        print()

    log = OUTPUT_FOLDER / "run_log.json"
    log.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(f"Finished. Log saved to: {log}")


if __name__ == "__main__":
    main()