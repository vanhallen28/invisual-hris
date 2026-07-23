'use client';
import React, { useState } from 'react';
import { Activity, CheckCircle2, Clock, User } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';

export default function Overview() {
  const { boardData, columns, labels, teamMembers, setDetailItem } = useDashboard();
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
