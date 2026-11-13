import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container-x py-24 max-w-xl">
      <h1 className="display-md">We couldn’t find that page</h1>
      <p className="mt-4 text-muted">The link may be old, or the brand may no longer be listed.</p>
      <div className="mt-8 flex gap-3"><Link href="/" className="btn btn-primary">Go to the home page</Link><Link href="/brands" className="btn btn-ghost">Browse brands</Link></div>
    </div>
  );
}
