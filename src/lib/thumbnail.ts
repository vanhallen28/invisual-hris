// src/lib/thumbnail.ts
// Versi kecil foto avatar dari Cloudinary untuk TAMPILAN saja. Avatar disimpan 512 px,
// padahal ditampilkan 16–128 px; thumbnail 256 px (q_auto, f_auto → WebP/AVIF bila didukung)
// biasanya ±5–15 KB, bukan ±30–60 KB. Berkas aslinya tidak diubah.
// Hanya URL gambar publik Cloudinary (…/image/upload/…) yang diubah; URL lain (Supabase,
// data:, blob:, privat/authenticated, video) dikembalikan apa adanya. Bila thumbnail gagal
// dimuat (mis. akun Cloudinary memakai "strict transformations"), komponen avatar memakai URL asli.
export const UKURAN_THUMBNAIL = 256;

export function urlThumbnail(url: string | null | undefined, px = UKURAN_THUMBNAIL): string {
  const u = String(url ?? "");
  if (!u) return "";
  const m = u.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/);
  if (!m) return u;
  const sisa = m[2]!;
  const t = `c_fill,g_face,w_${px},h_${px},q_auto,f_auto`;
  if (sisa.startsWith(t + "/")) return u;   // sudah thumbnail
  return `${m[1]}${t}/${sisa}`;
}
