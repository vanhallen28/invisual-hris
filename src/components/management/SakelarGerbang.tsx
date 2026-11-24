// src/components/management/SakelarGerbang.tsx
// Pengaturan → sakelar "Section Management untuk anggota" (management-gerbang.sql).
// MATI: Management & Pedoman hanya untuk akun @invisual.studio (tahap presentasi).
// NYALA: anggota Management (tab Anggota) bisa membuka Management, karyawan melihat Pedoman yang berlaku.
// Hanya tampil untuk akun @invisual.studio. Tulis ke tabel pengaturan (RLS: HR saja).
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { emailStudio, simpanGerbang, statusGerbang, type StatusGerbang } from "@/lib/management/gerbang";

export default function SakelarGerbang({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<StatusGerbang | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    let batal = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (batal || !emailStudio(data?.session?.user?.email)) return;
      const s = await statusGerbang(supabase);
      if (!batal) setStatus(s);
    })();
    return () => { batal = true; };
  }, []);

  if (!status) return null;
  const nyala = status.terpasang && status.terbuka;

  const ubah = async () => {
    setSibuk(true); setGalat("");
    const g = await simpanGerbang(supabase, !nyala);
    if (g) setGalat("Gagal menyimpan. Hanya akun HR (@invisual.studio) yang bisa mengubah sakelar ini.");
    else setStatus({ ...status, terbuka: !nyala });
    setSibuk(false);
  };

  return (
    <div className={`p-5 rounded-xl border border-white/10 bg-white/[0.03] ${className}`} data-sakelar-gerbang>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">Section Management untuk anggota</h3>
          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
            Jika mati, menu <span className="text-tint font-bold">Management</span> dan <span className="text-tint font-bold">Pedoman</span> hanya terlihat oleh akun @invisual.studio (untuk presentasi).
            Tambahkan tim di Management → Anggota, lalu nyalakan bila sudah siap: anggota Management bisa membuka Management, dan karyawan melihat Pedoman yang berlaku. Data tidak berubah saat sakelar diubah.
          </p>
        </div>
        <button type="button" role="switch" aria-checked={nyala} aria-label="Buka Section Management untuk anggota" onClick={ubah} disabled={sibuk || !status.terpasang}
          className={`shrink-0 w-14 h-8 rounded-full border transition-colors relative ${nyala ? "bg-primer-terang border-primer" : "bg-white/10 border-white/20"} ${sibuk || !status.terpasang ? "opacity-50" : ""}`}>
          <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${nyala ? "left-7" : "left-1"}`}></span>
        </button>
      </div>
      {status.terpasang
        ? <p className={`text-[11px] font-bold mt-3 ${nyala ? "text-green-400" : "text-gray-500"}`}>{nyala ? "AKTIF — terbuka untuk anggota Management & karyawan" : "MATI — hanya akun @invisual.studio"}</p>
        : <p className="text-[11px] font-bold mt-3 text-amber-300">Belum berlaku — jalankan management-gerbang.sql di Supabase agar sakelar ini bisa dipakai.</p>}
      {galat && <p className="text-[11px] font-bold mt-2 text-red-400" role="alert">{galat}</p>}
    </div>
  );
}
