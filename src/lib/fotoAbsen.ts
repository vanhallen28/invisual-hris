// src/lib/fotoAbsen.ts
//
// Foto selfie absensi (clock-in / clock-out).
//
// SEBELUMNYA foto hanya dipakai untuk tampilan lalu dibuang — tidak pernah
// disimpan. Sekarang disimpan ke bucket PRIVAT `foto-absen`, path
// `<auth uid>/<tanggal>_<masuk|keluar>_<waktu>.jpg`, dan path-nya dicatat di
// kolom attendance.foto_masuk / foto_keluar. Hanya HR (@invisual.studio) dan
// pemilik foto yang bisa membukanya (lihat foto-absen.sql). Foto dihapus
// otomatis setelah UMUR_FOTO_HARI oleh /api/foto-absen/bersihkan.
//
// PRINSIP: menyimpan foto TIDAK BOLEH mengganggu absensi. Semua fungsi di sini
// tidak pernah melempar galat; absen tetap tercatat walau foto gagal tersimpan
// (mis. SQL belum dijalankan, koneksi putus).

import { kompresMediaPrivat } from "@/lib/media";

type SB = any;

export const BUCKET_FOTO_ABSEN = "foto-absen";
export const UMUR_FOTO_HARI = 7;
/** Hari pertama fitur foto absen aktif — galeri tidak menampilkan tanggal sebelum ini (belum ada foto). */
export const FOTO_ABSEN_MULAI = "2026-10-06";

/** Perkecil foto (sisi terpanjang ≤ maks px, JPEG mutu 0,7) → ±40–80 KB. */
async function kompres(dataUrl: string, maks = 720, mutu = 0.7): Promise<Blob | null> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const skala = Math.min(1, maks / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * skala));
    c.height = Math.max(1, Math.round(img.naturalHeight * skala));
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob | null>((ok) => c.toBlob((b) => ok(b), "image/jpeg", mutu));
  } catch {
    return null;
  }
}

/**
 * Unggah foto absen lalu catat path-nya di baris attendance.
 * Dipanggil SETELAH absen berhasil tercatat; tidak perlu ditunggu (fire-and-forget).
 */
export async function simpanFotoAbsen(
  supabase: SB,
  p: { dataUrl: string | null | undefined; jenis: "masuk" | "keluar"; tanggal: string; idKaryawan?: string; idAbsen?: any },
): Promise<boolean> {
  let path = "";
  try {
    if (!p.dataUrl) return false;
    const { data } = await supabase.auth.getSession();
    const uid = data?.session?.user?.id;
    if (!uid) return false;
    let blob: Blob | null = await kompres(p.dataUrl);
    if (!blob) return false;
    // Kompres lanjutan oleh Cloudinary (bila aktif; maks ±3 dtk agar sisa waktu cukup untuk
    // menyimpan ke Supabase). Hasil tetap disimpan PRIVAT di Supabase; salinan di Cloudinary
    // langsung dihapus. Gagal / lewat batas / tidak lebih kecil → hasil kompresi lokal.
    const lanjut = await kompresMediaPrivat(supabase, new File([blob], "selfie.jpg", { type: "image/jpeg" }), "absen", { batasMs: 3000 });
    if (lanjut && lanjut.type === "image/jpeg") blob = lanjut;

    path = `${uid}/${p.tanggal}_${p.jenis}_${Date.now()}.jpg`;
    const up = await supabase.storage.from(BUCKET_FOTO_ABSEN).upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "3600" });
    if (up.error) { console.warn("[foto absen] unggah gagal:", up.error.message); return false; }

    const kolom = p.jenis === "masuk" ? "foto_masuk" : "foto_keluar";
    let q = supabase.from("attendance").update({ [kolom]: path });
    q = p.idAbsen != null ? q.eq("id", p.idAbsen) : q.eq("idKaryawan", p.idKaryawan).eq("tanggal", p.tanggal);
    const { error } = await q;
    if (error) {
      // Berkas yatim (mis. kolom belum dibuat) TIDAK dihapus dari sini — karyawan
      // sengaja tak diberi hak hapus foto. Pembersih harian menghapusnya ≤ 7 hari.
      console.warn("[foto absen] gagal mencatat path:", error.message);
      return false;
    }
    return true;
  } catch (e: any) {
    console.warn("[foto absen] gagal:", e?.message || e);
    return false;
  }
}

