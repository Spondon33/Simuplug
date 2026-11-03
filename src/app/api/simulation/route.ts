import { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { MUSE_MODEL, museComplete, museStream } from "@/lib/muse";
import { SIM_SYSTEM_PROMPT, buildSimUserPrompt, SimContext } from "@/lib/openui/sim-prompt";
import { validateOpenUi } from "@/lib/openui/validate";
import { findCachedSimulation, storeSimulation } from "@/lib/sim-cache";

export const runtime = "nodejs";
export const maxDuration = 300;

const clean = (t: string) => t.replace(/^\s*```[a-zA-Z]*\n?/, "").replace(/\n?```\s*$/, "").trim();

/**
 * NDJSON events: {t:"cached",code} | {t:"delta",v} | {t:"reset"} | {t:"final",code} | {t:"stored",id} | {t:"error",message}
 * If a simulation was already stored for this same topic, it is returned as-is (no generation).
 */
export async function POST(req: NextRequest) {
  const { chunkId, query = "" } = await req.json();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        // Reuse only a simulation made for the SAME topic (not merely the same section).
        const cache = await findCachedSimulation(chunkId, query);
        if (cache.code) {
          send({ t: "cached", code: cache.code });
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
        // Hard errors: up to 2 repair passes. Layout warnings (overlapping text): one repair pass, never blocking.
        for (let attempt = 0; (!v.ok || (attempt === 0 && v.warnings.length)) && attempt < 2; attempt++) {
          send({ t: "reset" });
          const issues = [...v.errors, ...v.warnings.map((w) => `Layout: ${w}. Move or shorten things so no text overlaps and everything stays inside the canvas.`)];
          const fixed = clean(
            await museComplete(
              [sys, { role: "user", content: buildSimUserPrompt(ctx, { code, errors: issues }) }],
              28000
            )
          );
          const v2 = await validateOpenUi(fixed);
          // keep the repaired version only if it is valid (a broken repair must not replace a working simulation)
          if (v2.ok || !v.ok) {
            code = fixed;
            v = v2;
          }
        }
        if (!v.ok) {
          send({ t: "error", message: `Could not produce a valid simulation: ${v.errors.join("; ")}` });
          return;
        }

        send({ t: "final", code });
        // Store the OpenUI Lang with the search it was made for (and that search's vector) so only the same topic reuses it.
        const id = await storeSimulation(chunkId, query, cache.embedding, code, MUSE_MODEL());
        send({ t: "stored", id });
      } catch (e) {
        send({ t: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
}
