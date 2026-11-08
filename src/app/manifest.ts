import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FITSYNC", short_name: "FITSYNC",
    description: "One body. Every brand. The perfect fit.",
    start_url: "/dashboard", scope: "/", display: "standalone", orientation: "portrait",
    background_color: "#FAF9F6", theme_color: "#171717", categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Find my size", url: "/recommend" }, { name: "Compare brands", url: "/compare" }],
  };
}
