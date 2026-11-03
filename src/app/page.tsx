"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Search, Sparkles, FileText, ArrowRight } from "lucide-react";
import { MotionProvider, m, ease } from "@/components/Motion";
import { FloatingBooks } from "@/components/FloatingBooks";

// The OpenUI renderer is ~700 kB: load it after the page is interactive, not before.
const loadResultView = () => import("@/components/ResultView").then((mod) => mod.ResultView);
const ResultView = dynamic(loadResultView, { ssr: false });

const rise = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease },
});

export default function Home() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  // After first paint: preload the renderer and warm the book index (wakes the database) for the reader.
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    const warm = () => {
      loadResultView();
      fetch("/api/ocr/books").catch(() => {});
    };
    if (idle) idle(warm);
    else setTimeout(warm, 1500);
  }, []);

  const run = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setInput(q);
    setQuery(q);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const searching = !!query;

  return (
    <MotionProvider>
      <FloatingBooks />
      <main className="relative z-10 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 sm:px-8">
          <section
            className={`text-center ${searching ? "pt-8 pb-6" : "pt-[22vh] pb-8"}`}
            style={{ transition: "padding 0.6s cubic-bezier(0.22,0.8,0.22,1)" }}
          >
            <m.div {...rise(0)} className="chip mb-5">
              <Sparkles className="w-3.5 h-3.5" /> OpenUI Lang · RAG over your textbooks
            </m.div>
            <m.h1 {...rise(0.08)} className={`gradient-text center font-black tracking-tight ${searching ? "text-4xl" : "text-6xl sm:text-7xl"}`}>
              Simuplug
            </m.h1>
            {!searching && (
              <m.p {...rise(0.16)} className="mt-4 text-base sm:text-lg max-w-xl mx-auto" style={{ color: "var(--mute)" }}>
                Search any topic from your textbooks. Get a short summary and an interactive simulation built from the book.
              </m.p>
            )}

            <m.form
              {...rise(0.24)}
              onSubmit={(e) => {
                e.preventDefault();
                run(input);
              }}
              className="glass-strong mt-8 flex items-center gap-2 p-2 pl-5 rounded-full max-w-2xl mx-auto focus-within:shadow-[0_0_0_4px_rgba(56,189,248,0.25),0_18px_50px_rgba(59,130,246,0.22)] transition-shadow duration-300"
            >
              <Search className="w-5 h-5 shrink-0" style={{ color: "var(--blue)" }} />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Newton's laws, photosynthesis, demand and supply…"
                className="flex-1 bg-transparent outline-none text-[15px] py-2.5 placeholder:text-[#7d93aa]"
                style={{ color: "var(--ink)" }}
              />
              <button type="submit" className="btn-ice px-6 py-3 text-sm">
                Search <ArrowRight className="w-4 h-4" />
              </button>
            </m.form>

            {/* always visible, also while a simulation is on screen */}
            <m.div {...rise(0.34)} className={searching ? "mt-4" : "mt-6"}>
              <Link href="/reader" className="glass glass-hover inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold" style={{ color: "var(--blue-deep)" }}>
                <FileText className="w-4 h-4" /> Upload a book PDF and simulate what you highlight
              </Link>
            </m.div>
          </section>

          <ResultView query={query} onPickRelated={run} />
          <div className="h-24" />
        </div>
      </main>
    </MotionProvider>
  );
}
