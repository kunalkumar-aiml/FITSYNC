import Link from "next/link";

/** The mark: three tape-measure graduations, the middle one marked. Original artwork. */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none">
      <rect x="1.5" y="1.5" width="21" height="21" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 6v6M12 6v11M17 6v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <circle cx="12" cy="18.4" r="1.6" fill="rgb(var(--accent))" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-ink" aria-label="FITSYNC home">
      <Mark />
      <span className="text-[0.95rem] font-semibold tracking-[0.18em]">FITSYNC</span>
    </Link>
  );
}
