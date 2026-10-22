// src/app/api/notify/route.ts
// Rute cadangan (tidak dipakai aplikasi). Audit keamanan 22 Okt 2026: dulu tanpa autentikasi
// dan mencatat isi permintaan (data pribadi) ke log server. Kini tidak mencatat isi apa pun dan
// tidak melakukan apa-apa — notifikasi sungguhan lewat /api/push/send, /api/email, /api/wa.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ success: true, message: "Tidak ada aksi (rute cadangan)." });
}
