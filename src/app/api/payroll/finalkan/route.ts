// src/app/api/payroll/finalkan/route.ts
// Finalkan periode (potret kehadiran + kunci) atau buka kunci (final → draf).
// Hanya HR (@invisual.studio). Logika di lib/payroll/server.ts.
//   body { periodeId, aksi: "final" }  → finalkanPeriode (mengembalikan userIds untuk push)
//   body { periodeId, aksi: "draf" }   → bukaKunciPeriode
import { NextResponse } from "next/server";
import { verifikasiHR, klienService, finalkanPeriode, bukaKunciPeriode, uuidValid } from "@/lib/payroll/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const hr = await verifikasiHR(req);
    if (!hr) return NextResponse.json({ error: "Hanya HR yang boleh mengelola payroll." }, { status: 403 });
    const sb = klienService();
    if (!sb) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE belum diset di server." }, { status: 500 });
    const body = (await req.json().catch(() => ({}))) || {};
    const id = String(body.periodeId || "");
    if (!uuidValid(id)) return NextResponse.json({ error: "periodeId tidak valid." }, { status: 400 });
    if (body.aksi !== "final" && body.aksi !== "draf") return NextResponse.json({ error: 'aksi harus "final" atau "draf".' }, { status: 400 });
    const hasil = body.aksi === "draf" ? await bukaKunciPeriode(sb, id, hr.email) : await finalkanPeriode(sb, id, hr.email);
    if (!hasil.ok) return NextResponse.json({ error: hasil.pesan }, { status: hasil.status });
    return NextResponse.json(hasil);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Kesalahan server" }, { status: 500 });
  }
}
