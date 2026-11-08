export default function Loading() {
  return (
    <div className="container-x py-12 space-y-4" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-10 w-64" /><div className="skeleton h-40" /><div className="skeleton h-40" />
    </div>
  );
}
