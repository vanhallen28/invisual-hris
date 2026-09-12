// Rekonstruksi seluruh state app dari Supabase (kebalikan dari migrate.ts).
// Dipakai untuk preview di /dev/supabase, lalu nanti untuk load di context app.
// Self-contained: hanya butuh client supabase yang dioper.
type SB = any;

export type FullState = {
  workspaces: any[];
  boardsDataMap: Record<string, any>;
  accountTargets: Record<string, Record<string, number>>;
  labels: Record<string, any[]>;
  teamMembers: any[];
  currentUserId: string | null;
  currentUserRole: string;
};

/**
 * Ambil SEMUA baris sebuah tabel dengan paginasi. Supabase membatasi
 * select('*') ke maksimum 1000 baris per permintaan; tanpa ini, data di atas
 * 1000 baris (mis. item_values yang banyak) tak ikut termuat sehingga sel
 * tampak kosong saat reload.
 */
async function ambilSemua(supabase: SB, tabel: string): Promise<any[]> {
  const semua: any[] = [];
  const ukuran = 1000;
  let dari = 0;
  // Batas aman agar tak pernah tak-berujung (maks ~500rb baris).
  for (let putaran = 0; putaran < 500; putaran++) {
    const { data, error } = await supabase.from(tabel).select('*').range(dari, dari + ukuran - 1);
    if (error) throw new Error(error.message);
    const batch = data || [];
    semua.push(...batch);
    if (batch.length < ukuran) break;
    dari += ukuran;
  }
  return semua;
}

export async function loadFullState(supabase: SB): Promise<FullState> {
  const ures = await supabase.auth.getUser();
  const currentUserId = ures?.data?.user?.id || null;
  const currentEmail = String(ures?.data?.user?.email || '').toLowerCase();
  const isAdminEmail = currentEmail.endsWith('@invisual.studio');

  // Semua tabel diambil dengan paginasi agar tak terpotong batas 1000 baris.
  const [nodes, groups, columns, options, items, values, assignees, membersRows, accTargets] = await Promise.all([
    ambilSemua(supabase, 'tree_nodes'),
    ambilSemua(supabase, 'groups'),
    ambilSemua(supabase, 'columns'),
    ambilSemua(supabase, 'column_options'),
    ambilSemua(supabase, 'items'),
    ambilSemua(supabase, 'item_values'),
    ambilSemua(supabase, 'item_assignees'),
    ambilSemua(supabase, 'members'),
    ambilSemua(supabase, 'account_targets'),
  ]);

  const num = (x: any) => (typeof x === 'number' ? x : 0);
  const byPos = (a: any, b: any) => num(a.position) - num(b.position);

  const teamMembers = membersRows.map((m: any) => ({ id: m.id, name: m.name, color: m.color || 'bg-primer-terang', initials: m.initials || '?' }));
  const meRow = membersRows.find((m: any) => m.id === currentUserId);
  // Admin @invisual.studio SELALU manager (punya akses penuh: board, Content Hub, buat channel suara).
  const currentUserRole = isAdminEmail ? 'manager' : ((meRow?.role) || 'member');
  // Akses Content Hub (kolom members.content_hub) — default boleh; admin selalu boleh
  const canContentHub = isAdminEmail ? true : (meRow?.content_hub !== false);
  // Akses ACC Brief (kolom members.acc_brief) — default TIDAK boleh; admin selalu
  // boleh. Manajer sudah otomatis bisa lewat gerbang isManager, jadi ini murni
  // untuk memberi akses ACC kepada NON-manajer (akses "tanggung").
  const canAcc = isAdminEmail ? true : (meRow?.acc_brief === true);

  // Pembatasan board per-manajer (tabel board_access).
  // Manajer TANPA baris di board_access → akses semua board (perilaku default).
  // Manajer DENGAN baris → hanya board yang namanya cocok salah satu pola.
  let allowedPatterns: string[] = [];
  if (currentUserRole === 'manager' && currentUserId) {
    try {
      const { data: ba } = await supabase.from('board_access').select('board_pattern').eq('member_id', currentUserId);
      allowedPatterns = (ba || []).map((r: any) => String(r.board_pattern || '').trim().toLowerCase()).filter(Boolean);
    } catch { /* tabel belum ada → tanpa pembatasan */ }
  }
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

  const boardsDataMap: Record<string, any> = {};
  const boardNodes = nodes.filter((n: any) => n.kind === 'board' && boardAllowed(n.name));
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
    boards: kids(b.id, 'board').filter((c: any) => boardAllowed(c.name)).map(bangunBoard),
  });
  const workspaces = nodes.filter((n: any) => n.kind === 'workspace').slice().sort(byPos).map((ws: any) => ({
    id: ws.id, name: ws.name,
    years: kids(ws.id, 'year').map((y: any) => ({
      id: y.id, name: y.name, isOpen: y.is_open ?? false,
      months: kids(y.id, 'month').map((m: any) => ({
        id: m.id, name: m.name, isOpen: m.is_open ?? false,
        boards: kids(m.id, 'board').filter((b: any) => boardAllowed(b.name)).map(bangunBoard),
      }))
      // Manajer terbatas: sembunyikan bulan yang tak punya board yang boleh diakses
      .filter((m: any) => (allowedPatterns.length ? m.boards.length > 0 : true)),
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
