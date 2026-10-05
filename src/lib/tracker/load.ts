// Rekonstruksi state app dari Supabase (kebalikan dari migrate.ts).
// Self-contained: hanya butuh client supabase yang dioper.
//
// DUA JALUR MUAT:
//  • loadFullState      → semua tabel termasuk SEMUA nilai sel (dipakai halaman
//                          Pendapatan; perilaku & keluaran sama seperti dulu).
//  • loadStrukturState  → kerangka saja (papan, grup, kolom, label, item) TANPA
//                          nilai sel. Ringan & tak membengkak seiring data sel.
//    Nilai sel lalu dimuat seperlunya: loadSelItem (per item/papan),
//    loadKolom (kolom tertentu lintas papan), loadIdItemSaya (tugas saya).
type SB = any;

export type FullState = {
  workspaces: any[];
  boardsDataMap: Record<string, any>;
  accountTargets: Record<string, Record<string, number>>;
  labels: Record<string, any[]>;
  teamMembers: any[];
  currentUserId: string | null;
  currentUserRole: string;
  canContentHub?: boolean;
  canAcc?: boolean;
};

const UKURAN = 1000;                 // batas baris per permintaan PostgREST (Supabase)
const GELOMBANG = [1, 2, 4, 6];      // jumlah halaman paralel per gelombang (adaptif)
const POTONG_ID = 75;                // id per filter .in() (URL tetap pendek; ±1 halaman)
const POTONG_KOLOM = 40;
const PARALEL = 4;                   // potongan yang diproses bersamaan

type OpsiAmbil = { saring?: (q: any) => any; urut?: string[] };

/**
 * Ambil SEMUA baris (paginasi 1000/permintaan).
 * - TANPA count:'exact' (COUNT(*) penuh makin mahal seiring data bertambah).
 * - Halaman berikutnya diambil bergelombang paralel (1 → 2 → 4 → 6 halaman)
 *   dan berhenti begitu ada halaman yang tidak penuh.
 * - `urut` memberi ORDER BY pada kunci unik agar halaman OFFSET stabil
 *   (tanpa urutan, Postgres tak menjamin halaman tidak tumpang tindih).
 */
export async function ambilSemua(supabase: SB, tabel: string, kolom: string = '*', opsi: OpsiAmbil = {}): Promise<any[]> {
  const halaman = (dari: number) => {
    let q = supabase.from(tabel).select(kolom);
    if (opsi.saring) q = opsi.saring(q);
    for (const k of (opsi.urut || [])) q = q.order(k, { ascending: true });
    return q.range(dari, dari + UKURAN - 1);
  };
  const pertama = await halaman(0);
  if (pertama.error) throw new Error(pertama.error.message);
  const semua: any[] = [...(pertama.data || [])];
  if (semua.length < UKURAN) return semua;

  let dari = UKURAN;
  for (let putaran = 0; putaran < 500; putaran++) {
    const n = GELOMBANG[Math.min(putaran, GELOMBANG.length - 1)];
    const hasil = await Promise.all(Array.from({ length: n }, (_, i) => halaman(dari + i * UKURAN)));
    let habis = false;
    for (const r of hasil) {
      if (r.error) throw new Error(r.error.message);
      const b = r.data || [];
      semua.push(...b);
      if (b.length < UKURAN) habis = true;
    }
    if (habis) break;
    dari += n * UKURAN;
  }
  return semua;
}

/** Ambil dengan ORDER; bila ditolak (mis. kolom urut tak ada) ulangi tanpa ORDER. */
async function ambilAman(supabase: SB, tabel: string, kolom: string, urut: string[]): Promise<any[]> {
  try { return await ambilSemua(supabase, tabel, kolom, { urut }); }
  catch { return ambilSemua(supabase, tabel, kolom); }
}

const potong = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
const unik = (ids: any[]): string[] => Array.from(new Set((ids || []).filter((x) => typeof x === 'string' && x)));

const KOLOM_ITEM = 'id, group_id, parent_item_id, name, position, is_subitems_open, description';
const URUT_NILAI = ['item_id', 'column_id'];
const URUT_TIM = ['item_id', 'column_id', 'member_id'];

