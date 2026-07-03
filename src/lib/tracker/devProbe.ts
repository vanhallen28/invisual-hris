// DEV-ONLY probe untuk memverifikasi tulis/baca/RLS Supabase sebelum wiring app.
type SB = any;

const ZERO = '00000000-0000-0000-0000-000000000000';

export async function clearAllBoards(supabase: SB) {
  const { error } = await supabase.from('tree_nodes').delete().neq('id', ZERO);
  if (error) throw new Error('Hapus gagal: ' + error.message);
}

async function insOne(supabase: SB, table: string, row: any): Promise<string> {
  const { data, error } = await supabase.from(table).insert(row).select('id').single();
  if (error) throw new Error(table + ': ' + error.message);
  return data.id as string;
}

export async function seedSample(supabase: SB, userId: string) {
  const wsId = await insOne(supabase, 'tree_nodes', { kind: 'workspace', name: 'DEMO WS', position: 0 });
  const yId = await insOne(supabase, 'tree_nodes', { parent_id: wsId, kind: 'year', name: '2026', position: 0 });
  const mId = await insOne(supabase, 'tree_nodes', { parent_id: yId, kind: 'month', name: 'JULI', position: 0 });
  const boardId = await insOne(supabase, 'tree_nodes', { parent_id: mId, kind: 'board', name: 'DEMO BOARD', position: 0 });

  const groupId = await insOne(supabase, 'groups', { board_id: boardId, title: 'Batch 1', color: '#579bfc', position: 0 });

  const statusColId = await insOne(supabase, 'columns', { board_id: boardId, scope: 'main', label: 'Status', type: 'status', position: 0 });
  const optRes = await supabase.from('column_options').insert([
    { column_id: statusColId, text: 'Done', color: 'bg-[#00c875]', position: 0 },
    { column_id: statusColId, text: 'Working on it', color: 'bg-[#fdab3d]', position: 1 },
    { column_id: statusColId, text: 'Stuck', color: 'bg-[#e2445c]', position: 2 },
  ]);
  if (optRes.error) throw new Error('column_options: ' + optRes.error.message);

  const peopleColId = await insOne(supabase, 'columns', { board_id: boardId, scope: 'main', label: 'People', type: 'people', position: 1 });

  const itemAId = await insOne(supabase, 'items', { group_id: groupId, name: 'Tugas A (punyaku)', position: 0 });
  await insOne(supabase, 'items', { group_id: groupId, name: 'Tugas B', position: 1 });

  const ivRes = await supabase.from('item_values').insert({ item_id: itemAId, column_id: statusColId, value: 'Working on it' });
  if (ivRes.error) throw new Error('item_values: ' + ivRes.error.message);

  const iaRes = await supabase.from('item_assignees').insert({ item_id: itemAId, column_id: peopleColId, member_id: userId });
  if (iaRes.error) throw new Error('item_assignees: ' + iaRes.error.message);

  return { boardId };
}

export async function loadTreeAndBoard(supabase: SB) {
  const nRes = await supabase.from('tree_nodes').select('id,parent_id,kind,name,position').order('position');
  if (nRes.error) throw new Error('tree_nodes: ' + nRes.error.message);
  const nodes = nRes.data || [];

  const board = nodes.find((n: any) => n.kind === 'board') || null;
  if (!board) return { nodes, board: null, groups: [], columns: [], items: [], values: [], assignees: [] };

  const gRes = await supabase.from('groups').select('id,title,color,position').eq('board_id', board.id).order('position');
  if (gRes.error) throw new Error('groups: ' + gRes.error.message);
  const groups = gRes.data || [];

  const cRes = await supabase.from('columns').select('id,label,type,scope,position').eq('board_id', board.id).order('position');
  if (cRes.error) throw new Error('columns: ' + cRes.error.message);
  const columns = cRes.data || [];

  const groupIds = groups.map((g: any) => g.id);
  let items: any[] = [];
  if (groupIds.length) {
    const iRes = await supabase.from('items').select('id,group_id,name,parent_item_id,position').in('group_id', groupIds).order('position');
    if (iRes.error) throw new Error('items: ' + iRes.error.message);
    items = iRes.data || [];
  }

  const itemIds = items.map((i: any) => i.id);
  let values: any[] = [];
  let assignees: any[] = [];
  if (itemIds.length) {
    const vRes = await supabase.from('item_values').select('item_id,column_id,value').in('item_id', itemIds);
    if (vRes.error) throw new Error('item_values: ' + vRes.error.message);
    values = vRes.data || [];
    const aRes = await supabase.from('item_assignees').select('item_id,column_id,member_id').in('item_id', itemIds);
    if (aRes.error) throw new Error('item_assignees: ' + aRes.error.message);
    assignees = aRes.data || [];
  }

  return { nodes, board, groups, columns, items, values, assignees };
}
