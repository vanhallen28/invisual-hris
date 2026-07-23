'use client';
import React from 'react';
import { CalendarDays, LayoutGrid } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import Avatar from '@/components/Avatar';

export default function KanbanBoard() {
  const { boardData, columns, labels, handleUpdateItem, draggedItem, setDraggedItem, dragOverColumn, setDragOverColumn, teamMembers, setDetailItem } = useDashboard();

  // Kanban groups by the board's Status column. Columns use generated ids,
  // so we resolve the real keys here instead of assuming fixed field names.
  const statusCol = columns.find((c: any) => c.type === 'status');
  const statusKey = statusCol?.id;
  const teamKey = columns.find((c: any) => c.type === 'team')?.id;
  const timelineKey = columns.find((c: any) => c.type === 'timeline')?.id;
  const tagsKey = columns.find((c: any) => c.type === 'tags')?.id;
  const dateKey = columns.find((c: any) => c.type === 'date')?.id;

  const formatDue = (d?: string) => {
    if (!d) return null;
    const due = new Date(d); if (isNaN(due.getTime())) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.ceil((due.getTime() - today.getTime()) / 86400000);
    const label = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const cls = diff < 0 ? 'text-red-400 bg-red-500/10' : diff <= 3 ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 bg-white/5';
    return { label, cls };
  };

  const allKanbanItems = boardData.reduce((acc: any, g: any) => [...acc, ...g.items.map((i: any) => ({ ...i, groupTitle: g.title, groupColor: g.color, groupId: g.id }))], []);

  const handleDragStart = (e: any, groupId: string, itemId: string) => { setDraggedItem({ groupId, itemId }); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e: any, status: string) => { e.preventDefault(); if (dragOverColumn !== status) setDragOverColumn(status); };
  const handleDrop = (e: any, status: string) => { e.preventDefault(); if (draggedItem && statusKey) handleUpdateItem(draggedItem.groupId, draggedItem.itemId, statusKey, status); setDraggedItem(null); setDragOverColumn(null); };

  if (!statusKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 mt-4 py-16">
        <LayoutGrid size={48} className="mb-4 text-blue-500/20" />
        <h3 className="text-gray-300 font-bold mb-1">Kanban needs a Status column</h3>
        <p className="text-sm text-gray-500 max-w-sm text-center">Go to Main Table, add a <span className="text-gray-300 font-semibold">Status</span> column, then drag cards between its values here.</p>
      </div>
    );
  }

  const statusColumns = [...(labels[statusKey] || []), { id: 'empty', text: '', color: 'bg-kartu-hover' }];

  return (
    <div className="flex gap-6 overflow-x-auto pb-8 flex-1 items-start mt-4">
      {statusColumns.map((col: any) => {
        const items = allKanbanItems.filter((i: any) => (i[statusKey] || '') === col.text);
        return (
          <div key={col.id} onDragOver={e => handleDragOver(e, col.text)} onDrop={e => handleDrop(e, col.text)} className={`w-[320px] shrink-0 flex flex-col rounded-xl border bg-kartu-hover max-h-full ${dragOverColumn === col.text ? 'border-blue-500 bg-kartu' : 'border-white/10'}`}>
            <div className="p-4 border-b border-white/10 bg-kartu-hover rounded-t-xl sticky top-0"><div className="flex justify-between mb-2"><h3 className={`text-xs font-bold text-white px-2.5 py-1 rounded ${col.color || 'bg-kartu-hover'}`}>{col.text || 'No Status'}</h3><span className="text-xs text-gray-500 font-bold bg-white/5 px-2 py-0.5 rounded">{items.length}</span></div></div>
            <div className="p-3 flex flex-col gap-3 overflow-y-auto">
              {items.map((item: any) => {
                 const tags = tagsKey ? (item[tagsKey] || []) : [];
                 const due = formatDue((dateKey && item[dateKey]) || item[timelineKey]?.end || item[timelineKey]?.start);
                 const assignees = (teamKey ? item[teamKey] : []) || [];
                 return (
                 <div key={item.id} draggable onDragStart={e => handleDragStart(e, item.groupId, item.id)} onDragEnd={() => setDraggedItem(null)} onClick={() => setDetailItem({ groupId: item.groupId, itemId: item.id })} className="bg-kartu rounded-lg p-4 border border-white/10 cursor-pointer hover:border-blue-500/60 hover:bg-kartu-hover transition-all" style={{ borderLeftColor: item.groupColor, borderLeftWidth: '3px' }}>
                    <div className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: item.groupColor }}>{item.groupTitle}</div>
                    <h4 className="text-[14px] font-bold text-gray-100 mb-2">{item.name}</h4>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {tags.map((t: string) => <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white ${labels[tagsKey]?.find((l: any) => l.text === t)?.color || 'bg-kartu-hover'}`}>{t}</span>)}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] text-gray-400">
                      {due ? <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${due.cls}`}><CalendarDays size={11}/> {due.label}</span> : <span className="text-gray-600">—</span>}
                      <div className="flex -space-x-1">{assignees.map((tid: string) => { const tm = teamMembers.find((t: any) => t.id === tid); return <Avatar key={tid} url={tm?.avatarUrl} name={tm?.name} initials={tm?.initials} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black text-white ${tm?.color || 'bg-kartu-hover'} border border-white/10`} />; })}</div>
                    </div>
                 </div>
                 );
               })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
