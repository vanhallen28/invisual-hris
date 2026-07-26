/**
 * src/lib/keuangan/format.ts
 *
 * Pemformatan rupiah dan aritmetika periode. Fungsi MURNI — tidak
 * menyentuh DOM, tidak menyentuh database, jadi aman dipakai di mana pun.
 * Disalin apa adanya dari modul keuangan (sudah teruji), hanya
 * headernya yang disesuaikan.
 */

export const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export const BULAN_SINGKAT = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));

/** 1250000 -> "Rp 1.250.000" ; -450000 -> "-Rp 450.000" */
export function rp(n: number): string {
  const negatif = n < 0;
  const nilai = Math.round(Math.abs(n));
  return `${negatif ? "-Rp " : "Rp "}${nilai.toLocaleString("id-ID")}`;
}

/** Ringkas untuk label grafik: 48000000 -> "48 jt" */
export function rpShort(n: number): string {
  const v = Math.abs(n);
  if (v >= 1e9) return `${(v / 1e9).toFixed(v >= 1e10 ? 0 : 1).replace(".", ",")} M`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(".", ",")} jt`;
  if (v >= 1e3) return `${Math.round(v / 1e3)} rb`;
  return String(v);
}

/** Ambil hanya angka dari input berformat: "Rp 1.250.000" -> 1250000 */
export function digits(input: string): number {
  const d = String(input).replace(/[^0-9]/g, "");
  return d ? parseInt(d, 10) : 0;
}

/** Tampilkan angka dengan pemisah ribuan saat user mengetik */
export function groupDigits(input: string): string {
  const v = digits(input);
  return v ? v.toLocaleString("id-ID") : "";
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "2026-07-05" -> "2026-07" */
export const toPeriod = (iso: string): string => String(iso).slice(0, 7);

/** "2026-07" -> "2026-07-01" (kolom date di Postgres) */
export const periodToDate = (period: string): string => `${period}-01`;

/** Geser periode. ymShift("2026-01", -1) -> "2025-12" */
export function shiftPeriod(period: string, delta: number): string {
  const [ys, ms] = period.split("-");
  let year = parseInt(ys, 10);
  let month = parseInt(ms, 10) - 1 + delta;
  year += Math.floor(month / 12);
  month = ((month % 12) + 12) % 12;
  return `${year}-${pad2(month + 1)}`;
}

/** Rentang inklusif untuk query: ["2026-07-01", "2026-07-31"] */
export function periodRange(period: string): [string, string] {
  const next = shiftPeriod(period, 1);
  const [ny, nm] = next.split("-").map(Number);
  const lastDay = new Date(Date.UTC(ny, nm - 1, 0)).getUTCDate();
  return [`${period}-01`, `${period}-${pad2(lastDay)}`];
}

/** "2026-07" -> "Juli 2026" */
export function periodLabel(period: string): string {
  if (!period) return "";
  const [y, m] = period.split("-");
  return `${BULAN[parseInt(m, 10) - 1]} ${y}`;
}

/** "2026-07" -> "Jul" */
export function periodShortLabel(period: string): string {
  const m = parseInt(period.split("-")[1], 10);
  return BULAN_SINGKAT[m - 1];
}

/** "2026-07-05" -> "05 Jul" */
export function formatDate(iso: string): string {
  const [, m, d] = String(iso).split("-");
  return `${d} ${BULAN_SINGKAT[parseInt(m, 10) - 1]}`;
}

/** Persentase perubahan; null kalau pembanding nol. */
export function pctChange(now: number, before: number): number | null {
  if (!before) return null;
  return ((now - before) / before) * 100;
}

export function budgetLevel(pct: number): "ok" | "warn" | "over" {
  if (pct >= 100) return "over";
  if (pct >= 80) return "warn";
  return "ok";
}
