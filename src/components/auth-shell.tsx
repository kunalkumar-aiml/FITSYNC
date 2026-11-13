import { Mark } from "./brand";

/** Shared frame for sign-in, sign-up and account-recovery screens. */
export function AuthShell({ title, lede, children, foot }: { title: string; lede?: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <div className="container-x py-12 sm:py-20">
      <div className="mx-auto max-w-[27rem]">
        <div className="text-ink"><Mark size={28} /></div>
        <h1 className="mt-6 display-md">{title}</h1>
        {lede && <p className="mt-3 text-muted">{lede}</p>}
        <div className="mt-8">{children}</div>
        {foot && <div className="mt-8 border-t border-line pt-6 text-sm text-muted">{foot}</div>}
      </div>
    </div>
  );
}
