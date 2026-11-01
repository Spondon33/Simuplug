import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { museComplete, museStream } from "@/lib/muse";
import { SIM_SYSTEM_PROMPT, buildSimUserPrompt, SimContext } from "@/lib/openui/sim-prompt";
import { validateOpenUi } from "@/lib/openui/validate";

export const runtime = "nodejs";
export const maxDuration = 300;

const clean = (t: string) => t.replace(/^\s*```[a-zA-Z]*\n?/, "").replace(/\n?```\s*$/, "").trim();

/**
 * NDJSON events: {t:"cached",code} | {t:"delta",v} | {t:"reset"} | {t:"final",code} | {t:"stored",id} | {t:"error",message}
 * If a simulation is already stored for the chunk, it is returned as-is (no LLM call).
 */
export async function POST(req: NextRequest) {
  const { chunkId, query = "" } = await req.json();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const existing = await pool.query(
          "SELECT openui_code FROM simulations WHERE chunk_id = $1",
          [chunkId]
        );
        if (existing.rows[0]) {
          send({ t: "cached", code: existing.rows[0].openui_code });
          return;
        }

        const { rows } = await pool.query(
          "SELECT book, chapter, section, title, content, figures FROM chunks WHERE id = $1",
          [chunkId]
        );
        if (!rows[0]) {
          send({ t: "error", message: "Unknown chunk" });
          return;
        }
        const ctx: SimContext = { query, ...rows[0] };
        const sys = { role: "system" as const, content: SIM_SYSTEM_PROMPT };

        let code = "";
        for await (const d of museStream([sys, { role: "user", content: buildSimUserPrompt(ctx) }], 28000)) {
          code += d;
          send({ t: "delta", v: d });
        }
        code = clean(code);

        let v = await validateOpenUi(code);
        for (let attempt = 0; !v.ok && attempt < 2; attempt++) {
          send({ t: "reset" });
          code = clean(
            await museComplete(
              [sys, { role: "user", content: buildSimUserPrompt(ctx, { code, errors: v.errors }) }],
              28000
            )
          );
          v = await validateOpenUi(code);
        }
        if (!v.ok) {
          send({ t: "error", message: `Could not produce a valid simulation: ${v.errors.join("; ")}` });
          return;
        }

        send({ t: "final", code });
        // Store the OpenUI Lang together with the chunk's vector so it can be reused (and searched) later.
        const ins = await pool.query(
          `INSERT INTO simulations (chunk_id, title, openui_code, embedding, model)
           SELECT id, title, $2, embedding, $3 FROM chunks WHERE id = $1
           ON CONFLICT (chunk_id) DO NOTHING RETURNING id`,
          [chunkId, code, process.env.BASETEN_MODEL || "meta-models/muse-spark-open-1026"]
        );
        send({ t: "stored", id: ins.rows[0]?.id ?? null });
      } catch (e) {
        send({ t: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
}
