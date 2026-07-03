'use client';
import React, { useState } from 'react';
import { Plus, ChevronDown, Pencil, Trash2, LayoutTemplate, Search, X } from 'lucide-react';
import Image from 'next/image';
import { useDashboard, makeDefaultViews } from '@/components/tracker/DashboardContext';

export default function Sidebar({ mobileOpen, setMobileOpen }: any) {
  const { 
    workspaces, setWorkspaces, activeWorkspaceId, activeBoardId, setActiveBoardId, inlineCreate, setInlineCreate, 
    inputValue, setInputValue, editingCell, setEditingCell, editValue, setEditValue, triggerConfirm, boardsDataMap, setBoardsDataMap, HEX_COLORS,
    addYear, addMonth, addBoard, renameNode, deleteNode
  } = useDashboard();

  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState('');

  const submitInlineCreate = (e?: React.FormEvent) => {
    if(e) e.preventDefault();
    if (!inputValue.trim()) { setInlineCreate({ type: '', parentId: null }); return; }
    if (inlineCreate.type === 'year') addYear(inputValue);
    else if (inlineCreate.type === 'month') addMonth(inlineCreate.parentId, inputValue);
    else if (inlineCreate.type === 'board') { addBoard(inlineCreate.parentId, inputValue); setMobileOpen?.(false); }
    setInlineCreate({ type: '', parentId: null }); setInputValue('');
  };

  const saveSidebarEdit = () => {
    if (!editingCell) return;
    renameNode(editingCell.type, editingCell.id, editValue);
    setEditingCell(null);
  };

  const toggleYear = (yearId: string) => setWorkspaces((ws:any) => ws.map((w:any) => w.id === activeWorkspaceId ? { ...w, years: w.years.map((y:any) => y.id === yearId ? { ...y, isOpen: !y.isOpen } : y) } : w));
  const toggleMonth = (yearId: string, monthId: string) => setWorkspaces((ws:any) => ws.map((w:any) => w.id === activeWorkspaceId ? { ...w, years: w.years.map((y:any) => y.id === yearId ? { ...y, months: y.months.map((m:any) => m.id === monthId ? { ...m, isOpen: !m.isOpen } : m) } : y) } : w));

  const handleDeleteYear = (yearId: string) => deleteNode('year', yearId);
  const handleDeleteMonth = (yearId: string, monthId: string) => deleteNode('month', monthId);
  const handleDeleteBoard = (monthId: string, boardId: string) => deleteNode('board', boardId);

  const openBoard = (boardId: string) => { setActiveBoardId(boardId); setMobileOpen?.(false); };

  // FILTER PENCARIAN: saat ada query, tampilkan hanya board yang cocok + paksa buka folder induknya
  const q = search.trim().toLowerCase();
  const activeWs = workspaces.find((w:any) => w.id === activeWorkspaceId) || workspaces[0];
  const filteredYears = (activeWs?.years || []).map((year: any) => {
    const months = (year.months || []).map((month: any) => {
      const boards = q ? (month.boards || []).filter((b: any) => b.name.toLowerCase().includes(q)) : (month.boards || []);
      return { ...month, boards, _open: q ? boards.length > 0 : month.isOpen };
    }).filter((m: any) => (q ? m.boards.length > 0 : true));
    return { ...year, months, _open: q ? months.length > 0 : year.isOpen };
  }).filter((y: any) => (q ? y.months.length > 0 : true));

  return (
    <>
      {/* OVERLAY (mobile saja) */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen?.(false)} />}

      {/* RAIL TIPIS saat di-collapse (desktop saja) */}
      {collapsed && (
        <div className="hidden md:flex flex-col items-center w-12 bg-[#15171e] border-r border-zinc-800/60 shrink-0 pt-5 z-20">
          <button onClick={() => setCollapsed(false)} className="p-2 text-zinc-400 hover:text-white transition-colors" title="Expand sidebar"><ChevronDown size={18} className="-rotate-90" /></button>
        </div>
      )}

      <div className={`bg-[#15171e] border-r border-zinc-800/60 flex flex-col shrink-0 z-50 md:z-20 shadow-xl h-full fixed md:static inset-y-0 left-0 w-[280px] transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${collapsed ? 'md:hidden' : ''}`}>
        <div className="px-5 pt-6 pb-4 flex flex-col gap-4 border-b border-zinc-800/50">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <Image src="/invisual-light.svg" alt="Invisual Studio" width={140} height={30} className="brightness-0 invert opacity-90 mb-1" />
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Workspace Management</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setCollapsed(true)} className="hidden md:block p-1.5 text-zinc-500 hover:text-white rounded transition-colors" title="Collapse sidebar"><ChevronDown size={16} className="rotate-90" /></button>
              <button onClick={() => setMobileOpen?.(false)} className="md:hidden p-1.5 text-zinc-500 hover:text-white rounded transition-colors"><X size={16} /></button>
            </div>
          </div>

          {/* SEARCH PROJECT */}
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 focus-within:border-blue-500 transition-colors">
            <Search size={13} className="text-zinc-500 shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari project..." className="bg-transparent text-xs text-zinc-200 outline-none w-full min-w-0" />
            {search && <X size={12} className="text-zinc-500 cursor-pointer hover:text-white shrink-0" onClick={() => setSearch('')} />}
          </div>

          {inlineCreate.type === 'year' ? (
            <form onSubmit={submitInlineCreate} className="flex gap-1.5">
              <input autoFocus value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={() => setInlineCreate({type: '', parentId: null})} placeholder="Year (e.g. 2026)..." className="bg-zinc-950 border border-blue-500 text-xs px-2.5 py-1.5 rounded w-full outline-none text-white shadow-inner"/>
            </form>
          ) : (
            <button onClick={() => { setInlineCreate({ type: 'year', parentId: null }); setInputValue(''); }} className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-md transition-colors flex items-center justify-center gap-2 shadow-sm">
              <Plus size={14} strokeWidth={3} /> New Workspace
            </button>
          )}
        </div>

        <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
          {filteredYears.map((year: any) => (
            <div key={year.id} className="flex flex-col gap-1">
              
              {/* LEVEL 1: YEAR */}
              <div className="flex items-center justify-between text-zinc-500 hover:text-zinc-300 transition-colors group/year">
                {editingCell?.type === 'year' && editingCell?.id === year.id ? (
                  <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveSidebarEdit} onKeyDown={e => { if(e.key === 'Enter') saveSidebarEdit(); else if(e.key === 'Escape') setEditingCell(null); }} className="bg-zinc-900 border border-blue-500 text-[11px] font-bold px-1 py-0.5 rounded w-full uppercase outline-none text-white" />
                ) : (
                  <div className="flex items-center gap-1.5 flex-1 cursor-pointer" onClick={() => toggleYear(year.id)}><ChevronDown size={14} className={`transition-transform ${year._open ? '' : '-rotate-90'}`} /><span className="text-[11px] font-bold uppercase tracking-wider truncate">{year.name}</span></div>
                )}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/year:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); setEditingCell({ type: 'year', id: year.id }); setEditValue(year.name); }} className="p-1 text-zinc-600 hover:text-blue-400 transition-colors"><Pencil size={13}/></button>
                  <button onClick={(e) => { e.stopPropagation(); setInlineCreate({ type: 'month', parentId: year.id }); setInputValue(''); if(!year.isOpen) toggleYear(year.id); }} className="p-1 text-zinc-600 hover:text-blue-400 transition-colors" title="Add Month Folder"><Plus size={15}/></button>
                  <button onClick={(e) => { e.stopPropagation(); triggerConfirm('Delete Year', `Hapus tahun "${year.name}"?`, () => handleDeleteYear(year.id)); }} className="p-1 text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={13}/></button>
                </div>
              </div>

              {year._open && (
                <div className="flex flex-col gap-1 mt-1 pl-2 border-l border-zinc-800/50 ml-1.5">
                  {year.months?.map((month: any) => (
                    <div key={month.id} className="flex flex-col gap-0.5">
                      
                      {/* LEVEL 2: MONTH */}
                      <div className="flex items-center justify-between text-zinc-500 hover:text-zinc-300 transition-colors py-1 group/month">
                        {editingCell?.type === 'month' && editingCell?.id === month.id ? (
                          <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveSidebarEdit} onKeyDown={e => { if(e.key === 'Enter') saveSidebarEdit(); else if(e.key === 'Escape') setEditingCell(null); }} className="bg-zinc-900 border border-blue-500 text-[10px] font-bold px-1 py-0.5 rounded w-full uppercase outline-none text-white ml-2" />
                        ) : (
                          <div className="flex items-center gap-1.5 flex-1 cursor-pointer pl-1" onClick={() => toggleMonth(year.id, month.id)}><ChevronDown size={12} className={`transition-transform ${month._open ? '' : '-rotate-90'}`} /><span className="text-[10px] font-bold uppercase tracking-wider truncate">{month.name}</span></div>
                        )}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/month:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); setEditingCell({ type: 'month', id: month.id }); setEditValue(month.name); }} className="p-1 text-zinc-600 hover:text-blue-400 transition-colors"><Pencil size={11}/></button>
                          <button onClick={(e) => { e.stopPropagation(); setInlineCreate({ type: 'board', parentId: month.id }); setInputValue(''); if(!month.isOpen) toggleMonth(year.id, month.id); }} className="p-1 text-zinc-600 hover:text-blue-400 transition-colors" title="Add Project"><Plus size={13}/></button>
                          <button onClick={(e) => { e.stopPropagation(); triggerConfirm('Delete Month', `Hapus bulan "${month.name}"?`, () => handleDeleteMonth(year.id, month.id)); }} className="p-1 text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={11}/></button>
                        </div>
                      </div>

                      {month._open && (
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          {/* LEVEL 3: BOARDS/PROJECTS */}
                          {month.boards?.map((board: any) => (
                            <div key={board.id} onClick={() => openBoard(board.id)} className={`flex items-center justify-between w-full text-left px-2 py-1.5 rounded text-xs font-medium tracking-wide transition-colors cursor-pointer group/board ${activeBoardId === board.id ? 'bg-[#1c3553] text-blue-200 border-l-2 border-blue-500' : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 ml-[2px]'}`}>
                              {editingCell?.type === 'board' && editingCell?.id === board.id ? (
                                <input autoFocus value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveSidebarEdit} onKeyDown={e => { if(e.key === 'Enter') saveSidebarEdit(); else if(e.key === 'Escape') setEditingCell(null); }} className="bg-zinc-900 border border-blue-500 text-xs px-1 py-0.5 rounded w-full outline-none text-white" />
                              ) : (
                                <div className="flex items-center gap-2 truncate flex-1 py-0.5 pl-1"><LayoutTemplate size={12} className={activeBoardId === board.id ? 'text-blue-400' : 'text-zinc-500'} /><span className="truncate">{board.name}</span></div>
                              )}
                              <div className="flex items-center gap-0.5 opacity-0 group-hover/board:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); setEditingCell({ type: 'board', id: board.id }); setEditValue(board.name); }} className="p-1 text-zinc-600 hover:text-blue-400 transition-colors"><Pencil size={11}/></button>
                                <button onClick={(e) => { e.stopPropagation(); triggerConfirm('Delete Project', `Hapus "${board.name}"?`, () => handleDeleteBoard(month.id, board.id)); }} className="p-1 text-zinc-600 hover:text-red-400 transition-colors"><Trash2 size={11} /></button>
                              </div>
                            </div>
                          ))}
                          {inlineCreate.type === 'board' && inlineCreate.parentId === month.id && (
                            <form onSubmit={submitInlineCreate} className="mt-1 pl-3"><input autoFocus value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={() => setInlineCreate({type:'', parentId:null})} placeholder="Project name..." className="bg-zinc-950 border border-zinc-700 text-[11px] px-2 py-1 rounded w-full outline-none text-white shadow-inner"/></form>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {inlineCreate.type === 'month' && inlineCreate.parentId === year.id && (
                    <form onSubmit={submitInlineCreate} className="mt-1 pl-1"><input autoFocus value={inputValue} onChange={e => setInputValue(e.target.value)} onBlur={() => setInlineCreate({type:'', parentId:null})} placeholder="Month name..." className="bg-zinc-950 border border-zinc-700 text-xs px-2 py-1 rounded w-full outline-none text-white shadow-inner"/></form>
                  )}
                </div>
              )}
            </div>
          ))}

          {q && filteredYears.length === 0 && (
            <div className="text-center text-xs text-zinc-600 px-2 py-8">Tidak ada project bernama &quot;{search}&quot;.</div>
          )}
        </div>
      </div>
    </>
  );
}
