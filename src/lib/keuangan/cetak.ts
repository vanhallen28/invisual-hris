// src/lib/keuangan/cetak.ts
//
// Unduh CSV dan cetak laporan.
//
// CATATAN DESAIN — kenapa cetak memakai jendela terpisah, bukan
// `@media print` di globals.css:
//
//   1. Seluruh HRIS bertema gelap. Saat mencetak, browser secara bawaan
//      MEMBUANG warna latar — jadi teks putih jatuh di kertas putih dan
//      hasilnya kosong. Memaksanya lewat CSS cetak berarti melawan
//      pengaturan browser, dan hasilnya tetap tidak bisa dipastikan.
//   2. Menyentuh `globals.css` berisiko: satu kurung kurawal salah tempat
//      pernah menjatuhkan SELURUH gaya aplikasi. Jendela cetak terpisah
//      membuat berkas itu tidak perlu disentuh sama sekali.
//
// Polanya sama dengan slip gaji HRIS yang memang sengaja terang karena
// dicetak.

import { periodLabel, rp } from '@/lib/keuangan/format';
import type { BarisLaporan, Laporan } from '@/lib/keuangan/laporan';

/** Menulis teks jadi berkas yang langsung terunduh. */
export function unduhBerkas(namaBerkas: string, isi: string, tipe = 'text/csv;charset=utf-8') {
  const blob = new Blob([isi], { type: tipe });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Ditunda sedikit: sebagian browser membatalkan unduhan kalau URL-nya
  // dicabut terlalu cepat.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const aman = (t: string) =>
  String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function barisHtml(b: BarisLaporan): string {
  if (b.jenis === 'kepala') {
    return `<tr><td colspan="5" class="kepala">${aman(b.label)}</td></tr>`;
  }

  const selisih = b.kini - b.lalu;
  const tebal = b.jenis === 'total' || b.jenis === 'akhir';
  const kelasBaris = tebal ? ' class="tebal"' : '';
  const kelasLabel = b.jenis === 'baris' ? ' class="menjorok"' : '';
  const porsi = b.jenis === 'baris' && b.porsi !== null ? `${Math.round(b.porsi)}%` : '—';

  return `<tr${kelasBaris}>
    <td${kelasLabel}>${aman(b.label)}</td>
    <td class="angka">${rp(b.kini)}</td>
    <td class="angka pudar">${rp(b.lalu)}</td>
    <td class="angka ${selisih >= 0 ? 'naik' : 'turun'}">${selisih >= 0 ? '+' : '\u2212'}${rp(Math.abs(selisih))}</td>
    <td class="angka pudar">${porsi}</td>
  </tr>`;
}

/**
 * Membuka jendela cetak berisi laporan versi TERANG.
 * Mengembalikan false kalau jendelanya diblokir browser.
 */
export function cetakLaporan(laporan: Laporan, periode: string): boolean {
  const jendela = window.open('', '_blank', 'width=900,height=1000');
  if (!jendela) return false;

  const dicetak = new Date().toLocaleDateString('id-ID', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Laporan Keuangan ${aman(periodLabel(periode))}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 32px 36px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    color: #1a1a1a; background: #ffffff; font-size: 13px;
  }
  header { border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { margin: 0; font-size: 18px; letter-spacing: -0.01em; }
  .sub { margin-top: 4px; font-size: 12px; color: #666666; }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left; font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.08em; color: #666666;
    border-bottom: 1.5px solid #1a1a1a; padding: 8px 10px;
  }
  th.angka, td.angka { text-align: right; font-variant-numeric: tabular-nums; }
  td { padding: 7px 10px; border-bottom: 1px solid #e5e5e5; }
  td.menjorok { padding-left: 24px; }
  td.kepala {
    padding: 16px 10px 4px; font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em; color: #666666;
    border-bottom: none;
  }
  tr.tebal td { font-weight: 700; border-top: 1.5px solid #1a1a1a; }
  .pudar { color: #777777; }
  .naik { color: #15803d; }
  .turun { color: #b91c1c; }
  footer { margin-top: 18px; font-size: 11px; color: #666666; line-height: 1.6; }
  @media print {
    body { padding: 0; }
    @page { margin: 16mm; }
  }
</style>
</head>
<body>
  <header>
    <h1>Laporan Keuangan</h1>
    <div class="sub">${aman(periodLabel(periode))} &middot; dicetak ${aman(dicetak)}</div>
  </header>

  <table>
    <thead>
      <tr>
        <th>Pos</th>
        <th class="angka">Bulan Ini</th>
        <th class="angka">Bulan Lalu</th>
        <th class="angka">Selisih</th>
        <th class="angka">% Total</th>
      </tr>
    </thead>
    <tbody>
      ${laporan.baris.map(barisHtml).join('\n      ')}
    </tbody>
  </table>

  <footer>
    Selisih dihitung terhadap bulan sebelumnya. Persentase pengeluaran dihitung
    dari total pengeluaran bulan berjalan.
  </footer>

  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;

  jendela.document.write(html);
  jendela.document.close();
  return true;
}
