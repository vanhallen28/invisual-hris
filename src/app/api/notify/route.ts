// src/app/api/notify/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 💡 DI SINI ADALAH TEMPAT UNTUK MENYISIPKAN KODE WA GATEWAY / RESEND EMAIL API
    // Contoh format data yang diterima: body.tipe, body.data.nama, body.data.jenis
    
    console.log("🔔 [NOTIFIKASI TERPICU] Pesan WhatsApp/Email harusnya dikirim sekarang.");
    console.log("Data Pengajuan Baru:", body.data);

    // Simulasi sukses
    return NextResponse.json({ success: true, message: "Webhook notifikasi berhasil dipicu." });
  } catch (error) {
    return NextResponse.json({ error: "Gagal memproses notifikasi" }, { status: 500 });
  }
}