async function ambilMentah(supabase: SB, denganSel: boolean) {
  const ambilItems = async () => {
    if (denganSel) return ambilAman(supabase, 'items', '*', ['id']);
    // Kerangka cukup kolom yang dipakai; bila ditolak, jatuh ke select('*').
    try { return await ambilSemua(supabase, 'items', KOLOM_ITEM, { urut: ['id'] }); }
    catch { return ambilAman(supabase, 'items', '*', ['id']); }
  };
  const [ures, nodes, groups, columns, options, items, membersRows, accTargets, values, assignees] = await Promise.all([
    supabase.auth.getUser(),
    ambilAman(supabase, 'tree_nodes', '*', ['id']),
    ambilAman(supabase, 'groups', '*', ['id']),
    ambilAman(supabase, 'columns', '*', ['id']),
    ambilAman(supabase, 'column_options', '*', ['id']),
    ambilItems(),
    ambilAman(supabase, 'members', '*', ['id']),
    ambilSemua(supabase, 'account_targets'),
    denganSel ? ambilSemua(supabase, 'item_values', 'item_id, column_id, value', { urut: URUT_NILAI }) : Promise.resolve([]),
    denganSel ? ambilSemua(supabase, 'item_assignees', 'item_id, column_id, member_id', { urut: URUT_TIM }) : Promise.resolve([]),
  ]);
  return { ures, nodes, groups, columns, options, items, membersRows, accTargets, values, assignees };
}

