import type { MetadataRoute } from "next";

/** Lets players add the game to their home screen (PLAN.md M8). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Past Paper Game",
    short_name: "Paper Game",
    description: "Practise GCSE Maths exam-style questions and compete with friends.",
    start_url: "/play",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#4f46e5",
    categories: ["education", "games"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
