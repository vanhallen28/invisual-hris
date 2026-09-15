'use client';
import React, { useState } from 'react';
import { Activity, CheckCircle2, Clock, User } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import { kumpulkanIdBoardDanSub } from '@/lib/tracker/pendapatan';

function InputTarget({ boardId, akun, nilai, onSimpan }: any) {
  const [v, setV] = React.useState(String(nilai ?? 0));
  React.useEffect(() => { setV(String(nilai ?? 0)); }, [nilai]);
  return (
    <input
      type="number" min={0} value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => onSimpan(boardId, akun, parseInt(v) || 0)}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className="w-20 bg-latar border border-white/10 rounded-md px-2 py-1 text-sm text-white text-right outline-none focus:border-blue-500"
    />
  );
}

export default function Overview() {
  const { boardData, columns, subColumns, labels, teamMembers, setDetailItem, activeBoardName, activeBoardId, accountTargets, setAccountTarget, hapusAccountTarget, boardsDataMap, workspaces } = useDashboard();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Resolve the dynamic Status / People columns by type (ids are generated).
  const statusKey = columns.find((c: any) => c.type === 'status')?.id;
  const teamKey = columns.find((c: any) => c.type === 'team')?.id;
  const statusLabels = statusKey ? (labels[statusKey] || []) : [];

  // "Completed" / "In progress" are detected from the label colour or its name,
  // so this keeps working with custom statuses instead of hardcoded strings.
  const doneTexts = statusLabels.filter((l: any) => l.color === 'bg-[#00c875]' || /done|publish|complete|selesai/i.test(l.text)).map((l: any) => l.text);
  const workingTexts = statusLabels.filter((l: any) => l.color === 'bg-[#fdab3d]' || /progress|working|proses/i.test(l.text)).map((l: any) => l.text);

  const allItems = boardData.flatMap((g: any) => g.items.map((i: any) => ({ ...i, groupId: g.id, groupColor: g.color })));
  const totalTasks = allItems.length;
  const doneTasks = statusKey ? allItems.filter((i: any) => doneTexts.includes(i[statusKey])).length : 0;
  const workingTasks = statusKey ? allItems.filter((i: any) => workingTexts.includes(i[statusKey])).length : 0;

  const getTeamWorkload = () => teamMembers
    .map((m: any) => ({ ...m, count: teamKey ? allItems.filter((i: any) => i[teamKey]?.includes(m.id)).length : 0 }))
    .sort((a: any, b: any) => b.count - a.count);

  // === PROGRES PER AKUN (khusus board MARKETPLACE) ===
  const isMarketplace = /marketplace/i.test(activeBoardName || '');
  const upper = (v: any) => String(v || '').toUpperCase();
  const emberStatus = (v: any) => {
    const n = String(v || '').toLowerCase().replace(/\s+/g, '');
    if (n === 'done') return 'done';
    if (n === 'inreview') return 'inreview';
    if (n === 'approved') return 'approved';
    if (n === 'rejected') return 'rejected';
    return null;
  };
  const statAkun: Record<string, { done: number; inreview: number; approved: number; rejected: number }> = {};
  const akunTerpakai = new Set<string>();
  const catat = (akun: any, status: any) => {
    const a = String(akun || '').trim();
    if (a) akunTerpakai.add(a);
    const b = emberStatus(status);
    if (!a || !b) return;
    if (!statAkun[a]) statAkun[a] = { done: 0, inreview: 0, approved: 0, rejected: 0 };
    (statAkun[a] as any)[b]++;
  };
  if (isMarketplace) {
    // Ikutkan board aktif + SEMUA sub-board-nya (tiap board pakai kolomnya sendiri).
    const idsBoard = kumpulkanIdBoardDanSub(workspaces, activeBoardId || '');
    const papanList = idsBoard.map((id: string) => id === activeBoardId
      ? { groups: boardData, columns, subColumns }
      : (boardsDataMap[id] ? { groups: boardsDataMap[id].groups || [], columns: boardsDataMap[id].columns || [], subColumns: boardsDataMap[id].subColumns || [] } : null)
    ).filter(Boolean) as any[];
    for (const papan of papanList) {
      const aMain = papan.columns.find((c: any) => upper(c.label) === 'AKUN')?.id;
      const aSub = papan.subColumns.find((c: any) => upper(c.label) === 'AKUN')?.id;
      const sMain = papan.columns.find((c: any) => upper(c.label) === 'STATUS')?.id;
      const sSub = papan.subColumns.find((c: any) => upper(c.label) === 'STATUS')?.id;
      for (const g of (papan.groups || [])) for (const it of (g.items || [])) {
        const akunItem = aMain ? it[aMain] : '';
        catat(akunItem, sMain ? it[sMain] : '');
        for (const sub of (it.subItems || [])) {
          const akunSub = (aSub && sub[aSub]) ? sub[aSub] : akunItem; // warisi induk
          catat(akunSub, sSub ? sub[sSub] : '');
        }
      }
    }
  }
  const akunDariItem = new Set(akunTerpakai); // akun yang benar-benar punya item di board ini
  const targetBoard: Record<string, number> = (activeBoardId && accountTargets[activeBoardId]) || {};
  Object.keys(targetBoard).forEach((a) => akunTerpakai.add(a));
  const daftarAkun = [...akunTerpakai].sort((a, b) => a.localeCompare(b));

  const renderTaskList = (items: any[]) => (
    <div className="mt-2 ml-7 flex flex-col gap-0.5 border-l border-white/10 pl-3 py-1">
      {items.length === 0 && <span className="text-[11px] text-gray-600 italic">Tak ada tugas.</span>}
      {items.map((it: any) => (
        <button key={it.id} onClick={() => setDetailItem({ groupId: it.groupId, itemId: it.id })} className="text-left text-[11px] text-gray-400 hover:text-white flex items-center gap-2 py-1 transition-colors">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: it.groupColor }} /> <span className="truncate">{it.name}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-6 mt-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-kartu-hover border border-white/10 rounded-xl p-5 flex items-center justify-between shadow-lg">
          <div><p className="text-xs font-bold text-gray-500 uppercase mb-1">Total Tasks</p><h3 className="text-3xl font-black text-white">{totalTasks}</h3></div><div className="w-10 h-10 rounded bg-blue-500/10 flex items-center justify-center text-blue-500"><Activity size={18}/></div>
        </div>
        <div className="bg-kartu-hover border border-white/10 rounded-xl p-5 flex items-center justify-between shadow-lg">
          <div><p className="text-xs font-bold text-gray-500 uppercase mb-1">Completed</p><h3 className="text-3xl font-black text-emerald-400">{doneTasks}</h3></div><div className="w-10 h-10 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-400"><CheckCircle2 size={18}/></div>
        </div>
        <div className="bg-kartu-hover border border-white/10 rounded-xl p-5 flex items-center justify-between shadow-lg">
          <div><p className="text-xs font-bold text-gray-500 uppercase mb-1">In Progress</p><h3 className="text-3xl font-black text-[#fdab3d]">{workingTasks}</h3></div><div className="w-10 h-10 rounded bg-amber-500/10 flex items-center justify-center text-[#fdab3d]"><Clock size={18}/></div>
        </div>
      </div>

      {isMarketplace && (
        <div className="bg-kartu-hover border border-white/10 rounded-xl p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-1 uppercase tracking-wider flex items-center gap-2"><User size={16} className="text-blue-400" /> Progres per Akun</h3>
          <p className="text-[11px] text-gray-500 mb-5">Target diinput manual. Sisa = Target − (Done + In Review + Approved). Rejected tak dikurangkan.</p>
          {daftarAkun.length === 0 ? (
            <p className="text-xs text-gray-600 italic">Belum ada akun. Isi kolom AKUN pada baris untuk memunculkan akun di sini.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {daftarAkun.map((akun) => {
                const c = statAkun[akun] || { done: 0, inreview: 0, approved: 0, rejected: 0 };
                const target = targetBoard[akun] ?? 0;
                const sisa = target - (c.done + c.inreview + c.approved);
                const progress = target > 0 ? Math.min(100, Math.round((c.approved / target) * 100)) : 0;
                return (
                  <div key={akun} className="bg-kartu border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-white text-sm truncate">{akun}</span>
                        {!akunDariItem.has(akun) && (
                          <button onClick={() => hapusAccountTarget(activeBoardId, akun)} title="Akun ini tak punya item di board — hapus dari Overview" className="shrink-0 text-[10px] font-bold text-red-400 hover:text-red-300 border border-red-500/30 hover:border-red-500/50 rounded px-1.5 py-0.5">Hapus</button>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-gray-500 uppercase font-bold">Target</span>
                        <InputTarget boardId={activeBoardId} akun={akun} nilai={target} onSimpan={setAccountTarget} />
                      </div>
                    </div>
                    <div className="h-2 bg-latar rounded-full overflow-hidden mb-3"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
                    <div className="grid grid-cols-5 gap-2 text-center">
                      <div><div className="text-lg font-black text-gray-300">{c.done}</div><div className="text-[9px] text-gray-500 uppercase font-bold">Done</div></div>
                      <div><div className="text-lg font-black text-blue-300">{c.inreview}</div><div className="text-[9px] text-gray-500 uppercase font-bold">In Review</div></div>
                      <div><div className="text-lg font-black text-emerald-400">{c.approved}</div><div className="text-[9px] text-gray-500 uppercase font-bold">Approved</div></div>
                      <div><div className="text-lg font-black text-red-400">{c.rejected}</div><div className="text-[9px] text-gray-500 uppercase font-bold">Rejected</div></div>
                      <div><div className={`text-lg font-black ${sisa < 0 ? 'text-amber-400' : 'text-white'}`}>{sisa}</div><div className="text-[9px] text-gray-500 uppercase font-bold">Sisa Target</div></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {statusKey && statusLabels.length > 0 && (
        <div className="bg-kartu-hover border border-white/10 rounded-xl p-6 shadow-xl max-w-xl">
          <h3 className="text-sm font-bold text-white mb-5 uppercase tracking-wider flex items-center gap-2"><Activity size={16} className="text-blue-400"/> Status Breakdown</h3>
          <div className="flex flex-col gap-4">
            {statusLabels.map((l: any) => {
              const matched = allItems.filter((i: any) => i[statusKey] === l.text);
              const count = matched.length;
              const key = `status:${l.id}`;
              const open = expanded === key;
              return (
                <div key={l.id}>
                  <button onClick={() => setExpanded(open ? null : key)} className="w-full flex items-center gap-4 text-xs group/ov hover:bg-white/5 rounded-lg px-1 py-1 -mx-1 transition-colors">
                    <div className="w-28 flex items-center gap-2 font-medium truncate text-left"><span className={`w-3 h-3 rounded-sm shrink-0 ${l.color}`}></span><span className="truncate group-hover/ov:text-white">{l.text}</span></div>
                    <div className="flex-1 h-2 bg-kartu rounded-full overflow-hidden"><div className={`h-full ${l.color}`} style={{ width: `${totalTasks > 0 ? (count / totalTasks) * 100 : 0}%` }}></div></div>
                    <div className="w-12 text-right font-bold text-gray-400">{count} task</div>
                  </button>
                  {open && renderTaskList(matched)}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-kartu-hover border border-white/10 rounded-xl p-6 shadow-xl max-w-xl">
        <h3 className="text-sm font-bold text-white mb-5 uppercase tracking-wider flex items-center gap-2"><User size={16} className="text-blue-400"/> Team Workload Breakdown</h3>
        {!teamKey ? (
          <p className="text-xs text-gray-500">Add a <span className="text-gray-300 font-semibold">People</span> column in the Main Table to see workload per member.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {getTeamWorkload().map((m: any) => {
              const matched = teamKey ? allItems.filter((i: any) => i[teamKey]?.includes(m.id)) : [];
              const key = `member:${m.id}`;
              const open = expanded === key;
              return (
                <div key={m.id}>
                  <button onClick={() => setExpanded(open ? null : key)} className="w-full flex items-center gap-4 text-xs group/ov hover:bg-white/5 rounded-lg px-1 py-1 -mx-1 transition-colors">
                    <div className="w-20 flex items-center gap-2 font-medium text-left"><div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${m.color?.startsWith('bg-') ? m.color : 'bg-primer-terang'}`}>{m.initials}</div><span className="truncate group-hover/ov:text-white">{m.name}</span></div>
                    <div className="flex-1 h-2 bg-kartu rounded-full overflow-hidden"><div className={`h-full ${m.color?.startsWith('bg-') ? m.color : 'bg-primer-terang'}`} style={{ width: `${totalTasks > 0 ? (m.count / totalTasks) * 100 : 0}%` }}></div></div>
                    <div className="w-12 text-right font-bold text-gray-400">{m.count} task</div>
                  </button>
                  {open && renderTaskList(matched)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
