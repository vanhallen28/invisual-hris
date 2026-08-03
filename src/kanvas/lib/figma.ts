// src/kanvas/lib/figma.ts
//
// Menampilkan papan Figma / FigJam hidup di dalam HRIS lewat Embed Kit 2.0.
//
// Caranya sederhana: URL berkas diubah subdomainnya dari `www` menjadi
// `embed`. Tidak ada API key, tidak ada token — Figma yang mengurus
// otentikasinya sendiri di dalam iframe.
//
// BATAS YANG PERLU DIINGAT
//   • Yang membuka tetap butuh akses ke berkas Figma itu. Tanpa akses,
//     yang muncul layar login Figma, bukan papannya. Ini bukan bug.
//   • Embed hanya bekerja di aplikasi berbasis browser.

/**
 * Pola resmi URL Figma (dari dokumentasi Embed Kit). Mencakup
 * /design, /board (FigJam), /slides, /deck, /proto, dan /file lama.
 */
const POLA_FIGMA = /^https:\/\/[\w.-]*\.?figma\.com\/([\w-]+)\/([0-9a-zA-Z]{22,128})(?:\/.*)?$/;

/**
 * Penanda situs pemanggil. Wajib diisi dan harus mengenali situs kita
 * secara unik — Figma memakainya untuk memeriksa konteks embed.
 */
const EMBED_HOST = 'invisual-hris';

/** Jenis berkas yang bisa ditampilkan sebagai embed. */
const JENIS_DIDUKUNG = ['design', 'board', 'slides', 'deck', 'proto', 'file'];

export type PapanFigma = {
  sah: boolean;
  jenis?: string;
  /** URL siap pakai untuk atribut src pada iframe. */
  urlEmbed?: string;
  galat?: string;
};

/** Label ramah untuk tiap jenis berkas. */
export const labelJenis = (jenis?: string) =>
  ({ board: 'FigJam', design: 'Figma Design', slides: 'Figma Slides',
     deck: 'Figma Slides', proto: 'Prototipe', file: 'Figma Design' } as Record<string, string>)[
    jenis || ''
  ] || 'Figma';

/**
 * Memeriksa URL Figma dan menyusun URL embed-nya.
 *
 * Sengaja mengembalikan alasan kegagalan, bukan sekadar null — supaya
 * pengguna yang salah tempel tahu apa yang perlu diperbaiki.
 */
export function periksaUrlFigma(masukan: string): PapanFigma {
  const url = String(masukan || '').trim();
  if (!url) return { sah: false, galat: 'Tautan masih kosong.' };

  if (!/^https:\/\//i.test(url)) {
    return { sah: false, galat: 'Tautan harus diawali https:// — salin langsung dari bilah alamat Figma.' };
  }

  const cocok = POLA_FIGMA.exec(url);
  if (!cocok) {
    return { sah: false, galat: 'Ini bukan tautan berkas Figma. Contoh yang benar: https://www.figma.com/board/…' };
  }

  const [, jenis, kunci] = cocok;
  if (!JENIS_DIDUKUNG.includes(jenis)) {
    return { sah: false, galat: `Jenis berkas "${jenis}" belum bisa ditampilkan sebagai embed.` };
  }

  // Parameter query dari URL asal (node-id, t, dsb) sengaja DIBUANG.
  // `t=` adalah token sesi pribadi yang tidak boleh ikut tersimpan, dan
  // node-id membuat papan selalu terbuka di satu titik yang mungkin sudah
  // tidak relevan bagi orang lain.
  //
  // `embed-host` WAJIB. Tanpa itu Figma menolak dengan layar
  // "Not a valid embed context" — bukan galat jaringan, melainkan
  // penolakan Figma karena situs pemanggilnya tidak menyebut identitas.
  return {
    sah: true,
    jenis,
    urlEmbed: `https://embed.figma.com/${jenis}/${kunci}?embed-host=${EMBED_HOST}`,
  };
}

/** Nama dugaan dari URL, dipakai kalau pengguna tidak mengisi nama. */
export function namaDariUrl(url: string): string {
  try {
    const bagian = new URL(url).pathname.split('/').filter(Boolean);
    const mentah = bagian[2] ? decodeURIComponent(bagian[2]) : '';
    const bersih = mentah.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    return bersih.slice(0, 60) || 'Papan Figma';
  } catch {
    return 'Papan Figma';
  }
}
