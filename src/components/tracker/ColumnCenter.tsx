'use client';
import React from 'react';
import { Search, BoxSelect, ChevronDown, CalendarDays, User, Hash, FileText, AlignLeft, CheckSquare, Network, Copy } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';

export default function ColumnCenterMenu({ target, onClose }: { target: 'main' | 'sub', onClose: () => void }) {
  const { handleAddDynamicColumn, copyParentColumns } = useDashboard();
  const handleSelect = (type: string, label: string) => { handleAddDynamicColumn(target, type, label); onClose(); };

  const columnsList = [
    { section: 'Essentials', items: [
      { type: 'status', label: 'Status', icon: <BoxSelect size={12}/>, color: 'bg-emerald-500' },
      { type: 'tags', label: 'Dropdown', icon: <ChevronDown size={12}/>, color: 'bg-emerald-500' },
      { type: 'text', label: 'Text', icon: <span className="font-bold text-xs">T</span>, color: 'bg-amber-500' },
      { type: 'date', label: 'Date', icon: <CalendarDays size={12}/>, color: 'bg-purple-500' },
      { type: 'team', label: 'People', icon: <User size={12}/>, color: 'bg-blue-500' },
      { type: 'number', label: 'Numbers', icon: <Hash size={12}/>, color: 'bg-amber-500' },
    ]},
    { section: 'Super useful', items: [
      { type: 'text', label: 'Files', icon: <FileText size={12}/>, color: 'bg-rose-400' },
      { type: 'timeline', label: 'Timeline', icon: <AlignLeft size={12}/>, color: 'bg-purple-500' },
      { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare size={12}/>, color: 'bg-orange-400' },
      { type: 'link', label: 'Link', icon: <Network size={12}/>, color: 'bg-rose-400' },
      { type: 'gdocs', label: 'Google Docs', icon: <FileText size={12}/>, color: 'bg-blue-500' },
    ]}
  ];

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onClose(); }}></div>
      <div className="absolute top-[120%] right-0 bg-[#2a2c38] border border-zinc-600 shadow-2xl rounded-xl z-50 p-4 w-[340px] animate-in fade-in zoom-in-95 cursor-default text-left flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
          <input placeholder="Search or describe your column" className="w-full bg-[#1e202a] border border-zinc-700 focus:border-blue-500 rounded-md pl-9 pr-3 py-2 text-[13px] text-white outline-none shadow-inner transition-colors min-w-0" />
        </div>
        {target === 'sub' && (
          <div>
            <h5 className="text-[11px] text-zinc-500 mb-2">Shortcuts</h5>
            <button onClick={() => { copyParentColumns(); onClose(); }} className="flex items-center gap-2 text-[13px] text-zinc-200 hover:text-white transition-colors w-full text-left p-1 rounded hover:bg-zinc-700/50"><Copy size={16} className="text-zinc-400"/> Copy parent columns</button>
          </div>
        )}
        {columnsList.map((sec, i) => (
          <div key={i}>
            <h5 className="text-[11px] text-zinc-500 mb-2">{sec.section}</h5>
            <div className="grid grid-cols-2 gap-y-3 gap-x-2">
              {sec.items.map((item, j) => (
                <button key={j} onClick={() => handleSelect(item.type, item.label)} className="flex items-center gap-2.5 text-[13px] text-zinc-200 hover:text-white transition-colors w-full text-left p-1 rounded hover:bg-zinc-700/50 group/colbtn">
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-white shadow-sm transition-transform group-hover/colbtn:scale-110 ${item.color}`}>{item.icon}</div>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}