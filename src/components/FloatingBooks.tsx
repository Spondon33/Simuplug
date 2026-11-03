"use client";

import React, { useEffect, useRef } from "react";

type Tone = "ice" | "white" | "blue" | "sky";

interface BookSpec {
  x: string; y: string; s: number; r: number; dx: number; dy: number; dr: number;
  dur: number; delay: number; depth: number; blur: number; op: number; tone: Tone;
}

// Hand-placed (not random) so server and client render identically.
const BOOKS: BookSpec[] = [
  { x: "4%", y: "8%", s: 120, r: -14, dx: 18, dy: 26, dr: 6, dur: 13, delay: -2, depth: 26, blur: 0, op: 0.95, tone: "white" },
  { x: "16%", y: "58%", s: 84, r: 12, dx: -14, dy: -22, dr: -8, dur: 16, delay: -7, depth: 14, blur: 1.5, op: 0.8, tone: "ice" },
  { x: "30%", y: "16%", s: 64, r: 22, dx: 10, dy: 20, dr: 10, dur: 18, delay: -4, depth: 8, blur: 3, op: 0.6, tone: "sky" },
  { x: "9%", y: "82%", s: 150, r: 8, dx: 22, dy: -18, dr: -5, dur: 15, delay: -9, depth: 34, blur: 0, op: 1, tone: "blue" },
  { x: "42%", y: "74%", s: 70, r: -20, dx: -12, dy: 16, dr: 9, dur: 19, delay: -1, depth: 10, blur: 2.5, op: 0.65, tone: "white" },
  { x: "58%", y: "6%", s: 96, r: 16, dx: 16, dy: 24, dr: -7, dur: 14, delay: -6, depth: 20, blur: 1, op: 0.85, tone: "ice" },
  { x: "70%", y: "70%", s: 130, r: -10, dx: -20, dy: -24, dr: 6, dur: 17, delay: -3, depth: 30, blur: 0, op: 0.95, tone: "white" },
  { x: "82%", y: "18%", s: 110, r: 18, dx: 14, dy: 22, dr: -9, dur: 15, delay: -8, depth: 24, blur: 0.5, op: 0.9, tone: "sky" },
  { x: "91%", y: "52%", s: 78, r: -16, dx: -10, dy: 18, dr: 8, dur: 20, delay: -5, depth: 12, blur: 2, op: 0.7, tone: "blue" },
  { x: "50%", y: "40%", s: 56, r: 30, dx: 12, dy: -14, dr: 12, dur: 22, delay: -11, depth: 6, blur: 4, op: 0.5, tone: "ice" },
  { x: "24%", y: "36%", s: 52, r: -26, dx: -8, dy: 12, dr: -10, dur: 21, delay: -13, depth: 5, blur: 4, op: 0.45, tone: "white" },
  { x: "76%", y: "88%", s: 62, r: 14, dx: 10, dy: -16, dr: 7, dur: 18, delay: -10, depth: 8, blur: 3, op: 0.55, tone: "ice" },
  { x: "62%", y: "30%", s: 46, r: -8, dx: -9, dy: 10, dr: 9, dur: 24, delay: -14, depth: 4, blur: 5, op: 0.4, tone: "sky" },
  { x: "36%", y: "90%", s: 58, r: 20, dx: 9, dy: -12, dr: -6, dur: 23, delay: -12, depth: 6, blur: 4, op: 0.45, tone: "white" },
];

const GRADIENTS: Record<Tone, [string, string, string]> = {
  ice: ["#d9efff", "#8ccbf7", "#5aa9e6"],
  white: ["#ffffff", "#e4f2ff", "#bcdcf6"],
  blue: ["#7fb2ff", "#4a8df6", "#2f6fe0"],
  sky: ["#bdeaff", "#5ccbfa", "#2fb0ec"],
};

const Book: React.FC<{ tone: Tone; id: string }> = ({ tone, id }) => {
  const [a, b, c] = GRADIENTS[tone];
  const dark = tone === "white" ? "#6aa9dc" : "rgba(255,255,255,0.75)";
  return (
    <svg viewBox="0 0 100 130" width="100%" aria-hidden>
      <defs>
        <linearGradient id={`c${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={a} />
          <stop offset="0.55" stopColor={b} />
          <stop offset="1" stopColor={c} />
        </linearGradient>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.65" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="9" y="7" width="86" height="118" rx="5" fill="#fff" stroke="#cfe6f8" />
      <rect x="12" y="10" width="80" height="112" rx="4" fill="#f3f9ff" />
      <rect x="4" y="2" width="86" height="118" rx="7" fill={`url(#c${id})`} />
      <rect x="4" y="2" width="13" height="118" rx="7" fill="rgba(15,39,66,0.16)" />
      <rect x="15" y="4" width="1.6" height="114" fill="rgba(255,255,255,0.5)" />
      <rect x="27" y="26" width="52" height="9" rx="4.5" fill={dark} />
      <rect x="27" y="42" width="38" height="5" rx="2.5" fill={dark} opacity="0.7" />
      <circle cx="53" cy="84" r="17" fill="none" stroke={dark} strokeWidth="2.2" opacity="0.85" />
      <path d="M45 84 l6 6 l11 -13" fill="none" stroke={dark} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
      <rect x="4" y="2" width="86" height="118" rx="7" fill={`url(#g${id})`} />
    </svg>
  );
};

/** Slowly drifting books behind the home page, with a gentle mouse parallax (CSS variables, no re-renders). */
export const FloatingBooks: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) => {
      el.style.setProperty("--mx", String((e.clientX / window.innerWidth - 0.5) * -1));
      el.style.setProperty("--my", String((e.clientY / window.innerHeight - 0.5) * -1));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div ref={ref} className="books-layer" aria-hidden>
      {BOOKS.map((b, i) => (
        <div
          key={i}
          className="book-par"
          style={{ "--x": b.x, "--y": b.y, "--s": `${b.s}px`, "--depth": b.depth } as React.CSSProperties}
        >
          <div
            className="book-float"
            style={
              {
                "--r": `${b.r}deg`, "--dx": `${b.dx}px`, "--dy": `${b.dy}px`, "--dr": `${b.dr}deg`,
                "--dur": `${b.dur}s`, "--delay": `${b.delay}s`, "--blur": `${b.blur}px`, "--op": b.op,
              } as React.CSSProperties
            }
          >
            <Book tone={b.tone} id={String(i)} />
          </div>
        </div>
      ))}
    </div>
  );
};
