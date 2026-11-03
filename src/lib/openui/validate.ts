import { z } from "zod/v4";
import { dryRunSim } from "./sim-dryrun";
import { createLibrary, createParser, defineComponent } from "@openuidev/lang-core";
import { SIM_DESCRIPTION, simCanvasProps } from "./sim-schema";

// Server-side validation library. react-ui is a client-only package, so the allowed components are
// mirrored here as schema-only stubs (same names and positional argument order as the prompt documents).
const any = z.any();
const str = z.string();
const stub = (name: string, props: Record<string, z.ZodType>) =>
  defineComponent({ name, description: name, props: z.object(props), component: () => null });

let parserPromise: Promise<ReturnType<typeof createParser>> | null = null;

async function getParser() {
  parserPromise ??= (async () => {
    const components = [
      stub("Stack", { children: z.array(any), direction: str.optional(), gap: str.optional(), align: str.optional(), justify: str.optional(), wrap: z.boolean().optional() }),
      stub("Card", { children: z.array(any) }),
      stub("CardHeader", { title: str.optional(), subtitle: str.optional() }),
      stub("InlineHeader", { heading: str, description: str.optional() }),
      stub("TextContent", { text: str, size: str.optional() }),
      stub("Callout", { variant: str, title: str, description: str }),
      stub("Steps", { items: z.array(any) }),
      stub("StepsItem", { title: str, details: str }),
      stub("Table", { columns: z.array(any) }),
      stub("Col", { label: str, data: any }),
      stub("LineChart", { labels: z.array(str), series: z.array(any) }),
      stub("BarChart", { labels: z.array(str), series: z.array(any), variant: str.optional() }),
      stub("Series", { category: str, values: z.array(z.number()) }),
      stub("TagBlock", { tags: z.array(str) }),
      defineComponent({ name: "SimCanvas", description: SIM_DESCRIPTION, props: simCanvasProps, component: () => null }),
    ];
    const lib = createLibrary({ components, root: "Stack" });
    return createParser(lib.toJSONSchema());
  })();
  return parserPromise;
}

export interface Validation {
  ok: boolean; // no hard errors
  errors: string[];
  warnings: string[]; // layout problems (overlapping text): worth one repair pass, never blocking
}

function findSim(node: unknown, out: { script?: string }[]) {
  if (!node || typeof node !== "object") return;
  const n = node as { typeName?: string; props?: Record<string, unknown> };
  if (n.typeName === "SimCanvas") out.push({ script: n.props?.script as string });
  for (const v of Object.values(n.props ?? (node as object))) {
    if (Array.isArray(v)) v.forEach((x) => findSim(x, out));
    else findSim(v, out);
  }
}

export async function validateOpenUi(code: string): Promise<Validation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!/^\s*root\s*=/m.test(code)) errors.push("Missing `root = ...` statement");
  try {
    const parser = await getParser();
    const res = parser.parse(code) as {
      root: unknown;
      meta: { errors: unknown[]; unresolved: string[]; orphaned: string[]; incomplete: boolean };
    };
    for (const e of res.meta.errors) errors.push(typeof e === "string" ? e : JSON.stringify(e));
    if (res.meta.unresolved.length) errors.push(`Unresolved references: ${res.meta.unresolved.join(", ")}`);
    if (res.meta.orphaned.length) errors.push(`Defined but never referenced: ${res.meta.orphaned.join(", ")}`);
    if (res.meta.incomplete) errors.push("Output was cut off (incomplete)");
    const sims: { script?: string }[] = [];
    findSim(res.root, sims);
    if (sims.length !== 1) errors.push(`Expected exactly one SimCanvas, found ${sims.length}`);
    else {
      try {
        new Function(sims[0].script || "");
        const run = await dryRunSim(sims[0].script || "");
        if (run.error) errors.push(`SimCanvas script fails when run: ${run.error}`);
        warnings.push(...run.layout);
      } catch (e) {
        errors.push(`SimCanvas script has a JavaScript syntax error: ${(e as Error).message}`);
      }
    }
  } catch (e) {
    errors.push(`Parse failure: ${(e as Error).message}`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
