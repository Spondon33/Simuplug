"use client";

import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Lightbulb, Loader2 } from "lucide-react";
import { SimulationCard, Match } from "@/components/SimulationCard";

/**
 * Search -> summary + ONE simulation for the best match, plus clickable related topics.
 * `book` (optional) restricts retrieval to one book, e.g. the one open in the PDF reader.
 */
export const ResultView: React.FC<{ query: string; book?: string | null; onPickRelated: (text: string) => void }> = ({
  query,
  book = null,
  onPickRelated,
}) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    if (!query.trim()) return;
    const id = ++runId.current;
    setSearching(true);
    setError(null);
    setMatches([]);
    setSummary("");
    (async () => {
      try {
        const r = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, k: 6, book }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Search failed");
        if (id !== runId.current) return;
        if (!d.matches.length) throw new Error("No matching section found.");
        setMatches(d.matches);
        setSearching(false);

        setSummarizing(true);
        const sr = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, chunkIds: [d.matches[0].chunkId] }),
        });
        const reader = sr.body!.getReader();
        const dec = new TextDecoder();
        let acc = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          if (id === runId.current) setSummary(acc);
        }
      } catch (err) {
        if (id === runId.current) setError((err as Error).message);
      } finally {
        if (id === runId.current) {
          setSearching(false);
          setSummarizing(false);
        }
      }
    })();
  }, [query, book]);

  const best = matches[0];
  const related = matches.slice(1);

  if (!query.trim()) return null;
  return (
    <div>
      {error && <div className="mb-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-sm">{error}</div>}

      {!error && (
        <section className="mb-6 p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-300 mb-2">
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="truncate">Summary for “{query.length > 80 ? query.slice(0, 80) + "…" : query}”</span>
            {(searching || summarizing) && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
          </div>
          <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">
            {summary || (searching || summarizing ? "Searching the books…" : "")}
          </p>
          {best && (
            <p className="text-[11px] text-slate-500 mt-3">
              Source: {best.book} §{best.section}
            </p>
          )}
        </section>
      )}

      {best && <SimulationCard key={`${query}-${best.chunkId}`} match={best} query={query} />}

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4" /> Related topics
          </h2>
          <div className="flex flex-wrap gap-2">
            {related.map((m) => (
              <button
                key={m.chunkId}
                onClick={() => onPickRelated(m.title.replace(/:$/, ""))}
                title={`${m.book} · §${m.section}`}
                className="px-3.5 py-2 rounded-full bg-slate-900 border border-slate-700 hover:border-indigo-500/70 hover:text-indigo-200 text-xs text-slate-300 transition"
              >
                {m.title.replace(/:$/, "")}
                {!book && <span className="ml-2 text-[10px] text-slate-500">{m.book}</span>}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
