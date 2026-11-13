export default function Loading() {
  return (
    <div className="container-x pt-14 space-y-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-14 w-2/3 max-w-lg" />
      <div className="skeleton h-5 w-1/2 max-w-md" />
      <div className="grid md:grid-cols-2 gap-6 pt-6"><div className="skeleton h-48" /><div className="skeleton h-48" /></div>
    </div>
  );
}
