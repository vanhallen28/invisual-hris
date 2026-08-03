'use client';
import React from 'react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import { Users } from 'lucide-react';

export default function WorkloadView() {
  const { boardData, columns, subColumns, teamMembers, labels, setDetailItem } = useDashboard();

  const teamCols = columns.filter((c: any) => c.type === 'team');
  const statusCols = columns.filter((c: any) => c.type === 'status');
  const dateCols = columns.filter((c: any) => c.type === 'date');
  const tlCols = columns.filter((c: any) => c.type === 'timeline');

  // Beban kerja nyata tim sosmed ada di SUB-ITEM (aset per kanal), dan
  // kolom PIC-nya milik `subColumns`. Tanpa pass ini, Workload melaporkan
  // beban jauh lebih ringan dari kenyataan.
  const subTeamCols = subColumns.filter((c: any) => c.type === 'team');
  const subStatusCols = subColumns.filter((c: any) => c.type === 'status');

  // Sub-item punya kolom statusnya sendiri, jadi warnanya harus dicari di
  // subColumns — kalau dipaksa lewat `itemStatus`, titiknya selalu abu.
  const statusBaris = (row: any, parent: any) => {
    const cols = parent ? subStatusCols : statusCols;
    for (const kol of cols) { const nilai = row[kol.id]; if (nilai) { const cocok = labels[kol.id]?.find((l: any) => l.text === nilai); return { text: nilai, color: cocok?.color || 'bg-kartu-hover' }; } }
    return null;
  };
  const tujuanKlik = (group: any, row: any, parent: any) => parent
    ? { groupId: group.id, itemId: parent.id, subItemId: row.id }
    : { groupId: group.id, itemId: row.id };

  const itemStatus = (item: any) => {
    for (const c of statusCols) { const v = item[c.id]; if (v) { const m = labels[c.id]?.find((l: any) => l.text === v); return { text: v, color: m?.color || 'bg-kartu-hover' }; } }
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

  // Pass kedua: sub-item. Dipisah supaya perhitungan item utama yang sudah
  // benar tidak diubah sedikit pun.
  boardData.forEach((g: any) => (g.items || []).forEach((it: any) => (it.subItems || []).forEach((sub: any) => {
    const idSub = new Set<string>();
    subTeamCols.forEach((kol: any) => (sub[kol.id] || []).forEach((id: string) => idSub.add(id)));
    if (idSub.size === 0) return;   // sub tanpa PIC tidak masuk "belum ditugaskan"
    idSub.forEach(id => { if (assignments[id]) assignments[id].push({ item: sub, group: g, parent: it }); });
  })));

  const maxLoad = Math.max(1, ...teamMembers.map((m: any) => assignments[m.id]?.length || 0));
  const rows = teamMembers.map((m: any) => ({ m, items: assignments[m.id] || [] })).sort((a: any, b: any) => b.items.length - a.items.length);

  if (teamCols.length === 0) {
    return (
      <div className="bg-kartu border border-white/10 rounded-xl p-10 flex flex-col items-center justify-center text-center">
        <Users size={40} className="text-blue-500/30 mb-4" />
        <h3 className="text-base font-bold text-gray-300 mb-1">Workload butuh kolom People</h3>
        <p className="text-sm text-gray-500 max-w-sm">Tambahkan kolom bertipe <span className="text-gray-300 font-semibold">People</span> di tabel, lalu assign anggota ke item untuk melihat beban kerja per orang.</p>
      </div>
    );
  }

  return (
    <div className="bg-kartu border border-white/10 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-100">Workload Tim</h2>
        <span className="text-[11px] text-gray-500">{teamMembers.length} anggota</span>
      </div>
      <div className="divide-y divide-white/10/40">
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
                  <span className="text-sm font-semibold text-gray-200 truncate">{m.name}</span>
                  <span className="text-[11px] text-gray-500 shrink-0">{items.length} tugas</span>
                  {overdue > 0 && <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full shrink-0">{overdue} telat</span>}
                </div>
              </div>
              {/* bar beban (proporsional ke yang paling sibuk) */}
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden mb-2">
                <div className="h-full flex" style={{ width: `${pct}%` }}>
                  {Object.entries(byStatus).map(([txt, info]: any) => <div key={txt} className={info.color} style={{ flexGrow: info.count }} title={`${txt}: ${info.count}`}></div>)}
                  {noStatus > 0 && <div className="bg-kartu-hover" style={{ flexGrow: noStatus }} title={`Tanpa status: ${noStatus}`}></div>}
                </div>
              </div>
              {/* daftar tugas */}
              {items.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {items.slice(0, 8).map(({ item, group, parent }: any, i: number) => {
                    const s = statusBaris(item, parent);
                    return (
                      <button key={i} title={parent ? `${parent.name} › ${item.name}` : item.name} onClick={() => setDetailItem(tujuanKlik(group, item, parent))} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 hover:bg-kartu-hover transition-colors text-left max-w-[200px]">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s?.color || 'bg-kartu-hover'}`}></span>
                        <span className="text-[11px] text-gray-300 truncate">{item.name}</span>
                      </button>
                    );
                  })}
                  {items.length > 8 && <span className="text-[10px] text-gray-500 self-center px-1">+{items.length - 8} lagi</span>}
                </div>
              ) : <span className="text-[11px] text-gray-600 italic">Tidak ada tugas</span>}
            </div>
          );
        })}
      </div>
      {/* belum di-assign */}
      {unassigned.length > 0 && (
        <div className="px-4 py-3 border-t border-white/10 bg-kartu/30">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-400">Belum di-assign</span>
            <span className="text-[11px] text-gray-500">{unassigned.length} item</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unassigned.slice(0, 12).map(({ item, group }: any, i: number) => (
              <button key={i} onClick={() => setDetailItem({ groupId: group.id, itemId: item.id })} className="px-2 py-1 rounded-md bg-white/5 hover:bg-kartu-hover transition-colors text-[11px] text-gray-400 max-w-[200px] truncate">{item.name}</button>
            ))}
            {unassigned.length > 12 && <span className="text-[10px] text-gray-500 self-center px-1">+{unassigned.length - 12} lagi</span>}
          </div>
        </div>
      )}
    </div>
  );
}
