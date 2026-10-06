// src/app/api/foto-absen/bersihkan/route.ts
// Menghapus foto selfie absensi yang berumur ≥ 7 hari dari bucket privat
// `foto-absen`, lalu mengosongkan kolom attendance.foto_masuk/foto_keluar
// untuk tanggal lama.
//
// Dipanggil oleh:
//   1. Vercel Cron (GET, tiap hari — lihat vercel.json). Vercel mengirim
//      header `Authorization: Bearer <CRON_SECRET>` bila env CRON_SECRET diisi.
//   2. Dashboard HR (POST, maksimal sekali sehari per perangkat) — cadangan
//      kalau cron belum aktif. Wajib sesi akun @invisual.studio.
//
// Berkas storage TIDAK bisa dihapus lewat SQL, jadi pembersihan dilakukan di sini
// memakai service_role (server-only).
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const URL_SB = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const BUCKET = "foto-absen";
const UMUR_HARI = 7;

async function berwenang(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const rahasia = process.env.CRON_SECRET;
  if (rahasia && token === rahasia) return true;
  try {
    const asUser = createClient(URL_SB, ANON, { auth: { persistSession: false } });
    const { data } = await asUser.auth.getUser(token);
    return String(data?.user?.email || "").toLowerCase().endsWith("@invisual.studio");
  } catch {
    return false;
  }
}

async function bersihkan() {
  const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false } });
  const store = admin.storage.from(BUCKET);
  const batas = Date.now() - UMUR_HARI * 86400000;

  // 1) Folder tingkat atas = auth uid tiap karyawan
  const folder: string[] = [];
  for (let off = 0; off < 20000; off += 1000) {
    const { data, error } = await store.list("", { limit: 1000, offset: off });
    if (error) throw new Error(error.message);
    (data || []).forEach((x: any) => { if (!x.id && x.name) folder.push(x.name); });
    if (!data || data.length < 1000) break;
  }

  // 2) Kumpulkan berkas lama (5 folder sekaligus)
  const lama: string[] = [];
  for (let i = 0; i < folder.length; i += 5) {
    await Promise.all(folder.slice(i, i + 5).map(async (f) => {
      for (let off = 0; off < 20000; off += 1000) {
        const { data } = await store.list(f, { limit: 1000, offset: off, sortBy: { column: "created_at", order: "asc" } });
        (data || []).forEach((x: any) => {
          if (!x.id) return;
          const cap = x.created_at || x.updated_at;
          if (!cap) return;                                  // tanpa cap waktu → jangan disentuh
          const t = new Date(cap).getTime();
          if (Number.isFinite(t) && t < batas) lama.push(`${f}/${x.name}`);
        });
        if (!data || data.length < 1000) break;
      }
    }));
  }

  // 3) Hapus per 100 berkas
  let dihapus = 0;
  for (let i = 0; i < lama.length; i += 100) {
    const { data, error } = await store.remove(lama.slice(i, i + 100));
    if (!error) dihapus += (data || []).length;
  }

  // 4) Kosongkan path foto di baris absensi lama (tanggal WIB). Gagal = diamkan
  //    (mis. kolom belum dibuat); berkasnya sendiri sudah terhapus di atas.
  const wib = new Date(Date.now() + 7 * 3600000 - UMUR_HARI * 86400000).toISOString().slice(0, 10);
  const { error: e2 } = await admin
    .from("attendance")
    .update({ foto_masuk: null, foto_keluar: null })
    .lt("tanggal", wib)
    .or("foto_masuk.not.is.null,foto_keluar.not.is.null");

  return { ok: true, folder: folder.length, dihapus, kolomDikosongkan: !e2 };
}

async function jalankan(req: Request) {
  if (!URL_SB || !SERVICE) {
    return NextResponse.json({ error: "Server belum dikonfigurasi (SUPABASE_SERVICE_ROLE tidak ditemukan)." }, { status: 500 });
  }
  if (!(await berwenang(req))) return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  try {
    return NextResponse.json(await bersihkan());
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Gagal membersihkan foto." }, { status: 500 });
  }
}

export async function GET(req: Request) { return jalankan(req); }
export async function POST(req: Request) { return jalankan(req); }
