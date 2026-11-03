"use client";

import React, { useEffect, useState } from "react";
import { Renderer } from "@openuidev/react-lang";
import { ThemeProvider } from "@openuidev/react-ui";
import { appLibrary } from "@/lib/openui/library";
import { Loader2, Database, Wand2, Code2, AlertTriangle, RotateCw } from "lucide-react";
import { m, AnimatePresence, ease } from "@/components/Motion";

export interface Match {
  chunkId: number;
  book: string;
  chapter: string;
  section: string;
  title: string;
  excerpt: string;
  figures: number;
  hasSimulation: boolean;
  score: number;
}

type Status = "loading" | "streaming" | "ready" | "error";

// Ice-blue light theme for the OpenUI components (cards, steps, charts, callouts...).
const iceTheme = {
  background: "transparent",
  foreground: "rgba(255,255,255,0.6)",
  sunk: "rgba(212,236,255,0.55)",
  sunkLight: "rgba(234,246,255,0.7)",
  textNeutralPrimary: "#0f2742",
  textNeutralSecondary: "#3f5a76",
  textNeutralTertiary: "#6b84a0",
  textBrand: "#2563eb",
  defaultChartPalette: ["#3b82f6", "#14b8a6", "#f59e0b", "#f43f5e", "#8b5cf6", "#38bdf8"],
};

export const SimulationCard: React.FC<{ match: Match; query: string; index?: number }> = ({ match, query, index }) => {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("loading");
  const [cached, setCached] = useState(false);
  const [message, setMessage] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setCode("");
    setStatus("loading");
    setMessage("");
    (async () => {
      try {
        const r = await fetch("/api/simulation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chunkId: match.chunkId, query }),
          signal: ctrl.signal,
        });
        const reader = r.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line);
            if (ev.t === "cached") {
              setCached(true);
              setCode(ev.code);
              setStatus("ready");
            } else if (ev.t === "delta") {
              acc += ev.v;
              setCode(acc);
              setStatus("streaming");
            } else if (ev.t === "reset") {
              acc = "";
              setCode("");
              setStatus("loading");
              setMessage("Polishing the simulation…");
            } else if (ev.t === "final") {
              setCode(ev.code);
              setStatus("ready");
            } else if (ev.t === "error") {
              setMessage(ev.message);
              setStatus("error");
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setMessage((e as Error).message);
          setStatus("error");
        }
      }
    })();
    return () => ctrl.abort();
  }, [match.chunkId, query, attempt]);

  const hasSim = (status === "streaming" || status === "ready") && !!code;
  return (
    <m.article
      initial={{ opacity: 0, y: 26, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, delay: 0.1, ease }}
      className="glass rounded-[28px] p-4 sm:p-6 flex flex-col"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 mb-5" style={{ order: hasSim ? 3 : 0, marginTop: hasSim ? 20 : 0 }}>
        <div>
          <div className="chip mb-2">
            {index ? `[${index}] ` : ""}
            {match.book} · §{match.section}
          </div>
          <h3 className="text-xl font-bold tracking-tight" style={{ color: "var(--ink)" }}>
            {match.title.replace(/:$/, "")}
          </h3>
          <div className="text-[11px] mt-0.5" style={{ color: "var(--mute)" }}>
            {match.figures > 0 ? `${match.figures} figure${match.figures > 1 ? "s" : ""} used as reference` : "built from the section text"}
            {" · "}match {(match.score * 100).toFixed(0)}%
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {status === "ready" && (
              <m.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="chip"
                style={{ background: cached ? "rgba(209,250,229,0.8)" : "rgba(254,243,199,0.85)", color: cached ? "#047857" : "#b45309" }}
              >
                {cached ? <Database className="w-3 h-3" /> : <Wand2 className="w-3 h-3" />}
                {cached ? "loaded from Neon" : "generated & stored"}
              </m.span>
            )}
          </AnimatePresence>
          <button onClick={() => setShowCode((s) => !s)} className="chip" style={{ cursor: "pointer" }}>
            <Code2 className="w-3 h-3" /> OpenUI Lang
          </button>
        </div>
      </header>

      {status === "loading" && (
        <div className="py-14 flex flex-col items-center gap-4">
          <div className="relative w-14 h-14">
            <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(56,189,248,0.35)" }} />
            <span className="absolute inset-2 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#60a5fa,#38bdf8)" }}>
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--mute)" }}>
            {message || "Designing the simulation from the book…"}
          </p>
        </div>
      )}
      {status === "error" && (
        <div className="p-4 rounded-2xl text-sm flex items-start gap-2" style={{ background: "rgba(255,241,242,0.85)", border: "1px solid #fecdd3", color: "#be123c" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">{message}</div>
          <button onClick={() => setAttempt((a) => a + 1)} className="flex items-center gap-1 underline font-semibold">
            <RotateCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}
      {(status === "streaming" || status === "ready") && code && (
        <ThemeProvider mode="light" lightTheme={iceTheme}>
          <div className="openui-app-container" style={{ order: 1 }}>
            <Renderer
              key={status === "ready" ? "final" : "stream"}
              response={code}
              library={appLibrary}
              isStreaming={status === "streaming"}
              onError={(e) => console.warn(e)}
            />
          </div>
        </ThemeProvider>
      )}
      <AnimatePresence>
        {showCode && (
          <m.pre
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-4 rounded-2xl text-[11px] overflow-auto max-h-72 whitespace-pre-wrap break-all"
            style={{ background: "rgba(255,255,255,0.75)", border: "1px solid var(--glass-border)", color: "#1b3a5c" }}
          >
            {code || "// waiting…"}
          </m.pre>
        )}
      </AnimatePresence>
    </m.article>
  );
};