function bangunState(m: any): FullState {
  const { ures, nodes, groups, columns, options, items, membersRows, accTargets, values, assignees } = m;
  const currentUserId = ures?.data?.user?.id || null;
  const currentEmail = String(ures?.data?.user?.email || '').toLowerCase();
  const isAdminEmail = currentEmail.endsWith('@invisual.studio');

  const num = (x: any) => (typeof x === 'number' ? x : 0);
  const byPos = (a: any, b: any) => num(a.position) - num(b.position);

  const teamMembers = membersRows.map((mm: any) => ({ id: mm.id, name: mm.name, color: mm.color || 'bg-primer-terang', initials: mm.initials || '?' }));
  const meRow = membersRows.find((mm: any) => mm.id === currentUserId);
  // Admin @invisual.studio SELALU manager (punya akses penuh: board, Content Hub, buat channel suara).
  const currentUserRole = isAdminEmail ? 'manager' : ((meRow?.role) || 'member');
  // Akses Content Hub (kolom members.content_hub) — default boleh; admin selalu boleh
  const canContentHub = isAdminEmail ? true : (meRow?.content_hub !== false);
  // Akses ACC Brief (kolom members.acc_brief) — default TIDAK boleh; admin selalu
  // boleh. Manajer sudah otomatis bisa lewat gerbang isManager, jadi ini murni
  // untuk memberi akses ACC kepada NON-manajer (akses "tanggung").
  const canAcc = isAdminEmail ? true : (meRow?.acc_brief === true);

  // KEBIJAKAN: semua manager melihat & mengedit SEMUA board daily-task.
  // Pembatasan per-pola (tabel board_access) dinonaktifkan → allowedPatterns kosong
  // sehingga boardAllowed() selalu true untuk semua orang yang mengakses.
  const allowedPatterns: string[] = [];
  const boardAllowed = (name: any) => {
    if (!allowedPatterns.length) return true;
    const n = String(name || '').toLowerCase();
    return allowedPatterns.some((p) => n.includes(p));
  };

  const labels: Record<string, any[]> = {};
  for (const o of [...options].sort(byPos)) {
    if (!labels[o.column_id]) labels[o.column_id] = [];
    labels[o.column_id].push({ id: o.id, text: o.text, color: o.color });
  }

  // Index untuk lookup cepat
  const colsByBoard: Record<string, any[]> = {};
  for (const c of columns) { (colsByBoard[c.board_id] = colsByBoard[c.board_id] || []).push(c); }
  const groupsByBoard: Record<string, any[]> = {};
  for (const g of groups) { (groupsByBoard[g.board_id] = groupsByBoard[g.board_id] || []).push(g); }
  const itemsByGroup: Record<string, any[]> = {};
  for (const it of items) { (itemsByGroup[it.group_id] = itemsByGroup[it.group_id] || []).push(it); }
  const valsByItem: Record<string, any[]> = {};
  for (const v of values) { (valsByItem[v.item_id] = valsByItem[v.item_id] || []).push(v); }
  const asgByItem: Record<string, any[]> = {};
  for (const a of assignees) { (asgByItem[a.item_id] = asgByItem[a.item_id] || []).push(a); }

  const toCol = (c: any) => ({ id: c.id, label: c.label, width: c.width || '130px', type: c.type === 'people' ? 'team' : c.type });

  const buildItem = (row: any) => {
    const it: any = { id: row.id, name: row.name, isSubItemsOpen: !!row.is_subitems_open, description: row.description || '', subItems: [] };
    for (const v of (valsByItem[row.id] || [])) { it[v.column_id] = v.value; }
    for (const a of (asgByItem[row.id] || [])) {
      if (!Array.isArray(it[a.column_id])) it[a.column_id] = [];
      it[a.column_id].push(a.member_id);
    }
    return it;
  };

  // Sub-board mewarisi izin induknya.
  const petaNode = new Map((nodes || []).map((n: any) => [n.id, n]));
  const boardBolehDenganInduk = (node: any): boolean => {
    if (!node) return false;
    if (boardAllowed(node.name)) return true;
    const induk: any = petaNode.get(node.parent_id);
    return !!induk && induk.kind === 'board' && boardBolehDenganInduk(induk);
  };

  const boardsDataMap: Record<string, any> = {};
  const boardNodes = nodes.filter((n: any) => n.kind === 'board' && boardBolehDenganInduk(n));
  for (const bn of boardNodes) {
    const bcols = (colsByBoard[bn.id] || []).slice().sort(byPos);
    const mainCols = bcols.filter((c: any) => c.scope === 'main').map(toCol);
    const subCols = bcols.filter((c: any) => c.scope === 'sub').map(toCol);
    const bgroups = (groupsByBoard[bn.id] || []).slice().sort(byPos).map((g: any) => {
      const all = (itemsByGroup[g.id] || []).slice().sort(byPos);
      const subsByParent: Record<string, any[]> = {};
      for (const it of all) { if (it.parent_item_id) (subsByParent[it.parent_item_id] = subsByParent[it.parent_item_id] || []).push(it); }
      const tops = all.filter((it: any) => !it.parent_item_id).map((it: any) => {
        const bi = buildItem(it);
        bi.subItems = (subsByParent[it.id] || []).map((s: any) => buildItem(s));
        return bi;
      });
      return { id: g.id, title: g.title, color: g.color, isCollapsed: !!g.is_collapsed, itemLabel: g.item_label || 'Item Name', subItemLabel: g.sub_item_label || 'Subitem', items: tops };
    });
    boardsDataMap[bn.id] = { groups: bgroups, columns: mainCols, subColumns: subCols };
  }

  const kids = (pid: any, kind: string) => nodes.filter((n: any) => n.parent_id === pid && n.kind === kind).slice().sort(byPos);
  // Board bisa punya sub-board (bertingkat) — bangun rekursif.
  const bangunBoard = (b: any): any => ({
    id: b.id, name: b.name, isOpen: b.is_open ?? false,
    boards: kids(b.id, 'board').filter((c: any) => boardBolehDenganInduk(c)).map(bangunBoard),
  });
  const workspaces = nodes.filter((n: any) => n.kind === 'workspace').slice().sort(byPos).map((ws: any) => ({
    id: ws.id, name: ws.name,
    years: kids(ws.id, 'year').map((y: any) => ({
      id: y.id, name: y.name, isOpen: y.is_open ?? false,
      months: kids(y.id, 'month').map((mo: any) => ({
        id: mo.id, name: mo.name, isOpen: mo.is_open ?? false,
        boards: kids(mo.id, 'board').filter((b: any) => boardBolehDenganInduk(b)).map(bangunBoard),
      }))
      .filter((mo: any) => (allowedPatterns.length ? mo.boards.length > 0 : true)),
    }))
    .filter((y: any) => (allowedPatterns.length ? y.months.length > 0 : true)),
  }))
  .filter((ws: any) => (allowedPatterns.length ? ws.years.length > 0 : true));

  // Target per akun per board (bulan) untuk Overview MARKETPLACE.
  const accountTargets: Record<string, Record<string, number>> = {};
  for (const r of (accTargets || [])) {
    const bid = r.board_id, ak = r.akun;
    if (!bid || ak == null) continue;
    if (!accountTargets[bid]) accountTargets[bid] = {};
    accountTargets[bid][ak] = Number(r.target) || 0;
  }

  return { workspaces, boardsDataMap, accountTargets, labels, teamMembers, currentUserId, currentUserRole, canContentHub, canAcc };
}

/** Muat SEMUA (termasuk seluruh nilai sel). Dipakai halaman Pendapatan. */
export async function loadFullState(supabase: SB): Promise<FullState> {
  return bangunState(await ambilMentah(supabase, true));
}

