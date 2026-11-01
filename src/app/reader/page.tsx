"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ArrowLeft, FileUp, Loader2, Sparkles, X, AlertTriangle } from "lucide-react";
import { PdfReader } from "@/components/PdfReader";
import { ResultView } from "@/components/ResultView";

interface BookMeta {
  id: string;
  name: string;
  stem: string;
  pages: number;
  aspects: number[];
}

const STOP = new Set(["com", "compressed", "pdf", "class", "secondary", "bv", "2026", "ev"]);
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));

/** Identify which stored book a PDF is, by page count + page shape. Returns [] when nothing matches. */
async function matchBooks(pdf: PDFDocumentProxy, fileName: string, books: BookMeta[]): Promise<BookMeta[]> {
  const sameCount = books.filter((b) => b.pages === pdf.numPages);
  if (!sameCount.length) return [];
  const samples = [2, 3, 5, 8, 13, 21].filter((n) => n <= pdf.numPages);
  const shapes: number[] = [];
  for (const n of samples) {
    const v = (await pdf.getPage(n)).getViewport({ scale: 1 });
    shapes.push(v.width / v.height);
  }
  const verified = sameCount.filter((b) => {
    const ok = samples.filter((n, i) => Math.abs((b.aspects[n - 1] ?? 0) - shapes[i]) / shapes[i] < 0.05).length;
    return ok >= Math.ceil(samples.length * 0.7);
  });
  const fileTokens = new Set(tokens(fileName));
  return verified
    .map((b) => ({ b, score: tokens(b.stem).filter((t) => fileTokens.has(t)).length }))
    .sort((a, z) => z.score - a.score)
    .map((x) => x.b);
}

