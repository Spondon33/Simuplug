import vm from "node:vm";

/**
 * Runs a SimCanvas script once against a no-op copy of the harness API (and a few frames of its loop) so
 * ReferenceErrors, TypeErrors and infinite loops are caught on the server and sent back to the model to repair.
 * It also records where text is drawn and reports overlapping or off-canvas text as layout warnings.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

export interface DryRun {
  error: string | null; // hard failure: the script cannot run
  layout: string[]; // soft problems: overlapping / off-canvas text
}

interface Item { kind: string; s: string; x0: number; y0: number; x1: number; y1: number }

function deep(): Any {
  const p: Any = new Proxy(function () {}, {
    get: (_t, k) => (k === Symbol.toPrimitive ? () => "" : k === "width" ? 50 : p),
    set: () => true,
    apply: () => p,
    construct: () => p,
  });
  return p;
}

const textW = (s: string, size: number) => String(s).length * size * 0.56;

export async function dryRunSim(script: string): Promise<DryRun> {
  const noop = () => undefined;
  const P: Record<string, unknown> = {};
  let loopFn: ((t: number, dt: number) => void) | null = null;
  let items: Item[] = [];
  const ctx = new Proxy({}, {
    get: (_t, k) => (k === "measureText" ? () => ({ width: 50 }) : typeof k === "string" && k.startsWith("create") ? () => ({ addColorStop: noop }) : noop),
    set: () => true,
  });
  const Matter = /\bMatter\b|\bdrawBodies\b|\bstepEngine\b/.test(script) ? (await import("matter-js")).default : undefined;

  let bad: string | null = null;
  const finite = (name: string, args: unknown[]) => {
    if (!bad && args.some((a) => typeof a === "number" && !Number.isFinite(a))) bad = `${name}() received NaN or Infinity (check divisions by zero and square roots/logs of bad values)`;
  };
  const rec = (kind: string, s: unknown, x0: number, y0: number, x1: number, y1: number) => {
    if ([x0, y0, x1, y1].every((v) => Number.isFinite(v))) items.push({ kind, s: String(s), x0, y0, x1, y1 });
  };
  const text = (s: unknown, x: number, y: number, _c?: string, size = 13, align = "left") => {
    finite("text", [x, y]);
    const w = textW(String(s), size);
    const left = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
    rec("text", s, left, y - size, left + w, y + size * 0.25);
  };

  const env: Record<string, Any> = {
    P, M: { x: 0, y: 0, down: false }, W: 720, H: 400, PI: Math.PI, ctx,
    C: new Proxy({}, { get: () => "#3b82f6" }), PAL: ["#3b82f6", "#14b8a6"],
    slider: (k: string, _l: string, _mn: number, _mx: number, _st: number, def: number) => { P[k] = def; },
    toggle: (k: string, _l: string, d: boolean) => { P[k] = !!d; },
    choice: (k: string, _l: string, _o: string[], d: number) => { P[k] = d || 0; },
    button: noop, readout: noop, formula: noop, restart: noop, onDrag: noop,
    loop: (f: (t: number, dt: number) => void) => { loopFn = f; },
    clear: () => { items = []; },
    line: (...a: unknown[]) => finite("line", a), circle: (...a: unknown[]) => finite("circle", a), ball: (...a: unknown[]) => finite("ball", a),
    rect: (...a: unknown[]) => finite("rect", a), arrow: (...a: unknown[]) => finite("arrow", a), spring: (...a: unknown[]) => finite("spring", a),
    poly: noop, ground: (...a: unknown[]) => finite("ground", a),
    text,
    box: (x: number, y: number, w: number, h: number, _c?: string, label?: string) => {
      finite("box", [x, y, w, h]);
      if (label) text(label, x + w / 2, y + h / 2 + 4, "#fff", 13, "center");
    },
    wrapText: (s: unknown, x: number, y: number, maxW: number, lh: number, _c?: string, size = 13) => {
      const lines = Math.max(1, Math.ceil(textW(String(s), size) / Math.max(40, maxW)));
      rec("wrap", s, x, y - size, x + Math.min(maxW, textW(String(s), size)), y - size + lines * lh);
      return y + lines * lh;
    },
    // label() is auto-nudged by the real harness, so it is not checked here
    label: (...a: unknown[]) => finite("label", a), axes: noop, plot: noop, chart: noop,
    timeline: () => ({ at: 0, label: "" }), drawBodies: noop, mapView: () => deep(), L: deep(),
    stepEngine: (e: Any, dt: number) => Matter?.Engine.update(e, Math.min(16.667, (dt || 0.016) * 1000)),
    Matter,
    lerp: (a: number, b: number, t: number) => a + (b - a) * t,
    clamp: (v: number, a: number, b: number) => Math.max(a, Math.min(b, v)),
    map: (v: number, a: number, b: number, c: number, d: number) => c + ((v - a) / (b - a)) * (d - c),
    ease: (t: number) => t, rand: (a: number, b: number) => a + Math.random() * (b - a),
    fmt: (n: number, d?: number) => (+n).toFixed(d ?? 1), tint: (c: string) => c,
    console: { log: noop, warn: noop, error: noop },
  };
  const context = vm.createContext(env);
  const layout: string[] = [];
  try {
    vm.runInContext(script, context, { timeout: 1500 });
    if (loopFn) {
      env.__loop = loopFn;
      for (const [t, dt] of [[0.1, 0.016], [1.5, 0.016], [4, 0.016], [9, 0.033]]) {
        env.__t = t; env.__dt = dt;
        items = [];
        vm.runInContext("__loop(__t, __dt)", context, { timeout: 1500 });
        if (layout.length < 3) {
          const seen = new Set<string>();
          for (const a of items) {
            if (a.x0 < -2 || a.x1 > 722 || a.y0 < -2 || a.y1 > 402) {
              const m = `text "${a.s.slice(0, 40)}" goes outside the 720x400 canvas (x ${Math.round(a.x0)}-${Math.round(a.x1)}, y ${Math.round(a.y0)}-${Math.round(a.y1)})`;
              if (!seen.has(m)) { seen.add(m); layout.push(m); }
            }
          }
          for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
              const a = items[i], b = items[j];
              const ow = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
              const oh = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
              if (ow > 6 && oh > 4) {
                const area = ow * oh, small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
                if (area > 0.25 * small) {
                  const m = `text "${a.s.slice(0, 32)}" overlaps text "${b.s.slice(0, 32)}" near (${Math.round(Math.max(a.x0, b.x0))}, ${Math.round(Math.max(a.y0, b.y0))})`;
                  if (!seen.has(m)) { seen.add(m); layout.push(m); }
                }
              }
            }
          }
        }
      }
    }
    if (bad) return { error: bad, layout: [] };
    return { error: null, layout: layout.slice(0, 4) };
  } catch (e) {
    return { error: (e as Error).message || String(e), layout: [] };
  }
}
