'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { supabase as hrisSupabase } from '@/lib/supabase';
import { loadStrukturState, ambilNilaiKolom, semuaIdItem, pertahankanSel } from '@/lib/tracker/load';
import { buatPemuat, STATUS_KOSONG, type Pemuat, type TandaPemuat, type StatusPemuat } from '@/lib/tracker/pemuat';
import MemberView from '@/components/tracker/MemberView';
import DocEditor from '@/components/tracker/DocEditor';
import NotificationCenter from '@/components/tracker/NotificationCenter';
import LoadingLogo from '@/components/LoadingLogo';
import { dbUpdateItemName, dbSetItemMeta, dbSetCellValue, newId, dbAddItem, dbAddSubItem, dbDeleteItem, dbAddColumn, dbDeleteColumn, dbAddLabel, dbDeleteLabel, dbUpdateLabelColor, dbAddGroup, dbUpdateGroup, dbDeleteGroup, dbAddTreeNode, dbRenameTreeNode, dbDeleteTreeNode, dbUpdateColumnLabel, dbReindexColumns, dbReindexGroups, dbReindexItems, dbMoveItemsGroup, dbSetAccountTarget, dbHapusAccountTarget, dbMoveGroup } from '@/lib/tracker/sync';
import { muatViews, dbSimpanViews, dbUbahView, dbHapusView, dbUrutViews, pasangViewsDb, TABEL_VIEWS } from '@/lib/tracker/views';
import { sudahTercermin } from '@/lib/tracker/gema';
import { bacaBuka, simpanBuka, terapkanBuka } from '@/lib/tracker/sidebarBuka';

const LABEL_COLORS = ['bg-[#e2445c]', 'bg-primer-terang', 'bg-[#fdab3d]', 'bg-[#00c875]', 'bg-[#a25ddc]', 'bg-[#ff5ac4]', 'bg-[#9d99ff]', 'bg-emerald-500', 'bg-rose-400'];
const HEX_COLORS = ['#e2445c', '#579bfc', '#fdab3d', '#00c875', '#a25ddc', '#ff5ac4', '#9d99ff'];

// ── Cache state tracker (di MEMORI tab, BUKAN localStorage) ──────────────────
// Tujuan: buka-tutup Daily/Chat tampil instan tanpa menunggu muat ulang.
// AMAN: dikunci per-ID pengguna (akun beda takkan memakai cache akun lain) &
// dibersihkan saat logout. Hilang otomatis saat tab di-reload/tutup. HANYA
// membaca (tak ada tulisan DB / SQL). Isinya = state terakhir di layar (diperbarui
// otomatis); saat dipakai, data tetap disegarkan diam-diam di latar.
let _cacheTrackerState: { uid: string; state: any; tanda?: TandaPemuat } | null = null;
function bersihkanCacheTracker() { _cacheTrackerState = null; }

// Set view default tiap board (Table, Kanban, Gantt, Chart) — sama seperti tab lama.
// Id-nya TETAP (bukan cap waktu) supaya semua perangkat menghasilkan id yang sama:
// saat view papan pertama kali disimpan ke database (tabel board_views), dua
// orang yang menyimpan bersamaan tidak membuat "Main Table" ganda.
export const makeDefaultViews = (seedHidden: string[] = []) => [
  { id: 'view-tbl-awal', type: 'table', name: 'Main Table', config: { hiddenColumns: [...seedHidden] } },
  { id: 'view-kan-awal', type: 'kanban', name: 'Kanban', config: {} },
  { id: 'view-gan-awal', type: 'gantt', name: 'Timeline', config: {} },
  { id: 'view-cht-awal', type: 'chart', name: 'Overview', config: {} },
];
// Migrasi non-destruktif: board lama tanpa "views" diberi set default; data lain tak disentuh
const ensureViews = (map: any, seedHidden: string[] = []) => {
  const out: any = {};
  Object.entries(map || {}).forEach(([bid, bd]: any) => {
    out[bid] = (bd && bd.views && bd.views.length > 0) ? bd : { ...bd, views: makeDefaultViews(seedHidden) };
  });
  return out;
};

// Opsi A: gabungkan avatar dari tabel employees ke daftar members (tracker).
// Cocokkan members.id = employees.user_id (keduanya = auth uid), fallback via email.
async function mergeAvatars(supabase: any, members: any[]) {
  try {
    const { data } = await supabase.from('employees').select('user_id, email, avatarUrl, panggilan');
    const byUser: any = {}, byEmail: any = {};
    (data || []).forEach((e: any) => {
      const isi = { avatarUrl: e.avatarUrl || null, panggilan: e.panggilan || null };
      if (!isi.avatarUrl && !isi.panggilan) return;
      if (e.user_id) byUser[e.user_id] = isi;
      if (e.email) byEmail[String(e.email).toLowerCase()] = isi;
    });
    return members.map((m: any) => {
      const e = byUser[m.id] || byEmail[String(m.email || '').toLowerCase()] || {};
      return {
        ...m,
        avatarUrl: m.avatarUrl || e.avatarUrl || null,
        panggilan: m.panggilan || e.panggilan || null,
      };
    });
  } catch {
    return members;
  }
}

export const DashboardContext = createContext<any>(null);

