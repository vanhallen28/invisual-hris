'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import { X, Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2, Link2, FileText, Image as ImageIcon, Paperclip, MessageSquare, ChevronDown, Send } from 'lucide-react';

// invisual.docs — editor dokumen kanvas (tema gelap) + upload gambar/file + komentar.
export default function DocEditor() {
  const { docEditorTarget, closeDocEditor, saveDoc, supabase, currentUserId, teamMembers }: any = useDashboard();
  const ref = useRef<HTMLDivElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const timer = useRef<any>(null);
  const [saved, setSaved] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);

  const dbItemId = docEditorTarget?.dbItemId;

  useEffect(() => {
    if (docEditorTarget && ref.current) {
      ref.current.innerHTML = docEditorTarget.value || '';
      setSaved(true); setShowComments(false);
      setTimeout(() => ref.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docEditorTarget?.itemId, docEditorTarget?.columnId, docEditorTarget?.subItemId]);

  useEffect(() => {
    if (!docEditorTarget || !supabase || !dbItemId) return;
    let active = true;
    supabase.from('item_updates').select('*').eq('item_id', dbItemId).order('created_at', { ascending: true })
      .then(({ data }: any) => { if (active) setComments(data || []); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbItemId]);

  if (!docEditorTarget) return null;

  const doSave = () => {
    const html = ref.current?.innerHTML || '';
    const text = (ref.current?.innerText || '').trim();
    saveDoc((text || html.includes('<img')) ? html : '');
    setSaved(true);
  };
  const scheduleSave = () => { setSaved(false); clearTimeout(timer.current); timer.current = setTimeout(doSave, 800); };
  const cmd = (c: string, v?: string) => { document.execCommand(c, false, v); ref.current?.focus(); scheduleSave(); };
  const close = () => { clearTimeout(timer.current); doSave(); closeDocEditor(); };
  const addLink = () => { const url = window.prompt('Tempel URL:'); if (url) cmd('createLink', url); };

  const upload = async (file: File, asImage: boolean) => {
    if (!supabase || !file) return;
    setUploading(true);
    try {
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${dbItemId}/${Date.now()}-${safe}`;
      const up = await supabase.storage.from('doc-assets').upload(path, file, { upsert: false });
      if (up.error) throw up.error;
      const { data } = supabase.storage.from('doc-assets').getPublicUrl(path);
      const url = data.publicUrl;
      ref.current?.focus();
      if (asImage) document.execCommand('insertHTML', false, `<img src="${url}" alt="${safe}" /><p><br/></p>`);
      else document.execCommand('insertHTML', false, `<a href="${url}" target="_blank" rel="noopener">\uD83D\uDCCE ${file.name}</a>&nbsp;`);
      scheduleSave();
    } catch (e: any) {
      window.alert('Upload gagal: ' + (e?.message || e) + '\n\nPastikan bucket "doc-assets" sudah dibuat & publik.');
    }
    setUploading(false);
  };

  const authorName = (id: string) => (teamMembers || []).find((m: any) => m.id === id)?.name || 'User';
  const authorInit = (id: string) => authorName(id).slice(0, 2).toUpperCase();
  const timeShort = (ts: string) => { try { return new Date(ts).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

  const postComment = async () => {
    if (!commentText.trim() || !supabase || !dbItemId) return;
    const text = commentText.trim();
    const { data, error } = await supabase.from('item_updates').insert({ item_id: dbItemId, author_id: currentUserId, text }).select('*').single();
    if (error) { window.alert('Gagal kirim komentar: ' + error.message); return; }
    setComments((c) => [...c, data]); setCommentText('');
  };

  const TBtn = ({ onDo, title, children }: any) => (
    <button onMouseDown={(e) => { e.preventDefault(); onDo(); }} title={title} className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white transition-colors">{children}</button>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="w-full max-w-3xl h-[90vh] bg-[#20222b] text-zinc-100 rounded-xl shadow-2xl flex flex-col overflow-hidden border border-zinc-800">
        <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-800 bg-[#1e202a] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} className="text-blue-400 shrink-0" />
            <span className="text-sm font-semibold text-zinc-200 truncate">{docEditorTarget.title || 'Dokumen'}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-zinc-500">{uploading ? 'Mengunggah…' : saved ? 'Tersimpan' : 'Menyimpan…'}</span>
            <button onClick={close} className="p-1 text-zinc-400 hover:text-white rounded transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-zinc-800 bg-[#20222b] shrink-0 flex-wrap">
          <TBtn onDo={() => cmd('bold')} title="Tebal"><Bold size={15} /></TBtn>
          <TBtn onDo={() => cmd('italic')} title="Miring"><Italic size={15} /></TBtn>
          <TBtn onDo={() => cmd('underline')} title="Garis bawah"><Underline size={15} /></TBtn>
          <div className="w-px h-5 bg-zinc-700 mx-1" />
          <TBtn onDo={() => cmd('formatBlock', '<h1>')} title="Judul 1"><Heading1 size={15} /></TBtn>
          <TBtn onDo={() => cmd('formatBlock', '<h2>')} title="Judul 2"><Heading2 size={15} /></TBtn>
          <button onMouseDown={(e) => { e.preventDefault(); cmd('formatBlock', '<p>'); }} title="Paragraf" className="px-2 py-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-white text-xs font-bold transition-colors">P</button>
          <div className="w-px h-5 bg-zinc-700 mx-1" />
          <TBtn onDo={() => cmd('insertUnorderedList')} title="Daftar poin"><List size={15} /></TBtn>
          <TBtn onDo={() => cmd('insertOrderedList')} title="Daftar nomor"><ListOrdered size={15} /></TBtn>
          <TBtn onDo={addLink} title="Tautan"><Link2 size={15} /></TBtn>
          <div className="w-px h-5 bg-zinc-700 mx-1" />
          <TBtn onDo={() => imgInput.current?.click()} title="Sisipkan gambar"><ImageIcon size={15} /></TBtn>
          <TBtn onDo={() => fileInput.current?.click()} title="Lampirkan file"><Paperclip size={15} /></TBtn>
          <input ref={imgInput} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, true); e.currentTarget.value = ''; }} />
          <input ref={fileInput} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f, false); e.currentTarget.value = ''; }} />
        </div>

        <div className="flex-1 overflow-y-auto bg-[#181b24] p-4 sm:p-6">
          <div ref={ref} contentEditable suppressContentEditableWarning onInput={scheduleSave} style={{ color: '#f4f4f5', caretColor: '#ffffff' }} className="dwt-doc bg-[#20222b] mx-auto max-w-2xl min-h-full rounded-md shadow-lg border border-zinc-800/60 p-8 sm:p-12 text-[15px] leading-relaxed" />
        </div>

        <div className="border-t border-zinc-800 bg-[#1e202a] shrink-0">
          <button onClick={() => setShowComments((s) => !s)} className="w-full flex items-center justify-between px-4 py-2 text-xs text-zinc-400 hover:text-white transition-colors">
            <span className="flex items-center gap-2"><MessageSquare size={13} /> Komentar ({comments.length})</span>
            <ChevronDown size={14} className={`transition-transform ${showComments ? 'rotate-180' : ''}`} />
          </button>
          {showComments && (
            <div className="border-t border-zinc-800/60 px-4 py-3 max-h-52 overflow-y-auto flex flex-col gap-3">
              {comments.length === 0 && <div className="text-[11px] text-zinc-500">Belum ada komentar.</div>}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#579bfc] flex items-center justify-center text-[9px] font-bold text-white shrink-0">{authorInit(c.author_id)}</div>
                  <div className="min-w-0">
                    <div className="text-[11px] text-zinc-400"><b className="text-zinc-200">{authorName(c.author_id)}</b><span className="text-zinc-600 ml-1.5">{timeShort(c.created_at)}</span></div>
                    <div className="text-[13px] text-zinc-200 whitespace-pre-wrap break-words">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 px-4 py-2.5 border-t border-zinc-800/60">
            <input value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') postComment(); }} placeholder="Tulis komentar…" className="flex-1 bg-zinc-950 border border-zinc-700 focus:border-blue-500 rounded-lg px-3 py-1.5 text-[13px] text-white outline-none transition-colors min-w-0" />
            <button onClick={postComment} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 rounded-lg flex items-center gap-1.5 transition-colors shrink-0"><Send size={13} /> Kirim</button>
          </div>
        </div>
      </div>
    </div>
  );
}
