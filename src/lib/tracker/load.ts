// Rekonstruksi seluruh state app dari Supabase (kebalikan dari migrate.ts).
// Dipakai untuk preview di /dev/supabase, lalu nanti untuk load di context app.
// Self-contained: hanya butuh client supabase yang dioper.
type SB = any;

export type FullState = {
  workspaces: any[];
  boardsDataMap: Record<string, any>;
  labels: Record<string, any[]>;
  teamMembers: any[];
  currentUserId: string | null;
  currentUserRole: string;
};

export async function loadFullState(supabase: SB): Promise<FullState> {
  const ures = await supabase.auth.getUser();
  const currentUserId = ures?.data?.user?.id || null;
  const currentEmail = String(ures?.data?.user?.email || '').toLowerCase();
  const isAdminEmail = currentEmail.endsWith('@invisual.studio');

  const [nodesR, groupsR, colsR, optsR, itemsR, valsR, asgR, membersR] = await Promise.all([
    supabase.from('tree_nodes').select('*'),
    supabase.from('groups').select('*'),
    supabase.from('columns').select('*'),
    supabase.from('column_options').select('*'),
    supabase.from('items').select('*'),
    supabase.from('item_values').select('*'),
    supabase.from('item_assignees').select('*'),
    supabase.from('members').select('*'),
  ]);
  const checks = [nodesR, groupsR, colsR, optsR, itemsR, valsR, asgR, membersR];
  for (const r of checks) { if (r.error) throw new Error(r.error.message); }

  const nodes = nodesR.data || [];
  const groups = groupsR.data || [];
  const columns = colsR.data || [];
  const options = optsR.data || [];
  const items = itemsR.data || [];
  const values = valsR.data || [];
  const assignees = asgR.data || [];
  const membersRows = membersR.data || [];

  const num = (x: any) => (typeof x === 'number' ? x : 0);
  const byPos = (a: any, b: any) => num(a.position) - num(b.position);

  const teamMembers = membersRows.map((m: any) => ({ id: m.id, name: m.name, color: m.color || 'bg-[#579bfc]', initials: m.initials || '?' }));
  const meRow = membersRows.find((m: any) => m.id === currentUserId);
  // Admin @invisual.studio SELALU manager (punya akses penuh: board, Content Hub, buat channel suara).
  const currentUserRole = isAdminEmail ? 'manager' : ((meRow?.role) || 'member');
  // Akses Content Hub (kolom members.content_hub) — default boleh; admin selalu boleh
  const canContentHub = isAdminEmail ? true : (meRow?.content_hub !== false);

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
  const workspaces = nodes.filter((n: any) => n.kind === 'workspace').slice().sort(byPos).map((ws: any) => ({
    id: ws.id, name: ws.name,
    years: kids(ws.id, 'year').map((y: any) => ({
      id: y.id, name: y.name, isOpen: y.is_open ?? false,
      months: kids(y.id, 'month').map((m: any) => ({
        id: m.id, name: m.name, isOpen: m.is_open ?? false,
        boards: kids(m.id, 'board').filter((b: any) => boardAllowed(b.name)).map((b: any) => ({ id: b.id, name: b.name })),
      }))
      // Manajer terbatas: sembunyikan bulan yang tak punya board yang boleh diakses
      .filter((m: any) => (allowedPatterns.length ? m.boards.length > 0 : true)),
    }))
    .filter((y: any) => (allowedPatterns.length ? y.months.length > 0 : true)),
  }))
  .filter((ws: any) => (allowedPatterns.length ? ws.years.length > 0 : true));

  return { workspaces, boardsDataMap, labels, teamMembers, currentUserId, currentUserRole, canContentHub };
}
