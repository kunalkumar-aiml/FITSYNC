"use client";
import { useEffect } from "react";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[ui] route error", error.digest); }, [error]);
  return (
    <div className="container-x py-24 max-w-xl">
      <h1 className="display-md">This page didn’t load</h1>
      <p className="mt-4 text-muted">Something went wrong on our side. Your data is safe. Try again in a moment.{error.digest ? ` Reference: ${error.digest}.` : ""}</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-8">Try again</button>
    </div>
  );
}
