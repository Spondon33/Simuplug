import { pool, vecLiteral } from "@/lib/db";
import { embedQuery } from "@/lib/embed";
import { museComplete } from "@/lib/muse";

/**
 * Simulations are cached per TOPIC (what the student searched), not per textbook section: one section can cover
 * several experiments or models (Thomson / Rutherford / Bohr, four diffusion experiments ...), and each needs its own.
 *
 * Embedding similarity alone cannot tell "concave lens" from "convex lens" (0.92) or one Newton law from another (0.93),
 * while paraphrases of one topic can score as low as 0.83. So: near-identical searches reuse directly; borderline ones are
 * settled by a tiny Muse yes/no check; everything else generates a new simulation.
 */
const IDENTICAL = 0.985; // reuse without asking
const CANDIDATE = 0.8; // below this the topics are clearly different

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

const JUDGE_SYSTEM =
  "You compare two student searches in a textbook app. Decide whether ONE interactive simulation made for the FIRST search would fully " +
  "answer the SECOND search, meaning both ask about the same specific concept, model, law, experiment or example. Different experiments, " +
  "atomic models, laws, lens or mirror types, reactions, organs, events or worked examples are DIFFERENT even when they are in the same " +
  "chapter. Rewordings, extra words and different languages for the same thing are SAME. Reply with exactly one word: SAME or DIFFERENT.";

export async function sameTopic(stored: string, asked: string): Promise<boolean> {
  try {
    const out = await museComplete(
      [
        { role: "system", content: JUDGE_SYSTEM },
        { role: "user", content: `FIRST search: "${stored}"\nSECOND search: "${asked}"` },
      ],
      800
    );
    return /\bSAME\b/i.test(out) && !/\bDIFFERENT\b/i.test(out);
  } catch {
    return false; // when unsure, generate a fresh simulation rather than show a wrong one
  }
}

export interface CacheLookup {
  code: string | null;
  embedding: number[] | null; // the search's vector, reused when storing a new simulation
}

export async function findCachedSimulation(chunkId: number, query: string): Promise<CacheLookup> {
  let embedding: number[] | null = null;
  try {
    embedding = await embedQuery(query);
  } catch {
    return { code: null, embedding: null };
  }
  const { rows } = await pool.query(
    `SELECT openui_code, query, chunk_id, 1 - (topic_embedding <=> $1::vector) AS sim
     FROM simulations
     WHERE topic_embedding IS NOT NULL
     ORDER BY topic_embedding <=> $1::vector
     LIMIT 4`,
    [vecLiteral(embedding)]
  );
  const asked = norm(query);
  let judged = 0;
  for (const r of rows) {
    const sim = Number(r.sim);
    if (norm(r.query ?? "") === asked || sim >= IDENTICAL) return { code: r.openui_code, embedding };
    if (sim >= CANDIDATE && judged < 2) {
      judged++;
      if (await sameTopic(r.query ?? "", query)) return { code: r.openui_code, embedding };
    }
  }
  return { code: null, embedding };
}

export async function storeSimulation(chunkId: number, query: string, embedding: number[] | null, code: string, model: string) {
  const ins = await pool.query(
    `INSERT INTO simulations (chunk_id, title, openui_code, embedding, query, topic_embedding, model)
     SELECT id, title, $2, embedding, $3, $4::vector, $5 FROM chunks WHERE id = $1
     RETURNING id`,
    [chunkId, code, query, embedding ? vecLiteral(embedding) : null, model]
  );
  return ins.rows[0]?.id ?? null;
}
