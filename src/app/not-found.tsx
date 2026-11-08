import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container-x py-24 max-w-md text-center">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted">That link doesn’t lead anywhere. Head back and try again.</p>
      <Link href="/" className="btn btn-primary mt-6">Go home</Link>
    </div>
  );
}
