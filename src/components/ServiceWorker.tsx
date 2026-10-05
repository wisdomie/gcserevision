"use client";

import { useEffect } from "react";

/** Registers the offline shell in production builds. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Without it the game still works; offline just shows the browser's own page
    });
  }, []);
  return null;
}
