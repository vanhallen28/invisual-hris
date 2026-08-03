// src/kanvas/lib/impor.ts
//
// Pengenalan format berkas untuk impor kanvas.
//
// KENAPA .fig TIDAK DIBACA LANGSUNG
// Format .fig milik Figma bersifat tertutup: biner terkompresi (Kiwi),
// tanpa spesifikasi publik, dan Figma bebas mengubahnya kapan saja tanpa
// pemberitahuan. Pustaka pihak ketiga memang ada, tetapi rapuh — begitu
// Figma mengubah format, impor berhenti bekerja tanpa peringatan.
//
// Jadi .fig sengaja DIKENALI, bukan diabaikan: penggunanya diberi tahu
// persis apa yang harus dilakukan, bukan dibiarkan bertanya-tanya kenapa
// berkasnya tidak muncul.

export const FORMAT_DIDUKUNG = ['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif'];

/**
 * Nilai untuk atribut accept pada <input type="file">.
 *
 * .fig dan .pdf sengaja IKUT bisa dipilih meski belum didukung — supaya
 * penggunanya dapat panduan yang jelas, bukan berkasnya kelabu di dialog
 * tanpa penjelasan apa pun.
 */
export const ACCEPT_IMPOR = [...FORMAT_DIDUKUNG, '.fig', '.pdf'].join(',');

const ekstensi = (nama: string) => {
  const t = String(nama || '').toLowerCase();
  const i = t.lastIndexOf('.');
  return i < 0 ? '' : t.slice(i);
};

export const berkasFigma = (f: File) => ekstensi(f.name) === '.fig';

export const berkasDidukung = (f: File) =>
  FORMAT_DIDUKUNG.includes(ekstensi(f.name)) || f.type.startsWith('image/');

/**
 * Panduan saat pengguna menjatuhkan berkas .fig.
 *
 * Sengaja menyebut DUA jalur, karena pilihan ekspor Figma berbeda menurut
 * jenis berkasnya — dan ini sumber kebingungan yang nyata:
 *   • Berkas Design (figma.com/design/…) → ada SVG. Hasilnya vektor,
 *     tetap bisa diedit di kanvas.
 *   • Papan FigJam (figma.com/board/…)   → TIDAK ada SVG. Hanya PNG, JPG,
 *     PDF, CSV. Untuk papan, PNG-lah jawabannya.
 */
export const PESAN_FIG =
  'Berkas .fig belum bisa dibaca langsung — formatnya tertutup dan bisa berubah ' +
  'sewaktu-waktu oleh Figma.\n\n' +
  'Kalau desainnya berkas Figma Design: pilih frame → Export → SVG (hasilnya tetap vektor).\n' +
  'Kalau papan FigJam: pilihan SVG memang tidak ada — pakai Export → PNG, ' +
  'dan atur Export area ke seluruh papan atau bagian yang diinginkan.';

/** PDF dikenali terpisah supaya panduannya bisa spesifik. */
const POLA_PDF = /\.pdf$/i;

/** Pesan untuk format yang memang tidak didukung sama sekali. */
export const pesanTakDidukung = (f: File) => {
  if (POLA_PDF.test(f.name)) {
    return 'Berkas PDF belum bisa dibaca kanvas. Dari FigJam atau Figma, ' +
      'ekspor ulang sebagai PNG — hasilnya langsung bisa diimpor ke sini.';
  }
  return `Format ${ekstensi(f.name) || 'ini'} belum didukung. ` +
    `Yang bisa diimpor: ${FORMAT_DIDUKUNG.join(', ')}.`;
};

/**
 * Memilah sekumpulan berkas jadi tiga: yang bisa dipakai, berkas .fig,
 * dan sisanya. Dipakai bersama oleh tombol impor dan seret-lepas supaya
 * keduanya tidak punya aturan sendiri-sendiri.
 */
export function pilahBerkas(daftar: File[]) {
  const dipakai: File[] = [], fig: File[] = [], ditolak: File[] = [];
  for (const f of daftar) {
    if (berkasFigma(f)) fig.push(f);
    else if (berkasDidukung(f)) dipakai.push(f);
    else ditolak.push(f);
  }
  return { dipakai, fig, ditolak };
}
