"use client";
import { MotionConfig } from "framer-motion";
import { ToastProvider } from "./toast";

/** Motion follows the visitor's "reduce motion" setting everywhere. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  );
}
