// src/components/PwaSplash.tsx
"use client";

import { useEffect, useState } from "react";
import LoadingLogo from "@/components/LoadingLogo";

/**
 * Splash saat aplikasi dibuka dari ikon PWA di layar utama HP.
 * Hanya tampil dalam mode "standalone" (dipasang sebagai app) —
 * di browser biasa tidak muncul sama sekali (diatur lewat media query CSS,
 * jadi tak ada kedipan sedetik pun).
 */
export default function PwaSplash() {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const finish = () => setTimeout(() => setGone(true), 650);
    if (document.readyState === "complete") {
      finish();
      return;
    }
    window.addEventListener("load", finish);
    return () => window.removeEventListener("load", finish);
  }, []);

  return (
    <div className={`pwa-splash ${gone ? "pwa-splash-gone" : ""}`} aria-hidden="true">
      <LoadingLogo size={76} withRing text="Invisual Portal" />

      <style>{`
        .pwa-splash {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #0a0a0a;
          align-items: center;
          justify-content: center;
          transition: opacity .55s ease, visibility .55s ease;
        }
        /* Hanya saat dibuka dari ikon PWA (bukan di tab browser) */
        @media (display-mode: standalone) {
          .pwa-splash { display: flex; }
        }
        @media (display-mode: fullscreen) {
          .pwa-splash { display: flex; }
        }
        .pwa-splash-gone {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
