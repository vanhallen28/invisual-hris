'use client';
import React from 'react';
import { GripVertical, CornerDownRight, Trash2, MessageSquare, Plus } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import InlineEdit from './InlineEdit';
import TableCell from './TableCell';
import ColumnCenterMenu from './ColumnCenter';

export default function TableRow({ item, group, gridTemplateColumns, subGridTemplateColumns, addColMenuTarget, setAddColMenuTarget }: any) {
  const { 
    boardData, setBoardData, setBoardsDataMap, activeBoardId, columns, subColumns, setSubColumns, hiddenColumns,
    selectedItems, setSelectedItems, draggedItem, setDraggedItem, 
    dragOverItem, setDragOverItem, triggerConfirm, handleUpdateItem, 
    handleUpdateSubItem, handleDeleteItem, handleDeleteSubItem,
    handleAddSubItem, handleDeleteSubColumn, setDetailItem, openDropdown, updateGroup,
    insertItemBelow, insertSubBelow, moveItem
  } = useDashboard();

  const isItemRowActive = openDropdown?.itemId === item.id && !openDropdown?.subItemId;
  const isSubRowActive = addColMenuTarget?.id === item.id || item.subItems?.some((s:any) => openDropdown?.subItemId === s.id || addColMenuTarget?.id === s.id);

  // (4) Rollup progress sub-item — pakai kolom sub bertipe checkbox bila ada
  const doneCol = subColumns.find((c:any) => c.type === 'checkbox');
  const subTotal = item.subItems?.length || 0;
  const subDone = doneCol ? (item.subItems || []).filter((s:any) => s[doneCol.id]).length : 0;

  // (2) Enter-to-add — tambah baris baru tepat DI BAWAH baris saat ini.
  // Pakai updater FUNGSIONAL setBoardsDataMap agar TIDAK menimpa rename yang baru
  // disimpan oleh onSave (keduanya dipanggil pada handler Enter yang sama).
  const addItemBelow = () => insertItemBelow(group.id, item.id);
  const addSubBelow = (subId: string) => insertSubBelow(group.id, item.id, subId);

  const handleDragStart = (e: any, groupId: string, itemId: string) => { setDraggedItem({ groupId, itemId }); e.dataTransfer.effectAllowed = 'move'; };
  const handleDropTable = (e: any, targetGroupId: string, targetItemId: string) => {
    e.preventDefault();
    if (draggedItem) moveItem(draggedItem.groupId, draggedItem.itemId, targetGroupId, targetItemId);
    setDraggedItem(null); setDragOverItem(null);
  };

  return (
    <div className={`flex flex-col relative ${isItemRowActive || isSubRowActive ? 'z-50' : 'z-10'}`}>
      
      {/* ====== BARIS ITEM UTAMA ====== */}
      <div onDragOver={e => { if (draggedItem) { e.preventDefault(); setDragOverItem({groupId:group.id, itemId:item.id}); } }} onDrop={e => handleDropTable(e, group.id, item.id)} onDragEnd={()=>{setDraggedItem(null);setDragOverItem(null);}} className={`group/row dwt-row-in grid items-stretch border-b border-white/10 relative text-[13px] ${selectedItems.includes(item.id) ? 'bg-blue-900/10' : 'bg-kartu hover:bg-kartu'} ${draggedItem?.itemId === item.id ? 'opacity-30' : ''} ${dragOverItem?.itemId === item.id ? 'border-t-2 border-t-blue-500' : ''} ${isItemRowActive ? 'z-30' : 'z-10'}`} style={{ gridTemplateColumns }}>
        
        <div className="px-1 flex items-center justify-between border-r border-white/10 pl-[6px] sticky left-0 z-[15] bg-kartu group-hover/row:bg-kartu">
          <span draggable onDragStart={e => handleDragStart(e, group.id, item.id)} onDragEnd={()=>{setDraggedItem(null);setDragOverItem(null);}} className="cursor-grab shrink-0 flex items-center" title="Geser untuk memindah"><GripVertical size={12} className="text-gray-600 opacity-0 group-hover/row:opacity-100 ml-0.5" /></span>
          <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => setSelectedItems((p:any) => p.includes(item.id) ? p.filter((i:any)=>i!==item.id) : [...p, item.id])} className="rounded bg-latar border-white/10 text-blue-500 cursor-pointer w-3.5 h-3.5 mx-auto" />
        </div>
        
        <div className="px-3 py-1.5 flex items-center border-r border-white/10 min-w-0 group/cell justify-between gap-2 sticky left-[40px] z-[15] bg-kartu group-hover/row:bg-kartu">
          <button onClick={() => handleUpdateItem(group.id, item.id, 'isSubItemsOpen', !item.isSubItemsOpen)} className={`p-0.5 rounded shrink-0 transition-colors ${item.isSubItemsOpen ? 'bg-blue-500/20 text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}><CornerDownRight size={13} /></button>
          <div className="flex-1 min-w-0">
            <InlineEdit value={item.name} onSave={(newVal: string) => handleUpdateItem(group.id, item.id, 'name', newVal)} onEnter={addItemBelow} textClassName="font-medium text-gray-200 text-left truncate" />
          </div>
          {subTotal > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              {doneCol ? (
                <>
                  <div className="h-1.5 w-10 rounded-full bg-white/5 overflow-hidden"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${subTotal ? (subDone / subTotal) * 100 : 0}%` }} /></div>
                  <span className="text-[10px] text-gray-500 font-semibold tabular-nums">{subDone}/{subTotal}</span>
                </>
              ) : (
                <span className="text-[10px] text-gray-500 font-semibold bg-white/5 px-1.5 py-0.5 rounded-full">{subTotal} sub</span>
              )}
            </div>
          )}
          <button onClick={() => setDetailItem({ groupId: group.id, itemId: item.id })} className="opacity-0 group-hover/cell:opacity-100 p-1 text-gray-500 hover:text-blue-400 transition-opacity shrink-0"><MessageSquare size={13}/></button>
        </div>

        {columns.map((col:any) => !hiddenColumns.includes(col.id) && (
          <TableCell key={col.id} type="item" item={item} group={group} col={col} />
        ))}
        
        {/* FITUR ADD COL DAN TRASH SEJAJAR DI SINI */}
        <div className="flex items-center justify-center border-r border-white/10 relative">
          <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-1.5 transition-opacity">
            <button onClick={() => setAddColMenuTarget({type: 'main', id: item.id})} className="text-gray-500 hover:text-blue-400 p-1" title="Add Column"><Plus size={14}/></button>
            <button onClick={() => triggerConfirm('Hapus Item', `Hapus "${item.name}"?`, () => handleDeleteItem(group.id, item.id))} className="text-gray-500 hover:text-red-400 p-1" title="Delete Item"><Trash2 size={14}/></button>
          </div>
          {addColMenuTarget?.id === item.id && addColMenuTarget.type === 'main' && <ColumnCenterMenu target="main" onClose={() => setAddColMenuTarget(null)} />}
        </div>
        
        <div className="w-full h-full bg-kartu"></div>
      </div>

      {/* ====== CONTAINER SUB-ITEM ====== */}
      {item.isSubItemsOpen && (
        <div className={`flex flex-col bg-kartu pl-[44px] pr-2 py-3 shadow-inner relative ${isSubRowActive ? 'z-20' : 'z-10'}`}>
          
          <div className="absolute left-[22px] top-0 bottom-[20px] w-[2px] z-0 opacity-50 pointer-events-none" style={{ backgroundColor: group.color }}></div>
          
          <div className={`grid items-center border border-white/10 bg-kartu text-[10px] font-bold text-gray-400 uppercase select-none rounded-t-md relative shadow-sm ${addColMenuTarget?.id === item.id ? 'z-40' : 'z-10'}`} style={{ gridTemplateColumns: subGridTemplateColumns }}>
            <div className="absolute left-[-22px] top-0 w-[22px] h-[50%] border-l-[2px] border-b-[2px] rounded-bl-[16px] z-0 opacity-50 pointer-events-none" style={{ borderColor: group.color }}></div>
            <div className="px-2 py-2 flex justify-center border-r border-white/10 relative z-10"><input type="checkbox" className="rounded bg-latar border-white/10 text-blue-500 cursor-pointer w-3.5 h-3.5" /></div>
            <div className="px-3 py-2 border-r border-white/10 flex items-center min-w-0 relative z-10">
               <div className="flex-1 min-w-0"><InlineEdit value={group.subItemLabel || 'Subitem'} onSave={(val: string) => updateGroup(group.id, { subItemLabel: val })} textClassName="text-gray-400 uppercase text-[10px] font-bold truncate hover:opacity-80" className="text-[10px] font-bold uppercase" /></div>
            </div>
            {subColumns.map((col:any) => (
              <div key={col.id} className="px-3 py-2 border-r border-white/10 flex items-center justify-between group/subcol min-w-0 relative z-10">
                <div className="flex-1 min-w-0 flex items-center justify-center"><InlineEdit value={col.label} onSave={(newVal: string) => setSubColumns(subColumns.map((c:any) => c.id === col.id ? { ...c, label: newVal } : c))} textClassName="text-center hover:text-white truncate" className="text-center text-[10px]" /></div>
                <button onClick={()=>triggerConfirm('Hapus Kolom Sub', `Hapus kolom ${col.label}?`, () => handleDeleteSubColumn(col.id))} className="text-gray-500 hover:text-red-400 opacity-0 group-hover/subcol:opacity-100 transition-opacity shrink-0 ml-1"><Trash2 size={11}/></button>
              </div>
            ))}
            <div className="relative flex h-full z-10 border-l border-white/10">
              <button onClick={() => setAddColMenuTarget({type: 'sub', id: item.id})} className="h-full w-full flex items-center justify-center hover:bg-kartu-hover transition-colors text-gray-400 rounded-tr-md" title="Add Sub Column Center"><Plus size={12}/></button>
              {addColMenuTarget?.id === item.id && addColMenuTarget.type === 'sub' && <ColumnCenterMenu target="sub" onClose={() => setAddColMenuTarget(null)} />}
            </div>
            <div className="h-full w-full bg-kartu rounded-tr-md z-10"></div>
          </div>

          <div className="flex flex-col border-x border-white/10 relative z-10">
            {item.subItems?.map((sub: any) => {
              const isSubActive = openDropdown?.subItemId === sub.id || addColMenuTarget?.id === sub.id;
              return (
                <div key={sub.id} className={`group/subrow dwt-row-in grid items-stretch hover:bg-kartu bg-kartu border-b border-white/10 text-xs relative ${isSubActive ? 'z-50' : 'z-10'}`} style={{ gridTemplateColumns: subGridTemplateColumns }}>
                  <div className="absolute left-[-22px] top-[-2px] w-[22px] h-[calc(50%+2px)] border-l-[2px] border-b-[2px] rounded-bl-[16px] z-0 opacity-50 pointer-events-none" style={{ borderColor: group.color }}></div>
                  <div className="px-1 flex items-center justify-center border-r border-white/10 relative z-10"><input type="checkbox" className="rounded bg-latar border-white/10 text-blue-500 cursor-pointer w-3.5 h-3.5 mx-auto" /></div>
                  <div className="px-3 py-1.5 flex items-center border-r border-white/10 min-w-0 justify-between relative z-10">
                    <div className="flex-1 min-w-0 pr-2">
                      <InlineEdit value={sub.name} onSave={(newVal: string) => handleUpdateSubItem(group.id, item.id, sub.id, 'name', newVal)} onEnter={() => addSubBelow(sub.id)} textClassName="font-medium text-gray-300 text-left truncate" />
                    </div>
                  </div>
                  {subColumns.map((col:any) => <TableCell key={col.id} type="sub" item={{ ...sub, parentId: item.id }} group={group} col={col} />)}
                  
                  {/* FITUR ADD COL DAN TRASH SEJAJAR UNTUK SUB-ITEM */}
                  <div className="flex items-center justify-center border-r border-white/10 relative z-10">
                    <div className="opacity-0 group-hover/subrow:opacity-100 flex items-center gap-1.5 transition-opacity">
                      <button onClick={() => setAddColMenuTarget({type: 'sub', id: sub.id})} className="text-gray-500 hover:text-blue-400 p-1" title="Add Column"><Plus size={13}/></button>
                      <button onClick={() => triggerConfirm('Hapus Sub', `Hapus "${sub.name}"?`, () => handleDeleteSubItem(group.id, item.id, sub.id))} className="text-gray-500 hover:text-red-400 p-1" title="Delete Subitem"><Trash2 size={13}/></button>
                    </div>
                    {addColMenuTarget?.id === sub.id && addColMenuTarget.type === 'sub' && <ColumnCenterMenu target="sub" onClose={() => setAddColMenuTarget(null)} />}
                  </div>

                  <div className="flex items-center justify-center bg-kartu relative z-10"></div>
                </div>
              )
            })}
          </div>

          <div className="border-x border-b border-white/10 bg-kartu rounded-b-md p-1.5 relative z-0">
            <div className="absolute left-[-22px] top-[-2px] w-[22px] h-[calc(50%+2px)] border-l-[2px] border-b-[2px] rounded-bl-[16px] z-0 opacity-50 pointer-events-none" style={{ borderColor: group.color }}></div>
            <button onClick={() => handleAddSubItem(group.id, item.id)} className="text-[11px] text-gray-400 hover:text-white px-3 py-1.5 rounded-md hover:bg-kartu-hover transition-colors flex items-center gap-1 relative z-10">+ Add subitem</button>
          </div>
        </div>
      )}
    </div>
  );
}