// src/components/PwaSetup.tsx
"use client";

import { useEffect } from "react";

export default function PwaSetup() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Service worker kini PASIF (tak mencegat request), jadi aman didaftarkan
    // di development maupun produksi — dan dibutuhkan agar Push Notification jalan.
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.error("PWA gagal diaktifkan:", err));

    // Bersihkan badge di ikon PWA setiap aplikasi dibuka/difokuskan
    const clear = () => {
      try { (navigator as any).clearAppBadge?.(); } catch { /* abaikan */ }
    };
    clear();
    window.addEventListener("focus", clear);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") clear();
    });

    return () => window.removeEventListener("focus", clear);
  }, []);

  return null;
}
