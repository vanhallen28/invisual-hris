'use client';
import React, { useState, useEffect } from 'react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import MyContent from '@/components/tracker/MyContent';
import { ListChecks, CalendarDays, ChevronRight, Inbox, CornerDownRight, AlarmClock, X } from 'lucide-react';

export default function MyTasks() {
  const { boardsDataMap, workspaces, currentUserId, labels, teamMembers, setActiveBoardId, setActiveViewId, setDetailItem, handleUpdateItem, handleUpdateSubItem, supabase } = useDashboard();

  // Peta boardId -> info board (untuk menampilkan asal tugas)
  const boardMeta: Record<string, any> = {};
  (workspaces || []).forEach((ws: any) =>
    (ws.years || []).forEach((y: any) =>
      (y.months || []).forEach((mo: any) =>
        (mo.boards || []).forEach((b: any) => { boardMeta[b.id] = { name: b.name, year: y.name, month: mo.name }; })
      )
    )
  );

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dueMeta = (due: string | null) => {
    if (!due) return { label: '—', cls: 'text-zinc-600' };
    const d = new Date(due);
    if (isNaN(d.getTime())) return { label: '—', cls: 'text-zinc-600' };
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    const label = due.slice(5); // MM-DD
    if (diff < 0) return { label: `${label} · telat`, cls: 'text-red-400 font-semibold' };
    if (diff === 0) return { label: `${label} · hari ini`, cls: 'text-amber-400 font-semibold' };
    if (diff <= 3) return { label: `${label} · ${diff}h`, cls: 'text-amber-400 font-semibold' };
    return { label, cls: 'text-zinc-400' };
  };

  // Kumpulkan SEMUA item & sub-item (lintas board) yang di-assign ke currentUserId
  const tasks: any[] = [];
  Object.entries(boardsDataMap || {}).forEach(([boardId, bd]: any) => {
    const cols = bd.columns || [];
    const teamCol = cols.find((c: any) => c.type === 'team');
    const statusCol = cols.find((c: any) => c.type === 'status');
    const dateCol = cols.find((c: any) => c.type === 'date');
    const timelineCol = cols.find((c: any) => c.type === 'timeline');
    const subCols = bd.subColumns || [];
    const subTeamCol = subCols.find((c: any) => c.type === 'team');
    const subStatusCol = subCols.find((c: any) => c.type === 'status');
    const subDateCol = subCols.find((c: any) => c.type === 'date');
    const subTimelineCol = subCols.find((c: any) => c.type === 'timeline');

    (bd.groups || []).forEach((g: any) => {
      (g.items || []).forEach((it: any) => {
        if (teamCol && Array.isArray(it[teamCol.id]) && it[teamCol.id].includes(currentUserId)) {
          tasks.push({
            key: `${boardId}-${it.id}`, boardId, groupId: g.id, itemId: it.id, isSub: false,
            name: it.name, parentName: null,
            boardName: boardMeta[boardId]?.name || 'Board', groupTitle: g.title, groupColor: g.color,
            status: statusCol ? it[statusCol.id] : null, statusColId: statusCol?.id,
            due: dateCol ? it[dateCol.id] : (timelineCol ? (it[timelineCol.id]?.end || null) : null),
          });
        }
        (it.subItems || []).forEach((sub: any) => {
          if (subTeamCol && Array.isArray(sub[subTeamCol.id]) && sub[subTeamCol.id].includes(currentUserId)) {
            tasks.push({
              key: `${boardId}-${sub.id}`, boardId, groupId: g.id, itemId: it.id, subId: sub.id, isSub: true,
              name: sub.name, parentName: it.name,
              boardName: boardMeta[boardId]?.name || 'Board', groupTitle: g.title, groupColor: g.color,
              status: subStatusCol ? sub[subStatusCol.id] : null, statusColId: subStatusCol?.id,
              due: subDateCol ? sub[subDateCol.id] : (subTimelineCol ? (sub[subTimelineCol.id]?.end || null) : null),
            });
          }
        });
      });
    });
  });

  // Urutkan: yang punya due date paling awal di atas; tanpa due date di bawah
  tasks.sort((a, b) => {
    if (!a.due && !b.due) return 0;
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  });

  const total = tasks.length;
  const overdue = tasks.filter((t) => t.due && new Date(t.due) < today).length;
  const dueSoon = tasks.filter((t) => {
    if (!t.due) return false;
    const d = new Date(t.due); const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    return diff >= 0 && diff <= 7;
  }).length;

  const statusColor = (t: any) => (labels[t.statusColId]?.find((l: any) => l.text === t.status)?.color) || 'bg-zinc-700';

  // Tanda notifikasi: ambil waktu update terbaru per tugas, bandingkan dgn yang sudah dibaca (localStorage)
  const [latestByItem, setLatestByItem] = useState<Record<string, string>>({});
  const itemIdsKey = tasks.map((t: any) => t.itemId).filter(Boolean).join(',');
  useEffect(() => {
    if (!supabase) return;
    const ids = Array.from(new Set(tasks.map((t: any) => t.itemId).filter(Boolean)));
    if (!ids.length) { setLatestByItem({}); return; }
    let active = true;
    supabase.from('item_updates').select('item_id, created_at').in('item_id', ids).order('created_at', { ascending: false })
      .then(({ data }: any) => {
        if (!active) return;
        const map: Record<string, string> = {};
        (data || []).forEach((r: any) => { if (!map[r.item_id]) map[r.item_id] = r.created_at; });
        setLatestByItem(map);
      });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, itemIdsKey]);

  const isUnread = (t: any) => {
    const latest = latestByItem[t.itemId];
    if (!latest) return false;
    let seen: string | null = null;
    try { seen = localStorage.getItem(`dwt_read_${t.itemId}`); } catch {}
    return !seen || new Date(latest).getTime() > new Date(seen).getTime();
  };
  const markRead = (t: any) => { const latest = latestByItem[t.itemId]; if (latest) { try { localStorage.setItem(`dwt_read_${t.itemId}`, latest); } catch {} } };

  const goTo = (t: any) => {
    markRead(t);
    setActiveBoardId(t.boardId);
    const tableView = (boardsDataMap[t.boardId]?.views || []).find((v: any) => v.type === 'table');
    setActiveViewId(tableView?.id || '');
    if (!t.isSub) setDetailItem({ groupId: t.groupId, itemId: t.itemId });
  };

  // Reminder: tugas yang telat / jatuh tempo <=3 hari
  const reminders = tasks.filter((t: any) => {
    if (!t.due) return false;
    const d = new Date(t.due); if (isNaN(d.getTime())) return false;
    const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
    return diff <= 3;
  });
  const [showReminder, setShowReminder] = useState(true);
  const [openStatus, setOpenStatus] = useState<string | null>(null);

  // Sapaan + progress + pengelompokan
  const me = (teamMembers || []).find((m: any) => m.id === currentUserId);
  const firstName = (me?.name || 'Kamu').split(' ')[0];
  const hh = new Date().getHours();
  const greeting = hh < 11 ? 'Selamat pagi' : hh < 15 ? 'Selamat siang' : hh < 19 ? 'Selamat sore' : 'Selamat malam';
  const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
  const isDone = (t: any) => /done|selesai|complete|beres/i.test(t.status || '');
  const doneTasks = tasks.filter(isDone);
  const activeTasks = tasks.filter((t: any) => !isDone(t));
  const pct = total ? Math.round((doneTasks.length / total) * 100) : 0;

  const setStatus = (t: any, text: string) => {
    const val = t.status === text ? '' : text;
    if (t.isSub) handleUpdateSubItem(t.groupId, t.itemId, t.subId, t.statusColId, val);
    else handleUpdateItem(t.groupId, t.itemId, t.statusColId, val);
  };

  const renderCard = (t: any) => {
    const dm = dueMeta(t.due);
    const opts = labels[t.statusColId] || [];
    const isOpen = openStatus === t.key;
    return (
      <div key={t.key} onClick={() => goTo(t)} className="group/task relative flex items-center gap-3 bg-[#20222b] hover:bg-[#262934] border border-zinc-800/80 hover:border-zinc-700 rounded-lg px-4 py-3 transition-colors dwt-row-in cursor-pointer">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.groupColor }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            {t.isSub && <CornerDownRight size={12} className="text-zinc-600 shrink-0" />}
            <span className="text-sm text-zinc-200 font-medium truncate">{t.name}</span>
            {isUnread(t) && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" title="Ada pesan baru" />}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 min-w-0">
            <span className="truncate">{t.boardName}</span><span className="text-zinc-700">·</span><span className="truncate">{t.groupTitle}</span>
          </div>
        </div>
        {t.statusColId && (
          <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpenStatus(isOpen ? null : t.key)} title="Ubah status" className={`text-[10px] px-2.5 py-1 rounded-full font-semibold text-white transition-transform hover:scale-105 ${t.status ? statusColor(t) : 'bg-zinc-700 text-zinc-300'}`}>{t.status || '+ status'}</button>
            {isOpen && (
              <>
                <div className="fixed inset-0 z-[70]" onClick={() => setOpenStatus(null)} />
                <div className="absolute right-0 top-full mt-1 z-[80] bg-[#2a2c38] border border-zinc-700 rounded-lg shadow-xl p-1 w-44 flex flex-col gap-0.5">
                  {opts.length === 0 && <span className="text-[11px] text-zinc-500 px-2 py-1.5">Belum ada opsi.</span>}
                  {opts.map((l: any) => (
                    <button key={l.id} onClick={() => { setStatus(t, l.text); setOpenStatus(null); }} className={`flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-md hover:bg-zinc-700 text-left ${t.status === l.text ? 'text-white font-semibold' : 'text-zinc-300'}`}>
                      <span className={`w-3 h-3 rounded-full shrink-0 ${l.color}`} /> {l.text}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <div className={`hidden sm:flex items-center gap-1 text-[11px] shrink-0 w-24 justify-end ${dm.cls}`}><CalendarDays size={11} className="opacity-50" />{dm.label}</div>
        <ChevronRight size={14} className="text-zinc-600 group-hover/task:text-zinc-300 shrink-0 transition-colors" />
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {reminders.length > 0 && showReminder && (
        <div className="fixed bottom-5 right-5 z-[90] w-80 max-w-[calc(100vw-2.5rem)] bg-[#20222b] border border-amber-500/40 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm"><AlarmClock size={15} /> Pengingat Deadline ({reminders.length})</div>
            <button onClick={() => setShowReminder(false)} className="text-zinc-400 hover:text-white transition-colors"><X size={16} /></button>
          </div>
          <div className="max-h-64 overflow-y-auto p-2 flex flex-col gap-0.5">
            {reminders.map((t: any, i: number) => {
              const m = dueMeta(t.due);
              return (
                <button key={i} onClick={() => { setShowReminder(false); goTo(t); }} className="flex items-center justify-between gap-3 text-left px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors">
                  <span className="text-sm text-zinc-200 truncate">{t.name}</span>
                  <span className={`text-[11px] shrink-0 ${m.cls}`}>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* SAPAAN */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">{greeting}, {firstName} 👋</h1>
        <p className="text-sm text-zinc-500 mt-1 capitalize">{todayStr} · <span className="normal-case">{activeTasks.length} tugas aktif{overdue > 0 ? `, ${overdue} terlambat` : ''}</span></p>
      </div>

      {/* RINGKASAN + PROGRESS */}
      <div className="bg-[#20222b] border border-zinc-800/80 rounded-xl p-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div className="flex items-center gap-2.5"><ListChecks size={18} className="text-blue-400 shrink-0" /><div><div className="text-xl font-bold text-zinc-100 leading-none">{total}</div><div className="text-[11px] text-zinc-500 mt-1">tugas saya</div></div></div>
          <div className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" /><div><div className="text-xl font-bold text-zinc-100 leading-none">{overdue}</div><div className="text-[11px] text-zinc-500 mt-1">terlambat</div></div></div>
          <div className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" /><div><div className="text-xl font-bold text-zinc-100 leading-none">{dueSoon}</div><div className="text-[11px] text-zinc-500 mt-1">minggu ini</div></div></div>
          <div className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /><div><div className="text-xl font-bold text-zinc-100 leading-none">{doneTasks.length}</div><div className="text-[11px] text-zinc-500 mt-1">selesai</div></div></div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5"><span className="text-zinc-400 font-medium">Progress</span><span className="text-zinc-300 font-semibold">{pct}%</span></div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
        </div>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 text-center py-20 bg-[#20222b] border border-zinc-800/80 rounded-xl">
          <Inbox size={32} className="text-zinc-700" />
          <p className="text-sm text-zinc-500">Belum ada tugas yang di-assign ke kamu.</p>
          <p className="text-xs text-zinc-600 max-w-sm">Manajer akan menugaskanmu lewat kolom People — tugasnya otomatis muncul di sini.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {activeTasks.length > 0 && (
            <div>
              <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2.5">Aktif ({activeTasks.length})</div>
              <div className="flex flex-col gap-1.5">{activeTasks.map(renderCard)}</div>
            </div>
          )}
          {doneTasks.length > 0 && (
            <div>
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2.5">Selesai ({doneTasks.length})</div>
              <div className="flex flex-col gap-1.5">{doneTasks.map(renderCard)}</div>
            </div>
          )}
        </div>
      )}
      <MyContent />
    </div>
  );
}
