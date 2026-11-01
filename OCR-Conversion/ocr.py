
import os
import json
import time
from pathlib import Path

import requests

# ---------- CONFIGURATION ----------

API_KEY = os.environ["UPSTAGE_API_KEY"]

INPUT_FOLDER = Path("/Users/nurulaminkh/Desktop/Books-To-Train")
OUTPUT_FOLDER = Path("/Users/nurulaminkh/Desktop/OCR-Converted")

BASE_URL = "https://api.upstage.ai/v1"
POLL_INTERVAL = 5

HEADERS = {
    "Authorization": f"Bearer {API_KEY}"
}

OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)


# ---------- SUBMIT PDF ----------

def submit_pdf(pdf_path):
    with open(pdf_path, "rb") as file:
        response = requests.post(
            f"{BASE_URL}/document-digitization/async",
            headers=HEADERS,
            files={"document": (pdf_path.name, file, "application/pdf")},
            data={
                "model": "document-parse",
                "mode": "auto",
                "ocr": "force",
                "output_formats": "['html']"
            },
            timeout=120
        )

    response.raise_for_status()
    return response.json()["request_id"]


# ---------- WAIT FOR COMPLETION ----------

def wait_for_completion(request_id):
    url = f"{BASE_URL}/document-digitization/requests/{request_id}"

    while True:
        response = requests.get(
            url,
            headers=HEADERS,
            timeout=30
        )
        response.raise_for_status()

        result = response.json()
        status = result["status"]

        print(f"  Status: {status}")

        if status == "completed":
            return result

        if status in ("failed", "cancelled"):
            raise RuntimeError(
                f"Parsing failed: {json.dumps(result)}"
            )

        time.sleep(POLL_INTERVAL)


# ---------- DOWNLOAD HTML ----------

def download_html(request_id, result, output_path):
    html_parts = []
    download_urls = []

    batches = sorted(
        result["batches"],
        key=lambda batch: int(batch["id"])
    )

    for batch in batches:
        if batch["status"] != "completed":
            raise RuntimeError(
                f"Batch not completed: {batch['id']}"
            )

        download_url = batch["download_url"]
        download_urls.append(download_url)

        # Refresh signed URLs if one has expired.
        response = requests.get(download_url, timeout=120)

        if response.status_code in (401, 403):
            fresh = requests.get(
                f"{BASE_URL}/document-digitization/requests/{request_id}",
                headers=HEADERS,
                timeout=30
            )
            fresh.raise_for_status()

            fresh_batches = {
                str(b["id"]): b
                for b in fresh.json()["batches"]
            }

            download_url = fresh_batches[str(batch["id"])]["download_url"]
            download_urls[-1] = download_url
            response = requests.get(download_url, timeout=120)

        response.raise_for_status()

        batch_result = response.json()
        html = batch_result["content"]["html"]

        html_parts.append(html)

    output_path.write_text(
        "\n\n".join(html_parts),
        encoding="utf-8"
    )

    return download_urls


# ---------- PROCESS ALL PDFS ----------

def main():
    pdf_files = sorted(
        p for p in INPUT_FOLDER.iterdir()
        if p.is_file() and p.suffix.lower() == ".pdf"
    )

    if not pdf_files:
        print("No PDF files found.")
        return

    print(f"Found {len(pdf_files)} PDF files.\n")

    records = []

    for index, pdf_path in enumerate(pdf_files, start=1):
        print(f"[{index}/{len(pdf_files)}] {pdf_path.name}")

        try:
            request_id = submit_pdf(pdf_path)
            print(f"  Request ID: {request_id}")

            result = wait_for_completion(request_id)

            output_path = OUTPUT_FOLDER / f"{pdf_path.stem}.html"

            urls = download_html(
                request_id,
                result,
                output_path
            )

            record = {
                "file": pdf_path.name,
                "request_id": request_id,
                "html_file": str(output_path),
                "download_urls": urls
            }

            records.append(record)

            print(f"  Saved: {output_path}")

            for url in urls:
                print(f"  Download URL: {url}")

        except Exception as error:
            print(f"  ERROR: {error}")

        print()

    # Save URLs and request IDs
    urls_file = OUTPUT_FOLDER / "download_urls.json"

    urls_file.write_text(
        json.dumps(records, indent=2),
        encoding="utf-8"
    )

    print("Finished processing all PDFs.")
    print(f"URL records saved to: {urls_file}")


if __name__ == "__main__":
    main()
