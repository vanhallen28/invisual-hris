// src/components/InfoLibur.tsx
// Pita kecil di Dasbor & Absen karyawan (dan Dasbor HR, peran="hr"): "Hari ini libur: …" dan/atau
// "Libur berikutnya: Kam, 24 Des — Cuti bersama Natal" (≤ 90 hari ke depan).
// Tidak dirender bila tidak ada data (tabel hari_libur belum ada / tidak ada libur dekat).
// Hanya informasi — tombol absen tetap tersedia (yang masuk di hari libur tetap bisa absen).
"use client";

import { useEffect, useState } from "react";
import { CalendarHeart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { liburBerikutnya, liburPada, type HariLibur } from "@/lib/hariLibur";
import { muatPetaLibur } from "@/lib/hariLiburData";
import { isoDari, selisihHari, tambahHari } from "@/lib/rentangTanggal";
import { teksTanggal } from "@/lib/tanggalTampil";

export default function InfoLibur({ className = "", peran = "karyawan" }: { className?: string; peran?: "karyawan" | "hr" }) {
  const [info, setInfo] = useState<{ hariIni: HariLibur | null; berikut: HariLibur | null; hari: string } | null>(null);

  useEffect(() => {
    let batal = false;
    const hari = isoDari(new Date());
    muatPetaLibur(supabase, hari, tambahHari(hari, 90)).then((peta) => {
      if (batal) return;
      const hariIni = liburPada(hari, peta);
      const berikut = liburBerikutnya(tambahHari(hari, 1), peta);
      setInfo({ hariIni, berikut, hari });
    });
    return () => { batal = true; };
  }, []);

  if (!info || (!info.hariIni && !info.berikut)) return null;
  const sisa = info.berikut ? selisihHari(info.hari, info.berikut.tanggal) : 0;
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-3.5 py-2.5 text-xs ${info.hariIni ? "border-red-500/30 bg-red-500/10" : "border-white/10 bg-white/[0.03]"} ${className}`} data-info-libur role="note">
      <CalendarHeart className={`w-4 h-4 shrink-0 ${info.hariIni ? "text-red-300" : "text-gray-400"}`} aria-hidden />
      {info.hariIni && (
        <span className="text-red-200" data-libur-hari-ini>
          <b>Hari ini libur:</b> {info.hariIni.nama}. {peran === "hr" ? "Tidak dihitung alpa di heatmap Kehadiran." : "Masuk kerja hari ini tetap bisa absen."}
        </span>
      )}
      {info.berikut && (
        <span className="text-gray-300" data-libur-berikutnya={info.berikut.tanggal}>
          <b className="text-gray-200">Libur berikutnya:</b> {teksTanggal(info.berikut.tanggal, { tahun: false })} — {info.berikut.nama}
          <span className="text-gray-500"> · {sisa === 1 ? "besok" : `${sisa} hari lagi`}</span>
        </span>
      )}
    </div>
  );
}
