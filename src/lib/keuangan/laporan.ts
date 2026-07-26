// src/lib/keuangan/laporan.ts
//
// Penyusunan laporan rekapitulasi dan teks CSV.
// SELURUHNYA fungsi murni — tidak menyentuh database maupun DOM, jadi
// mudah diperiksa dan tidak bisa menggagalkan halaman.

import { periodLabel, rp } from '@/lib/keuangan/format';
import type { BarisTransaksi, Kategori } from '@/lib/keuangan/tipe';

export type BarisLaporan =
  | { jenis: 'kepala'; label: string }
  | { jenis: 'baris'; label: string; kini: number; lalu: number; porsi: number | null }
  | { jenis: 'total'; label: string; kini: number; lalu: number }
  | { jenis: 'akhir'; label: string; kini: number; lalu: number };

export type Laporan = {
  baris: BarisLaporan[];
  totalMasuk: number;
  totalKeluar: number;
};

function jumlahKategori(baris: BarisTransaksi[], kategoriId: string): number {
  let total = 0;
  for (const b of baris) if (b.category_id === kategoriId) total += b.amount;
  return total;
}

/** Rekap per pos: bulan berjalan vs bulan sebelumnya. */
export function susunLaporan(
  kategori: Kategori[],
  kini: BarisTransaksi[],
  lalu: BarisTransaksi[],
): Laporan {
  const hasil: BarisLaporan[] = [];

  let totalMasuk = 0;
  let lalunyaMasuk = 0;
  const barisMasuk: BarisLaporan[] = [];

  for (const k of kategori.filter((c) => c.kind === 'in')) {
    const a = jumlahKategori(kini, k.id);
    const b = jumlahKategori(lalu, k.id);
    if (!a && !b) continue; // pos tanpa angka tidak perlu dicetak
    totalMasuk += a;
    lalunyaMasuk += b;
    barisMasuk.push({ jenis: 'baris', label: k.name, kini: a, lalu: b, porsi: null });
  }

  let totalKeluar = 0;
  let lalunyaKeluar = 0;
  const mentahKeluar: { label: string; kini: number; lalu: number }[] = [];

  for (const k of kategori.filter((c) => c.kind === 'out')) {
    const a = jumlahKategori(kini, k.id);
    const b = jumlahKategori(lalu, k.id);
    if (!a && !b) continue;
    totalKeluar += a;
    lalunyaKeluar += b;
    mentahKeluar.push({ label: k.name, kini: a, lalu: b });
  }

  hasil.push({ jenis: 'kepala', label: 'PEMASUKAN' });
  hasil.push(...barisMasuk);
  hasil.push({ jenis: 'total', label: 'Total Pemasukan', kini: totalMasuk, lalu: lalunyaMasuk });

  hasil.push({ jenis: 'kepala', label: 'PENGELUARAN' });
  for (const m of mentahKeluar) {
    hasil.push({
      jenis: 'baris',
      label: m.label,
      kini: m.kini,
      lalu: m.lalu,
      // Porsi dihitung dari total pengeluaran bulan berjalan.
      porsi: totalKeluar ? (m.kini / totalKeluar) * 100 : null,
    });
  }
  hasil.push({ jenis: 'total', label: 'Total Pengeluaran', kini: totalKeluar, lalu: lalunyaKeluar });

  hasil.push({
    jenis: 'akhir',
    label: 'LABA / RUGI BERSIH',
    kini: totalMasuk - totalKeluar,
    lalu: lalunyaMasuk - lalunyaKeluar,
  });

  return { baris: hasil, totalMasuk, totalKeluar };
}

/* ════════════════════ CSV ════════════════════ */

// Pemisah titik koma, bukan koma: Excel berbahasa Indonesia memakai koma
// sebagai desimal, jadi CSV berkoma berantakan saat dibuka di sini.
const PISAH = ';';

const bersihkan = (t: string) => String(t ?? '').replace(/[;\r\n]/g, ' ').trim();

/** Teks CSV rekap satu periode, siap ditulis jadi berkas. */
export function csvRekap(baris: BarisTransaksi[], periode: string): string {
  const urut = [...baris].sort((a, b) => (a.occurred_on < b.occurred_on ? -1 : 1));

  const isi: string[] = [
    `Rekap Keuangan${PISAH}${periodLabel(periode)}`,
    '',
    ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Akun', 'Jumlah'].join(PISAH),
  ];

  let masuk = 0;
  let keluar = 0;

  for (const b of urut) {
    if (b.kind === 'in') masuk += b.amount;
    else keluar += b.amount;
    isi.push([
      b.occurred_on,
      b.kind === 'in' ? 'Pemasukan' : 'Pengeluaran',
      bersihkan(b.category_name),
      bersihkan(b.note),
      bersihkan(b.account_name),
      String(b.amount),
    ].join(PISAH));
  }

  const kosong = PISAH.repeat(4);
  isi.push(
    '',
    `Total Pemasukan${kosong}${PISAH}${masuk}`,
    `Total Pengeluaran${kosong}${PISAH}${keluar}`,
    `Laba/Rugi${kosong}${PISAH}${masuk - keluar}`,
  );

  // BOM di depan supaya Excel membaca UTF-8 dengan benar (tanpa ini
  // huruf beraksen dan simbol rupiah jadi berantakan).
  return '\ufeff' + isi.join('\r\n');
}

/** Ringkasan satu baris untuk kaki laporan. */
export function ringkasLaporan(l: Laporan): string {
  return `Pemasukan ${rp(l.totalMasuk)} · Pengeluaran ${rp(l.totalKeluar)} · Bersih ${rp(l.totalMasuk - l.totalKeluar)}`;
}
