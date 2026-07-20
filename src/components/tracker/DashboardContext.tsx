'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { supabase as hrisSupabase } from '@/lib/supabase';
import { loadFullState } from '@/lib/tracker/load';
import MemberView from '@/components/tracker/MemberView';
import DocEditor from '@/components/tracker/DocEditor';
import NotificationCenter from '@/components/tracker/NotificationCenter';
import LoadingLogo from '@/components/LoadingLogo';
import { dbUpdateItemName, dbSetItemMeta, dbSetCellValue, newId, dbAddItem, dbAddSubItem, dbDeleteItem, dbAddColumn, dbDeleteColumn, dbAddLabel, dbDeleteLabel, dbUpdateLabelColor, dbAddGroup, dbUpdateGroup, dbDeleteGroup, dbAddTreeNode, dbRenameTreeNode, dbDeleteTreeNode, dbUpdateColumnLabel, dbReindexColumns, dbReindexGroups, dbReindexItems } from '@/lib/tracker/sync';

const LABEL_COLORS = ['bg-[#e2445c]', 'bg-[#579bfc]', 'bg-[#fdab3d]', 'bg-[#00c875]', 'bg-[#a25ddc]', 'bg-[#ff5ac4]', 'bg-[#9d99ff]', 'bg-emerald-500', 'bg-rose-400'];
const HEX_COLORS = ['#e2445c', '#579bfc', '#fdab3d', '#00c875', '#a25ddc', '#ff5ac4', '#9d99ff'];

