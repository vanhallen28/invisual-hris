// src/app/api/cloudinary/tanda-tangan/route.ts
// Tanda tangan unggahan langsung dari peramban ke Cloudinary (signed upload).
//
// Server yang menentukan SEMUA parameter penting (folder/public_id, transformasi
// kompresi, format yang diizinkan, publik/privat) lalu menandatanganinya dengan
// API secret — peramban tidak bisa mengubahnya tanpa membuat tanda tangan tidak sah.
// API secret tidak pernah dikirim ke peramban.
//
// 503 { nonaktif: true } = env Cloudinary belum diisi → aplikasi memakai alur lama.
import { NextResponse } from "next/server";
import { randomBytes, randomInt } from "crypto";
import { konfigurasiCloudinary, penggunaDari, tandaTangan } from "@/lib/cloudinary/server";
import {
  SEMUA_TUJUAN, formatDiizinkan, formatKeluaran, namaAman, transformasiMasuk, tujuanPrivat, tujuanTerimaVideo,
  type JenisMedia, type TujuanMedia,
} from "@/lib/cloudinary/aturan";

export const dynamic = "force-dynamic";

const jawab = (isi: unknown, status = 200) => NextResponse.json(isi, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const k = konfigurasiCloudinary();
  if (!k) return jawab({ nonaktif: true }, 503);

  const pengguna = await penggunaDari(req);
  if (!pengguna) return jawab({ error: "Tidak berwenang." }, 401);

  let body: any = null;
  try { body = await req.json(); } catch { /* badan kosong */ }
  const tujuan = String(body?.tujuan || "") as TujuanMedia;
  const jenis = String(body?.jenis || "") as JenisMedia;
  if (!SEMUA_TUJUAN.includes(tujuan)) return jawab({ error: "Tujuan tidak dikenal." }, 400);
  if (jenis !== "image" && jenis !== "video") return jawab({ error: "Jenis media tidak didukung." }, 400);
  if (jenis === "video" && !tujuanTerimaVideo(tujuan)) return jawab({ error: "Video tidak didukung untuk tujuan ini." }, 400);

  const privat = tujuanPrivat(tujuan);
  const unik = `${Date.now()}${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
  const publicId = privat
    // Salinan sementara (dihapus segera setelah hasil kompresinya diambil): nama acak, tanpa nama asli.
    ? `${k.folder}/sementara/${pengguna.id}/${unik}-${randomBytes(12).toString("hex")}`
    // Awalan angka sengaja: tampilan lama membuang "^\d+-" saat menampilkan nama berkas.
    : `${k.folder}/${tujuan}/${pengguna.id}/${unik}-${namaAman(body?.nama)}`;

  const format = formatKeluaran(jenis, body?.tipe, body?.nama);
  const params: Record<string, string | number> = {
    allowed_formats: formatDiizinkan(jenis, format),
    // Tanda tangan tak bisa dipakai ulang untuk MENIMPA berkas yang sudah ada (bawaan signed upload = timpa).
    overwrite: "false",
    public_id: publicId,
    timestamp: Math.floor(Date.now() / 1000),
    transformation: transformasiMasuk(tujuan, jenis),
  };
  if (format) params.format = format;
  if (privat) params.type = "authenticated";

  return jawab({
    cloudName: k.cloudName,
    apiKey: k.apiKey,
    resourceType: jenis,
    params,
    signature: tandaTangan(params, k.apiSecret),
  });
}
