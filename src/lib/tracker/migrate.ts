// Migrasi sekali-jalan: baca data localStorage app (inv_data_v24) lalu tulis ke Supabase.
// WRITE-ONLY — tidak mengubah cara app berjalan. Butuh role manager (RLS).
// Catatan: anggota tim selain user yang login belum punya akun auth, jadi
// assignment ke mereka dilewati (item & nilai lain tetap dipindahkan).
type SB = any;

async function insOne(supabase: SB, table: string, row: any): Promise<string> {
  const { data, error } = await supabase.from(table).insert(row).select('id').single();
  if (error) throw new Error(table + ': ' + error.message);
  return data.id as string;
}

type ColInfo = { id: string; type: string; scope: 'main' | 'sub' };

async function migrateItemValues(
  supabase: SB, item: any, colMap: Record<string, ColInfo>,
  dbItemId: string, memberMap: Record<string, string>, counts: any, scope: 'main' | 'sub'
) {
  for (const localColId of Object.keys(colMap)) {
    const info = colMap[localColId];
    if (info.scope !== scope) continue;
    const val = item[localColId];
    if (val === undefined || val === null || val === '') continue;
    if (Array.isArray(val) && val.length === 0) continue;

    if (info.type === 'team') {
      const ids = Array.isArray(val) ? val : [val];
      for (const tmId of ids) {
        const memberId = memberMap[tmId];
        if (!memberId) { counts.skippedAssignees++; continue; }
        const r = await supabase.from('item_assignees').insert({ item_id: dbItemId, column_id: info.id, member_id: memberId });
        if (r.error) throw new Error('item_assignees: ' + r.error.message);
        counts.assignees++;
      }
    } else {
      const r = await supabase.from('item_values').insert({ item_id: dbItemId, column_id: info.id, value: val });
      if (r.error) throw new Error('item_values: ' + r.error.message);
      counts.values++;
    }
  }
}

export async function migrateFromLocalStorage(supabase: SB, currentUserId: string) {
  // Peramban mode penyamaran bisa menolak akses localStorage — jangan sampai
  // seluruh proses berhenti karena itu.
  let raw: string | null = null;
  try { raw = typeof window !== 'undefined' ? localStorage.getItem('inv_data_v24') : null; }
  catch { throw new Error('Penyimpanan lokal tidak bisa dibaca di peramban ini.'); }
  if (!raw) throw new Error('Tidak ada data localStorage (inv_data_v24) untuk dimigrasi.');
  const data = JSON.parse(raw);
  const workspaces = data.workspaces || [];
  const boardsDataMap = data.boardsDataMap || {};
  const labels = data.labels || {};

  // Peta id anggota localStorage -> members.id (auth). Hanya 'me' / user login.
  const memberMap: Record<string, string> = { me: currentUserId };
  memberMap[currentUserId] = currentUserId;

  const counts: any = { boards: 0, groups: 0, columns: 0, options: 0, items: 0, subitems: 0, values: 0, assignees: 0, skippedAssignees: 0 };

  for (const ws of workspaces) {
    const wsId = await insOne(supabase, 'tree_nodes', { kind: 'workspace', name: ws.name || 'Workspace', position: 0 });
    const years = ws.years || [];
    for (let yi = 0; yi < years.length; yi++) {
      const year = years[yi];
      const yId = await insOne(supabase, 'tree_nodes', { parent_id: wsId, kind: 'year', name: year.name || '----', position: yi });
      const months = year.months || [];
      for (let mi = 0; mi < months.length; mi++) {
        const month = months[mi];
        const mId = await insOne(supabase, 'tree_nodes', { parent_id: yId, kind: 'month', name: month.name || '----', position: mi });
        const boards = month.boards || [];
        for (let bi = 0; bi < boards.length; bi++) {
          const board = boards[bi];
          const boardNodeId = await insOne(supabase, 'tree_nodes', { parent_id: mId, kind: 'board', name: board.name || 'Board', position: bi });
          counts.boards++;

          const bd = boardsDataMap[board.id];
          if (!bd) continue;

          // Kolom (main + sub) -> simpan peta localColId -> { dbId, type, scope }
          const colMap: Record<string, ColInfo> = {};
          const mainCols = (bd.columns || []).map((c: any) => ({ c, scope: 'main' as const }));
          const subCols = (bd.subColumns || []).map((c: any) => ({ c, scope: 'sub' as const }));
          const allCols = [...mainCols, ...subCols];
          for (let ci = 0; ci < allCols.length; ci++) {
            const { c, scope } = allCols[ci];
            const dbType = c.type === 'team' ? 'people' : c.type; // team -> people
            const dbColId = await insOne(supabase, 'columns', { board_id: boardNodeId, scope, label: c.label, type: dbType, width: c.width || '130px', position: ci });
            colMap[c.id] = { id: dbColId, type: c.type, scope };
            counts.columns++;

            const opts = labels[c.id] || [];
            if (opts.length) {
              const rows = opts.map((o: any, oi: number) => ({ column_id: dbColId, text: o.text, color: o.color, position: oi }));
              const r = await supabase.from('column_options').insert(rows);
              if (r.error) throw new Error('column_options: ' + r.error.message);
              counts.options += rows.length;
            }
          }

          // Group + item + subitem
          const groups = bd.groups || [];
          for (let gi = 0; gi < groups.length; gi++) {
            const g = groups[gi];
            const dbGroupId = await insOne(supabase, 'groups', {
              board_id: boardNodeId, title: g.title || 'Group', color: g.color || '#579bfc',
              is_collapsed: !!g.isCollapsed, item_label: g.itemLabel || 'Item Name',
              sub_item_label: g.subItemLabel || 'Subitem', position: gi,
            });
            counts.groups++;

            const items = g.items || [];
            for (let ii = 0; ii < items.length; ii++) {
              const it = items[ii];
              const dbItemId = await insOne(supabase, 'items', { group_id: dbGroupId, name: it.name || 'Item', position: ii, is_subitems_open: !!it.isSubItemsOpen });
              counts.items++;
              await migrateItemValues(supabase, it, colMap, dbItemId, memberMap, counts, 'main');

              const subs = it.subItems || [];
              for (let si = 0; si < subs.length; si++) {
                const sub = subs[si];
                const dbSubId = await insOne(supabase, 'items', { group_id: dbGroupId, parent_item_id: dbItemId, name: sub.name || 'Subitem', position: si });
                counts.subitems++;
                await migrateItemValues(supabase, sub, colMap, dbSubId, memberMap, counts, 'sub');
              }
            }
          }
        }
      }
    }
  }

  return counts;
}