export default function Reader() {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [book, setBook] = useState<BookMeta | null>(null);
  const [choices, setChoices] = useState<BookMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const [popup, setPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const [panelQuery, setPanelQuery] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const observed = useRef<HTMLDivElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const pendingPdf = useRef<PDFDocumentProxy | null>(null);
  const pageWidthRef = useRef(0);
  const scrollFrac = useRef<number | null>(null);

  useLayoutEffect(() => {
    pageWidthRef.current = pageWidth;
    const el = scrollRef.current;
    if (el && scrollFrac.current !== null) {
      el.scrollTop = scrollFrac.current * el.scrollHeight;
      scrollFrac.current = null;
    }
  }, [pageWidth]);

  useEffect(() => {
    fetch("/api/ocr/books").then((r) => r.json()).then(setBooks).catch(() => setError("Could not load the book index."));
  }, []);

  // page width follows the scroll container (it shrinks when the simulation panel opens).
  // Runs after every render so it re-attaches whenever the container element is (re)created.
  useEffect(() => {
    const el = scrollRef.current;
    if (el === observed.current) return;
    observer.current?.disconnect();
    observed.current = el;
    if (!el) return;
    const measure = () => {
      const next = Math.min(900, Math.max(280, el.clientWidth - 32));
      if (next === pageWidthRef.current) return;
      // remember the reading position so it can be restored once the pages are resized
      if (el.scrollHeight > el.clientHeight) scrollFrac.current = el.scrollTop / el.scrollHeight;
      setPageWidth(next);
    };
    measure();
    observer.current = new ResizeObserver(measure);
    observer.current.observe(el);
  });
  useEffect(() => () => observer.current?.disconnect(), []);

  const onFile = async (file: File) => {
    setError(null);
    setPdf(null);
    setBook(null);
    setChoices([]);
    setPanelQuery("");
    setLoading(true);
    setFileName(file.name);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      const found = await matchBooks(doc, file.name, books);
      if (!found.length) {
        setError("No books matched. This PDF is not one of the supported textbooks, so it can't be opened here.");
        doc.destroy();
        return;
      }
      if (found.length > 1) {
        pendingPdf.current = doc;
        setChoices(found);
        return;
      }
      setPdf(doc);
      setBook(found[0]);
    } catch (e) {
      setError(`Could not open this PDF: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const pick = (b: BookMeta) => {
    setPdf(pendingPdf.current);
    setBook(b);
    setChoices([]);
  };

  // show a "Simulate" button over the highlighted text
  const onSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return setPopup(null);
    const common = sel.getRangeAt(0).commonAncestorContainer;
    const node = common instanceof Element ? common : common.parentElement;
    if (!node?.closest("[data-textlayer]")) return setPopup(null);
    const text = sel.toString().replace(/\s+/g, " ").trim();
    if (text.length < 2) return setPopup(null);
    const r = sel.getRangeAt(0).getBoundingClientRect();
    setPopup({ x: r.left + r.width / 2, y: r.top < 56 ? r.bottom + 8 : r.top - 44, text: text.slice(0, 400) });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, [onSelection]);

  const simulate = () => {
    if (!popup) return;
    setPanelQuery(popup.text);
    setPopup(null);
    window.getSelection()?.removeAllRanges();
  };

  // ---------- upload screen ----------
  if (!pdf) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center px-4 py-12">
        <div className="w-full max-w-xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white mb-6">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to search
          </Link>
          <h1 className="text-3xl font-black tracking-tight mb-1">Simuplug Reader</h1>
          <p className="text-sm text-slate-400 mb-6">
            Upload a textbook PDF from NCTB. Highlight any word or sentence and click <b>Simulate</b>.
          </p>

          <label className="flex flex-col items-center justify-center gap-2 p-10 rounded-3xl border-2 border-dashed border-slate-700 hover:border-indigo-500 bg-slate-900/50 cursor-pointer transition">
            {loading ? <Loader2 className="w-6 h-6 animate-spin text-indigo-400" /> : <FileUp className="w-6 h-6 text-indigo-400" />}
            <span className="text-sm font-semibold">{loading ? "Opening…" : "Choose a PDF"}</span>
            <span className="text-xs text-slate-500">{fileName || "Only the supported class 9–10 textbooks"}</span>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              disabled={loading || !books.length}
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </label>

          {error && (
            <div className="mt-5 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {choices.length > 1 && (
            <div className="mt-5 p-4 rounded-2xl bg-slate-900 border border-slate-700">
              <p className="text-sm mb-3">This PDF fits more than one book. Which one is it?</p>
              <div className="flex gap-2 flex-wrap">
                {choices.map((b) => (
                  <button key={b.id} onClick={() => pick(b)} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold">
                    {b.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // ---------- reader ----------
  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="text-sm font-semibold truncate">{book?.name}</div>
          <div className="text-[11px] text-slate-500 hidden sm:block">Highlight text → Simulate</div>
        </div>
        <label className="text-xs text-indigo-300 hover:text-indigo-200 cursor-pointer underline">
          Open another PDF
          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      </header>

      <div className="flex-1 flex min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-800/60">
          {pageWidth > 0 && book && <PdfReader pdf={pdf} bookId={book.id} width={pageWidth} />}
        </div>

        {panelQuery && (
          <aside className="w-full sm:w-[540px] shrink-0 border-l border-slate-800 bg-slate-950 flex flex-col absolute sm:static inset-0 top-[49px] z-30">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900 shrink-0">
              <span className="text-xs font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" /> Simulation
              </span>
              <button onClick={() => setPanelQuery("")} className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <ResultView query={panelQuery} book={book?.name} onPickRelated={setPanelQuery} />
            </div>
          </aside>
        )}
      </div>

      {popup && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={simulate}
          style={{ position: "fixed", left: popup.x, top: popup.y, transform: "translateX(-50%)" }}
          className="z-50 flex items-center gap-1.5 px-3 py-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-xl border border-indigo-400/40"
        >
          <Sparkles className="w-3.5 h-3.5" /> Simulate
        </button>
      )}
    </div>
  );
}
