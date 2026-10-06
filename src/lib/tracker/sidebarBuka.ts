// Ingat tahun / bulan / papan mana yang terbuka di sidebar Daily Task.
//
// Disimpan PER PERANGKAT (localStorage), bukan di database: membuka/menutup
// folder adalah preferensi tampilan pribadi — menulisnya ke tree_nodes akan
// mengubah sidebar rekan dan memicu muat ulang papan mereka lewat realtime.
// Nilai is_open dari database tetap dipakai sebagai bawaan untuk folder yang
// belum pernah dibuka/ditutup di perangkat ini.

const KUNCI = 'dwt_sidebar_buka';
const MAKS = 400;   // batas entri agar tidak membengkak

export function bacaBuka(): Record<string, boolean> {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function simpanBuka(id: string, buka: boolean) {
  if (!id) return;
  try {
    const m = bacaBuka();
    delete m[id];
    m[id] = !!buka;
    const kunci = Object.keys(m);
    if (kunci.length > MAKS) for (const k of kunci.slice(0, kunci.length - MAKS)) delete m[k];
    localStorage.setItem(KUNCI, JSON.stringify(m));
  } catch { /* penyimpanan diblokir → abaikan */ }
}

/**
 * Terapkan status buka/tutup ke pohon hasil muat:
 *  1. folder yang sudah ada di layar memakai statusnya di layar (`sebelum`),
 *  2. selain itu pilihan tersimpan di perangkat ini (`simpanan`),
 *  3. selain itu nilai dari database.
 */
export function terapkanBuka(ws: any[], simpanan: Record<string, boolean>, sebelum?: any[]): any[] {
  const lama = new Map<string, boolean>();
  const catat = (bs: any[]) => (bs || []).forEach((b: any) => { lama.set(b.id, !!b.isOpen); catat(b.boards); });
  for (const w of sebelum || []) for (const y of w.years || []) {
    lama.set(y.id, !!y.isOpen);
    for (const m of y.months || []) { lama.set(m.id, !!m.isOpen); catat(m.boards); }
  }
  const nilai = (id: string, dariDb: boolean) => (lama.has(id) ? !!lama.get(id) : (id in (simpanan || {}) ? !!simpanan[id] : dariDb));
  const papan = (bs: any[]): any[] => (bs || []).map((b: any) => ({ ...b, isOpen: nilai(b.id, !!b.isOpen), boards: papan(b.boards) }));
  return (ws || []).map((w: any) => ({
    ...w,
    years: (w.years || []).map((y: any) => ({
      ...y,
      isOpen: nilai(y.id, !!y.isOpen),
      months: (y.months || []).map((m: any) => ({ ...m, isOpen: nilai(m.id, !!m.isOpen), boards: papan(m.boards) })),
    })),
  }));
}