export const DashboardProvider = ({ children, embedded = false }: { children: React.ReactNode; embedded?: boolean }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  // === SUPABASE: sesi & status (1d-ii) ===
  const [supabase] = useState<any>(() => hrisSupabase);
  const [authUser, setAuthUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginMsg, setLoginMsg] = useState<string | null>(null);
  const [activeViewId, setActiveViewId] = useState<string>('');
  
  const [workspaces, setWorkspaces] = useState<any[]>([
    { 
      id: 'ws-root', 
      name: 'ROOT', 
      years: [{ 
        id: 'y-2026', 
        name: '2026', 
        isOpen: true, 
        months: [{ 
          id: 'm-7', 
          name: 'JULY', 
          isOpen: true, 
          boards: [{ id: 'b-1', name: 'CLIENT' }] 
        }] 
      }] 
    }
  ]);
  
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('ws-root'); 
  const [activeBoardId, setActiveBoardId] = useState<string | null>('b-1');
  const [accountTargets, setAccountTargets] = useState<Record<string, Record<string, number>>>({}); // target per akun per board (bulan)
  // "You" exists by default so updates/assignments have a valid author from the start.
  const [currentUserId, setCurrentUserId] = useState<string>('me');
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [canContentHub, setCanContentHub] = useState<boolean>(true);
  const [canAcc, setCanAcc] = useState<boolean>(false);
  const [docEditorTarget, setDocEditorTarget] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([{ id: 'me', name: 'You', color: 'bg-primer-terang', initials: 'Y' }]);
  const [labels, setLabels] = useState<any>({});
  // true bila tabel board_views terbaca → view & kolom tersembunyi disimpan ke database.
  // false (SQL belum dijalankan / gagal baca) → perilaku lama: view hanya di memori.
  const [viewsTersedia, setViewsTersedia] = useState(false);
  // Papan yang view-nya sedang dikirim ke database dari tab ini (jumlah simpanan berjalan).
  const viewsSibukRef = useRef<Map<string, number>>(new Map());
  // Kapan view sebuah papan terakhir diubah / selesai disimpan dari tab ini.
  const viewsUbahRef = useRef<Map<string, number>>(new Map());
  // Antrean simpan view per papan (simpanan dijalankan berurutan, tak saling mendahului).
  const antreanViewsRef = useRef<Map<string, Promise<void>>>(new Map());
  // Papan yang perubahan view rekannya terlewat karena sedang disimpan → dimuat lagi sesudahnya.
  const viewsTerlewatRef = useRef<Set<string>>(new Set());
  const segarkanViewsRef = useRef<(() => void) | null>(null);
  // Papan yang view lokalnya TIDAK boleh ditimpa hasil muat yang dimulai pada `mulai`:
  // sedang disimpan, atau diubah/selesai disimpan sesudah muat itu dimulai (hasilnya
  // bisa jadi dibaca sebelum simpanan sampai ke server).
  const sibukViewsSejak = (mulai: number) => {
    const out = new Set<string>(Array.from(viewsSibukRef.current.keys()));
    viewsUbahRef.current.forEach((t, bid) => { if (t >= mulai) out.add(bid); });
    return out;
  };
  // Posisi baris menurut muat terakhir dari server (untuk mengenali gema realtime).
  const posServerRef = useRef<Record<string, number>>({});

  // MEMORI v24: RESET TOTAL KE KANVAS KOSONG
  const [boardsDataMap, setBoardsDataMap] = useState<Record<string, any>>(() => ensureViews({
    'b-1': {
      groups: [{ 
        id: 'group-1', 
        title: 'New Group', 
        color: '#579bfc', 
        isCollapsed: false, 
        itemLabel: 'Item Name', 
        subItemLabel: 'Subitem', 
        items: [{ id: 'item-1', name: 'New Item', isSubItemsOpen: false, subItems: [] }] 
      }],
      columns: [],    // Tabel utama 100% kosong dari kolom
      subColumns: []  // Subitem 100% kosong dari kolom
    }
  }));

  // === LAZY-LOAD SEL ===
  // Kerangka papan dimuat sekali; nilai sel dimuat seperlunya oleh `pemuat`
  // (papan yang dibuka, tugas saya, kolom lintas papan). Lihat lib/tracker/pemuat.ts.
  const petaRef = useRef<Record<string, any>>(boardsDataMap);
  petaRef.current = boardsDataMap;
  // Keadaan layar terkini untuk mengenali gema realtime (lihat lib/tracker/gema.ts).
  const wsRef = useRef<any[]>(workspaces);
  const labelsRef = useRef<any>(labels);
  useEffect(() => { wsRef.current = workspaces; labelsRef.current = labels; }, [workspaces, labels]);
  // Status muat disimpan sebagai DATA di state (bukan dibaca dari objek yang
  // berubah diam-diam) supaya setiap komponen yang memakainya ikut digambar ulang.
  const [statusMuat, setStatusMuat] = useState<StatusPemuat>(STATUS_KOSONG);
  const laporRef = useRef<(m: string) => void>(() => {});
  const pemuatRef = useRef<Pemuat | null>(null);
  if (!pemuatRef.current) {
    pemuatRef.current = buatPemuat({
      supabase: hrisSupabase,
      ambilPeta: () => petaRef.current,
      ubahPeta: (fn) => setBoardsDataMap((p: any) => fn(p)),
      saatBerubah: () => { if (pemuatRef.current) setStatusMuat(pemuatRef.current.status()); },
      lapor: (m) => laporRef.current(m),
    });
  }
  const pemuat = pemuatRef.current;
  const uidMuatRef = useRef('');   // akun pemilik data yang sedang dimuat (kunci cache)
  // Pembaca status (fungsi murni atas state → aman untuk React Compiler).
  const papanSiap = (id: string) => statusMuat.tampil.includes(id) || !boardsDataMap[id];
  const sayaSiap = () => statusMuat.saya;
  const lintasSiap = (tipe: string[]) => (tipe || []).every((t) => statusMuat.tipe.includes(t));
  const galatMuat = (kunci: string) => statusMuat.galat[kunci] || null;

  const activeBoardData = activeBoardId ? boardsDataMap[activeBoardId] : null;
  const boardData = activeBoardData?.groups || [];
  const columns = activeBoardData?.columns || [];
  const subColumns = activeBoardData?.subColumns || [];

  // === MULTI-VIEW: daftar view & view aktif (per board) ===
  const views = activeBoardData?.views || [];
  // 'mytasks' dan 'acc' adalah view LINTAS PAPAN — bukan milik papan mana pun.
  // Tanpa dikecualikan di sini, views[0] akan menjadi cadangan dan tabel
  // ikut tergambar di belakang layar ACC.
  const activeView = (activeViewId === 'mytasks' || activeViewId === 'acc') ? null : (views.find((v:any) => v.id === activeViewId) || views[0] || null);

  // hiddenColumns kini PER-VIEW (disimpan di activeView.config); API tetap sama.
  // Pengubahnya (setHiddenColumns) ada di bagian VIEW INSTANCES — ikut tersimpan ke database.
  const hiddenColumns = activeView?.config?.hiddenColumns || [];

  const setBoardData = (newGroups: any[]) => { if(activeBoardId) setBoardsDataMap(p => ({ ...p, [activeBoardId]: { ...p[activeBoardId], groups: newGroups } })); };
  const setColumns = (newCols: any[]) => { if(activeBoardId) setBoardsDataMap(p => ({ ...p, [activeBoardId]: { ...p[activeBoardId], columns: newCols } })); };
  const setSubColumns = (newSubCols: any[]) => { if(activeBoardId) setBoardsDataMap(p => ({ ...p, [activeBoardId]: { ...p[activeBoardId], subColumns: newSubCols } })); };
  // Simpan target sebuah akun untuk board (lokal + cloud).
  const setAccountTarget = (boardId: string, akun: string, target: number) => {
    setAccountTargets((p:any) => ({ ...p, [boardId]: { ...(p[boardId] || {}), [akun]: target } }));
    if (cloudOn()) dbSetAccountTarget(supabase, boardId, akun, target).catch((e:any) => pushToast('Gagal simpan target: ' + (e?.message || e)));
  };
  const hapusAccountTarget = (boardId: string, akun: string) => {
    setAccountTargets((p:any) => { const b = { ...(p[boardId] || {}) }; delete b[akun]; return { ...p, [boardId]: b }; });
    if (cloudOn()) dbHapusAccountTarget(supabase, boardId, akun).catch((e:any) => pushToast('Gagal hapus akun: ' + (e?.message || e)));
  };
  
  const [updatesData, setUpdatesData] = useState<Record<string, any[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' } | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  // Centang baris milik board yang sedang dibuka saja: saat pindah board, pilihan
  // dikosongkan (dulu tetap tersimpan → "Hapus" massal menghapus item board lain).
  useEffect(() => { setSelectedItems((p) => (p.length ? [] : p)); }, [activeBoardId]);
  const [inlineCreate, setInlineCreate] = useState<any>({ type: '', parentId: null });
  const [inputValue, setInputValue] = useState('');
  const [updatePanelOpen, setUpdatePanelOpen] = useState<any>(null);
  const [newUpdateText, setNewUpdateText] = useState(''); 
  const [editingCell, setEditingCell] = useState<any>(null);
  const [editValue, setEditValue] = useState('');
  const [openDropdown, setOpenDropdown] = useState<any>(null);
  const [newLabelText, setNewLabelText] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [tempTimeline, setTempTimeline] = useState({ start: '', end: '' });
  const [isHideMenuOpen, setIsHideMenuOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<any>(null);
  const [draggedItem, setDraggedItem] = useState<any>(null);
  const [dragOverItem, setDragOverItem] = useState<any>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  /* Kapan terakhir kali BROWSER INI menulis perubahan struktur papan
     (nama kolom, urutan kolom, label grup).

     Kegunaannya: perubahan itu sudah tergambar di layar sebelum dikirim,
     jadi menarik ulang SELURUH papan begitu gemanya kembali lewat realtime
     hanya menghasilkan kedipan tanpa menambah informasi apa pun — inilah
     'layar merefresh' sesaat setelah menekan Enter. Gema dari diri sendiri
     dilewati; perubahan dari orang lain tetap ditarik seperti biasa. */
  const tulisSendiriRef = useRef(0);
  const tandaiTulisSendiri = () => { tulisSendiriRef.current = Date.now(); };
  const [detailItem, setDetailItem] = useState<any>(null);

  // === TOAST + UNDO ===
  const [toasts, setToasts] = useState<any[]>([]);
  const dismissToast = (id: string) => setToasts((t:any[]) => t.filter((x:any) => x.id !== id));
  const pushToast = (message: string, undo?: () => void, actionLabel?: string, duration = 6000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((t:any[]) => [...t, { id, message, undo, actionLabel }]);
    if (duration > 0) setTimeout(() => setToasts((t:any[]) => t.filter((x:any) => x.id !== id)), duration);
  };
  laporRef.current = (m: string) => pushToast(m);

  // === AUTH: cek sesi + ikuti perubahan login/logout ===
  // PENTING: pakai getSession() (membaca penyimpanan LOKAL, tanpa jaringan),
  // BUKAN getUser() yang selalu memanggil server. Dulu memakai getUser():
  // sekali jaringan tersendat atau token sedang disegarkan, panggilan gagal,
  // authUser jadi null, dan halaman menuduh "Sesi tidak ditemukan" padahal
  // pengguna masih login — itu sebabnya sering terjadi tiba-tiba.
  useEffect(() => {
    if (!supabase) { setAuthChecked(true); return; }
    let active = true;
    supabase.auth.getSession()
      .then(({ data }: any) => { if (active) { setAuthUser(data?.session?.user || null); setAuthChecked(true); } })
      .catch(() => { if (active) setAuthChecked(true); }); // gagal baca → jangan tertahan di loading
    const { data: sub } = supabase.auth.onAuthStateChange((_e: any, session: any) => {
      // Hanya perbarui bila benar-benar ada sesi. Peristiwa sela seperti
      // TOKEN_REFRESHED sesaat bisa membawa session kosong — kalau langsung
      // dipakai, pengguna terpental keluar tanpa sebab.
      if (session?.user) setAuthUser(session.user);
      else if (_e === 'SIGNED_OUT') setAuthUser(null);
    });
    return () => { active = false; sub?.subscription?.unsubscribe?.(); };
  }, [supabase]);

  // === Tab lama didiamkan → token kedaluwarsa ===
  // Token akses Supabase berumur ±1 jam. Saat tab dibiarkan lama di latar,
  // pewaktu penyegaran otomatis kerap tidak jalan (peramban menidurkan timer
  // pada tab tak aktif). Begitu tab dibuka lagi, token sudah mati dan halaman
  // menuduh sesi hilang — persis keluhan "didiamkan lama lalu harus login ulang".
  //
  // Perbaikan: setiap tab kembali aktif, minta sesi lagi. getSession() otomatis
  // menyegarkan token bila sudah lewat. Kalau memang benar-benar habis, barulah
  // authUser dikosongkan.
  useEffect(() => {
    if (!supabase) return;
    const saatKembali = async () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) setAuthUser(data.session.user);
      } catch { /* jaringan gagal → biarkan sesi lama, jangan tendang keluar */ }
    };
    document.addEventListener("visibilitychange", saatKembali);
    window.addEventListener("focus", saatKembali);
    // Jaring pengaman: periksa berkala selama tab aktif.
    const jaga = setInterval(saatKembali, 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", saatKembali);
      window.removeEventListener("focus", saatKembali);
      clearInterval(jaga);
    };
  }, [supabase]);

  // === LOAD dari Supabase saat user tersedia (sekali) ===
  // Yang dimuat di sini hanya KERANGKA (papan, grup, kolom, label, item) — tanpa
  // nilai sel, sehingga waktunya tak membengkak seiring data. Nilai sel dimuat
  // oleh komponen yang membutuhkannya (lihat `pemuat`).
  useEffect(() => {
    if (!supabase || !authUser || isLoaded) return;
    let active = true;
    (async () => {
      try {
        const uid = authUser?.id || '';
        const cache = (uid && _cacheTrackerState && _cacheTrackerState.uid === uid) ? _cacheTrackerState : null;
        const fromCache = !!cache;
        let s: any;
        let anggota: any[] | null = null;
        if (cache) {
          s = cache.state;
          anggota = (s.teamMembers && s.teamMembers.length) ? s.teamMembers : null; // avatar sudah tergabung
        } else {
          s = await loadStrukturState(supabase);
          if (!active) return;
          anggota = s.teamMembers.length ? await mergeAvatars(supabase, s.teamMembers) : null;
          if (!active) return;
        }
        // Status buka/tutup folder sidebar yang diingat perangkat ini (lihat sidebarBuka.ts).
        const wsAwal = terapkanBuka(s.workspaces, bacaBuka());
        setWorkspaces(wsAwal);
        setBoardsDataMap(ensureViews(s.boardsDataMap));
        if (typeof s.viewsTersedia === 'boolean') setViewsTersedia(s.viewsTersedia);
        if (s.posisi) posServerRef.current = s.posisi;
        setLabels(s.labels);
        setAccountTargets(s.accountTargets || {});
        if (anggota) setTeamMembers(anggota);
        if (s.currentUserId) setCurrentUserId(s.currentUserId);
        setCurrentUserRole(s.currentUserRole || 'member');
        setCanContentHub(s.canContentHub !== false);
        setCanAcc(s.canAcc === true);
        // Pulihkan board terakhir yang dibuka (kalau masih ada); jika tidak, board pertama.
        let saved: string | null = null;
        try { saved = localStorage.getItem('dwt_active_board'); } catch {}
        const boardIds = new Set<string>();
        const kumpulBoardIds = (bs: any[]) => { for (const b of (bs || [])) { boardIds.add(b.id); kumpulBoardIds(b.boards); } };
        for (const w of wsAwal) for (const y of (w.years || [])) for (const m of (y.months || [])) kumpulBoardIds(m.boards);
        let firstBoard: string | null = null;
        for (const w of wsAwal) {
          for (const y of (w.years || [])) {
            for (const m of (y.months || [])) { if (m.boards && m.boards[0]) { firstBoard = m.boards[0].id; break; } }
            if (firstBoard) break;
          }
          if (firstBoard) break;
        }
        const chosen = (saved && boardIds.has(saved)) ? saved : firstBoard;
        // buka tahun/bulan induk board terpilih agar sidebar menampilkannya + set workspace aktif
        let wsActive = wsAwal[0]?.id || '';
        for (const w of wsAwal) {
          for (const y of (w.years || [])) {
            for (const m of (y.months || [])) {
              // Termasuk sub-papan: buka juga papan induknya agar terlihat di sidebar.
              const bukaInduk = (bs: any[]): boolean => (bs || []).some((b: any) => {
                if (b.id === chosen) return true;
                if (bukaInduk(b.boards)) { b.isOpen = true; return true; }
                return false;
              });
              if (bukaInduk(m.boards)) { wsActive = w.id; y.isOpen = true; m.isOpen = true; }
            }
          }
        }
        setWorkspaces([...wsAwal]);
        setActiveWorkspaceId(wsActive);
        setActiveBoardId(chosen);
        // Dari cache: tampilkan sel yang tersimpan; tetap dimuat ulang di latar.
        if (fromCache) { pemuat.pulihkan(cache?.tanda); setStatusMuat(pemuat.status()); }
        uidMuatRef.current = uid;
        setIsLoaded(true);
        // Data dari cache → segarkan kerangka diam-diam di latar.
        if (fromCache) { void refreshData(); }
      } catch (e: any) {
        if (active) setLoadError(e?.message || 'Gagal memuat data dari Supabase');
      }
    })();
    return () => { active = false; };
  }, [supabase, authUser, isLoaded]);

  // Simpan state terakhir ke cache memori (hanya referensi — murah).
  // Hanya untuk akun yang memang memuat data ini (cegah tercampur bila akun berganti).
  useEffect(() => {
    if (!isLoaded || !authUser?.id || authUser.id !== uidMuatRef.current) return;
    _cacheTrackerState = {
      uid: authUser.id,
      state: { workspaces, boardsDataMap, labels, accountTargets, teamMembers, currentUserId, currentUserRole, canContentHub, canAcc, viewsTersedia },
      tanda: pemuat.snapshot(),
    };
  }, [isLoaded, authUser, workspaces, boardsDataMap, labels, accountTargets, teamMembers, currentUserId, currentUserRole, canContentHub, canAcc, viewsTersedia, statusMuat, pemuat]);

  // Segarkan KERANGKA (dipakai realtime, setelah duplikat papan, dsb.).
  // Dulu fungsi ini menarik ulang SEMUA nilai sel semua papan — itulah yang
  // membuat muat/ tambah board terasa berat. Sekarang hanya kerangka; sel yang
  // sudah ada di layar dipertahankan, dan hanya item baru yang selnya dimuat.
  // Panggilan saat proses berjalan digabung (+1 putaran susulan).
  const strukturRef = useRef<{ jalan: Promise<void> | null; lagi: boolean }>({ jalan: null, lagi: false });
  const sesiRef = useRef(0);
  const refreshData = (): Promise<void> => {
    if (!supabase || !authUser) return Promise.resolve();
    const st = strukturRef.current;
    if (st.jalan) { st.lagi = true; return st.jalan; }
    const sesi = sesiRef.current;
    const jalan = (async () => {
      do {
        st.lagi = false;
        try {
          const mulai = Date.now();
          const s = await loadStrukturState(supabase);
          const anggota = s.teamMembers.length ? await mergeAvatars(supabase, s.teamMembers) : null;
          if (sesi !== sesiRef.current) return;
          const lamaIds = semuaIdItem(petaRef.current);
          const baru = ensureViews(s.boardsDataMap);
          // Status buka/tutup folder di layar dipertahankan (dulu kembali ke nilai database tiap refresh).
          const simpananBuka = bacaBuka();
          const sibuk = sibukViewsSejak(mulai);
          setWorkspaces((prev: any) => terapkanBuka(s.workspaces, simpananBuka, prev));
          setBoardsDataMap((prev: any) => pertahankanSel(baru, prev, sibuk));
          if (typeof s.viewsTersedia === 'boolean') setViewsTersedia(s.viewsTersedia);
          if (s.posisi) posServerRef.current = s.posisi;
          setLabels(s.labels);
          setAccountTargets(s.accountTargets || {});
          if (anggota) setTeamMembers(anggota);
          if (s.currentUserId) setCurrentUserId(s.currentUserId);
          setCurrentUserRole(s.currentUserRole || 'member');
          setCanContentHub(s.canContentHub !== false);
          setCanAcc(s.canAcc === true);
          await pemuat.sesudahStruktur(baru, lamaIds);
        } catch { /* abaikan */ }
      } while (st.lagi && sesi === sesiRef.current);
    })();
    st.jalan = jalan.finally(() => { st.jalan = null; });
    return st.jalan;
  };

  // Id pengguna untuk "tugas saya" (sama dengan yang dipakai My Tasks).
  const uidSaya = (currentUserId && currentUserId !== 'me') ? currentUserId : (authUser?.id || '');
  const uidRef = useRef(uidSaya);
  uidRef.current = uidSaya;
  const activeBoardRef = useRef(activeBoardId);
  activeBoardRef.current = activeBoardId;
  const muatSelSaya = (opsi?: { paksa?: boolean }) => pemuat.muatSelSaya(uidSaya, opsi);

  // Panel detail dibuka (mis. karyawan dari My Tasks) → pastikan isi papannya termuat
  // supaya induk & sub-item lain tampil lengkap.
  useEffect(() => {
    if (isLoaded && detailItem && activeBoardId) void pemuat.muatSelBoard(activeBoardId);
  }, [isLoaded, detailItem, activeBoardId, pemuat]);

  // === REALTIME PAPAN — berlaku untuk semua peran, termasuk manager ===
  // Perubahan rekan langsung tampak tanpa memuat ulang halaman.
  // Nilai sel ditambal langsung agar ringan; perubahan struktur
  // (item, grup, kolom, papan) memicu muat ulang berjeda.

  const tambalSel = useCallback((itemId: string, columnId: string, nilai: any) => {
    setBoardsDataMap((peta: any) => {
      let adaYangBerubah = false;
      const hasil: any = {};
      for (const bid of Object.keys(peta)) {
        const papan = peta[bid];
        let papanBerubah = false;
        const grupBaru = (papan.groups || []).map((g: any) => {
          let grupBerubah = false;
          const itemsBaru = (g.items || []).map((it: any) => {
            let baru = it;
            if (it.id === itemId) { baru = { ...baru, [columnId]: nilai }; grupBerubah = true; }
            const subs = it.subItems || [];
            if (subs.length && subs.some((sx: any) => sx.id === itemId)) {
              baru = { ...baru, subItems: subs.map((sx: any) => (sx.id === itemId ? { ...sx, [columnId]: nilai } : sx)) };
              grupBerubah = true;
            }
            return baru;
          });
          if (!grupBerubah) return g;
          papanBerubah = true;
          return { ...g, items: itemsBaru };
        });
        hasil[bid] = papanBerubah ? { ...papan, groups: grupBaru } : papan;
        if (papanBerubah) adaYangBerubah = true;
      }
      return adaYangBerubah ? hasil : peta;
    });
  }, []);

  useEffect(() => {
    if (!supabase || !authUser || !isLoaded) return;
    let jeda: any;
    let jedaSaya: any;
    let jedaPenuh: any;

    // Jangan menarik data baru saat seseorang sedang mengetik — tunggu ia selesai.
    const sedangMengetik = () => {
      const el: any = typeof document !== 'undefined' ? document.activeElement : null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const JENDELA_TULIS = 2500;
    const jadwalkanMuatUlang = (tunda = 1500) => {
      clearTimeout(jeda);
      jeda = setTimeout(() => {
        if (sedangMengetik()) { jadwalkanMuatUlang(); return; }
        // Tulisan tab ini masih baru (mungkin belum seluruhnya sampai ke server):
        // tunda sampai jedanya lewat supaya layar tak berkedip — tapi JANGAN dibuang.
        // Dulu dibuang, sehingga perubahan rekan yang datang dalam 2,5 detik
        // setelah kita menulis tak pernah tampil sampai halaman dimuat ulang.
        const sisa = JENDELA_TULIS - (Date.now() - tulisSendiriRef.current);
        if (sisa > 0) { jadwalkanMuatUlang(sisa + 300); return; }
        refreshData();
      }, tunda);
    };
    // Perubahan struktur: gema tulisan sendiri yang isinya SUDAH sama dengan
    // layar dilewati (tak perlu ditarik ulang); selain itu dijadwalkan muat ulang.
    const saatStruktur = (tabel: string) => (p: any) => {
      let gema = false;
      if (Date.now() - tulisSendiriRef.current < JENDELA_TULIS) {
        try { gema = sudahTercermin(tabel, p, { peta: petaRef.current, workspaces: wsRef.current, labels: labelsRef.current, posisi: posServerRef.current }); }
        catch { gema = false; }   // ragu → muat ulang
      }
      if (!gema) jadwalkanMuatUlang();
    };

    // "Tugas saya" disegarkan berjeda bila penugasan yang menyangkut saya berubah.
    const jadwalkanSaya = (paksa = false) => {
      clearTimeout(jedaSaya);
      jedaSaya = setTimeout(() => {
        const uid = uidRef.current;
        if (uid && pemuat.sayaDiminta()) void pemuat.muatSelSaya(uid, { paksa });
      }, 800);
    };
    // Cadangan bila event tak membawa item_id (mis. DELETE ber-RLS hanya membawa
    // kunci primer): segarkan PENUGASAN papan aktif + tugas saya (ringan, hanya
    // tabel item_assignees), berjeda.
    const jadwalkanTim = () => {
      clearTimeout(jedaPenuh);
      jedaPenuh = setTimeout(() => {
        void pemuat.segarkanTim(activeBoardRef.current, uidRef.current);
        jadwalkanSaya();
      }, 1200);
    };

    let ch: any = supabase
      .channel('papan-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_values' }, (p: any) => {
        // DELETE: baris ada di p.old (p.new berupa objek kosong).
        const baris = p.eventType === 'DELETE' ? p.old : (p.new || p.old);
        if (!baris?.item_id || !baris?.column_id) return;
        pemuat.tandaiEdit(baris.item_id, baris.column_id, false);
        tambalSel(baris.item_id, baris.column_id, p.eventType === 'DELETE' ? '' : baris.value);
      });

    for (const tabel of ['items', 'groups', 'columns', 'column_options', 'tree_nodes']) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: tabel }, saatStruktur(tabel));
    }
    // Penugasan (semua peran): tambal tepat sasaran item+kolom yang berubah —
    // bukan lagi muat ulang seluruh data. Bila menyangkut saya, "tugas saya" ikut disegarkan.
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'item_assignees' }, (p: any) => {
      const baris = p.eventType === 'DELETE' ? p.old : (p.new || p.old);
      if (baris?.item_id && baris?.column_id) {
        pemuat.tambalTim(baris.item_id, baris.column_id);
        if (!baris.member_id || baris.member_id === uidRef.current) {
          jadwalkanSaya();
          // Tugas yang baru di-assign ke saya bisa jadi belum ada di kerangka
          // (mis. akses karyawan dibatasi ke tugasnya) → segarkan kerangka juga.
          if (!semuaIdItem(petaRef.current).has(baris.item_id)) jadwalkanMuatUlang();
        }
      } else {
        jadwalkanTim();
      }
    });
    // Tersambung ULANG setelah putus → event selama putus mungkin terlewat:
    // segarkan kerangka + sel yang sedang dipakai.
    let pernahTerhubung = false;
    ch.subscribe((status: string) => {
      if (status !== 'SUBSCRIBED') return;
      if (pernahTerhubung) {
        void refreshData();
        void pemuat.segarkanSemua(activeBoardRef.current, uidRef.current);
      }
      pernahTerhubung = true;
    });

    return () => { clearTimeout(jeda); clearTimeout(jedaSaya); clearTimeout(jedaPenuh); supabase.removeChannel(ch); };
    // authUser?.id (bukan objeknya): objek sesi diganti setiap tab kembali fokus —
    // memakai objeknya membuat kanal realtime dibongkar-pasang tanpa perlu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, authUser?.id, isLoaded, currentUserRole, tambalSel]);

  // === REALTIME VIEW PAPAN (tabel board_views) ===
  // Kanal TERPISAH dan hanya dipasang bila tabelnya terbaca: berlangganan tabel
  // yang belum dibuat bisa menggagalkan satu kanal penuh — realtime papan tak boleh ikut mati.
  // Hanya untuk manager (yang membuka papan & tab view); karyawan cukup dari muat kerangka.
  const lihatViews = currentUserRole === 'manager';
  useEffect(() => {
    if (!supabase || !authUser || !isLoaded || !viewsTersedia || !lihatViews) return;
    let aktif = true;
    let jeda: any;
    const segarkan = () => {
      clearTimeout(jeda);
      jeda = setTimeout(async () => {
        const mulai = Date.now();
        const hasil = await muatViews(supabase);
        if (!aktif || hasil.status !== 'ada') return;
        // Papan yang sedang/baru disimpan dari tab ini dilewati dulu, lalu dimuat
        // lagi begitu simpanannya selesai (lihat simpanViews).
        const sibuk = sibukViewsSejak(mulai);
        sibuk.forEach((bid) => { if (hasil.peta[bid]) viewsTerlewatRef.current.add(bid); });
        setBoardsDataMap((p: any) => pasangViewsDb(p, hasil.peta, sibuk));
      }, 700);
    };
    segarkanViewsRef.current = segarkan;
    const ch = supabase
      .channel('papan-views')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABEL_VIEWS }, segarkan)
      .subscribe();
    return () => { aktif = false; clearTimeout(jeda); segarkanViewsRef.current = null; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, authUser?.id, isLoaded, viewsTersedia, lihatViews]);

  // Tab kembali aktif setelah lama (> 1 menit) di latar → realtime bisa terlewat
  // (peramban menidurkan koneksi): segarkan kerangka + sel yang sedang dipakai.
  useEffect(() => {
    if (!isLoaded) return;
    let tersembunyiSejak = 0;
    const saatVisibilitas = () => {
      if (document.visibilityState === 'hidden') { tersembunyiSejak = Date.now(); return; }
      if (tersembunyiSejak && Date.now() - tersembunyiSejak > 60_000) {
        void refreshData();
        void pemuat.segarkanSemua(activeBoardRef.current, uidRef.current);
      }
      tersembunyiSejak = 0;
    };
    document.addEventListener('visibilitychange', saatVisibilitas);
    return () => document.removeEventListener('visibilitychange', saatVisibilitas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, pemuat]);

  useEffect(() => {
    // 1d-ii: penyimpanan ke cloud menyusul di 1e. Sengaja TIDAK menulis ke localStorage
    // supaya data asli (mis. komentar/updates yang belum dimigrasi) tetap utuh sebagai cadangan.
  }, [workspaces, boardsDataMap, labels, teamMembers, updatesData, isLoaded]);

  // Simpan board yang sedang dibuka (preferensi UI) supaya tidak lompat saat refresh.
  useEffect(() => {
    if (isLoaded && activeBoardId) { try { localStorage.setItem('dwt_active_board', activeBoardId); } catch {} }
  }, [activeBoardId, isLoaded]);

  let activeBoardName = '';
  let activeBoardPath: { year: string; month: string; board: string } | null = null;
  if (activeBoardId) {
    // Telusuri sampai sub-papan (mis. MARKETPLACE › Adiw) — dulu hanya papan
    // tingkat atas, sehingga judul & breadcrumb sub-papan kosong.
    const jalur = (bs: any[]): any[] | null => {
      for (const b of (bs || [])) {
        if (b.id === activeBoardId) return [b];
        const x = jalur(b.boards);
        if (x) return [b, ...x];
      }
      return null;
    };
    cari: for (const w of workspaces || []) for (const year of w.years || []) for (const month of year.months || []) {
      const j = jalur(month.boards);
      if (j) {
        const daun = j[j.length - 1];
        activeBoardName = daun.name;
        activeBoardPath = { year: year.name, month: month.name, board: j.map((b: any) => b.name).join(' › ') };
        break cari;
      }
    }
  }

  const triggerConfirm = (title: string, message: string, action: () => void) => setConfirmModal({ isOpen: true, title, message, onConfirm: () => { action(); setConfirmModal(null); } });
  // === 1e: simpan perubahan sel/nama ke cloud (fire-and-forget) ===
  const cloudOn = () => !!supabase && isLoaded && !!authUser;
  const persistItemField = async (scope: 'main' | 'sub', itemId: string, field: string, val: any, boardId?: string | null) => {
    if (!cloudOn()) return;
    try {
      if (field === 'name') { await dbUpdateItemName(supabase, itemId, val); return; }
      if (field === 'isSubItemsOpen') { await dbSetItemMeta(supabase, itemId, { is_subitems_open: !!val }); return; }
      if (field === 'description') { await dbSetItemMeta(supabase, itemId, { description: val }); return; }
      // Kolom diambil dari board PEMILIK item (bukan selalu board aktif) — dulu
      // ubah status dari My Tasks / ACC di Antrean untuk board lain tak tersimpan.
      const bdPemilik = boardId && boardId !== activeBoardId ? boardsDataMap[boardId] : null;
      const cols = bdPemilik
        ? (scope === 'main' ? (bdPemilik.columns || []) : (bdPemilik.subColumns || []))
        : (scope === 'main' ? columns : subColumns);
      const col = cols.find((c: any) => c.id === field);
      if (!col) return; // bukan kolom dikenal -> lewati
      await dbSetCellValue(supabase, itemId, field, col.type, val);
    } catch (e: any) { pushToast('Gagal simpan ke cloud: ' + (e?.message || e)); }
  };

  // Board pemilik sebuah grup: board aktif bila grup ada di sana, selain itu
  // dicari di semua board yang sudah dimuat (My Tasks & Antrean lintas-board).
  const boardPemilikGrup = (map: any, gId: string): string | null => {
    if (activeBoardId && (map?.[activeBoardId]?.groups || []).some((g:any) => g.id === gId)) return activeBoardId;
    for (const bid of Object.keys(map || {})) if ((map[bid]?.groups || []).some((g:any) => g.id === gId)) return bid;
    return null;
  };
  const handleUpdateItem = (gId: string, iId: string, field: string, val: any) => {
    const bid = boardPemilikGrup(boardsDataMap, gId) || activeBoardId;
    setBoardsDataMap((prev:any) => {
      const b = boardPemilikGrup(prev, gId) || activeBoardId;
      if (!b || !prev[b]) return prev;
      const bd = prev[b];
      const groups = bd.groups.map((g:any) => g.id !== gId ? g : { ...g, items: g.items.map((i:any) => i.id === iId ? { ...i, [field]: val } : i) });
      return { ...prev, [b]: { ...bd, groups } };
    });
    pemuat.tandaiEdit(iId, field);
    persistItemField('main', iId, field, val, bid);
  };
  const handleUpdateSubItem = (gId: string, iId: string, sId: string, field: string, val: any) => {
    const bid = boardPemilikGrup(boardsDataMap, gId) || activeBoardId;
    setBoardsDataMap((prev:any) => {
      const b = boardPemilikGrup(prev, gId) || activeBoardId;
      if (!b || !prev[b]) return prev;
      const bd = prev[b];
      const groups = bd.groups.map((g:any) => g.id !== gId ? g : { ...g, items: g.items.map((i:any) => i.id === iId ? { ...i, subItems: (i.subItems || []).map((s:any) => s.id === sId ? { ...s, [field]: val } : s) } : i) });
      return { ...prev, [b]: { ...bd, groups } };
    });
    pemuat.tandaiEdit(sId, field);
    persistItemField('sub', sId, field, val, bid);
  };
  const handleDeleteItem = (gId: string, iId: string) => {
    tandaiTulisSendiri();
    setBoardData(boardData.map((g:any) => g.id === gId ? { ...g, items: g.items.filter((i:any) => i.id !== iId) } : g));
    pushToast('Item dihapus');
    if (cloudOn()) dbDeleteItem(supabase, iId).catch((e:any) => pushToast('Gagal hapus di cloud: ' + (e?.message || e)));
  };
  const handleDeleteSubItem = (gId: string, iId: string, sId: string) => {
    tandaiTulisSendiri();
    setBoardData(boardData.map((g:any) => g.id !== gId ? g : { ...g, items: g.items.map((i:any) => i.id === iId ? { ...i, subItems: i.subItems.filter((s:any) => s.id !== sId) } : i) }));
    pushToast('Sub-item dihapus');
    if (cloudOn()) dbDeleteItem(supabase, sId).catch((e:any) => pushToast('Gagal hapus di cloud: ' + (e?.message || e)));
  };
  
  const handleAddItem = (gId: string) => {
    tandaiTulisSendiri();
    const id = newId();
    const grp = boardData.find((g:any) => g.id === gId);
    const position = grp ? grp.items.length : 0;
    setBoardData(boardData.map((g:any) => g.id === gId ? { ...g, items: [...g.items, { id, name: 'New item', isSubItemsOpen: false, subItems: [] }] } : g));
    if (cloudOn()) dbAddItem(supabase, { id, groupId: gId, name: 'New item', position }).catch((e:any) => pushToast('Gagal tambah item di cloud: ' + (e?.message || e)));
  };
  const handleAddSubItem = (gId: string, iId: string) => {
    tandaiTulisSendiri();
    const id = newId();
    const grp = boardData.find((g:any) => g.id === gId);
    const parent = grp?.items.find((i:any) => i.id === iId);
    const position = parent?.subItems ? parent.subItems.length : 0;
    setBoardData(boardData.map((g:any) => g.id !== gId ? g : { ...g, items: g.items.map((i:any) => i.id === iId ? { ...i, isSubItemsOpen: true, subItems: [...(i.subItems || []), { id, name: 'New sub-item' }] } : i) }));
    if (cloudOn()) dbAddSubItem(supabase, { id, groupId: gId, parentItemId: iId, name: 'New sub-item', position })
      .then(() => dbSetItemMeta(supabase, iId, { is_subitems_open: true }))
      .catch((e:any) => pushToast('Gagal tambah sub-item di cloud: ' + (e?.message || e)));
  };
  const toggleGroupSelection = (group: any) => { const allIds = group.items.map((i:any) => i.id), isAll = allIds.length > 0 && allIds.every((id:string) => selectedItems.includes(id)); if (isAll) setSelectedItems((p:any) => p.filter((id:string) => !allIds.includes(id))); else setSelectedItems((p:any) => [...p, ...allIds.filter((id:string) => !p.includes(id))]); };
  // Lipat/buka SEMUA subitem di sebuah grup sekaligus (dipakai chevron header
  // ITEM NAME). Kalau ada yang terbuka → tutup semua; kalau semua tertutup → buka semua.
  const toggleAllSubItems = (group: any) => {
    const items = group.items || [];
    if (!items.length) return;
    const nilai = !items.some((i:any) => i.isSubItemsOpen);
    setBoardsDataMap((prev:any) => {
      if (!activeBoardId || !prev[activeBoardId]) return prev;
      const bd = prev[activeBoardId];
      const groups = bd.groups.map((g:any) => g.id !== group.id ? g : { ...g, items: (g.items || []).map((i:any) => ({ ...i, isSubItemsOpen: nilai })) });
      return { ...prev, [activeBoardId]: { ...bd, groups } };
    });
    if (cloudOn()) {
      (async () => { for (const it of items) await dbSetItemMeta(supabase, it.id, { is_subitems_open: nilai }); })()
        .catch((e:any) => pushToast('Gagal simpan lipat semua: ' + (e?.message || e)));
    }
  };

  const handleDeleteTeamMember = (memberId: string) => {
    const snap = teamMembers;
    setTeamMembers(prev => prev.filter(m => m.id !== memberId));
    pushToast('Anggota tim dihapus', () => setTeamMembers(snap));
  };
  const handleDeleteLabel = (field: string, labelId: string) => {
    tandaiTulisSendiri();
    const deletedText = (labels[field] || []).find((l: any) => l.id === labelId)?.text;
    setLabels((prev: any) => ({ ...prev, [field]: (prev[field] || []).filter((l: any) => l.id !== labelId) }));

    // Bersihkan nilai yang terhapus dari semua item (status = kosongkan, tags = buang dari array)
    const changed: any[] = [];
    if (deletedText != null) {
      const next: any = {};
      for (const bId of Object.keys(boardsDataMap)) {
        const bd = boardsDataMap[bId];
        const hasCol = [...(bd.columns || []), ...(bd.subColumns || [])].some((c: any) => c.id === field);
        if (!hasCol) { next[bId] = bd; continue; }
        const clean = (it: any) => {
          const val = it[field];
          if (Array.isArray(val) && val.includes(deletedText)) { const nv = val.filter((x: any) => x !== deletedText); changed.push({ itemId: it.id, val: nv }); return { ...it, [field]: nv }; }
          if (val === deletedText) { changed.push({ itemId: it.id, val: '' }); return { ...it, [field]: '' }; }
          return it;
        };
        const groups = (bd.groups || []).map((g: any) => ({ ...g, items: (g.items || []).map((it: any) => { const ci = clean(it); return { ...ci, subItems: (ci.subItems || []).map(clean) }; }) }));
        next[bId] = { ...bd, groups };
      }
      setBoardsDataMap(next);
    }

    pushToast('Label dihapus');
    if (cloudOn()) {
      dbDeleteLabel(supabase, labelId).catch((e: any) => pushToast('Gagal hapus label di cloud: ' + (e?.message || e)));
      if (deletedText != null) {
        // Sel yang memakai label ini dibersihkan berdasarkan data SERVER (papan yang
        // belum dibuka tak punya sel di memori). Gagal → pakai daftar dari memori.
        (async () => {
          let target = changed;
          try {
            const baris = await ambilNilaiKolom(supabase, field);
            target = [];
            for (const b of baris) {
              const v = b.value;
              if (Array.isArray(v) && v.includes(deletedText)) target.push({ itemId: b.item_id, val: v.filter((x: any) => x !== deletedText) });
              else if (v === deletedText) target.push({ itemId: b.item_id, val: '' });
            }
          } catch { /* pakai daftar lokal */ }
          tandaiTulisSendiri();
          await Promise.all(target.map((c: any) => dbSetCellValue(supabase, c.itemId, field, 'status', c.val).catch(() => {})));
        })();
      }
    }
  };
  // Tambah opsi/label baru (dipakai context & TableCell) — id uuid + simpan ke cloud
  const addLabelOption = (columnId: string, text: string, color?: string) => {
    tandaiTulisSendiri();
    const lbl = { id: newId(), text, color: color || LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)] };
    const position = (labels[columnId]?.length || 0);
    setLabels((prev:any) => ({ ...prev, [columnId]: [...(prev[columnId] || []), lbl] }));
    if (cloudOn()) dbAddLabel(supabase, { id: lbl.id, columnId, text: lbl.text, color: lbl.color, position }).catch((e:any) => pushToast('Gagal tambah label di cloud: ' + (e?.message || e)));
    return lbl;
  };
  const updateLabelColor = (columnId: string, labelId: string, color: string) => {
    tandaiTulisSendiri();
    setLabels((prev:any) => ({ ...prev, [columnId]: (prev[columnId] || []).map((l:any) => l.id === labelId ? { ...l, color } : l) }));
    if (cloudOn()) dbUpdateLabelColor(supabase, labelId, color).catch((e:any) => pushToast('Gagal ubah warna label: ' + (e?.message || e)));
  };
  // Label milik kolom yang dihapus ikut dibuang dari memori (di database sudah
  // terhapus lewat cascade) — supaya gema penghapusannya dikenali sebagai gema.
  const buangLabelKolom = (ids: string[]) => {
    if (!ids.length) return;
    setLabels((prev: any) => {
      if (!ids.some((id) => prev[id])) return prev;
      const n = { ...prev };
      ids.forEach((id) => { delete n[id]; });
      return n;
    });
  };
  const handleDeleteColumn = (colId: string) => {
    tandaiTulisSendiri();
    setColumns(columns.filter((c:any) => c.id !== colId));
    buangLabelKolom([colId]);
    pushToast('Kolom dihapus');
    if (cloudOn()) dbDeleteColumn(supabase, colId).catch((e:any) => pushToast('Gagal hapus kolom di cloud: ' + (e?.message || e)));
  };
  const handleDeleteSubColumn = (colId: string) => {
    tandaiTulisSendiri();
    setSubColumns(subColumns.filter((c:any) => c.id !== colId));
    buangLabelKolom([colId]);
    pushToast('Kolom sub dihapus');
    if (cloudOn()) dbDeleteColumn(supabase, colId).catch((e:any) => pushToast('Gagal hapus kolom di cloud: ' + (e?.message || e)));
  };
  const handleAddGroup = () => {
    tandaiTulisSendiri();
    if (!activeBoardId) return;
    const id = newId();
    const color = HEX_COLORS[Math.floor(Math.random() * HEX_COLORS.length)];
    const position = boardData.length;
    setBoardData([...boardData, { id, title: 'New Group', color, isCollapsed: false, itemLabel: 'Item Name', subItemLabel: 'Subitem', items: [] }]);
    if (cloudOn()) dbAddGroup(supabase, { id, boardId: activeBoardId, title: 'New Group', color, position }).catch((e:any) => pushToast('Gagal tambah grup di cloud: ' + (e?.message || e)));
  };
  const updateGroup = (gId: string, patch: any) => {
    tandaiTulisSendiri();
    setBoardData(boardData.map((g:any) => g.id === gId ? { ...g, ...patch } : g));
    if (cloudOn()) dbUpdateGroup(supabase, gId, patch).catch((e:any) => pushToast('Gagal simpan grup di cloud: ' + (e?.message || e)));
  };
  const handleDeleteGroup = (gId: string) => {
    tandaiTulisSendiri();
    setBoardData(boardData.filter((g:any) => g.id !== gId));
    pushToast('Grup dihapus');
    if (cloudOn()) dbDeleteGroup(supabase, gId).catch((e:any) => pushToast('Gagal hapus grup di cloud: ' + (e?.message || e)));
  };

  // === POHON (year/month/board) — cloud-aware ===
  const addYear = (name: string) => {
    tandaiTulisSendiri();
    const id = newId(); const nm = name.toUpperCase();
    const ws = workspaces.find((w:any) => w.id === activeWorkspaceId) || workspaces[0];
    if (!ws) {
      // Pohon kosong → buat workspace ROOT dulu, lalu tahun pertamanya
      const wsId = newId();
      setWorkspaces([{ id: wsId, name: 'ROOT', years: [{ id, name: nm, isOpen: true, months: [] }] }]);
      setActiveWorkspaceId(wsId);
      if (cloudOn()) {
        dbAddTreeNode(supabase, { id: wsId, parentId: null, kind: 'workspace', name: 'ROOT', position: 0 })
          .then(() => dbAddTreeNode(supabase, { id, parentId: wsId, kind: 'year', name: nm, position: 0 }))
          .catch((e:any) => pushToast('Gagal buat workspace di cloud: ' + (e?.message || e)));
      }
      return;
    }
    const position = (ws.years?.length) || 0;
    setWorkspaces(workspaces.map((w:any) => w.id === ws.id ? { ...w, years: [...(w.years || []), { id, name: nm, isOpen: true, months: [] }] } : w));
    if (cloudOn()) dbAddTreeNode(supabase, { id, parentId: ws.id, kind: 'year', name: nm, position }).catch((e:any) => pushToast('Gagal tambah tahun di cloud: ' + (e?.message || e)));
  };
  const addMonth = (yearId: string, name: string) => {
    tandaiTulisSendiri();
    const id = newId(); const nm = name.toUpperCase();
    let position = 0;
    for (const w of workspaces) { const y = (w.years || []).find((yy:any) => yy.id === yearId); if (y) position = (y.months?.length) || 0; }
    setWorkspaces(workspaces.map((w:any) => ({ ...w, years: (w.years || []).map((y:any) => y.id === yearId ? { ...y, isOpen: true, months: [...(y.months || []), { id, name: nm, isOpen: true, boards: [] }] } : y) })));
    simpanBuka(yearId, true);
    if (cloudOn()) dbAddTreeNode(supabase, { id, parentId: yearId, kind: 'month', name: nm, position }).catch((e:any) => pushToast('Gagal tambah bulan di cloud: ' + (e?.message || e)));
  };
  // === Helper rekursif pohon board (board bisa punya sub-board) ===
  const petaBoards = (arr: any[], id: string, ubah: (b: any) => any): any[] =>
    (arr || []).map((b: any) => b.id === id ? ubah({ ...b, boards: b.boards || [] }) : { ...b, boards: petaBoards(b.boards || [], id, ubah) });
  const hapusBoards = (arr: any[], id: string): any[] =>
    (arr || []).filter((b: any) => b.id !== id).map((b: any) => ({ ...b, boards: hapusBoards(b.boards || [], id) }));
  const cariBoard = (arr: any[], id: string): any => {
    for (const b of (arr || [])) { if (b.id === id) return b; const f = cariBoard(b.boards || [], id); if (f) return f; }
    return null;
  };
  const petaSemuaBoards = (ws: any[], id: string, ubah: (b: any) => any): any[] =>
    (ws || []).map((w: any) => ({ ...w, years: (w.years || []).map((y: any) => ({ ...y, months: (y.months || []).map((m: any) => ({ ...m, boards: petaBoards(m.boards || [], id, ubah) })) })) }));
  const cariBoardWs = (id: string) => { for (const w of workspaces) for (const y of (w.years || [])) for (const m of (y.months || [])) { const f = cariBoard(m.boards || [], id); if (f) return f; } return null; };
  const adalahBulanId = (id: string) => { for (const w of workspaces) for (const y of (w.years || [])) if ((y.months || []).some((m: any) => m.id === id)) return true; return false; };

  // parentId bisa BULAN atau BOARD (untuk sub-board).
  const addBoard = (parentId: string, name: string) => {
    tandaiTulisSendiri();
    const id = newId(); const groupId = newId();
    const color = HEX_COLORS[Math.floor(Math.random() * HEX_COLORS.length)];
    let position = 0;
    // isOpen papan baru = true, sama dengan yang disimpan ke database (dbAddTreeNode
    // menulis is_open: true) — dulu layar false tapi database true, tak konsisten.
    // Pembaruan memakai updater FUNGSIONAL agar tak menimpa hasil refresh yang
    // mungkin datang bersamaan.
    const papanBaru = { id, name, isOpen: true, boards: [] };
    if (adalahBulanId(parentId)) {
      for (const w of workspaces) for (const y of (w.years || [])) { const m = (y.months || []).find((mm:any) => mm.id === parentId); if (m) position = (m.boards?.length) || 0; }
      setWorkspaces((ws: any[]) => ws.map((w:any) => ({ ...w, years: (w.years || []).map((y:any) => ({ ...y, months: (y.months || []).map((m:any) => m.id === parentId ? { ...m, isOpen: true, boards: [...(m.boards || []), papanBaru] } : m) })) })));
    } else {
      position = (cariBoardWs(parentId)?.boards?.length) || 0;
      setWorkspaces((ws: any[]) => petaSemuaBoards(ws, parentId, (b:any) => ({ ...b, isOpen: true, boards: [...(b.boards || []), papanBaru] })));
    }
    simpanBuka(parentId, true);
    setBoardsDataMap((prev:any) => ({ ...prev, [id]: { groups: [{ id: groupId, title: 'New Group', color, isCollapsed: false, itemLabel: 'Item Name', subItemLabel: 'Subitem', items: [] }], columns: [], subColumns: [], views: makeDefaultViews() } }));
    pemuat.tandaiPapanSiap(id); // papan baru kosong → tak perlu dimuat
    setActiveBoardId(id);
    if (cloudOn()) {
      dbAddTreeNode(supabase, { id, parentId, kind: 'board', name, position })
        .then(() => dbAddGroup(supabase, { id: groupId, boardId: id, title: 'New Group', color, position: 0 }))
        .then(() => { tandaiTulisSendiri(); }) // gema realtime tulisan sendiri tak perlu memuat ulang
        .catch((e:any) => pushToast('Gagal tambah board di cloud: ' + (e?.message || e)));
    }
    return id;
  };
  const renameNode = (kind: 'year'|'month'|'board', nodeId: string, name: string) => {
    tandaiTulisSendiri();
    const nm = kind === 'board' ? name : name.toUpperCase();
    setWorkspaces(workspaces.map((w:any) => {
      if (kind === 'year') return { ...w, years: (w.years || []).map((y:any) => y.id === nodeId ? { ...y, name: nm } : y) };
      if (kind === 'month') return { ...w, years: (w.years || []).map((y:any) => ({ ...y, months: (y.months || []).map((m:any) => m.id === nodeId ? { ...m, name: nm } : m) })) };
      return { ...w, years: (w.years || []).map((y:any) => ({ ...y, months: (y.months || []).map((m:any) => ({ ...m, boards: petaBoards(m.boards || [], nodeId, (b:any) => ({ ...b, name: nm })) })) })) };
    }));
    if (cloudOn()) dbRenameTreeNode(supabase, nodeId, nm).catch((e:any) => pushToast('Gagal rename di cloud: ' + (e?.message || e)));
  };
  const deleteNode = (kind: 'year'|'month'|'board', nodeId: string) => {
    tandaiTulisSendiri();
    // Semua board yang ikut terhapus (termasuk sub-board di dalamnya) dibuang
    // juga dari memori — dulu tetap muncul di My Tasks/Antrean & board aktif
    // bisa menunjuk ke board yang sudah tidak ada.
    const idTerhapus = new Set<string>();
    const kumpul = (bs: any[]) => (bs || []).forEach((b:any) => { idTerhapus.add(b.id); kumpul(b.boards); });
    const cariBoard = (bs: any[]): any => { for (const b of (bs || [])) { if (b.id === nodeId) return b; const x = cariBoard(b.boards); if (x) return x; } return null; };
    for (const w of workspaces) for (const y of (w.years || [])) {
      if (kind === 'year' && y.id === nodeId) (y.months || []).forEach((m:any) => kumpul(m.boards));
      for (const m of (y.months || [])) {
        if (kind === 'month' && m.id === nodeId) kumpul(m.boards);
        if (kind === 'board') { const b = cariBoard(m.boards); if (b) kumpul([b]); }
      }
    }
    setWorkspaces(workspaces.map((w:any) => {
      if (kind === 'year') return { ...w, years: (w.years || []).filter((y:any) => y.id !== nodeId) };
      if (kind === 'month') return { ...w, years: (w.years || []).map((y:any) => ({ ...y, months: (y.months || []).filter((m:any) => m.id !== nodeId) })) };
      return { ...w, years: (w.years || []).map((y:any) => ({ ...y, months: (y.months || []).map((m:any) => ({ ...m, boards: hapusBoards(m.boards || [], nodeId) })) })) };
    }));
    if (kind === 'board') idTerhapus.add(nodeId);
    if (idTerhapus.size) {
      const kolomTerhapus: string[] = [];
      idTerhapus.forEach((id) => { const bd = boardsDataMap[id]; [...(bd?.columns || []), ...(bd?.subColumns || [])].forEach((c: any) => kolomTerhapus.push(c.id)); });
      buangLabelKolom(kolomTerhapus);
      setBoardsDataMap((prev:any) => { const nm = { ...prev }; idTerhapus.forEach((id) => { delete nm[id]; }); return nm; });
      if (activeBoardId && idTerhapus.has(activeBoardId)) setActiveBoardId(null);
    }
    pushToast((kind === 'year' ? 'Tahun' : kind === 'month' ? 'Bulan' : 'Board') + ' dihapus');
    if (cloudOn()) dbDeleteTreeNode(supabase, nodeId).catch((e:any) => pushToast('Gagal hapus di cloud: ' + (e?.message || e)));
  };
  // Buka/tutup sub-papan; diingat di perangkat ini (lihat lib/tracker/sidebarBuka.ts).
  const toggleBoard = (boardId: string) => {
    const nilai = !cariBoardWs(boardId)?.isOpen;
    simpanBuka(boardId, nilai);
    setWorkspaces((ws:any) => petaSemuaBoards(ws, boardId, (b:any) => ({ ...b, isOpen: nilai })));
  };

  // === REORDER + INSERT-BELOW + RENAME KOLOM (cloud-aware) ===
  const updateColumnLabel = (colId: string, label: string) => {
    tandaiTulisSendiri();
    if (columns.some((c:any) => c.id === colId)) setColumns(columns.map((c:any) => c.id === colId ? { ...c, label } : c));
    else setSubColumns(subColumns.map((c:any) => c.id === colId ? { ...c, label } : c));
    if (cloudOn()) dbUpdateColumnLabel(supabase, colId, label).catch((e:any) => pushToast('Gagal rename kolom di cloud: ' + (e?.message || e)));
  };
  /**
   * Pindah urutan kolom. Melayani kolom UTAMA maupun kolom SUB.
   *
   * Sebelumnya fungsi ini hanya melihat `columns`, jadi kolom sub-item tidak
   * bisa digeser sama sekali — `findIndex` selalu -1 lalu keluar diam-diam.
   *
   * Lingkupnya dijaga: kolom sub tidak bisa dijatuhkan ke barisan kolom
   * utama (dan sebaliknya). Tanpa penjagaan itu, satu kolom bisa berpindah
   * tabel dan datanya kehilangan tempat.
   */
  const reorderColumns = (fromId: string, toId: string) => {
    if (!fromId || fromId === toId) return;

    const diUtama = columns.some((c: any) => c.id === fromId);
    const sumber = diUtama ? columns : subColumns;
    if (!sumber.some((c: any) => c.id === fromId)) return;
    if (!sumber.some((c: any) => c.id === toId)) return;   // beda lingkup → abaikan

    const arr = [...sumber];
    const fromIdx = arr.findIndex((c:any) => c.id === fromId);
    const toIdx = arr.findIndex((c:any) => c.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = arr.splice(fromIdx, 1); arr.splice(toIdx, 0, moved);

    tandaiTulisSendiri();
    if (diUtama) setColumns(arr); else setSubColumns(arr);
    if (cloudOn()) dbReindexColumns(supabase, arr.map((c:any) => c.id)).catch((e:any) => pushToast('Gagal simpan urutan kolom: ' + (e?.message || e)));
  };
  const reorderGroups = (fromId: string, toId: string) => {
    tandaiTulisSendiri();
    if (!fromId || fromId === toId) return;
    const arr = [...boardData];
    const fromIdx = arr.findIndex((g:any) => g.id === fromId);
    const toIdx = arr.findIndex((g:any) => g.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = arr.splice(fromIdx, 1); arr.splice(toIdx, 0, moved);
    setBoardData(arr);
    if (cloudOn()) dbReindexGroups(supabase, arr.map((g:any) => g.id)).catch((e:any) => pushToast('Gagal simpan urutan grup: ' + (e?.message || e)));
  };
  const moveItem = (dgId: string, diId: string, tgId: string, tiId: string) => {
    tandaiTulisSendiri();
    if (!diId || (dgId === tgId && diId === tiId)) return;
    const newData = [...boardData];
    const sGIdx = newData.findIndex((g:any) => g.id === dgId), tGIdx = newData.findIndex((g:any) => g.id === tgId);
    if (sGIdx < 0 || tGIdx < 0) return;
    const sItems = [...newData[sGIdx].items];
    const mi = sItems.findIndex((i:any) => i.id === diId); if (mi < 0) return;
    const [moved] = sItems.splice(mi, 1);
    if (sGIdx === tGIdx) {
      const ti = sItems.findIndex((i:any) => i.id === tiId);
      sItems.splice(ti < 0 ? sItems.length : ti, 0, moved);
      newData[sGIdx] = { ...newData[sGIdx], items: sItems };
      setBoardData(newData);
      if (cloudOn()) dbReindexItems(supabase, sItems.map((it:any, idx:number) => ({ id: it.id, position: idx }))).catch((e:any) => pushToast('Gagal simpan urutan item: ' + (e?.message || e)));
    } else {
      const tItems = [...newData[tGIdx].items];
      const ti = tItems.findIndex((i:any) => i.id === tiId);
      tItems.splice(ti < 0 ? tItems.length : ti, 0, moved);
      newData[sGIdx] = { ...newData[sGIdx], items: sItems };
      newData[tGIdx] = { ...newData[tGIdx], items: tItems };
      setBoardData(newData);
      if (cloudOn()) {
        (async () => {
          await dbReindexItems(supabase, sItems.map((it:any, idx:number) => ({ id: it.id, position: idx })));
          await dbReindexItems(supabase, tItems.map((it:any, idx:number) => ({ id: it.id, position: idx, groupId: it.id === moved.id ? tgId : undefined })));
          // Subitem (brief) dari item yang dipindah HARUS ikut pindah grup — kalau
          // tidak, mereka jadi yatim (induk di grup baru, subitem di grup lama) dan
          // hilang dari tampilan setelah reload.
          const subIds = (moved.subItems || []).map((s: any) => s.id);
          if (subIds.length) await dbMoveItemsGroup(supabase, subIds, tgId);
        })().catch((e:any) => pushToast('Gagal simpan pindah item: ' + (e?.message || e)));
      }
    }
  };
  const insertItemBelow = (gId: string, afterItemId: string) => {
    tandaiTulisSendiri();
    const id = newId();
    const grp = boardData.find((g:any) => g.id === gId); if (!grp) return;
    const items = [...grp.items];
    const idx = items.findIndex((i:any) => i.id === afterItemId);
    const at = idx < 0 ? items.length : idx + 1;
    items.splice(at, 0, { id, name: 'New item', isSubItemsOpen: false, subItems: [] });
    setBoardData(boardData.map((g:any) => g.id === gId ? { ...g, items } : g));
    if (cloudOn()) {
      (async () => {
        await dbAddItem(supabase, { id, groupId: gId, name: 'New item', position: at });
        await dbReindexItems(supabase, items.map((it:any, i:number) => ({ id: it.id, position: i })));
      })().catch((e:any) => pushToast('Gagal sisip item di cloud: ' + (e?.message || e)));
    }
  };
  const insertSubBelow = (gId: string, itemId: string, afterSubId: string) => {
    tandaiTulisSendiri();
    const id = newId();
    const grp = boardData.find((g:any) => g.id === gId); if (!grp) return;
    const parent = grp.items.find((i:any) => i.id === itemId); if (!parent) return;
    const subs = [...(parent.subItems || [])];
    const idx = subs.findIndex((s:any) => s.id === afterSubId);
    const at = idx < 0 ? subs.length : idx + 1;
    subs.splice(at, 0, { id, name: 'New sub-item' });
    setBoardData(boardData.map((g:any) => g.id !== gId ? g : { ...g, items: g.items.map((i:any) => i.id === itemId ? { ...i, subItems: subs } : i) }));
    if (cloudOn()) {
      (async () => {
        await dbAddSubItem(supabase, { id, groupId: gId, parentItemId: itemId, name: 'New sub-item', position: at });
        await dbReindexItems(supabase, subs.map((s:any, i:number) => ({ id: s.id, position: i })));
      })().catch((e:any) => pushToast('Gagal sisip sub-item di cloud: ' + (e?.message || e)));
    }
  };
  // Ubah STATUS banyak item/subitem sekaligus (pilih beberapa baris berstatus
  // sama → set ke status baru dalam satu klik). columnId = kolom bertipe status.
  const handleBulkSetStatus = (ids: string[], columnId: string, value: any) => {
    if (!ids.length || !columnId) return;
    const idSet = new Set(ids);
    setBoardData(boardData.map((g:any) => ({
      ...g,
      items: (g.items || []).map((it:any) => {
        const base = idSet.has(it.id) ? { ...it, [columnId]: value } : it;
        const subItems = (it.subItems || []).map((s:any) => idSet.has(s.id) ? { ...s, [columnId]: value } : s);
        return { ...base, subItems };
      }),
    })));
    pushToast(`Status ${ids.length} item diperbarui`);
    if (cloudOn()) {
      (async () => { for (const id of ids) await dbSetCellValue(supabase, id, columnId, 'status', value); })()
        .catch((e:any) => pushToast('Gagal ubah status di cloud: ' + (e?.message || e)));
    }
  };

  // Kolom SUB-ITEM yang "sejenis" dengan kolom utama: label sama (abaikan
  // besar-kecil/spasi tepi) DAN tipe sama. Dipakai cascade ubah massal.
  const normLabel = (s: any) => String(s || '').trim().toUpperCase();
  const kolomSubSerupa = (col: any) => {
    if (!col?.id || !normLabel(col.label)) return null;
    return (subColumns || []).find((c: any) => normLabel(c.label) === normLabel(col.label) && c.type === col.type) || null;
  };

  // Simpan SATU nilai ke banyak item sekaligus — hasil setara dbSetCellValue per item.
  // Nilai biasa: 1 kueri per 100 item. Penugasan (tim): per item, 5 berjalan bersamaan.
  const kosongNilai = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  const simpanMassal = async (ids: string[], colId: string, type: string, val: any) => {
    if (type === 'team') {
      // Penugasan tetap per item (hapus+sisip per item, seperti edit satu sel) agar
      // kegagalan tak pernah mengosongkan PIC banyak item sekaligus — dijalankan
      // 5 sekaligus supaya tetap cepat.
      for (let i = 0; i < ids.length; i += 5) {
        tandaiTulisSendiri();
        await Promise.all(ids.slice(i, i + 5).map((id) => dbSetCellValue(supabase, id, colId, type, val)));
      }
      return;
    }
    for (let i = 0; i < ids.length; i += 100) {
      const p = ids.slice(i, i + 100);
      tandaiTulisSendiri();
      if (kosongNilai(val)) {
        const del = await supabase.from('item_values').delete().in('item_id', p).eq('column_id', colId);
        if (del.error) throw new Error(del.error.message);
      } else {
        const up = await supabase.from('item_values').upsert(p.map((id) => ({ item_id: id, column_id: colId, value: val })), { onConflict: 'item_id,column_id' });
        // Cadangan (mis. UNIQUE belum terpasang): simpan satu per satu seperti dulu.
        if (up.error) { for (const id of p) { tandaiTulisSendiri(); await dbSetCellValue(supabase, id, colId, type, val); } }
      }
    }
  };

  // Ubah massal SUB-ITEM yang tercentang (klik sel sub-item pada salah satu baris
  // tercentang → nilai berlaku ke semua sub-item tercentang di papan ini).
  const setMassalSubItem = (ids: string[], col: any, value: any) => {
    tandaiTulisSendiri();
    const idSet = new Set(ids);
    const idSub: string[] = [];
    setBoardData(boardData.map((g:any) => ({
      ...g,
      items: (g.items || []).map((it:any) => {
        const subs = it.subItems || [];
        if (!subs.some((s:any) => idSet.has(s.id))) return it;
        return { ...it, subItems: subs.map((s:any) => { if (!idSet.has(s.id)) return s; idSub.push(s.id); return { ...s, [col.id]: value }; }) };
      }),
    })));
    if (!idSub.length) return;
    idSub.forEach((id) => pemuat.tandaiEdit(id, col.id));
    pushToast(`${col.label || 'Nilai'} diperbarui untuk ${idSub.length} sub-item`);
    if (cloudOn()) {
      (async () => { await simpanMassal(idSub, col.id, col.type, value); tandaiTulisSendiri(); })()
        .catch((e:any) => pushToast('Gagal ubah massal di cloud: ' + (e?.message || e)));
    }
  };

  // Jumlah baris tercentang di papan aktif, dipisah item utama & sub-item (untuk banner massal).
  const jumlahTerpilih = (() => {
    const hasil = { utama: 0, sub: 0 };
    if (!selectedItems.length) return hasil;
    const s = new Set(selectedItems);
    for (const g of boardData) for (const it of (g.items || [])) {
      if (s.has(it.id)) hasil.utama++;
      for (const x of (it.subItems || [])) if (s.has(x.id)) hasil.sub++;
    }
    return hasil;
  })();

  // Set nilai SATU kolom untuk banyak item sekaligus (Monday-style in-place).
  // Memakai col.type asli → benar untuk tiap tipe (status/tags→item_values,
  // team→item_assignees, timeline→item_values). Tandai tulis-sendiri (termasuk
  // SELAMA proses) agar gema realtime tak memicu reload papan di tengah jalan.
  // CASCADE: bila sub-item punya kolom sejenis (label & tipe sama), SEMUA sub-item
  // dari item terpilih ikut diubah.
  const handleBulkSetField = (ids: string[], col: any, value: any, lingkup: 'main' | 'sub' = 'main') => {
    if (!ids?.length || !col?.id) return;
    if (lingkup === 'sub') { setMassalSubItem(ids, col, value); return; }
    tandaiTulisSendiri();
    const idSet = new Set(ids);
    const subCol = kolomSubSerupa(col);
    const idUtama: string[] = [];
    const idSub: string[] = [];
    setBoardData(boardData.map((g:any) => ({
      ...g,
      items: (g.items || []).map((it:any) => {
        if (!idSet.has(it.id)) return it;
        idUtama.push(it.id);
        const baru: any = { ...it, [col.id]: value };
        if (subCol && (it.subItems || []).length) {
          baru.subItems = it.subItems.map((s:any) => { idSub.push(s.id); return { ...s, [subCol.id]: value }; });
        }
        return baru;
      }),
    })));
    if (!idUtama.length) return;
    idUtama.forEach((id) => pemuat.tandaiEdit(id, col.id));
    if (subCol) idSub.forEach((id) => pemuat.tandaiEdit(id, subCol.id));

    // Label status/tags yang belum ada di kolom sub → tambahkan (warna sama) agar pill sub-item tampil benar.
    if (subCol && idSub.length && (col.type === 'status' || col.type === 'tags')) {
      const teks = (Array.isArray(value) ? value : [value]).filter((t: any) => typeof t === 'string' && t);
      const adaTeks = new Set((labels[subCol.id] || []).map((l: any) => l.text));
      for (const t of teks) {
        if (adaTeks.has(t)) continue;
        adaTeks.add(t);
        addLabelOption(subCol.id, t, (labels[col.id] || []).find((l: any) => l.text === t)?.color);
      }
    }

    pushToast(`${col.label || 'Nilai'} diperbarui untuk ${idUtama.length} item${idSub.length ? ` + ${idSub.length} sub-item` : ''}`);
    if (cloudOn()) {
      (async () => {
        await simpanMassal(idUtama, col.id, col.type, value);
        if (subCol && idSub.length) await simpanMassal(idSub, subCol.id, subCol.type, value);
        tandaiTulisSendiri();
      })().catch((e:any) => pushToast('Gagal ubah massal di cloud: ' + (e?.message || e)));
    }
  };

  const handleBulkDelete = (idsMasuk: string[]) => {
    // Hanya item/sub-item yang memang ada di board yang sedang dibuka.
    const diBoard = new Set<string>();
    boardData.forEach((g:any) => (g.items || []).forEach((i:any) => { diBoard.add(i.id); (i.subItems || []).forEach((s:any) => diBoard.add(s.id)); }));
    const ids = (idsMasuk || []).filter((id) => diBoard.has(id));
    if (!ids.length) { setSelectedItems([]); return; }
    tandaiTulisSendiri();
    setBoardData(boardData.map((g:any) => ({ ...g, items: g.items.filter((i:any) => !ids.includes(i.id)).map((i:any) => ({ ...i, subItems: i.subItems?.filter((s:any) => !ids.includes(s.id)) || [] })) })));
    setSelectedItems([]);
    pushToast(`${ids.length} item dihapus`);
    // Hapus di cloud SEKETIKA (sebelumnya terlewat → item kembali saat refresh)
    if (cloudOn()) {
      (async () => { for (const id of ids) await dbDeleteItem(supabase, id); })()
        .catch((e:any) => pushToast('Gagal hapus di cloud: ' + (e?.message || e)));
    }
  };

  const handleBulkDuplicate = (ids: string[]) => {
    tandaiTulisSendiri();
    if (!ids.length) return;
    const idSet = new Set(ids);
    const clones: { clone: any; groupId: string }[] = [];
    const newGroups = boardData.map((g:any) => {
      const items: any[] = [];
      (g.items || []).forEach((it:any) => {
        items.push(it);
        if (idSet.has(it.id)) {
          const clone = { ...it, id: newId(), name: `${it.name} (Copy)`, subItems: (it.subItems || []).map((s:any) => ({ ...s, id: newId() })) };
          items.push(clone);
          clones.push({ clone, groupId: g.id });
        }
      });
      return { ...g, items };
    });
    setBoardData(newGroups);
    setSelectedItems([]);
    if (!clones.length) return;
    pushToast(`${clones.length} item diduplikat`);

    if (cloudOn()) {
      (async () => {
        tandaiTulisSendiri();
        // CEPAT: kumpulkan semua baris lalu INSERT per-tabel sekali jalan (batch),
        // bukan ~90 round-trip berurutan per item+subitem. Ini yang dulu bikin
        // duplikat item ber-subitem makan 20-30 detik & sempat tampil data parsial.
        const kosong = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
        const itemRows: any[] = [];      // induk (tabel items)
        const subRows: any[] = [];       // sub-item (items dgn parent_item_id)
        const valueRows: any[] = [];     // item_values
        const assigneeRows: any[] = [];  // item_assignees (People)
        const metaCalls: Promise<any>[] = [];

        const tampungNilai = (ownerId: string, kolom: any[], src: any) => {
          for (const col of (kolom || [])) {
            const val = src[col.id];
            if (kosong(val)) continue;
            if (col.type === 'team') {
              for (const mid of (Array.isArray(val) ? val : [val])) if (mid) assigneeRows.push({ item_id: ownerId, column_id: col.id, member_id: mid });
            } else {
              valueRows.push({ item_id: ownerId, column_id: col.id, value: val });
            }
          }
        };

        for (const { clone, groupId } of clones) {
          const grp = newGroups.find((g:any) => g.id === groupId);
          const pos = grp.items.findIndex((i:any) => i.id === clone.id);
          // is_subitems_open mengikuti salinan di layar (dulu selalu false → setelah muat ulang
          // salinan tiba-tiba terlipat, berbeda dari yang tampil saat diduplikat).
          itemRows.push({ id: clone.id, group_id: groupId, name: clone.name, position: pos, is_subitems_open: !!clone.isSubItemsOpen });
          if (clone.description) metaCalls.push(dbSetItemMeta(supabase, clone.id, { description: clone.description }));
          tampungNilai(clone.id, columns, clone);
          const subs = clone.subItems || [];
          for (let si = 0; si < subs.length; si++) {
            const sub = subs[si];
            // description = brief sub-item; dulu tak ikut tersimpan → hilang setelah muat ulang
            subRows.push({ id: sub.id, group_id: groupId, parent_item_id: clone.id, name: sub.name, position: si, ...(sub.description ? { description: sub.description } : {}) });
            tampungNilai(sub.id, subColumns, sub);
          }
        }

        // Urutan antar-tabel demi FK (induk → sub → nilai → penugasan); tiap tabel 1 query.
        if (itemRows.length) { const { error } = await supabase.from('items').insert(itemRows); if (error) throw new Error(error.message); }
        if (subRows.length) { const { error } = await supabase.from('items').insert(subRows); if (error) throw new Error(error.message); }
        if (valueRows.length) { const { error } = await supabase.from('item_values').upsert(valueRows, { onConflict: 'item_id,column_id' }); if (error) throw new Error(error.message); }
        if (assigneeRows.length) { const { error } = await supabase.from('item_assignees').insert(assigneeRows); if (error) throw new Error(error.message); }
        await Promise.all(metaCalls);

        // Reindex grup terdampak PARALEL (bukan satu-satu) → tetap cepat.
        const affected = Array.from(new Set(clones.map((c) => c.groupId)));
        await Promise.all(affected.flatMap((gid) => {
          const grp = newGroups.find((g:any) => g.id === gid);
          return grp ? grp.items.map((i:any, idx:number) => supabase.from('items').update({ position: idx }).eq('id', i.id)) : [];
        }));
        tandaiTulisSendiri();
      })().catch((e:any) => pushToast('Gagal duplikat di cloud: ' + (e?.message || e)));
    }
  };

  /**
   * Duplikat satu GRUP beserta seluruh isinya: item, sub-item, dan nilai
   * tiap sel — disisipkan tepat di bawah grup aslinya.
   *
   * Kolom TIDAK ikut diduplikat: `columns` dan `subColumns` milik PAPAN,
   * bukan milik grup, jadi salinannya otomatis memakai kolom yang sama.
   * Menyalinnya justru akan menggandakan kolom di seluruh papan.
   */
  // Pindahkan grup ke board/sub-board lain, SEKALIGUS membawa nilai kolomnya.
  // Kolom dipetakan via LABEL + TIPE (dulu label saja → "Status" bertipe teks bisa
  // menerima nilai status). Kolom yang belum ada di board tujuan dibuat beserta
  // seluruh labelnya; kolom yang sudah ada ditambah label yang dipakai grup ini
  // tapi belum dikenal di sana (dulu tidak → pill status tampil tanpa warna).
  // Grup diletakkan di urutan TERAKHIR board tujuan (posisinya ikut disimpan).
  const moveGroupToBoard = (groupId: string, targetBoardId: string) => {
    if (!activeBoardId || !targetBoardId || targetBoardId === activeBoardId) return;
    const srcBoardId = activeBoardId;
    tandaiTulisSendiri();
    const src = boardsDataMap[srcBoardId];
    const tgt = boardsDataMap[targetBoardId];
    if (!src || !tgt) { pushToast('Board tujuan tak ditemukan.'); return; }
    const grup = (src.groups || []).find((g: any) => g.id === groupId);
    if (!grup) return;

    const kunci = (label: any, type: any) => `${String(label || '').trim().toUpperCase()}|${type || 'text'}`;
    const kolomBaru: any[] = [];
    const labelBaru: { columnId: string; id: string; text: string; color: string; position: number }[] = [];
    const jumlahLabel: Record<string, number> = {};
    const posLabel = (colId: string) => {
      if (!(colId in jumlahLabel)) jumlahLabel[colId] = (labels[colId] || []).length;
      return jumlahLabel[colId]++;
    };
    const setNilai: { itemId: string; colId: string; type: string; val: any }[] = [];

    const bangunPeta = (srcCols: any[], tgtCols: any[], scope: 'main' | 'sub') => {
      const peta: Record<string, { id: string; type: string; baru: boolean }> = {};
      const byKunci: Record<string, any> = {};
      (tgtCols || []).forEach((c: any) => { const k = kunci(c.label, c.type); if (!byKunci[k]) byKunci[k] = c; });
      let pos = (tgtCols || []).length;
      (srcCols || []).forEach((sc: any) => {
        const k = kunci(sc.label, sc.type);
        const match = byKunci[k];
        if (match) { peta[sc.id] = { id: match.id, type: match.type, baru: !!match._baru }; return; }
        const nid = newId();
        const kol = { id: nid, label: sc.label, type: sc.type || 'text', width: sc.width || '130px', _baru: true };
        kolomBaru.push({ ...kol, scope, position: pos++ });
        byKunci[k] = kol;
        peta[sc.id] = { id: nid, type: kol.type, baru: true };
        // Kolom baru membawa SEMUA label kolom asal (warna sama).
        for (const l of (labels[sc.id] || [])) labelBaru.push({ columnId: nid, id: newId(), text: l.text, color: l.color, position: posLabel(nid) });
      });
      return peta;
    };
    const petaMain = bangunPeta(src.columns || [], tgt.columns || [], 'main');
    const petaSub = bangunPeta(src.subColumns || [], tgt.subColumns || [], 'sub');

    // Kolom tujuan yang SUDAH ada: tambahkan label yang dipakai grup ini tapi belum dikenal.
    const pastikanLabel = (srcColId: string, tujuan: { id: string; type: string; baru: boolean }, v: any) => {
      if (tujuan.baru || (tujuan.type !== 'status' && tujuan.type !== 'tags')) return;
      const teks = (Array.isArray(v) ? v : [v]).filter((t: any) => typeof t === 'string' && t);
      for (const t of teks) {
        const sudah = (labels[tujuan.id] || []).some((l: any) => l.text === t) || labelBaru.some((l) => l.columnId === tujuan.id && l.text === t);
        if (sudah) continue;
        const warna = (labels[srcColId] || []).find((l: any) => l.text === t)?.color || LABEL_COLORS[0];
        labelBaru.push({ columnId: tujuan.id, id: newId(), text: t, color: warna, position: posLabel(tujuan.id) });
      }
    };

    const kosongV = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    const remapSub = (sub: any) => {
      const baru: any = { id: sub.id, name: sub.name, description: sub.description };
      Object.keys(petaSub).forEach((sid) => {
        const v = sub[sid];
        if (kosongV(v)) return;
        baru[petaSub[sid].id] = v;
        pastikanLabel(sid, petaSub[sid], v);
        setNilai.push({ itemId: sub.id, colId: petaSub[sid].id, type: petaSub[sid].type, val: v });
      });
      return baru;
    };
    const remapItem = (it: any) => {
      const baru: any = { id: it.id, name: it.name, isSubItemsOpen: it.isSubItemsOpen, description: it.description, subItems: (it.subItems || []).map(remapSub) };
      Object.keys(petaMain).forEach((sid) => {
        const v = it[sid];
        if (kosongV(v)) return;
        baru[petaMain[sid].id] = v;
        pastikanLabel(sid, petaMain[sid], v);
        setNilai.push({ itemId: it.id, colId: petaMain[sid].id, type: petaMain[sid].type, val: v });
      });
      return baru;
    };
    const grupBaru = { ...grup, items: (grup.items || []).map(remapItem) };
    // Sesudah grup terakhir board tujuan. Posisi di database bisa berselang
    // (mis. 0,2,5 setelah ada yang dihapus) → pakai yang terbesar, bukan jumlah grup.
    const posisiTujuan = Math.max(-1, ...(tgt.groups || []).map((g: any, i: number) => {
      const p = posServerRef.current[g.id];
      return typeof p === 'number' ? Math.max(p, i) : i;
    })) + 1;
    posServerRef.current[groupId] = posisiTujuan;
    // Sel hasil pemetaan masih dalam perjalanan ke cloud → jangan tertimpa muat papan tujuan.
    setNilai.forEach((v) => pemuat.tandaiEdit(v.itemId, v.colId));

    setBoardsDataMap((prev: any) => {
      const s0 = prev[srcBoardId], t0 = prev[targetBoardId];
      if (!s0 || !t0) return prev;
      const tCols = [...(t0.columns || [])];
      const tSub = [...(t0.subColumns || [])];
      kolomBaru.forEach((k) => { const c = { id: k.id, label: k.label, type: k.type, width: k.width }; if (k.scope === 'sub') tSub.push(c); else tCols.push(c); });
      return {
        ...prev,
        [srcBoardId]: { ...s0, groups: (s0.groups || []).filter((g: any) => g.id !== groupId) },
        [targetBoardId]: { ...t0, columns: tCols, subColumns: tSub, groups: [...(t0.groups || []).filter((g: any) => g.id !== groupId), grupBaru] },
      };
    });
    if (labelBaru.length) {
      setLabels((prev: any) => {
        const n = { ...prev };
        for (const l of labelBaru) n[l.columnId] = [...(n[l.columnId] || []), { id: l.id, text: l.text, color: l.color }];
        return n;
      });
    }

    if (cloudOn()) {
      (async () => {
        try {
          for (const k of kolomBaru) await dbAddColumn(supabase, { id: k.id, boardId: targetBoardId, scope: k.scope, label: k.label, type: k.type, width: k.width, position: k.position });
          for (const l of labelBaru) await dbAddLabel(supabase, { id: l.id, columnId: l.columnId, text: l.text, color: l.color, position: l.position });
          tandaiTulisSendiri();
          await dbMoveGroup(supabase, groupId, targetBoardId, posisiTujuan);
          for (const v of setNilai) await dbSetCellValue(supabase, v.itemId, v.colId, v.type, v.val);
          // Urutan grup yang tersisa di board asal dirapikan (tanpa celah) — dibaca
          // dari layar SAAT INI (bisa sudah berubah selama proses berjalan).
          const sisa = (petaRef.current[srcBoardId]?.groups || []).filter((g: any) => g.id !== groupId).map((g: any) => g.id);
          if (sisa.length) await dbReindexGroups(supabase, sisa);
          tandaiTulisSendiri();
        } catch (e: any) { pushToast('Gagal pindah grup di cloud: ' + (e?.message || e)); }
      })();
    }
  };

  const duplicateGroup = (gId: string) => {
    const asli = boardData.find((g:any) => g.id === gId);
    if (!asli) return;

    const idBaru = newId();
    const items = (asli.items || []).map((it:any) => ({
      ...it,
      id: newId(),
      subItems: (it.subItems || []).map((s:any) => ({ ...s, id: newId() })),
    }));
    const salinan = { ...asli, id: idBaru, title: `${asli.title} (Copy)`, isCollapsed: false, items };

    const idx = boardData.findIndex((g:any) => g.id === gId);
    const arr = [...boardData];
    arr.splice(idx + 1, 0, salinan);

    tandaiTulisSendiri();
    setBoardData(arr);
    pushToast(`Grup "${asli.title}" diduplikat`);

    if (cloudOn() && activeBoardId) {
      (async () => {
        await dbAddGroup(supabase, { id: idBaru, boardId: activeBoardId, title: salinan.title, color: salinan.color, position: idx + 1 });
        // Label "Item Name"/"Subitem" tidak ikut di dbAddGroup, jadi disusulkan.
        await dbUpdateGroup(supabase, idBaru, { itemLabel: asli.itemLabel, subItemLabel: asli.subItemLabel });

        for (let ii = 0; ii < items.length; ii++) {
          const it = items[ii];
          await dbAddItem(supabase, { id: it.id, groupId: idBaru, name: it.name, position: ii });
          // Brief & status buka sub-item disamakan dengan salinan di layar.
          const meta: any = {};
          if (it.description) meta.description = it.description;
          if (it.isSubItemsOpen) meta.is_subitems_open = true;
          if (Object.keys(meta).length) await dbSetItemMeta(supabase, it.id, meta);

          for (const col of columns) {
            const val = it[col.id];
            if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) continue;
            await dbSetCellValue(supabase, it.id, col.id, col.type, val);
          }

          const anakList = it.subItems || [];
          for (let ai = 0; ai < anakList.length; ai++) {
            const anak = anakList[ai];
            await dbAddSubItem(supabase, { id: anak.id, groupId: idBaru, parentItemId: it.id, name: anak.name, position: ai });
            if (anak.description) await dbSetItemMeta(supabase, anak.id, { description: anak.description });
            for (const col of subColumns) {
              const val = anak[col.id];
              if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) continue;
              await dbSetCellValue(supabase, anak.id, col.id, col.type, val);
            }
          }
        }

        await dbReindexGroups(supabase, arr.map((g:any) => g.id));
      })().catch((e:any) => pushToast('Gagal duplikat grup di cloud: ' + (e?.message || e)));
    }
  };

  // === VIEW INSTANCES (multi-view ala Monday) ===
  // View & kolom tersembunyi tiap papan disimpan ke tabel board_views (bila
  // tabelnya ada) supaya tidak hilang saat dimuat ulang dan sama bagi seluruh tim.
  // Hanya manager yang menyimpan; papan yang view-nya belum pernah tersimpan
  // (`viewsDariDb` belum true) disimpan LENGKAP pada perubahan pertamanya.
  const viewsBolehSimpan = () => cloudOn() && viewsTersedia && currentUserRole === 'manager';
  const aturViews = (bid: string, daftar: any[]) => {
    viewsUbahRef.current.set(bid, Date.now());
    setBoardsDataMap((p: any) => (p[bid] ? { ...p, [bid]: { ...p[bid], views: daftar } } : p));
  };
  // Simpanan view sebuah papan dijalankan BERURUTAN (antrean per papan) supaya
  // klik cepat beruntun tidak saling mendahului di server.
  const simpanViews = (bid: string, kerja: () => Promise<void>) => {
    if (!viewsBolehSimpan()) return;
    const sibuk = viewsSibukRef.current;
    const antrean = antreanViewsRef.current;
    sibuk.set(bid, (sibuk.get(bid) || 0) + 1);
    const jalan = (antrean.get(bid) || Promise.resolve()).then(() => kerja());
    const ekor = jalan.catch(() => {});
    antrean.set(bid, ekor);
    jalan
      .then(() => setBoardsDataMap((p: any) => (p[bid] && !p[bid].viewsDariDb ? { ...p, [bid]: { ...p[bid], viewsDariDb: true } } : p)))
      .catch((e: any) => pushToast('Gagal simpan view: ' + (e?.message || e)))
      .finally(() => {
        viewsUbahRef.current.set(bid, Date.now());
        if (antrean.get(bid) === ekor) antrean.delete(bid);
        const n = (sibuk.get(bid) || 1) - 1;
        if (n > 0) { sibuk.set(bid, n); return; }
        sibuk.delete(bid);
        // Perubahan rekan yang tadi dilewati karena papan ini sedang disimpan → muat sekarang.
        if (viewsTerlewatRef.current.delete(bid)) segarkanViewsRef.current?.();
      });
  };
  // Papan yang view-nya belum pernah tersimpan → simpan LENGKAP; selain itu cukup sebagian.
  const posisiView = (daftar: any[], id: string) => Math.max(0, daftar.findIndex((v: any) => v.id === id));
  const idViewBaru = (awalan: string) => `view-${awalan}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const setHiddenColumns = (updater: any) => {
    if (!activeBoardId) return;
    const bid = activeBoardId;
    const bd = boardsDataMap[bid];
    if (!bd || !bd.views || !bd.views.length) return;
    const v = bd.views.find((x: any) => x.id === activeViewId) || bd.views[0];
    if (!v) return;
    const lama = v.config?.hiddenColumns || [];
    const isi = typeof updater === 'function' ? updater(lama) : updater;
    const vBaru = { ...v, config: { ...(v.config || {}), hiddenColumns: Array.isArray(isi) ? isi : [] } };
    const daftar = bd.views.map((x: any) => (x.id === v.id ? vBaru : x));
    aturViews(bid, daftar);
    // Hanya config view ini yang ditulis (nama/urutan buatan rekan tak tertimpa).
    simpanViews(bid, () => (bd.viewsDariDb
      ? dbUbahView(supabase, bid, v.id, { config: vBaru.config }, { view: vBaru, position: posisiView(daftar, v.id) })
      : dbSimpanViews(supabase, bid, daftar)));
  };
  const addView = (type: string, name?: string) => {
    if (!activeBoardId) return;
    const bid = activeBoardId;
    const bd = boardsDataMap[bid]; if (!bd) return;
    const id = idViewBaru(type);
    const labelMap: any = { table: 'Table', kanban: 'Kanban', chart: 'Chart', gantt: 'Gantt', calendar: 'Calendar', workload: 'Workload' };
    const finalName = name || labelMap[type] || 'View';
    const daftar = [...(bd.views || []), { id, type, name: finalName, config: { hiddenColumns: [] } }];
    aturViews(bid, daftar);
    setActiveViewId(id);
    simpanViews(bid, () => dbSimpanViews(supabase, bid, daftar, bd.viewsDariDb ? [id] : undefined));
  };
  const renameView = (id: string, name: string) => {
    if (!activeBoardId) return;
    const bid = activeBoardId;
    const bd = boardsDataMap[bid]; if (!bd) return;
    const daftar = (bd.views || []).map((v:any) => v.id === id ? { ...v, name } : v);
    aturViews(bid, daftar);
    const vBaru = daftar.find((v: any) => v.id === id);
    if (!vBaru) return;
    simpanViews(bid, () => (bd.viewsDariDb
      ? dbUbahView(supabase, bid, id, { name }, { view: vBaru, position: posisiView(daftar, id) })
      : dbSimpanViews(supabase, bid, daftar)));
  };
  const deleteView = (id: string) => {
    if (!activeBoardId) return;
    const bid = activeBoardId;
    const bd = boardsDataMap[bid];
    if (!bd || (bd.views || []).length <= 1) return; // jangan hapus view terakhir
    const idx = bd.views.findIndex((v:any) => v.id === id);
    if (idx < 0) return;
    const terhapus = bd.views[idx];
    const remaining = bd.views.filter((v:any) => v.id !== id);
    aturViews(bid, remaining);
    if (activeViewId === id) setActiveViewId(remaining[0]?.id || '');
    simpanViews(bid, () => (bd.viewsDariDb ? dbHapusView(supabase, bid, id) : dbSimpanViews(supabase, bid, remaining)));
    // Urungkan: kembalikan HANYA view itu ke posisinya (dulu seluruh papan
    // dikembalikan ke salinan lama, sehingga perubahan lain ikut hilang).
    pushToast('View dihapus', () => {
      const kini = petaRef.current[bid];
      if (!kini || (kini.views || []).some((v: any) => v.id === terhapus.id)) return;
      const arr = [...(kini.views || [])];
      arr.splice(Math.min(idx, arr.length), 0, terhapus);
      aturViews(bid, arr);
      simpanViews(bid, async () => {
        if (!kini.viewsDariDb) { await dbSimpanViews(supabase, bid, arr); return; }
        await dbSimpanViews(supabase, bid, arr, [terhapus.id]);
        await dbUrutViews(supabase, bid, arr.map((v: any) => v.id));
      });
    });
  };
  const duplicateView = (id: string) => {
    if (!activeBoardId) return;
    const bid = activeBoardId;
    const bd = boardsDataMap[bid]; if (!bd) return;
    const src = (bd.views || []).find((v:any) => v.id === id); if (!src) return;
    const newId = idViewBaru('dup');
    const idx = bd.views.findIndex((v:any) => v.id === id);
    const copy = { ...src, id: newId, name: `${src.name} (Copy)`, config: { ...(src.config || {}), hiddenColumns: [...(src.config?.hiddenColumns || [])] } };
    const daftar = [...bd.views]; daftar.splice(idx + 1, 0, copy);
    aturViews(bid, daftar);
    setActiveViewId(newId);
    // Sisipkan salinan saja, lalu rapikan urutan (isi view lain tidak ditimpa).
    simpanViews(bid, async () => {
      if (!bd.viewsDariDb) { await dbSimpanViews(supabase, bid, daftar); return; }
      await dbSimpanViews(supabase, bid, daftar, [newId]);
      await dbUrutViews(supabase, bid, daftar.map((v: any) => v.id));
    });
  };
  const reorderViews = (fromId: string, toId: string) => {
    if (!activeBoardId || !fromId || fromId === toId) return;
    const bid = activeBoardId;
    const bd = boardsDataMap[bid]; if (!bd) return;
    const arr = [...(bd.views || [])];
    const fi = arr.findIndex((v:any) => v.id === fromId);
    const ti = arr.findIndex((v:any) => v.id === toId);
    if (fi < 0 || ti < 0) return;
    const [m] = arr.splice(fi, 1); arr.splice(ti, 0, m);
    aturViews(bid, arr);
    simpanViews(bid, () => (bd.viewsDariDb ? dbUrutViews(supabase, bid, arr.map((v: any) => v.id)) : dbSimpanViews(supabase, bid, arr)));
  };

  const handleAddDynamicColumn = (target: 'main'|'sub', type: string, label: string) => {
    const colId = newId();
    const newCol = { id: colId, label, width: '130px', type };
    const position = target === 'main' ? columns.length : subColumns.length;
    if (target === 'main') setColumns([...columns, newCol]); else setSubColumns([...subColumns, newCol]);
    let opts: any[] = [];
    if (type === 'status') opts = [
      { id: newId(), text: 'Done', color: 'bg-[#00c875]' },
      { id: newId(), text: 'Working on it', color: 'bg-[#fdab3d]' },
      { id: newId(), text: 'Stuck', color: 'bg-[#e2445c]' },
    ];
    if (type === 'status' || type === 'tags') setLabels((prev:any) => ({ ...prev, [colId]: opts }));
    if (cloudOn() && activeBoardId) {
      dbAddColumn(supabase, { id: colId, boardId: activeBoardId, scope: target, label, type, width: '130px', position })
        .then(async () => { for (let i = 0; i < opts.length; i++) { await dbAddLabel(supabase, { id: opts[i].id, columnId: colId, text: opts[i].text, color: opts[i].color, position: i }); } })
        .catch((e:any) => pushToast('Gagal tambah kolom di cloud: ' + (e?.message || e)));
    }
  };

  const copyParentColumns = () => {
    // MENAMBAHKAN kolom induk yang belum ada di sub-item (label + tipe sama
    // dianggap sudah ada). Dulu kolom sub lama DIGANTI di layar tapi tetap ada
    // di database → setelah muat ulang kolom lama muncul lagi berdampingan.
    const kunci = (c: any) => `${String(c.label || '').trim().toLowerCase()}|${c.type}`;
    const sudahAda = new Set(subColumns.map(kunci));
    const sumber = columns.filter((c: any) => !sudahAda.has(kunci(c)));
    if (!sumber.length) { pushToast('Semua kolom induk sudah ada di sub-item'); return; }
    const idMap: Record<string, string> = {};
    const mapped = sumber.map((c:any) => { const nid = newId(); idMap[c.id] = nid; return { ...c, id: nid }; });
    const awal = subColumns.length;
    setSubColumns([...subColumns, ...mapped]);
    const newLabels = { ...labels };
    sumber.forEach((c:any) => { if (labels[c.id]) newLabels[idMap[c.id]] = labels[c.id].map((l:any) => ({ ...l, id: newId() })); });
    setLabels(newLabels);
    pushToast(`${mapped.length} kolom induk disalin ke sub-item`);
    if (cloudOn() && activeBoardId) {
      (async () => {
        for (let i = 0; i < mapped.length; i++) {
          const c = mapped[i];
          await dbAddColumn(supabase, { id: c.id, boardId: activeBoardId, scope: 'sub', label: c.label, type: c.type, width: c.width || '130px', position: awal + i });
          const lbls = newLabels[c.id] || [];
          for (let j = 0; j < lbls.length; j++) { await dbAddLabel(supabase, { id: lbls[j].id, columnId: c.id, text: lbls[j].text, color: lbls[j].color, position: j }); }
        }
      })().catch((e:any) => pushToast('Gagal salin kolom ke cloud: ' + (e?.message || e)));
    }
  };

  const handleExportCSV = () => {
    if (!activeBoardData) return;
    const cols = activeBoardData.columns || [];
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const formatCell = (col: any, raw: any) => {
      if (raw === undefined || raw === null) return '';
      if (col.type === 'timeline') return raw.start ? `${raw.start} - ${raw.end || ''}` : '';
      if (col.type === 'team' && Array.isArray(raw)) return raw.map((id: string) => teamMembers.find((m: any) => m.id === id)?.name || id).join('; ');
      if (Array.isArray(raw)) return raw.join('; ');
      if (typeof raw === 'object') return JSON.stringify(raw);
      return raw;
    };
    const header = ['Group', 'Item', ...cols.map((c: any) => c.label)];
    const rows = [header.map(esc).join(',')];
    (activeBoardData.groups || []).forEach((g: any) => {
      (g.items || []).forEach((it: any) => {
        const row = [g.title, it.name, ...cols.map((c: any) => formatCell(c, it[c.id]))];
        rows.push(row.map(esc).join(','));
      });
    });
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeBoardName || 'board'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doLogin = async () => {
    if (!supabase) return;
    setLoginBusy(true); setLoginMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
    if (error) setLoginMsg(error.message);
    else setLoginPassword('');
    setLoginBusy(false);
  };
  const doLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    bersihkanCacheTracker(); // buang cache agar tak terbawa ke akun berikutnya
    sesiRef.current++;       // hasil muat yang masih berjalan dibuang
    pemuat.reset();
    setStatusMuat(pemuat.status());
    setAuthUser(null); setIsLoaded(false); setLoadError(null);
  };

  const openDocEditor = (payload: any) => setDocEditorTarget(payload);
  const closeDocEditor = () => setDocEditorTarget(null);
  const saveDoc = (html: string) => {
    const t = docEditorTarget; if (!t) return;
    if (t.scope === 'sub') handleUpdateSubItem(t.groupId, t.itemId, t.subItemId, t.columnId, html);
    else handleUpdateItem(t.groupId, t.itemId, t.columnId, html);
  };

  const isManager = currentUserRole === 'manager';

  const ctx = {
    isLoaded, activeView, activeViewId, setActiveViewId, views, addView, renameView, deleteView, duplicateView, reorderViews,
    workspaces, setWorkspaces, activeWorkspaceId, setActiveWorkspaceId,
    activeBoardId, setActiveBoardId, activeBoardName, activeBoardPath, currentUserId, teamMembers, setTeamMembers, columns, setColumns,
    subColumns, setSubColumns, hiddenColumns, setHiddenColumns, labels, setLabels, boardsDataMap, setBoardsDataMap, boardData, setBoardData,
    updatesData, setUpdatesData, searchQuery, setSearchQuery, sortConfig, setSortConfig, selectedItems, setSelectedItems,
    inlineCreate, setInlineCreate, inputValue, setInputValue, updatePanelOpen, setUpdatePanelOpen,
    newUpdateText, setNewUpdateText, editingCell, setEditingCell, editValue, setEditValue, openDropdown, setOpenDropdown, 
    newLabelText, setNewLabelText, newMemberName, setNewMemberName, tempTimeline, setTempTimeline, isHideMenuOpen, 
    setIsHideMenuOpen, confirmModal, setConfirmModal, draggedItem, setDraggedItem, dragOverItem, setDragOverItem,
    dragOverColumn, setDragOverColumn, detailItem, setDetailItem,
    triggerConfirm, handleUpdateItem, handleUpdateSubItem, handleDeleteItem, handleDeleteSubItem,
    handleAddItem, handleAddSubItem, toggleGroupSelection, toggleAllSubItems,
    handleDeleteTeamMember, handleDeleteLabel, addLabelOption, updateLabelColor, handleDeleteColumn, handleDeleteSubColumn, handleAddDynamicColumn, copyParentColumns, handleExportCSV, handleAddGroup, updateGroup, handleDeleteGroup, duplicateGroup, moveGroupToBoard, addYear, addMonth, addBoard, toggleBoard, renameNode, deleteNode, updateColumnLabel, reorderColumns, reorderGroups, moveItem, insertItemBelow, insertSubBelow, handleBulkDelete, handleBulkDuplicate, handleBulkSetStatus, handleBulkSetField, accountTargets, setAccountTarget, hapusAccountTarget, pushToast, HEX_COLORS, LABEL_COLORS,
    authUser, doLogout, isManager, currentUserRole, canContentHub, canAcc, refreshData, openDocEditor, closeDocEditor, saveDoc, docEditorTarget, supabase,
    // Lazy-load sel (dipanggil komponen yang membutuhkan isi sel)
    muatSelBoard: pemuat.muatSelBoard, muatSelSaya, muatKolomLintas: pemuat.muatKolomLintas,
    pastikanItem: pemuat.pastikanItem, pastikanBoards: pemuat.pastikanBoards,
    papanSiap, sayaSiap, lintasSiap, galatMuat, statusMuat,
    kolomSubSerupa, jumlahTerpilih,
  };

  const gate = (() => {
    if (!supabase) return (<div className="min-h-screen w-full bg-kartu text-gray-300 flex items-center justify-center p-6 text-center text-sm">Konfigurasi Supabase belum ada. Pastikan <code className="mx-1 text-gray-100">.env.local</code> terisi lalu restart <code className="ml-1 text-gray-100">npm run dev</code>.</div>);
    if (!authChecked) return (<div className="min-h-screen w-full bg-kartu flex items-center justify-center"><LoadingLogo size={64} withRing text="Memeriksa sesi" /></div>);
    if (!authUser) return (
      <div className="min-h-screen w-full bg-kartu text-gray-100 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-kartu border border-white/10 rounded-2xl p-6 shadow-2xl">
          <h1 className="text-lg font-bold mb-1">Daily Work Tracker</h1>
          <p className="text-sm text-gray-500 mb-5">Masuk untuk mengakses board kamu.</p>
          <div className="flex flex-col gap-2">
            <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} type="email" placeholder="Email" className="bg-latar border border-white/10 focus:border-blue-500 rounded-lg px-3 py-2 text-sm outline-none transition-colors" />
            <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} type="password" placeholder="Password" className="bg-latar border border-white/10 focus:border-blue-500 rounded-lg px-3 py-2 text-sm outline-none transition-colors" />
            <button onClick={doLogin} disabled={loginBusy || !loginEmail || !loginPassword} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-4 py-2 text-sm font-semibold mt-1 transition-colors">{loginBusy ? 'Memproses…' : 'Masuk'}</button>
            {loginMsg && <div className="text-sm text-red-400 mt-1">{loginMsg}</div>}
          </div>
        </div>
      </div>
    );
    if (loadError) return (<div className="min-h-screen w-full bg-kartu text-red-300 flex items-center justify-center p-6 text-center text-sm">Gagal memuat data: {loadError}</div>);
    if (!isLoaded) return (<div className="min-h-screen w-full bg-kartu flex items-center justify-center"><LoadingLogo size={64} withRing text="Memuat data" /></div>);
    return null;
  })();

  // Gerbang versi ringkas untuk mode embedded (di dalam HRIS): tanpa full-screen & tanpa form login
  const embeddedGate = (() => {
    if (!authChecked) return <div className="min-h-[70vh] flex items-center justify-center"><LoadingLogo size={64} withRing text="Memeriksa sesi" /></div>;
    if (!authUser) return <div className="py-16 text-center text-sm text-gray-500">Sesi tidak ditemukan. Silakan masuk lewat portal HRIS.</div>;
    if (loadError) return <div className="py-16 text-center text-sm text-red-400">Gagal memuat data: {loadError}</div>;
    if (!isLoaded) return <div className="min-h-[70vh] flex items-center justify-center"><LoadingLogo size={64} withRing text="Memuat tugas" /></div>;
    return null;
  })();
  const active = embedded ? !embeddedGate : !gate;

  return (
    <DashboardContext.Provider value={ctx}>
      {embedded ? (embeddedGate ? embeddedGate : children) : (gate ? gate : (isManager ? children : <MemberView />))}
      {active && <DocEditor />}
      {active && <NotificationCenter />}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200">
          <div className="bg-kartu-hover border border-white/10 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><AlertCircle size={20} className="text-red-400" /> {confirmModal.title}</h3>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmModal(null)} className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={confirmModal.onConfirm} className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-md shadow-md transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* === TOAST CONTAINER === */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[120] flex flex-col gap-2 items-end">
          {toasts.map((t:any) => (
            <div key={t.id} className="bg-kartu border border-white/10 shadow-2xl rounded-lg pl-4 pr-3 py-3 flex items-center gap-3 min-w-[240px] max-w-[360px] dwt-row-in">
              <span className="text-sm text-gray-200 flex-1">{t.message}</span>
              {t.undo && <button onClick={() => { t.undo(); dismissToast(t.id); }} className="text-xs font-bold text-blue-400 hover:text-blue-300 shrink-0 uppercase tracking-wide">{t.actionLabel || 'Undo'}</button>}
              <button onClick={() => dismissToast(t.id)} className="text-gray-500 hover:text-white shrink-0"><X size={14}/></button>
            </div>
          ))}
        </div>
      )}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);