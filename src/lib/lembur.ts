// src/lib/lembur.ts
// Aturan KOMPENSASI LEMBUR — fungsi murni (tanpa React/Supabase), dipakai halaman
// absen karyawan (Kehadiran & Dasbor), Dasbor admin, dan Kehadiran admin.
//
//   • HR/manajer menandai lembur (tabel `lembur`) + memilih kompensasi:
//       masuk_siang  → hari kerja berikutnya boleh masuk sampai jamMasuk + menit kompensasi
//       pulang_cepat → hari kerja berikutnya wajib pulang = jamKeluar − menit kompensasi
//   • Sah hanya bila clock-out ≥ menit lembur wajib setelah JAM WAJIB PULANG hari itu
//     (jamPulangSeharusnya bila telat; selain itu jamKeluar karyawan).
//   • Menit lembur wajib & menit kompensasi bisa diatur per tanda oleh HR/manajer
//     (kolom lembur.menit_wajib / menit_kompensasi, lembur-custom.sql). Kosong = 60 menit
//     (MENIT_LEMBUR_MIN / MENIT_KOMPENSASI) — sama persis dengan aturan sebelumnya.
//   • Berlaku untuk hari kerja berikutnya saja (Jumat → Senin; tanggal merah ikut dilewati —
//     lib/hariLibur); satu tanda = satu pemakaian. Lembur boleh di akhir pekan/tanggal merah.
//   • HARI kompensasi bisa dipilih HR/manajer per tanda (kolom lembur.tanggal_kompensasi,
//     lembur-kompensasi-acc.sql): hari kerja setelah tanggal lembur, maks HARI_KOMPENSASI_MAKS
//     hari. Kosong = hari kerja berikutnya (aturan lama). Hanya berlaku di tanggal itu.
// Logika terlambat lama (jam masuk + toleransi, hanya mode Kantor & non-fleksibel)
// TIDAK diubah — kompensasi hanya menggeser batasnya.
import { jamPulangDariClockIn } from "./keterlambatan";
import { tambahHari, tanggalDari } from "./rentangTanggal";
import { hariNonKerja, type PetaLibur } from "./hariLibur";

export const MENIT_LEMBUR_MIN = 60;
export const MENIT_KOMPENSASI = 60;

export type Kompensasi = "masuk_siang" | "pulang_cepat";
export type TandaLembur = {
  id?: string; idKaryawan: string; nama?: string | null; tanggal: string; kompensasi: Kompensasi;
  catatan?: string | null; ditandai_oleh?: string | null; ditandai_pada?: string | null;
  dibatalkan_pada?: string | null; dibatalkan_oleh?: string | null;
  /** Lama lembur wajib (menit) agar sah; kosong = MENIT_LEMBUR_MIN. */
  menit_wajib?: number | null;
  /** Besar kompensasi (menit); kosong = MENIT_KOMPENSASI. */
  menit_kompensasi?: number | null;
  /** Hari kompensasi pilihan HR (YYYY-MM-DD); kosong = hari kerja berikutnya. */
  tanggal_kompensasi?: string | null;
};

