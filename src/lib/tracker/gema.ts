// Mengenali "gema" realtime: perubahan struktur papan yang isinya SUDAH sama
// dengan yang tampil di layar (biasanya tulisan tab ini sendiri yang kembali
// lewat realtime). Gema boleh dilewati tanpa memuat ulang papan; perubahan
// yang belum tercermin di layar (mis. buatan rekan) tetap harus dimuat.
//
// Prinsip: ragu → anggap BUKAN gema (lebih baik memuat ulang sekali lagi
// daripada melewatkan perubahan rekan).

export type Keadaan = {
  peta: Record<string, any>;          // boardsDataMap
  workspaces: any[];
  labels: Record<string, any[]>;
  /** Posisi tiap baris menurut muat terakhir dari server (boleh berselang, mis. 0,2,3). */
  posisi?: Record<string, number>;
};

const punya = (o: any, k: string) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const tipeKlien = (t: any) => (t === 'people' ? 'team' : t);

/** Node pohon + id induknya + urutannya di antara saudaranya. */
function cariNode(ws: any[], id: string): { n: any; induk: string | null; idx: number } | null {
  const diPapan = (bs: any[], induk: string): any => {
    const daftar = bs || [];
    for (let i = 0; i < daftar.length; i++) {
      const b = daftar[i];
      if (b.id === id) return { n: b, induk, idx: i };
      const x = diPapan(b.boards, b.id);
      if (x) return x;
    }
    return null;
  };
  const semuaWs = ws || [];
  for (let wi = 0; wi < semuaWs.length; wi++) {
    const w = semuaWs[wi];
    if (w.id === id) return { n: w, induk: null, idx: wi };
    const ys = w.years || [];
    for (let yi = 0; yi < ys.length; yi++) {
      const y = ys[yi];
      if (y.id === id) return { n: y, induk: w.id, idx: yi };
      const ms = y.months || [];
      for (let mi = 0; mi < ms.length; mi++) {
        const m = ms[mi];
        if (m.id === id) return { n: m, induk: y.id, idx: mi };
        const b = diPapan(m.boards, m.id);
        if (b) return b;
      }
    }
  }
  return null;
}

function adaGrup(peta: Record<string, any>, id: string) {
  for (const bid of Object.keys(peta || {})) if ((peta[bid]?.groups || []).some((g: any) => g.id === id)) return true;
  return false;
}
function adaKolom(peta: Record<string, any>, id: string) {
  for (const bid of Object.keys(peta || {})) {
    const bd = peta[bid];
    if ((bd?.columns || []).some((c: any) => c.id === id) || (bd?.subColumns || []).some((c: any) => c.id === id)) return true;
  }
  return false;
}
// Hapus papan/grup besar memicu ribuan event DELETE beruntun → indeks id item
// dibuat sekali per keadaan peta (bukan ditelusuri ulang untuk setiap event).
const cacheIdItem = new WeakMap<object, Set<string>>();
function adaItem(peta: Record<string, any>, id: string) {
  if (!peta) return false;
  let set = cacheIdItem.get(peta);
  if (!set) {
    set = new Set<string>();
    for (const bid of Object.keys(peta)) for (const g of peta[bid]?.groups || []) for (const it of g.items || []) {
      set.add(it.id);
      for (const s of it.subItems || []) set.add(s.id);
    }
    cacheIdItem.set(peta, set);
  }
  return set.has(id);
}
function adaLabel(labels: Record<string, any[]>, id: string) {
  for (const k of Object.keys(labels || {})) if ((labels[k] || []).some((l: any) => l.id === id)) return true;
  return false;
}

/**
 * Posisi baris DB cocok dengan layar bila sama dengan urutannya di layar
 * (tulisan sendiri selalu menulis urutan layar) ATAU sama dengan posisi yang
 * dimuat terakhir dari server (posisi tak diubah, walau di database berselang).
 */
const posisiSama = (row: any, idx: number, posisi?: Record<string, number>) => {
  if (!punya(row, 'position') || row.position == null) return true;
  const p = Number(row.position);
  return p === idx || (!!posisi && posisi[row.id] === p);
};

