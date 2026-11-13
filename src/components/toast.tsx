"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type Toast = { id: number; kind: "success" | "error"; text: string };
const Ctx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === "error" ? 7000 : 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed inset-x-0 bottom-24 lg:bottom-6 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div key={t.id} role={t.kind === "error" ? "alert" : "status"} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.18 }}
              className="pointer-events-auto flex items-center gap-2.5 rounded-md bg-ink text-paper px-4 py-3 text-sm max-w-md shadow-[0_8px_24px_-12px_rgb(0_0_0/0.35)]">
              {t.kind === "success" ? <CheckCircle2 size={17} strokeWidth={1.8} className="shrink-0 text-sage" aria-hidden /> : <AlertCircle size={17} strokeWidth={1.8} className="shrink-0 text-accent" aria-hidden />}
              <span>{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
