// src/lib/hariLibur.ts
// HARI LIBUR (tanggal merah) — fungsi murni, tanpa React/Supabase.
//
//   • Sumber: tabel `hari_libur` (hari-libur.sql) — libur nasional (selalu libur),
//     cuti bersama (HR memilih Libur/Masuk per tanggal), libur kantor.
//   • "Hari non-kerja" = Sabtu, Minggu, atau baris hari_libur dengan libur = true.
//   • Tanpa peta (tabel belum ada / gagal dimuat) semua fungsi berperilaku persis
//     seperti sebelumnya: hanya Sabtu–Minggu yang libur.
import { tambahHari, tanggalDari } from "./rentangTanggal";

export type JenisLibur = "nasional" | "cuti_bersama" | "kantor";
export type HariLibur = { tanggal: string; nama: string; jenis: JenisLibur; libur: boolean; diubah_oleh?: string | null; diubah_pada?: string | null };
/** "YYYY-MM-DD" → baris hari_libur (termasuk cuti bersama yang disetel Masuk). */
export type PetaLibur = Map<string, HariLibur>;

export const JENIS_LIBUR: JenisLibur[] = ["nasional", "cuti_bersama", "kantor"];
export const LABEL_JENIS: Record<JenisLibur, string> = { nasional: "Libur nasional", cuti_bersama: "Cuti bersama", kantor: "Libur kantor" };

const jenisValid = (j: unknown): JenisLibur => (JENIS_LIBUR.includes(j as JenisLibur) ? (j as JenisLibur) : "kantor");

/** Rapikan baris mentah Supabase. Libur nasional selalu libur. Baris tak valid → null. */
export function rapikanLibur(r: any): HariLibur | null {
  const tanggal = String(r?.tanggal ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) return null;
  const jenis = jenisValid(r?.jenis);
  return {
    tanggal, nama: String(r?.nama ?? "").trim() || LABEL_JENIS[jenis], jenis,
    libur: jenis === "nasional" ? true : r?.libur !== false,
    diubah_oleh: r?.diubah_oleh ?? null, diubah_pada: r?.diubah_pada ?? null,
  };
}

export function buatPetaLibur(baris: any[] | null | undefined): PetaLibur {
  const m: PetaLibur = new Map();
  (baris || []).forEach((r) => { const x = rapikanLibur(r); if (x) m.set(x.tanggal, x); });
  return m;
}

export const akhirPekanISO = (iso: string) => { const d = tanggalDari(iso).getDay(); return d === 0 || d === 6; };

/** Baris hari_libur pada tanggal itu (apa pun sakelarnya), atau null. */
export const infoLibur = (iso: string, peta?: PetaLibur | null): HariLibur | null => peta?.get(iso) || null;

/** Tanggal merah yang BERLAKU (libur = true), atau null. Cuti bersama yang disetel Masuk → null. */
export function liburPada(iso: string, peta?: PetaLibur | null): HariLibur | null {
  const x = peta?.get(iso);
  return x && x.libur ? x : null;
}

/** Bukan hari kerja: akhir pekan atau tanggal merah yang berlaku. */
export const hariNonKerja = (iso: string, peta?: PetaLibur | null) => akhirPekanISO(iso) || !!liburPada(iso, peta);

/** Tanggal merah berlaku berikutnya (≥ hariIni) di peta, hanya yang jatuh di hari kerja Senin–Jumat. */
export function liburBerikutnya(hariIni: string, peta?: PetaLibur | null): HariLibur | null {
  if (!peta) return null;
  let terbaik: HariLibur | null = null;
  for (const x of peta.values()) {
    if (!x.libur || x.tanggal < hariIni || akhirPekanISO(x.tanggal)) continue;
    if (!terbaik || x.tanggal < terbaik.tanggal) terbaik = x;
  }
  return terbaik;
}

/** Baris pada rentang [dari, sampai] urut tanggal (untuk daftar "Hari libur bulan ini"). */
export function liburDalamRentang(peta: PetaLibur | null | undefined, dari: string, sampai: string): HariLibur[] {
  if (!peta) return [];
  return [...peta.values()].filter((x) => x.tanggal >= dari && x.tanggal <= sampai).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}

/** Rentang muat di sekitar sebuah tanggal (dipakai lembur: cukup untuk libur Lebaran terpanjang). */
export const rentangSekitar = (iso: string, hari = 31) => ({ dari: tambahHari(iso, -hari), sampai: tambahHari(iso, hari) });
