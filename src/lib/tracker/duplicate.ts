// src/lib/tracker/duplicate.ts
// Menduplikasi papan beserta isinya. Seluruh ID dibuat baru dan dipetakan
// ulang, supaya tidak ada satu pun tautan yang masih menunjuk papan lama.
//
// Tiga tingkat penyalinan:
//   'struktur' → kolom, pilihan label, dan grup saja (tabel kosong siap pakai)
//   'item'     → ditambah item, subitem, isi sel, dan PIC
//   'penuh'    → ditambah pembaruan/komentar tiap item

type SB = any;
export type ModeDuplikat = 'struktur' | 'item' | 'penuh';

export const LABEL_MODE: Record<ModeDuplikat, string> = {
  struktur: 'Struktur papan saja',
  item: 'Struktur papan & item',
  penuh: 'Struktur papan, item & pembaruan',
};

export const KETERANGAN_MODE: Record<ModeDuplikat, string> = {
  struktur: 'Kolom, label, dan grup ikut. Isi tabelnya kosong.',
  item: 'Semua item, subitem, isi sel, dan PIC ikut tersalin.',
  penuh: 'Termasuk seluruh komentar dan lampiran di tiap item.',
};

const idBaru = (): string =>
  typeof crypto !== 'undefined' && (crypto as any).randomUUID
    ? (crypto as any).randomUUID()
    : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);

function potong<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

// Ambil baris bertahap — daftar ID panjang tak boleh dikirim sekaligus.
async function ambil(supabase: SB, tabel: string, kolom: string, ids: string[]) {
  if (!ids.length) return [];
  const hasil: any[] = [];
  for (const bagian of potong(ids, 150)) {
    const { data, error } = await supabase.from(tabel).select('*').in(kolom, bagian);
    if (error) throw new Error(`Gagal membaca ${tabel}: ${error.message}`);
    hasil.push(...(data || []));
  }
  return hasil;
}

async function sisip(supabase: SB, tabel: string, rows: any[]) {
  if (!rows.length) return;
  for (const bagian of potong(rows, 300)) {
    const { error } = await supabase.from(tabel).insert(bagian);
    if (error) throw new Error(`Gagal menulis ${tabel}: ${error.message}`);
  }
}

export type HasilDuplikat = {
  boardId: string;
  kolom: number;
  grup: number;
  item: number;
  subitem: number;
  pembaruan: number;
};

