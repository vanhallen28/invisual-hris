// src/lib/management/hariKerja.ts
// Hari & jam kerja Section Management — CERMIN fungsi SQL mgmt_* di management-p1.sql.
// Hari kerja: Senin–Jumat, 09.00–18.00 WIB, bukan hari_libur.libur = true. 1 hari kerja = 9 jam kerja.
// Murni (tanpa alias @/) agar bisa diuji dengan node --experimental-strip-types.
import type { PetaLibur } from "../hariLibur";

export const JAM_MULAI = 9;
export const JAM_SELESAI = 18;
export const JAM_PER_HARI = JAM_SELESAI - JAM_MULAI;
const WIB_MS = 7 * 3_600_000;
const JAM_MS = 3_600_000;

/** Tanggal WIB "YYYY-MM-DD" dari sebuah instan. */
export const isoWib = (d: Date): string => new Date(d.getTime() + WIB_MS).toISOString().slice(0, 10);
/** Instan untuk tanggal WIB `iso` pukul `jam:menit` WIB. */
export const instanWib = (iso: string, jam: number, menit = 0): Date =>
  new Date(Date.parse(`${iso}T00:00:00Z`) - WIB_MS + (jam * 60 + menit) * 60_000);
export const tambahHariIso = (iso: string, n: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const hariMinggu = (iso: string): number => new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0=Min … 6=Sab

export function adalahHariKerja(iso: string, peta?: PetaLibur | null): boolean {
  const d = hariMinggu(iso);
  if (d === 0 || d === 6) return false;
  return peta?.get(iso)?.libur !== true;
}

/** Tambah `jam` jam kerja ke `mulai` (cermin mgmt_tambah_jam_kerja). */
export function tambahJamKerja(mulai: Date, jam: number, peta?: PetaLibur | null): Date {
  let sisa = Math.round(jam * JAM_MS);
  let iso = isoWib(mulai);
  let t = mulai.getTime();
  for (let i = 0; i < 400; i++) {
    const buka = instanWib(iso, JAM_MULAI).getTime();
    const tutup = instanWib(iso, JAM_SELESAI).getTime();
    if (!adalahHariKerja(iso, peta) || t >= tutup) { iso = tambahHariIso(iso, 1); t = instanWib(iso, JAM_MULAI).getTime(); continue; }
    if (t < buka) t = buka;
    const muat = tutup - t;
    if (sisa <= muat) return new Date(t + sisa);
    sisa -= muat;
    iso = tambahHariIso(iso, 1);
    t = instanWib(iso, JAM_MULAI).getTime();
  }
  throw new Error("tambahJamKerja: melewati 400 hari");
}

/** Hari kerja terakhir sebelum `iso` (cermin mgmt_hari_kerja_sebelum). */
export function hariKerjaSebelum(iso: string, peta?: PetaLibur | null): string {
  let d = tambahHariIso(iso, -1);
  for (let i = 0; i < 400 && !adalahHariKerja(d, peta); i++) d = tambahHariIso(d, -1);
  return d;
}

/** Rapat mingguan pertama pada/sesudah `dariIso`; tergeser ke hari kerja berikutnya bila libur. hariRapat: 1 = Senin. */
export function rapatBerikutnya(dariIso: string, hariRapat: number, peta?: PetaLibur | null): string {
  let d = tambahHariIso(dariIso, -7);                         // rapat minggu lalu yang tergeser libur ikut diperiksa
  while (hariMinggu(d) !== hariRapat % 7) d = tambahHariIso(d, 1);
  for (let k = 0; k < 60; k++, d = tambahHariIso(d, 7)) {
    let r = d;
    for (let i = 0; i < 30 && !adalahHariKerja(r, peta); i++) r = tambahHariIso(r, 1);
    if (r >= dariIso) return r;
  }
  throw new Error("rapatBerikutnya: tidak ditemukan");
}

/** Rapat sasaran & tenggat cek dampak (18.00 hari kerja terakhir sebelum rapat, minimal 1 hari kerja dari diteruskan). */
export function rapatSasaran(diteruskan: Date, hariRapat: number, peta?: PetaLibur | null): { rapat: string; tenggatDampak: Date } {
  const minimal = tambahJamKerja(diteruskan, JAM_PER_HARI, peta).getTime();
  let dari = isoWib(diteruskan);
  for (let i = 0; i < 60; i++) {
    const rapat = rapatBerikutnya(dari, hariRapat, peta);
    const tenggatDampak = instanWib(hariKerjaSebelum(rapat, peta), JAM_SELESAI);
    if (tenggatDampak.getTime() >= minimal) return { rapat, tenggatDampak };
    dari = tambahHariIso(rapat, 1);
  }
  throw new Error("rapatSasaran: tidak ditemukan");
}
