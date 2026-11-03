"use client";

import React from "react";
import { LazyMotion, domAnimation } from "motion/react";

// Loads only the DOM animation features (small) so Motion doesn't bloat the first load.
export const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LazyMotion features={domAnimation} strict>
    {children}
  </LazyMotion>
);

export { m, AnimatePresence } from "motion/react";

export const ease = [0.22, 0.8, 0.22, 1] as const;
