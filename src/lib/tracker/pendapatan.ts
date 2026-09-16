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
    if (!a) return; // cukup ada AKUN; status boleh kosong — akun tetap didaftar (sama seperti Overview)
    if (!hasil[mkt]) hasil[mkt] = {};
    if (!hasil[mkt][a]) hasil[mkt][a] = { done: 0, inreview: 0, approved: 0, rejected: 0 };
    const b = emberStatus(status);
    if (b) (hasil[mkt][a] as Any)[b]++;
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

/** Kumpulkan id board + SEMUA sub-board (rekursif) dari pohon workspaces. */
export function kumpulkanIdBoardDanSub(workspaces: Any[], boardId: string): string[] {
  const hasil: string[] = [];
  const kumpulSemua = (b: Any) => { hasil.push(b.id); for (const sb of (b?.boards || [])) kumpulSemua(sb); };
  const telusuri = (b: Any): boolean => {
    if (b?.id === boardId) { kumpulSemua(b); return true; }
    for (const sb of (b?.boards || [])) if (telusuri(sb)) return true;
    return false;
  };
  for (const w of (workspaces || [])) for (const y of (w?.years || [])) for (const m of (y?.months || [])) for (const b of (m?.boards || [])) if (telusuri(b)) return hasil;
  return hasil.length ? hasil : [boardId];
}

/** Gabungkan beberapa hasil hitungan per-marketplace-per-akun (jumlahkan). */
export function gabungHitungan(list: HitunganMarketplace[]): HitunganMarketplace {
  const out: HitunganMarketplace = {};
  for (const h of (list || [])) for (const mkt of Object.keys(h || {})) for (const akun of Object.keys(h[mkt] || {})) {
    if (!out[mkt]) out[mkt] = {};
    if (!out[mkt][akun]) out[mkt][akun] = { done: 0, inreview: 0, approved: 0, rejected: 0 };
    const s = h[mkt][akun];
    out[mkt][akun].done += s.done; out[mkt][akun].inreview += s.inreview;
    out[mkt][akun].approved += s.approved; out[mkt][akun].rejected += s.rejected;
  }
  return out;
}

/** Hitung per-marketplace-per-akun untuk sebuah board + SEMUA sub-board-nya. */
export function hitungAkunBoardDanSub(boardsDataMap: Record<string, Any>, workspaces: Any[], boardId: string): HitunganMarketplace {
  const ids = kumpulkanIdBoardDanSub(workspaces, boardId);
  const list = ids.map((id) => {
    const bd = boardsDataMap?.[id];
    return bd ? hitungPerMarketplaceAkun(bd.groups || [], bd.columns || [], bd.subColumns || []) : {};
  });
  return gabungHitungan(list);
}
