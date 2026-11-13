import Link from "next/link";
import { Logo } from "./brand";

export function Footer({ signedIn }: { signedIn: boolean }) {
  return (
    <footer className="border-t border-line mt-24 hidden md:block print:hidden" aria-label="Footer">
      <div className="container-x py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr] text-sm">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-muted">One body. Every brand. The perfect fit. A sizing layer for the clothes you already shop for.</p>
        </div>
        <nav aria-label="Product" className="space-y-2.5">
          <p className="font-medium">Product</p>
          <Link className="block text-muted hover:text-ink" href="/brands">Brand explorer</Link>
          <Link className="block text-muted hover:text-ink" href={signedIn ? "/recommend" : "/signup"}>Find your size</Link>
          <Link className="block text-muted hover:text-ink" href={signedIn ? "/compare" : "/signup"}>Compare brands</Link>
        </nav>
        <nav aria-label="Trust" className="space-y-2.5">
          <p className="font-medium">Trust</p>
          <Link className="block text-muted hover:text-ink" href="/#data">How we source charts</Link>
          <Link className="block text-muted hover:text-ink" href="/privacy">Privacy notice</Link>
          <Link className="block text-muted hover:text-ink" href="/#faq">Questions</Link>
        </nav>
        <nav aria-label="Account" className="space-y-2.5">
          <p className="font-medium">Account</p>
          {signedIn ? (
            <>
              <Link className="block text-muted hover:text-ink" href="/dashboard">Dashboard</Link>
              <Link className="block text-muted hover:text-ink" href="/settings">Settings</Link>
            </>
          ) : (
            <>
              <Link className="block text-muted hover:text-ink" href="/login">Log in</Link>
              <Link className="block text-muted hover:text-ink" href="/signup">Create an account</Link>
            </>
          )}
        </nav>
      </div>
      <div className="container-x pb-10 text-xs text-muted flex flex-wrap justify-between gap-3">
        <span>© {new Date().getFullYear()} FITSYNC</span>
        <span>Size recommendations are estimates, not guarantees. Brand names belong to their owners; FITSYNC is not affiliated with them.</span>
      </div>
    </footer>
  );
}
