"use client";

import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Lightbulb, Loader2 } from "lucide-react";
import { SimulationCard, Match } from "@/components/SimulationCard";
import { m, AnimatePresence, ease } from "@/components/Motion";

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
      <AnimatePresence>
        {error && (
          <m.div
            key="err"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6 p-4 rounded-2xl text-sm"
            style={{ background: "rgba(255,241,242,0.85)", border: "1px solid #fecdd3", color: "#be123c" }}
          >
            {error}
          </m.div>
        )}
      </AnimatePresence>

      {!error && (
        <m.section
          key={query}
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease }}
          className="glass rounded-3xl p-6 mb-6"
        >
          <div className="flex items-center gap-2 text-xs font-semibold mb-3" style={{ color: "var(--blue-deep)" }}>
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="truncate">Summary for “{query.length > 80 ? query.slice(0, 80) + "…" : query}”</span>
            {(searching || summarizing) && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
          </div>
          {summary ? (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: "#16324f" }}>
              {summary.replace(/\$([^$\n]+)\$/g, "$1")}
            </p>
          ) : (
            <div className="space-y-2.5">
              <div className="shimmer h-4 w-full" />
              <div className="shimmer h-4 w-11/12" />
              <div className="shimmer h-4 w-8/12" />
            </div>
          )}
          {best && (
            <m.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[11px] mt-4" style={{ color: "var(--mute)" }}>
              Source: {best.book} · §{best.section}
            </m.p>
          )}
        </m.section>
      )}

      {best && <SimulationCard key={`${query}-${best.chunkId}`} match={best} query={query} />}

      {related.length > 0 && (
        <m.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2, ease }} className="mt-10">
          <h2 className="text-xs font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--mute)" }}>
            <Lightbulb className="w-4 h-4" /> Related topics
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {related.map((r, i) => (
              <m.button
                key={r.chunkId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.06, duration: 0.45, ease }}
                whileHover={{ y: -3, scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onPickRelated(r.title.replace(/:$/, ""))}
                title={`${r.book} · §${r.section}`}
                className="glass rounded-full px-4 py-2 text-[13px] font-medium"
                style={{ color: "#16324f" }}
              >
                {r.title.replace(/:$/, "")}
                {!book && (
                  <span className="ml-2 text-[10px]" style={{ color: "var(--mute)" }}>
                    {r.book}
                  </span>
                )}
              </m.button>
            ))}
          </div>
        </m.section>
      )}
    </div>
  );
};
