// src/lib/karyawanPublik.ts
// Membaca data UMUM karyawan lain (nama, panggilan, avatar, jabatan, divisi, jadwal kerja).
//
// Sejak keamanan-tahap2.sql, tabel `employees` hanya menampilkan baris MILIK SENDIRI
// (HR tetap melihat semua). Data umum rekan kerja dibaca lewat view `employees_publik`
// yang TIDAK memuat gaji, NIK, rekening, alamat, kontak darurat, dsb.
//
// Aman dipasang sebelum SQL dijalankan: bila view belum ada → otomatis memakai tabel
// `employees` seperti dulu, jadi tidak ada halaman yang kosong selama masa peralihan.
type Hasil = { data: any; error: any };

const VIEW = "employees_publik";
let viewTidakAda = false;   // diingat per muat halaman agar tidak dua kali bertanya ke server

// HANYA "view/tabel tidak ditemukan" — galat lain (mis. kolom tak ada) dikembalikan apa adanya,
// supaya satu kueri yang keliru tidak membuat halaman lain ikut pindah ke tabel employees.
const galatViewTidakAda = (err: any) => {
  const code = String(err?.code || ""), msg = String(err?.message || "");
  return code === "PGRST205" || code === "42P01" || /could not find the table|relation "?[\w.]*employees_publik"? does not exist/i.test(msg);
};

/**
 * @param sb      klien Supabase
 * @param bangun  susun kueri dari `sb.from(...)`, mis. `(q) => q.select("idKaryawan, nama")`
 */
export async function bacaKaryawanPublik(sb: any, bangun: (q: any) => any): Promise<Hasil> {
  if (!viewTidakAda) {
    const r: Hasil = await bangun(sb.from(VIEW));
    if (!r?.error || !galatViewTidakAda(r.error)) return r;
    viewTidakAda = true;
  }
  return await bangun(sb.from("employees"));
}
