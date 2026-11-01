import { NextRequest } from "next/server";
import { pool, vecLiteral } from "@/lib/db";
import { embedQuery } from "@/lib/embed";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { query, k = 5, book = null } = await req.json();
  if (!query || typeof query !== "string" || !query.trim()) {
    return Response.json({ error: "Empty query" }, { status: 400 });
  }
  try {
    const emb = await embedQuery(query.trim());
    const { rows } = await pool.query(
      `SELECT c.id, c.book, c.chapter, c.section, c.title, left(c.content, 600) AS excerpt,
              jsonb_array_length(c.figures) AS figures, (s.id IS NOT NULL) AS has_simulation,
              1 - (c.embedding <=> $1::vector) AS score
       FROM chunks c LEFT JOIN simulations s ON s.chunk_id = c.id
       WHERE ($3::text IS NULL OR c.book = $3)
       ORDER BY c.embedding <=> $1::vector LIMIT $2`,
      [vecLiteral(emb), Math.min(Number(k) || 5, 10), book]
    );
    return Response.json({
      matches: rows.map((r) => ({
        chunkId: r.id,
        book: r.book,
        chapter: r.chapter,
        section: r.section,
        title: r.title,
        excerpt: r.excerpt,
        figures: r.figures,
        hasSimulation: r.has_simulation,
        score: Number(r.score),
      })),
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 503 });
  }
}
