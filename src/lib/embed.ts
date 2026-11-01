// Queries are embedded by the same EmbeddingGemma 2 model that embedded the chunks (rag/embed_server.py).
const EMBED_URL = process.env.EMBED_URL || "http://127.0.0.1:8765/embed";

export async function embedQuery(text: string): Promise<number[]> {
  const r = await fetch(EMBED_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texts: [text], kind: "query" }),
  }).catch(() => {
    throw new Error("Embedding server is not running. Start it with `npm run embed-server`.");
  });
  if (!r.ok) throw new Error(`Embedding server error: ${r.status}`);
  return (await r.json()).embeddings[0] as number[];
}
