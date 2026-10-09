// src/lib/rentangPengajuan.ts
// Batas rentang tanggal kueri pengajuan (tabel `approvals`) untuk dasbor yang hanya perlu
// pengajuan yang MENCAKUP tanggal tertentu (izin/cuti/WFH hari ini, ringkasan periode gaji).
//
// Kolom `tanggal` berisi teks "YYYY-MM-DD" atau rentang "YYYY-MM-DD s/d YYYY-MM-DD" — tanggal
// mulai selalu di depan, jadi perbandingan teks bekerja:
//   tanggal >= (awal − HARI_PENGAJUAN_MAKS)   → pengajuan yang mulai paling lama 180 hari sebelumnya
//   tanggal <  (akhir + 1 hari)                → termasuk "2026-10-09 s/d …" yang mulai di hari akhir
// Dengan begitu dasbor tidak lagi memuat SEMUA pengajuan sepanjang masa (beban tumbuh tiap bulan),
// sementara cuti panjang (mis. cuti melahirkan 3 bulan) tetap terhitung. Penyaringan "mencakup
// hari ini" tetap dilakukan di halaman seperti sebelumnya.
import { tambahHari } from "./rentangTanggal";

/** Cuti terpanjang yang masih ikut terhitung (hari). */
export const HARI_PENGAJUAN_MAKS = 180;

export function batasTanggalPengajuan(awal: string, akhir: string = awal): { dari: string; sebelum: string } {
  return { dari: tambahHari(awal, -HARI_PENGAJUAN_MAKS), sebelum: tambahHari(akhir, 1) };
}