/** Muat KERANGKA saja (tanpa item_values / item_assignees). */
export async function loadStrukturState(supabase: SB): Promise<FullState> {
  return bangunState(await ambilMentah(supabase, false));
}

/** Nilai sel + penugasan untuk sekumpulan item (id item / sub-item). */
export async function loadSelItem(supabase: SB, ids: string[]): Promise<{ values: any[]; assignees: any[] }> {
  const values: any[] = [], assignees: any[] = [];
  const pot = potong(unik(ids), POTONG_ID);
  for (let i = 0; i < pot.length; i += PARALEL) {
    const hasil = await Promise.all(pot.slice(i, i + PARALEL).flatMap((p) => [
      ambilSemua(supabase, 'item_values', 'item_id, column_id, value', { saring: (q) => q.in('item_id', p), urut: URUT_NILAI }),
      ambilSemua(supabase, 'item_assignees', 'item_id, column_id, member_id', { saring: (q) => q.in('item_id', p), urut: URUT_TIM }),
    ]));
    hasil.forEach((r, k) => { (k % 2 === 0 ? values : assignees).push(...r); });
  }
  return { values, assignees };
}

/** Nilai kolom-kolom tertentu untuk SEMUA item (lintas papan). */
export async function loadKolom(supabase: SB, idsNilai: string[], idsTim: string[]): Promise<{ values: any[]; assignees: any[] }> {
  const tugas: (() => Promise<{ jenis: 'v' | 'a'; rows: any[] }>)[] = [];
  for (const p of potong(unik(idsNilai), POTONG_KOLOM)) {
    tugas.push(async () => ({ jenis: 'v', rows: await ambilSemua(supabase, 'item_values', 'item_id, column_id, value', { saring: (q) => q.in('column_id', p), urut: URUT_NILAI }) }));
  }
  for (const p of potong(unik(idsTim), POTONG_KOLOM)) {
    tugas.push(async () => ({ jenis: 'a', rows: await ambilSemua(supabase, 'item_assignees', 'item_id, column_id, member_id', { saring: (q) => q.in('column_id', p), urut: URUT_TIM }) }));
  }
  const values: any[] = [], assignees: any[] = [];
  for (let i = 0; i < tugas.length; i += PARALEL) {
    const hasil = await Promise.all(tugas.slice(i, i + PARALEL).map((t) => t()));
    for (const h of hasil) (h.jenis === 'v' ? values : assignees).push(...h.rows);
  }
  return { values, assignees };
}

/** Id item/sub-item yang di-assign ke pengguna (lewat kolom tim mana pun). */
export async function loadIdItemSaya(supabase: SB, uid: string): Promise<string[]> {
  if (!uid) return [];
  const rows = await ambilSemua(supabase, 'item_assignees', 'item_id, column_id', { saring: (q) => q.eq('member_id', uid), urut: ['item_id', 'column_id'] });
  return unik(rows.map((r: any) => r.item_id));
}

/** Semua baris penugasan untuk sekumpulan item. */
export async function loadTimItem(supabase: SB, ids: string[]): Promise<any[]> {
  const out: any[] = [];
  const pot = potong(unik(ids), POTONG_ID);
  for (let i = 0; i < pot.length; i += PARALEL) {
    const hasil = await Promise.all(pot.slice(i, i + PARALEL).map((p) =>
      ambilSemua(supabase, 'item_assignees', 'item_id, column_id, member_id', { saring: (q) => q.in('item_id', p), urut: URUT_TIM })));
    for (const r of hasil) out.push(...r);
  }
  return out;
}

/** Semua nilai satu kolom (dipakai pembersihan saat label dihapus). */
export async function ambilNilaiKolom(supabase: SB, columnId: string): Promise<{ item_id: string; value: any }[]> {
  return ambilSemua(supabase, 'item_values', 'item_id, value', { saring: (q) => q.eq('column_id', columnId), urut: ['item_id'] });
}

// ═══════════════ Fungsi murni penggabung (tanpa jaringan) ═══════════════

/** itemId → kumpulan kolom yang nilainya harus dipertahankan dari memori. */
export type Lindung = Map<string, Set<string>>;

const KUNCI_STRUKTUR = ['id', 'name', 'isSubItemsOpen', 'description', 'subItems'];
const ambilStruktur = (it: any) => { const o: any = {}; for (const k of KUNCI_STRUKTUR) if (k in it) o[k] = it[k]; return o; };
const ambilSelSaja = (it: any) => { const o: any = {}; for (const k of Object.keys(it)) if (!KUNCI_STRUKTUR.includes(k)) o[k] = it[k]; return o; };
const samaNilai = (a: any, b: any) => a === b || (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null && JSON.stringify(a) === JSON.stringify(b));

