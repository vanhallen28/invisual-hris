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

    // Bersihkan badge di ikon PWA setiap aplikasi dibuka/difokuskan.
    // Selain menghapus badge sistem, hitungan yang disimpan service
    // worker juga direset — kalau tidak, notifikasi berikutnya lanjut
    // dari angka lama, bukan mulai dari 1.
    const clear = () => {
      try { (navigator as any).clearAppBadge?.(); } catch { /* abaikan */ }
      try { navigator.serviceWorker?.controller?.postMessage({ type: "reset-badge" }); } catch { /* abaikan */ }
    };

    // Dulu pendengar visibilitychange dipasang sebagai fungsi anonim, jadi
    // TIDAK PERNAH bisa dilepas — pembersihannya hanya melepas 'focus'.
    // Diberi nama supaya benar-benar terlepas saat komponen dilepas.
    const saatTerlihat = () => {
      if (document.visibilityState === "visible") clear();
    };

    clear();
    window.addEventListener("focus", clear);
    document.addEventListener("visibilitychange", saatTerlihat);

    return () => {
      window.removeEventListener("focus", clear);
      document.removeEventListener("visibilitychange", saatTerlihat);
    };
  }, []);

  return null;
}
