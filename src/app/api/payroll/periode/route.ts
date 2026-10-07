// src/app/api/payroll/periode/route.ts
// Buat periode gaji (+ slip tiap karyawan aktif) atau sinkronkan karyawan baru.
// Hanya HR (@invisual.studio). Logika di lib/payroll/server.ts.
//   body { dari, sampai }                → buatPeriode
//   body { periodeId, sinkron: true }    → sinkronPeriode
import { NextResponse } from "next/server";
import { verifikasiHR, klienService, buatPeriode, sinkronPeriode, uuidValid } from "@/lib/payroll/server";

export async function POST(req: Request) {
  try {
    const hr = await verifikasiHR(req);
    if (!hr) return NextResponse.json({ error: "Hanya HR yang boleh mengelola payroll." }, { status: 403 });
    const sb = klienService();
    if (!sb) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE belum diset di server." }, { status: 500 });
    const body = (await req.json().catch(() => ({}))) || {};
    if (body.sinkron && !uuidValid(body.periodeId)) return NextResponse.json({ error: "periodeId tidak valid." }, { status: 400 });
    const hasil = body.sinkron
      ? await sinkronPeriode(sb, String(body.periodeId), hr.email)
      : await buatPeriode(sb, { dari: String(body.dari || ""), sampai: String(body.sampai || "") }, hr.email);
    if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });
    return NextResponse.json(hasil);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Kesalahan server" }, { status: 500 });
  }
}
