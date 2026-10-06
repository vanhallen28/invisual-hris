// src/lib/cloudinary/aturan.ts
// Aturan bersama (dipakai browser & server) untuk kompresi media lewat Cloudinary.
// TIDAK berisi rahasia apa pun — kunci API hanya dibaca di server (lib/cloudinary/server.ts).
//
// Ringkasnya:
//   • Gambar: sisi terpanjang maks 1600 px (avatar & stiker 512 px), kualitas otomatis (q_auto).
//   • Video : sisi terpanjang maks 1280 px (≈720p), kualitas otomatis, disimpan sebagai MP4.
//   • HEIC/HEIF (foto iPhone) diubah ke JPG agar terbuka di semua peramban.
//   • Bukan gambar/video, SVG, atau terlalu besar → TIDAK lewat Cloudinary (alur lama).

/** Untuk apa media diunggah. Menentukan folder, ukuran maksimal & publik/privat. */
export type TujuanMedia = "avatar" | "stiker" | "chat" | "tugas" | "dokumen" | "setoran" | "pesan" | "absen";
export type JenisMedia = "image" | "video";

export const SEMUA_TUJUAN: TujuanMedia[] = ["avatar", "stiker", "chat", "tugas", "dokumen", "setoran", "pesan", "absen"];

/**
 * Privat = hanya dikompres oleh Cloudinary, hasilnya disimpan kembali ke Supabase
 * (bucket privat + aturan aksesnya tetap). Salinan sementara di Cloudinary langsung dihapus.
 */
export const TUJUAN_PRIVAT: TujuanMedia[] = ["pesan", "absen"];
export const tujuanPrivat = (t: TujuanMedia) => TUJUAN_PRIVAT.includes(t);

/** Tujuan yang hanya menerima gambar (video tidak dikompres untuk tujuan ini). */
const HANYA_GAMBAR: TujuanMedia[] = ["avatar", "stiker", "absen"];
export const tujuanTerimaVideo = (t: TujuanMedia) => !HANYA_GAMBAR.includes(t);

export const BATAS = {
  /** Batas paket Free Cloudinary untuk gambar. */
  gambarMaksByte: 10 * 1024 * 1024,
  /** Batas video yang bisa diproses langsung (paket Free: 40 MB). */
  videoMaksByte: 40 * 1024 * 1024,
  gambarPx: 1600,
  gambarKecilPx: 512,
  videoPx: 1280,
};

const PX_GAMBAR: Partial<Record<TujuanMedia, number>> = { avatar: BATAS.gambarKecilPx, stiker: BATAS.gambarKecilPx };

const EKS_GAMBAR = ["jpg", "jpeg", "jfif", "png", "gif", "webp", "heic", "heif", "avif", "bmp"];
const EKS_VIDEO = ["mp4", "m4v", "mov", "qt", "webm", "3gp", "3g2", "mkv", "avi", "mpeg", "mpg", "ogv", "wmv"];

/** Format masukan yang boleh diunggah tanpa konversi (ikut ditandatangani server → tak bisa diakali). */
export const FORMAT_DIIZINKAN: Record<JenisMedia, string> = {
  image: "jpg,jpeg,png,gif,webp,heic,heif,avif,bmp",
  video: "mp4,mov,webm,3gp,3g2,mkv,avi,mpeg,ogv,wmv,m4v",
};

/**
 * Nilai allowed_formats untuk unggahan. PENTING (aturan Cloudinary): bila `format` ikut
 * dikirim, konversi HANYA berlaku untuk berkas yang formatnya TIDAK ada di allowed_formats.
 * Jadi: video → allowed "mp4" (selain MP4 dikonversi ke MP4); HEIC → daftar tanpa heic/heif
 * (HEIC dikonversi ke JPG). Tanpa konversi → daftar lengkap (format lain ditolak).
 */
export function formatDiizinkan(jenis: JenisMedia, format?: string): string {
  if (jenis === "video") return format === "mp4" ? "mp4" : FORMAT_DIIZINKAN.video;
  if (format === "jpg") return "jpg,jpeg,png,gif,webp,avif,bmp";
  return FORMAT_DIIZINKAN.image;
}

const ekstensi = (nama?: string | null) => {
  const m = /\.([a-z0-9]+)$/i.exec(String(nama || "").trim());
  return m ? m[1]!.toLowerCase() : "";
};