// Set view default tiap board (Table, Kanban, Gantt, Chart) — sama seperti tab lama
export const makeDefaultViews = (seedHidden: string[] = []) => {
  const ts = Date.now();
  return [
    { id: `view-tbl-${ts}`, type: 'table', name: 'Main Table', config: { hiddenColumns: [...seedHidden] } },
    { id: `view-kan-${ts + 1}`, type: 'kanban', name: 'Kanban', config: {} },
    { id: `view-gan-${ts + 2}`, type: 'gantt', name: 'Timeline', config: {} },
    { id: `view-cht-${ts + 3}`, type: 'chart', name: 'Overview', config: {} },
  ];
};
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
  // "You" exists by default so updates/assignments have a valid author from the start.
  const [currentUserId, setCurrentUserId] = useState<string>('me');
  const [currentUserRole, setCurrentUserRole] = useState<string>('member');
  const [canContentHub, setCanContentHub] = useState<boolean>(true);
  const [docEditorTarget, setDocEditorTarget] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([{ id: 'me', name: 'You', color: 'bg-[#579bfc]', initials: 'Y' }]);
  const [labels, setLabels] = useState<any>({});

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
  
  const activeBoardData = activeBoardId ? boardsDataMap[activeBoardId] : null;
  const boardData = activeBoardData?.groups || [];
  const columns = activeBoardData?.columns || [];
  const subColumns = activeBoardData?.subColumns || [];

  // === MULTI-VIEW: daftar view & view aktif (per board) ===
  const views = activeBoardData?.views || [];
  const activeView = activeViewId === 'mytasks' ? null : (views.find((v:any) => v.id === activeViewId) || views[0] || null);

  // hiddenColumns kini PER-VIEW (disimpan di activeView.config); API tetap sama
  const hiddenColumns = activeView?.config?.hiddenColumns || [];
  const setHiddenColumns = (updater: any) => {
    if (!activeBoardId) return;
    setBoardsDataMap((p:any) => {
      const bd = p[activeBoardId]; if (!bd || !bd.views) return p;
      const vid = (bd.views.find((v:any) => v.id === activeViewId)?.id) || bd.views[0]?.id;
      if (!vid) return p;
      const newViews = bd.views.map((v:any) => v.id === vid
        ? { ...v, config: { ...(v.config || {}), hiddenColumns: typeof updater === 'function' ? updater(v.config?.hiddenColumns || []) : updater } }
        : v);
      return { ...p, [activeBoardId]: { ...bd, views: newViews } };
    });
  };

  const setBoardData = (newGroups: any[]) => { if(activeBoardId) setBoardsDataMap(p => ({ ...p, [activeBoardId]: { ...p[activeBoardId], groups: newGroups } })); };
  const setColumns = (newCols: any[]) => { if(activeBoardId) setBoardsDataMap(p => ({ ...p, [activeBoardId]: { ...p[activeBoardId], columns: newCols } })); };
  const setSubColumns = (newSubCols: any[]) => { if(activeBoardId) setBoardsDataMap(p => ({ ...p, [activeBoardId]: { ...p[activeBoardId], subColumns: newSubCols } })); };
  
  const [updatesData, setUpdatesData] = useState<Record<string, any[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc'|'desc' } | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
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
  const [detailItem, setDetailItem] = useState<any>(null);

  // === TOAST + UNDO ===
  const [toasts, setToasts] = useState<any[]>([]);
  const dismissToast = (id: string) => setToasts((t:any[]) => t.filter((x:any) => x.id !== id));
  const pushToast = (message: string, undo?: () => void, actionLabel?: string, duration = 6000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((t:any[]) => [...t, { id, message, undo, actionLabel }]);
    if (duration > 0) setTimeout(() => setToasts((t:any[]) => t.filter((x:any) => x.id !== id)), duration);
  };

  // === AUTH: cek sesi + ikuti perubahan login/logout ===
  useEffect(() => {
    if (!supabase) { setAuthChecked(true); return; }
    let active = true;
    supabase.auth.getUser()
      .then(({ data }: any) => { if (active) { setAuthUser(data.user || null); setAuthChecked(true); } })
      .catch(() => { if (active) setAuthChecked(true); }); // jaringan gagal → jangan tertahan di loading
    const { data: sub } = supabase.auth.onAuthStateChange((_e: any, session: any) => { setAuthUser(session?.user || null); });
    return () => { active = false; sub?.subscription?.unsubscribe?.(); };
  }, [supabase]);

  // === LOAD dari Supabase saat user tersedia (sekali) ===
  useEffect(() => {
    if (!supabase || !authUser || isLoaded) return;
    let active = true;
    (async () => {
      try {
        const s = await loadFullState(supabase);
        if (!active) return;
        setWorkspaces(s.workspaces);
        setBoardsDataMap(ensureViews(s.boardsDataMap));
        setLabels(s.labels);
        if (s.teamMembers.length) setTeamMembers(await mergeAvatars(supabase, s.teamMembers));
        if (s.currentUserId) setCurrentUserId(s.currentUserId);
        setCurrentUserRole(s.currentUserRole || 'member');
        setCanContentHub(s.canContentHub !== false);
        // Pulihkan board terakhir yang dibuka (kalau masih ada); jika tidak, board pertama.
        let saved: string | null = null;
        try { saved = localStorage.getItem('dwt_active_board'); } catch {}
        const boardIds = new Set<string>();
        for (const w of s.workspaces) for (const y of (w.years || [])) for (const m of (y.months || [])) for (const b of (m.boards || [])) boardIds.add(b.id);
        let firstBoard: string | null = null;
        for (const w of s.workspaces) {
          for (const y of (w.years || [])) {
            for (const m of (y.months || [])) { if (m.boards && m.boards[0]) { firstBoard = m.boards[0].id; break; } }
            if (firstBoard) break;
          }
          if (firstBoard) break;
        }
        const chosen = (saved && boardIds.has(saved)) ? saved : firstBoard;
        // buka tahun/bulan induk board terpilih agar sidebar menampilkannya + set workspace aktif
        let wsActive = s.workspaces[0]?.id || '';
        for (const w of s.workspaces) {
          for (const y of (w.years || [])) {
            for (const m of (y.months || [])) {
              if ((m.boards || []).some((b: any) => b.id === chosen)) { wsActive = w.id; y.isOpen = true; m.isOpen = true; }
            }
          }
        }
        setWorkspaces([...s.workspaces]);
        setActiveWorkspaceId(wsActive);
        setActiveBoardId(chosen);
        setIsLoaded(true);
      } catch (e: any) {
        if (active) setLoadError(e?.message || 'Gagal memuat data dari Supabase');
      }
    })();
    return () => { active = false; };
  }, [supabase, authUser, isLoaded]);

  // Muat ulang data ringan (dipakai realtime saat ada perubahan penugasan)
  const refreshData = async () => {
    if (!supabase || !authUser) return;
    try {
      const s = await loadFullState(supabase);
      setWorkspaces(s.workspaces);
      setBoardsDataMap(ensureViews(s.boardsDataMap));
      setLabels(s.labels);
      if (s.teamMembers.length) setTeamMembers(await mergeAvatars(supabase, s.teamMembers));
      if (s.currentUserId) setCurrentUserId(s.currentUserId);
      setCurrentUserRole(s.currentUserRole || 'member');
      setCanContentHub(s.canContentHub !== false);
    } catch { /* abaikan */ }
  };

  // Realtime untuk MEMBER: saat di-assign/lepas dari tugas, tugas baru muncul otomatis (tanpa reload manual)
  useEffect(() => {
    if (!supabase || !authUser || !isLoaded || currentUserRole === 'manager') return;
    let timer: any;
    const channel = supabase
      .channel('member-assignees-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_assignees' }, () => {
        clearTimeout(timer);
        timer = setTimeout(() => { refreshData(); }, 1200);
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, authUser, isLoaded, currentUserRole]);

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

    // Jangan menarik data baru saat seseorang sedang mengetik — tunggu ia selesai.
    const sedangMengetik = () => {
      const el: any = typeof document !== 'undefined' ? document.activeElement : null;
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };
    const jadwalkanMuatUlang = () => {
      clearTimeout(jeda);
      jeda = setTimeout(() => {
        if (sedangMengetik()) { jadwalkanMuatUlang(); return; }
        refreshData();
      }, 1500);
    };

    let ch: any = supabase
      .channel('papan-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'item_values' }, (p: any) => {
        const baris = p.new || p.old;
        if (!baris?.item_id || !baris?.column_id) return;
        tambalSel(baris.item_id, baris.column_id, p.eventType === 'DELETE' ? '' : baris.value);
      });

    for (const tabel of ['items', 'groups', 'columns', 'column_options', 'tree_nodes']) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: tabel }, jadwalkanMuatUlang);
    }
    // Penugasan sudah dipantau langganan khusus member di atas, jadi di sini
    // cukup untuk manager agar tidak ada pemantauan ganda.
    if (currentUserRole === 'manager') {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'item_assignees' }, jadwalkanMuatUlang);
    }
    ch.subscribe();

    return () => { clearTimeout(jeda); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, authUser, isLoaded, currentUserRole, tambalSel]);

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
    for (const year of workspaces[0]?.years || []) {
      for (const month of year.months || []) {
        const b = month.boards?.find((x:any) => x.id === activeBoardId);
        if (b) { activeBoardName = b.name; activeBoardPath = { year: year.name, month: month.name, board: b.name }; break; }
      }
      if (activeBoardPath) break;
    }
  }

  const triggerConfirm = (title: string, message: string, action: () => void) => setConfirmModal({ isOpen: true, title, message, onConfirm: () => { action(); setConfirmModal(null); } });
  // === 1e: simpan perubahan sel/nama ke cloud (fire-and-forget) ===
  const cloudOn = () => !!supabase && isLoaded && !!authUser;
  const persistItemField = async (scope: 'main' | 'sub', itemId: string, field: string, val: any) => {
    if (!cloudOn()) return;
    try {
      if (field === 'name') { await dbUpdateItemName(supabase, itemId, val); return; }
      if (field === 'isSubItemsOpen') { await dbSetItemMeta(supabase, itemId, { is_subitems_open: !!val }); return; }
      if (field === 'description') { await dbSetItemMeta(supabase, itemId, { description: val }); return; }
      const cols = scope === 'main' ? columns : subColumns;
      const col = cols.find((c: any) => c.id === field);
      if (!col) return; // bukan kolom dikenal -> lewati
      await dbSetCellValue(supabase, itemId, field, col.type, val);
    } catch (e: any) { pushToast('Gagal simpan ke cloud: ' + (e?.message || e)); }
  };

  const handleUpdateItem = (gId: string, iId: string, field: string, val: any) => {
    setBoardsDataMap((prev:any) => {
      if (!activeBoardId || !prev[activeBoardId]) return prev;
      const bd = prev[activeBoardId];
      const groups = bd.groups.map((g:any) => g.id !== gId ? g : { ...g, items: g.items.map((i:any) => i.id === iId ? { ...i, [field]: val } : i) });
      return { ...prev, [activeBoardId]: { ...bd, groups } };
    });
    persistItemField('main', iId, field, val);
  };
  const handleUpdateSubItem = (gId: string, iId: string, sId: string, field: string, val: any) => {
    setBoardsDataMap((prev:any) => {
      if (!activeBoardId || !prev[activeBoardId]) return prev;
      const bd = prev[activeBoardId];
      const groups = bd.groups.map((g:any) => g.id !== gId ? g : { ...g, items: g.items.map((i:any) => i.id === iId ? { ...i, subItems: i.subItems.map((s:any) => s.id === sId ? { ...s, [field]: val } : s) } : i) });
      return { ...prev, [activeBoardId]: { ...bd, groups } };
    });
    persistItemField('sub', sId, field, val);
  };
  const handleDeleteItem = (gId: string, iId: string) => {
    setBoardData(boardData.map((g:any) => g.id === gId ? { ...g, items: g.items.filter((i:any) => i.id !== iId) } : g));
    pushToast('Item dihapus');
    if (cloudOn()) dbDeleteItem(supabase, iId).catch((e:any) => pushToast('Gagal hapus di cloud: ' + (e?.message || e)));
  };
  const handleDeleteSubItem = (gId: string, iId: string, sId: string) => {
    setBoardData(boardData.map((g:any) => g.id !== gId ? g : { ...g, items: g.items.map((i:any) => i.id === iId ? { ...i, subItems: i.subItems.filter((s:any) => s.id !== sId) } : i) }));
    pushToast('Sub-item dihapus');
    if (cloudOn()) dbDeleteItem(supabase, sId).catch((e:any) => pushToast('Gagal hapus di cloud: ' + (e?.message || e)));
  };
  
  const handleAddItem = (gId: string) => {
    const id = newId();
    const grp = boardData.find((g:any) => g.id === gId);
    const position = grp ? grp.items.length : 0;
    setBoardData(boardData.map((g:any) => g.id === gId ? { ...g, items: [...g.items, { id, name: 'New item', isSubItemsOpen: false, subItems: [] }] } : g));
    if (cloudOn()) dbAddItem(supabase, { id, groupId: gId, name: 'New item', position }).catch((e:any) => pushToast('Gagal tambah item di cloud: ' + (e?.message || e)));
  };
  const handleAddSubItem = (gId: string, iId: string) => {
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

  const handleDeleteTeamMember = (memberId: string) => {
    const snap = teamMembers;
    setTeamMembers(prev => prev.filter(m => m.id !== memberId));
    pushToast('Anggota tim dihapus', () => setTeamMembers(snap));
  };
  const handleDeleteLabel = (field: string, labelId: string) => {
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
      for (const c of changed) dbSetCellValue(supabase, c.itemId, field, 'status', c.val).catch(() => {});
    }
  };
  // Tambah opsi/label baru (dipakai context & TableCell) — id uuid + simpan ke cloud
  const addLabelOption = (columnId: string, text: string, color?: string) => {
    const lbl = { id: newId(), text, color: color || LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)] };
    const position = (labels[columnId]?.length || 0);
    setLabels((prev:any) => ({ ...prev, [columnId]: [...(prev[columnId] || []), lbl] }));
    if (cloudOn()) dbAddLabel(supabase, { id: lbl.id, columnId, text: lbl.text, color: lbl.color, position }).catch((e:any) => pushToast('Gagal tambah label di cloud: ' + (e?.message || e)));
    return lbl;
  };
  const updateLabelColor = (columnId: string, labelId: string, color: string) => {
    setLabels((prev:any) => ({ ...prev, [columnId]: (prev[columnId] || []).map((l:any) => l.id === labelId ? { ...l, color } : l) }));
    if (cloudOn()) dbUpdateLabelColor(supabase, labelId, color).catch((e:any) => pushToast('Gagal ubah warna label: ' + (e?.message || e)));
  };
  const handleDeleteColumn = (colId: string) => {
    setColumns(columns.filter((c:any) => c.id !== colId));
    pushToast('Kolom dihapus');
    if (cloudOn()) dbDeleteColumn(supabase, colId).catch((e:any) => pushToast('Gagal hapus kolom di cloud: ' + (e?.message || e)));
  };
  const handleDeleteSubColumn = (colId: string) => {
    setSubColumns(subColumns.filter((c:any) => c.id !== colId));
    pushToast('Kolom sub dihapus');
    if (cloudOn()) dbDeleteColumn(supabase, colId).catch((e:any) => pushToast('Gagal hapus kolom di cloud: ' + (e?.message || e)));
  };
  const handleAddGroup = () => {
    if (!activeBoardId) return;
    const id = newId();
    const color = HEX_COLORS[Math.floor(Math.random() * HEX_COLORS.length)];
    const position = boardData.length;
    setBoardData([...boardData, { id, title: 'New Group', color, isCollapsed: false, itemLabel: 'Item Name', subItemLabel: 'Subitem', items: [] }]);
    if (cloudOn()) dbAddGroup(supabase, { id, boardId: activeBoardId, title: 'New Group', color, position }).catch((e:any) => pushToast('Gagal tambah grup di cloud: ' + (e?.message || e)));
  };
  const updateGroup = (gId: string, patch: any) => {
    setBoardData(boardData.map((g:any) => g.id === gId ? { ...g, ...patch } : g));
    if (cloudOn()) dbUpdateGroup(supabase, gId, patch).catch((e:any) => pushToast('Gagal simpan grup di cloud: ' + (e?.message || e)));
  };
  const handleDeleteGroup = (gId: string) => {
    setBoardData(boardData.filter((g:any) => g.id !== gId));
    pushToast('Grup dihapus');
    if (cloudOn()) dbDeleteGroup(supabase, gId).catch((e:any) => pushToast('Gagal hapus grup di cloud: ' + (e?.message || e)));
  };

  // === POHON (year/month/board) — cloud-aware ===
  const addYear = (name: string) => {
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
    const id = newId(); const nm = name.toUpperCase();
    let position = 0;
    for (const w of workspaces) { const y = (w.years || []).find((yy:any) => yy.id === yearId); if (y) position = (y.months?.length) || 0; }
    setWorkspaces(workspaces.map((w:any) => ({ ...w, years: (w.years || []).map((y:any) => y.id === yearId ? { ...y, isOpen: true, months: [...(y.months || []), { id, name: nm, isOpen: true, boards: [] }] } : y) })));
    if (cloudOn()) dbAddTreeNode(supabase, { id, parentId: yearId, kind: 'month', name: nm, position }).catch((e:any) => pushToast('Gagal tambah bulan di cloud: ' + (e?.message || e)));
  };
  const addBoard = (monthId: string, name: string) => {
    const id = newId(); const groupId = newId();
    const color = HEX_COLORS[Math.floor(Math.random() * HEX_COLORS.length)];
    let position = 0;
    for (const w of workspaces) for (const y of (w.years || [])) { const m = (y.months || []).find((mm:any) => mm.id === monthId); if (m) position = (m.boards?.length) || 0; }
    setWorkspaces(workspaces.map((w:any) => ({ ...w, years: (w.years || []).map((y:any) => ({ ...y, months: (y.months || []).map((m:any) => m.id === monthId ? { ...m, isOpen: true, boards: [...(m.boards || []), { id, name }] } : m) })) })));
    setBoardsDataMap((prev:any) => ({ ...prev, [id]: { groups: [{ id: groupId, title: 'New Group', color, isCollapsed: false, itemLabel: 'Item Name', subItemLabel: 'Subitem', items: [] }], columns: [], subColumns: [], views: makeDefaultViews() } }));
    setActiveBoardId(id);
    if (cloudOn()) {
      dbAddTreeNode(supabase, { id, parentId: monthId, kind: 'board', name, position })
        .then(() => dbAddGroup(supabase, { id: groupId, boardId: id, title: 'New Group', color, position: 0 }))
        .catch((e:any) => pushToast('Gagal tambah board di cloud: ' + (e?.message || e)));
    }
    return id;
  };
  const renameNode = (kind: 'year'|'month'|'board', nodeId: string, name: string) => {
    const nm = kind === 'board' ? name : name.toUpperCase();
    setWorkspaces(workspaces.map((w:any) => {
      if (kind === 'year') return { ...w, years: (w.years || []).map((y:any) => y.id === nodeId ? { ...y, name: nm } : y) };
      if (kind === 'month') return { ...w, years: (w.years || []).map((y:any) => ({ ...y, months: (y.months || []).map((m:any) => m.id === nodeId ? { ...m, name: nm } : m) })) };
      return { ...w, years: (w.years || []).map((y:any) => ({ ...y, months: (y.months || []).map((m:any) => ({ ...m, boards: (m.boards || []).map((b:any) => b.id === nodeId ? { ...b, name: nm } : b) })) })) };
    }));
    if (cloudOn()) dbRenameTreeNode(supabase, nodeId, nm).catch((e:any) => pushToast('Gagal rename di cloud: ' + (e?.message || e)));
  };
  const deleteNode = (kind: 'year'|'month'|'board', nodeId: string) => {
    setWorkspaces(workspaces.map((w:any) => {
      if (kind === 'year') return { ...w, years: (w.years || []).filter((y:any) => y.id !== nodeId) };
      if (kind === 'month') return { ...w, years: (w.years || []).map((y:any) => ({ ...y, months: (y.months || []).filter((m:any) => m.id !== nodeId) })) };
      return { ...w, years: (w.years || []).map((y:any) => ({ ...y, months: (y.months || []).map((m:any) => ({ ...m, boards: (m.boards || []).filter((b:any) => b.id !== nodeId) })) })) };
    }));
    if (kind === 'board') { const nm = { ...boardsDataMap }; delete nm[nodeId]; setBoardsDataMap(nm); if (activeBoardId === nodeId) setActiveBoardId(null); }
    pushToast((kind === 'year' ? 'Tahun' : kind === 'month' ? 'Bulan' : 'Board') + ' dihapus');
    if (cloudOn()) dbDeleteTreeNode(supabase, nodeId).catch((e:any) => pushToast('Gagal hapus di cloud: ' + (e?.message || e)));
  };

  // === REORDER + INSERT-BELOW + RENAME KOLOM (cloud-aware) ===
  const updateColumnLabel = (colId: string, label: string) => {
    if (columns.some((c:any) => c.id === colId)) setColumns(columns.map((c:any) => c.id === colId ? { ...c, label } : c));
    else setSubColumns(subColumns.map((c:any) => c.id === colId ? { ...c, label } : c));
    if (cloudOn()) dbUpdateColumnLabel(supabase, colId, label).catch((e:any) => pushToast('Gagal rename kolom di cloud: ' + (e?.message || e)));
  };
  const reorderColumns = (fromId: string, toId: string) => {
    if (!fromId || fromId === toId) return;
    const arr = [...columns];
    const fromIdx = arr.findIndex((c:any) => c.id === fromId);
    const toIdx = arr.findIndex((c:any) => c.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [moved] = arr.splice(fromIdx, 1); arr.splice(toIdx, 0, moved);
    setColumns(arr);
    if (cloudOn()) dbReindexColumns(supabase, arr.map((c:any) => c.id)).catch((e:any) => pushToast('Gagal simpan urutan kolom: ' + (e?.message || e)));
  };
  const reorderGroups = (fromId: string, toId: string) => {
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
        })().catch((e:any) => pushToast('Gagal simpan pindah item: ' + (e?.message || e)));
      }
    }
  };
  const insertItemBelow = (gId: string, afterItemId: string) => {
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
  const handleBulkDelete = (ids: string[]) => {
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
        for (const { clone, groupId } of clones) {
          const grp = newGroups.find((g:any) => g.id === groupId);
          const pos = grp.items.findIndex((i:any) => i.id === clone.id);
          await dbAddItem(supabase, { id: clone.id, groupId, name: clone.name, position: pos });
          if (clone.description) await dbSetItemMeta(supabase, clone.id, { description: clone.description });
          for (const col of columns) {
            const val = clone[col.id];
            if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) continue;
            await dbSetCellValue(supabase, clone.id, col.id, col.type, val);
          }
          const subs = clone.subItems || [];
          for (let si = 0; si < subs.length; si++) {
            const sub = subs[si];
            await dbAddSubItem(supabase, { id: sub.id, groupId, parentItemId: clone.id, name: sub.name, position: si });
            for (const col of subColumns) {
              const val = sub[col.id];
              if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) continue;
              await dbSetCellValue(supabase, sub.id, col.id, col.type, val);
            }
          }
        }
        const affected = Array.from(new Set(clones.map((c) => c.groupId)));
        for (const gid of affected) {
          const grp = newGroups.find((g:any) => g.id === gid);
          if (grp) await dbReindexItems(supabase, grp.items.map((i:any, idx:number) => ({ id: i.id, position: idx })));
        }
      })().catch((e:any) => pushToast('Gagal duplikat di cloud: ' + (e?.message || e)));
    }
  };

  // === VIEW INSTANCES (multi-view ala Monday) ===
  const addView = (type: string, name?: string) => {
    if (!activeBoardId) return;
    const id = `view-${type}-${Date.now()}`;
    const labelMap: any = { table: 'Table', kanban: 'Kanban', chart: 'Chart', gantt: 'Gantt', calendar: 'Calendar', workload: 'Workload' };
    const finalName = name || labelMap[type] || 'View';
    setBoardsDataMap((p:any) => {
      const bd = p[activeBoardId]; if (!bd) return p;
      return { ...p, [activeBoardId]: { ...bd, views: [...(bd.views || []), { id, type, name: finalName, config: { hiddenColumns: [] } }] } };
    });
    setActiveViewId(id);
  };
  const renameView = (id: string, name: string) => {
    if (!activeBoardId) return;
    setBoardsDataMap((p:any) => {
      const bd = p[activeBoardId]; if (!bd) return p;
      return { ...p, [activeBoardId]: { ...bd, views: (bd.views || []).map((v:any) => v.id === id ? { ...v, name } : v) } };
    });
  };
  const deleteView = (id: string) => {
    if (!activeBoardId) return;
    const bd = boardsDataMap[activeBoardId];
    if (!bd || (bd.views || []).length <= 1) return; // jangan hapus view terakhir
    const snap = boardsDataMap;
    const remaining = bd.views.filter((v:any) => v.id !== id);
    setBoardsDataMap((p:any) => ({ ...p, [activeBoardId]: { ...p[activeBoardId], views: (p[activeBoardId].views || []).filter((v:any) => v.id !== id) } }));
    if (activeViewId === id) setActiveViewId(remaining[0]?.id || '');
    pushToast('View dihapus', () => setBoardsDataMap(snap));
  };
  const duplicateView = (id: string) => {
    if (!activeBoardId) return;
    const newId = `view-dup-${Date.now()}`;
    setBoardsDataMap((p:any) => {
      const bd = p[activeBoardId]; if (!bd) return p;
      const src = (bd.views || []).find((v:any) => v.id === id); if (!src) return p;
      const idx = bd.views.findIndex((v:any) => v.id === id);
      const copy = { ...src, id: newId, name: `${src.name} (Copy)`, config: { ...(src.config || {}), hiddenColumns: [...(src.config?.hiddenColumns || [])] } };
      const arr = [...bd.views]; arr.splice(idx + 1, 0, copy);
      return { ...p, [activeBoardId]: { ...bd, views: arr } };
    });
    setActiveViewId(newId);
  };
  const reorderViews = (fromId: string, toId: string) => {
    if (!activeBoardId || !fromId || fromId === toId) return;
    setBoardsDataMap((p:any) => {
      const bd = p[activeBoardId]; if (!bd) return p;
      const arr = [...(bd.views || [])];
      const fi = arr.findIndex((v:any) => v.id === fromId);
      const ti = arr.findIndex((v:any) => v.id === toId);
      if (fi < 0 || ti < 0) return p;
      const [m] = arr.splice(fi, 1); arr.splice(ti, 0, m);
      return { ...p, [activeBoardId]: { ...bd, views: arr } };
    });
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
    const idMap: Record<string, string> = {};
    const mapped = columns.map((c:any) => { const nid = newId(); idMap[c.id] = nid; return { ...c, id: nid }; });
    setSubColumns(mapped);
    const newLabels = { ...labels };
    columns.forEach((c:any) => { if (labels[c.id]) newLabels[idMap[c.id]] = labels[c.id].map((l:any) => ({ ...l, id: newId() })); });
    setLabels(newLabels);
    if (cloudOn() && activeBoardId) {
      (async () => {
        for (let i = 0; i < mapped.length; i++) {
          const c = mapped[i];
          await dbAddColumn(supabase, { id: c.id, boardId: activeBoardId, scope: 'sub', label: c.label, type: c.type, width: c.width || '130px', position: i });
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
    handleAddItem, handleAddSubItem, toggleGroupSelection,
    handleDeleteTeamMember, handleDeleteLabel, addLabelOption, updateLabelColor, handleDeleteColumn, handleDeleteSubColumn, handleAddDynamicColumn, copyParentColumns, handleExportCSV, handleAddGroup, updateGroup, handleDeleteGroup, addYear, addMonth, addBoard, renameNode, deleteNode, updateColumnLabel, reorderColumns, reorderGroups, moveItem, insertItemBelow, insertSubBelow, handleBulkDelete, handleBulkDuplicate, pushToast, HEX_COLORS, LABEL_COLORS,
    authUser, doLogout, isManager, currentUserRole, canContentHub, refreshData, openDocEditor, closeDocEditor, saveDoc, docEditorTarget, supabase
  };

  const gate = (() => {
    if (!supabase) return (<div className="min-h-screen w-full bg-[#181b24] text-zinc-300 flex items-center justify-center p-6 text-center text-sm">Konfigurasi Supabase belum ada. Pastikan <code className="mx-1 text-zinc-100">.env.local</code> terisi lalu restart <code className="ml-1 text-zinc-100">npm run dev</code>.</div>);
    if (!authChecked) return (<div className="min-h-screen w-full bg-[#181b24] flex items-center justify-center"><LoadingLogo size={64} withRing text="Memeriksa sesi" /></div>);
    if (!authUser) return (
      <div className="min-h-screen w-full bg-[#181b24] text-zinc-100 flex items-center justify-center p-6 font-sans">
        <div className="w-full max-w-sm bg-[#20222b] border border-zinc-800 rounded-2xl p-6 shadow-2xl">
          <h1 className="text-lg font-bold mb-1">Daily Work Tracker</h1>
          <p className="text-sm text-zinc-500 mb-5">Masuk untuk mengakses board kamu.</p>
          <div className="flex flex-col gap-2">
            <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} type="email" placeholder="Email" className="bg-zinc-950 border border-zinc-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm outline-none transition-colors" />
            <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && doLogin()} type="password" placeholder="Password" className="bg-zinc-950 border border-zinc-700 focus:border-blue-500 rounded-lg px-3 py-2 text-sm outline-none transition-colors" />
            <button onClick={doLogin} disabled={loginBusy || !loginEmail || !loginPassword} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-4 py-2 text-sm font-semibold mt-1 transition-colors">{loginBusy ? 'Memproses…' : 'Masuk'}</button>
            {loginMsg && <div className="text-sm text-red-400 mt-1">{loginMsg}</div>}
          </div>
        </div>
      </div>
    );
    if (loadError) return (<div className="min-h-screen w-full bg-[#181b24] text-red-300 flex items-center justify-center p-6 text-center text-sm">Gagal memuat data: {loadError}</div>);
    if (!isLoaded) return (<div className="min-h-screen w-full bg-[#181b24] flex items-center justify-center"><LoadingLogo size={64} withRing text="Memuat data" /></div>);
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
          <div className="bg-[#1e202a] border border-zinc-800 rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><AlertCircle size={20} className="text-red-400" /> {confirmModal.title}</h3>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmModal(null)} className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={confirmModal.onConfirm} className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-md shadow-md transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* === TOAST CONTAINER === */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[120] flex flex-col gap-2 items-end">
          {toasts.map((t:any) => (
            <div key={t.id} className="bg-[#2a2c38] border border-zinc-700 shadow-2xl rounded-lg pl-4 pr-3 py-3 flex items-center gap-3 min-w-[240px] max-w-[360px] dwt-row-in">
              <span className="text-sm text-zinc-200 flex-1">{t.message}</span>
              {t.undo && <button onClick={() => { t.undo(); dismissToast(t.id); }} className="text-xs font-bold text-blue-400 hover:text-blue-300 shrink-0 uppercase tracking-wide">{t.actionLabel || 'Undo'}</button>}
              <button onClick={() => dismissToast(t.id)} className="text-zinc-500 hover:text-white shrink-0"><X size={14}/></button>
            </div>
          ))}
        </div>
      )}
    </DashboardContext.Provider>
  );
};

export const useDashboard = () => useContext(DashboardContext);