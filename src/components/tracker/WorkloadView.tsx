'use client';
import React from 'react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import { Users } from 'lucide-react';

export default function WorkloadView() {
  const { boardData, columns, teamMembers, labels, setDetailItem } = useDashboard();

  const teamCols = columns.filter((c: any) => c.type === 'team');
  const statusCols = columns.filter((c: any) => c.type === 'status');
  const dateCols = columns.filter((c: any) => c.type === 'date');
  const tlCols = columns.filter((c: any) => c.type === 'timeline');

  const itemStatus = (item: any) => {
    for (const c of statusCols) { const v = item[c.id]; if (v) { const m = labels[c.id]?.find((l: any) => l.text === v); return { text: v, color: m?.color || 'bg-zinc-600' }; } }
    return null;
  };
  const isOverdue = (item: any) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const c of dateCols) { if (item[c.id]) { const d = new Date(item[c.id]); if (!isNaN(d.getTime()) && d < today) return true; } }
    for (const c of tlCols) { const e = item[c.id]?.end || item[c.id]?.start; if (e) { const d = new Date(e); if (!isNaN(d.getTime()) && d < today) return true; } }
    return false;
  };

  // Map anggota -> item yang di-assign
  const assignments: Record<string, any[]> = {};
  teamMembers.forEach((m: any) => { assignments[m.id] = []; });
  const unassigned: any[] = [];
  boardData.forEach((g: any) => (g.items || []).forEach((it: any) => {
    const ids = new Set<string>();
    teamCols.forEach((c: any) => (it[c.id] || []).forEach((id: string) => ids.add(id)));
    if (ids.size === 0) { unassigned.push({ item: it, group: g }); return; }
    ids.forEach(id => { if (assignments[id]) assignments[id].push({ item: it, group: g }); });
  }));

  const maxLoad = Math.max(1, ...teamMembers.map((m: any) => assignments[m.id]?.length || 0));
  const rows = teamMembers.map((m: any) => ({ m, items: assignments[m.id] || [] })).sort((a: any, b: any) => b.items.length - a.items.length);

  if (teamCols.length === 0) {
    return (
      <div className="bg-[#20222b] border border-zinc-800/80 rounded-xl p-10 flex flex-col items-center justify-center text-center">
        <Users size={40} className="text-blue-500/30 mb-4" />
        <h3 className="text-base font-bold text-zinc-300 mb-1">Workload butuh kolom People</h3>
        <p className="text-sm text-zinc-500 max-w-sm">Tambahkan kolom bertipe <span className="text-zinc-300 font-semibold">People</span> di tabel, lalu assign anggota ke item untuk melihat beban kerja per orang.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#20222b] border border-zinc-800/80 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800/60 flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-100">Workload Tim</h2>
        <span className="text-[11px] text-zinc-500">{teamMembers.length} anggota</span>
      </div>
      <div className="divide-y divide-zinc-800/40">
        {rows.map(({ m, items }: any) => {
          const byStatus: Record<string, { color: string; count: number }> = {};
          let noStatus = 0;
          items.forEach(({ item }: any) => { const s = itemStatus(item); if (s) { if (!byStatus[s.text]) byStatus[s.text] = { color: s.color, count: 0 }; byStatus[s.text].count++; } else noStatus++; });
          const overdue = items.filter(({ item }: any) => isOverdue(item)).length;
          const pct = (items.length / maxLoad) * 100;
          return (
            <div key={m.id} className="px-4 py-3">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${m.color}`}>{m.initials}</div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold text-zinc-200 truncate">{m.name}</span>
                  <span className="text-[11px] text-zinc-500 shrink-0">{items.length} tugas</span>
                  {overdue > 0 && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full shrink-0">{overdue} telat</span>}
                </div>
              </div>
              {/* bar beban (proporsional ke yang paling sibuk) */}
              <div className="w-full h-2 rounded-full bg-zinc-800/40 overflow-hidden mb-2">
                <div className="h-full flex" style={{ width: `${pct}%` }}>
                  {Object.entries(byStatus).map(([txt, info]: any) => <div key={txt} className={info.color} style={{ flexGrow: info.count }} title={`${txt}: ${info.count}`}></div>)}
                  {noStatus > 0 && <div className="bg-zinc-600" style={{ flexGrow: noStatus }} title={`Tanpa status: ${noStatus}`}></div>}
                </div>
              </div>
              {/* daftar tugas */}
              {items.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {items.slice(0, 8).map(({ item, group }: any, i: number) => {
                    const s = itemStatus(item);
                    return (
                      <button key={i} onClick={() => setDetailItem({ groupId: group.id, itemId: item.id })} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-800/50 hover:bg-zinc-700 transition-colors text-left max-w-[200px]">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s?.color || 'bg-zinc-600'}`}></span>
                        <span className="text-[11px] text-zinc-300 truncate">{item.name}</span>
                      </button>
                    );
                  })}
                  {items.length > 8 && <span className="text-[10px] text-zinc-500 self-center px-1">+{items.length - 8} lagi</span>}
                </div>
              ) : <span className="text-[11px] text-zinc-600 italic">Tidak ada tugas</span>}
            </div>
          );
        })}
      </div>
      {/* belum di-assign */}
      {unassigned.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-800/60 bg-zinc-900/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-zinc-400">Belum di-assign</span>
            <span className="text-[11px] text-zinc-500">{unassigned.length} item</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.slice(0, 12).map(({ item, group }: any, i: number) => (
              <button key={i} onClick={() => setDetailItem({ groupId: group.id, itemId: item.id })} className="px-2 py-1 rounded-md bg-zinc-800/50 hover:bg-zinc-700 transition-colors text-[11px] text-zinc-400 max-w-[200px] truncate">{item.name}</button>
            ))}
            {unassigned.length > 12 && <span className="text-[10px] text-zinc-500 self-center px-1">+{unassigned.length - 12} lagi</span>}
          </div>
        </div>
      )}
    </div>
  );
}
