"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, Sparkles, Code2, FileText } from "lucide-react";
import { ResultView } from "@/components/ResultView";

export default function Home() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  const run = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setInput(q);
    setQuery(q);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-10">
        <header className="text-center mb-8">
          <div className="inline-flex items-center gap-2 text-indigo-400 text-xs font-mono mb-3">
            <Sparkles className="w-4 h-4" /> OpenUI Lang · RAG over your textbooks
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Simuplug</h1>
          <p className="text-sm text-slate-400 mt-2">
            Search any topic from the class 9–10 books. Get a short summary and an interactive simulation built from the book.
          </p>
          <Link href="/reader" className="inline-flex items-center gap-1.5 mt-4 text-xs text-indigo-300 hover:text-indigo-200 underline">
            <FileText className="w-3.5 h-3.5" /> Or upload a book PDF and simulate what you highlight
          </Link>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(input);
          }}
          className="flex gap-2 mb-8"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Newton's laws, photosynthesis, demand and supply…"
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl bg-slate-900 border border-slate-700 focus:border-indigo-500 outline-none text-sm"
            />
          </div>
          <button type="submit" className="px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold flex items-center gap-2">
            <Search className="w-4 h-4" /> Search
          </button>
        </form>

        <ResultView query={query} onPickRelated={run} />

        {!query && (
          <p className="text-center text-xs text-slate-600 mt-16 flex items-center justify-center gap-2">
            <Code2 className="w-3.5 h-3.5" /> Simulations are written in OpenUI Lang by Muse and stored in Neon for reuse.
          </p>
        )}
      </div>
    </main>
  );
}
