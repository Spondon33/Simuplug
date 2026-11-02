// Open the database connection (waking a scaled-to-zero Neon compute) and cache the book index,
// so the first visitor doesn't pay for it.
import { getIndex } from "@/lib/ocr-data";

if (process.env.DATABASE_URL) {
  getIndex().catch((e) => console.warn("Warm-up skipped:", (e as Error).message));
}
