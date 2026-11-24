// src/components/management/BannerPedoman.tsx
// Banner wajib baca Pedoman — tampil di kedua portal selama versi berlaku belum dikonfirmasi.
// Di aliran halaman (bukan overlay) → tidak menutupi Clock In; konfirmasi tidak memblokir apa pun.
// Tidak ada versi berlaku / tabel belum ada / sudah dikonfirmasi → tidak merender apa pun.
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { teksTanggalISO } from "@/lib/tanggalTampil";
import { sudahBaca } from "@/lib/management/pedoman";
import type { PeranManagement } from "@/lib/management/akses";
import { EVENT_PEDOMAN } from "./useMenuManagement";

export default function BannerPedoman({ portal, peran }: { portal: "admin" | "user"; peran: PeranManagement[] | null }) {
  const [versi, setVersi] = useState<{ id: string; versi: string; berlaku_mulai: string | null } | null>(null);
  const terpasang = peran !== null;

  useEffect(() => {
    if (!terpasang) return;                       // SQL belum dijalankan / disembunyikan darurat → tanpa banner
    let hidup = true;
    const periksa = async () => {
      const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      const uid = data?.user?.id;
      if (!uid) return;
      const { data: v, error } = await supabase.from("mgmt_pedoman_versi").select("id, versi, berlaku_mulai").eq("status", "berlaku").limit(1);
      const berlaku = !error && Array.isArray(v) ? v[0] || null : null;
      if (!berlaku) { if (hidup) setVersi(null); return; }
      const dibaca = await sudahBaca(supabase, berlaku.id, uid);
      if (hidup) setVersi(dibaca ? null : berlaku);
    };
    periksa();
    window.addEventListener(EVENT_PEDOMAN, periksa);
    return () => { hidup = false; window.removeEventListener(EVENT_PEDOMAN, periksa); };
  }, [terpasang]);

  if (!terpasang || !versi) return null;
  const tautan = portal === "admin" ? "/admin/management?tab=pedoman" : peran && peran.length > 0 ? "/user/management?tab=pedoman" : "/user/pedoman";
  return (
    <div role="status" data-banner-pedoman className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.07] px-4 py-3">
      <p className="text-sm text-gray-200 min-w-0">
        <span className="font-bold text-cyan-300">Pedoman {versi.versi}</span>
        {versi.berlaku_mulai ? <> berlaku mulai {teksTanggalISO(versi.berlaku_mulai)}</> : null} — Baca &amp; konfirmasi
      </p>
      <Link href={tautan} className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-gray-200 transition-colors">Baca sekarang</Link>
    </div>
  );
}
