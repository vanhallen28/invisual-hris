// src/lib/media.ts — kompresi otomatis gambar & video lewat Cloudinary (sisi peramban).
//
// Dua cara pakai:
//   • unggahMediaPublik  → media publik (avatar, chat, Daily Task, dokumen, stiker, Setoran)
//                          diunggah ke Cloudinary, dikompres saat masuk, dan DISIMPAN serta
//                          ditayangkan dari Cloudinary. Hasil: URL publik Cloudinary.
//   • kompresMediaPrivat → media privat (lampiran Pesan Pribadi, selfie absen) hanya
//                          DIKOMPRES Cloudinary; hasilnya dikembalikan sebagai File untuk
//                          disimpan ke Supabase seperti biasa. Salinan di Cloudinary
//                          langsung dihapus (cadangan: pembersih harian).
//
// PRINSIP: tidak pernah menggagalkan unggahan. Bila Cloudinary belum diatur (env kosong),
// berkas bukan gambar/video, terlalu besar, atau ada galat apa pun → fungsi mengembalikan
// null dan pemanggil memakai alur lama (Supabase) persis seperti sebelumnya.
import {
  bisaDikompres, buatPenanda, mimeDariFormat, namaDenganFormat, tujuanPrivat,
  type AsetCloudinary, type JenisMedia, type TujuanMedia,
} from "@/lib/cloudinary/aturan";

type SB = any;
type Berkas = Blob & { name?: string; type: string; size: number };

export type HasilCloudinary = {
  url: string;           // secure_url (https)
  penanda: string;       // "cloudinary:<image|video>:<upload|authenticated>:<public_id>"
  nama: string;          // nama berkas sesuai format hasil (mis. .heic → .jpg)
  tipe: string;          // MIME hasil
  ukuran: number;        // byte hasil
  jenis: JenisMedia;
};

// Bila server menjawab "nonaktif" (env belum diisi), jangan bertanya lagi selama 30 menit
// (diingat juga di perangkat, agar tiap buka halaman tidak menambah satu permintaan sia-sia).
const KUNCI_NONAKTIF = "invisual_cloudinary_nonaktif_sampai";
const JEDA_NONAKTIF_MS = 30 * 60 * 1000;
let nonaktifSampai = 0;
try { nonaktifSampai = Number(globalThis.localStorage?.getItem(KUNCI_NONAKTIF)) || 0; } catch { /* diamkan */ }
const tandaiNonaktif = () => {
  nonaktifSampai = Date.now() + JEDA_NONAKTIF_MS;
  try { globalThis.localStorage?.setItem(KUNCI_NONAKTIF, String(nonaktifSampai)); } catch { /* diamkan */ }
};
/** Server baru saja menyatakan Cloudinary belum aktif (env kosong / dimatikan). */
export const cloudinaryDiketahuiNonaktif = () => Date.now() < nonaktifSampai;

async function tokenSesi(supabase: SB): Promise<string> {
  try {
    const { data } = await supabase.auth.getSession();
    return String(data?.session?.access_token || "");
  } catch {
    return "";
  }
}

async function denganBatasWaktu<T>(ms: number, kerja: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await kerja(ac.signal); } finally { clearTimeout(t); }
}

