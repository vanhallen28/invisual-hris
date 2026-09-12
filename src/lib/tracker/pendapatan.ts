// src/lib/tracker/pendapatan.ts
// Perhitungan pendapatan marketplace: jumlah template per status, per AKUN,
// dikelompokkan per MARKETPLACE (grup). Meniru PERSIS logika Overview
// (deteksi kolom AKUN & STATUS berdasarkan label; subitem mewarisi akun induk),
// dipisah ke sini agar dipakai bersama tanpa menduplikasi di banyak tempat.

type Any = any;

const upper = (v: Any) => String(v || '').toUpperCase();

/** Ambil nama marketplace dari judul grup: bagian sebelum pemisah pertama.
 *  Contoh: "ADOBE - Q4 - INVISUAL | SAMESIGN" -> "ADOBE". */
export function marketplaceDariGrup(judul: string): string {
  const s = String(judul || '').trim();
  if (!s) return 'LAINNYA';
  const bagian = s.split(/\s*[-–—|]\s*/)[0].trim();
  return (bagian || s).toUpperCase();
}

/** Normalisasi teks status -> ember standar. */
export function emberStatus(v: Any): 'done' | 'inreview' | 'approved' | 'rejected' | null {
  const n = String(v || '').toLowerCase().replace(/\s+/g, '');
  if (n === 'done') return 'done';
  if (n === 'inreview') return 'inreview';
  if (n === 'approved') return 'approved';
  if (n === 'rejected') return 'rejected';
  return null;
}

export type HitunganAkun = { done: number; inreview: number; approved: number; rejected: number };
export type HitunganMarketplace = Record<string, Record<string, HitunganAkun>>;

/**
 * @param boardData daftar grup: [{ title, items: [{ ...nilaiKolom, subItems: [...] }] }]
 * @param columns kolom item (main), @param subColumns kolom subitem
 * @returns { [marketplace]: { [akun]: {done,inreview,approved,rejected} } }
 */
export function hitungPerMarketplaceAkun(boardData: Any[], columns: Any[], subColumns: Any[]): HitunganMarketplace {
  const akunMainKey = (columns || []).find((c: Any) => upper(c.label) === 'AKUN')?.id;
  const akunSubKey = (subColumns || []).find((c: Any) => upper(c.label) === 'AKUN')?.id;
  const statMainKey = (columns || []).find((c: Any) => upper(c.label) === 'STATUS')?.id;
  const statSubKey = (subColumns || []).find((c: Any) => upper(c.label) === 'STATUS')?.id;

  const hasil: HitunganMarketplace = {};
  const tambah = (mkt: string, akun: Any, status: Any) => {
    const a = String(akun || '').trim();
    const b = emberStatus(status);
    if (!a || !b) return;
    if (!hasil[mkt]) hasil[mkt] = {};
    if (!hasil[mkt][a]) hasil[mkt][a] = { done: 0, inreview: 0, approved: 0, rejected: 0 };
    (hasil[mkt][a] as Any)[b]++;
  };

  for (const g of (boardData || [])) {
    const mkt = marketplaceDariGrup(g?.title || g?.name || '');
    for (const it of (g?.items || [])) {
      const akunItem = akunMainKey ? it[akunMainKey] : '';
      tambah(mkt, akunItem, statMainKey ? it[statMainKey] : '');
      for (const sub of (it?.subItems || [])) {
        const akunSub = (akunSubKey && sub[akunSubKey]) ? sub[akunSubKey] : akunItem; // warisi induk
        tambah(mkt, akunSub, statSubKey ? sub[statSubKey] : '');
      }
    }
  }
  return hasil;
}
