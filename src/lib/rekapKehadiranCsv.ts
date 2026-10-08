// src/lib/rekapKehadiranCsv.ts
//
// Teks CSV rekap kehadiran untuk rentang tanggal pilihan HR (halaman Kehadiran).
// Fungsi murni — tidak menyentuh database maupun DOM.
//
// Pemisah titik koma (;) seperti CSV keuangan: Excel berbahasa Indonesia
// memakai koma sebagai desimal, jadi CSV berkoma berantakan saat dibuka.

type SelRekap = { iso: string; status: string; att?: any };
export type BarisRekap = { id: any; nama: string; divisi: string; sel: SelRekap[] };

const PISAH = ";";
// Teks diawali = + - @ dibaca Excel sebagai rumus → diberi awalan ' agar tetap teks.
const bersih = (t: unknown) => { const s = String(t ?? "").replace(/[;\r\n"]/g, " ").trim(); return /^[=+\-@]/.test(s) ? "'" + s : s; };

const KODE: Record<string, string> = { Hadir: "H", Telat: "T", "Cuti/Sakit": "I", WFH: "W", Alpa: "A", Libur: "L", "Libur Nasional": "N" };

export function csvRekapKehadiran(baris: BarisRekap[], tanggal: string[], labelRentang: string, hariIni: string): string {
  const isi: string[] = [
    `Rekap Kehadiran${PISAH}${bersih(labelRentang)}`,
    `Kode${PISAH}H = Hadir tepat waktu, T = Terlambat, I = Izin/Cuti/Sakit, W = WFH/WFC, A = Alpa, L = Libur (akhir pekan), N = Libur nasional / cuti bersama / libur kantor`,
    "",
    [
      "No", "ID Karyawan", "Nama", "Divisi",
      "Hadir Tepat Waktu", "Terlambat", "Izin/Cuti/Sakit", "WFH/WFC", "Alpa", "Total Hadir", "Lupa Clock-out",
      ...tanggal.map((iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`),
    ].join(PISAH),
  ];

  baris.forEach((b, i) => {
    const n = { Hadir: 0, Telat: 0, "Cuti/Sakit": 0, WFH: 0, Alpa: 0 } as Record<string, number>;
    let lupa = 0;
    for (const x of b.sel) {
      if (x.status in n) n[x.status]++;
      if (x.att && !x.att.waktuKeluar && x.iso < hariIni) lupa++;
    }
    isi.push([
      String(i + 1), bersih(b.id), bersih(b.nama), bersih(b.divisi),
      n.Hadir, n.Telat, n["Cuti/Sakit"], n.WFH, n.Alpa, n.Hadir + n.Telat, lupa,
      ...b.sel.map((x) => KODE[x.status] || ""),
    ].join(PISAH));
  });

  // BOM supaya Excel membaca UTF-8 dengan benar.
  return "﻿" + isi.join("\r\n");
}
