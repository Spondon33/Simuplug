"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { defineComponent, useIsStreaming } from "@openuidev/react-lang";
import { Loader2 } from "lucide-react";
import { buildSimHtml } from "./sim-harness";
import { SIM_DESCRIPTION, simCanvasProps } from "./sim-schema";

export const SimCanvasComponent = defineComponent({
  name: "SimCanvas",
  description: SIM_DESCRIPTION,
  props: simCanvasProps,
  component: ({ props }) => {
    // While the page is still streaming, `script` is only partly written: don't run it, wait for the full text.
    const streaming = useIsStreaming();
    const html = useMemo(() => (streaming ? "" : buildSimHtml(props.script || "")), [props.script, streaming]);
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
    useEffect(() => {
      if (streaming || !html || !near) return;
      let ready = false;
      setDrawn(false);
      const onMsg = (e: MessageEvent) => {
        if (e.source !== frameRef.current?.contentWindow) return;
        if (e.data?.simReady) ready = true;
        if (e.data?.simFrame) setDrawn(true);
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
      <div ref={wrapRef} className="relative w-full bg-slate-900 border border-slate-700/60 rounded-2xl overflow-hidden shadow-lg">
        <div className="px-4 py-2.5 bg-slate-800/70 border-b border-slate-700/50 text-xs">
          <div className="font-semibold text-white">{props.title}</div>
          <div className="text-slate-400">{props.caption}</div>
        </div>
        {streaming ? (
          <div style={{ height: props.height || 660 }} className="flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-950">
            <Loader2 className="w-4 h-4 animate-spin" /> Building the simulation…
          </div>
        ) : !near ? (
          <div style={{ height: props.height || 660 }} className="bg-slate-950" />
        ) : (
          <iframe
            key={nonce}
            ref={frameRef}
            onLoad={(e) => repaint(e.currentTarget)}
            title={props.title}
            srcDoc={html}
            sandbox="allow-scripts"
            style={{ height: props.height || 660, border: 0 }}
            className="w-full bg-slate-950"
          />
        )}
        {!streaming && html && !drawn && !failed && (
          <div className="absolute inset-x-0 bottom-0 top-[52px] flex items-center justify-center gap-2 text-xs text-slate-400 bg-slate-950 pointer-events-none">
            <Loader2 className="w-4 h-4 animate-spin" /> Starting the simulation…
          </div>
        )}
        {failed && <div className="px-4 py-2 text-xs text-rose-300 bg-rose-950/40">The simulation could not start. Search again to retry.</div>}
      </div>
    );
  },
});
