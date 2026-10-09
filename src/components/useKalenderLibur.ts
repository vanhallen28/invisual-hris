// src/components/useKalenderLibur.ts
// Logika bersama kalender tanggal merah di kepala Dasbor HR — dipakai tampilan Neo-Brutal
// (brutal/KalenderLiburNB) dan tema gelap (KalenderLiburGelap). Data dari tabel `hari_libur`
// (muatHariLibur, simpanan 60 dtk), dimuat per bulan hanya saat kalender dibuka. Baca saja.
"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { muatHariLibur } from "@/lib/hariLiburData";
import type { HariLibur } from "@/lib/hariLibur";
import { gridBulan, tanggalDari } from "@/lib/rentangTanggal";

export const HARI_KALENDER = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function useKalenderLibur(todayISO: string) {
  const [buka, setBuka] = useState(false);
  const t0 = tanggalDari(todayISO);
  const [bulan, setBulan] = useState({ y: t0.getFullYear(), m: t0.getMonth() });
  const [libur, setLibur] = useState<Record<string, HariLibur[]>>({});   // kunci "y-m" → daftar tanggal libur
  const panel = useRef<HTMLDivElement>(null);
  const tombol = useRef<HTMLButtonElement>(null);

  const kunci = `${bulan.y}-${bulan.m}`;
  const sel = gridBulan(bulan.y, bulan.m);
  // Dimuat per bulan saat kalender terbuka; hasil disimpan per kunci bulan (belum ada = memuat).
  // muatHariLibur sendiri disimpan 60 dtk (gabungMuat) → bolak-balik bulan tidak memukul server.
  useEffect(() => {
    if (!buka || libur[kunci] !== undefined) return;
    const k = kunci;
    muatHariLibur(supabase, sel[0]!.iso, sel[sel.length - 1]!.iso).then((d) => setLibur((l) => ({ ...l, [k]: d })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka, kunci]);

  useEffect(() => {
    if (!buka) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setBuka(false); tombol.current?.focus(); } };
    document.addEventListener("keydown", esc);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", esc);
  }, [buka]);

  const daftar = libur[kunci];
  const peta = new Map((daftar || []).map((x) => [x.tanggal, x]));
  const merahBulanIni = (daftar || []).filter((x) => x.libur && tanggalDari(x.tanggal).getMonth() === bulan.m);
  const masukBulanIni = (daftar || []).filter((x) => !x.libur && tanggalDari(x.tanggal).getMonth() === bulan.m);
  const geser = (n: number) => setBulan((b) => { const d = new Date(b.y, b.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  return { buka, setBuka, bulan, sel, daftar, peta, merahBulanIni, masukBulanIni, geser, panel, tombol };
}
