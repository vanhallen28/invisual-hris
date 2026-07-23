'use client';
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, AlignLeft, CheckSquare, CalendarDays, Tag, User, Link as LinkIcon, Hash, FileText, ExternalLink, Plus, Check, Search } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import TaskChat from './TaskChat';
import RoleDistribution from './RoleDistribution';
import TautanItem from './TautanItem';
import TestProject from './TestProject';
import RiwayatItem from './RiwayatItem';
import Avatar from '@/components/Avatar';

const mColor = (m: any) => (m?.color && String(m.color).startsWith('bg-') ? m.color : 'bg-primer-terang');

// Pemilih People ala dropdown: hanya yang terpilih tampil sebagai chip,
// sisanya dipilih lewat dropdown bercari — agar tak menumpuk saat tim besar.
function PeoplePicker({ value, teamMembers, onChange }: any) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const arr: string[] = Array.isArray(value) ? value : [];
  const selected = teamMembers.filter((m: any) => arr.includes(m.id));
  const filtered = teamMembers.filter((m: any) => String(m.name || '').toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) => onChange(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 items-center">
        {selected.map((m: any) => (
          <span key={m.id} className="group/chip flex items-center gap-1.5 text-[11px] pl-1 pr-1.5 py-1 rounded-full border border-blue-500/50 bg-blue-500/10 text-gray-100">
            <Avatar url={m.avatarUrl} name={m.name} initials={m.initials} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${mColor(m)}`} />
            <span className="truncate max-w-[140px]">{m.name}</span>
            <button onClick={() => toggle(m.id)} title="Lepas" className="p-0.5 text-gray-500 hover:text-red-400 transition-colors"><X size={11} /></button>
          </span>
        ))}

        <button
          onClick={() => { setOpen(!open); setQ(''); }}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border border-dashed border-white/10 text-gray-400 hover:border-blue-500/60 hover:text-blue-300 hover:bg-blue-500/5 transition-all"
        >
          <Plus size={12} /> {selected.length ? 'Tambah' : 'Pilih orang'}
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-[65]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-[70] w-72 max-w-[85vw] bg-kartu border border-white/10 rounded-xl shadow-2xl p-2">
            <div className="flex items-center gap-2 bg-latar border border-white/10 rounded-lg px-2.5 py-1.5 mb-1.5">
              <Search size={12} className="text-gray-500 shrink-0" />
              <input
                autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…"
                className="bg-transparent text-[11px] text-white outline-none w-full placeholder:text-gray-600"
              />
            </div>

            <div className="max-h-56 overflow-y-auto overscroll-contain flex flex-col gap-0.5 custom-scrollbar">
              {filtered.map((m: any) => {
                const on = arr.includes(m.id);
                return (
                  <button
                    key={m.id} onClick={() => toggle(m.id)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${on ? 'bg-blue-500/10' : 'hover:bg-white/5'}`}
                  >
                    <Avatar url={m.avatarUrl} name={m.name} initials={m.initials} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 ${mColor(m)}`} />
                    <span className={`text-[11px] truncate flex-1 ${on ? 'text-white font-semibold' : 'text-gray-300'}`}>{m.name}</span>
                    {on && <Check size={13} className="text-blue-400 shrink-0" />}
                  </button>
                );
              })}
              {filtered.length === 0 && <span className="text-[11px] text-gray-600 px-2 py-2">Tidak ada nama yang cocok.</span>}
            </div>

            {selected.length > 0 && (
              <button onClick={() => onChange([])} className="w-full text-[10px] text-gray-500 hover:text-red-400 pt-2 mt-1 border-t border-white/10 transition-colors">
                Kosongkan semua ({selected.length})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Ikon kecil di samping label setiap field, dipilih berdasar tipe kolom
function fieldIcon(type: string) {
  const p: any = { size: 12, className: 'text-gray-500 shrink-0' };
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

  if (col.type === 'status') {
    return (
      <div className="flex flex-wrap gap-1.5">
        {opts.map((l: any) => (
          <button key={l.id} onClick={() => setVal(col.id, v === l.text ? '' : l.text)} className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-all ${v === l.text ? `${l.color} text-white shadow-sm` : 'bg-white/5 text-gray-400 hover:bg-kartu-hover'}`}>{l.text}</button>
        ))}
        {opts.length === 0 && <span className="text-xs text-gray-600">Belum ada opsi (atur di tabel).</span>}
      </div>
    );
  }
  if (col.type === 'tags') {
    const arr = Array.isArray(v) ? v : [];
    return (
      <div className="flex flex-wrap gap-1.5">
        {opts.map((l: any) => {
          const on = arr.includes(l.text);
          return <button key={l.id} onClick={() => setVal(col.id, on ? arr.filter((t: string) => t !== l.text) : [...arr, l.text])} className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all ${on ? `${l.color} text-white` : 'bg-white/5 text-gray-400 hover:bg-kartu-hover'}`}>{l.text}</button>;
        })}
        {opts.length === 0 && <span className="text-xs text-gray-600">Belum ada opsi (atur di tabel).</span>}
      </div>
    );
  }
  if (col.type === 'team') {
    const arr = Array.isArray(v) ? v : [];
    if (!isManager) {
      const me = teamMembers.find((m: any) => m.id === currentUserId);
      if (!me) return <span className="text-xs text-gray-600">—</span>;
      return (
        <div className="flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1.5 text-[11px] pl-1 pr-2.5 py-1 rounded-full border border-blue-500/50 bg-blue-500/10 text-gray-100">
            <Avatar url={me.avatarUrl} name={me.name} initials={me.initials} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${mColor(me)}`} />{me.name}
          </span>
        </div>
      );
    }
    if (teamMembers.length === 0) return <span className="text-xs text-gray-600">Belum ada anggota tim.</span>;
    return <PeoplePicker value={arr} teamMembers={teamMembers} onChange={(next: string[]) => setVal(col.id, next)} />;
  }
  if (col.type === 'date') {
    return <input type="date" value={v || ''} onChange={(e) => setVal(col.id, e.target.value)} className="bg-kartu/50 border border-white/10 focus:border-blue-500 rounded-md px-2.5 py-1.5 text-xs text-gray-200 outline-none [color-scheme:dark] w-full transition-colors" />;
  }
  if (col.type === 'timeline') {
    const t = v || { start: '', end: '' };
    return (
      <div className="flex items-center gap-2">
        <input type="date" value={t.start || ''} onChange={(e) => setVal(col.id, { ...t, start: e.target.value })} className="bg-kartu/50 border border-white/10 focus:border-blue-500 rounded-md px-2 py-1.5 text-xs text-gray-200 outline-none [color-scheme:dark] w-full transition-colors" />
        <span className="text-gray-600 text-xs shrink-0">→</span>
        <input type="date" value={t.end || ''} onChange={(e) => setVal(col.id, { ...t, end: e.target.value })} className="bg-kartu/50 border border-white/10 focus:border-blue-500 rounded-md px-2 py-1.5 text-xs text-gray-200 outline-none [color-scheme:dark] w-full transition-colors" />
      </div>
    );
  }
  if (col.type === 'checkbox') {
    return <input type="checkbox" checked={!!v} onChange={(e) => setVal(col.id, e.target.checked)} className="w-4 h-4 rounded bg-latar border-white/10 text-blue-500 cursor-pointer mt-1" />;
  }
  // text / number / link / files
  const safe = typeof v === 'object' ? '' : (v ?? '');
  const s = String(safe).trim();
  const looksUrl = !!s && (col.type === 'link' || s.startsWith('http') || /\.[a-z]{2,}([/?#]|$)/i.test(s));
  return (
    <div className="flex items-center gap-2">
      <input type={col.type === 'number' ? 'number' : 'text'} value={safe} onChange={(e) => setVal(col.id, e.target.value)} placeholder="—" className="bg-kartu/50 border border-white/10 focus:border-blue-500 rounded-md px-2.5 py-1.5 text-xs text-gray-200 outline-none w-full transition-colors" />
      {looksUrl && <a href={s.startsWith('http') ? s : `https://${s}`} target="_blank" rel="noopener noreferrer" title="Buka di tab baru" className="shrink-0 p-1.5 text-blue-400 hover:text-blue-300 hover:bg-kartu-hover rounded-md transition-colors"><ExternalLink size={14} /></a>}
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

      <div className={`fixed top-0 right-0 h-screen w-full sm:w-[480px] bg-input shadow-2xl z-[60] transform transition-transform duration-300 flex flex-col ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        {open && (
          <>
            <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between bg-kartu-hover shrink-0">
              <input
                value={item.name}
                onChange={(e) => setVal('name', e.target.value)}
                className="bg-transparent text-lg font-bold text-white outline-none w-full mr-3 focus:bg-kartu/50 rounded px-1 -ml-1 transition-colors"
              />
              <button onClick={close} className="p-1.5 hover:bg-kartu-hover rounded-full text-gray-400 shrink-0 transition-colors"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto bg-kartu">
              {/* DESKRIPSI */}
              <div className="px-6 py-5 border-b border-white/10">
                <div className="flex items-center gap-2 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2"><AlignLeft size={13} /> Description</div>
                {(() => {
                  const raw = item.description;
                  const hasDoc = typeof raw === 'string' && raw.replace(/<[^>]*>/g, '').trim().length > 0;
                  return (
                    <button onClick={() => openDocEditor({ scope: 'main', groupId: detailItem.groupId, itemId: item.id, subItemId: undefined, dbItemId: item.id, columnId: 'description', value: typeof raw === 'string' ? raw : '', title: `${item.name || 'Item'} — Deskripsi` })} className={`w-full flex items-center gap-2.5 text-sm px-3.5 py-3.5 rounded-lg border transition-colors ${hasDoc ? 'bg-blue-500/10 border-blue-500/30 text-blue-200 hover:bg-blue-500/15' : 'bg-kartu/40 border-white/10 text-gray-400 hover:border-white/10 hover:text-gray-200'}`}>
                      <FileText size={16} className="shrink-0" />
                      <span className="truncate">{hasDoc ? 'Buka dokumen deskripsi' : 'Tulis deskripsi (buka dokumen)'}</span>
                    </button>
                  );
                })()}
              </div>

              {/* TAUTAN — tombol pintas yang diisi manager */}
              <TautanItem itemId={item.id} />

              {/* TEST PROJECT — kanvas kolaboratif, dibuka layar penuh */}
              <TestProject />

              {/* FIELDS */}
              <div className="px-6 py-5 border-b border-white/10 flex flex-col gap-4">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Fields</div>
                {columns.length === 0 && <p className="text-xs text-gray-500">Belum ada kolom. Tambahkan kolom di Main Table.</p>}
                {columns.map((col: any) => (
                  <div key={col.id} className="grid grid-cols-[120px_1fr] gap-3 items-start">
                    <div className="text-xs font-semibold text-gray-400 pt-1.5 truncate flex items-center gap-1.5">{fieldIcon(col.type)} {col.label}</div>
                    <div className="min-w-0">{renderField(col, item, labels, teamMembers, setVal, isManager, currentUserId)}</div>
                  </div>
                ))}

                {/* ROLE DISTRIBUTION — tabel mini berkolom custom */}
                <RoleDistribution itemId={item.id} />

                {/* RIWAYAT — siapa mengubah apa, kapan */}
                <RiwayatItem itemId={item.id} />
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
