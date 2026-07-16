// src/app/api/wa/route.ts
// Siaran WhatsApp (blast) via gateway Fonnte — HANYA admin @invisual.studio.
// Fallback MODE SIMULASI bila FONNTE_TOKEN belum diset.
// Env server-side: FONNTE_TOKEN (dari fonnte.com, JANGAN diawali NEXT_PUBLIC_).
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function verifyAdmin(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const asUser = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await asUser.auth.getUser(token);
  if (error || !data?.user) return false;
  return String(data.user.email || "").toLowerCase().endsWith("@invisual.studio");
}

export async function POST(request: Request) {
  try {
    // 1) Verifikasi pemanggil = admin
    if (!(await verifyAdmin(request))) {
      return NextResponse.json({ error: "Hanya admin yang dapat mengirim siaran WhatsApp." }, { status: 403 });
    }

    // 2) Data dari frontend
    const body = await request.json();
    const { target, message } = body;
    if (!target || !message) {
      return NextResponse.json({ error: "Nomor tujuan (target) dan pesan (message) wajib diisi." }, { status: 400 });
    }

    // 3) Token gateway (dari .env)
    const FONNTE_TOKEN = process.env.FONNTE_TOKEN || "";

    // 4) MODE SIMULASI (belum ada token)
    if (!FONNTE_TOKEN) {
      console.log("========================================");
      console.log("🛠️ [SIMULASI WHATSAPP] SEDANG BERJALAN");
      console.log("📱 Tujuan :", target);
      console.log("💬 Pesan  :\n", message);
      console.log("========================================");
      return NextResponse.json({
        success: true,
        mode: "SIMULATION",
        message: "Pesan berhasil disimulasikan di terminal console.",
      });
    }

    // 5) KIRIM ASLI ke Fonnte
    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: FONNTE_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ target, message, countryCode: "62" }),
    });
    const result = await response.json();
    if (!response.ok || !result.status) {
      throw new Error(result.reason || "Terjadi kesalahan pada server WhatsApp.");
    }
    return NextResponse.json({ success: true, mode: "LIVE", data: result });
  } catch (error: any) {
    console.error("❌ API WA Error:", error.message);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
