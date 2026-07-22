'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import { Send, Maximize2, Minimize2, MessageSquare, Paperclip } from 'lucide-react';
import { useToast } from "@/components/Toast";

// Chat per-tugas (item_updates). Pesan teks = polos (tanpa bubble). Lampiran = gambar/berkas via Storage.
export default function TaskChat({ itemId, itemName }: { itemId: string; itemName?: string }) {
  const toast = useToast();
  const { supabase, currentUserId, teamMembers }: any = useDashboard();
  const [updates, setUpdates] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const scrollBottom = () => setTimeout(() => { const el = scrollRef.current; if (el) el.scrollTop = el.scrollHeight; }, 60);

  useEffect(() => {
    if (!supabase || !itemId) return;
    let active = true;
    supabase.from('item_updates').select('*').eq('item_id', itemId).order('created_at', { ascending: true })
      .then(({ data }: any) => { if (active) { setUpdates(data || []); scrollBottom(); } });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => { if (expanded) scrollBottom(); }, [expanded]);

  const post = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !supabase || !itemId) return;
    const t = text.trim();
    const { data, error } = await supabase.from('item_updates').insert({ item_id: itemId, author_id: currentUserId, text: t }).select('*').single();
    if (error) { toast.gagal('Gagal kirim pesan: ' + error.message); return; }
    setUpdates((u) => [...u, data]); setText(''); scrollBottom(true);
  };

  const upload = async (file: File) => {
    if (!supabase || !file || !itemId) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `chat/${itemId}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from('doc-assets').upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from('doc-assets').getPublicUrl(path);
      const { data: msg, error } = await supabase.from('item_updates').insert({ item_id: itemId, author_id: currentUserId, text: data.publicUrl }).select('*').single();
      if (error) throw error;
      setUpdates((u) => [...u, msg]); scrollBottom(true);
    } catch (e: any) {
      toast.gagal('Upload gagal: ' + (e?.message || e));
    }
    setUploading(false);
  };

  const member = (id: string) => teamMembers.find((m: any) => m.id === id);
  const authorName = (id: string) => member(id)?.name || (id === currentUserId ? 'You' : 'User');
  const authorInit = (id: string) => member(id)?.initials || authorName(id).slice(0, 2).toUpperCase();
  const authorColor = (id: string) => { const c = member(id)?.color; return c && String(c).startsWith('bg-') ? c : 'bg-[#579bfc]'; };
  const nameColor = (id: string) => {
    const c = member(id)?.color || '';
    const mm = /bg-\[(#[0-9a-fA-F]{3,8})\]/.exec(c);
    if (mm) return mm[1];
    if (c.includes('emerald')) return '#10b981';
    if (c.includes('rose')) return '#fb7185';
    if (c.includes('amber') || c.includes('orange')) return '#f59e0b';
    return '#579bfc';
  };
  const timeShort = (ts: string) => { try { return new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

  const isUrl = (s: string) => /^https?:\/\/\S+$/i.test((s || '').trim());
  const isImg = (s: string) => /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(s);
  const fileName = (url: string) => { try { return decodeURIComponent((url.split('/').pop() || 'file').split('?')[0].replace(/^\d+-/, '')); } catch { return 'file'; } };

  const renderBody = (t: string) => {
    if (isUrl(t)) {
      const url = t.trim();
      if (isImg(url)) return <a href={url} target="_blank" rel="noopener noreferrer"><img src={url} alt="" className="max-w-[220px] max-h-[220px] rounded-lg border border-zinc-700/60 mt-1" /></a>;
      return <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 hover:underline break-all mt-0.5"><Paperclip size={12} className="shrink-0" /> {fileName(url)}</a>;
    }
    return <span className="text-zinc-300 leading-relaxed break-words whitespace-pre-wrap">{t}</span>;
  };

  const messages = (
    <div className="flex flex-col gap-3.5">
      {updates.length === 0 && <p className="text-xs text-zinc-600 italic">Belum ada pesan. Mulai diskusi dengan tim.</p>}
      {updates.map((upd: any) => (
        <div key={upd.id} className="text-xs">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold text-[13px]" style={{ color: nameColor(upd.author_id) }}>{authorName(upd.author_id)}</span>
            <span className="text-[10px] text-zinc-500">{timeShort(upd.created_at)}</span>
          </div>
          <div className="text-[13px] mt-0.5">{renderBody(upd.text)}</div>
        </div>
      ))}
    </div>
  );

  const composer = (
    <form onSubmit={post} className="flex items-center gap-1.5 bg-[#181b24] border border-zinc-700/60 p-1.5 rounded-xl focus-within:border-blue-500 transition-colors">
      <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} title="Lampirkan file / gambar" className="text-zinc-400 hover:text-white p-1.5 rounded-lg hover:bg-zinc-700 transition-colors shrink-0 disabled:opacity-50"><Paperclip size={15} /></button>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={uploading ? 'Mengunggah…' : 'Tulis pesan ke tim...'} className="w-full bg-transparent text-xs text-zinc-200 px-1 outline-none" />
      <button type="submit" disabled={!text.trim()} className="bg-blue-600 disabled:bg-zinc-800 disabled:text-zinc-600 text-white p-1.5 rounded-lg transition-colors shrink-0"><Send size={14} /></button>
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ''; }} />
    </form>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) setExpanded(false); }}>
        <div className="w-full max-w-2xl h-[88vh] bg-[#1a1d24] rounded-xl shadow-2xl flex flex-col overflow-hidden border border-zinc-800">
          <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-800 bg-[#1e202a] shrink-0">
            <div className="flex items-center gap-2 min-w-0"><MessageSquare size={15} className="text-blue-400 shrink-0" /><span className="text-sm font-semibold text-zinc-200 truncate">Diskusi: {itemName || 'Tugas'}</span></div>
            <button onClick={() => setExpanded(false)} title="Perkecil" className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white px-2 py-1 rounded-lg hover:bg-zinc-800 transition-colors"><Minimize2 size={15} /> Perkecil</button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">{messages}</div>
          <div className="p-3 bg-[#1e202a] border-t border-zinc-800 shrink-0">{composer}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800/80 rounded-xl bg-[#161920] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800/60">
        <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2"><Send size={12} /> Diskusi Tugas (Chat)</div>
        <button onClick={() => setExpanded(true)} title="Perbesar" className="p-1 text-zinc-500 hover:text-white rounded transition-colors"><Maximize2 size={14} /></button>
      </div>
      <div ref={scrollRef} className="h-64 overflow-y-auto overscroll-contain px-3 py-3">{messages}</div>
      <div className="p-2.5 border-t border-zinc-800/60 bg-[#1a1d24]">{composer}</div>
    </div>
  );
}
