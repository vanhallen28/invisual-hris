// src/lib/payroll/slipPdf.ts
// PDF slip gaji dengan jsPDF murni (teks/garis/kotak, tanpa autotable).
// Jalan di server (lampiran email di /api/payroll/kirim) dan peramban (tombol
// Unduh PDF). Tata letak mengikuti PayslipDocument agar angka & susunannya sama.
import { jsPDF } from "jspdf";
import { PERUSAHAAN } from "./perusahaan";
import { formatRupiah, type SlipTampil } from "./hitung";

type RGB = [number, number, number];
const BIRU: RGB = [43, 92, 213];
const BIRU_MUDA: RGB = [191, 219, 254];
const HIJAU: RGB = [22, 163, 74];
const MERAH: RGB = [220, 38, 38];
const ABU: RGB = [107, 114, 128];
const HITAM: RGB = [31, 41, 55];
const PUTIH: RGB = [255, 255, 255];

type OpsiTeks = { ukuran?: number; tebal?: boolean; warna?: RGB; rata?: "left" | "right" | "center" };

/** Buat PDF slip (A4 potret, satu halaman). Mengembalikan byte PDF. */
export function buatSlipPdf(slip: SlipTampil, label: string, opsi: { draf?: boolean } = {}): Uint8Array {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const L = 18, R = 192, W = R - L;
  let y = 20;

  const teks = (t: string | string[], x: number, yy: number, o: OpsiTeks = {}) => {
    doc.setFontSize(o.ukuran ?? 10);
    doc.setFont("helvetica", o.tebal ? "bold" : "normal");
    doc.setTextColor(...(o.warna ?? HITAM));
    doc.text(t, x, yy, { align: o.rata ?? "left" });
  };
  const garis = (x1: number, yy: number, x2: number, abu = 229) => { doc.setDrawColor(abu); doc.setLineWidth(0.3); doc.line(x1, yy, x2, yy); };

  // ── Kop ───────────────────────────────────────────────────────────────
  teks(PERUSAHAAN.nama.toUpperCase(), L, y, { ukuran: 16, tebal: true });
  teks("PAYSLIP", R, y, { ukuran: 16, tebal: true, warna: BIRU, rata: "right" });
  y += 6;
  teks(PERUSAHAAN.departemen.toUpperCase(), L, y, { ukuran: 8, tebal: true, warna: ABU });
  teks(`DOC-${slip.idKaryawan}`, R, y, { ukuran: 8, warna: ABU, rata: "right" });
  y += 5;
  teks(`Periode: ${label}`, L, y, { ukuran: 8, warna: ABU });
  if (opsi.draf) teks("DRAF - belum final", R, y, { ukuran: 8, tebal: true, warna: MERAH, rata: "right" });
  y += 4;
  doc.setDrawColor(220); doc.setLineWidth(0.6); doc.line(L, y, R, y);

  // ── Info karyawan ─────────────────────────────────────────────────────
  y += 8;
  doc.setFillColor(248, 250, 252); doc.setDrawColor(235); doc.setLineWidth(0.3);
  doc.roundedRect(L, y - 5, W, 21, 2, 2, "FD");
  teks("INFORMASI KARYAWAN", L + 4, y, { ukuran: 7, tebal: true, warna: ABU });
  teks("TRANSFER TUJUAN", R - 4, y, { ukuran: 7, tebal: true, warna: ABU, rata: "right" });
  y += 6;
  teks(slip.nama, L + 4, y, { ukuran: 11, tebal: true });
  teks(slip.namaBank, R - 4, y, { ukuran: 11, tebal: true, rata: "right" });
  y += 5;
  teks(`${slip.idKaryawan} - ${slip.jabatan}`, L + 4, y, { ukuran: 8, warna: ABU });
  teks(slip.noRekening, R - 4, y, { ukuran: 8, warna: ABU, rata: "right" });

  // ── Dua kolom: pendapatan | potongan ─────────────────────────────────
  y += 15;
  const kiriR = L + W / 2 - 4, tengah = L + W / 2 + 4;
  teks("PENDAPATAN (EARNINGS)", L, y, { ukuran: 8, tebal: true, warna: HIJAU });
  teks("POTONGAN (DEDUCTIONS)", tengah, y, { ukuran: 8, tebal: true, warna: MERAH });
  y += 1.5; garis(L, y, kiriR); garis(tengah, y, R);
  let yk = y + 6, yn = y + 6;
  teks("Gaji Pokok", L, yk, { ukuran: 9, warna: ABU });
  teks(formatRupiah(slip.gajiPokok), kiriR, yk, { ukuran: 9, tebal: true, rata: "right" });
  yk += 6;
  if (slip.bonusManual > 0) {
    teks("Bonus Tambahan", L, yk, { ukuran: 9, tebal: true, warna: HIJAU });
    teks(formatRupiah(slip.bonusManual), kiriR, yk, { ukuran: 9, tebal: true, warna: HIJAU, rata: "right" });
    yk += 6;
  }
  if (slip.potonganManual > 0) {
    teks("Kasbon / Potongan Ekstra", tengah, yn, { ukuran: 9, tebal: true, warna: MERAH });
    teks("-" + formatRupiah(slip.potonganManual), R, yn, { ukuran: 9, tebal: true, warna: MERAH, rata: "right" });
  } else {
    teks("Tidak ada potongan", tengah, yn, { ukuran: 9, warna: ABU });
    teks("Rp 0", R, yn, { ukuran: 9, warna: ABU, rata: "right" });
  }
  yn += 6;
  const yt = Math.max(yk, yn) + 2;
  garis(L, yt, kiriR); garis(tengah, yt, R);
  teks("Total Pendapatan", L, yt + 6, { ukuran: 9, tebal: true });
  teks(formatRupiah(slip.totalPendapatan), kiriR, yt + 6, { ukuran: 9, tebal: true, warna: HIJAU, rata: "right" });
  teks("Total Potongan", tengah, yt + 6, { ukuran: 9, tebal: true });
  teks("-" + formatRupiah(slip.totalPotongan), R, yt + 6, { ukuran: 9, tebal: true, warna: MERAH, rata: "right" });

  // ── Take Home Pay ────────────────────────────────────────────────────
  y = yt + 14;
  doc.setFillColor(...BIRU); doc.roundedRect(L, y, W, 16, 2, 2, "F");
  teks("TAKE HOME PAY", L + 5, y + 6, { ukuran: 7, tebal: true, warna: BIRU_MUDA });
  teks("Total bersih ditransfer ke rekening di atas.", L + 5, y + 11, { ukuran: 7, warna: BIRU_MUDA });
  teks(formatRupiah(slip.gajiBersih), R - 5, y + 10.5, { ukuran: 16, tebal: true, warna: PUTIH, rata: "right" });

  // ── Kehadiran & catatan ──────────────────────────────────────────────
  y += 24;
  teks(`Kehadiran periode ini: Hadir ${slip.hadir} hari - Telat ${slip.telat} hari`, L, y, { ukuran: 8, warna: ABU });
  if (slip.catatan) {
    y += 5;
    doc.setFontSize(8);
    const baris = (doc.splitTextToSize(`Catatan: ${slip.catatan}`, W) as string[]).slice(0, 6);
    teks(baris, L, y, { ukuran: 8, warna: ABU });
    y += 3.6 * (baris.length - 1);
  }

  // ── Tanda tangan ─────────────────────────────────────────────────────
  y += 14;
  teks("Diterima Oleh,", L + 22, y, { ukuran: 8, warna: ABU, rata: "center" });
  teks("Disetujui Oleh,", R - 22, y, { ukuran: 8, warna: ABU, rata: "center" });
  y += 18;
  teks(slip.nama, L + 22, y, { ukuran: 9, tebal: true, rata: "center" });
  teks("HR Manager", R - 22, y, { ukuran: 9, tebal: true, rata: "center" });

  // ── Alamat perusahaan ────────────────────────────────────────────────
  y += 10; garis(L, y, R);
  y += 6; teks(PERUSAHAAN.nama.toUpperCase(), L, y, { ukuran: 7, tebal: true });
  y += 4; teks(PERUSAHAAN.alamat, L, y, { ukuran: 7, warna: ABU });
  y += 4; teks(`Telp. ${PERUSAHAAN.telepon}`, L, y, { ukuran: 7, warna: ABU });
  teks("Dokumen ini dibuat otomatis oleh HRIS Invisual Studio.", R, y, { ukuran: 6.5, warna: ABU, rata: "right" });

  return new Uint8Array(doc.output("arraybuffer"));
}

/** Unduh PDF di peramban (tombol "Unduh PDF"). */
export function unduhSlipPdf(slip: SlipTampil, label: string, namaBerkas: string, opsi: { draf?: boolean } = {}) {
  const bytes = buatSlipPdf(slip, label, opsi);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url; a.download = namaBerkas;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