/** Unggah ke Cloudinary dengan tanda tangan dari server. null = tidak bisa / gagal (pakai alur lama). */
async function unggahKeCloudinary(supabase: SB, berkas: Berkas, tujuan: TujuanMedia, batasMs?: number): Promise<(HasilCloudinary & { aset: AsetCloudinary }) | null> {
  const nama = String(berkas.name || "berkas");
  const jenis = bisaDikompres({ size: berkas.size, type: berkas.type, name: nama }, tujuan);
  if (!jenis) return null;
  if (cloudinaryDiketahuiNonaktif()) return null;
  if (typeof window === "undefined" || typeof fetch !== "function") return null;

  const token = await tokenSesi(supabase);
  if (!token) return null;

  try {
    const mulai = Date.now();
    const tt = await denganBatasWaktu(Math.min(15000, batasMs ?? 15000), (signal) => fetch("/api/cloudinary/tanda-tangan", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ tujuan, jenis, nama, tipe: berkas.type || "" }),
      signal,
    }));
    if (tt.status === 503) { tandaiNonaktif(); return null; }
    if (!tt.ok) return null;
    const izin: any = await tt.json();
    if (!izin?.cloudName || !izin?.signature || !izin?.params) return null;

    const fd = new FormData();
    // Media privat: nama asli TIDAK dikirim ke Cloudinary (salinan sementara, nama netral).
    fd.append("file", berkas, tujuanPrivat(tujuan) ? `media.${(/\.([a-z0-9]+)$/i.exec(nama)?.[1] || "bin").toLowerCase()}` : nama);
    fd.append("api_key", String(izin.apiKey));
    fd.append("signature", String(izin.signature));
    Object.entries(izin.params as Record<string, string | number>).forEach(([k, v]) => fd.append(k, String(v)));

    // Dengan batasMs, SELURUH langkah (tanda tangan + unggah) wajib muat di dalamnya.
    const ms = batasMs != null ? batasMs - (Date.now() - mulai) : (jenis === "video" ? 5 * 60 * 1000 : 60 * 1000);
    if (ms < 300) return null;
    // Batas waktu mencakup pembacaan isi jawaban juga (bukan hanya sampai header tiba).
    const { ok, status, j } = await denganBatasWaktu(ms, async (signal) => {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(izin.cloudName)}/${jenis}/upload`, { method: "POST", body: fd, signal });
      return { ok: res.ok, status: res.status, j: (await res.json().catch(() => null)) as any };
    });
    if (!ok || !j?.secure_url || !j?.public_id) {
      console.warn("[media] Cloudinary menolak unggahan:", j?.error?.message || status);
      return null;
    }
    const resourceType: JenisMedia = j.resource_type === "video" ? "video" : "image";
    const aset: AsetCloudinary = { resourceType, type: j.type === "authenticated" ? "authenticated" : "upload", publicId: String(j.public_id) };
    return {
      url: String(j.secure_url),
      penanda: buatPenanda(aset),
      nama: namaDenganFormat(nama, j.format),
      tipe: mimeDariFormat(j.format, berkas.type || ""),
      ukuran: Number(j.bytes) || 0,
      jenis: resourceType,
      aset,
    };
  } catch (e: any) {
    console.warn("[media] kompresi Cloudinary dilewati:", e?.message || e);
    return null;
  }
}

/**
 * Media publik: unggah ke Cloudinary (dikompres otomatis) dan kembalikan URL publiknya.
 * null → pemanggil memakai alur unggah lama ke Supabase.
 */
export async function unggahMediaPublik(supabase: SB, berkas: Berkas, tujuan: Exclude<TujuanMedia, "pesan" | "absen">): Promise<HasilCloudinary | null> {
  const h = await unggahKeCloudinary(supabase, berkas, tujuan);
  if (!h) return null;
  return { url: h.url, penanda: h.penanda, nama: h.nama, tipe: h.tipe, ukuran: h.ukuran, jenis: h.jenis };
}

/**
 * Media privat: kompres lewat Cloudinary lalu kembalikan hasilnya sebagai File
 * (untuk disimpan ke Supabase seperti biasa). Salinan di Cloudinary langsung dihapus.
 * null → tidak bisa / gagal / hasil tidak lebih kecil → pakai berkas asli.
 */
export async function kompresMediaPrivat(supabase: SB, berkas: Berkas, tujuan: "pesan" | "absen", opsi?: { batasMs?: number }): Promise<File | null> {
  const mulai = Date.now();
  const batas = opsi?.batasMs;
  const h = await unggahKeCloudinary(supabase, berkas, tujuan, batas);
  if (!h) return null;
  try {
    const sisa = batas ? batas - (Date.now() - mulai) : (h.jenis === "video" ? 5 * 60 * 1000 : 60 * 1000);
    if (sisa < 200) return null;   // waktu habis → pakai berkas asli (salinan tetap dihapus di finally)
    const blob = await denganBatasWaktu(sisa, async (signal) => {
      const res = await fetch(h.url, { signal, cache: "no-store" });
      return res.ok ? await res.blob() : null;
    });
    if (!blob) return null;
    if (!blob.size || blob.size >= berkas.size) return null;   // tidak lebih kecil → pakai asli
    return new File([blob], h.nama, { type: h.tipe || blob.type || berkas.type, lastModified: Date.now() });
  } catch (e: any) {
    console.warn("[media] hasil kompresi tidak bisa diambil:", e?.message || e);
    return null;
  } finally {
    // Hapus salinan sementara (tetap jalan walau halaman ditutup: keepalive).
    void hapusMediaCloudinary(supabase, [h.penanda], { keepalive: true });
  }
}

/** Hapus aset Cloudinary (penanda dari HasilCloudinary.penanda). Tidak pernah melempar. */
export async function hapusMediaCloudinary(supabase: SB, penanda: string[], opsi?: { keepalive?: boolean }): Promise<string[]> {
  const daftar = Array.from(new Set((penanda || []).filter((p) => typeof p === "string" && p.startsWith("cloudinary:"))));
  if (!daftar.length) return [];
  const token = await tokenSesi(supabase);
  if (!token) return [];
  const terhapus: string[] = [];
  for (let i = 0; i < daftar.length; i += 100) {
    try {
      const res = await fetch("/api/cloudinary/hapus", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ penanda: daftar.slice(i, i + 100) }),
        keepalive: !!opsi?.keepalive,
      });
      if (!res.ok) continue;
      const j: any = await res.json().catch(() => null);
      if (Array.isArray(j?.dihapus)) terhapus.push(...j.dihapus);
    } catch { /* diamkan */ }
  }
  return terhapus;
}
