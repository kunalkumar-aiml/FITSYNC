export const metadata = { title: "Offline" };
export default function Offline() {
  return (
    <div className="container-x py-24 max-w-md text-center">
      <h1 className="text-2xl font-semibold">You’re offline</h1>
      <p className="mt-2 text-muted">FITSYNC needs a connection to load your measurements and size charts. Reconnect and try again.</p>
    </div>
  );
}
