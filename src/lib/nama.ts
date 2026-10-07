/**
 * Merapikan tampilan nama karyawan.
 *
 * Sebagian data lama tersimpan HURUF BESAR SEMUA ("DEZKA RIVA ARVIANA")
 * sementara sebagian lain normal ("Dezka Riva Arviana"), sehingga orang
 * yang sama terlihat berbeda antar halaman.
 *
 * Fungsi ini HANYA memperbaiki TAMPILAN — data di Supabase tidak diubah.
 * Nama yang sudah normal dibiarkan apa adanya, jadi aman dipakai di mana pun.
 */

// Partikel nama Indonesia yang lazim ditulis huruf kecil di tengah nama.
const KECIL = new Set(["bin", "binti", "van", "von", "de", "da", "del", "di", "al"]);

function kapitalKata(kata: string): string {
  if (!kata) return kata;

  // Pertahankan tanda hubung & apostrof: "abdul-aziz" → "Abdul-Aziz"
  if (kata.includes("-")) return kata.split("-").map(kapitalKata).join("-");
  if (kata.includes("'")) return kata.split("'").map(kapitalKata).join("'");

  return kata.charAt(0).toUpperCase() + kata.slice(1).toLowerCase();
}

export function rapikanNama(nama?: string | null): string {
  const asli = String(nama ?? "").trim();
  if (!asli) return "";

  // Kalau BUKAN huruf besar semua, biarkan — mungkin memang ditulis begitu.
  const adaHurufKecil = /[a-z]/.test(asli);
  if (adaHurufKecil) return asli;

  return asli
    .split(/\s+/)
    .map((kata, i) => {
      const rendah = kata.toLowerCase();
      if (i > 0 && KECIL.has(rendah)) return rendah;
      return kapitalKata(kata);
    })
    .join(" ");
}

/**
 * Nama panggilan untuk daftar ringkas (Log absensi live, Butuh persetujuan,
 * Sedang Online di Dasbor) supaya nama panjang tidak terpotong.
 *
 * Urutan: kolom `employees.panggilan` bila diisi HR → kalau kosong, kata
 * pertama nama resmi → bila kata pertama itu kembar dengan karyawan aktif lain
 * (dua "Ahmad"), dipakai dua kata pertama agar tetap bisa dibedakan.
 * Hanya tampilan; data tidak diubah. Karyawan yang tidak ada di `employees`
 * memakai `cadangan` (nama dari baris attendance/approvals) dengan aturan sama.
 */
export function petaPanggilan(employees: any[] | undefined): Map<string, string> {
  const daftar = (Array.isArray(employees) ? employees : []).map((e) => ({
    id: String(e?.idKaryawan ?? "").trim(),
    panggilan: String(e?.panggilan ?? "").trim(),
    kata: rapikanNama(e?.nama).split(/\s+/).filter(Boolean),
  })).filter((e) => e.id);
  const hitungDepan = new Map<string, number>();
  daftar.forEach((e) => {
    if (e.panggilan || !e.kata[0]) return;
    const k = e.kata[0].toLowerCase();
    hitungDepan.set(k, (hitungDepan.get(k) || 0) + 1);
  });
  const peta = new Map<string, string>();
  daftar.forEach((e) => {
    if (e.panggilan) { peta.set(e.id, e.panggilan); return; }
    if (!e.kata[0]) return;
    const kembar = (hitungDepan.get(e.kata[0].toLowerCase()) || 0) > 1;
    peta.set(e.id, kembar ? e.kata.slice(0, 2).join(" ") : e.kata[0]);
  });
  return peta;
}

export function namaPanggilan(
  idKaryawan: string | number | null | undefined,
  employees: any[] | undefined,
  cadangan?: string | null,
): string {
  const id = String(idKaryawan ?? "").trim();
  const dariPeta = id ? petaPanggilan(employees).get(id) : undefined;
  if (dariPeta) return dariPeta;
  return rapikanNama(cadangan).split(/\s+/).filter(Boolean)[0] || "";
}

/**
 * Mengambil nama resmi dari daftar employees (sumber kebenaran) berdasarkan
 * idKaryawan. Nama di tabel attendance/approvals bisa beda tulisan, jadi
 * selalu utamakan nama dari employees bila ada.
 */
export function namaResmi(
  idKaryawan: string | number | null | undefined,
  employees: any[] | undefined,
  cadangan?: string | null,
): string {
  const id = String(idKaryawan ?? "");
  const emp = id && Array.isArray(employees)
    ? employees.find((e) => String(e?.idKaryawan ?? "") === id)
    : undefined;
  return rapikanNama(emp?.nama ?? cadangan ?? "");
}
