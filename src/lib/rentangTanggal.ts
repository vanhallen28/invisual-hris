/**
 * Rentang tanggal untuk rekap kehadiran (pemilih kalender di halaman Kehadiran).
 *
 * SELURUHNYA fungsi murni berbasis teks "YYYY-MM-DD" (tanggal lokal) —
 * tidak menyentuh database maupun DOM. Sengaja tidak memakai toISOString()
 * karena itu UTC: di WIB (UTC+7) tanggal bisa mundur sehari sebelum jam 07.00.
 */

export type Rentang = { dari: string; sampai: string };

export const BULAN_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const BULAN_PENDEK = BULAN_ID.map((b) => b.slice(0, 3));

/** Periode tutup-buku kehadiran: tgl 21 s/d tgl 20 bulan berikutnya. */
export const TGL_MULAI_PERIODE = 21;

/** Rentang terpanjang yang boleh dipilih (hari). */
export const MAKS_HARI_RENTANG = 366;

const pad = (n: number) => String(n).padStart(2, "0");

export const isoDari = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function tanggalDari(iso: string): Date {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return new Date(y || 1970, (m || 1) - 1, d || 1);
}

export const isoValid = (iso: unknown): iso is string =>
  typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) && isoDari(tanggalDari(iso)) === iso;

export function tambahHari(iso: string, n: number): string {
  const d = tanggalDari(iso);
  d.setDate(d.getDate() + n);
  return isoDari(d);
}

/** Jumlah hari dari a ke b (b − a). Aman dari pergantian jam musim panas. */
const utc = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y || 1970, (m || 1) - 1, d || 1); };
export function selisihHari(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86400000);
}

/** Jumlah hari dalam rentang (inklusif). */
export const jumlahHari = (r: Rentang) => selisihHari(r.dari, r.sampai) + 1;

/** Tukar bila terbalik, potong bila melebihi batas. Tanggal tak valid → null. */
export function rapikanRentang(dari: string, sampai: string, maks = MAKS_HARI_RENTANG): Rentang | null {
  if (!isoValid(dari) || !isoValid(sampai)) return null;
  let a = dari, b = sampai;
  if (a > b) [a, b] = [b, a];
  if (selisihHari(a, b) + 1 > maks) b = tambahHari(a, maks - 1);
  return { dari: a, sampai: b };
}

/** Periode tutup-buku (21 → 20) yang memuat `hariIni`, digeser `geser` periode. */
export function periodeGaji(hariIni: string, geser = 0): Rentang {
  const t = tanggalDari(hariIni);
  const bulanAwal = (t.getDate() >= TGL_MULAI_PERIODE ? t.getMonth() : t.getMonth() - 1) + geser;
  return {
    dari: isoDari(new Date(t.getFullYear(), bulanAwal, TGL_MULAI_PERIODE)),
    sampai: isoDari(new Date(t.getFullYear(), bulanAwal + 1, TGL_MULAI_PERIODE - 1)),
  };
}

export type KunciPreset = "7h" | "14h" | "30h" | "mingguIni" | "bulanIni" | "bulanLalu" | "periodeIni" | "periodeLalu";

export const PRESET: { kunci: KunciPreset; label: string }[] = [
  { kunci: "7h", label: "7 hari terakhir" },
  { kunci: "14h", label: "14 hari terakhir" },
  { kunci: "30h", label: "30 hari terakhir" },
  { kunci: "mingguIni", label: "Minggu ini" },
  { kunci: "bulanIni", label: "Bulan ini" },
  { kunci: "bulanLalu", label: "Bulan lalu" },
  { kunci: "periodeIni", label: "Periode gaji ini (21–20)" },
  { kunci: "periodeLalu", label: "Periode gaji lalu" },
];

/** Hitung rentang sebuah preset relatif terhadap `hariIni`. "N hari terakhir" termasuk hari ini. */
export function rentangPreset(kunci: KunciPreset, hariIni: string): Rentang {
  const t = tanggalDari(hariIni);
  switch (kunci) {
    case "7h": return { dari: tambahHari(hariIni, -6), sampai: hariIni };
    case "14h": return { dari: tambahHari(hariIni, -13), sampai: hariIni };
    case "30h": return { dari: tambahHari(hariIni, -29), sampai: hariIni };
    case "mingguIni": {
      const keSenin = (t.getDay() + 6) % 7; // Senin = 0
      return { dari: tambahHari(hariIni, -keSenin), sampai: hariIni };
    }
    case "bulanIni": return { dari: isoDari(new Date(t.getFullYear(), t.getMonth(), 1)), sampai: isoDari(new Date(t.getFullYear(), t.getMonth() + 1, 0)) };
    case "bulanLalu": return { dari: isoDari(new Date(t.getFullYear(), t.getMonth() - 1, 1)), sampai: isoDari(new Date(t.getFullYear(), t.getMonth(), 0)) };
    case "periodeIni": return periodeGaji(hariIni, 0);
    case "periodeLalu": return periodeGaji(hariIni, -1);
  }
}

/** Preset mana yang persis sama dengan rentang ini (untuk menyorot tombolnya). */
export function presetCocok(r: Rentang, hariIni: string): KunciPreset | null {
  for (const p of PRESET) {
    const x = rentangPreset(p.kunci, hariIni);
    if (x.dari === r.dari && x.sampai === r.sampai) return p.kunci;
  }
  return null;
}

/** "5 Okt 2026" */
export function labelTanggal(iso: string, denganTahun = true): string {
  const d = tanggalDari(iso);
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}${denganTahun ? ` ${d.getFullYear()}` : ""}`;
}

/** "21 Sep – 20 Okt 2026", "28 Des 2025 – 3 Jan 2026", atau "5 Okt 2026" untuk satu hari. */
export function labelRentang(r: Rentang): string {
  if (r.dari === r.sampai) return labelTanggal(r.dari);
  const samaTahun = r.dari.slice(0, 4) === r.sampai.slice(0, 4);
  return `${labelTanggal(r.dari, !samaTahun)} – ${labelTanggal(r.sampai)}`;
}

/** Semua tanggal dalam rentang (inklusif), sebagai objek Date lokal. */
export function hariDalamRentang(r: Rentang): Date[] {
  const out: Date[] = [];
  const n = Math.min(jumlahHari(r), MAKS_HARI_RENTANG);
  for (let i = 0; i < n; i++) out.push(tanggalDari(tambahHari(r.dari, i)));
  return out;
}

/**
 * Kotak kalender satu bulan, minggu dimulai Senin. Selalu 6 baris × 7 kolom
 * supaya tinggi kalender tidak melompat saat berganti bulan.
 */
export function gridBulan(tahun: number, bulan: number): { iso: string; diBulan: boolean }[] {
  const awal = new Date(tahun, bulan, 1);
  const geserSenin = (awal.getDay() + 6) % 7;
  const mulai = isoDari(new Date(tahun, bulan, 1 - geserSenin));
  const out: { iso: string; diBulan: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const iso = tambahHari(mulai, i);
    out.push({ iso, diBulan: tanggalDari(iso).getMonth() === bulan });
  }
  return out;
}
