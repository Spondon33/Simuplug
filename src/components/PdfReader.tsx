"use client";

import React, { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

type Word = [string, number, number, number, number];

interface PageProps {
  pdf: PDFDocumentProxy;
  bookId: string;
  pageNumber: number;
  width: number;
}

/** One PDF page: canvas image + invisible, selectable word layer positioned from the stored OCR boxes. */
const PdfPage: React.FC<PageProps> = ({ pdf, bookId, pageNumber, width }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [aspect, setAspect] = useState(1.3);
  const [words, setWords] = useState<Word[] | null>(null);

  // page height placeholder before rendering
  useEffect(() => {
    pdf.getPage(pageNumber).then((p) => {
      const v = p.getViewport({ scale: 1 });
      setAspect(v.height / v.width);
    });
  }, [pdf, pageNumber]);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !width) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = width / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const t = page.render({ canvasContext: canvas.getContext("2d")!, viewport });
      task = t;
      await t.promise.catch(() => {});
    })();
    if (!words) {
      fetch(`/api/ocr/${bookId}/${pageNumber}`)
        .then((r) => r.json())
        .then((d) => !cancelled && setWords(d.words))
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, width, pdf, pageNumber, bookId, words]);

  const height = width * aspect;

  return (
    <div
      ref={hostRef}
      data-page={pageNumber}
      className="relative mx-auto mb-4 bg-white shadow-lg"
      style={{ width, height }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {visible && words && <TextLayer words={words} width={width} height={height} />}
      <div className="absolute bottom-1 right-2 text-[10px] text-slate-400 select-none pointer-events-none">{pageNumber}</div>
    </div>
  );
};

let measureCtx: CanvasRenderingContext2D | null = null;

const TextLayer: React.FC<{ words: Word[]; width: number; height: number }> = React.memo(({ words, width, height }) => {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  return (
    <div data-textlayer className="absolute inset-0 overflow-hidden" style={{ lineHeight: 1 }}>
      {words.map(([text, x0, y0, x1, y1], i) => {
        const w = (x1 - x0) * width;
        const h = (y1 - y0) * height;
        const fontSize = Math.max(6, h * 0.9);
        measureCtx!.font = `${fontSize}px sans-serif`;
        const natural = measureCtx!.measureText(text).width || 1;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: x0 * width,
              top: y0 * height,
              height: h,
              fontSize,
              lineHeight: `${h}px`,
              fontFamily: "sans-serif",
              color: "transparent",
              whiteSpace: "pre",
              transformOrigin: "0 0",
              transform: `scaleX(${w / natural})`,
              cursor: "text",
            }}
          >
            {text + " "}
          </span>
        );
      })}
    </div>
  );
});
TextLayer.displayName = "TextLayer";

export const PdfReader: React.FC<{ pdf: PDFDocumentProxy; bookId: string; width: number }> = ({ pdf, bookId, width }) => (
  <div className="py-4">
    {Array.from({ length: pdf.numPages }, (_, i) => (
      <PdfPage key={i} pdf={pdf} bookId={bookId} pageNumber={i + 1} width={width} />
    ))}
  </div>
);
