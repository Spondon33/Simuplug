import { z } from "zod/v4";

export const SIM_DESCRIPTION =
  "An interactive canvas simulation (sliders, buttons, live readouts) driven by a short JavaScript script. Include exactly one per page.";

export const simCanvasProps = z.object({
  title: z.string().describe("Short simulation title"),
  caption: z.string().describe("One sentence telling the student what to try (e.g. 'Drag the angle slider and watch the range')"),
  script: z.string().describe("JavaScript using the SimCanvas harness API; statements separated by \\n; single quotes only"),
  height: z.number().optional().describe("Iframe height in px, default 660"),
});
