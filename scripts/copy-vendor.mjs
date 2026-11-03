// Copies the browser libraries used inside simulation iframes into public/vendor (self-hosted, no CDN).
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const nm = (p) => join(process.cwd(), "node_modules", p);
const out = join(process.cwd(), "public", "vendor");
mkdirSync(out, { recursive: true });

const copy = (from, to) => {
  if (!existsSync(from)) return console.warn("vendor: missing", from);
  cpSync(from, join(out, to), { recursive: true });
};

copy(nm("matter-js/build/matter.min.js"), "matter.min.js");
copy(nm("katex/dist/katex.min.js"), "katex/katex.min.js");
copy(nm("katex/dist/katex.min.css"), "katex/katex.min.css");
copy(nm("katex/dist/fonts"), "katex/fonts");
copy(nm("leaflet/dist/leaflet.js"), "leaflet/leaflet.js");
copy(nm("leaflet/dist/leaflet.css"), "leaflet/leaflet.css");
copy(nm("leaflet/dist/images"), "leaflet/images");
copy(nm("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"), "fonts/inter.woff2");
for (const w of ["400", "600"]) {
  copy(nm(`@fontsource/noto-sans-bengali/files/noto-sans-bengali-bengali-${w}-normal.woff2`), `fonts/bengali-${w}.woff2`);
}
console.log("vendor files copied to public/vendor");
