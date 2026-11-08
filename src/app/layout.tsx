import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getUser } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { ToastProvider } from "@/components/toast";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: { default: "FITSYNC: one body, every brand, the right size", template: "%s · FITSYNC" },
  description: "Enter your measurements once. FITSYNC compares them with brand size charts and explains which size fits you.",
  applicationName: "FITSYNC",
  appleWebApp: { capable: true, title: "FITSYNC", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#FAF9F6" }, { media: "(prefers-color-scheme: dark)", color: "#171717" }],
  width: "device-width", initialScale: 1, viewportFit: "cover",
};

const themeScript = `try{var t=localStorage.getItem('theme');if(!t){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // A database outage should not take the public pages down with it.
  const user = await getUser().catch(() => null);
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <ToastProvider>
          <Nav user={user ? { name: user.name, email: user.email, role: user.role } : null} />
          <main id="main" className="pb-safe">{children}</main>
        </ToastProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
