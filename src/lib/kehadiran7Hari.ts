// src/lib/kehadiran7Hari.ts
// Grafik "Kehadiran 7 hari" (Dasbor HR tema Neo-Brutal): persentase karyawan yang
// ber-absen pada N hari kerja terakhir. Murni (tanpa Supabase) agar mudah diuji.
//   • Hari kerja = bukan Sabtu/Minggu dan bukan tanggal merah (tabel hari_libur, bila ada).
//   • Penyebut = karyawan aktif yang sudah bergabung pada tanggal itu.
//   • Pembilang = karyawan itu yang punya jam masuk pada tanggal itu (satu hitungan per orang).
import { hariNonKerja, type PetaLibur } from "@/lib/hariLibur";
import { tambahHari } from "@/lib/rentangTanggal";

export type HariKehadiran = { tanggal: string; hadir: number; total: number; persen: number; hariIni: boolean };

/** N hari kerja terakhir (urut lama → baru), berakhir di `hariIni` bila hari itu hari kerja. */
export function hariKerjaTerakhir(hariIni: string, n: number, peta?: PetaLibur | null, batasCari = 40): string[] {
  const out: string[] = [];
  let h = hariIni;
  for (let i = 0; i < batasCari && out.length < n; i++) {
    if (!hariNonKerja(h, peta)) out.unshift(h);
    h = tambahHari(h, -1);
  }
  return out;
}

type Karyawan = { idKaryawan?: string | number | null; tanggalBergabung?: string | null };
type Absen = { idKaryawan?: string | number | null; tanggal?: string | null; waktuMasuk?: string | null };

export function kehadiranPerHari(hari: string[], absensi: Absen[] | null | undefined, karyawan: Karyawan[] | null | undefined, hariIni: string): HariKehadiran[] {
  const daftar = (karyawan || []).filter((k) => k?.idKaryawan != null && String(k.idKaryawan) !== "");
  const hadirPer = new Map<string, Set<string>>();
  for (const a of absensi || []) {
    const t = String(a?.tanggal ?? "").slice(0, 10);
    if (!t || !a?.waktuMasuk || a.idKaryawan == null) continue;
    if (!hadirPer.has(t)) hadirPer.set(t, new Set());
    hadirPer.get(t)!.add(String(a.idKaryawan));
  }
  return hari.map((t) => {
    const aktif = daftar.filter((k) => { const g = String(k.tanggalBergabung ?? "").slice(0, 10); return !g || g <= t; });
    const ids = hadirPer.get(t) || new Set<string>();
    const hadir = aktif.filter((k) => ids.has(String(k.idKaryawan))).length;
    const total = aktif.length;
    return { tanggal: t, hadir, total, persen: total ? Math.round((hadir / total) * 100) : 0, hariIni: t === hariIni };
  });
}
