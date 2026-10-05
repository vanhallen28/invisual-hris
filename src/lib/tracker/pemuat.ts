// Pengendali muat sel Daily Task (lazy-load).
//
// Kerangka papan (struktur) dimuat sekali oleh DashboardContext. Modul ini
// mengurus NILAI SEL yang dimuat seperlunya:
//   • muatSelBoard     → isi satu papan saat dibuka
//   • muatSelSaya      → tugas yang di-assign ke saya (My Tasks)
//   • muatKolomLintas  → kolom tertentu di semua papan (badge & Antrean ACC)
//   • pastikanItem     → item tertentu (mis. kartu tugas di chat)
//   • sesudahStruktur  → item baru / item pindah setelah kerangka disegarkan
//   • tambalTim        → penugasan item+kolom tertentu (realtime), di-batch
//
// Murni TypeScript tanpa React — state React disentuh hanya lewat `dep`.
// Semua fungsi muat TIDAK PERNAH melempar galat (dicatat di galat()).
import {
  loadSelItem, loadKolom, loadIdItemSaya, loadTimItem,
  terapkanSel, terapkanKolom, terapkanTim,
  idItemBoard, semuaIdItem, kolomPertamaPerTipe, idItemBertim,
  type Lindung,
} from './load';

export type DepPemuat = {
  supabase: any;
  /** Peta papan terakhir yang sudah tergambar. */
  ambilPeta: () => Record<string, any>;
  /** setBoardsDataMap(updater). */
  ubahPeta: (fn: (p: Record<string, any>) => Record<string, any>) => void;
  /** Dipanggil saat status muat berubah (memicu render ulang). */
  saatBerubah: () => void;
  lapor?: (pesan: string) => void;
  sekarang?: () => number;
  jedaTim?: number;
  jedaItem?: number;
};

export type TandaPemuat = { tampil: string[]; saya: boolean; tipe: string[] };
export type StatusPemuat = TandaPemuat & { galat: Record<string, string> };

export type Pemuat = ReturnType<typeof buatPemuat>;

/** Edit/tambalan sel sejak (mulai − 60 dtk) dilindungi dari hasil fetch yang lebih lama. */
const LINDUNG_MS = 60_000;
/** Edit LOKAL sel tim < 3 dtk tidak ditimpa tambalTim (gema tulisan sendiri). */
const TIM_LOKAL_MS = 3_000;
const PEMISAH = '\u0001';
const SENYAP = new Set(['lintas:status', 'tim']);

