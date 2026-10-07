// src/lib/tanggalTampil.ts
// Tanggal yang ramah dibaca untuk TAMPILAN saja — data tetap disimpan ISO.
//   teksTanggal("2026-10-08")                        → "Kam, 8 Okt 2026"
//   teksTanggal("2026-10-08", { hari: false })       → "8 Okt 2026"
//   teksTanggal("2025-07-16 s/d 2025-07-20")         → "16 – 20 Jul 2025"
//   teksTanggal("2025-12-28 s/d 2026-01-03")         → "28 Des 2025 – 3 Jan 2026"
//   teksTanggal("2025-07-16 (Est. Sampai: 10:00 WIB)") → "Rab, 16 Jul 2025 (Est. Sampai: 10:00 WIB)"
//   teksTanggal(null) → "-" ; teks tanpa ISO dikembalikan apa adanya.
import { BULAN_PENDEK } from "@/lib/rentangTanggal";

export const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const POLA_ISO = /\d{4}-\d{2}-\d{2}/g;

type Opsi = { hari?: boolean; tahun?: boolean };

function pecah(iso: string): { y: number; m: number; d: number; dow: number } {
  const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)), d = Number(iso.slice(8, 10));
  return { y, m, d, dow: new Date(y, m - 1, d).getDay() };
}

/** Satu tanggal ISO → "Kam, 8 Okt 2026". */
export function teksTanggalISO(iso: string, opsi: Opsi = {}): string {
  const { y, m, d, dow } = pecah(iso);
  if (!y || !m || !d) return iso;
  const inti = `${d} ${BULAN_PENDEK[m - 1]}${opsi.tahun === false ? "" : ` ${y}`}`;
  return opsi.hari === false ? inti : `${HARI_PENDEK[dow]}, ${inti}`;
}

/** Dua tanggal ISO → "16 – 20 Jul 2025" / "28 Des 2025 – 3 Jan 2026". */
export function teksRentangISO(dari: string, sampai: string, opsi: Opsi = {}): string {
  if (dari === sampai) return teksTanggalISO(dari, opsi);
  const a = pecah(dari), b = pecah(sampai);
  const tahun = opsi.tahun !== false;
  if (a.y === b.y && a.m === b.m) return `${a.d} – ${b.d} ${BULAN_PENDEK[b.m - 1]}${tahun ? ` ${b.y}` : ""}`;
  if (a.y === b.y) return `${a.d} ${BULAN_PENDEK[a.m - 1]} – ${b.d} ${BULAN_PENDEK[b.m - 1]}${tahun ? ` ${b.y}` : ""}`;
  return `${teksTanggalISO(dari, { hari: false })} – ${teksTanggalISO(sampai, { hari: false })}`;
}

/**
 * Nilai apa pun dari kolom `tanggal` (ISO, rentang "A s/d B", atau ISO dengan
 * embel-embel) → teks terbaca. Bagian non-tanggal dipertahankan.
 */
export function teksTanggal(nilai: unknown, opsi: Opsi = {}): string {
  const s = String(nilai ?? "").trim();
  if (!s) return "-";
  const semua = s.match(POLA_ISO) || [];
  if (semua.length === 0) return s;
  if (semua.length >= 2 && /s\/d|\bsd\b|–|-\s|hingga|sampai/i.test(s.replace(POLA_ISO, "§"))) {
    // Rentang: ganti "A s/d B" menjadi satu teks rentang, sisakan embel-embel di belakang.
    const pola = new RegExp(`${semua[0]}\\s*(?:s\\/d|sd|–|-|hingga|sampai)\\s*${semua[1]}`, "i");
    if (pola.test(s)) return s.replace(pola, teksRentangISO(semua[0]!, semua[1]!, { ...opsi, hari: false })).trim();
  }
  // Satu tanggal (atau beberapa yang tak berpola rentang): ganti tiap ISO.
  return s.replace(POLA_ISO, (iso) => teksTanggalISO(iso, semua.length > 1 ? { ...opsi, hari: false } : opsi)).trim();
}
