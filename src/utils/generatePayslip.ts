// src/utils/generatePayslip.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const generatePayslip = (profile: any) => {
  // 1. Inisialisasi Dokumen A4
  const doc = new jsPDF("portrait", "mm", "a4");
  
  const formatRupiah = (angka: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(angka || 0);
  };

  const gajiPokok = profile.gajipokok || profile.gajiPokok || 0;
  // Simulasi perhitungan sederhana (bisa dikembangkan nanti dengan data asli absensi)
  const tunjangan = 0; 
  const potongan = 0; 
  const totalBersih = gajiPokok + tunjangan - potongan;

  const date = new Date();
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const currentMonth = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;

  // ==========================================
  // 🎨 DESAIN HEADER (KOP SURAT)
  // ==========================================
  doc.setFillColor(43, 92, 213); // Warna Biru Invisual (#2b5cd5)
  doc.rect(0, 0, 210, 40, "F"); // Blok warna header

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("INVISUAL STUDIO", 14, 20);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Digital Creative & Technology Agency", 14, 27);
  doc.text("Jl. Invisual No. 99, Bandung, Jawa Barat | hr@invisual.com", 14, 33);

  // ==========================================
  // 📄 JUDUL DOKUMEN & IDENTITAS KARYAWAN
  // ==========================================
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("SLIP GAJI KARYAWAN", 105, 55, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Periode: ${currentMonth}`, 105, 61, { align: "center" });

  // Tabel Info Karyawan
  autoTable(doc, {
    startY: 70,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 1.5, textColor: [60, 60, 60] },
    body: [
      ["Nama Karyawan", ": " + profile.nama, "ID Karyawan", ": " + (profile.idKaryawan || "-")],
      ["Jabatan", ": " + (profile.jabatan || "-"), "Status", ": " + (profile.status || "Aktif")],
      ["No. Rekening", ": " + (profile.noRekening || "-"), "Bank", ": " + (profile.namaBank || "-")],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40 },
      2: { fontStyle: "bold", cellWidth: 40 },
    }
  });

  // ==========================================
  // 💰 TABEL RINCIAN PENGHASILAN & POTONGAN
  // ==========================================
  const startY = (doc as any).lastAutoTable.finalY + 10;

  autoTable(doc, {
    startY: startY,
    theme: "grid",
    headStyles: { fillColor: [43, 92, 213], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    bodyStyles: { textColor: [40, 40, 40] },
    head: [["Keterangan", "Penghasilan", "Potongan"]],
    body: [
      ["Gaji Pokok", formatRupiah(gajiPokok), "-"],
      ["Tunjangan Transport & Makan", formatRupiah(tunjangan), "-"],
      ["Potongan Keterlambatan/Absen", "-", formatRupiah(potongan)],
      ["Pajak (PPh 21)", "-", formatRupiah(0)],
    ],
    foot: [
      ["TOTAL", formatRupiah(gajiPokok + tunjangan), formatRupiah(potongan)]
    ],
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" }
  });

  // ==========================================
  // 💎 TOTAL BERSIH (TAKE HOME PAY)
  // ==========================================
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFillColor(43, 92, 213);
  doc.rect(14, finalY, 182, 12, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("TAKE HOME PAY (PENERIMAAN BERSIH)", 20, finalY + 8);
  doc.text(formatRupiah(totalBersih), 190, finalY + 8, { align: "right" });

  // ==========================================
  // ✍️ TANDA TANGAN (FOOTER)
  // ==========================================
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  doc.text("Mengetahui,", 30, finalY + 35, { align: "center" });
  doc.text("HR Department", 30, finalY + 55, { align: "center" });

  doc.text("Menerima,", 180, finalY + 35, { align: "center" });
  doc.text(profile.nama, 180, finalY + 55, { align: "center" });

  // Catatan Kaki
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text("*Dokumen ini di-generate secara otomatis oleh Sistem HRIS Invisual Studio dan sah tanpa tanda tangan basah.", 105, 280, { align: "center" });

  // 3. Eksekusi Unduhan File
  const namaFile = `Slip_Gaji_${profile.nama.replace(/\s+/g, '_')}_${currentMonth.replace(/\s+/g, '_')}.pdf`;
  doc.save(namaFile);
};