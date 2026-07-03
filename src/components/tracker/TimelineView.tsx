'use client';
import React from 'react';
import { CalendarDays } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';

export default function TimelineView() {
  const { boardData, columns, setDetailItem } = useDashboard();

  // Timeline membaca kolom bertipe 'timeline' (start/end). Bila tidak ada,
  // jatuh ke kolom 'date' (dianggap tugas 1 hari).
  const timelineKey = columns.find((c: any) => c.type === 'timeline')?.id;
  const dateKey = columns.find((c: any) => c.type === 'date')?.id;

  const rows = boardData.flatMap((g: any) =>
    (g.items || []).map((it: any) => {
      const t = timelineKey ? it[timelineKey] : null;
      const startRaw = t?.start || (dateKey ? it[dateKey] : null);
      if (!startRaw) return null;
      const start = new Date(startRaw);
      if (isNaN(start.getTime())) return null;
      const endRaw = t?.end || startRaw;
      let end = new Date(endRaw);
      if (isNaN(end.getTime())) end = start;
      return { id: it.id, groupId: g.id, name: it.name, color: g.color, start, end };
    })
  ).filter(Boolean) as any[];

  if (rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 mt-4 py-16">
        <CalendarDays size={48} className="mb-4 text-blue-500/20" />
        <h3 className="text-zinc-300 font-bold mb-1">Belum ada data timeline</h3>
        <p className="text-sm text-zinc-500 max-w-md text-center">Tambahkan kolom <span className="text-zinc-300 font-semibold">Timeline</span> atau <span className="text-zinc-300 font-semibold">Date</span> di Main Table, lalu isi tanggalnya untuk melihat item terjadwal di sini.</p>
      </div>
    );
  }

  const minT = Math.min(...rows.map((r) => r.start.getTime()));
  const maxT = Math.max(...rows.map((r) => r.end.getTime()));
  const span = Math.max(86400000, maxT - minT); // minimal 1 hari agar tidak bagi nol
  const pct = (t: number) => ((t - minT) / span) * 100;

  // 5 penanda tanggal di sumbu atas
  const markers = Array.from({ length: 5 }, (_, i) => ({
    left: (i / 4) * 100,
    label: new Date(minT + (span * i) / 4).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="mt-4 bg-[#1e202a] border border-zinc-800/80 rounded-xl p-5 shadow-lg overflow-x-auto">
      <div className="min-w-[680px]">
        {/* SUMBU TANGGAL */}
        <div className="relative h-6 mb-3 ml-48 border-b border-zinc-800">
          {markers.map((m, i) => (
            <div key={i} className="absolute top-0 text-[10px] font-semibold text-zinc-500 -translate-x-1/2" style={{ left: `${m.left}%` }}>{m.label}</div>
          ))}
        </div>

        {/* BARIS ITEM */}
        <div className="flex flex-col gap-2">
          {rows.map((r) => {
            const left = pct(r.start.getTime());
            const width = Math.max(1.5, pct(r.end.getTime()) - left);
            return (
              <div key={r.id} onClick={() => setDetailItem({ groupId: r.groupId, itemId: r.id })} className="flex items-center h-8 rounded-md hover:bg-zinc-800/40 cursor-pointer transition-colors group/tl">
                <div className="w-48 shrink-0 pr-3 flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                  <span className="text-xs text-zinc-300 group-hover/tl:text-white truncate transition-colors" title={r.name}>{r.name}</span>
                </div>
                <div className="relative flex-1 h-full">
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-[3px] bg-zinc-800/60 rounded-full" />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-5 rounded-md flex items-center px-2 shadow-sm overflow-hidden min-w-[10px] group-hover/tl:ring-2 group-hover/tl:ring-white/30 transition-all"
                    style={{ left: `${left}%`, width: `${width}%`, backgroundColor: r.color }}
                    title={`${r.start.toLocaleDateString()} → ${r.end.toLocaleDateString()}`}
                  >
                    <span className="text-[10px] font-semibold text-white truncate">{r.name}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
