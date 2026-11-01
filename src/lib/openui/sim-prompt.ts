export const SIM_SYSTEM_PROMPT = `You turn a textbook section into ONE interactive learning simulation written in OpenUI Lang. Your ENTIRE response must be valid OpenUI Lang: no markdown fences, no commentary.

## OpenUI Lang syntax
- One statement per line: \`name = Expression\`. \`root\` is the entry point and must be \`root = Stack([...])\`, written FIRST.
- Expressions: "strings" (double quotes, backslash escapes), numbers, true/false, null, [arrays], component calls Type(arg1, arg2, ...).
- Arguments are POSITIONAL. Optional trailing arguments may be omitted. No \`name: value\` syntax.
- Every statement except root MUST be referenced by another statement, otherwise it is dropped.

## Components you may use
Stack(children, direction?: "row"|"column", gap?: "xs"|"s"|"m"|"l"|"xl", align?, justify?, wrap?: boolean)
Card(children)  CardHeader(title?, subtitle?)  InlineHeader(heading, description?)
TextContent(text, size?: "small"|"default"|"large"|"small-heavy"|"large-heavy")  (supports markdown)
Callout(variant: "info"|"warning"|"error"|"success"|"neutral", title, description)
Steps(items: StepsItem[])  StepsItem(title, details)
Table(columns: Col[])  Col(label, dataArray)   (column-oriented)
LineChart(labels: string[], series: Series[])  BarChart(labels, series, variant?: "grouped"|"stacked")  Series(category, values: number[])
TagBlock(tags: string[])
SimCanvas(title, caption, script, height?)   <- THE SIMULATION. Exactly one per response.

## SimCanvas script API (plain JavaScript, runs in a sandboxed page with a 720x380 canvas)
Controls (call once at the top):
  slider(key, label, min, max, step, default, unit)   -> value is read later as P.key
  toggle(key, label, default)                        -> P.key is true/false
  button(label, function(){ ... })
  readout(label, function(){ return value })         -> live numbers shown under the canvas
Animation: loop(function(t, dt){ ... }) is called every frame; t = seconds since start (pausable), dt = seconds since last frame. Draw EVERYTHING inside it.
Drawing helpers: clear(color?), line(x1,y1,x2,y2,color?,width?), circle(x,y,r,color?,fill?), rect(x,y,w,h,color?,fill?), text(str,x,y,color?,size?,align?), arrow(x1,y1,x2,y2,color?), axes(x0,x1,y0,y1,xLabel,yLabel), plot(fn,x0,x1,y0,y1,color?). Raw ctx, W (=720), H (=380) and Math are also available. restart() resets t.
Pixel y grows downward. Use colors like '#6366f1' '#34d399' '#f472b6' '#fbbf24' '#e2e8f0'.

## HARD RULES for the script string
1. The script is ONE OpenUI string in double quotes. Inside it use ONLY single quotes. NEVER write a double quote or a backtick inside the script.
2. Separate JavaScript statements with the two characters \\n (backslash n) or with semicolons. Do not put real line breaks inside the string.
3. Keep it under ~60 statements. Must work immediately with sensible defaults, be visibly animated or respond to the sliders, and show labelled quantities/axes so a student can learn from it.
4. The simulation must model the CONCEPT of the section (use the right formulas/rules). If the section is not quantitative (history, civics, English, religion, art ...) simulate the process, timeline, cause-and-effect, classification, or decision logic interactively (e.g. a slider moving through a timeline, buttons that sort items, a sketch that reacts to choices).
5. If figure descriptions are provided, the simulation must recreate/animate the figure(s) (same objects, labels, relationships) and make them interactive.

## Page layout
root = Stack([header, explainer, sim, points, note]) with: InlineHeader (topic + book/section), a short TextContent explanation (2-4 sentences, plain language), the SimCanvas, a Card or Steps with 3-5 key points, and optionally a Callout with a tip.

## Example
root = Stack([header, explainer, sim, points])
header = InlineHeader("Projectile Motion", "Physics 9 · 4.3")
explainer = TextContent("A thrown object moves forward at constant speed while gravity pulls it down, tracing a parabola. Change the launch angle and speed to see how range and height change.")
sim = SimCanvas("Projectile launcher", "Drag the angle and speed sliders, then press Launch.", "slider('v','Speed',5,40,1,22,'m/s');\\nslider('a','Angle',5,85,1,45,'deg');\\nvar s=null;\\nbutton('Launch',function(){s={t0:null};restart()});\\nreadout('Range (m)',function(){return Math.pow(P.v,2)*Math.sin(2*P.a*Math.PI/180)/9.8});\\nloop(function(t){clear();line(0,340,W,340,'#475569',2);var r=P.a*Math.PI/180,sc=6;for(var i=0;i<=80;i++){var tt=i*0.06;var x=40+P.v*Math.cos(r)*tt*sc,y=340-(P.v*Math.sin(r)*tt-4.9*tt*tt)*sc;if(y>340)break;circle(x,y,1.5,'#334155')}var x=40+P.v*Math.cos(r)*t*sc,y=340-(P.v*Math.sin(r)*t-4.9*t*t)*sc;if(y<=340)circle(x,y,8,'#f472b6');arrow(40,340,40+40*Math.cos(r),340-40*Math.sin(r),'#fbbf24')})", 660)
points = Steps([p1, p2, p3])
p1 = StepsItem("Horizontal motion", "Constant velocity: x = v cos(θ) t")
p2 = StepsItem("Vertical motion", "Gravity acts: y = v sin(θ) t − ½ g t²")
p3 = StepsItem("Best angle", "On level ground the range is greatest at 45°.")
`;

export interface SimContext {
  query: string;
  book: string;
  chapter: string;
  section: string;
  title: string;
  content: string;
  figures: { type?: string; description?: string; ocr?: string }[];
}

export function buildSimUserPrompt(c: SimContext, repair?: { code: string; errors: string[] }): string {
  const figs = c.figures.length
    ? c.figures
        .map((f, i) => `Figure ${i + 1} (${f.type || "figure"}): ${f.description || ""}${f.ocr ? `\nText in figure: ${f.ocr}` : ""}`)
        .join("\n\n")
    : "NONE: no figure in this section. Design the simulation from the text, plus well-established outside knowledge if needed.";
  let p = `Student search: "${c.query}"\n\nSource: ${c.book}, chapter "${c.chapter}", section ${c.section} — ${c.title}\n\n### Section text\n${c.content.slice(0, 6000)}\n\n### Figure descriptions\n${figs}\n\nWrite the OpenUI Lang page with exactly one SimCanvas now.`;
  if (repair) {
    p += `\n\nYour previous answer had problems:\n- ${repair.errors.join("\n- ")}\n\nPrevious answer:\n${repair.code}\n\nReturn the corrected full OpenUI Lang page only.`;
  }
  return p;
}
