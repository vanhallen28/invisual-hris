// src/lib/payroll/unduhSlip.ts
// Tombol "Unduh PDF" di peramban. Pembuat PDF (jsPDF, ±140 KB) baru dimuat saat tombol
// ditekan — dulu diimpor langsung sehingga ikut terunduh setiap Payroll / Profil / detail
// Karyawan dibuka (dan ikut di-prefetch di semua halaman). Hasil & nama berkas sama persis.
import type { SlipTampil } from "./hitung";

export async function unduhSlipPdf(slip: SlipTampil, label: string, namaBerkas: string, opsi: { draf?: boolean } = {}): Promise<void> {
  try {
    const m = await import("./slipPdf");
    m.unduhSlipPdf(slip, label, namaBerkas, opsi);
  } catch (e) {
    console.error("Gagal membuat PDF slip", e);
    if (typeof window !== "undefined") window.alert("PDF slip belum bisa dibuat. Periksa koneksi lalu coba lagi.");
  }
}
