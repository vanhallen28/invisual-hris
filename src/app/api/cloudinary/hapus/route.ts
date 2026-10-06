// src/app/api/cloudinary/hapus/route.ts
// Hapus aset Cloudinary milik aplikasi.
//
// Boleh menghapus bila:
//   • salinan sementara milik pemanggil sendiri (<folder>/sementara/<uid>/…), atau
//   • media yang diunggah pemanggil sendiri (<folder>/<tujuan>/<uid>/…), atau
//   • pemanggil HR (@invisual.studio), atau
//   • manager — HANYA untuk Setoran (hapus setoran anggota & pembersihan 30 hari).
// Aset di luar folder aplikasi selalu ditolak.
import { NextResponse } from "next/server";
import { adalahHR, adalahManager, hapusAset, konfigurasiCloudinary, penggunaDari } from "@/lib/cloudinary/server";
import { SEMUA_TUJUAN, uraiPenanda, type AsetCloudinary, type TujuanMedia } from "@/lib/cloudinary/aturan";

export const dynamic = "force-dynamic";

const MAKS = 100;
const jawab = (isi: unknown, status = 200) => NextResponse.json(isi, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  // Hapus tetap jalan walau unggahan baru dimatikan (CLOUDINARY_AKTIF=0).
  const k = konfigurasiCloudinary({ abaikanSakelar: true });
  if (!k) return jawab({ nonaktif: true }, 503);
  const pengguna = await penggunaDari(req);
  if (!pengguna) return jawab({ error: "Tidak berwenang." }, 401);

  let body: any = null;
  try { body = await req.json(); } catch { /* badan kosong */ }
  const masuk: unknown[] = Array.isArray(body?.penanda) ? body.penanda : [];
  const aset = Array.from(new Set(masuk.filter((x): x is string => typeof x === "string")))
    .slice(0, MAKS)
    .map((p) => uraiPenanda(p))
    .filter((a): a is AsetCloudinary => !!a);

  const hr = adalahHR(pengguna.email);
  let manager: boolean | null = null;
  const boleh: AsetCloudinary[] = [];
  const ditolak: string[] = [];
  for (const a of aset) {
    const bagian = a.publicId.startsWith(`${k.folder}/`) ? a.publicId.slice(k.folder.length + 1).split("/") : [];
    const [tujuan, pemilik] = bagian;
    let ok = false;
    if (bagian.length >= 3 && !bagian.some((b) => b === "" || b === "." || b === "..")) {
      if (tujuan === "sementara") ok = a.type === "authenticated" && (pemilik === pengguna.id || hr);
      else if (SEMUA_TUJUAN.includes(tujuan as TujuanMedia) && a.type === "upload") {
        if (pemilik === pengguna.id || hr) ok = true;
        else if (tujuan === "setoran") {
          if (manager === null) manager = await adalahManager(pengguna.id, pengguna.token);
          ok = manager;
        }
      }
    }
    if (ok) boleh.push(a); else ditolak.push(a.publicId);
  }

  const dihapus = boleh.length ? await hapusAset(k, boleh) : [];
  return jawab({ dihapus, ditolak });
}
