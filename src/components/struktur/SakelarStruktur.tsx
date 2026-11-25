// src/components/struktur/SakelarStruktur.tsx
// Pengaturan → sakelar "Struktur perusahaan untuk semua karyawan" (struktur.sql, kunci `struktur_terbuka`).
// MATI (bawaan): menu Struktur hanya untuk akun @invisual.studio (yang juga mengedit).
// NYALA: semua karyawan bisa melihat; edit tetap hanya @invisual.studio. Kartu hanya tampil untuk akun @invisual.studio.
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { emailStudio } from "@/lib/management/gerbang";
import { simpanSakelarStruktur, statusSakelarStruktur, type StatusSakelar } from "@/lib/struktur/struktur";
import { kabariStrukturBerubah } from "./useMenuStruktur";

export default function SakelarStruktur({ className = "" }: { className?: string }) {
  const [status, setStatus] = useState<StatusSakelar | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    let batal = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (batal || !emailStudio(data?.session?.user?.email)) return;
      const s = await statusSakelarStruktur(supabase);
      if (!batal) setStatus(s);
    })();
    return () => { batal = true; };
  }, []);

  if (!status) return null;
  const nyala = status.terpasang && status.terbuka;
  const ubah = async () => {
    setSibuk(true); setGalat("");
    const g = await simpanSakelarStruktur(supabase, !nyala);
    if (g) setGalat("Gagal menyimpan. Hanya akun HR (@invisual.studio) yang bisa mengubah sakelar ini.");
    else { setStatus({ ...status, terbuka: !nyala }); kabariStrukturBerubah(); }
    setSibuk(false);
  };

  return (
    <div className={`p-5 rounded-xl border border-white/10 bg-white/[0.03] ${className}`} data-sakelar-struktur>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">Struktur perusahaan untuk semua karyawan</h3>
          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
            Jika mati, menu <span className="text-tint font-bold">Struktur</span> beserta jobdesk, SOP, dan tugas rutin hanya terlihat oleh akun @invisual.studio, yang juga bisa mengeditnya.
            Jika nyala, semua karyawan bisa melihat. Yang mengedit tetap hanya akun @invisual.studio.
          </p>
        </div>
        <button type="button" role="switch" aria-checked={nyala} aria-label="Struktur perusahaan untuk semua karyawan" onClick={ubah} disabled={sibuk || !status.terpasang}
          className={`shrink-0 w-14 h-8 rounded-full border transition-colors relative ${nyala ? "bg-primer-terang border-primer" : "bg-white/10 border-white/20"} ${sibuk || !status.terpasang ? "opacity-50" : ""}`}>
          <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${nyala ? "left-7" : "left-1"}`}></span>
        </button>
      </div>
      {status.terpasang
        ? <p className={`text-[11px] font-bold mt-3 ${nyala ? "text-green-400" : "text-gray-500"}`}>{nyala ? "AKTIF — semua karyawan bisa melihat (edit tetap @invisual.studio)" : "MATI — hanya akun @invisual.studio"}</p>
        : <p className="text-[11px] font-bold mt-3 text-amber-300">Belum berlaku — jalankan struktur.sql di Supabase agar sakelar ini bisa dipakai.</p>}
      {galat && <p className="text-[11px] font-bold mt-2 text-red-400" role="alert">{galat}</p>}
    </div>
  );
}