/** Batas pilihan jam lembur custom (menit). */
export const BATAS_MENIT_WAJIB = { min: 15, max: 720 } as const;
export const BATAS_MENIT_KOMPENSASI = { min: 15, max: 480 } as const;
const menitDalam = (x: unknown, bawaan: number, b: { min: number; max: number }) => {
  const n = Math.round(Number(x));
  return x != null && x !== "" && Number.isFinite(n) && n >= b.min && n <= b.max ? n : bawaan;
};
/** Lama lembur wajib sebuah tanda (menit). */
export const menitWajib = (t?: Pick<TandaLembur, "menit_wajib"> | null) => menitDalam(t?.menit_wajib, MENIT_LEMBUR_MIN, BATAS_MENIT_WAJIB);
/** Besar kompensasi sebuah tanda (menit). */
export const menitKompensasi = (t?: Pick<TandaLembur, "menit_kompensasi"> | null) => menitDalam(t?.menit_kompensasi, MENIT_KOMPENSASI, BATAS_MENIT_KOMPENSASI);
const mkValid = (m?: number | null) => menitDalam(m, MENIT_KOMPENSASI, BATAS_MENIT_KOMPENSASI);
export type AbsenRingkas = {
  id?: any; waktuMasuk?: string | null; waktuKeluar?: string | null; jamPulangSeharusnya?: string | null;
  lembur_menit?: number | null; kompensasi_lembur?: string | null; kompensasi_dari?: string | null;
  status?: string | null; mode_kerja?: string | null;
};
export type KompensasiAktif = { tanda: TandaLembur; dari: string; terpakai: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
/** "09:05" → 545 menit; tidak valid → 0. */
export function keMenit(hhmm: unknown): number {
  const m = String(hhmm ?? "").trim().match(/^(\d{1,2}):(\d{1,2})/);
  if (!m) return 0;
  return (Number(m[1]) || 0) * 60 + (Number(m[2]) || 0);
}
/** 545 → "09:05" (mod 24 jam). */
export function dariMenit(m: number): string {
  const t = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}
export const menitAntara = (dari: string, ke: string) => keMenit(ke) - keMenit(dari);
const jamValid = (v: unknown) => (/^\d{1,2}:\d{1,2}/.test(String(v ?? "")) ? dariMenit(keMenit(v)) : "");

/**
 * Jam wajib pulang hari itu untuk menghitung lembur: yang LEBIH LAMBAT antara
 * jamPulangSeharusnya (telat → clock-in + durasi) dan jamKeluar karyawan.
 * Dengan begitu hari kompensasi "pulang cepat" (wajib pulang 17:00) tidak
 * menghasilkan lembur semu bila karyawan pulang jam biasa (18:00).
 */
export function jamWajibPulang(att: AbsenRingkas | null | undefined, jamKeluar: string): string {
  const normal = jamValid(jamKeluar) || "18:00";
  const seharusnya = jamValid(att?.jamPulangSeharusnya);
  return seharusnya && keMenit(seharusnya) > keMenit(normal) ? seharusnya : normal;
}
/** Menit lembur = clock-out − jam wajib pulang (tidak negatif). */
export const menitLembur = (waktuKeluar: string, jamWajib: string) => Math.max(0, menitAntara(jamWajib, waktuKeluar));

export const akhirPekan = (iso: string) => { const d = tanggalDari(iso).getDay(); return d === 0 || d === 6; };
/** Batas pencarian mundur/maju (hari) — jauh di atas libur Lebaran terpanjang. */
const BATAS_CARI = 45;
/**
 * Hari kerja berikutnya: lewati Sabtu–Minggu dan tanggal merah yang berlaku (peta libur).
 * Jumat → Senin; Kamis 19 Mar 2026 → Rabu 25 Mar 2026 (Nyepi + Lebaran + cuti bersama).
 * Tanpa peta → hanya akhir pekan yang dilewati (perilaku lama).
 */
export function hariKerjaBerikutnya(iso: string, peta?: PetaLibur | null): string {
  let d = tambahHari(iso, 1);
  for (let i = 0; i < BATAS_CARI && hariNonKerja(d, peta); i++) d = tambahHari(d, 1);
  return d;
}
/**
 * Tanggal-tanggal lembur yang hari kompensasinya = hariKompensasi, terdekat dulu:
 * hari kerja sebelumnya + semua hari libur di antaranya (Senin ← Min, Sab, Jum).
 * hariKompensasi sendiri libur → [] (tidak ada kompensasi di hari libur).
 */
export function hariLemburUntuk(hariKompensasi: string, peta?: PetaLibur | null): string[] {
  if (hariNonKerja(hariKompensasi, peta)) return [];
  const out: string[] = [];
  for (let i = 1; i <= BATAS_CARI; i++) {
    const d = tambahHari(hariKompensasi, -i);
    out.push(d);
    if (!hariNonKerja(d, peta)) break;   // hari kerja sebelumnya = kandidat terakhir
  }
  return out;
}

/** Hari kompensasi custom paling jauh (hari setelah tanggal lembur). */
export const HARI_KOMPENSASI_MAKS = 30;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** Tanggal kompensasi custom yang sah untuk tanda ini (null = tidak ada / di luar batas → bawaan). */
export function tanggalKompensasiCustom(t: Pick<TandaLembur, "tanggal" | "tanggal_kompensasi"> | null | undefined): string | null {
  const k = String(t?.tanggal_kompensasi ?? "").slice(0, 10);
  if (!t || !ISO.test(k)) return null;
  return k > t.tanggal && k <= tambahHari(t.tanggal, HARI_KOMPENSASI_MAKS) ? k : null;
}
/** Hari kompensasi sebuah tanda: pilihan HR bila ada, selain itu hari kerja berikutnya. */
export function hariKompensasiTanda(t: Pick<TandaLembur, "tanggal" | "tanggal_kompensasi">, peta?: PetaLibur | null): string {
  return tanggalKompensasiCustom(t) ?? hariKerjaBerikutnya(t.tanggal, peta);
}
/** "hari kerja berikutnya" atau "kompensasi Sen, 12 Okt:" (fmt = pemformat tanggal tampilan). */
export function frasaHariKompensasi(t: Pick<TandaLembur, "tanggal" | "tanggal_kompensasi">, fmt: (iso: string) => string): string {
  const k = tanggalKompensasiCustom(t);
  return k ? `kompensasi ${fmt(k)}:` : "hari kerja berikutnya";
}
/** Validasi pilihan hari kompensasi (pesan galat, atau null bila boleh). */
export function cekTanggalKompensasi(tanggalLembur: string, pilihan: string, peta?: PetaLibur | null): string | null {
  if (!ISO.test(pilihan)) return "Tanggal kompensasi belum diisi.";
  if (pilihan <= tanggalLembur) return "Hari kompensasi harus setelah tanggal lembur.";
  if (pilihan > tambahHari(tanggalLembur, HARI_KOMPENSASI_MAKS)) return `Hari kompensasi paling lambat ${HARI_KOMPENSASI_MAKS} hari setelah tanggal lembur.`;
  if (hariNonKerja(pilihan, peta)) return "Hari kompensasi harus hari kerja (bukan akhir pekan / tanggal merah).";
  return null;
}

export const tandaAktif = (t: TandaLembur | null | undefined) => !!t && !t.dibatalkan_pada;
/** Sah = tanda aktif dan lembur hari itu ≥ lama lembur wajib tanda itu (bawaan 60 menit). */
export function lemburSah(t: TandaLembur | null | undefined, att: AbsenRingkas | null | undefined): boolean {
  return tandaAktif(t) && Number(att?.lembur_menit ?? 0) >= menitWajib(t);
}

/**
 * Kompensasi yang berlaku untuk `hariIni`: tanda sah yang hari kompensasinya = hariIni
 * (pilihan HR, atau hari kerja berikutnya bila tidak dipilih).
 * Belum clock-in → tanda terbaru yang memenuhi. Sudah clock-in → hanya bila absen hari ini
 * memang memakainya (kompensasi_dari = tanggal tanda); clock-in tanpa kompensasi → null.
 */
export function kompensasiAktif(o: { hariIni: string; tanda: TandaLembur[]; absenLembur: Record<string, AbsenRingkas | null | undefined>; absenHariIni?: AbsenRingkas | null; peta?: PetaLibur | null }): KompensasiAktif | null {
  const kandidat = (o.tanda || [])
    .filter((t) => tandaAktif(t) && hariKompensasiTanda(t, o.peta) === o.hariIni && lemburSah(t, o.absenLembur[t.tanggal]))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  if (!kandidat.length) return null;
  const a = o.absenHariIni;
  if (a && a.waktuMasuk) {
    const dipakai = kandidat.find((t) => t.tanggal === a.kompensasi_dari);
    return dipakai ? { tanda: dipakai, dari: dipakai.tanggal, terpakai: true } : null;
  }
  return { tanda: kandidat[0], dari: kandidat[0].tanggal, terpakai: false };
}

/** Penilaian clock-in — aturan lama + pergeseran batas bila masuk_siang. */
export function nilaiMasuk(o: { waktuMasuk: string; jamMasuk: string; toleransi: number; fleksibel: boolean; modeKerja: string; kompensasi?: Kompensasi | null; menitKompensasi?: number | null }) {
  const batas = keMenit(o.jamMasuk || "09:00") + (Number(o.toleransi) || 0) + (o.kompensasi === "masuk_siang" ? mkValid(o.menitKompensasi) : 0);
  const telat = !o.fleksibel && o.modeKerja === "Kantor" && keMenit(o.waktuMasuk) > batas;
  return { status: (telat ? "Terlambat" : "Tepat Waktu") as "Tepat Waktu" | "Terlambat", telat, batasMasuk: dariMenit(batas) };
}

/**
 * Jam wajib pulang hari ini. Sama dengan aturan lama (jamPulangDariClockIn):
 * clock-in lewat batas → clock-in + durasi, APA PUN mode kerjanya (WFH pun) —
 * batasnya saja yang bergeser 60 menit bila kompensasi masuk_siang.
 * Tidak lewat batas & pulang_cepat → jamKeluar − 60. Fleksibel → null.
 * (`telat` dipertahankan untuk kompatibilitas pemanggil; tidak dipakai.)
 */
export function jamPulangHariIni(o: { waktuMasuk: string; jamMasuk: string; jamKeluar: string; toleransi: number; durasiJam: number; fleksibel: boolean; telat?: boolean; kompensasi?: Kompensasi | null; menitKompensasi?: number | null }): string | null {
  if (o.fleksibel) return null;
  const mk = mkValid(o.menitKompensasi);
  const toleransiEfektif = (Number(o.toleransi) || 0) + (o.kompensasi === "masuk_siang" ? mk : 0);
  const lewatBatas = keMenit(o.waktuMasuk) > keMenit(o.jamMasuk || "09:00") + toleransiEfektif;
  if (lewatBatas) return jamPulangDariClockIn(o.waktuMasuk, o.jamMasuk, o.jamKeluar, toleransiEfektif, o.durasiJam);
  if (o.kompensasi === "pulang_cepat") return dariMenit(keMenit(o.jamKeluar || "18:00") - mk);
  return jamValid(o.jamKeluar) || "18:00";
}

export function labelKompensasi(k: Kompensasi, jamMasuk: string, jamKeluar: string, menit?: number | null): string {
  const mk = mkValid(menit);
  return k === "masuk_siang"
    ? `boleh masuk sampai ${dariMenit(keMenit(jamMasuk || "09:00") + mk)}`
    : `boleh pulang ${dariMenit(keMenit(jamKeluar || "18:00") - mk)}`;
}
/** "1 jam", "2 jam 30 menit", "45 menit" — untuk kalimat syarat lembur. */
export function teksMenit(menit: number): string {
  const m = Math.max(0, Math.round(Number(menit) || 0)); const j = Math.floor(m / 60), s = m % 60;
  if (!j) return `${s} menit`;
  return s ? `${j} jam ${s} menit` : `${j} jam`;
}
export function formatDurasi(menit: number): string {
  const m = Math.max(0, Math.round(Number(menit) || 0)); const j = Math.floor(m / 60), s = m % 60;
  if (!j) return `${s}m`;
  return s ? `${j}j ${s}m` : `${j}j`;
}
/** Status sebuah tanda untuk kartu HR. */
export function statusTanda(t: TandaLembur, att: AbsenRingkas | null | undefined, hariIni: string): { kode: "batal" | "belum" | "sah" | "kurang" | "lupa"; teks: string } {
  if (!tandaAktif(t)) return { kode: "batal", teks: "Dibatalkan" };
  if (!att?.waktuKeluar) return t.tanggal < hariIni ? { kode: "lupa", teks: att?.waktuMasuk ? "Tidak clock-out — kompensasi tidak berlaku" : "Tidak ada absen — kompensasi tidak berlaku" } : { kode: "belum", teks: att?.waktuMasuk ? "Belum clock-out" : "Belum absen" };
  const m = Number(att.lembur_menit ?? 0);
  const w = menitWajib(t);
  if (m >= w) return { kode: "sah", teks: `Lembur ${formatDurasi(m)} · sah` };
  return { kode: "kurang", teks: `Pulang ${att.waktuKeluar} — lembur ${formatDurasi(m)}, kurang dari ${teksMenit(w)}, kompensasi tidak berlaku` };
}
