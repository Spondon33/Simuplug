"use client";

import type { SimAssets, SimNeeds } from "./sim-harness";

/**
 * Sandboxed iframes can't load scripts/fonts from the app's own server (opaque origin), so the parent fetches
 * each library once, turns fonts into data URIs and hands the text to buildSimHtml to inline. Cached for the session.
 */
const memo = new Map<string, Promise<string>>();
const once = (key: string, f: () => Promise<string>) => {
  if (!memo.has(key)) memo.set(key, f().catch((e) => { memo.delete(key); throw e; }));
  return memo.get(key)!;
};

const text = (url: string) => fetch(url).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${url}: ${r.status}`))));
const dataUri = (url: string) =>
  fetch(url)
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`${url}: ${r.status}`))))
    .then(
      (b) =>
        new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result as string);
          fr.onerror = rej;
          fr.readAsDataURL(b);
        })
    );

const fontsCss = () =>
  once("fonts", async () => {
    const [inter, b4, b6] = await Promise.all([
      dataUri("/vendor/fonts/inter.woff2"),
      dataUri("/vendor/fonts/bengali-400.woff2"),
      dataUri("/vendor/fonts/bengali-600.woff2"),
    ]);
    return (
      `@font-face{font-family:'InterV';src:url(${inter}) format('woff2');font-weight:100 900;font-display:swap}` +
      `@font-face{font-family:'NotoBn';src:url(${b4}) format('woff2');font-weight:400;font-display:swap}` +
      `@font-face{font-family:'NotoBn';src:url(${b6}) format('woff2');font-weight:600 800;font-display:swap}`
    );
  });

const katexCss = () =>
  once("katexCss", async () => {
    let css = await text("/vendor/katex/katex.min.css");
    css = css.replace(/,url\(fonts\/[^)]+\.(?:woff|ttf)\) format\("(?:woff|truetype)"\)/g, "");
    const names = [...new Set([...css.matchAll(/url\(fonts\/([^)]+\.woff2)\)/g)].map((m) => m[1]))];
    const uris = await Promise.all(names.map((n) => dataUri(`/vendor/katex/fonts/${n}`)));
    names.forEach((n, i) => {
      css = css.split(`url(fonts/${n})`).join(`url(${uris[i]})`);
    });
    return css;
  });

const leafletCss = () => once("leafletCss", () => text("/vendor/leaflet/leaflet.css").then((c) => c.replace(/url\(images\/[^)]+\)/g, "none")));

export async function loadAssets(needs: SimNeeds): Promise<SimAssets> {
  const [fonts, kCss, kJs, mJs, lCss, lJs] = await Promise.all([
    fontsCss().catch(() => ""),
    needs.katex ? katexCss().catch(() => "") : undefined,
    needs.katex ? once("katexJs", () => text("/vendor/katex/katex.min.js")) : undefined,
    needs.matter ? once("matterJs", () => text("/vendor/matter.min.js")) : undefined,
    needs.leaflet ? leafletCss() : undefined,
    needs.leaflet ? once("leafletJs", () => text("/vendor/leaflet/leaflet.js")) : undefined,
  ]);
  return { fontsCss: fonts, katexCss: kCss, katexJs: kJs, matterJs: mJs, leafletCss: lCss, leafletJs: lJs };
}
