// src/lib/ringkasanKehadiran.ts
// Ringkasan kehadiran satu karyawan dalam satu rentang (periode gaji 21→20):
// hadir (hari ber-absen), terlambat (hari berstatus Terlambat), sakit/izin
// (hari pengajuan DISETUJUI yang jatuh di rentang — selain Izin Terlambat & WFH/WFC).
// Murni: tanpa Supabase, mudah diuji. Menggantikan angka tetap "22 / 1 / 0"
// yang dulu terpampang di halaman Absen karyawan.
import { tambahHari, type Rentang } from "@/lib/rentangTanggal";

const POLA_ISO = /\d{4}-\d{2}-\d{2}/g;
const REMOTE = /WFH|WFC|Work From/i;

export type RingkasanKehadiran = { hadir: number; terlambat: number; sakitIzin: number };

/** Hari-hari ISO (inklusif) dari string tanggal pengajuan: "A", "A s/d B", atau "A (Est. …)". */
export function hariPengajuan(tanggal: unknown, maksHari = 366): string[] {
  const semua = String(tanggal ?? "").match(POLA_ISO) || [];
  if (semua.length === 0) return [];
  const mulai = semua[0]!;
  const akhir = semua.length > 1 && semua[1]! >= mulai ? semua[1]! : mulai;
  const out: string[] = [];
  let h = mulai;
  while (h <= akhir && out.length < maksHari) { out.push(h); h = tambahHari(h, 1); }
  return out;
}

export function ringkasKehadiran(absensi: any[] | null | undefined, pengajuan: any[] | null | undefined, periode: Rentang): RingkasanKehadiran {
  const diRentang = (iso: string) => iso >= periode.dari && iso <= periode.sampai;
  const hariHadir = new Set<string>();
  const hariTelat = new Set<string>();
  for (const a of absensi || []) {
    const t = String(a?.tanggal ?? "").slice(0, 10);
    if (!t || !diRentang(t) || !a?.waktuMasuk) continue;
    hariHadir.add(t);
    if (a.status === "Terlambat") hariTelat.add(t);
  }
  const hariIzin = new Set<string>();
  for (const p of pengajuan || []) {
    if (p?.status !== "Disetujui") continue;
    const jenis = String(p.jenis || "");
    if (/Izin Terlambat/i.test(jenis) || REMOTE.test(jenis)) continue;
    for (const h of hariPengajuan(p.tanggal)) {
      if (diRentang(h) && !hariHadir.has(h)) hariIzin.add(h);
    }
  }
  return { hadir: hariHadir.size, terlambat: hariTelat.size, sakitIzin: hariIzin.size };
}
