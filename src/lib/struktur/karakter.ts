// src/lib/struktur/karakter.ts
// Karakter di Struktur = avatar karyawan yang SAMA dengan halaman Karyawan & Kehadiran (komponen AvatarKaryawan,
// sumber employees.avatarUrl). Staf sudah membawa idKaryawan dari org_struktur(). Pemegang posisi management
// & owner hanya membawa nama panggilan, jadi di sini nama → idKaryawan dicocokkan lewat view employees_publik
// (idKaryawan, nama, panggilan — tanpa data pribadi). Nama yang dipakai lebih dari satu karyawan diabaikan
// (tampil inisial, bukan foto orang yang salah). Gagal memuat → peta kosong → inisial. Murni agar bisa diuji node.
/* eslint-disable @typescript-eslint/no-explicit-any -- klien supabase diteruskan dari pemanggil */
import { bacaKaryawanPublik } from "../karyawanPublik";

/** nama/panggilan (dinormalkan) → idKaryawan, hanya yang unik. */
export type PetaIdKaryawan = Map<string, string>;
export const PETA_KOSONG: PetaIdKaryawan = new Map();

export const normNama = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function susunPetaId(baris: any[]): PetaIdKaryawan {
  const peta: PetaIdKaryawan = new Map(), ganda = new Set<string>();
  for (const e of baris || []) {
    const id = e?.idKaryawan != null && e.idKaryawan !== "" ? String(e.idKaryawan) : "";
    if (!id) continue;
    for (const n of new Set([normNama(e?.panggilan), normNama(e?.nama)])) {
      if (!n || ganda.has(n)) continue;
      if (peta.has(n) && peta.get(n) !== id) { peta.delete(n); ganda.add(n); continue; }
      peta.set(n, id);
    }
  }
  return peta;
}

export const idKaryawanUntuk = (peta: PetaIdKaryawan, nama: string | null | undefined): string | null => peta.get(normNama(nama)) || null;

export async function muatPetaId(sb: any): Promise<PetaIdKaryawan> {
  try {
    const { data, error } = await bacaKaryawanPublik(sb, (q: any) => q.select("idKaryawan, nama, panggilan"));
    if (error || !Array.isArray(data)) return PETA_KOSONG;
    return susunPetaId(data);
  } catch {
    return PETA_KOSONG;
  }
}