/** values + assignees → itemId → { kolomId: nilai } (kolom tim = array unik). */
function indeksSel(values: any[], assignees: any[]) {
  const m = new Map<string, Record<string, any>>();
  const ambil = (id: string) => { let r = m.get(id); if (!r) { r = {}; m.set(id, r); } return r; };
  for (const v of (values || [])) { if (v?.item_id && v?.column_id) ambil(v.item_id)[v.column_id] = v.value; }
  for (const a of (assignees || [])) {
    if (!a?.item_id || !a?.column_id) continue;
    const r = ambil(a.item_id);
    if (!Array.isArray(r[a.column_id])) r[a.column_id] = [];
    if (a.member_id && !r[a.column_id].includes(a.member_id)) r[a.column_id].push(a.member_id);
  }
  return m;
}

/**
 * Petakan setiap item & sub-item. Objek yang tidak berubah dipertahankan
 * referensinya (papan/grup/item) supaya React tidak menggambar ulang sia-sia.
 */
function petakanItem(peta: Record<string, any>, fn: (it: any, bid: string) => any): Record<string, any> {
  let berubahPeta = false;
  const hasil: Record<string, any> = {};
  for (const bid of Object.keys(peta || {})) {
    const bd = peta[bid];
    let berubahPapan = false;
    const groups = (bd?.groups || []).map((g: any) => {
      let berubahGrup = false;
      const items = (g.items || []).map((it: any) => {
        let baru = fn(it, bid);
        const subs = baru.subItems || [];
        let berubahSub = false;
        const subsBaru = subs.map((s: any) => { const sb = fn(s, bid); if (sb !== s) berubahSub = true; return sb; });
        if (berubahSub) baru = { ...baru, subItems: subsBaru };
        if (baru !== it) berubahGrup = true;
        return baru;
      });
      if (!berubahGrup) return g;
      berubahPapan = true;
      return { ...g, items };
    });
    if (berubahPapan) { hasil[bid] = { ...bd, groups }; berubahPeta = true; }
    else hasil[bid] = bd;
  }
  return berubahPeta ? hasil : peta;
}

/** Bangun ulang sel item yang `diminta` dari hasil server (sel `lindung` tetap). */
export function terapkanSel(peta: Record<string, any>, values: any[], assignees: any[], diminta: Set<string>, lindung?: Lindung): Record<string, any> {
  if (!diminta || !diminta.size) return peta;
  const idx = indeksSel(values, assignees);
  return petakanItem(peta, (it) => {
    if (!diminta.has(it.id)) return it;
    const baru: any = { ...ambilStruktur(it), ...(idx.get(it.id) || {}) };
    // Sel yang baru diubah di memori (edit / realtime) dipertahankan. Bila memori
    // belum punya sel itu sama sekali, nilai dari server yang dipakai.
    const lk = lindung?.get(it.id);
    if (lk) for (const c of lk) { if (c in it) baru[c] = it[c]; }
    return baru;
  });
}

/** Isi kolom-kolom tertentu untuk semua item (kecuali `lewati`). */
export function terapkanKolom(peta: Record<string, any>, values: any[], assignees: any[], kolomIds: Set<string>, lewati: Set<string>, lindung?: Lindung): Record<string, any> {
  if (!kolomIds || !kolomIds.size) return peta;
  const idx = indeksSel(values, assignees);
  const relevan: Record<string, string[]> = {};
  for (const bid of Object.keys(peta || {})) {
    const bd = peta[bid];
    relevan[bid] = [...(bd?.columns || []), ...(bd?.subColumns || [])].map((c: any) => c.id).filter((id: string) => kolomIds.has(id));
  }
  return petakanItem(peta, (it, bid) => {
    const rel = relevan[bid];
    if (!rel || !rel.length || lewati.has(it.id)) return it;
    const sel = idx.get(it.id) || {};
    const lk = lindung?.get(it.id);
    let baru: any = null;
    for (const c of rel) {
      if (lk && lk.has(c) && c in it) continue;
      const v = sel[c];
      if (v === undefined) { if (c in it) { baru = baru || { ...it }; delete baru[c]; } }
      else if (!samaNilai(it[c], v)) { baru = baru || { ...it }; baru[c] = v; }
    }
    return baru || it;
  });
}

