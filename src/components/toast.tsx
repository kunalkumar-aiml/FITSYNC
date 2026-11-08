"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";

type Toast = { id: number; kind: "success" | "error"; text: string };
const Ctx = createContext<(kind: Toast["kind"], text: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed inset-x-0 bottom-24 md:bottom-6 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
        {items.map((t) => (
          <div key={t.id} role="status" className="pointer-events-auto card flex items-center gap-2.5 px-4 py-3 text-sm max-w-md">
            {t.kind === "success" ? <CheckCircle2 size={18} className="text-good shrink-0" /> : <AlertCircle size={18} className="text-bad shrink-0" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
