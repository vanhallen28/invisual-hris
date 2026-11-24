// src/app/api/management/pengingat/route.ts
// Pengingat pagi Section Management: Vercel Cron "30 1 * * 1-5" (08.30 WIB, Senin–Jumat; hari libur dilewati).
// Hanya menerima header `Authorization: Bearer <CRON_SECRET>` (dikirim otomatis oleh Vercel Cron bila env CRON_SECRET diisi).
// Logika ada di lib/management/pengingat; push lewat lib/server/kirimPush. Respons tidak memuat rincian penerima.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cronSah, jalankanPengingat } from "@/lib/management/pengingat";
import { kirimPush } from "@/lib/server/kirimPush";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronSah(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Tidak berwenang." }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const service = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !service || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "Env push belum lengkap (SUPABASE_SERVICE_ROLE / VAPID)." }, { status: 500 });
  }
  try {
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const r = await jalankanPengingat(admin, (ids, isi) => kirimPush(admin, ids, isi), new Date());
    if ("dilewati" in r) return NextResponse.json(r);
    return NextResponse.json({ ok: true, dikirim: r.dikirim, terkirim: r.terkirim });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal menjalankan pengingat." }, { status: 500 });
  }
}