/** Jenis media dari tipe MIME (atau ekstensi nama berkas bila tipe kosong). SVG = bukan gambar raster. */
export function jenisMedia(tipe?: string | null, nama?: string | null): JenisMedia | null {
  const t = String(tipe || "").toLowerCase();
  if (t === "image/svg+xml" || ekstensi(nama) === "svg") return null;
  // TIFF/PSD/ikon dll. sengaja tidak (berlapis / tak cocok ditransformasi).
  if (t.startsWith("image/")) return /^image\/(jpe?g|pjpeg|png|gif|webp|heic|heif|avif|bmp)$/.test(t) || EKS_GAMBAR.includes(ekstensi(nama)) ? "image" : null;
  if (t.startsWith("video/")) return "video";
  const e = ekstensi(nama);
  if (EKS_GAMBAR.includes(e)) return "image";
  if (EKS_VIDEO.includes(e)) return "video";
  return null;
}

/** Media ini boleh dikompres Cloudinary untuk tujuan tersebut? (jenis, dan ukuran di dalam batas) */
export function bisaDikompres(berkas: { size?: number; type?: string; name?: string } | null | undefined, tujuan: TujuanMedia): JenisMedia | null {
  if (!berkas) return null;
  const jenis = jenisMedia(berkas.type, berkas.name);
  if (!jenis) return null;
  if (jenis === "video" && HANYA_GAMBAR.includes(tujuan)) return null;
  const ukuran = Number(berkas.size || 0);
  if (ukuran <= 0) return null;
  if (jenis === "image" && ukuran > BATAS.gambarMaksByte) return null;
  if (jenis === "video" && ukuran > BATAS.videoMaksByte) return null;
  return jenis;
}

/** Transformasi masuk (incoming) — dijalankan Cloudinary SEBELUM berkas disimpan. */
export function transformasiMasuk(tujuan: TujuanMedia, jenis: JenisMedia): string {
  if (jenis === "video") return `c_limit,w_${BATAS.videoPx},h_${BATAS.videoPx}/q_auto`;
  const px = PX_GAMBAR[tujuan] || BATAS.gambarPx;
  return `c_limit,w_${px},h_${px}/q_auto`;
}

/** Format keluaran bila perlu diubah (HEIC → JPG, video → MP4). undefined = format asli. */
export function formatKeluaran(jenis: JenisMedia, tipe?: string | null, nama?: string | null): string | undefined {
  if (jenis === "video") return "mp4";
  const t = String(tipe || "").toLowerCase();
  const e = ekstensi(nama);
  if (t === "image/heic" || t === "image/heif" || e === "heic" || e === "heif") return "jpg";
  return undefined;
}

const MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif", bmp: "image/bmp",
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
};
/** Tipe MIME dari format hasil Cloudinary (cadangan: tipe asli). */
export const mimeDariFormat = (format?: string | null, cadangan = "") => MIME[String(format || "").toLowerCase()] || cadangan;

/** Ganti ekstensi nama berkas sesuai format hasil (mis. foto.heic → foto.jpg). */
export function namaDenganFormat(nama: string, format?: string | null): string {
  const f = String(format || "").toLowerCase();
  if (!f) return nama;
  const dasar = String(nama || "berkas").replace(/\.[a-z0-9]+$/i, "");
  const lama = ekstensi(nama);
  if (lama === f || (lama === "jpeg" && f === "jpg")) return nama;
  return `${dasar}.${f}`;
}

/** Nama aman untuk public_id Cloudinary (huruf, angka, _ dan -; maks 60 karakter). */
export function namaAman(nama?: string | null): string {
  const dasar = String(nama || "").replace(/\.[a-z0-9]+$/i, "");
  const aman = dasar.normalize("NFKD").replace(/[^\w-]+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
  return aman || "berkas";
}

/* ── Penanda aset Cloudinary (disimpan di kolom path, mis. setoran_posts.storage_path) ── */
export const AWALAN_PENANDA = "cloudinary:";
export type AsetCloudinary = { resourceType: JenisMedia; type: "upload" | "authenticated"; publicId: string };

export const buatPenanda = (a: AsetCloudinary) => `${AWALAN_PENANDA}${a.resourceType}:${a.type}:${a.publicId}`;

export function uraiPenanda(s?: string | null): AsetCloudinary | null {
  const m = /^cloudinary:(image|video):(upload|authenticated):(.+)$/.exec(String(s || ""));
  if (!m) return null;
  return { resourceType: m[1] as JenisMedia, type: m[2] as "upload" | "authenticated", publicId: m[3]! };
}

export const adalahPenanda = (s?: string | null) => String(s || "").startsWith(AWALAN_PENANDA);