/**
 * Tautan sementara (1 jam) untuk sekumpulan path foto absen.
 *   1. Langsung ke Supabase Storage dengan sesi HR (aturan storage: HR + pemilik).
 *   2. Path yang ditolak di langkah 1 dimintakan ke /api/foto-absen/url (server,
 *      khusus HR) — cadangan bila aturan storage di proyek belum sesuai.
 * `hilang` = path yang tercatat di absensi tetapi berkasnya tidak ada di storage.
 * `ditolak` = path yang bukan pola foto absen (tidak akan pernah bisa dibuka).
 * Tidak pernah melempar galat.
 */
export async function ambilUrlFotoAbsen(
  supabase: SB,
  paths: (string | null | undefined)[],
): Promise<{ url: Record<string, string>; hilang: Set<string>; ditolak: Set<string> }> {
  const unik = Array.from(new Set(paths.filter((x): x is string => !!x)));
  const url: Record<string, string> = {};
  const hilang = new Set<string>();
  const ditolak = new Set<string>();
  if (!unik.length) return { url, hilang, ditolak };

  try {
    for (let i = 0; i < unik.length; i += 100) {
      const { data } = await supabase.storage.from(BUCKET_FOTO_ABSEN).createSignedUrls(unik.slice(i, i + 100), 3600);
      (data || []).forEach((d: any) => { if (d?.signedUrl && d?.path) url[d.path] = d.signedUrl; });
    }
  } catch { /* lanjut ke cadangan server */ }

  const sisa = unik.filter((p) => !url[p]);
  if (sisa.length) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        for (let i = 0; i < sisa.length; i += 200) {
          const res = await fetch("/api/foto-absen/url", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ paths: sisa.slice(i, i + 200) }),
          });
          if (!res.ok) continue;
          const j = await res.json().catch(() => null);
          Object.entries(j?.url || {}).forEach(([p, u]) => { if (typeof u === "string" && u) url[p] = u; });
          (Array.isArray(j?.hilang) ? j.hilang : []).forEach((p: any) => { if (typeof p === "string") hilang.add(p); });
          (Array.isArray(j?.ditolak) ? j.ditolak : []).forEach((p: any) => { if (typeof p === "string") ditolak.add(p); });
        }
      }
    } catch { /* diamkan */ }
  }
  return { url, hilang, ditolak };
}

/** Tautan sementara (1 jam) untuk sekumpulan path. Gagal → peta kosong. */
export async function urlFotoAbsen(supabase: SB, paths: (string | null | undefined)[]): Promise<Record<string, string>> {
  return (await ambilUrlFotoAbsen(supabase, paths)).url;
}

/**
 * Tunggu sebuah proses paling lama `ms` milidetik, lalu lanjut apa pun hasilnya.
 * Dipakai agar unggahan selfie sempat selesai sebelum tombol absen selesai
 * "memuat" (karyawan sering langsung menutup aplikasi setelah absen), tanpa
 * pernah menahan absensi lebih lama dari batas ini.
 */
export function tungguMaksimal<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return new Promise((selesai) => {
    const t = setTimeout(() => selesai(undefined), ms);
    p.then(
      (v) => { clearTimeout(t); selesai(v); },
      () => { clearTimeout(t); selesai(undefined); },
    );
  });
}

/** Selisih hari (b − a) untuk tanggal "YYYY-MM-DD". */
const selisih = (a: string, b: string) => {
  const u = (s: string) => { const [y, m, d] = String(s).split("-").map(Number); return Date.UTC(y || 1970, (m || 1) - 1, d || 1); };
  return Math.round((u(b) - u(a)) / 86400000);
};

/** Foto absen tanggal ini sudah melewati masa simpan? */
export const fotoKedaluwarsa = (tanggal: string, hariIni: string) => selisih(String(tanggal || "").slice(0, 10), hariIni) >= UMUR_FOTO_HARI;

const KUNCI_BERSIH = "invisual_foto_absen_dibersihkan";

/**
 * Picu pembersihan foto lama dari sisi HR, paling sering sekali sehari per
 * perangkat. Cadangan bila Vercel Cron belum aktif. Tidak pernah melempar.
 */
export async function mintaBersihkanFotoLama(supabase: SB): Promise<void> {
  try {
    const hari = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem(KUNCI_BERSIH) === hari) return; } catch { /* diamkan */ }
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/foto-absen/bersihkan", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { try { localStorage.setItem(KUNCI_BERSIH, hari); } catch { /* diamkan */ } }
  } catch { /* diamkan */ }
}
