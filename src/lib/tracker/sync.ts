// Penulis ke Supabase (1e) — fungsi kecil & fokus. Dipanggil dari handler context
// secara fire-and-forget (UI sudah update di memori; ini menyinkronkan ke cloud).
// Semua id item/kolom sudah uuid (hasil load), jadi nilai sel tak perlu id baru.
type SB = any;

const isEmpty = (v: any) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

// Update nama item (rename)
export async function dbUpdateItemName(supabase: SB, itemId: string, name: string) {
  const { error } = await supabase.from('items').update({ name }).eq('id', itemId);
  if (error) throw new Error(error.message);
}

// Update meta item (mis. is_subitems_open)
export async function dbSetItemMeta(supabase: SB, itemId: string, patch: Record<string, any>) {
  const { error } = await supabase.from('items').update(patch).eq('id', itemId);
  if (error) throw new Error(error.message);
}

// Set nilai sebuah sel. type 'team' -> item_assignees; selain itu -> item_values (jsonb).
export async function dbSetCellValue(supabase: SB, itemId: string, columnId: string, type: string, val: any) {
  if (type === 'team') {
    const del = await supabase.from('item_assignees').delete().eq('item_id', itemId).eq('column_id', columnId);
    if (del.error) throw new Error(del.error.message);
    const ids: string[] = Array.isArray(val) ? val : (val ? [val] : []);
    if (ids.length) {
      const rows = ids.map((mid) => ({ item_id: itemId, column_id: columnId, member_id: mid }));
      const ins = await supabase.from('item_assignees').insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    }
    return;
  }
  if (isEmpty(val)) {
    const del = await supabase.from('item_values').delete().eq('item_id', itemId).eq('column_id', columnId);
    if (del.error) throw new Error(del.error.message);
    return;
  }
  const up = await supabase.from('item_values').upsert(
    { item_id: itemId, column_id: columnId, value: val },
    { onConflict: 'item_id,column_id' }
  );
  if (up.error) throw new Error(up.error.message);
}

// id uuid untuk entitas baru (PK Supabase). Fallback hanya untuk browser sangat lama.
export const newId = (): string =>
  (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);

// Tambah item utama
export async function dbAddItem(supabase: SB, p: { id: string; groupId: string; name: string; position: number }) {
  const { error } = await supabase.from('items').insert({ id: p.id, group_id: p.groupId, name: p.name, position: p.position, is_subitems_open: false });
  if (error) throw new Error(error.message);
}

// Tambah sub-item (item dengan parent_item_id)
export async function dbAddSubItem(supabase: SB, p: { id: string; groupId: string; parentItemId: string; name: string; position: number }) {
  const { error } = await supabase.from('items').insert({ id: p.id, group_id: p.groupId, parent_item_id: p.parentItemId, name: p.name, position: p.position });
  if (error) throw new Error(error.message);
}

