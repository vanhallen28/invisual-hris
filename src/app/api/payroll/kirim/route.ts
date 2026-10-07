// src/app/api/payroll/kirim/route.ts
// Kirim slip gaji (PDF terlampir) via Resend — maksimal 5 slip per panggilan.
// Hanya HR (@invisual.studio). Logika di lib/payroll/server.ts.
//   body { periodeId }                 → slip berstatus `belum` (≤ 5), respons memuat `sisa`
//   body { periodeId, idKaryawan[] }   → kirim (ulang) slip tertentu (≤ 5)
// Env: RESEND_API_KEY (kosong → mode simulasi), EMAIL_FROM.
import { NextResponse } from "next/server";
import { verifikasiHR, klienService, kirimSlipBatch, uuidValid } from "@/lib/payroll/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const hr = await verifikasiHR(req);
    if (!hr) return NextResponse.json({ error: "Hanya HR yang boleh mengirim slip." }, { status: 403 });
    const sb = klienService();
    if (!sb) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE belum diset di server." }, { status: 500 });
    const body = (await req.json().catch(() => ({}))) || {};
    if (!uuidValid(body.periodeId)) return NextResponse.json({ error: "periodeId tidak valid." }, { status: 400 });
    const idKaryawan = Array.isArray(body.idKaryawan) ? body.idKaryawan.map(String).filter(Boolean).slice(0, 50) : undefined;
    const hasil = await kirimSlipBatch(sb, {
      periodeId: String(body.periodeId),
      idKaryawan,
      hrEmail: hr.email,
      apiKey: process.env.RESEND_API_KEY || "",
      from: process.env.EMAIL_FROM || "INVISUAL HR <onboarding@resend.dev>",
    });
    if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });
    return NextResponse.json(hasil);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Kesalahan server" }, { status: 500 });
  }
}
