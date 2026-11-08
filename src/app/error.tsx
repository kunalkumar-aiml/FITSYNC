"use client";
import { useEffect } from "react";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[ui] route error", error.digest, error); }, [error]);
  return (
    <div className="container-x py-24 max-w-md text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted">We hit a problem loading this page. Your data is safe. Try again in a moment.</p>
      <button onClick={reset} className="btn btn-primary mt-6">Try again</button>
    </div>
  );
}
