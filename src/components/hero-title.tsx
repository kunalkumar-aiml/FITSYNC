"use client";
import { motion } from "framer-motion";

const LINES = ["Your body.", "Every brand.", "The right size."];

/** The page's one orchestrated motion: the three lines of the promise set in sequence. */
export function HeroTitle() {
  return (
    <h1 className="display-xl" aria-label="Your body. Every brand. The right size.">
      {LINES.map((l, i) => (
        <motion.span key={l} aria-hidden className="block" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 + i * 0.12, duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}>
          {l}
        </motion.span>
      ))}
    </h1>
  );
}
