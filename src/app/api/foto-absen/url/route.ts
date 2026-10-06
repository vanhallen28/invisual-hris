// src/app/api/foto-absen/url/route.ts
// Tautan sementara (1 jam) foto selfie absensi — KHUSUS HR (@invisual.studio).
//
// Cadangan untuk galeri foto di Dashboard/Kehadiran: aplikasi lebih dulu meminta
// tautan langsung ke Supabase Storage memakai sesi HR. Bila ada foto yang
// ditolak di sana (mis. aturan storage di proyek belum sesuai foto-absen.sql),
// sisanya dimintakan ke rute ini yang memakai service_role (server-only).
//
// Aman: hanya akun @invisual.studio, hanya bucket `foto-absen`, hanya path yang
// berpola foto absen (<uid>/<YYYY-MM-DD>_<masuk|keluar>_<waktu>.jpg), maks 200
// path per permintaan. Tidak ada unggah/hapus di sini.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "foto-absen";
const MAKS_PATH = 200;
const UMUR_TAUTAN_DETIK = 3600;
const POLA_PATH = /^[A-Za-z0-9-]{1,64}\/\d{4}-\d{2}-\d{2}_(masuk|keluar)_\d{1,16}\.(jpg|jpeg|png|webp)$/;

const jawab = (isi: unknown, status = 200) =>
  NextResponse.json(isi, { status, headers: { "Cache-Control": "no-store" } });

async function hrBerwenang(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  try {
    const asUser = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data } = await asUser.auth.getUser(token);
    return String(data?.user?.email || "").toLowerCase().endsWith("@invisual.studio");
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!URL_SB || !ANON || !SERVICE || SERVICE === ANON) {
    return jawab({ error: "Server belum dikonfigurasi (SUPABASE_SERVICE_ROLE tidak ditemukan)." }, 500);
  }
  if (!(await hrBerwenang(req))) return jawab({ error: "Tidak berwenang." }, 401);

  let body: any = null;
  try { body = await req.json(); } catch { /* badan kosong / bukan JSON */ }
  const masuk: unknown[] = Array.isArray(body?.paths) ? body.paths : [];
  const teks = Array.from(new Set(masuk.filter((p): p is string => typeof p === "string")));
  // Path yang bukan pola foto absen tidak ditandatangani; dikembalikan sebagai `ditolak`.
  const ditolak = teks.filter((p) => !POLA_PATH.test(p)).slice(0, MAKS_PATH);
  const paths = teks.filter((p) => POLA_PATH.test(p)).slice(0, MAKS_PATH);
  if (!paths.length) return jawab({ url: {}, hilang: [], ditolak });

  try {
    const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
    const { data, error } = await admin.storage.from(BUCKET).createSignedUrls(paths, UMUR_TAUTAN_DETIK);
    if (error) return jawab({ error: error.message }, 502);
    const url: Record<string, string> = {};
    const hilang: string[] = [];
    (data || []).forEach((d: any) => {
      if (!d?.path) return;
      if (d.signedUrl) url[d.path] = d.signedUrl;
      // service_role tidak dibatasi aturan akses → gagal di sini = berkasnya tidak ada di storage
      else if (/not.?found|does not exist/i.test(String(d.error || ""))) hilang.push(d.path);
    });
    return jawab({ url, hilang, ditolak });
  } catch (e: any) {
    return jawab({ error: e?.message || "Gagal membuat tautan foto." }, 500);
  }
}
