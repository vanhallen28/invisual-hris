// src/app/api/reset-attendance/route.ts
// Eksekusi Reset Absensi di sisi server (service_role).
// Pengaman berlapis:
//   1. Wajib sesi Supabase yang valid (token dikirim dari kartu Reset).
//   2. Wajib email @invisual.studio (admin).
//   3. Owner DITOLAK di server — bukan sekadar disembunyikan di UI.
//   4. Wajib password khusus dari env RESET_ATTENDANCE_PASSWORD.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { OWNER_EMAILS } from "@/lib/owners";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  "";

/** Tanggal batas (YYYY-MM-DD) untuk rentang; null = semua data. */
function cutoffFor(range: string): string | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json(
        { error: "Server belum dikonfigurasi (SUPABASE_SERVICE_ROLE_KEY tidak ditemukan)." },
        { status: 500 },
      );
    }
    const expectedPassword = process.env.RESET_ATTENDANCE_PASSWORD;
    if (!expectedPassword) {
      return NextResponse.json(
        { error: "RESET_ATTENDANCE_PASSWORD belum diatur di environment server." },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const range: string = body?.range || "";
    const password: string = body?.password || "";
    const includeApprovals: boolean = body?.includeApprovals === true;

    if (!["7d", "30d", "all"].includes(range)) {
      return NextResponse.json({ error: "Rentang tidak valid." }, { status: 400 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // 1) Verifikasi sesi pemanggil
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Sesi tidak ditemukan. Silakan login ulang." }, { status: 401 });
    }
    const { data: userData } = await admin.auth.getUser(token);
    const email = userData?.user?.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login ulang." }, { status: 401 });
    }

    // 2) Hanya admin
    if (!email.endsWith("@invisual.studio")) {
      return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
    }

    // 3) Owner tidak boleh reset absensi
    if (OWNER_EMAILS.includes(email)) {
      return NextResponse.json(
        { error: "Akun Owner tidak memiliki hak untuk mereset data absensi." },
        { status: 403 },
      );
    }

    // 4) Password khusus
    if (password !== expectedPassword) {
      return NextResponse.json({ error: "Password khusus salah." }, { status: 401 });
    }

    // ── Eksekusi penghapusan ──
    const cutoff = cutoffFor(range);

    let attQuery = admin.from("attendance").delete();
    attQuery = cutoff ? attQuery.gte("tanggal", cutoff) : attQuery.not("idKaryawan", "is", null);
    const { data: attDeleted, error: attError } = await attQuery.select("idKaryawan");
    if (attError) {
      return NextResponse.json({ error: "Gagal menghapus absensi: " + attError.message }, { status: 500 });
    }

    let approvalsDeleted = 0;
    if (includeApprovals) {
      let apprQuery = admin.from("approvals").delete();
      // approvals.tanggal berawalan format ISO (YYYY-MM-DD...), jadi perbandingan
      // teks tetap tepat untuk tanggal mulai pengajuan.
      apprQuery = cutoff ? apprQuery.gte("tanggal", cutoff) : apprQuery.not("id", "is", null);
      const { data: apprData, error: apprError } = await apprQuery.select("id");
      if (apprError) {
        return NextResponse.json(
          {
            error: "Absensi terhapus, tetapi Izin & Cuti gagal dihapus: " + apprError.message,
            attendanceDeleted: attDeleted?.length ?? 0,
          },
          { status: 500 },
        );
      }
      approvalsDeleted = apprData?.length ?? 0;
    }

    return NextResponse.json({
      ok: true,
      range,
      cutoff,
      attendanceDeleted: attDeleted?.length ?? 0,
      approvalsDeleted,
      by: email,
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Terjadi kesalahan: " + (e?.message || String(e)) }, { status: 500 });
  }
}
