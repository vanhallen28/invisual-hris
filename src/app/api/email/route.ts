// src/app/api/email/route.ts
// Siaran Email (blast) via Resend — HANYA admin @invisual.studio.
// Fallback MODE SIMULASI bila RESEND_API_KEY belum diset.
// Env server-side: RESEND_API_KEY, EMAIL_FROM (mis. "INVISUAL HR <business@invisual.studio>").
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const escapeHtml = (s: string) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function verifyAdmin(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const asUser = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await asUser.auth.getUser(token);
  if (error || !data?.user) return false;
  return String(data.user.email || "").toLowerCase().endsWith("@invisual.studio");
}

export async function POST(req: Request) {
  try {
    // 1) Verifikasi pemanggil = admin
    if (!(await verifyAdmin(req))) {
      return NextResponse.json({ error: "Hanya admin yang dapat mengirim siaran email." }, { status: 403 });
    }

    // 2) Ambil & validasi data
    const { recipients, subject, message } = (await req.json()) || {};
    const list = (Array.isArray(recipients) ? recipients : [])
      .map((e: any) => String(e || "").trim().toLowerCase())
      .filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    const uniq = Array.from(new Set(list));
    if (!uniq.length) return NextResponse.json({ error: "Tidak ada alamat email tujuan yang valid." }, { status: 400 });
    if (!message || !String(message).trim()) return NextResponse.json({ error: "Isi pesan wajib diisi." }, { status: 400 });

    const API_KEY = process.env.RESEND_API_KEY || "";
    const FROM = process.env.EMAIL_FROM || "INVISUAL HR <onboarding@resend.dev>";
    const subj = String(subject || "").trim() || "Pengumuman dari INVISUAL HR";
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#111;white-space:pre-wrap">${escapeHtml(message)}</div>`;

    // 3) MODE SIMULASI (belum ada API key)
    if (!API_KEY) {
      console.log("========================================");
      console.log("🛠️ [SIMULASI EMAIL] SEDANG BERJALAN");
      console.log("📧 Penerima:", uniq.length, "→", uniq.join(", "));
      console.log("📝 Subjek  :", subj);
      console.log("💬 Pesan   :\n", message);
      console.log("========================================");
      return NextResponse.json({ success: true, mode: "SIMULATION", sent: uniq.length });
    }

    // 4) KIRIM ASLI via Resend (batch, tiap penerima email terpisah → privasi terjaga).
    //    Resend batch maksimal 100 email per panggilan → dipotong per 100.
    let sent = 0;
    for (let i = 0; i < uniq.length; i += 100) {
      const chunk = uniq.slice(i, i + 100).map((to: string) => ({ from: FROM, to: [to], subject: subj, html }));
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = result?.message || result?.error?.message || "Gagal mengirim email.";
        return NextResponse.json({ error: msg, sentBeforeError: sent }, { status: 400 });
      }
      sent += chunk.length;
    }

    return NextResponse.json({ success: true, mode: "LIVE", sent });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Kesalahan server" }, { status: 500 });
  }
}
