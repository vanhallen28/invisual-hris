"use client";

import { useEffect } from "react";

/**
 * Menyalakan efek cahaya-mengikuti-kursor untuk SEMUA kartu berkelas
 * `kartu-glow` di seluruh aplikasi — cukup dipasang SEKALI di layout root.
 *
 * Memakai satu pendengar di tingkat dokumen (bukan per kartu), jadi
 * menambah kartu baru tak perlu kode tambahan: beri kelas `kartu-glow`, selesai.
 *
 * Murni tampilan: tidak menyimpan state, tidak menyentuh logika halaman.
 */
export default function GlowLayer() {
  useEffect(() => {
    // Perangkat sentuh tak punya kursor — lewati saja.
    if (typeof window !== "undefined" && !window.matchMedia("(hover: hover)").matches) return;

    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const kartu = target?.closest?.(".kartu-glow") as HTMLElement | null;
      if (!kartu) return;
      const r = kartu.getBoundingClientRect();
      kartu.style.setProperty("--mx", `${e.clientX - r.left}px`);
      kartu.style.setProperty("--my", `${e.clientY - r.top}px`);
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  return null;
}
