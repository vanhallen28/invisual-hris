// src/app/user/pedoman/page.tsx — Pedoman untuk karyawan (baca & konfirmasi saja).
"use client";

import { Suspense } from "react";
import TabPedoman from "@/components/management/TabPedoman";

export default function HalamanPedoman() {
  return (
    <div className="space-y-5">
      <div className="p-6 rounded-xl border border-white/10 bg-white/[0.03]">
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">Pedoman</h1>
        <p className="mt-1 text-xs text-gray-500">Aturan main yang berlaku di Invisual. Baca sampai akhir lalu konfirmasi setiap ada versi baru.</p>
      </div>
      <Suspense fallback={null}><TabPedoman peran={[]} divisi={[]} bacaSaja /></Suspense>
    </div>
  );
}
