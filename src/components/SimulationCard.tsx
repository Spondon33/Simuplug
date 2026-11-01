"use client";

import React, { useEffect, useState } from "react";
import { Renderer } from "@openuidev/react-lang";
import { appLibrary } from "@/lib/openui/library";
import { Loader2, Database, Wand2, Code2, AlertTriangle, RotateCw } from "lucide-react";

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
              setMessage("Repairing the simulation…");
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

  return (
    <article className="rounded-3xl bg-slate-900/60 border border-slate-800 p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2 mb-4">
        <div>
          <div className="text-[11px] font-mono text-indigo-300">
            {index ? `[${index}] ` : ""}
            {match.book} · §{match.section}
          </div>
          <h3 className="text-base font-bold">{match.title}</h3>
          <div className="text-[11px] text-slate-500">
            {match.figures > 0 ? `${match.figures} figure${match.figures > 1 ? "s" : ""} used as reference` : "no figure — built from text"}
            {" · "}match {(match.score * 100).toFixed(0)}%
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "ready" && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border border-slate-700 text-slate-300">
              {cached ? <Database className="w-3 h-3 text-emerald-400" /> : <Wand2 className="w-3 h-3 text-amber-400" />}
              {cached ? "loaded from Neon" : "generated & stored"}
            </span>
          )}
          <button
            onClick={() => setShowCode((s) => !s)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300"
          >
            <Code2 className="w-3 h-3" /> OpenUI Lang
          </button>
        </div>
      </header>

      {status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> {message || "Designing the simulation from the book…"}
        </div>
      )}
      {status === "error" && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <div className="flex-1">{message}</div>
          <button onClick={() => setAttempt((a) => a + 1)} className="flex items-center gap-1 underline">
            <RotateCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}
      {(status === "streaming" || status === "ready") && code && (
        <div className="openui-app-container">
          <Renderer key={status === "ready" ? "final" : "stream"} response={code} library={appLibrary} isStreaming={status === "streaming"} onError={(e) => console.warn(e)} />
        </div>
      )}
      {showCode && (
        <pre className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 overflow-auto max-h-72 whitespace-pre-wrap break-all">
          {code || "// waiting…"}
        </pre>
      )}
    </article>
  );
};
