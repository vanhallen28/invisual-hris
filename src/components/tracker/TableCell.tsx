'use client';
import React, { useState } from 'react';
import { ChevronDown, Check, Trash2, Tag, User, CalendarDays, Plus, FileText } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import Avatar from '@/components/Avatar';
import InlineEdit from './InlineEdit';
import { namaPendek, cocokNama } from '@/lib/tracker/nama';

export default function TableCell({ type, item, group, col }: any) {
  const { 
    boardData, setBoardData, teamMembers, setTeamMembers, labels, setLabels,
    openDropdown, setOpenDropdown, newLabelText, setNewLabelText, 
    newMemberName, setNewMemberName, tempTimeline, setTempTimeline, 
    triggerConfirm, handleDeleteTeamMember, handleDeleteLabel, addLabelOption, updateLabelColor, HEX_COLORS, LABEL_COLORS, openDocEditor,
    handleUpdateItem, handleUpdateSubItem 
  } = useDashboard();

  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [newLabelColor, setNewLabelColor] = useState<string>('');

  const isSub = type === 'sub';
  const actualItemId = isSub ? item.parentId : item.id;
  const actualSubItemId = isSub ? item.id : undefined;

  const isDrop = openDropdown?.itemId === actualItemId && openDropdown?.field === col.id && (isSub ? openDropdown?.subItemId === actualSubItemId : openDropdown?.type === 'item');
  const triggerUpdate = (field: string, val: any) => { if (isSub) handleUpdateSubItem(group.id, actualItemId, actualSubItemId!, field, val); else handleUpdateItem(group.id, actualItemId, field, val); };
  const cellBorder = (isSub ? 'border-r border-white/10' : 'border-r border-white/10') + ' dwt-cell-in';
  
  const activePopupPos = 'left-1/2 -translate-x-1/2'; 

  const getLabelColor = (field: string, value: string) => { const match = labels[field]?.find((l: any) => l.text === value); return match ? `${match.color} text-white shadow-sm` : 'bg-white/5 text-gray-500 border border-white/10'; };
  const memberColor = (m: any) => {
    if (m?.color && String(m.color).startsWith('bg-')) return m.color;
    const s = String(m?.id || m?.name || '');
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return LABEL_COLORS[Math.abs(h) % LABEL_COLORS.length];
  };
  const calculateProgress = (start?: string, end?: string) => { if (!start || !end) return 0; const s = new Date(start).getTime(), e = new Date(end).getTime(), t = new Date().getTime(); if (t <= s) return 0; if (t >= e) return 100; return Math.round(((t - s) / (e - s)) * 100); };

  const handleCreateNewMember = () => { if (!newMemberName.trim()) return; setTeamMembers([...teamMembers, { id: `t-${Date.now()}`, name: newMemberName, color: LABEL_COLORS[Math.floor(Math.random() * LABEL_COLORS.length)], initials: newMemberName.charAt(0).toUpperCase() }]); setNewMemberName(''); };
  const handleAddNewLabel = (field: string, isMulti: boolean) => {
    if (!newLabelText.trim() || !openDropdown) return;
    const created = addLabelOption(field, newLabelText.trim(), newLabelColor || undefined);
    const current = openDropdown.type === 'item' ? (boardData.find((g:any) => g.id === openDropdown.groupId)?.items.find((i:any) => i.id === openDropdown.itemId)?.[field] || []) : (boardData.find((g:any) => g.id === openDropdown.groupId)?.items.find((i:any) => i.id === openDropdown.itemId)?.subItems.find((s:any) => s.id === openDropdown.subItemId)?.[field] || []);
    const newVal = isMulti ? [...(Array.isArray(current)?current:[]), created.text] : created.text;
    if (openDropdown.type === 'item') handleUpdateItem(openDropdown.groupId, openDropdown.itemId, field, newVal); else handleUpdateSubItem(openDropdown.groupId, openDropdown.itemId, openDropdown.subItemId, field, newVal);
    setNewLabelText(''); setOpenDropdown(null);
  };

  if (col.type === 'checkbox') {
    return (
      <div className={`${cellBorder} p-[2px] flex items-center justify-center min-w-0`}>
        <input type="checkbox" checked={!!item[col.id]} onChange={(e) => triggerUpdate(col.id, e.target.checked)} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} className="w-4 h-4 rounded bg-latar border-white/10 text-blue-500 cursor-pointer shadow-inner focus:ring-0" />
      </div>
    );
  }

  if (col.type === 'date') {
    const dv = item[col.id];
    let dueCls = 'text-gray-300 group-hover/date:text-white';
    if (dv) {
      const dd = new Date(dv);
      if (!isNaN(dd.getTime())) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const diff = Math.ceil((dd.getTime() - today.getTime()) / 86400000);
        if (diff < 0) dueCls = 'text-red-400 font-semibold';
        else if (diff <= 3) dueCls = 'text-amber-400 font-semibold';
      }
    }
    return (
      <div className={`${cellBorder} px-2 py-1 flex items-center justify-center min-w-0 group/date`}>
         <input type="date" value={item[col.id] || ''} onChange={(e) => triggerUpdate(col.id, e.target.value)} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} className={`w-full bg-transparent text-center text-[11px] outline-none cursor-pointer [color-scheme:dark] transition-colors ${dueCls}`} />
      </div>
    );
  }

  if (col.type === 'team') {
    return (
      <div className={`relative ${cellBorder} p-1 ${isDrop ? 'z-[100]' : ''}`}>
        <div onClick={() => { setOpenDropdown({ type, groupId: group.id, itemId: actualItemId, subItemId: actualSubItemId, field: col.id }); setNewLabelText(''); setNewMemberName(''); setNewLabelColor(LABEL_COLORS[0]); setColorPickerFor(null); }} className="flex gap-1 flex-wrap items-center justify-center w-full h-full cursor-pointer hover:bg-white/5 rounded-sm transition-colors overflow-hidden">
          {item[col.id]?.length > 0 ? item[col.id].map((tid:string) => { 
            const m = teamMembers.find((t:any) => t.id === tid); 
            return m ? <div key={tid} className={`px-2 py-0.5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm border border-white/10 ${memberColor(m)} truncate max-w-[100px]`} title={m.name}>{namaPendek(m)}</div> : null; 
          }) : <User size={13} className="text-gray-600"/>}
        </div>
        {isDrop && (
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); }}></div>
            <div className={`absolute top-full mt-1.5 ${activePopupPos} bg-kartu border border-white/10 shadow-2xl rounded-xl z-50 p-2 w-56 flex flex-col text-left animate-in fade-in zoom-in-95`} onClick={e=>e.stopPropagation()}>
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-2 py-1 mb-1">Assign Karyawan</div>
              <input autoComplete="off" spellCheck="false" autoFocus value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Cari orang..." className="bg-latar text-[11px] border border-white/10 focus:border-blue-500 rounded-md px-2.5 py-1.5 outline-none w-full text-white shadow-inner transition-colors min-w-0 mb-1.5"/>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 pr-1 custom-scrollbar">
                {teamMembers.filter((m:any) => cocokNama(m, newMemberName || '')).map((m:any) => { 
                  const has = item[col.id]?.includes(m.id); 
                  return (
                    <div key={m.id} className="flex items-center justify-between text-xs px-2 py-1.5 hover:bg-kartu-hover rounded-lg text-gray-300 w-full cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); triggerUpdate(col.id, has ? item[col.id].filter((id:any)=>id!==m.id) : [...(item[col.id]||[]), m.id]); }}>
                      <div className="flex items-center gap-2.5 min-w-0"><Avatar url={m.avatarUrl} name={m.name} initials={m.initials} className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[8px] font-bold text-white shadow-sm ${memberColor(m)}`} /><span className="truncate">{m.name}</span></div>
                      {has && <Check size={12} className="text-blue-400 shrink-0"/>}
                    </div>
                  )
                })}
                {teamMembers.filter((m:any) => cocokNama(m, newMemberName || '')).length === 0 && <div className="text-[11px] text-gray-500 px-2 py-3 text-center">Tak ada yang cocok.</div>}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (col.type === 'status' || col.type === 'tags') {
    const isMulti = col.type === 'tags';
    return (
      <div className={`relative ${cellBorder} p-[2px] ${isDrop ? 'z-[100]' : ''} min-w-0 flex items-center justify-center`}>
        {!isMulti ? (
          <button onClick={() => { setOpenDropdown({ type, groupId: group.id, itemId: actualItemId, subItemId: actualSubItemId, field: col.id }); setNewLabelText(''); setNewLabelColor(LABEL_COLORS[0]); setColorPickerFor(null); }} className={`w-full h-full text-center text-[11px] font-semibold rounded-sm py-1 px-1 outline-none transition-colors truncate ${getLabelColor(col.id, item[col.id])}`}>{item[col.id] || '-'}</button>
        ) : (
          <div onClick={() => setOpenDropdown({ type, groupId: group.id, itemId: actualItemId, subItemId: actualSubItemId, field: col.id })} className="flex flex-wrap gap-1 items-center justify-center w-full h-full cursor-pointer hover:bg-white/5 p-1 rounded-sm overflow-hidden">
            {item[col.id]?.length > 0 ? item[col.id].map((t: string) => <span key={t} className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold text-white shadow-sm max-w-full truncate ${labels[col.id]?.find((l:any)=>l.text === t)?.color || 'bg-kartu-hover'}`}>{t}</span>) : <Tag size={12} className="text-gray-600"/>}
          </div>
        )}
        {isDrop && (
           <>
             <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); }}></div>
             <div className={`absolute top-full mt-1.5 ${activePopupPos} bg-kartu border border-white/10 shadow-2xl rounded-xl z-50 p-1.5 w-56 flex flex-col animate-in fade-in zoom-in-95`} onClick={e=>e.stopPropagation()}>
               <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider px-2 py-1 mb-1">{col.label}</div>
               {!isMulti && <button onClick={() => { triggerUpdate(col.id, ''); setOpenDropdown(null); }} className="text-left text-xs px-3 py-2 hover:bg-kartu-hover rounded-lg text-gray-400 w-full mb-1 transition-colors shrink-0">- Reset</button>}
               <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 pr-1 custom-scrollbar mb-1.5">
                 {(labels[col.id] || []).map((l: any) => {
                   const hasMulti = isMulti && item[col.id]?.includes(l.text);
                   return (
                     <div key={l.id}>
                       <div className="flex items-center justify-between text-xs px-3 py-2 hover:bg-kartu-hover rounded-lg text-gray-200 w-full group/menuitem cursor-pointer transition-colors" onClick={() => { if(isMulti) { triggerUpdate(col.id, hasMulti ? item[col.id].filter((t:any)=>t!==l.text) : [...(item[col.id]||[]), l.text]) } else { triggerUpdate(col.id, l.text); setOpenDropdown(null); } }}>
                         <div className="flex items-center gap-3 min-w-0">
                           <button onClick={(e) => { e.stopPropagation(); setColorPickerFor(colorPickerFor === l.id ? null : l.id); }} title="Ubah warna" className={`w-3.5 h-3.5 rounded-sm shadow-sm shrink-0 ${l.color} hover:ring-2 hover:ring-white/50 transition-all`}></button>
                           <span className="truncate">{l.text}</span>
                         </div>
                         <div className="flex items-center gap-2 shrink-0">
                           {hasMulti && <Check size={12} className="text-blue-500"/>}
                           <button onClick={(e) => { e.stopPropagation(); triggerConfirm('Hapus Label', `Hapus opsi label "${l.text}"?`, () => handleDeleteLabel(col.id, l.id)); }} className="opacity-0 group-hover/menuitem:opacity-100 p-0.5 text-gray-500 hover:text-red-400 transition-opacity shrink-0"><Trash2 size={13}/></button>
                         </div>
                       </div>
                       {colorPickerFor === l.id && (
                         <div className="flex flex-wrap gap-1.5 px-3 py-2 mb-1" onClick={e=>e.stopPropagation()}>
                           {LABEL_COLORS.map((c: string) => (
                             <button key={c} onClick={(e) => { e.stopPropagation(); updateLabelColor(col.id, l.id, c); setColorPickerFor(null); }} className={`w-5 h-5 rounded-md ${c} transition-all ${l.color === c ? 'ring-2 ring-white' : 'hover:ring-2 hover:ring-white/50'}`}></button>
                           ))}
                         </div>
                       )}
                     </div>
                   )
                 })}
               </div>
               <div className="px-1 pt-2 border-t border-white/10 shrink-0">
                 <div className="flex flex-wrap gap-1.5 mb-2 px-1">
                   {LABEL_COLORS.map((c: string) => (
                     <button key={c} onClick={() => setNewLabelColor(c)} title="Warna opsi baru" className={`w-5 h-5 rounded-md ${c} transition-all ${newLabelColor === c ? 'ring-2 ring-white' : 'hover:ring-2 hover:ring-white/40'}`}></button>
                   ))}
                 </div>
                 <input autoComplete="off" spellCheck="false" autoFocus value={newLabelText} onChange={e=>setNewLabelText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleAddNewLabel(col.id, isMulti)} placeholder="+ Opsi baru (pilih warna di atas)" className="bg-latar border border-white/10 focus:border-blue-500 transition-colors rounded-md px-3 py-1.5 text-[11px] w-full text-white outline-none shadow-inner min-w-0"/>
               </div>
             </div>
           </>
        )}
      </div>
    );
  }

  // BUG KALENDER DIPERBAIKI DI SINI (Memastikan tData dinamis dari col.id)
  if (col.type === 'timeline') {
    const tData = item[col.id] || { start: '', end: '' };
    let tlText = 'text-gray-300';
    const tlEnd = tData.end || tData.start;
    if (tlEnd) {
      const ted = new Date(tlEnd);
      if (!isNaN(ted.getTime())) {
        const tToday = new Date(); tToday.setHours(0, 0, 0, 0);
        const tDiff = Math.ceil((ted.getTime() - tToday.getTime()) / 86400000);
        if (tDiff < 0) tlText = 'text-red-400 font-semibold';
        else if (tDiff <= 3) tlText = 'text-amber-400 font-semibold';
      }
    }
    return (
      <div className={`${cellBorder} p-1 relative flex items-center justify-center ${isDrop ? 'z-[100]' : ''}`}>
        <div onClick={() => { setTempTimeline(tData); setOpenDropdown({ type, groupId: group.id, itemId: actualItemId, subItemId: actualSubItemId, field: col.id }); }} className="relative w-full h-full min-h-[24px] bg-white/5 hover:bg-white/5 rounded-full flex items-center justify-center cursor-pointer overflow-hidden border border-white/10 transition-colors">
          {tData.start && <div className="absolute left-0 top-0 bottom-0 bg-blue-500 opacity-70" style={{ width: `${calculateProgress(tData.start, tData.end)}%` }}></div>}
          <span className={`relative z-10 text-[10px] font-medium ${tlText} px-2 flex items-center gap-1`}><CalendarDays size={11} className="opacity-40"/> {tData.start ? `${tData.start.slice(5)} - ${tData.end?.slice(5) || '?'}` : '-'}</span>
        </div>
        {isDrop && (
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenDropdown(null); }}></div>
            <div className={`absolute top-full mt-1.5 ${activePopupPos} bg-kartu border border-white/10 shadow-2xl rounded-xl z-50 p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95`} onClick={e=>e.stopPropagation()}>
              <div><label className="text-[10px] font-bold text-gray-400 block mb-1.5 uppercase tracking-wider">Start Date</label><input type="date" value={tempTimeline?.start || ''} onChange={e=>setTempTimeline({...tempTimeline, start:e.target.value})} className="w-full bg-latar border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white [color-scheme:dark] outline-none shadow-inner" /></div>
              <div><label className="text-[10px] font-bold text-gray-400 block mb-1.5 uppercase tracking-wider">End Date</label><input type="date" value={tempTimeline?.end || ''} onChange={e=>setTempTimeline({...tempTimeline, end:e.target.value})} className="w-full bg-latar border border-white/10 rounded-md px-2.5 py-1.5 text-xs text-white [color-scheme:dark] outline-none shadow-inner" /></div>
              <div className="flex justify-between items-center border-t border-white/10 pt-3 mt-1"><button onClick={() => { triggerUpdate(col.id, null); setOpenDropdown(null); }} className="text-xs text-red-400 font-bold hover:text-red-300 transition-colors">Clear</button><button onClick={() => { triggerUpdate(col.id, tempTimeline); setOpenDropdown(null); }} className="text-xs bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-md text-white font-bold transition-colors shadow-md">Set Date</button></div>
            </div>
          </>
        )}
      </div>
    );
  }
  
  if (col.type === 'gdocs') {
    const raw = item[col.id];
    const hasDoc = typeof raw === 'string' && raw.replace(/<[^>]*>/g, '').trim().length > 0;
    return (
      <div className={`${cellBorder} px-2 py-1 flex items-center justify-center min-w-0`}>
        <button onClick={(e) => { e.stopPropagation(); openDocEditor({ scope: isSub ? 'sub' : 'main', groupId: group.id, itemId: actualItemId, subItemId: actualSubItemId, dbItemId: isSub ? actualSubItemId : actualItemId, columnId: col.id, value: typeof raw === 'string' ? raw : '', title: `${item.name || 'Item'} — ${col.label}` }); }} className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors max-w-full ${hasDoc ? 'bg-blue-500/15 text-blue-300 hover:bg-blue-500/25' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
          <FileText size={12} className="shrink-0" /> <span className="truncate">{hasDoc ? 'Buka Dokumen' : 'Dokumen'}</span>
        </button>
      </div>
    );
  }

  const isLink = col.type === 'link';
  const safeValue = typeof item[col.id] === 'object' ? '' : (item[col.id] || '');
  return (
    <div className={`${cellBorder} px-2 py-1 flex items-center justify-center min-w-0 group/textcell`}>
      <div className="w-full min-w-0 flex items-center justify-center">
        <InlineEdit
           value={safeValue}
           onSave={(newVal: string) => triggerUpdate(col.id, newVal)}
           textClassName={`transition-colors truncate ${col.type === 'number' ? 'text-right' : 'text-center'} ${col.id.includes('link') && safeValue ? 'text-blue-400 hover:underline' : 'text-gray-300 group-hover/textcell:text-white'}`}
           className={`text-[11px] ${col.type === 'number' ? 'text-right' : 'text-center'}`}
           isLink={isLink}
        />
      </div>
    </div>
  );
}