// src/components/PwaSetup.tsx
"use client";

import { useEffect } from "react";

export default function PwaSetup() {
  useEffect(() => {
    // Mengecek apakah browser mendukung Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("Sistem Aplikasi Native (PWA) Berhasil Diaktifkan!", reg.scope))
        .catch((err) => console.error("PWA Gagal diaktifkan:", err));
    }
  }, []);

  return null; // Tidak menampilkan UI apapun, bekerja secara gaib di belakang layar
}