// View papan Daily Task (Main Table, Kanban, Timeline, …) beserta kolom yang
// disembunyikan, disimpan di tabel `board_views` supaya tidak hilang saat
// halaman dimuat ulang dan terlihat sama oleh seluruh tim.
//
// Bila tabelnya belum dibuat (SQL board-views.sql belum dijalankan), semua
// fungsi di sini gagal dengan tenang dan aplikasi kembali ke perilaku lama
// (view hanya hidup di memori tab).
type SB = any;

export const TABEL_VIEWS = 'board_views';

const KOLOM = 'board_id, id, name, type, position, config';

/** Galat karena tabel board_views belum ada di database. */
export function tabelViewsBelumAda(err: any): boolean {
  const kode = String(err?.code || '');
  const pesan = String(err?.message || err || '');
  if (kode === '42P01' || kode === 'PGRST205') return true;
  return /board_views/i.test(pesan) && /(does not exist|schema cache|could not find)/i.test(pesan);
}

/** Baris database → objek view di memori. */
export function barisKeView(r: any) {
  const cfg = r?.config && typeof r.config === 'object' && !Array.isArray(r.config) ? r.config : {};
  return { id: String(r.id), type: r.type || 'table', name: r.name || 'View', config: cfg };
}

const angka = (x: any) => (typeof x === 'number' && isFinite(x) ? x : 0);

/** Kelompokkan baris per papan, urut posisi (lalu id agar stabil). */
export function kelompokkanViews(rows: any[]): Record<string, any[]> {
  const per: Record<string, any[]> = {};
  for (const r of rows || []) {
    if (!r || r.board_id == null || r.id == null) continue;
    (per[String(r.board_id)] = per[String(r.board_id)] || []).push(r);
  }
  const out: Record<string, any[]> = {};
  for (const bid of Object.keys(per)) {
    out[bid] = per[bid]
      .slice()
      .sort((a, b) => angka(a.position) - angka(b.position) || String(a.id).localeCompare(String(b.id)))
      .map(barisKeView);
  }
  return out;
}

export type HasilMuatViews =
  | { status: 'ada'; peta: Record<string, any[]> }   // terbaca
  | { status: 'belum' }                              // tabel belum dibuat → perilaku lama
  | { status: 'galat' };                             // gangguan sesaat → jangan ubah apa pun

/**
 * Semua view semua papan. Tidak pernah melempar galat: 'belum' = tabel belum
 * ada (aplikasi memakai perilaku lama), 'galat' = gangguan sesaat (view di
 * layar dipertahankan, status penyimpanan tidak diubah).
 */
export async function muatViews(supabase: SB): Promise<HasilMuatViews> {
  try {
    const semua: any[] = [];
    for (let dari = 0, put = 0; put < 50; put++, dari += 1000) {
      const { data, error } = await supabase
        .from(TABEL_VIEWS).select(KOLOM)
        .order('board_id', { ascending: true }).order('id', { ascending: true })
        .range(dari, dari + 999);
      if (error) return tabelViewsBelumAda(error) ? { status: 'belum' } : { status: 'galat' };
      semua.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    return { status: 'ada', peta: kelompokkanViews(semua) };
  } catch {
    return { status: 'galat' };
  }
}

const keBaris = (boardId: string, v: any, position: number) => ({
  board_id: boardId,
  id: String(v.id),
  name: String(v.name || 'View').slice(0, 200),
  type: String(v.type || 'table'),
  position,
  config: v.config && typeof v.config === 'object' ? v.config : {},
});

/** Simpan (sisip/perbarui) view tertentu. `daftar` = urutan lengkap papan itu. */
export async function dbSimpanViews(supabase: SB, boardId: string, daftar: any[], hanyaId?: string[]) {
  const pilih = hanyaId ? new Set(hanyaId) : null;
  const rows = (daftar || [])
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => !pilih || pilih.has(v.id))
    .map(({ v, i }) => keBaris(boardId, v, i));
  if (!rows.length) return;
  const { error } = await supabase.from(TABEL_VIEWS).upsert(rows, { onConflict: 'board_id,id' });
  if (error) throw new Error(error.message);
}

