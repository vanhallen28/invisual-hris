/**
 * Aturan jam kerja GLOBAL yang bisa diatur HR di halaman Pengaturan.
 * Disimpan di tabel `pengaturan` (kunci–nilai) yang sudah ada.
 *
 *   jam_masuk_standar      "09:00"  — jam masuk standar
 *   jam_pulang_standar     "18:00"  — jam pulang standar
 *   durasi_kerja_jam       "9"      — durasi kerja; karyawan telat wajib pulang = clock-in + durasi
 *   toleransi_telat_menit  "5"      — toleransi keterlambatan (menit)
 *
 * Jam masuk/pulang/toleransi tetap disimpan PER KARYAWAN (tabel employees) —
 * HR menerapkan nilai global ini ke semua karyawan lewat tombol di Pengaturan,
 * lalu bisa mengecualikan karyawan tertentu di halaman Karyawan. Nilai global
 * juga dipakai sebagai cadangan bila data karyawan kosong.
 *
 * Bila kunci belum ada / tak terbaca → nilai bawaan (sama seperti sebelum fitur ini).
 */
import { JAM_KERJA_JAM, TOLERANSI_TELAT_MENIT } from "./keterlambatan";

export type AturanJamKerja = {
  jamMasuk: string;       // "HH:MM"
  jamPulang: string;      // "HH:MM"
  durasiJam: number;      // jam (boleh desimal, mis. 8.5)
  toleransiMenit: number; // menit
};

export const ATURAN_JAM_KERJA_DEFAULT: AturanJamKerja = {
  jamMasuk: "09:00",
  jamPulang: "18:00",
  durasiJam: JAM_KERJA_JAM,
  toleransiMenit: TOLERANSI_TELAT_MENIT,
};

export const KUNCI_JAM_KERJA = {
  jamMasuk: "jam_masuk_standar",
  jamPulang: "jam_pulang_standar",
  durasiJam: "durasi_kerja_jam",
  toleransiMenit: "toleransi_telat_menit",
} as const;

const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "9:5" / "09:05:00" → "09:05"; tidak valid → null. */
export function rapikanJam(v: unknown): string | null {
  const m = String(v ?? "").trim().match(/^(\d{1,2}):(\d{1,2})/);
  if (!m) return null;
  const s = `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}`;
  return POLA_JAM.test(s) ? s : null;
}

/** Ubah baris pengaturan → aturan (nilai tak valid jatuh ke bawaan). */
export function aturanDariBaris(rows: { kunci: string; nilai: string | null }[] | null | undefined): AturanJamKerja {
  const peta: Record<string, string> = {};
  (rows || []).forEach((r) => { if (r?.kunci) peta[r.kunci] = String(r.nilai ?? ""); });
  const d = ATURAN_JAM_KERJA_DEFAULT;
  const durasi = Number(peta[KUNCI_JAM_KERJA.durasiJam]);
  const toleransi = Number(peta[KUNCI_JAM_KERJA.toleransiMenit]);
  return {
    jamMasuk: rapikanJam(peta[KUNCI_JAM_KERJA.jamMasuk]) || d.jamMasuk,
    jamPulang: rapikanJam(peta[KUNCI_JAM_KERJA.jamPulang]) || d.jamPulang,
    durasiJam: peta[KUNCI_JAM_KERJA.durasiJam] !== undefined && peta[KUNCI_JAM_KERJA.durasiJam] !== "" && durasi > 0 && durasi <= 24 ? durasi : d.durasiJam,
    toleransiMenit: peta[KUNCI_JAM_KERJA.toleransiMenit] !== undefined && peta[KUNCI_JAM_KERJA.toleransiMenit] !== "" && toleransi >= 0 && toleransi <= 240 ? Math.round(toleransi) : d.toleransiMenit,
  };
}

/** Baca aturan dari tabel `pengaturan`. Tidak pernah melempar galat. */
export async function ambilAturanJamKerja(supabase: any): Promise<AturanJamKerja> {
  try {
    const { data, error } = await supabase
      .from("pengaturan")
      .select("kunci, nilai")
      .in("kunci", Object.values(KUNCI_JAM_KERJA));
    if (error) return { ...ATURAN_JAM_KERJA_DEFAULT };
    return aturanDariBaris(data);
  } catch {
    return { ...ATURAN_JAM_KERJA_DEFAULT };
  }
}

/**
 * Seperti ambilAturanJamKerja, plus penanda kunci mana yang SUDAH pernah disimpan
 * HR. Dipakai agar bawaan lama (mis. form karyawan baru) tidak berubah sebelum
 * HR benar-benar mengatur nilainya.
 */
export async function ambilAturanJamKerjaDetail(supabase: any): Promise<{ aturan: AturanJamKerja; diatur: Record<keyof AturanJamKerja, boolean> }> {
  const kosong = { jamMasuk: false, jamPulang: false, durasiJam: false, toleransiMenit: false };
  try {
    const { data, error } = await supabase.from("pengaturan").select("kunci, nilai").in("kunci", Object.values(KUNCI_JAM_KERJA));
    if (error) return { aturan: { ...ATURAN_JAM_KERJA_DEFAULT }, diatur: kosong };
    const ada = new Set((data || []).filter((r: any) => String(r?.nilai ?? "") !== "").map((r: any) => r.kunci));
    return {
      aturan: aturanDariBaris(data),
      diatur: {
        jamMasuk: ada.has(KUNCI_JAM_KERJA.jamMasuk),
        jamPulang: ada.has(KUNCI_JAM_KERJA.jamPulang),
        durasiJam: ada.has(KUNCI_JAM_KERJA.durasiJam),
        toleransiMenit: ada.has(KUNCI_JAM_KERJA.toleransiMenit),
      },
    };
  } catch {
    return { aturan: { ...ATURAN_JAM_KERJA_DEFAULT }, diatur: kosong };
  }
}

/** Simpan aturan ke tabel `pengaturan`. Melempar galat bila gagal. */
export async function simpanAturanJamKerja(supabase: any, a: AturanJamKerja): Promise<void> {
  const rows = [
    { kunci: KUNCI_JAM_KERJA.jamMasuk, nilai: a.jamMasuk },
    { kunci: KUNCI_JAM_KERJA.jamPulang, nilai: a.jamPulang },
    { kunci: KUNCI_JAM_KERJA.durasiJam, nilai: String(a.durasiJam) },
    { kunci: KUNCI_JAM_KERJA.toleransiMenit, nilai: String(a.toleransiMenit) },
  ];
  const { error } = await supabase.from("pengaturan").upsert(rows, { onConflict: "kunci" });
  if (error) throw new Error(error.message);
}

/** Teks durasi ramah dibaca: 9 → "9 jam", 8.5 → "8 jam 30 menit". */
export function teksDurasi(jam: number): string {
  const total = Math.round((Number(jam) || 0) * 60);
  const j = Math.floor(total / 60), m = total % 60;
  return m ? `${j} jam ${m} menit` : `${j} jam`;
}
