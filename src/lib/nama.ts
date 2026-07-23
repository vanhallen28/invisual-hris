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
