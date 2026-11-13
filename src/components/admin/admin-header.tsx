export function AdminHeader({ title, lede, actions }: { title: string; lede?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="pb-6 border-b border-line mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="display-md">{title}</h1>{lede && <p className="mt-2 text-sm text-muted max-w-prose">{lede}</p>}</div>
      {actions}
    </header>
  );
}
export function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return <div className="border-t border-line pt-3"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 font-display text-d-sm num">{value}</dd>{note && <p className="text-2xs text-muted mt-0.5">{note}</p>}</div>;
}
