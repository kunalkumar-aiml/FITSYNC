"use client";
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e) => console.error("SW registration failed", e));
    }
  }, []);
  return null;
}