/**
 * Ubah sebagian isi SATU view (mis. hanya nama, atau hanya config) — kolom lain
 * tidak ditimpa, jadi perubahan rekan pada view yang sama tidak hilang.
 * Bila barisnya belum ada di database, disisipkan utuh dari `cadangan`.
 */
export async function dbUbahView(supabase: SB, boardId: string, viewId: string, patch: Record<string, any>, cadangan: { view: any; position: number }) {
  const { data, error } = await supabase.from(TABEL_VIEWS).update(patch).eq('board_id', boardId).eq('id', viewId).select('id');
  if (error) throw new Error(error.message);
  if (Array.isArray(data) && data.length === 0) {
    const up = await supabase.from(TABEL_VIEWS).upsert(keBaris(boardId, cadangan.view, cadangan.position), { onConflict: 'board_id,id' });
    if (up.error) throw new Error(up.error.message);
  }
}

/** Hapus satu view. */
export async function dbHapusView(supabase: SB, boardId: string, viewId: string) {
  const { error } = await supabase.from(TABEL_VIEWS).delete().eq('board_id', boardId).eq('id', viewId);
  if (error) throw new Error(error.message);
}

/** Simpan urutan view (hanya kolom posisi; nama/isi view lain tidak disentuh). */
export async function dbUrutViews(supabase: SB, boardId: string, ids: string[]) {
  for (let i = 0; i < ids.length; i++) {
    const { error } = await supabase.from(TABEL_VIEWS).update({ position: i }).eq('board_id', boardId).eq('id', ids[i]);
    if (error) throw new Error(error.message);
  }
}

/**
 * Pasang view dari database ke peta papan (dipakai saat realtime board_views).
 * Papan yang view-nya sedang disimpan dari tab ini (`sibuk`) dilewati supaya
 * perubahan yang belum sampai ke server tidak tertimpa.
 */
export function pasangViewsDb(peta: Record<string, any>, dariDb: Record<string, any[]>, sibuk?: Set<string>): Record<string, any> {
  let berubah = false;
  const out: Record<string, any> = {};
  for (const bid of Object.keys(peta || {})) {
    const bd = peta[bid];
    const v = dariDb[bid];
    if (!bd || !v || !v.length || (sibuk && sibuk.has(bid)) || JSON.stringify(v) === JSON.stringify(bd.views || [])) {
      out[bid] = bd;
      continue;
    }
    out[bid] = { ...bd, views: v, viewsDariDb: true };
    berubah = true;
  }
  return berubah ? out : peta;
}

/**
 * Salin view papan sumber ke papan hasil duplikat (kolom tersembunyi dipetakan
 * ke id kolom baru). Gagal (mis. tabel belum ada) → diam; duplikat tetap sah.
 */
export async function salinViewsPapan(supabase: SB, dariBoard: string, keBoard: string, petaKolom: Record<string, string>) {
  try {
    const { data, error } = await supabase.from(TABEL_VIEWS).select(KOLOM).eq('board_id', dariBoard).order('id', { ascending: true });
    if (error || !data || !data.length) return;
    const rows = data.map((r: any) => {
      const cfg = r.config && typeof r.config === 'object' && !Array.isArray(r.config) ? { ...r.config } : {};
      if (Array.isArray(cfg.hiddenColumns)) cfg.hiddenColumns = cfg.hiddenColumns.map((c: string) => petaKolom[c]).filter(Boolean);
      return { board_id: keBoard, id: r.id, name: r.name, type: r.type, position: angka(r.position), config: cfg };
    });
    await supabase.from(TABEL_VIEWS).insert(rows);
  } catch { /* diamkan — view bersifat pelengkap */ }
}
