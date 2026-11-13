import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import "./globals.css";
import { getUser } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { Providers } from "@/components/providers";
import { PwaRegister } from "@/components/pwa-register";

// Self-hosted (SIL Open Font License, see src/app/fonts). No font service is contacted at build or run time.
const display = localFont({
  src: [{ path: "./fonts/InstrumentSerif-Regular.woff2", style: "normal", weight: "400" }, { path: "./fonts/InstrumentSerif-Italic.woff2", style: "italic", weight: "400" }],
  variable: "--font-display", display: "swap", fallback: ["Georgia", "Times New Roman", "serif"],
});
const sans = localFont({
  src: [{ path: "./fonts/InstrumentSans-Variable.woff2", style: "normal", weight: "400 700" }, { path: "./fonts/InstrumentSans-Variable-Italic.woff2", style: "italic", weight: "400 700" }],
  variable: "--font-sans", display: "swap", fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

export const metadata: Metadata = {
  title: { default: "FITSYNC: your body, every brand, the right size", template: "%s · FITSYNC" },
  description: "One personal fit profile. Better size recommendations across the brands you shop, with every source shown.",
  applicationName: "FITSYNC",
  appleWebApp: { capable: true, title: "FITSYNC", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F5F1E8" }, { media: "(prefers-color-scheme: dark)", color: "#1C1D18" }],
  width: "device-width", initialScale: 1, viewportFit: "cover",
};

const themeScript = `try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // A database outage should not take the public pages down with it.
  const user = await getUser().catch(() => null);
  return (
    <html lang="en-IN" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
      <head><script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-primary">Skip to content</a>
        <Providers>
          <Nav user={user ? { name: user.name, email: user.email, role: user.role } : null} />
          <main id="main" className="pb-safe">{children}</main>
          <Footer signedIn={!!user} />
        </Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