// Hapus item/sub-item (cascade: sub-item, item_values, item_assignees ikut terhapus)
export async function dbDeleteItem(supabase: SB, itemId: string) {
  const { error } = await supabase.from('items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
}

// Tambah kolom. type 'team' (People) -> disimpan 'people' di DB.
export async function dbAddColumn(supabase: SB, p: { id: string; boardId: string; scope: 'main' | 'sub'; label: string; type: string; width: string; position: number }) {
  const dbType = p.type === 'team' ? 'people' : p.type;
  const { error } = await supabase.from('columns').insert({ id: p.id, board_id: p.boardId, scope: p.scope, label: p.label, type: dbType, width: p.width, position: p.position });
  if (error) throw new Error(error.message);
}

// Hapus kolom (cascade: column_options, item_values, item_assignees ikut terhapus)
export async function dbDeleteColumn(supabase: SB, columnId: string) {
  const { error } = await supabase.from('columns').delete().eq('id', columnId);
  if (error) throw new Error(error.message);
}

// Tambah opsi/label (status/dropdown)
export async function dbAddLabel(supabase: SB, p: { id: string; columnId: string; text: string; color: string; position: number }) {
  const { error } = await supabase.from('column_options').insert({ id: p.id, column_id: p.columnId, text: p.text, color: p.color, position: p.position });
  if (error) throw new Error(error.message);
}

// Hapus opsi/label
export async function dbDeleteLabel(supabase: SB, labelId: string) {
  const { error } = await supabase.from('column_options').delete().eq('id', labelId);
  if (error) throw new Error(error.message);
}

// Ubah warna opsi/label
export async function dbUpdateLabelColor(supabase: SB, labelId: string, color: string) {
  const { error } = await supabase.from('column_options').update({ color }).eq('id', labelId);
  if (error) throw new Error(error.message);
}

// Tambah grup
export async function dbAddGroup(supabase: SB, p: { id: string; boardId: string; title: string; color: string; position: number }) {
  const { error } = await supabase.from('groups').insert({ id: p.id, board_id: p.boardId, title: p.title, color: p.color, is_collapsed: false, item_label: 'Item Name', sub_item_label: 'Subitem', position: p.position });
  if (error) throw new Error(error.message);
}

// Update properti grup (camelCase -> kolom DB)
export async function dbUpdateGroup(supabase: SB, groupId: string, patch: Record<string, any>) {
  const map: Record<string, string> = { title: 'title', color: 'color', isCollapsed: 'is_collapsed', itemLabel: 'item_label', subItemLabel: 'sub_item_label', position: 'position' };
  const row: Record<string, any> = {};
  for (const k of Object.keys(patch)) { const col = map[k]; if (col) row[col] = patch[k]; }
  if (!Object.keys(row).length) return;
  const { error } = await supabase.from('groups').update(row).eq('id', groupId);
  if (error) throw new Error(error.message);
}

// Hapus grup (cascade: items -> item_values/assignees ikut terhapus)
export async function dbDeleteGroup(supabase: SB, groupId: string) {
  const { error } = await supabase.from('groups').delete().eq('id', groupId);
  if (error) throw new Error(error.message);
}

// Tambah node pohon (year/month/board). parentId null untuk workspace.
export async function dbAddTreeNode(supabase: SB, p: { id: string; parentId: string | null; kind: string; name: string; position: number }) {
  const { error } = await supabase.from('tree_nodes').insert({ id: p.id, parent_id: p.parentId, kind: p.kind, name: p.name, position: p.position, is_open: true });
  if (error) throw new Error(error.message);
}

// Rename node pohon
export async function dbRenameTreeNode(supabase: SB, nodeId: string, name: string) {
  const { error } = await supabase.from('tree_nodes').update({ name }).eq('id', nodeId);
  if (error) throw new Error(error.message);
}

// Hapus node pohon (cascade: anak node + groups/columns/items ikut terhapus)
export async function dbDeleteTreeNode(supabase: SB, nodeId: string) {
  const { error } = await supabase.from('tree_nodes').delete().eq('id', nodeId);
  if (error) throw new Error(error.message);
}

// Rename label kolom
export async function dbUpdateColumnLabel(supabase: SB, columnId: string, label: string) {
  const { error } = await supabase.from('columns').update({ label }).eq('id', columnId);
  if (error) throw new Error(error.message);
}

// Set ulang posisi kolom sesuai urutan id
export async function dbReindexColumns(supabase: SB, ids: string[]) {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase.from('columns').update({ position: i }).eq('id', ids[i]);
    if (error) throw new Error(error.message);
  }
}

// Set ulang posisi grup sesuai urutan id
export async function dbReindexGroups(supabase: SB, ids: string[]) {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase.from('groups').update({ position: i }).eq('id', ids[i]);
    if (error) throw new Error(error.message);
  }
}

// Set ulang posisi item (opsional pindah group_id untuk item yang berpindah grup)
export async function dbReindexItems(supabase: SB, items: { id: string; position: number; groupId?: string }[]) {
  for (const it of items) {
    const patch: any = { position: it.position };
    if (it.groupId) patch.group_id = it.groupId;
    const { error } = await supabase.from('items').update(patch).eq('id', it.id);
    if (error) throw new Error(error.message);
  }
}
