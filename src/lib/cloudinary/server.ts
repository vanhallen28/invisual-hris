// src/lib/cloudinary/server.ts — HANYA untuk server (route handler). Jangan diimpor dari komponen browser.
//
// Membaca kunci Cloudinary dari environment, membuat tanda tangan unggahan,
// menghapus aset, dan membaca pemakaian akun. Bila env belum diisi, semua fitur
// Cloudinary otomatis NONAKTIF dan aplikasi memakai alur unggah lama (Supabase).
//
// Env (lihat .env.example):
//   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
//   — atau cukup CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
//   CLOUDINARY_FOLDER (opsional, bawaan "invisual-hris")
//   CLOUDINARY_AKTIF  (opsional; isi 0 untuk mematikan sementara tanpa menghapus kunci)
import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { AsetCloudinary } from "@/lib/cloudinary/aturan";

export type KonfigCloudinary = { cloudName: string; apiKey: string; apiSecret: string; folder: string };

const API = "https://api.cloudinary.com/v1_1";

export const sengajaDimatikan = () =>
  ["0", "false", "off", "tidak", "nonaktif", "no"].includes(String(process.env.CLOUDINARY_AKTIF ?? "").trim().toLowerCase());

/**
 * Konfigurasi dari env, atau null bila kunci belum lengkap / sengaja dimatikan.
 * `abaikanSakelar`: untuk HAPUS & PEMBERSIHAN — tetap berjalan walau unggahan baru
 * dimatikan (CLOUDINARY_AKTIF=0), agar berkas lama di Cloudinary tidak terbengkalai.
 */
export function konfigurasiCloudinary(opsi?: { abaikanSakelar?: boolean }): KonfigCloudinary | null {
  if (!opsi?.abaikanSakelar && sengajaDimatikan()) return null;

  let cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  let apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  let apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();
  const url = String(process.env.CLOUDINARY_URL || "").trim();
  if ((!cloudName || !apiKey || !apiSecret) && url) {
    const m = /^cloudinary:\/\/([^:]+):([^@]+)@([^/?#\s]+)/.exec(url);
    if (m) {
      try {
        apiKey = apiKey || decodeURIComponent(m[1]!);
        apiSecret = apiSecret || decodeURIComponent(m[2]!);
      } catch { /* format rusak → dianggap kosong */ }
      cloudName = cloudName || m[3]!;
    }
  }
  if (!cloudName || !apiKey || !apiSecret) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName)) return null;

  const folder = String(process.env.CLOUDINARY_FOLDER || "invisual-hris").trim()
    .replace(/[^A-Za-z0-9_/-]/g, "_").replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "") || "invisual-hris";
  return { cloudName, apiKey, apiSecret, folder };
}

/** Tanda tangan Upload API: parameter diurutkan, "k=v" digabung "&", lalu + api_secret → SHA-1 (hex). */
export function tandaTangan(params: Record<string, string | number | boolean | undefined | null>, apiSecret: string): string {
  const isi = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(isi + apiSecret).digest("hex");
}

const basicAuth = (k: KonfigCloudinary) => "Basic " + Buffer.from(`${k.apiKey}:${k.apiSecret}`).toString("base64");

/* ── Pengguna & peran ─────────────────────────────────────────────── */

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const tokenDari = (req: Request) => (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

/** Pengguna yang memanggil (dari token sesi Supabase), atau null. */
export async function penggunaDari(req: Request): Promise<{ id: string; email: string; token: string } | null> {
  const token = tokenDari(req);
  if (!token || !URL_SB || !ANON) return null;
  try {
    const sb = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data } = await sb.auth.getUser(token);
    const u = data?.user;
    if (!u?.id) return null;
    return { id: String(u.id), email: String(u.email || "").toLowerCase(), token };
  } catch {
    return null;
  }
}

export const adalahHR = (email: string) => String(email || "").toLowerCase().endsWith("@invisual.studio");

/** members.role === 'manager' (dipakai untuk izin menghapus media orang lain, mis. pembersihan Setoran). */
export async function adalahManager(uid: string, token: string): Promise<boolean> {
  try {
    const sb = SERVICE
      ? createClient(URL_SB, SERVICE, { auth: { persistSession: false } })
      : createClient(URL_SB, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data } = await sb.from("members").select("role").eq("id", uid).maybeSingle();
    return String(data?.role || "") === "manager";
  } catch {
    return false;
  }
}