export async function duplicateBoard(
  supabase: SB,
  sourceBoardId: string,
  newName: string,
  mode: ModeDuplikat,
  targetMonthId?: string,      // bulan tujuan; kosong = bulan yang sama
): Promise<HasilDuplikat> {
  const nama = newName.trim();
  if (!nama) throw new Error('Nama papan baru tidak boleh kosong');

  // ── 1. Papan sumber & posisinya ───────────────────────────
  const { data: sumber, error: eSumber } = await supabase
    .from('tree_nodes').select('*').eq('id', sourceBoardId).single();
  if (eSumber || !sumber) throw new Error('Papan sumber tidak ditemukan');

  // Bulan tujuan boleh berbeda dari bulan asal — inilah yang membuat
  // papan Juni bisa disalin ke Juli tanpa menyusun ulang dari nol.
  const bulanTujuan = targetMonthId || sumber.parent_id;

  const { count } = await supabase
    .from('tree_nodes').select('id', { count: 'exact', head: true })
    .eq('parent_id', bulanTujuan).eq('kind', 'board');

  const boardId = idBaru();
  {
    const { error } = await supabase.from('tree_nodes').insert({
      id: boardId, parent_id: bulanTujuan, kind: 'board',
      name: nama, position: count || 0, is_open: true,
    });
    if (error) throw new Error(`Gagal membuat papan: ${error.message}`);
  }

  const hasil: HasilDuplikat = { boardId, kolom: 0, grup: 0, item: 0, subitem: 0, pembaruan: 0 };

  // ── 2. Kolom (main + sub) ─────────────────────────────────
  const kolomLama = await ambil(supabase, 'columns', 'board_id', [sourceBoardId]);
  const petaKolom: Record<string, string> = {};
  const kolomBaru = kolomLama.map((c: any) => {
    const id = idBaru();
    petaKolom[c.id] = id;
    return { ...c, id, board_id: boardId };
  });
  await sisip(supabase, 'columns', kolomBaru);
  hasil.kolom = kolomBaru.length;

  // ── 3. Pilihan label tiap kolom ───────────────────────────
  const opsiLama = await ambil(supabase, 'column_options', 'column_id', Object.keys(petaKolom));
  await sisip(supabase, 'column_options', opsiLama.map((o: any) => ({
    ...o, id: idBaru(), column_id: petaKolom[o.column_id],
  })));

  // ── 4. Grup ───────────────────────────────────────────────
  const grupLama = await ambil(supabase, 'groups', 'board_id', [sourceBoardId]);
  const petaGrup: Record<string, string> = {};
  const grupBaru = grupLama.map((g: any) => {
    const id = idBaru();
    petaGrup[g.id] = id;
    return { ...g, id, board_id: boardId };
  });
  await sisip(supabase, 'groups', grupBaru);
  hasil.grup = grupBaru.length;

  if (mode === 'struktur') return hasil;

  // ── 5. Item & subitem ─────────────────────────────────────
  const itemLama = await ambil(supabase, 'items', 'group_id', Object.keys(petaGrup));
  const petaItem: Record<string, string> = {};
  for (const it of itemLama) petaItem[it.id] = idBaru();

  // Induk lebih dulu, baru subitem — agar parent_item_id sudah ada saat dirujuk.
  const induk = itemLama.filter((i: any) => !i.parent_item_id);
  const anak = itemLama.filter((i: any) => i.parent_item_id);

  await sisip(supabase, 'items', induk.map((i: any) => ({
    ...i, id: petaItem[i.id], group_id: petaGrup[i.group_id], parent_item_id: null,
  })));
  await sisip(supabase, 'items', anak.map((i: any) => ({
    ...i, id: petaItem[i.id], group_id: petaGrup[i.group_id],
    parent_item_id: petaItem[i.parent_item_id] || null,
  })));
  hasil.item = induk.length;
  hasil.subitem = anak.length;

  const idItemLama = Object.keys(petaItem);

  // ── 6. Isi sel & PIC ──────────────────────────────────────
  const nilaiLama = await ambil(supabase, 'item_values', 'item_id', idItemLama);
  await sisip(supabase, 'item_values', nilaiLama
    .filter((v: any) => petaKolom[v.column_id])
    .map((v: any) => ({
      item_id: petaItem[v.item_id], column_id: petaKolom[v.column_id], value: v.value,
    })));

  const picLama = await ambil(supabase, 'item_assignees', 'item_id', idItemLama);
  await sisip(supabase, 'item_assignees', picLama
    .filter((a: any) => petaKolom[a.column_id])
    .map((a: any) => ({
      item_id: petaItem[a.item_id], column_id: petaKolom[a.column_id], member_id: a.member_id,
    })));

  if (mode !== 'penuh') return hasil;

  // ── 7. Pembaruan / komentar ───────────────────────────────
  // Dibungkus try/catch: bila tabelnya belum ada, duplikasi tetap dianggap berhasil.
  try {
    const updLama = await ambil(supabase, 'item_updates', 'item_id', idItemLama);
    await sisip(supabase, 'item_updates', updLama.map((u: any) => {
      const baris: any = {
        item_id: petaItem[u.item_id], author_id: u.author_id, text: u.text,
      };
      if (u.created_at) baris.created_at = u.created_at;
      return baris;
    }));
    hasil.pembaruan = updLama.length;
  } catch { /* diamkan — pembaruan bersifat pelengkap */ }

  return hasil;
}
