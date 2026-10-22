// src/lib/sesiLokal.ts
// Penyimpanan sesi di localStorage (audit keamanan 22 Okt 2026):
//  • Hanya identitas yang dibutuhkan tampilan (nama, email, idKaryawan, jabatan, sisaCuti, …) —
//    gaji, NIK, NPWP, rekening, BPJS, alamat, tanggal lahir, dokumen TIDAK ikut disimpan
//    (dulu baris `employees` lengkap tersimpan dan tertinggal setelah logout di perangkat bersama).
//  • hapusSesiLokal() membersihkan SEMUA kunci sesi — dipakai di setiap tombol/halaman keluar.
// Catatan: localStorage bukan pengaman hak akses — server & RLS tetap penentunya.

/** Kolom `employees` yang tidak boleh tersimpan di peramban. */
const KOLOM_SENSITIF = new Set([
  "gajipokok", "gajiPokok", "gaji", "tunjangan", "nikKtp", "nik", "npwp", "noRekening", "namaBank", "atasNamaRekening",
  "bpjsKesehatan", "bpjsKetenagakerjaan", "noBpjs", "alamatKtp", "alamatDomisili", "tempatLahir", "tanggalLahir",
  "dokumen", "noPonsel", "kontakDarurat", "pendidikanNama", "pendidikanJurusan", "pendidikanStatus",
]);

export function tanpaDataSensitif<T extends Record<string, any>>(o: T | null | undefined): Partial<T> {
  if (!o || typeof o !== "object") return {};
  return Object.fromEntries(Object.entries(o).filter(([k]) => !KOLOM_SENSITIF.has(k) && !/^bpjs/i.test(k))) as Partial<T>;
}

/** Simpan objek sesi tanpa kolom sensitif. */
export function simpanSesi(kunci: "invisual_session" | "invisualUserSession", obj: Record<string, any> | null | undefined) {
  try { localStorage.setItem(kunci, JSON.stringify(tanpaDataSensitif(obj))); } catch { /* penyimpanan penuh/terblokir */ }
}

/** Hapus semua jejak sesi (dipanggil saat keluar). Preferensi tampilan (tema, papan aktif) dibiarkan. */
export function hapusSesiLokal() {
  try {
    localStorage.removeItem("invisual_session");
    localStorage.removeItem("invisualUserSession");
  } catch { /* abaikan */ }
  try { sessionStorage.removeItem("invisual_sembunyi_anomali"); } catch { /* abaikan */ }
}