function itemTercermin(peta: Record<string, any>, r: any, posisi?: Record<string, number>): boolean {
  for (const bid of Object.keys(peta || {})) {
    const g = (peta[bid]?.groups || []).find((x: any) => x.id === r.group_id);
    if (!g) continue;
    const daftar: any[] = r.parent_item_id
      ? ((g.items || []).find((x: any) => x.id === r.parent_item_id)?.subItems || [])
      : (g.items || []);
    const idx = daftar.findIndex((x: any) => x.id === r.id);
    if (idx < 0) return false;
    const it = daftar[idx];
    if (punya(r, 'name') && String(it.name ?? '') !== String(r.name ?? '')) return false;
    if (!r.parent_item_id && punya(r, 'is_subitems_open') && !!it.isSubItemsOpen !== !!r.is_subitems_open) return false;
    if (punya(r, 'description') && String(it.description || '') !== String(r.description || '')) return false;
    return posisiSama(r, idx, posisi);
  }
  return false;
}

/**
 * true = perubahan ini sudah tampil persis di layar (aman dilewati).
 * `p` = payload postgres_changes Supabase ({ eventType, new, old }).
 */
export function sudahTercermin(tabel: string, p: any, k: Keadaan): boolean {
  if (!p || !k) return false;
  const jenis = p.eventType;
  if (jenis === 'DELETE') {
    const id = p.old?.id;
    if (!id) return false;
    if (tabel === 'tree_nodes') return !cariNode(k.workspaces, id);
    if (tabel === 'groups') return !adaGrup(k.peta, id);
    if (tabel === 'columns') return !adaKolom(k.peta, id);
    if (tabel === 'column_options') return !adaLabel(k.labels, id);
    if (tabel === 'items') return !adaItem(k.peta, id);
    return false;
  }
  if (jenis !== 'INSERT' && jenis !== 'UPDATE') return false;
  const r = p.new;
  if (!r || !r.id) return false;

  if (tabel === 'tree_nodes') {
    const x = cariNode(k.workspaces, r.id);
    if (!x) return false;
    if (punya(r, 'name') && String(x.n.name ?? '') !== String(r.name ?? '')) return false;
    if (punya(r, 'parent_id') && String(r.parent_id ?? '') !== String(x.induk ?? '')) return false;   // dipindah
    return posisiSama(r, x.idx, k.posisi);
  }
  if (tabel === 'groups') {
    const daftar = k.peta?.[r.board_id]?.groups || [];
    const idx = daftar.findIndex((g: any) => g.id === r.id);
    if (idx < 0) return false;
    const g = daftar[idx];
    if (punya(r, 'title') && String(g.title ?? '') !== String(r.title ?? '')) return false;
    if (punya(r, 'color') && r.color != null && g.color !== r.color) return false;
    if (punya(r, 'is_collapsed') && !!g.isCollapsed !== !!r.is_collapsed) return false;
    if (punya(r, 'item_label') && r.item_label != null && (g.itemLabel || 'Item Name') !== r.item_label) return false;
    if (punya(r, 'sub_item_label') && r.sub_item_label != null && (g.subItemLabel || 'Subitem') !== r.sub_item_label) return false;
    return posisiSama(r, idx, k.posisi);
  }
  if (tabel === 'columns') {
    const bd = k.peta?.[r.board_id];
    const daftar = r.scope === 'sub' ? (bd?.subColumns || []) : (bd?.columns || []);
    const idx = daftar.findIndex((c: any) => c.id === r.id);
    if (idx < 0) return false;
    const c = daftar[idx];
    if (punya(r, 'label') && String(c.label ?? '') !== String(r.label ?? '')) return false;
    if (punya(r, 'type') && c.type !== tipeKlien(r.type)) return false;
    if (punya(r, 'width') && r.width != null && (c.width || '130px') !== r.width) return false;
    return posisiSama(r, idx, k.posisi);
  }
  if (tabel === 'column_options') {
    const daftar = k.labels?.[r.column_id] || [];
    const idx = daftar.findIndex((l: any) => l.id === r.id);
    if (idx < 0) return false;
    const l = daftar[idx];
    if (punya(r, 'text') && String(l.text ?? '') !== String(r.text ?? '')) return false;
    if (punya(r, 'color') && r.color != null && l.color !== r.color) return false;
    return posisiSama(r, idx, k.posisi);
  }
  if (tabel === 'items') return itemTercermin(k.peta, r, k.posisi);
  return false;
}
