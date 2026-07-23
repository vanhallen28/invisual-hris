'use client';
import React, { useState } from 'react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import { Search, Columns, LayoutGrid, BarChart3, CalendarDays, ListChecks } from 'lucide-react';

const VIEW_TYPES = [
  { type: 'kanban', label: 'Kanban', desc: 'Kartu per status', icon: LayoutGrid },
  { type: 'calendar', label: 'Calendar', desc: 'Item per tanggal', icon: CalendarDays },
  { type: 'workload', label: 'Workload', desc: 'Beban kerja per orang', icon: ListChecks },
];

export default function ViewPicker({ onClose }: any) {
  const { addView } = useDashboard();
  const [q, setQ] = useState('');
  const filtered = VIEW_TYPES.filter(v => v.label.toLowerCase().includes(q.toLowerCase()) || v.desc.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="fixed inset-0 z-[80]" onClick={onClose}></div>
      <div className="absolute top-full left-0 mt-2 w-72 bg-kartu border border-white/10 shadow-2xl rounded-xl z-[90] p-2 flex flex-col animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-2 bg-latar border border-white/10 rounded-lg px-2.5 py-1.5 mb-2">
          <Search size={13} className="text-gray-500" />
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Cari atau deskripsikan view…" className="bg-transparent outline-none text-[12px] text-gray-200 w-full" />
        </div>
        <div className="text-[10px] font-bold text-gray-500 uppercase px-2 py-1 tracking-wider">Tambah view</div>
        <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
          {filtered.map(v => {
            const Icon = v.icon;
            return (
              <button key={v.type} onClick={() => { addView(v.type); onClose(); }} className="flex items-center gap-3 px-2.5 py-2 hover:bg-white/5 rounded-lg text-left transition-colors group/vt">
                <span className="w-8 h-8 rounded-lg bg-kartu-hover group-hover/vt:bg-kartu-hover flex items-center justify-center text-blue-400 shrink-0 transition-colors"><Icon size={16} /></span>
                <div className="min-w-0">
                  <div className="text-[13px] text-gray-200 font-semibold">{v.label}</div>
                  <div className="text-[11px] text-gray-500 truncate">{v.desc}</div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="text-[12px] text-gray-500 px-2.5 py-3 text-center">Tidak ada jenis view yang cocok.</div>}
        </div>
      </div>
    </>
  );
}
