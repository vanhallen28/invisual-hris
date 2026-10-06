// src/app/api/cloudinary/status/route.ts
// Status kompresi media untuk halaman Pengaturan (KHUSUS HR @invisual.studio):
// aktif/tidak, cloud name, folder, dan pemakaian kredit akun Cloudinary.
// Tidak pernah mengirim API key / secret.
import { NextResponse } from "next/server";
import { adalahHR, konfigurasiCloudinary, pemakaianCloudinary, penggunaDari, sengajaDimatikan } from "@/lib/cloudinary/server";

export const dynamic = "force-dynamic";

const jawab = (isi: unknown, status = 200) => NextResponse.json(isi, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const pengguna = await penggunaDari(req);
  if (!pengguna || !adalahHR(pengguna.email)) return jawab({ error: "Tidak berwenang." }, 401);

  const k = konfigurasiCloudinary();
  if (!k) {
    return jawab({ aktif: false, alasan: sengajaDimatikan() && konfigurasiCloudinary({ abaikanSakelar: true }) ? "dimatikan" : "env" });
  }
  try {
    const u = await pemakaianCloudinary(k);
    return jawab({
      aktif: true,
      cloudName: k.cloudName,
      folder: k.folder,
      pemakaian: {
        paket: u?.plan ?? null,
        kredit: u?.credits ? { terpakai: u.credits.usage ?? null, batas: u.credits.limit ?? null, persen: u.credits.used_percent ?? null } : null,
        penyimpananByte: u?.storage?.usage ?? null,
        bandwidthByte: u?.bandwidth?.usage ?? null,
        transformasi: u?.transformations?.usage ?? null,
        jumlahAset: u?.resources ?? null,
        diperbarui: u?.last_updated ?? null,
      },
    });
  } catch (e: any) {
    // Kunci terisi tapi ditolak Cloudinary (salah ketik / dicabut)
    return jawab({ aktif: true, cloudName: k.cloudName, folder: k.folder, galat: e?.message || "Gagal menghubungi Cloudinary." });
  }
}
