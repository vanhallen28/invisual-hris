// src/app/api/wa/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. Menangkap data yang dikirim dari halaman Admin (Frontend)
    const body = await request.json();
    const { target, message } = body;

    // 2. Validasi Dasar
    if (!target || !message) {
      return NextResponse.json(
        { error: "Nomor tujuan (target) dan pesan (message) wajib diisi." },
        { status: 400 }
      );
    }

    // =======================================================================
    // 🔐 KONFIGURASI API KEY (TOKEN)
    // Untuk saat ini kita simpan di sini. Nanti bisa dipindah ke file .env
    // Anda bisa mendaftar gratis di fonnte.com untuk mendapatkan token asli.
    // =======================================================================
    const FONNTE_TOKEN = "TOKEN_ANDA_DISINI"; 

    // 3. MODE SIMULASI (Mencegah error saat tahap pengembangan)
    if (FONNTE_TOKEN === "TOKEN_ANDA_DISINI") {
      console.log("=========================================");
      console.log("🛠️ [SIMULASI WHATSAPP] SEDANG BERJALAN");
      console.log("📱 Tujuan :", target);
      console.log("💬 Pesan  :\n", message);
      console.log("=========================================");
      
      // Berpura-pura sukses dan membalas ke Frontend
      return NextResponse.json({ 
        success: true, 
        mode: "SIMULATION",
        message: "Pesan berhasil disimulasikan di terminal console." 
      });
    }

    // 4. PENGIRIMAN ASLI KE SERVER WHATSAPP (Jika token sudah diisi)
    const response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        "Authorization": FONNTE_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        target: target,
        message: message,
        countryCode: "62" // Memaksa format ke nomor Indonesia (+62)
      })
    });

    const result = await response.json();

    if (!response.ok || !result.status) {
      throw new Error(result.reason || "Terjadi kesalahan pada server WhatsApp.");
    }

    // 5. Mengembalikan status sukses ke Frontend
    return NextResponse.json({ 
      success: true, 
      data: result 
    });

  } catch (error: any) {
    console.error("❌ API WA Error:", error.message);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}