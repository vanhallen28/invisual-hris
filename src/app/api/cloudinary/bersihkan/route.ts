// src/app/api/cloudinary/bersihkan/route.ts
// Menghapus salinan sementara di Cloudinary (<folder>/sementara/…) yang tertinggal
// lebih dari 1 jam — mis. bila peramban tertutup sebelum sempat menghapusnya
// setelah mengompres foto absen / lampiran Pesan Pribadi.
//
// Dipanggil oleh Vercel Cron harian (GET, header Authorization: Bearer <CRON_SECRET>),
// atau oleh HR (POST, sesi @invisual.studio) untuk menjalankan manual.
import { NextResponse } from "next/server";
import { adalahHR, asetSementaraLama, hapusAset, konfigurasiCloudinary, penggunaDari, tokenDari } from "@/lib/cloudinary/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UMUR_MS = 60 * 60 * 1000;
const jawab = (isi: unknown, status = 200) => NextResponse.json(isi, { status, headers: { "Cache-Control": "no-store" } });

async function berwenang(req: Request): Promise<boolean> {
  const token = tokenDari(req);
  if (!token) return false;
  const rahasia = process.env.CRON_SECRET;
  if (rahasia && token === rahasia) return true;
  const p = await penggunaDari(req);
  return !!p && adalahHR(p.email);
}

async function jalankan(req: Request) {
  if (!(await berwenang(req))) return jawab({ error: "Tidak berwenang." }, 401);
  const k = konfigurasiCloudinary({ abaikanSakelar: true });   // tetap membersihkan walau unggahan dimatikan
  if (!k) return jawab({ ok: true, nonaktif: true, dihapus: 0 });
  try {
    const lama = await asetSementaraLama(k, UMUR_MS);
    const dihapus = lama.length ? await hapusAset(k, lama) : [];
    return jawab({ ok: true, ditemukan: lama.length, dihapus: dihapus.length });
  } catch (e: any) {
    return jawab({ error: e?.message || "Gagal membersihkan." }, 500);
  }
}

export async function GET(req: Request) { return jalankan(req); }
export async function POST(req: Request) { return jalankan(req); }
