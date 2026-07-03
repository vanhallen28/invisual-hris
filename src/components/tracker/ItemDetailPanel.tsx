'use client';
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, AlignLeft, CheckSquare, CalendarDays, Tag, User, Link as LinkIcon, Hash, FileText, ExternalLink } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import TaskChat from './TaskChat';

// Ikon kecil di samping label setiap field, dipilih berdasar tipe kolom
function fieldIcon(type: string) {
  const p: any = { size: 12, className: 'text-zinc-500 shrink-0' };
  if (type === 'date' || type === 'timeline') return <CalendarDays {...p} />;
  if (type === 'tags' || type === 'status') return <Tag {...p} />;
  if (type === 'team') return <User {...p} />;
  if (type === 'link') return <LinkIcon {...p} />;
  if (type === 'number') return <Hash {...p} />;
  if (type === 'checkbox') return <CheckSquare {...p} />;
  return <AlignLeft {...p} />;
}

// Editor nilai per tipe kolom — semua menyimpan lewat setVal -> handleUpdateItem
function renderField(col: any, item: any, labels: any, teamMembers: any[], setVal: (f: string, v: any) => void, isManager: boolean, currentUserId: string) {
  const v = item[col.id];
  const opts = labels[col.id] || [];
  const mColor = (m: any) => (m?.color && String(m.color).startsWith('bg-')) ? m.color : 'bg-[#579bfc]';

  if (col.type === 'status') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {opts.map((l: any) => (
          <button key={l.id} onClick={() => setVal(col.id, v === l.text ? '' : l.text)} className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-all ${v === l.text ? `${l.color} text-white shadow-sm` : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700'}`}>{l.text}</button>
        ))}
        {opts.length === 0 && <span className="text-xs text-zinc-600">Belum ada opsi (atur di tabel).</span>}
      </div>
    );
  }
  if (col.type === 'tags') {
    const arr = Array.isArray(v) ? v : [];
    return (
      <div className="flex flex-wrap gap-1.5">
        {opts.map((l: any) => {
          const on = arr.includes(l.text);
          return <button key={l.id} onClick={() => setVal(col.id, on ? arr.filter((t: string) => t !== l.text) : [...arr, l.text])} className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all ${on ? `${l.color} text-white` : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700'}`}>{l.text}</button>;
        })}
        {opts.length === 0 && <span className="text-xs text-zinc-600">Belum ada opsi (atur di tabel).</span>}
      </div>
    );
  }
  if (col.type === 'team') {
    const arr = Array.isArray(v) ? v : [];
    if (!isManager) {
      const me = teamMembers.find((m: any) => m.id === currentUserId);
      if (!me) return <span className="text-xs text-zinc-600">—</span>;
      return (
        <div className="flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] pl-1 pr-2.5 py-1 rounded-full border border-blue-500/50 bg-blue-500/10 text-zinc-100">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${mColor(me)}`}>{me.initials}</span>{me.name}
          </span>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {teamMembers.map((m: any) => {
          const on = arr.includes(m.id);
          return (
            <button key={m.id} onClick={() => setVal(col.id, on ? arr.filter((id: string) => id !== m.id) : [...arr, m.id])} className={`flex items-center gap-1.5 text-[11px] pl-1 pr-2.5 py-1 rounded-full transition-all border ${on ? 'border-blue-500/50 bg-blue-500/10 text-zinc-100' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${mColor(m)}`}>{m.initials}</span>{m.name}
            </button>
          );
        })}
        {teamMembers.length === 0 && <span className="text-xs text-zinc-600">Belum ada anggota tim.</span>}
      </div>
    );
  }
  if (col.type === 'date') {
    return <input type="date" value={v || ''} onChange={(e) => setVal(col.id, e.target.value)} className="bg-zinc-900/50 border border-zinc-800 focus:border-blue-500 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 outline-none [color-scheme:dark] w-full transition-colors" />;
  }
  if (col.type === 'timeline') {
    const t = v || { start: '', end: '' };
    return (
      <div className="flex items-center gap-2">
        <input type="date" value={t.start || ''} onChange={(e) => setVal(col.id, { ...t, start: e.target.value })} className="bg-zinc-900/50 border border-zinc-800 focus:border-blue-500 rounded-md px-2 py-1.5 text-xs text-zinc-200 outline-none [color-scheme:dark] w-full transition-colors" />
        <span className="text-zinc-600 text-xs shrink-0">→</span>
        <input type="date" value={t.end || ''} onChange={(e) => setVal(col.id, { ...t, end: e.target.value })} className="bg-zinc-900/50 border border-zinc-800 focus:border-blue-500 rounded-md px-2 py-1.5 text-xs text-zinc-200 outline-none [color-scheme:dark] w-full transition-colors" />
      </div>
    );
  }
  if (col.type === 'checkbox') {
    return <input type="checkbox" checked={!!v} onChange={(e) => setVal(col.id, e.target.checked)} className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-blue-500 cursor-pointer mt-1" />;
  }
  // text / number / link / files
  const safe = typeof v === 'object' ? '' : (v ?? '');
  const s = String(safe).trim();
  const looksUrl = !!s && (col.type === 'link' || s.startsWith('http') || /\.[a-z]{2,}([/?#]|$)/i.test(s));
  return (
    <div className="flex items-center gap-2">
      <input type={col.type === 'number' ? 'number' : 'text'} value={safe} onChange={(e) => setVal(col.id, e.target.value)} placeholder="—" className="bg-zinc-900/50 border border-zinc-800 focus:border-blue-500 rounded-md px-2.5 py-1.5 text-xs text-zinc-200 outline-none w-full transition-colors" />
      {looksUrl && <a href={s.startsWith('http') ? s : `https://${s}`} target="_blank" rel="noopener noreferrer" title="Buka di tab baru" className="shrink-0 p-1.5 text-blue-400 hover:text-blue-300 hover:bg-zinc-800 rounded-md transition-colors"><ExternalLink size={14} /></a>}
    </div>
  );
}

export default function ItemDetailPanel({ push = false }: { push?: boolean }) {
  const {
    detailItem, setDetailItem, boardData, columns, labels, teamMembers, openDocEditor,
    currentUserId, handleUpdateItem, supabase, isManager
  } = useDashboard();

  const group = boardData.find((g: any) => g.id === detailItem?.groupId);
  const item = group?.items.find((i: any) => i.id === detailItem?.itemId);
  const open = !!(detailItem && item);

  const setVal = (field: string, val: any) => handleUpdateItem(detailItem?.groupId, detailItem?.itemId, field, val);
  const close = () => setDetailItem(null);

  return (
    <>
      {/* Overlay gelap (hanya mode timpa; mode dorong tak pakai backdrop) */}
      {open && !push && <div className="fixed inset-0 bg-black/40 z-[55]" onClick={close} />}

      <div className={`fixed top-0 right-0 h-screen w-full sm:w-[480px] bg-[#1a1d24] shadow-2xl z-[60] transform transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {open && (
          <>
            <div className="px-6 py-5 border-b border-zinc-800/80 flex items-center justify-between bg-[#1e202a] shrink-0">
              <input
                value={item.name}
                onChange={(e) => setVal('name', e.target.value)}
                className="bg-transparent text-lg font-bold text-white outline-none w-full mr-3 focus:bg-zinc-900/50 rounded px-1 -ml-1 transition-colors"
              />
              <button onClick={close} className="p-1.5 hover:bg-zinc-700 rounded-full text-zinc-400 shrink-0 transition-colors"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#181b24]">
              {/* DESKRIPSI */}
              <div className="px-6 py-5 border-b border-zinc-800/60">
                <div className="flex items-center gap-2 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2"><AlignLeft size={13} /> Description</div>
                {(() => {
                  const raw = item.description;
                  const hasDoc = typeof raw === 'string' && raw.replace(/<[^>]*>/g, '').trim().length > 0;
                  return (
                    <button onClick={() => openDocEditor({ scope: 'main', groupId: detailItem.groupId, itemId: item.id, subItemId: undefined, dbItemId: item.id, columnId: 'description', value: typeof raw === 'string' ? raw : '', title: `${item.name || 'Item'} — Deskripsi` })} className={`w-full flex items-center gap-2.5 text-sm px-3.5 py-3.5 rounded-lg border transition-colors ${hasDoc ? 'bg-blue-500/10 border-blue-500/30 text-blue-200 hover:bg-blue-500/15' : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}`}>
                      <FileText size={16} className="shrink-0" />
                      <span className="truncate">{hasDoc ? 'Buka dokumen deskripsi' : 'Tulis deskripsi (buka dokumen)'}</span>
                    </button>
                  );
                })()}
              </div>

              {/* FIELDS */}
              <div className="px-6 py-5 border-b border-zinc-800/60 flex flex-col gap-4">
                <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Fields</div>
                {columns.length === 0 && <p className="text-xs text-zinc-500">Belum ada kolom. Tambahkan kolom di Main Table.</p>}
                {columns.map((col: any) => (
                  <div key={col.id} className="grid grid-cols-[120px_1fr] gap-3 items-start">
                    <div className="text-xs font-semibold text-zinc-400 pt-1.5 truncate flex items-center gap-1.5">{fieldIcon(col.type)} {col.label}</div>
                    <div className="min-w-0">{renderField(col, item, labels, teamMembers, setVal, isManager, currentUserId)}</div>
                  </div>
                ))}
              </div>

              {/* CHAT */}
              <div className="px-6 py-5">
                <TaskChat itemId={item.id} itemName={item.name} />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