export function buatPemuat(dep: DepPemuat) {
  const sekarang = dep.sekarang || (() => Date.now());
  const jedaTim = dep.jedaTim ?? 400;
  const jedaItem = dep.jedaItem ?? 60;

  let gen = 0;                                   // naik saat reset → hasil fetch lama dibuang
  const items = new Set<string>();               // item yang selnya sudah dimuat PENUH (segar)
  const boards = new Set<string>();              // papan yang selnya sudah dimuat (segar)
  const tampil = new Set<string>();              // papan yang boleh ditampilkan (segar / cache)
  const kolom = new Set<string>();               // kolom lintas papan yang sudah dimuat (segar)
  const tipeLintas = new Set<string>();          // tipe kolom lintas yang pernah diminta
  const tipeTampil = new Set<string>();          // tipe lintas yang boleh ditampilkan (segar / cache)
  let sayaMinta = false;
  let sayaTampil = false;
  const proses = new Map<string, Promise<void>>();
  const galatPeta = new Map<string, string>();
  const edit = new Map<string, { t: number; lokal: boolean }>();
  let antrianTim = new Map<string, Set<string>>();
  let timerTim: any = null;
  let antrianItem = new Set<string>();
  const dicobaItem = new Set<string>();
  let timerItem: any = null;
  let tungguItem: (() => void)[] = [];

  /** Jalankan sekali per kunci; panggilan bersamaan berbagi janji yang sama. */
  const satuKali = (kunci: string, fn: () => Promise<void>): Promise<void> => {
    const ada = proses.get(kunci);
    if (ada) return ada;
    const g = gen;
    const jalan = async () => {
      try {
        if (galatPeta.delete(kunci)) dep.saatBerubah();
        await fn();
      } catch (e: any) {
        if (g !== gen) return;
        const pesan = e?.message || String(e);
        galatPeta.set(kunci, pesan);
        // Muat latar (badge, penugasan cadangan) gagal → diam saja, tanpa toast.
        if (!SENYAP.has(kunci)) dep.lapor?.('Gagal memuat data: ' + pesan);
        dep.saatBerubah();
      }
    };
    const p: Promise<void> = jalan().finally(() => { if (proses.get(kunci) === p) proses.delete(kunci); });
    proses.set(kunci, p);
    return p;
  };

  const kumpulkanLindung = (saring: (v: { t: number; lokal: boolean }) => boolean): Lindung => {
    const m: Lindung = new Map();
    for (const [k, v] of edit) {
      if (!saring(v)) continue;
      const [i, c] = k.split(PEMISAH);
      let s = m.get(i);
      if (!s) { s = new Set(); m.set(i, s); }
      s.add(c);
    }
    return m;
  };
  const lindungiSejak = (mulai: number) => kumpulkanLindung((v) => v.t >= mulai - LINDUNG_MS);
  const lindungiLokal = () => { const t = sekarang(); return kumpulkanLindung((v) => v.lokal && v.t >= t - TIM_LOKAL_MS); };

  /** Catat bahwa sel ini baru saja berubah di memori (edit sendiri / tambalan realtime). */
  const tandaiEdit = (itemId: string, colId: string, lokal: boolean = true) => {
    if (!itemId || !colId) return;
    const t = sekarang();
    const k = itemId + PEMISAH + colId;
    const lama = edit.get(k);
    // Gema realtime dari edit LOKAL yang baru saja terjadi tetap dihitung lokal.
    const tetapLokal = lokal || (!!lama && lama.lokal && t - lama.t < TIM_LOKAL_MS);
    edit.set(k, { t, lokal: tetapLokal });
    if (edit.size > 5000) { for (const [k, v] of edit) if (v.t < t - LINDUNG_MS) edit.delete(k); }
  };

  const terapkanPenuh = (r: { values: any[]; assignees: any[] }, diminta: string[], ada: Set<string>, mulai: number) => {
    const set = new Set(diminta);
    const l = lindungiSejak(mulai);
    dep.ubahPeta((p) => terapkanSel(p, r.values, r.assignees, set, l));
    for (const id of diminta) if (ada.has(id)) items.add(id);
  };

  const muatSelBoard = (boardId: string, opsi: { paksa?: boolean } = {}): Promise<void> => {
    if (!boardId) return Promise.resolve();
    if (!opsi.paksa && boards.has(boardId)) return Promise.resolve();
    return satuKali('b:' + boardId + (opsi.paksa ? ':p' : ''), async () => {
      const g = gen;
      const bd = dep.ambilPeta()[boardId];
      if (!bd) return;
      const semua = idItemBoard(bd);
      const perlu = opsi.paksa ? semua : semua.filter((id) => !items.has(id));
      const mulai = sekarang();
      if (perlu.length) {
        const r = await loadSelItem(dep.supabase, perlu);
        if (g !== gen) return;
        terapkanPenuh(r, perlu, new Set(semua), mulai);
      }
      boards.add(boardId);
      tampil.add(boardId);
      dep.saatBerubah();
    });
  };

  const muatSelSaya = (uid: string, opsi: { paksa?: boolean } = {}): Promise<void> => {
    if (!uid) return Promise.resolve();
    sayaMinta = true;
    return satuKali('saya' + (opsi.paksa ? ':p' : ''), async () => {
      const g = gen;
      const mulai = sekarang();
      const idsServer = await loadIdItemSaya(dep.supabase, uid);
      if (g !== gen) return;
      const peta = dep.ambilPeta();
      // Item yang di memori masih tampak berisi saya ikut disegarkan, supaya
      // penugasan yang sudah dilepas tidak tertinggal di My Tasks.
      const gabung = Array.from(new Set([...idsServer, ...idItemBertim(peta, uid)]));
      const perlu = opsi.paksa ? gabung : gabung.filter((id) => !items.has(id));
      if (perlu.length) {
        const r = await loadSelItem(dep.supabase, perlu);
        if (g !== gen) return;
        terapkanPenuh(r, perlu, semuaIdItem(dep.ambilPeta()), mulai);
      }
      sayaTampil = true;
      dep.saatBerubah();
    });
  };

  const muatKolomLintas = (tipe: string[], petaPakai?: Record<string, any>): Promise<void> => {
    const t = Array.from(new Set(tipe || [])).sort();
    if (!t.length) return Promise.resolve();
    t.forEach((x) => tipeLintas.add(x));
    return satuKali('lintas:' + t.join(','), async () => {
      const g = gen;
      const mulai = sekarang();
      const peta = petaPakai || dep.ambilPeta();
      const { nilai, tim } = kolomPertamaPerTipe(peta, t);
      const nPerlu = nilai.filter((c) => !kolom.has(c));
      const tPerlu = tim.filter((c) => !kolom.has(c));
      if (nPerlu.length || tPerlu.length) {
        const r = await loadKolom(dep.supabase, nPerlu, tPerlu);
        if (g !== gen) return;
        const ks = new Set([...nPerlu, ...tPerlu]);
        const lewati = new Set(items);           // item penuh sudah segar & dijaga realtime
        const l = lindungiSejak(mulai);
        dep.ubahPeta((p) => terapkanKolom(p, r.values, r.assignees, ks, lewati, l));
        ks.forEach((c) => kolom.add(c));
      }
      t.forEach((x) => tipeTampil.add(x));
      dep.saatBerubah();
    });
  };

  /** Muat item tertentu (di-batch singkat agar banyak pemanggil = 1 kueri). */
  const pastikanItem = (ids: string[]): Promise<void> => {
    // `dicobaItem`: id yang sudah pernah diminta (mis. tugas yang tak boleh dilihat)
    // tidak diminta ulang setiap kali kartunya digambar.
    const baru = (ids || []).filter((id) => id && !items.has(id) && !dicobaItem.has(id));
    if (!baru.length) return Promise.resolve();
    baru.forEach((id) => { antrianItem.add(id); dicobaItem.add(id); });
    return new Promise<void>((res) => {
      tungguItem.push(res);
      if (timerItem) return;
      timerItem = setTimeout(() => {
        timerItem = null;
        const ambil = [...antrianItem];
        antrianItem = new Set();
        const pen = tungguItem;
        tungguItem = [];
        const g = gen;
        const mulai = sekarang();
        (async () => {
          try {
            const perlu = ambil.filter((id) => !items.has(id));
            if (perlu.length) {
              const r = await loadSelItem(dep.supabase, perlu);
              if (g !== gen) return;
              terapkanPenuh(r, perlu, semuaIdItem(dep.ambilPeta()), mulai);
              dep.saatBerubah();
            }
          } catch {
            // kartu tetap tampil tanpa sel; boleh dicoba lagi nanti
            ambil.forEach((id) => dicobaItem.delete(id));
          }
          finally { pen.forEach((f) => f()); }
        })();
      }, jedaItem);
    });
  };

  const pastikanBoards = (ids: string[]): Promise<void> =>
    Promise.all((ids || []).map((id) => muatSelBoard(id))).then(() => undefined);

  /**
   * Setelah kerangka disegarkan: muat sel item BARU (belum ada di peta lama)
   * dan item di papan yang sudah termuat tetapi belum punya sel (mis. pindahan).
   */
  const sesudahStruktur = async (petaBaru: Record<string, any>, lamaIds: Set<string>): Promise<void> => {
    const g = gen;
    const mulai = sekarang();
    const perlu: string[] = [];
    // Hanya item di papan yang SUDAH termuat yang ditandai "penuh". Item baru di
    // papan yang belum dibuka tetap diisi, tapi akan dimuat ulang saat papannya dibuka.
    const adaTermuat = new Set<string>();
    const adaLama = lamaIds && lamaIds.size > 0;   // peta lama kosong → jangan anggap semuanya baru
    for (const bid of Object.keys(petaBaru || {})) {
      const termuat = boards.has(bid);
      for (const id of idItemBoard(petaBaru[bid])) {
        if (termuat) adaTermuat.add(id);
        if ((adaLama && !lamaIds.has(id)) || (termuat && !items.has(id))) perlu.push(id);
      }
    }
    try {
      if (perlu.length) {
        const r = await loadSelItem(dep.supabase, perlu);
        if (g !== gen) return;
        terapkanPenuh(r, perlu, adaTermuat, mulai);
      }
      if (tipeLintas.size) await muatKolomLintas([...tipeLintas], petaBaru);
      dep.saatBerubah();
    } catch { /* diam: realtime & muat berikutnya akan membenahi */ }
  };

  /** Tambal penugasan item+kolom dari server (realtime item_assignees), di-batch. */
  const tambalTim = (itemId: string, colId: string) => {
    if (!itemId || !colId) return;
    // Perubahan dari realtime → lindungi dari hasil muat papan yang lebih lama.
    tandaiEdit(itemId, colId, false);
    let s = antrianTim.get(itemId);
    if (!s) { s = new Set(); antrianTim.set(itemId, s); }
    s.add(colId);
    if (timerTim) return;
    timerTim = setTimeout(async () => {
      timerTim = null;
      const batch = antrianTim;
      antrianTim = new Map();
      const g = gen;
      try {
        const rows = await loadTimItem(dep.supabase, [...batch.keys()]);
        if (g !== gen) return;
        const l = lindungiLokal();
        dep.ubahPeta((p) => terapkanTim(p, batch, rows, l));
      } catch { /* diam */ }
    }, jedaTim);
  };

  /**
   * Penugasan (kolom tim) disegarkan dari server untuk item papan aktif yang
   * sudah termuat + item yang tampak berisi saya. Dipakai bila event realtime
   * tidak membawa item_id. Hanya membaca item_assignees → ringan.
   */
  const segarkanTim = (boardId: string | null, uid: string): Promise<void> => satuKali('tim', async () => {
    const g = gen;
    const mulai = sekarang();
    const peta = dep.ambilPeta();
    const ids = new Set<string>();
    if (boardId && boards.has(boardId) && peta[boardId]) idItemBoard(peta[boardId]).forEach((id) => ids.add(id));
    if (uid) idItemBertim(peta, uid).forEach((id) => ids.add(id));
    if (!ids.size) return;
    const rows = await loadTimItem(dep.supabase, [...ids]);
    if (g !== gen) return;
    const antrian = new Map<string, Set<string>>();
    for (const bid of Object.keys(peta)) {
      const bd = peta[bid];
      const timU = (bd?.columns || []).filter((c: any) => c.type === 'team').map((c: any) => c.id);
      const timS = (bd?.subColumns || []).filter((c: any) => c.type === 'team').map((c: any) => c.id);
      for (const gr of (bd?.groups || [])) for (const it of (gr.items || [])) {
        if (ids.has(it.id) && timU.length) antrian.set(it.id, new Set(timU));
        for (const s of (it.subItems || [])) if (ids.has(s.id) && timS.length) antrian.set(s.id, new Set(timS));
      }
    }
    const t = sekarang();
    const l = kumpulkanLindung((v) => v.t >= mulai || (v.lokal && v.t >= t - TIM_LOKAL_MS));
    dep.ubahPeta((p) => terapkanTim(p, antrian, rows, l));
  });

  /** Anggap sel di memori basi (mis. realtime sempat terputus); tanda TAMPIL tetap. */
  const tandaiBasi = () => { items.clear(); boards.clear(); kolom.clear(); dicobaItem.clear(); };

  /** Tandai basi lalu muat ulang yang sedang dipakai: papan aktif, tugas saya, kolom lintas. */
  const segarkanSemua = async (boardId: string | null, uid: string): Promise<void> => {
    tandaiBasi();
    const tugas: Promise<void>[] = [];
    if (boardId && tampil.has(boardId)) tugas.push(muatSelBoard(boardId));
    if (uid && sayaMinta) tugas.push(muatSelSaya(uid));
    if (tipeLintas.size) tugas.push(muatKolomLintas([...tipeLintas]));
    await Promise.all(tugas);
  };

  const tandaiPapanSiap = (boardId: string) => {
    if (!boardId) return;
    boards.add(boardId);
    tampil.add(boardId);
    dep.saatBerubah();
  };

  const papanSiap = (boardId: string) => tampil.has(boardId) || !dep.ambilPeta()[boardId];
  const sayaSiap = () => sayaTampil;
  const sayaDiminta = () => sayaMinta;
  const lintasSiap = (tipe: string[]) => (tipe || []).every((t) => tipeTampil.has(t));
  const galat = (kunci: string) => galatPeta.get(kunci) || null;

  const snapshot = (): TandaPemuat => ({ tampil: [...tampil], saya: sayaTampil, tipe: [...tipeTampil] });
  /** Salinan status sebagai DATA biasa (untuk disimpan di state React). */
  const status = (): StatusPemuat => ({ ...snapshot(), galat: Object.fromEntries(galatPeta) });
  /** Pulihkan tanda TAMPIL dari cache (sel cache tetap dimuat ulang di latar). */
  const pulihkan = (t: TandaPemuat | null | undefined) => {
    if (!t) return;
    (t.tampil || []).forEach((id) => tampil.add(id));
    if (t.saya) sayaTampil = true;
    (t.tipe || []).forEach((x) => tipeTampil.add(x));
  };

  const reset = () => {
    gen++;
    items.clear(); boards.clear(); tampil.clear(); kolom.clear();
    tipeLintas.clear(); tipeTampil.clear();
    sayaMinta = false; sayaTampil = false;
    proses.clear(); galatPeta.clear(); edit.clear();
    if (timerTim) { clearTimeout(timerTim); timerTim = null; }
    antrianTim = new Map();
    if (timerItem) { clearTimeout(timerItem); timerItem = null; }
    antrianItem = new Set();
    dicobaItem.clear();
    const pen = tungguItem; tungguItem = [];
    pen.forEach((f) => f());
  };

  return {
    muatSelBoard, muatSelSaya, muatKolomLintas, pastikanItem, pastikanBoards,
    sesudahStruktur, tandaiEdit, tambalTim, segarkanTim, tandaiBasi, segarkanSemua, tandaiPapanSiap,
    papanSiap, sayaSiap, sayaDiminta, lintasSiap, galat,
    snapshot, status, pulihkan, reset,
  };
}

/** Status kosong awal (sebelum apa pun dimuat). */
export const STATUS_KOSONG: StatusPemuat = { tampil: [], saya: false, tipe: [], galat: {} };