/** Set kolom tim (array member) untuk pasangan item+kolom di `antrian`. */
export function terapkanTim(peta: Record<string, any>, antrian: Map<string, Set<string>>, rows: any[], lindung?: Lindung): Record<string, any> {
  if (!antrian || !antrian.size) return peta;
  const idx = indeksSel([], rows);
  return petakanItem(peta, (it) => {
    const cols = antrian.get(it.id);
    if (!cols) return it;
    const lk = lindung?.get(it.id);
    let baru: any = null;
    for (const c of cols) {
      if (lk && lk.has(c) && c in it) continue;
      const v = idx.get(it.id)?.[c] || [];
      if (!samaNilai(it[c] ?? [], v)) { baru = baru || { ...it }; baru[c] = v; }
    }
    return baru || it;
  });
}

/**
 * Gabungkan kerangka BARU (tanpa sel) dengan sel yang sudah ada di memori
 * (dicocokkan per id item, termasuk item yang pindah grup/papan). Views
 * papan lama dipertahankan (view kustom tak lagi hilang saat refresh).
 */
export function pertahankanSel(baru: Record<string, any>, lama: Record<string, any>): Record<string, any> {
  const idxLama = new Map<string, any>();
  for (const bid of Object.keys(lama || {})) {
    for (const g of (lama[bid]?.groups || [])) for (const it of (g.items || [])) {
      idxLama.set(it.id, it);
      for (const s of (it.subItems || [])) idxLama.set(s.id, s);
    }
  }
  const salin = (it: any) => { const l = idxLama.get(it.id); return l ? { ...ambilSelSaja(l), ...it } : it; };
  const out: Record<string, any> = {};
  for (const bid of Object.keys(baru || {})) {
    const bd = baru[bid];
    const groups = (bd.groups || []).map((g: any) => ({
      ...g,
      items: (g.items || []).map((it: any) => ({ ...salin(it), subItems: (it.subItems || []).map(salin) })),
    }));
    const viewsLama = lama?.[bid]?.views;
    out[bid] = { ...bd, groups, ...(viewsLama && viewsLama.length ? { views: viewsLama } : {}) };
  }
  return out;
}

/** Id semua item + sub-item sebuah papan. */
export function idItemBoard(bd: any): string[] {
  const out: string[] = [];
  for (const g of (bd?.groups || [])) for (const it of (g.items || [])) {
    out.push(it.id);
    for (const s of (it.subItems || [])) out.push(s.id);
  }
  return out;
}

/** Id semua item + sub-item di seluruh peta. */
export function semuaIdItem(peta: Record<string, any>): Set<string> {
  const out = new Set<string>();
  for (const bid of Object.keys(peta || {})) for (const id of idItemBoard(peta[bid])) out.add(id);
  return out;
}

/** Kolom PERTAMA bertipe tertentu per papan (utama & sub) — pola yang dipakai antrean/badge. */
export function kolomPertamaPerTipe(peta: Record<string, any>, tipe: string[]): { nilai: string[]; tim: string[] } {
  const nilai = new Set<string>(), tim = new Set<string>();
  for (const bid of Object.keys(peta || {})) {
    const bd = peta[bid];
    for (const daftar of [bd?.columns || [], bd?.subColumns || []]) {
      for (const t of tipe) {
        const c = daftar.find((x: any) => x.type === t);
        if (!c) continue;
        (t === 'team' ? tim : nilai).add(c.id);
      }
    }
  }
  return { nilai: [...nilai], tim: [...tim] };
}

/** Id item/sub-item yang (menurut memori) memuat `uid` di salah satu kolom tim. */
export function idItemBertim(peta: Record<string, any>, uid: string): string[] {
  const out: string[] = [];
  if (!uid) return out;
  for (const bid of Object.keys(peta || {})) {
    const bd = peta[bid];
    const timUtama = (bd?.columns || []).filter((c: any) => c.type === 'team').map((c: any) => c.id);
    const timSub = (bd?.subColumns || []).filter((c: any) => c.type === 'team').map((c: any) => c.id);
    const ada = (it: any, cols: string[]) => cols.some((c) => Array.isArray(it[c]) && it[c].includes(uid));
    for (const g of (bd?.groups || [])) for (const it of (g.items || [])) {
      if (ada(it, timUtama)) out.push(it.id);
      for (const s of (it.subItems || [])) if (ada(s, timSub)) out.push(s.id);
    }
  }
  return out;
}
