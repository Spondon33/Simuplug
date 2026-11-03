"use client";

import React, { useEffect, useRef, useState } from "react";
import { defineComponent, useIsStreaming } from "@openuidev/react-lang";
import { Loader2 } from "lucide-react";
import { buildSimHtml, detectNeeds } from "./sim-harness";
import { loadAssets } from "./sim-assets";
import { SIM_DESCRIPTION, simCanvasProps } from "./sim-schema";

export const SimCanvasComponent = defineComponent({
  name: "SimCanvas",
  description: SIM_DESCRIPTION,
  props: simCanvasProps,
  component: ({ props }) => {
    // While the page is still streaming, `script` is only partly written: don't run it, wait for the full text.
    const streaming = useIsStreaming();
    const script = props.script || "";
    const [html, setHtml] = useState("");
    useEffect(() => {
      if (streaming) return setHtml("");
      let live = true;
      loadAssets(detectNeeds(script))
        .then((a) => live && setHtml(buildSimHtml(script, a)))
        .catch(() => live && setHtml(buildSimHtml(script, { fontsCss: "" })));
      return () => {
        live = false;
      };
    }, [script, streaming]);
    // The page inside the iframe posts "simReady" once its script starts. If it never does (the iframe loaded
    // blank), rebuild the iframe, up to 3 times.
    const frameRef = useRef<HTMLIFrameElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    // Create the iframe only when it is about to be on screen: frames created offscreen start throttled and
    // take seconds to begin rendering once scrolled into view.
    const [near, setNear] = useState(false);
    useEffect(() => {
      const el = wrapRef.current;
      if (!el || near) return;
      const io = new IntersectionObserver(([en]) => en.isIntersecting && setNear(true), { rootMargin: "250px" });
      io.observe(el);
      return () => io.disconnect();
    }, [near]);
    const [nonce, setNonce] = useState(0);
    const [failed, setFailed] = useState(false);
    const [drawn, setDrawn] = useState(false);
    const [contentH, setContentH] = useState<number | null>(null);
    useEffect(() => {
      if (streaming || !html || !near) return;
      let ready = false;
      setDrawn(false);
      const onMsg = (e: MessageEvent) => {
        if (e.source !== frameRef.current?.contentWindow) return;
        if (e.data?.simReady) {
          ready = true;
          // the first animation frame can be delayed in background tabs; don't keep the loader up for it
          setTimeout(() => setDrawn(true), 1400);
        }
        if (e.data?.simFrame) setDrawn(true);
        if (typeof e.data?.simH === "number") setContentH(Math.min(1600, Math.ceil(e.data.simH) + 6));
      };
      window.addEventListener("message", onMsg);
      const t = setTimeout(() => {
        if (ready) return;
        console.warn("SimCanvas iframe never reported ready; rebuilding", nonce);
        if (nonce < 3) setNonce((n) => n + 1);
        else setFailed(true);
      }, 2500);
      return () => {
        window.removeEventListener("message", onMsg);
        clearTimeout(t);
      };
    }, [streaming, html, nonce, near]);

    // Nudge a repaint once the iframe has loaded (freshly created sandboxed frames can stay unpainted).
    const repaint = (f: HTMLIFrameElement | null) => {
      if (!f) return;
      requestAnimationFrame(() => {
        f.style.visibility = "hidden";
        void f.offsetHeight;
        f.style.visibility = "";
      });
    };
    return (
      <div ref={wrapRef} className="sim-canvas relative w-full glass rounded-3xl overflow-hidden my-2">
        {streaming || (near && !html) ? (
          <div style={{ height: props.height || 720, color: "var(--mute)" }} className="flex items-center justify-center gap-2 text-xs">
            <Loader2 className="w-4 h-4 animate-spin" /> Building the simulation…
          </div>
        ) : !near ? (
          <div style={{ height: contentH || props.height || 720 }} />
        ) : (
          <iframe
            key={nonce}
            ref={frameRef}
            onLoad={(e) => repaint(e.currentTarget)}
            title={props.title}
            srcDoc={html}
            sandbox="allow-scripts"
            style={{ height: contentH || props.height || 720, border: 0, background: "transparent" }}
            className="w-full"
          />
        )}
        {!streaming && html && near && !drawn && !failed && (
          <div className="absolute inset-x-0 bottom-0 top-[64px] flex items-center justify-center gap-2 text-xs pointer-events-none" style={{ color: "var(--mute)", background: "rgba(240,249,255,0.92)" }}>
            <Loader2 className="w-4 h-4 animate-spin" /> Starting the simulation…
          </div>
        )}
        <div className="px-5 py-3.5 text-xs" style={{ background: "linear-gradient(120deg, rgba(212,236,255,0.75), rgba(255,255,255,0.5))", borderTop: "1px solid rgba(255,255,255,0.9)" }}>
          <div className="text-[15px] font-bold tracking-tight" style={{ color: "var(--ink)" }}>{props.title}</div>
          <div className="mt-0.5" style={{ color: "var(--mute)" }}>{props.caption}</div>
        </div>
        {failed && <div className="px-4 py-2 text-xs" style={{ color: "#be123c", background: "rgba(255,241,242,0.9)" }}>The simulation could not start. Search again to retry.</div>}
      </div>
    );
  },
});
