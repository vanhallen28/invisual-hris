'use client';
import React, { useState } from 'react';
import { Search, BoxSelect, ChevronDown, CalendarDays, User, Hash, FileText, AlignLeft, CheckSquare, Network, Copy } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';

export default function ColumnCenterMenu({ target, onClose }: { target: 'main' | 'sub', onClose: () => void }) {
  const { handleAddDynamicColumn, copyParentColumns } = useDashboard();
  const handleSelect = (type: string, label: string) => { handleAddDynamicColumn(target, type, label); onClose(); };
  const [cari, setCari] = useState('');

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
      // Belum ada unggah berkas di tabel: "Files" dulu diam-diam membuat kolom
      // TEKS biasa. Kini jujur — kolom tautan (tempel link Drive/berkas, bisa diklik).
      { type: 'link', label: 'Files', hint: 'Tautan berkas (Drive, dll.)', icon: <FileText size={12}/>, color: 'bg-rose-400' },
      { type: 'timeline', label: 'Timeline', icon: <AlignLeft size={12}/>, color: 'bg-purple-500' },
      { type: 'checkbox', label: 'Checkbox', icon: <CheckSquare size={12}/>, color: 'bg-orange-400' },
      { type: 'link', label: 'Link', icon: <Network size={12}/>, color: 'bg-rose-400' },
      { type: 'gdocs', label: 'Google Docs', icon: <FileText size={12}/>, color: 'bg-blue-500' },
    ]}
  ];

  // Penyaring kotak cari: nama jenis, kata kunci tipe, atau keterangannya.
  const KATA: Record<string, string> = { status: 'status label', tags: 'dropdown tag pilihan', text: 'teks text tulisan', date: 'tanggal date', team: 'people orang pic anggota', number: 'angka number numbers', link: 'link tautan url files berkas', timeline: 'timeline rentang jadwal', checkbox: 'checkbox centang', gdocs: 'docs dokumen google' };
  const q = cari.trim().toLowerCase();
  const tersaring = columnsList
    .map((sec) => ({ ...sec, items: sec.items.filter((it: any) => !q || `${it.label} ${it.hint || ''} ${KATA[it.type] || ''}`.toLowerCase().includes(q)) }))
    .filter((sec) => sec.items.length > 0);
  const hasil = tersaring.flatMap((sec) => sec.items);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); onClose(); }}></div>
      <div className="absolute top-[120%] right-0 bg-kartu border border-white/10 shadow-2xl rounded-xl z-50 p-4 w-[340px] animate-in fade-in zoom-in-95 cursor-default text-left flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
          {/* Kotak cari kini benar-benar menyaring jenis kolom; Enter = pilih hasil pertama. */}
          <input
            value={cari} onChange={(e) => setCari(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && hasil[0]) handleSelect(hasil[0].type, hasil[0].label); else if (e.key === 'Escape') onClose(); }}
            placeholder="Cari jenis kolom…"
            className="w-full bg-kartu-hover border border-white/10 focus:border-blue-500 rounded-md pl-9 pr-3 py-2 text-[13px] text-white outline-none shadow-inner transition-colors min-w-0" />
        </div>
        {target === 'sub' && !q && (
          <div>
            <h5 className="text-[11px] text-gray-500 mb-2">Shortcuts</h5>
            <button onClick={() => { copyParentColumns(); onClose(); }} className="flex items-center gap-2 text-[13px] text-gray-200 hover:text-white transition-colors w-full text-left p-1 rounded hover:bg-white/5"><Copy size={16} className="text-gray-400"/> Copy parent columns</button>
          </div>
        )}
        {tersaring.map((sec, i) => (
          <div key={i}>
            <h5 className="text-[11px] text-gray-500 mb-2">{sec.section}</h5>
            <div className="grid grid-cols-2 gap-y-3 gap-x-2">
              {sec.items.map((item: any, j: number) => (
                <button key={j} onClick={() => handleSelect(item.type, item.label)} title={item.hint || undefined} className="flex items-center gap-2.5 text-[13px] text-gray-200 hover:text-white transition-colors w-full text-left p-1 rounded hover:bg-white/5 group/colbtn">
                  <div className={`w-6 h-6 rounded flex items-center justify-center text-white shadow-sm transition-transform group-hover/colbtn:scale-110 ${item.color}`}>{item.icon}</div>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {q && hasil.length === 0 && <p className="text-[12px] text-gray-500 text-center py-2">Tidak ada jenis kolom yang cocok.</p>}
      </div>
    </>
  );
}