import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { museStream } from "@/lib/muse";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { query, chunkIds } = await req.json();
  const ids = (Array.isArray(chunkIds) ? chunkIds : []).map(Number).filter(Boolean).slice(0, 4);
  const { rows } = await pool.query(
    "SELECT id, book, section, title, left(content, 2500) AS content FROM chunks WHERE id = ANY($1::int[])",
    [ids]
  );
  const order = new Map<number, number>(ids.map((id: number, i: number) => [id, i]));
  rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const context = rows.map((r, i) => `[${i + 1}] ${r.book} §${r.section} ${r.title}\n${r.content}`).join("\n\n");

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const t of museStream(
          [
            {
              role: "system",
              content:
                "You are a concise tutor. Answer the student's search with a SHORT summary (3-5 sentences, plain language) grounded in the textbook excerpts. Cite sources inline like [1]. If the excerpts do not cover the topic, say so briefly and give the best general explanation. Write math in plain text (for example F = ma, v = u + at); never use LaTeX or dollar signs. No headings, no preamble.",
            },
            { role: "user", content: `Search: ${query}\n\nTextbook excerpts:\n${context}` },
          ],
          6000
        )) {
          controller.enqueue(enc.encode(t));
        }
      } catch (e) {
        controller.enqueue(enc.encode(`\n[Summary unavailable: ${(e as Error).message}]`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } });
}
