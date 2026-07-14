// src/components/PwaSetup.tsx
"use client";

import { useEffect } from "react";

export default function PwaSetup() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // PRODUKSI: aktifkan PWA seperti biasa.
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("Sistem Aplikasi Native (PWA) Berhasil Diaktifkan!", reg.scope))
        .catch((err) => console.error("PWA Gagal diaktifkan:", err));
      return;
    }

    // DEVELOPMENT: service worker mencegat request chunk/HMR Turbopack dan
    // memicu ChunkLoadError. Matikan + bersihkan sisa cache lamanya.
    navigator.serviceWorker.getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);

  return null;
}
