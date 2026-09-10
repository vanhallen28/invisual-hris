/**
 * Satu sumber kebenaran untuk "apakah absen ini terlambat?".
 *
 * MASALAH YANG DIPERBAIKI:
 * Kolom `attendance.status` ditulis SEKALI saat clock-in. Kalau seorang
 * karyawan baru ditandai `fleksibel` SETELAH itu, catatan lamanya tetap
 * berbunyi "Terlambat" selamanya — sehingga ia terus muncul di kartu
 * keterlambatan meski jam kerjanya fleksibel.
 *
 * Karena itu keterlambatan TIDAK boleh dibaca dari `status` saja.
 * Selalu dicocokkan dulu dengan data karyawan (sumber kebenaran).
 *
 * Aditif: tidak mengubah data di Supabase, hanya cara membacanya.
 *
 * CATATAN: pengecualian "anomali sudah disetujui admin" TIDAK diurus di sini.
 * Itu aturan berbeda dan hanya berlaku di sebagian tempat, jadi tetap ditulis
 * eksplisit di pemanggilnya agar tak diam-diam mengubah angka kartu lain.
 */

/** Karyawan dengan jam fleksibel tidak pernah dihitung terlambat. */
export function fleksibelIds(employees: any[] | undefined): Set<string> {
  const s = new Set<string>();
  (employees || []).forEach((e: any) => {
    if (e?.fleksibel === true) s.add(String(e.idKaryawan ?? ""));
  });
  return s;
}

/**
 * @param absen  satu baris tabel attendance
 * @param fleks  hasil fleksibelIds(employees)
 */
export function terlambat(absen: any, fleks: Set<string>): boolean {
  if (!absen || absen.status !== "Terlambat") return false;
  return !fleks.has(String(absen.idKaryawan ?? ""));       // fleksibel → tidak telat
}

/** Menyaring daftar absensi menjadi hanya yang benar-benar terlambat. */
export function saringTerlambat(absensi: any[] | undefined, employees: any[] | undefined): any[] {
  const f = fleksibelIds(employees);
  return (absensi || []).filter((a) => terlambat(a, f));
}

/**
 * Toleransi keterlambatan (menit). Karyawan dianggap "Terlambat" hanya jika
 * absen lebih dari (jam masuk + toleransi ini). Ubah angkanya di sini untuk
 * menyesuaikan kebijakan perusahaan. 0 = tanpa toleransi (ketat).
 */
export const TOLERANSI_TELAT_MENIT = 5;

/** Jam kerja standar (jam). Telat → wajib pulang = clock-in + jam ini. */
export const JAM_KERJA_JAM = 9;

/** Tambah `jam` ke waktu "HH:MM" → "HH:MM" (24 jam, mod 24). */
export function tambahJamKe(hhmm: string, jam: number): string {
  const [h, m] = String(hhmm || "00:00").split(":").map(Number);
  const t = ((h || 0) * 60 + (m || 0)) + Math.round(jam * 60);
  const th = Math.floor(t / 60) % 24, tm = ((t % 60) + 60) % 60;
  return `${String(th).padStart(2, "0")}:${String(tm).padStart(2, "0")}`;
}

/**
 * Hitung jam wajib pulang dari jam clock-in.
 * - Telat (clock-in > jam masuk + toleransi) → clock-in + JAM_KERJA_JAM (persis).
 * - Tepat waktu → jam keluar normal.
 */
export function jamPulangDariClockIn(clockInHHMM: string, jamMasuk: string, jamKeluar: string, toleransiMenit: number): string {
  const [cih, cim] = String(clockInHHMM || "00:00").split(":").map(Number);
  const menitCI = (cih || 0) * 60 + (cim || 0);
  const [mh, mm] = String(jamMasuk || "09:00").split(":").map(Number);
  const menitMasuk = (mh || 9) * 60 + (mm || 0);
  if (menitCI > menitMasuk + (toleransiMenit || 0)) return tambahJamKe(clockInHHMM, JAM_KERJA_JAM);
  return jamKeluar || "18:00";
}
