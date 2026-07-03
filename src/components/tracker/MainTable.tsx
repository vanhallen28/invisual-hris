'use client';
import React, { useState } from 'react';
import { Plus, Search, ChevronDown, ChevronUp, EyeOff, X, Trash2, Check, Filter, Inbox, GripVertical } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import InlineEdit from './InlineEdit';
import ColumnCenterMenu from './ColumnCenter';
import TableRow from './TableRow';

export default function MainTable() {
  const { 
    boardData, setBoardData, columns, setColumns, subColumns, hiddenColumns, setHiddenColumns, 
    searchQuery, setSearchQuery, sortConfig, setSortConfig, teamMembers, labels,
    isHideMenuOpen, setIsHideMenuOpen, triggerConfirm, handleDeleteColumn, HEX_COLORS,
    toggleGroupSelection, handleAddItem, handleAddGroup, updateGroup, handleDeleteGroup, reorderColumns, reorderGroups, updateColumnLabel, openDropdown
  } = useDashboard();

  const [addColMenuTarget, setAddColMenuTarget] = useState<{ type: 'main'|'sub', id: string } | null>(null);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterMenu, setFilterMenu] = useState<'person' | 'status' | null>(null);

  // === DRAG-REORDER kolom & grup ===
  const [draggedCol, setDraggedCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [dragOverGroup, setDragOverGroup] = useState<string | null>(null);

  // reorderColumns / reorderGroups sekarang dari context (cloud-aware)

  const peopleColId = columns.find((c:any) => c.type === 'team')?.id;
  const statusColId = columns.find((c:any) => c.type === 'status')?.id;
  const statusOptions = statusColId ? (labels[statusColId] || []) : [];
  const activeFilters = (filterPerson ? 1 : 0) + (filterStatus ? 1 : 0);

  const mainColsCSS = columns.length > 0 ? columns.filter((c:any) => !hiddenColumns.includes(c.id)).map((c:any) => c.width || '130px').join(' ') : '';
  const subColsCSS = subColumns.length > 0 ? subColumns.map((c:any) => c.width || '130px').join(' ') : '';
  
  // DIPERLEBAR MENJADI 64px AGAR DUA IKON (PLUS & TRASH) SEJAJAR SEMPURNA!
  const gridTemplateColumns = `40px 320px ${mainColsCSS} 64px minmax(0, 1fr)`;
  const subGridTemplateColumns = `40px 280px ${subColsCSS} 64px minmax(0, 1fr)`;

  return (
    <>
      <div className="flex flex-wrap items-center gap-4 mb-6 shrink-0">
        <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs focus-within:border-blue-500 transition-colors">
          <Search size={14} className="text-zinc-500"/>
          <input autoComplete="off" spellCheck="false" type="text" placeholder="Search task/tag..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent outline-none text-zinc-200 w-44 min-w-0"/>
          {searchQuery && <X size={14} className="text-zinc-500 cursor-pointer hover:text-white" onClick={() => setSearchQuery('')}/>}
        </div>
        <div className="w-[1px] h-6 bg-zinc-700 mx-2"></div>
        <div className="relative">
          <button onClick={() => setIsHideMenuOpen(!isHideMenuOpen)} className={`flex items-center gap-1.5 text-sm transition-colors ${hiddenColumns.length > 0 ? 'text-blue-400 hover:text-blue-300' : 'text-zinc-400 hover:text-zinc-200'}`}>
            <EyeOff size={16}/> Hide {hiddenColumns.length > 0 ? `(${hiddenColumns.length})` : ''}
          </button>
          {isHideMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsHideMenuOpen(false)}></div>
              <div className="absolute top-full left-0 mt-2 w-48 bg-[#2a2c38] border border-zinc-700/50 shadow-2xl rounded-xl z-50 p-2 flex flex-col gap-1 animate-in fade-in zoom-in-95">
                <div className="text-[10px] font-bold text-zinc-500 uppercase px-2 py-1 tracking-wider">Toggle Columns</div>
                {columns.map((col:any) => {
                  const isHidden = hiddenColumns.includes(col.id);
                  return <button key={col.id} onClick={() => setHiddenColumns((p:any) => p.includes(col.id) ? p.filter((id:any)=>id!==col.id) : [...p, col.id])} className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-zinc-700/50 rounded-lg text-[13px] text-zinc-200 text-left transition-colors"><div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center ${!isHidden ? 'bg-blue-600 border-blue-600' : 'border-zinc-500'}`}>{!isHidden && <Check size={10} strokeWidth={3} className="text-white"/>}</div>{col.label}</button>
                })}
              </div>
            </>
          )}
        </div>
        {(peopleColId || statusColId) && (
          <>
            <div className="w-[1px] h-6 bg-zinc-700 mx-1"></div>
            {peopleColId && (
              <div className="relative">
                <button onClick={() => setFilterMenu(filterMenu === 'person' ? null : 'person')} className={`flex items-center gap-1.5 text-sm transition-colors ${filterPerson ? 'text-blue-400 hover:text-blue-300' : 'text-zinc-400 hover:text-zinc-200'}`}>
                  <Filter size={15}/> {filterPerson ? (teamMembers.find((m:any) => m.id === filterPerson)?.name || 'Person') : 'Person'}
                </button>
                {filterMenu === 'person' && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFilterMenu(null)}></div>
                    <div className="absolute top-full left-0 mt-2 w-52 bg-[#2a2c38] border border-zinc-700/50 shadow-2xl rounded-xl z-50 p-2 flex flex-col gap-0.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95">
                      <button onClick={() => { setFilterPerson(null); setFilterMenu(null); }} className="text-left text-[13px] px-2.5 py-1.5 hover:bg-zinc-700/50 rounded-lg text-zinc-400 transition-colors">All people</button>
                      {teamMembers.map((m:any) => (
                        <button key={m.id} onClick={() => { setFilterPerson(m.id); setFilterMenu(null); }} className="flex items-center gap-2 text-[13px] px-2.5 py-1.5 hover:bg-zinc-700/50 rounded-lg text-zinc-200 text-left transition-colors">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${m.color}`}>{m.initials}</span>
                          <span className="truncate">{m.name}</span>
                          {filterPerson === m.id && <Check size={12} className="text-blue-400 ml-auto shrink-0"/>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {statusColId && (
              <div className="relative">
                <button onClick={() => setFilterMenu(filterMenu === 'status' ? null : 'status')} className={`flex items-center gap-1.5 text-sm transition-colors ${filterStatus ? 'text-blue-400 hover:text-blue-300' : 'text-zinc-400 hover:text-zinc-200'}`}>
                  <Filter size={15}/> {filterStatus || 'Status'}
                </button>
                {filterMenu === 'status' && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setFilterMenu(null)}></div>
                    <div className="absolute top-full left-0 mt-2 w-52 bg-[#2a2c38] border border-zinc-700/50 shadow-2xl rounded-xl z-50 p-2 flex flex-col gap-0.5 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95">
                      <button onClick={() => { setFilterStatus(null); setFilterMenu(null); }} className="text-left text-[13px] px-2.5 py-1.5 hover:bg-zinc-700/50 rounded-lg text-zinc-400 transition-colors">All statuses</button>
                      {statusOptions.map((l:any) => (
                        <button key={l.id} onClick={() => { setFilterStatus(l.text); setFilterMenu(null); }} className="flex items-center gap-2 text-[13px] px-2.5 py-1.5 hover:bg-zinc-700/50 rounded-lg text-zinc-200 text-left transition-colors">
                          <span className={`w-3 h-3 rounded-sm shrink-0 ${l.color}`}></span>
                          <span className="truncate">{l.text}</span>
                          {filterStatus === l.text && <Check size={12} className="text-blue-400 ml-auto shrink-0"/>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            {activeFilters > 0 && (
              <button onClick={() => { setFilterPerson(null); setFilterStatus(null); }} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-red-400 transition-colors"><X size={13}/> Clear ({activeFilters})</button>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col gap-10">
        {boardData.map((group:any) => {
          let filteredItems = group.items;
          if (searchQuery) filteredItems = group.items.filter((i: any) => i.name?.toLowerCase().includes(searchQuery.toLowerCase()) || i.tags?.some((t:string) => t.toLowerCase().includes(searchQuery.toLowerCase())));
          if (filterPerson && peopleColId) filteredItems = filteredItems.filter((i: any) => Array.isArray(i[peopleColId]) && i[peopleColId].includes(filterPerson));
          if (filterStatus && statusColId) filteredItems = filteredItems.filter((i: any) => i[statusColId] === filterStatus);
          if (sortConfig) filteredItems = [...filteredItems].sort((a:any,b:any) => { let vA = a[sortConfig.key]||''; let vB = b[sortConfig.key]||''; if(sortConfig.key==='timeline'){vA=a.timeline?.start||'';vB=b.timeline?.start||'';} return vA<vB?(sortConfig.direction==='asc'?-1:1):(sortConfig.direction==='asc'?1:-1); });

          // Any popup (status/dropdown/people/timeline cell, or an add-column menu)
          // open inside THIS group? If so, lift the whole group above sibling groups
          // so its overflowing popup isn't painted over by the group below.
          const hasOpenPopup =
            openDropdown?.groupId === group.id ||
            (addColMenuTarget && (
              addColMenuTarget.id === group.id ||
              group.items.some((it:any) =>
                it.id === addColMenuTarget.id ||
                it.subItems?.some((s:any) => s.id === addColMenuTarget.id)
              )
            ));

          const groupTotal = (group.items || []).length;
          const statusDist = statusColId
            ? statusOptions.map((l:any) => ({ id: l.id, color: l.color, text: l.text, n: (group.items || []).filter((i:any) => i[statusColId] === l.text).length })).filter((x:any) => x.n > 0)
            : [];

          return (
            <div key={group.id}
              onDragOver={e => { if (draggedGroup) { e.preventDefault(); setDragOverGroup(group.id); } }}
              onDrop={e => { if (draggedGroup) { e.preventDefault(); reorderGroups(draggedGroup, group.id); setDraggedGroup(null); setDragOverGroup(null); } }}
              className={`flex flex-col group/board pb-8 relative ${hasOpenPopup ? 'z-50' : 'z-10'} ${dragOverGroup === group.id && draggedGroup && draggedGroup !== group.id ? 'outline outline-2 outline-blue-500/70 outline-offset-2 rounded' : ''} ${draggedGroup === group.id ? 'opacity-40' : ''}`}>
              <div className="flex items-center gap-2 mb-3 select-none">
                <span draggable onDragStart={e => { setDraggedGroup(group.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDraggedGroup(null); setDragOverGroup(null); }} className="cursor-grab text-zinc-600 hover:text-zinc-300 opacity-0 group-hover/board:opacity-100 transition-opacity shrink-0" title="Tarik untuk pindah grup"><GripVertical size={14}/></span>
                <ChevronDown size={18} style={{ color: group.color }} className={`cursor-pointer transition-transform ${group.isCollapsed ? '-rotate-90' : ''}`} onClick={() => updateGroup(group.id, { isCollapsed: !group.isCollapsed })} />
                <div style={{ color: group.color }} className="flex-1 min-w-0 max-w-sm flex items-center">
                  <InlineEdit value={group.title} onSave={(newVal: string) => updateGroup(group.id, { title: newVal })} textClassName="text-md font-bold tracking-wide hover:opacity-80 transition-opacity truncate" className="text-md font-bold px-2 py-0.5" />
                </div>
                {groupTotal > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full">{groupTotal} item{groupTotal > 1 ? 's' : ''}</span>
                    {statusDist.length > 0 && (
                      <div className="flex h-1.5 w-28 rounded-full overflow-hidden bg-zinc-800/80" title={statusDist.map((s:any) => `${s.text}: ${s.n}`).join('  ·  ')}>
                        {statusDist.map((s:any) => <div key={s.id} className={s.color} style={{ width: `${(s.n / groupTotal) * 100}%` }} />)}
                      </div>
                    )}
                  </div>
                )}
                <button onClick={() => triggerConfirm('Hapus Grup', 'Hapus grup ini?', () => handleDeleteGroup(group.id))} className="opacity-0 group-hover/board:opacity-100 text-zinc-600 hover:text-red-400 p-1 transition-opacity"><Trash2 size={14}/></button>
              </div>

              {!group.isCollapsed && (
                <div className="flex flex-col bg-[#20222b] border border-zinc-800/80 rounded-md min-w-max shadow-lg relative">
                  
                  <div className="absolute left-0 top-0 bottom-0 z-30 pointer-events-none rounded-tl-md" style={{ width: '6px', backgroundColor: group.color, clipPath: 'polygon(0 0, 100% 0, 3px 100%, 0 100%)' }} />

                  {/* HEADER TABEL UTAMA */}
                  <div className={`grid items-center border-b border-zinc-800 bg-[#1e202a] text-[11px] font-bold text-zinc-400 uppercase select-none rounded-t-md relative ${addColMenuTarget?.id === group.id ? 'z-40' : 'z-10'}`} style={{ gridTemplateColumns }}>
                    <div className="px-2 py-3 flex justify-center pl-[6px] sticky left-0 z-20 bg-[#1e202a]"><input type="checkbox" onChange={() => toggleGroupSelection(group)} className="rounded bg-zinc-950 border-zinc-700 text-blue-500 cursor-pointer w-3.5 h-3.5" /></div>
                    
                    <div className="px-3 py-3 border-r border-zinc-800/60 flex items-center justify-between gap-1 group/namecol transition-colors min-w-0 sticky left-[40px] z-20 bg-[#1e202a]">
                       <div className="flex-1 min-w-0">
                          <InlineEdit value={group.itemLabel || 'Item Name'} onSave={(val: string) => updateGroup(group.id, { itemLabel: val })} textClassName="text-zinc-400 uppercase text-[11px] font-bold truncate hover:opacity-80" className="text-[11px] font-bold uppercase" />
                       </div>
                       <button onClick={()=>setSortConfig((s:any)=>({key:'name', direction: s?.direction==='asc'?'desc':'asc'}))} className="text-zinc-500 group-hover/namecol:text-blue-400 shrink-0">
                         {sortConfig?.key==='name' && (sortConfig.direction==='asc'?<ChevronDown size={12}/>:<ChevronUp size={12}/>)}
                         {sortConfig?.key!=='name' && <ChevronDown size={12} className="opacity-0 group-hover/namecol:opacity-100"/>}
                       </button>
                    </div>

                    {columns.map((col:any) => !hiddenColumns.includes(col.id) && (
                      <div key={col.id}
                        onDragOver={e => { if (draggedCol) { e.preventDefault(); setDragOverCol(col.id); } }}
                        onDrop={e => { if (draggedCol) { e.preventDefault(); reorderColumns(draggedCol, col.id); setDraggedCol(null); setDragOverCol(null); } }}
                        className={`px-3 py-3 border-r border-zinc-800/60 flex items-center justify-between gap-1.5 group/col transition-colors min-w-0 relative ${dragOverCol === col.id && draggedCol && draggedCol !== col.id ? 'bg-blue-500/15' : ''} ${draggedCol === col.id ? 'opacity-40' : ''}`}>
                        <span draggable onDragStart={e => { setDraggedCol(col.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDraggedCol(null); setDragOverCol(null); }} className="cursor-grab text-zinc-600 hover:text-zinc-300 opacity-0 group-hover/col:opacity-100 transition-opacity shrink-0" title="Tarik untuk pindah kolom"><GripVertical size={11}/></span>
                        <div className="flex-1 min-w-0 flex items-center justify-center">
                          <InlineEdit value={col.label} onSave={(newVal: string) => updateColumnLabel(col.id, newVal)} textClassName="text-center hover:text-white truncate" className="text-center text-xs" />
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/col:opacity-100 transition-opacity shrink-0">
                           <button onClick={()=>setSortConfig((s:any)=>({key:col.id, direction: s?.direction==='asc'?'desc':'asc'}))} className="text-zinc-500 hover:text-blue-400 shrink-0"><ChevronDown size={12}/></button>
                           <button onClick={()=>triggerConfirm('Hapus Kolom', `Yakin ingin menghapus kolom ${col.label}?`, () => handleDeleteColumn(col.id))} className="text-zinc-500 hover:text-red-400 shrink-0"><Trash2 size={12}/></button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="relative flex h-full border-l border-zinc-800/60">
                      <button onClick={() => setAddColMenuTarget({type: 'main', id: group.id})} className="h-full w-full hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors" title="Add Column"><Plus size={14} /></button>
                      {addColMenuTarget?.id === group.id && addColMenuTarget.type === 'main' && <ColumnCenterMenu target="main" onClose={() => setAddColMenuTarget(null)} />}
                    </div>
                    <div className="h-full w-full bg-[#1e202a] rounded-tr-md"></div>
                  </div>

                  {filteredItems.length === 0 && (
                    <div className="px-6 py-10 flex flex-col items-center justify-center gap-3 text-center border-b border-zinc-800/40 relative z-20">
                      {(activeFilters > 0 || searchQuery) ? (
                        <>
                          <Search size={28} className="text-zinc-700" />
                          <p className="text-sm text-zinc-500">Tidak ada item yang cocok dengan pencarian/filter.</p>
                          <button onClick={() => { setSearchQuery(''); setFilterPerson(null); setFilterStatus(null); }} className="text-xs font-semibold text-blue-400 hover:text-blue-300">Reset semua</button>
                        </>
                      ) : (
                        <>
                          <Inbox size={28} className="text-zinc-700" />
                          <p className="text-sm text-zinc-500">Grup ini masih kosong.</p>
                          <button onClick={() => handleAddItem(group.id)} className="text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"><Plus size={13}/> Tambah item pertama</button>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col relative z-20">
                    {filteredItems.map((item: any) => (
                      <TableRow 
                        key={item.id} item={item} group={group} 
                        gridTemplateColumns={gridTemplateColumns} 
                        subGridTemplateColumns={subGridTemplateColumns}
                        addColMenuTarget={addColMenuTarget} 
                        setAddColMenuTarget={setAddColMenuTarget}
                      />
                    ))}
                  </div>

                  <div className="grid items-center border-t border-zinc-800 bg-[#20222b] h-[34px] rounded-b-md relative z-0" style={{ gridTemplateColumns }}>
                    <div className="absolute left-0 top-0 bottom-0 z-30 pointer-events-none rounded-bl-md" style={{ width: '6px', backgroundColor: group.color, clipPath: 'polygon(0 0, 100% 0, 50% 100%, 0 100%)' }} />

                    <div className="h-full border-r border-zinc-800/50 pl-[6px] sticky left-0 z-20 bg-[#20222b]"></div>
                    <div className="px-4 py-1 h-full flex items-center text-[12px] text-zinc-400 font-bold hover:bg-[#282a36] cursor-pointer transition-colors border-r border-zinc-800/50 sticky left-[40px] z-20 bg-[#20222b]" onClick={() => handleAddItem(group.id)}>+ Add item</div>
                    {columns.map((col:any) => {
                      if (hiddenColumns.includes(col.id)) return null;
                      return <div key={col.id} className="h-full border-r border-zinc-800/50"></div>;
                    })}
                    <div className="h-full"></div>
                    <div className="h-full w-full bg-[#20222b] rounded-br-md"></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <button onClick={handleAddGroup} className="flex items-center gap-2 px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white rounded-md w-fit bg-[#1e202a] font-bold text-xs transition-colors shadow-sm"><Plus size={14} /> Add New Group</button>
      </div>
    </>
  );
}