"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ArrowLeft, FileUp, Loader2, Sparkles, X, AlertTriangle } from "lucide-react";
import { PdfReader } from "@/components/PdfReader";
import { MotionProvider, m, AnimatePresence, ease } from "@/components/Motion";
const ResultView = dynamic(() => import("@/components/ResultView").then((m) => m.ResultView), { ssr: false });

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

  // Start loading the book index and pdf.js immediately, but never block the file picker on them:
  // onFile awaits the same promise when a file is chosen.
  const booksPromise = useRef<Promise<BookMeta[]> | null>(null);
  const loadBooks = () =>
    (booksPromise.current ??= fetch("/api/ocr/books")
      .then((r) => r.json())
      .then((b: BookMeta[]) => {
        setBooks(b);
        return b;
      })
      .catch((e) => {
        booksPromise.current = null;
        throw e;
      }));
  useEffect(() => {
    loadBooks().catch(() => {});
    import("pdfjs-dist").catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const list = await loadBooks();
      const found = await matchBooks(doc, file.name, list);
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
      <MotionProvider>
        <main className="min-h-screen flex flex-col items-center px-4 py-12">
          <m.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease }} className="w-full max-w-xl">
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold mb-6 hover:underline" style={{ color: "var(--blue-deep)" }}>
              <ArrowLeft className="w-3.5 h-3.5" /> Back to search
            </Link>
            <h1 className="gradient-text text-4xl font-black tracking-tight mb-2">Simuplug Reader</h1>
            <p className="text-sm mb-7" style={{ color: "var(--mute)" }}>
              Upload a textbook PDF from NCTB. Highlight any word or sentence and click <b>Simulate</b>.
            </p>

            <m.label
              whileHover={{ y: -4 }}
              className="glass flex flex-col items-center justify-center gap-3 p-12 rounded-[28px] cursor-pointer"
              style={{ borderStyle: "dashed", borderWidth: 2, borderColor: "var(--ice-300)" }}
            >
              <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "linear-gradient(135deg,#60a5fa,#38bdf8)", boxShadow: "0 10px 26px rgba(56,189,248,0.45)" }}>
                {loading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : <FileUp className="w-6 h-6 text-white" />}
              </span>
              <span className="text-base font-bold" style={{ color: "var(--ink)" }}>{loading ? "Opening…" : "Choose a PDF"}</span>
              <span className="text-xs" style={{ color: "var(--mute)" }}>{fileName || "Only the supported textbooks"}</span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={loading}
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </m.label>

            <AnimatePresence>
              {error && (
                <m.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-5 p-4 rounded-2xl text-sm flex items-start gap-2"
                  style={{ background: "rgba(255,241,242,0.85)", border: "1px solid #fecdd3", color: "#be123c" }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                </m.div>
              )}
            </AnimatePresence>

            {choices.length > 1 && (
              <m.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass mt-5 p-5 rounded-2xl">
                <p className="text-sm mb-3 font-medium">This PDF fits more than one book. Which one is it?</p>
                <div className="flex gap-2 flex-wrap">
                  {choices.map((b) => (
                    <button key={b.id} onClick={() => pick(b)} className="btn-ice px-4 py-2 text-sm">
                      {b.name}
                    </button>
                  ))}
                </div>
              </m.div>
            )}
          </m.div>
        </main>
      </MotionProvider>
    );
  }

  // ---------- reader ----------
  return (
    <MotionProvider>
      <div className="h-screen flex flex-col">
        <header className="glass-strong flex items-center justify-between px-5 py-3 shrink-0 z-20" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="p-1.5 rounded-full hover:bg-white/70 transition" style={{ color: "var(--blue-deep)" }}>
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="text-sm font-bold truncate" style={{ color: "var(--ink)" }}>{book?.name}</div>
            <div className="chip hidden sm:inline-flex">Highlight text → Simulate</div>
          </div>
          <label className="btn-ice px-4 py-2 text-xs cursor-pointer">
            Open another PDF
            <input type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
        </header>

        <div className="flex-1 flex min-h-0 relative">
          <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ background: "linear-gradient(180deg, rgba(207,232,251,0.5), rgba(234,246,255,0.7))" }}>
            {pageWidth > 0 && book && <PdfReader pdf={pdf} bookId={book.id} width={pageWidth} />}
          </div>

          <AnimatePresence>
            {panelQuery && (
              <m.aside
                key="panel"
                initial={{ x: 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 60, opacity: 0 }}
                transition={{ duration: 0.45, ease }}
                className="glass-strong w-full sm:w-[560px] shrink-0 flex flex-col absolute sm:static inset-0 z-30"
                style={{ borderRadius: 0, borderTop: 0, borderBottom: 0, borderRight: 0 }}
              >
                <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid var(--glass-border)" }}>
                  <span className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--ink)" }}>
                    <Sparkles className="w-4 h-4" style={{ color: "var(--blue)" }} /> Simulation
                  </span>
                  <button onClick={() => setPanelQuery("")} className="p-1.5 rounded-full hover:bg-white/80 transition" style={{ color: "var(--mute)" }}>
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5">
                  <ResultView query={panelQuery} book={book?.name} onPickRelated={setPanelQuery} />
                </div>
              </m.aside>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {popup && (
            <m.button
              key="pop"
              initial={{ opacity: 0, scale: 0.7, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              onMouseDown={(e) => e.preventDefault()}
              onClick={simulate}
              style={{ position: "fixed", left: popup.x, top: popup.y, x: "-50%" }}
              className="btn-ice z-50 px-4 py-2 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5" /> Simulate
            </m.button>
          )}
        </AnimatePresence>
      </div>
    </MotionProvider>
  );
}
