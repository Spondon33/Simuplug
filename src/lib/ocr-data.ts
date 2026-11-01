import { pool } from "@/lib/db";

export interface BookMeta {
  id: string;
  name: string; // matches chunks.book
  stem: string;
  pages: number;
  aspects: number[];
}

// The book index is tiny and static; cache it briefly so every page request doesn't re-query it.
let indexCache: { at: number; rows: BookMeta[] } | null = null;
export async function getIndex(): Promise<BookMeta[]> {
  if (indexCache && Date.now() - indexCache.at < 5 * 60_000) return indexCache.rows;
  const { rows } = await pool.query("SELECT id, name, stem, pages, aspects FROM ocr_books ORDER BY name");
  indexCache = { at: Date.now(), rows };
  return rows;
}

/** Word boxes for one page: [[text, x0, y0, x1, y1], ...] as fractions of the page size. */
export async function getPageWords(id: string, page: number) {
  if (!Number.isInteger(page) || page < 1) return null;
  const { rows } = await pool.query("SELECT words FROM page_words WHERE book_id = $1 AND page = $2", [id, page]);
  return rows[0]?.words ?? null;
}
