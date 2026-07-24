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
