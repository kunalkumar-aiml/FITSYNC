"use client";
import { motion } from "framer-motion";

/** A short, quiet cross-fade between pages. Disabled automatically for reduced-motion users. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}