/* ── Hapus aset ───────────────────────────────────────────────────── */

async function hapusSatu(k: KonfigCloudinary, a: AsetCloudinary): Promise<boolean> {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { invalidate: "true", public_id: a.publicId, timestamp, type: a.type };
  const body = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([x, y]) => [x, String(y)])), api_key: k.apiKey, signature: tandaTangan(params, k.apiSecret) });
  const res = await fetch(`${API}/${k.cloudName}/${a.resourceType}/destroy`, { method: "POST", body });
  if (!res.ok) return false;
  const j: any = await res.json().catch(() => null);
  return j?.result === "ok" || j?.result === "not found";
}

async function hapusBanyak(k: KonfigCloudinary, resourceType: string, type: string, ids: string[]): Promise<string[]> {
  // Daftar id dikirim di BADAN permintaan (bukan query string) agar URL tidak kepanjangan.
  const badan = new URLSearchParams();
  ids.forEach((id) => badan.append("public_ids[]", id));
  badan.set("invalidate", "true");
  const res = await fetch(`${API}/${k.cloudName}/resources/${resourceType}/${type}`, {
    method: "DELETE",
    headers: { Authorization: basicAuth(k), "Content-Type": "application/x-www-form-urlencoded" },
    body: badan.toString(),
  });
  if (!res.ok) return [];
  const j: any = await res.json().catch(() => null);
  const hasil = j?.deleted || {};
  return ids.filter((id) => hasil[id] === "deleted" || hasil[id] === "not_found");
}

/** Hapus aset (1 aset → Upload API destroy; banyak → Admin API per 100). Mengembalikan publicId yang terhapus. */
export async function hapusAset(k: KonfigCloudinary, daftar: AsetCloudinary[]): Promise<string[]> {
  const terhapus: string[] = [];
  const grup = new Map<string, AsetCloudinary[]>();
  daftar.forEach((a) => { const kunci = `${a.resourceType}|${a.type}`; grup.set(kunci, [...(grup.get(kunci) || []), a]); });
  for (const [kunci, isi] of grup) {
    const [resourceType, type] = kunci.split("|") as [string, string];
    if (isi.length === 1) {
      try { if (await hapusSatu(k, isi[0]!)) terhapus.push(isi[0]!.publicId); } catch { /* lanjut */ }
      continue;
    }
    for (let i = 0; i < isi.length; i += 100) {
      try { terhapus.push(...(await hapusBanyak(k, resourceType, type, isi.slice(i, i + 100).map((a) => a.publicId)))); } catch { /* lanjut */ }
    }
  }
  return terhapus;
}

/** Aset sementara (salinan kompresi media privat) yang lebih tua dari `umurMs`. */
export async function asetSementaraLama(k: KonfigCloudinary, umurMs: number): Promise<AsetCloudinary[]> {
  const batas = Date.now() - umurMs;
  const out: AsetCloudinary[] = [];
  for (const resourceType of ["image", "video"] as const) {
    let cursor = "";
    for (let putaran = 0; putaran < 20; putaran++) {
      const q = new URLSearchParams({ prefix: `${k.folder}/sementara/`, max_results: "500" });
      if (cursor) q.set("next_cursor", cursor);
      const res = await fetch(`${API}/${k.cloudName}/resources/${resourceType}/authenticated?${q.toString()}`, { headers: { Authorization: basicAuth(k) } });
      if (!res.ok) break;
      const j: any = await res.json().catch(() => null);
      (j?.resources || []).forEach((r: any) => {
        const t = new Date(r?.created_at || 0).getTime();
        if (r?.public_id && Number.isFinite(t) && t > 0 && t < batas) out.push({ resourceType, type: "authenticated", publicId: String(r.public_id) });
      });
      cursor = String(j?.next_cursor || "");
      if (!cursor) break;
    }
  }
  return out;
}

/** Pemakaian akun (kredit, penyimpanan, bandwidth, transformasi). */
export async function pemakaianCloudinary(k: KonfigCloudinary): Promise<any> {
  const res = await fetch(`${API}/${k.cloudName}/usage`, { headers: { Authorization: basicAuth(k) }, cache: "no-store" });
  const j: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.error?.message || `Cloudinary menjawab ${res.status}`);
  return j;
}
