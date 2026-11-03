import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Screenfit — TV size in AR",
    short_name: "Screenfit",
    description: "Preview any TV size in your room with AR, calibrated against the TV you already own.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#07080c",
    theme_color: "#07080c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
