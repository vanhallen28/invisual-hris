'use client';
import React, { useState } from 'react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import ViewPicker from './ViewPicker';
import { Columns, LayoutGrid, BarChart3, CalendarDays, ListChecks, Plus, GripVertical, MoreHorizontal, Copy, Trash2 } from 'lucide-react';

const ICONS: any = { table: Columns, kanban: LayoutGrid, gantt: CalendarDays, chart: BarChart3, calendar: CalendarDays, workload: ListChecks };

export default function ViewTabs() {
  const { views, activeView, activeViewId, setActiveViewId, renameView, deleteView, duplicateView, reorderViews } = useDashboard();
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const myTasksActive = activeViewId === 'mytasks';

  const commitRename = (id: string, val: string) => {
    if (val.trim()) renameView(id, val.trim());
    setEditingId(null);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 text-xs font-bold mt-2">
      {views.map((v: any) => {
        const Icon = ICONS[v.type] || Columns;
        const active = !myTasksActive && activeView?.id === v.id;
        return (
          <div key={v.id}
            onDragOver={e => { if (draggedId) { e.preventDefault(); setDragOverId(v.id); } }}
            onDrop={e => { if (draggedId) { e.preventDefault(); reorderViews(draggedId, v.id); setDraggedId(null); setDragOverId(null); } }}
            className={`group/tab relative flex items-center gap-1.5 pb-3 pt-1 px-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${active ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'} ${dragOverId === v.id && draggedId && draggedId !== v.id ? 'bg-blue-500/10' : ''} ${draggedId === v.id ? 'opacity-40' : ''}`}>
            <span draggable onDragStart={e => { setDraggedId(v.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDraggedId(null); setDragOverId(null); }} className="cursor-grab text-gray-600 hover:text-gray-300 opacity-0 group-hover/tab:opacity-100 transition-opacity shrink-0" title="Tarik untuk urutkan"><GripVertical size={12} /></span>
            <Icon size={14} className="shrink-0" />
            {editingId === v.id ? (
              <input autoFocus defaultValue={v.name} onClick={e => e.stopPropagation()}
                onBlur={e => commitRename(v.id, e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(v.id, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingId(null); }}
                className="bg-latar border border-blue-500 rounded px-1.5 py-0.5 text-[12px] text-white outline-none w-28" />
            ) : (
              <button onClick={() => setActiveViewId(v.id)} onDoubleClick={() => setEditingId(v.id)} className="outline-none">{v.name}</button>
            )}
            <button onClick={() => setMenuFor(menuFor === v.id ? null : v.id)} className="opacity-0 group-hover/tab:opacity-100 text-gray-500 hover:text-gray-200 transition-opacity shrink-0"><MoreHorizontal size={14} /></button>
            {menuFor === v.id && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuFor(null)}></div>
                <div className="absolute top-full left-0 mt-1 w-40 bg-kartu border border-white/10 shadow-2xl rounded-lg z-[70] p-1 flex flex-col animate-in fade-in zoom-in-95">
                  <button onClick={() => { setEditingId(v.id); setMenuFor(null); }} className="text-left text-[12px] px-2.5 py-1.5 hover:bg-white/5 rounded-md text-gray-200 transition-colors">Ganti nama</button>
                  <button onClick={() => { duplicateView(v.id); setMenuFor(null); }} className="flex items-center gap-2 text-left text-[12px] px-2.5 py-1.5 hover:bg-white/5 rounded-md text-gray-200 transition-colors"><Copy size={12} /> Duplikat</button>
                  {views.length > 1 && <button onClick={() => { deleteView(v.id); setMenuFor(null); }} className="flex items-center gap-2 text-left text-[12px] px-2.5 py-1.5 hover:bg-red-500/10 rounded-md text-red-400 transition-colors"><Trash2 size={12} /> Hapus</button>}
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Tombol + (popup absolute, menempel di bawah tombol) */}
      <div className="relative shrink-0">
        <button onClick={() => setPicker(!picker)} className="pb-3 pt-1 px-2 text-gray-500 hover:text-blue-400 transition-colors" title="Tambah view"><Plus size={16} /></button>
        {picker && <ViewPicker onClose={() => setPicker(false)} />}
      </div>

      <div className="mx-2 w-px h-5 bg-kartu-hover shrink-0 self-center mb-3"></div>

      {/* My Tasks — global, di luar sistem view per-board */}
      <button onClick={() => setActiveViewId('mytasks')} className={`flex items-center gap-1.5 pb-3 pt-1 px-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 ${myTasksActive ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}><ListChecks size={14} /> My Tasks</button>
    </div>
  );
}
