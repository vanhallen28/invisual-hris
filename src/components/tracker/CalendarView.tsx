'use client';
import React, { useState } from 'react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function CalendarView() {
  const { boardData, columns, labels, setDetailItem } = useDashboard();
  const [viewDate, setViewDate] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const dateCols = columns.filter((c: any) => c.type === 'date');
  const tlCols = columns.filter((c: any) => c.type === 'timeline');
  const statusCols = columns.filter((c: any) => c.type === 'status');

  const itemStatusColor = (item: any) => {
    for (const c of statusCols) { const v = item[c.id]; if (v) { const m = labels[c.id]?.find((l: any) => l.text === v); if (m) return m.color; } }
    return 'bg-zinc-600';
  };

  // Kumpulkan event: satu tanggal utama per item (date dulu, lalu timeline start)
  const events: Record<string, any[]> = {};
  boardData.forEach((g: any) => (g.items || []).forEach((it: any) => {
    let ds = '';
    for (const c of dateCols) { if (it[c.id]) { ds = it[c.id]; break; } }
    if (!ds) { for (const c of tlCols) { if (it[c.id]?.start) { ds = it[c.id].start; break; } } }
    if (!ds) return;
    const key = String(ds).slice(0, 10);
    if (!events[key]) events[key] = [];
    events[key].push({ item: it, group: g, color: itemStatusColor(it) });
  }));

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0 = Minggu
  const offset = (firstWeekday + 6) % 7; // mulai Senin
  const t = new Date();
  const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const totalEvents = Object.values(events).reduce((a, b) => a + b.length, 0);

  return (
    <div className="bg-[#20222b] border border-zinc-800/80 rounded-xl overflow-hidden">
      {/* Header bulan */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-base font-bold text-zinc-100 whitespace-nowrap">{MONTHS[month]} {year}</h2>
          <span className="text-[11px] text-zinc-500 truncate">{totalEvents > 0 ? `${totalEvents} item terjadwal` : 'Belum ada item bertanggal — tambah kolom Date / Timeline'}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
          <button onClick={() => { const d = new Date(); setViewDate(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="px-2.5 py-1 rounded-md hover:bg-zinc-800 text-[11px] font-semibold text-zinc-300 transition-colors">Hari ini</button>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Label hari */}
      <div className="grid grid-cols-7 border-b border-zinc-800/60">
        {DAYS.map(d => <div key={d} className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-500 text-center">{d}</div>)}
      </div>

      {/* Grid tanggal */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} className="border-r border-b border-zinc-800/40 bg-zinc-900/20 min-h-[96px]"></div>;
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEvents = events[key] || [];
          const isToday = key === todayStr;
          return (
            <div key={idx} className="border-r border-b border-zinc-800/40 p-1.5 min-h-[96px] flex flex-col gap-1 hover:bg-zinc-800/20 transition-colors">
              <div className={`text-[11px] font-semibold w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${isToday ? 'bg-blue-500 text-white' : 'text-zinc-400'}`}>{day}</div>
              <div className="flex flex-col gap-1 overflow-hidden">
                {dayEvents.slice(0, 4).map((ev, i) => (
                  <button key={i} onClick={() => setDetailItem({ groupId: ev.group.id, itemId: ev.item.id })} className="flex items-center gap-1.5 text-left px-1.5 py-1 rounded-md bg-zinc-800/60 hover:bg-zinc-700 transition-colors group/ev">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ev.color}`}></span>
                    <span className="text-[10px] text-zinc-300 group-hover/ev:text-white truncate">{ev.item.name}</span>
                  </button>
                ))}
                {dayEvents.length > 4 && <span className="text-[9px] text-zinc-500 px-1.5">+{dayEvents.length - 4} lagi</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
