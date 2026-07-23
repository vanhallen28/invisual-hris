'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Hash, Lock, Megaphone, Send, Paperclip, Smile, Reply, Pin, Trash2, Pencil,
  X, Check, ListPlus, Link2, Search, CornerUpLeft, FileText, ChevronLeft, Sticker, Plus, Trash2 as TrashIcon,
} from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import LoadingLogo from '@/components/LoadingLogo';
import Avatar from '@/components/Avatar';
import {
  EMOJIS, loadMessages, sendMessage, editMessage, deleteMessage, setPinned, setTaskRef,
  loadReactions, toggleReaction, markRead, uploadChatFile, findTask, searchTasks, taskMeta,
} from '@/lib/tracker/chat';
import { dbAddItem, dbSetCellValue, newId } from '@/lib/tracker/sync';
import { EMOJI_GROUPS, BUILTIN_STICKERS, isOnlyEmoji, loadStickers, addSticker, deleteSticker } from '@/lib/tracker/emoji';
import { pushNotify } from '@/lib/push';
import { namaPendek } from '@/lib/tracker/nama';

const mColor = (m: any) => (m?.color && String(m.color).startsWith('bg-') ? m.color : 'bg-primer-terang');
const timeOf = (d: any) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const dayKey = (d: any) => new Date(d).toDateString();
const dayLabel = (d: any) => {
  const dt = new Date(d); const now = new Date();
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (dt.toDateString() === now.toDateString()) return 'Hari ini';
  if (dt.toDateString() === y.toDateString()) return 'Kemarin';
  return dt.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

/* ══════ Kartu tugas yang ditempel di pesan ══════ */
function TaskCard({ taskId }: { taskId: string }) {
  const { boardsDataMap, labels, teamMembers, setActiveBoardId, setDetailItem }: any = useDashboard();
  const found = findTask(boardsDataMap, taskId);
  if (!found) {
    return <div className="mt-1.5 text-[11px] text-gray-600 border border-white/10 rounded-lg px-3 py-2 inline-block">Tugas tidak ditemukan / tak punya akses.</div>;
  }
  const { boardId, groupId, item } = found;
  const meta = taskMeta(boardsDataMap, boardId, item, labels);
  const pics = (meta.people || []).map((id: string) => teamMembers.find((m: any) => m.id === id)).filter(Boolean);

  return (
    <button
      onClick={() => { setActiveBoardId(boardId); setDetailItem({ groupId, itemId: found.item.id }); }}
      className="mt-1.5 w-full max-w-md flex items-center gap-3 bg-kartu hover:bg-kartu border-l-2 border-primer border-y border-r border-white/10 rounded-lg px-3 py-2.5 text-left transition-colors"
    >
      <ListPlus size={14} className="text-blue-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-100 font-semibold truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-1">
          {meta.status && <span className={`text-[9px] font-bold text-white px-1.5 py-0.5 rounded ${meta.statusColor}`}>{meta.status}</span>}
          {meta.due && <span className="text-[9px] text-gray-500">{new Date(meta.due).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>}
        </div>
      </div>
      <div className="flex -space-x-1.5 shrink-0">
        {pics.slice(0, 3).map((m: any) => (
          <span key={m.id} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-2 ring-[#20222b] ${mColor(m)}`}>{m.initials}</span>
        ))}
      </div>
    </button>
  );
}

/* ══════ Modal: pilih tugas untuk ditempel ══════ */
function TaskPicker({ onPick, onClose }: any) {
  const { boardsDataMap }: any = useDashboard();
  const [q, setQ] = useState('');
  const results = searchTasks(boardsDataMap, q);
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[120]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md bg-kartu border border-white/10 rounded-2xl shadow-2xl z-[130] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-white">Tempel Tugas ke Pesan</h3>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white"><X size={16} /></button>
        </div>
        <div className="flex items-center gap-2 bg-latar border border-white/10 rounded-lg px-3 py-2 mb-2">
          <Search size={13} className="text-gray-500" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama tugas…" className="bg-transparent text-xs text-white outline-none w-full placeholder:text-gray-600" />
        </div>
        <div className="max-h-72 overflow-y-auto overscroll-contain flex flex-col gap-1">
          {results.map((r: any) => (
            <button key={r.item.id} onClick={() => onPick(r.item.id)} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-left">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.groupColor }} />
              <span className="text-xs text-gray-200 truncate flex-1">{r.item.name}</span>
              <span className="text-[10px] text-gray-600 truncate">{r.groupTitle}</span>
            </button>
          ))}
          {results.length === 0 && <p className="text-xs text-gray-600 text-center py-6">Tak ada tugas yang cocok.</p>}
        </div>
      </div>
    </>
  );
}

/* ══════ Modal: jadikan pesan → tugas (manajer) ══════ */
function CreateTaskModal({ message, onDone, onClose }: any) {
  const { supabase, workspaces, boardsDataMap, teamMembers, pushToast, refreshData }: any = useDashboard();
  const boards: any[] = [];
  (workspaces || []).forEach((w: any) => (w.years || []).forEach((y: any) => (y.months || []).forEach((mo: any) => (mo.boards || []).forEach((b: any) => {
    boards.push({ id: b.id, label: `${y.name} › ${mo.name} › ${b.name}` });
  }))));

  const [boardId, setBoardId] = useState(boards[0]?.id || '');
  const [groupId, setGroupId] = useState('');
  const [title, setTitle] = useState(String(message.content || '').slice(0, 80) || 'Tugas dari chat');
  const [pic, setPic] = useState('');
  const [busy, setBusy] = useState(false);

  const groups = boardsDataMap?.[boardId]?.groups || [];
  useEffect(() => { setGroupId(groups[0]?.id || ''); }, [boardId]); // eslint-disable-line

  const submit = async () => {
    if (!boardId || !groupId || !title.trim()) { pushToast('Lengkapi board, grup, dan judul tugas.'); return; }
    setBusy(true);
    try {
      const grp = groups.find((g: any) => g.id === groupId);
      const id = newId();
      await dbAddItem(supabase, { id, groupId, name: title.trim(), position: (grp?.items?.length || 0) });

      if (pic) {
        const peopleCol = (boardsDataMap[boardId].columns || []).find((c: any) => c.type === 'people');
        if (peopleCol) await dbSetCellValue(supabase, id, peopleCol.id, 'people', [pic]);
      }
      await setTaskRef(supabase, message.id, id);
      if (refreshData) await refreshData();
      pushToast('Tugas dibuat & ditempel ke pesan');
      onDone(id);
    } catch (e: any) {
      pushToast('Gagal membuat tugas: ' + (e?.message || e));
    }
    setBusy(false);
  };

  const cls = "w-full bg-input border border-white/10 focus:border-primer/60 rounded-lg px-3 py-2 text-xs text-gray-100 outline-none";
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[120]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md bg-kartu border border-white/10 rounded-2xl shadow-2xl z-[130] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Jadikan Tugas</h3>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white"><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Judul Tugas</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={cls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Board</label>
              <select value={boardId} onChange={(e) => setBoardId(e.target.value)} className={cls}>
                {boards.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Grup</label>
              <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={cls}>
                {groups.map((g: any) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">PIC (opsional)</label>
            <select value={pic} onChange={(e) => setPic(e.target.value)} className={cls}>
              <option value="">— Belum ditugaskan —</option>
              {teamMembers.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          <button onClick={submit} disabled={busy} className="mt-1 w-full bg-primer hover:bg-blue-600 disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-lg transition-all">
            {busy ? 'Membuat…' : 'Buat Tugas & Tempel ke Pesan'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ══════════════ RUANG CHAT ══════════════ */
export default function ChatRoom({ channel, onBack, recipients = [] }: any) {
  const { supabase, currentUserId, teamMembers, currentUserRole, pushToast, boardsDataMap }: any = useDashboard();

  // `pushToast` dibuat ulang tiap render oleh DashboardContext. Dipakai
  // langsung sebagai dependensi, useCallback/useEffect di bawah berjalan
  // TERUS-MENERUS (muat ulang tanpa henti). Ref menjaga identitas tetap,
  // isinya selalu yang terbaru.
  const toastRef = useRef(pushToast);
  useEffect(() => { toastRef.current = pushToast; });
  const toast = useCallback((...a: any[]) => (toastRef.current as any)?.(...a), []);

  const isManager = currentUserRole === 'manager';
  const canPost = !channel?.is_announcement || isManager;

  const [msgs, setMsgs] = useState<any[]>([]);
  const [rx, setRx] = useState<any[]>([]);
  const [lightbox, setLightbox] = useState<string | null>(null);  // gambar yang dibuka besar

  // Escape menutup pratinjau. Tanpa ini, satu-satunya jalan keluar
  // adalah tombol silang — dan itu tidak jelas di layar kecil.
  useEffect(() => {
    if (!lightbox) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [lightbox]);

  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [editText, setEditText] = useState('');
  const [attachTask, setAttachTask] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [taskModal, setTaskModal] = useState<any>(null);
  const [emojiFor, setEmojiFor] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [typing, setTyping] = useState<string[]>([]);
  const [showPins, setShowPins] = useState(false);
  const [mentionQ, setMentionQ] = useState<string | null>(null);
  const [pickerTab, setPickerTab] = useState<'emoji' | 'stiker' | null>(null);
  const [emojiCat, setEmojiCat] = useState(EMOJI_GROUPS[0].id);
  const [stickers, setStickers] = useState<any[]>([]);
  const stickerFileRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingCh = useRef<any>(null);
  const me = teamMembers.find((m: any) => m.id === currentUserId);

  const toBottom = (smooth = false) => setTimeout(() => {
    const el = scrollRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, 60);

  /* muat pesan + reaction */
  const load = useCallback(async () => {
    if (!supabase || !channel?.id) return;
    setLoading(true);
    try {
      const list = await loadMessages(supabase, channel.id);
      setMsgs(list);
      setRx(await loadReactions(supabase, list.map((m: any) => m.id)));
      await markRead(supabase, channel.id, currentUserId);
      toBottom();
    } catch (e: any) { toast('Gagal memuat pesan: ' + (e?.message || e)); }
    setLoading(false);
  }, [supabase, channel?.id, currentUserId, toast]);

  useEffect(() => { load(); setReplyTo(null); setEditing(null); setText(''); setAttachTask(null); }, [load]);
  useEffect(() => { if (supabase) loadStickers(supabase).then(setStickers).catch(() => {}); }, [supabase]);

  /* realtime pesan + reaction */
  useEffect(() => {
    if (!supabase || !channel?.id) return;
    const ch = supabase
      .channel(`room-${channel.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channel.id}` }, (p: any) => {
        if (p.eventType === 'INSERT') {
          setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new]));
          markRead(supabase, channel.id, currentUserId);
          toBottom(true);
        }
        if (p.eventType === 'UPDATE') setMsgs((m) => m.map((x) => (x.id === p.new.id ? p.new : x)));
        if (p.eventType === 'DELETE') setMsgs((m) => m.filter((x) => x.id !== p.old.id));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions' }, (p: any) => {
        if (p.eventType === 'INSERT') setRx((r) => (r.some((x) => x.id === p.new.id) ? r : [...r, p.new]));
        if (p.eventType === 'DELETE') setRx((r) => r.filter((x) => x.id !== p.old.id));
      })
      .subscribe();

    // indikator "sedang mengetik"
    const t = supabase.channel(`typing-${channel.id}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
        if (!payload?.name) return;
        setTyping((prev) => (prev.includes(payload.name) ? prev : [...prev, payload.name]));
        setTimeout(() => setTyping((prev) => prev.filter((n) => n !== payload.name)), 3000);
      })
      .subscribe();
    typingCh.current = t;

    return () => { supabase.removeChannel(ch); supabase.removeChannel(t); };
  }, [supabase, channel?.id, currentUserId]);

  const pingTyping = () => {
    if (!typingCh.current || !me) return;
    typingCh.current.send({ type: 'broadcast', event: 'typing', payload: { name: me.name.split(' ')[0] } });
  };

  /* kirim */
  const send = async () => {
    const body = text.trim();
    if ((!body && !attachTask) || !canPost) return;
    setText(''); const rt = replyTo?.id || null; const tr = attachTask; setReplyTo(null); setAttachTask(null);
    try {
      const row = await sendMessage(supabase, {
        channel_id: channel.id, author_id: currentUserId, content: body,
        reply_to: rt, task_ref: tr, attachments: [],
      });
      setMsgs((m) => (m.some((x) => x.id === row.id) ? m : [...m, row]));
      toBottom(true);

      // 🔔 Notifikasi push ke anggota channel (kecuali pengirim)
      pushNotify(supabase, {
        memberIds: recipients,
        title: `#${channel.name} • ${me?.name || 'Pesan baru'}`,
        body: body || (tr ? 'Menempelkan sebuah tugas' : 'Mengirim lampiran'),
        url: window.location.pathname,
        tag: `chat-${channel.id}`,
      });
    } catch (e: any) { toast('Gagal mengirim: ' + (e?.message || e)); }
  };

  /* kirim stiker */
  const sendSticker = async (st: any) => {
    setPickerTab(null);
    try {
      const row = await sendMessage(supabase, {
        channel_id: channel.id, author_id: currentUserId, content: '',
        attachments: [{ type: 'sticker', url: st.url, name: st.name || 'stiker' }],
        reply_to: replyTo?.id || null,
      });
      setMsgs((m) => (m.some((x) => x.id === row.id) ? m : [...m, row]));
      setReplyTo(null); toBottom(true);
      pushNotify(supabase, {
        memberIds: recipients,
        title: `#${channel.name} • ${me?.name || 'Pesan baru'}`,
        body: 'Mengirim stiker 🎨',
        url: window.location.pathname, tag: `chat-${channel.id}`,
      });
    } catch (e: any) { toast('Gagal kirim stiker: ' + (e?.message || e)); }
  };

  /* kirim emoji besar (stiker bawaan) */
  const sendBigEmoji = async (emo: string) => {
    setPickerTab(null);
    try {
      const row = await sendMessage(supabase, {
        channel_id: channel.id, author_id: currentUserId, content: emo,
        reply_to: replyTo?.id || null, attachments: [],
      });
      setMsgs((m) => (m.some((x) => x.id === row.id) ? m : [...m, row]));
      setReplyTo(null); toBottom(true);
      pushNotify(supabase, {
        memberIds: recipients,
        title: `#${channel.name} • ${me?.name || 'Pesan baru'}`,
        body: emo, url: window.location.pathname, tag: `chat-${channel.id}`,
      });
    } catch (e: any) { toast('Gagal: ' + (e?.message || e)); }
  };

  /* unggah stiker kustom (manajer) */
  const uploadSticker = async (file: File) => {
    try {
      const row = await addSticker(supabase, file, currentUserId);
      setStickers((s) => [row, ...s]);
      toast('Stiker ditambahkan');
    } catch (e: any) { toast('Gagal unggah stiker: ' + (e?.message || e)); }
  };

  const removeSticker = async (id: string) => {
    setStickers((s) => s.filter((x) => x.id !== id));
    try { await deleteSticker(supabase, id); } catch { /* abaikan */ }
  };

  const upload = async (file: File) => {
    if (!file || !canPost) return;
    setUploading(true);
    try {
      const att = await uploadChatFile(supabase, file);
      const row = await sendMessage(supabase, {
        channel_id: channel.id, author_id: currentUserId, content: '',
        attachments: [att], reply_to: replyTo?.id || null,
      });
      setMsgs((m) => (m.some((x) => x.id === row.id) ? m : [...m, row]));
      setReplyTo(null); toBottom(true);
    } catch (e: any) { toast('Gagal unggah: ' + (e?.message || e)); }
    setUploading(false);
  };

  /* Tempel tangkapan layar dari papan klip (Ctrl+V / ⌘V).

     Pendengarnya dipasang di window, bukan di elemen. Peristiwa tempel
     hanya terjadi pada elemen yang sedang difokus, dan sebuah <div>
     tidak bisa difokus — kalau dipasang di sana, menempel hanya bekerja
     setelah kolom pesan diklik lebih dulu. Justru itu yang mau dihindari.

     Ref dipakai supaya pendaftarannya cukup sekali, tetapi isinya selalu
     versi terbaru: kalau bergantung pada daftar dependensi, pendengarnya
     dipasang-lepas setiap kali ada pesan masuk. */
  const tempelRef = useRef<(e: ClipboardEvent) => void>(() => {});
  tempelRef.current = (e: ClipboardEvent) => {
    if (!canPost || uploading) return;
    const gambar: File[] = [];
    for (const item of Array.from(e.clipboardData?.items || [])) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (!f) continue;
        // Tangkapan layar dari papan klip sering tanpa nama yang berarti.
        gambar.push(
          f.name && f.name !== 'image.png'
            ? f
            : new File([f], `tangkapan-${Date.now()}.png`, { type: f.type })
        );
      }
    }
    // Papan klip berisi teks biasa — biarkan kolom pesan menanganinya.
    if (!gambar.length) return;
    e.preventDefault();
    (async () => { for (const f of gambar) await upload(f); })();
  };

  useEffect(() => {
    const dengar = (e: ClipboardEvent) => tempelRef.current(e);
    window.addEventListener('paste', dengar);
    return () => window.removeEventListener('paste', dengar);
  }, []);

  const react = async (mid: string, emoji: string) => {
    const on = !rx.some((r) => r.message_id === mid && r.member_id === currentUserId && r.emoji === emoji);
    setEmojiFor(null);
    try { await toggleReaction(supabase, mid, currentUserId, emoji, on); }
    catch (e: any) { toast('Gagal: ' + (e?.message || e)); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const v = editText.trim(); const id = editing.id; setEditing(null);
    try { await editMessage(supabase, id, v); } catch (e: any) { toast('Gagal edit: ' + (e?.message || e)); }
  };

  const remove = async (id: string) => {
    setMsgs((m) => m.filter((x) => x.id !== id));
    try { await deleteMessage(supabase, id); } catch (e: any) { toast('Gagal hapus: ' + (e?.message || e)); }
  };

  const pin = async (m: any) => {
    try { await setPinned(supabase, m.id, !m.pinned); } catch (e: any) { toast('Gagal pin: ' + (e?.message || e)); }
  };

  /* mention autocomplete */
  const onType = (v: string) => {
    setText(v); pingTyping();
    const m = /@([\w]*)$/.exec(v);
    setMentionQ(m ? m[1].toLowerCase() : null);
  };
  const pickMention = (name: string) => {
    setText((t) => t.replace(/@([\w]*)$/, `@${name} `));
    setMentionQ(null);
  };
  const mentionList = mentionQ !== null
    ? teamMembers.filter((m: any) => String(m.name || '').toLowerCase().includes(mentionQ)).slice(0, 6) : [];

  /* render isi pesan: mention + link */
  const renderBody = (content: string) => {
    if (!content) return null;
    const names = teamMembers.map((m: any) => m.name).filter(Boolean).sort((a: string, b: string) => b.length - a.length);
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = content.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((p, i) => {
      if (/^https?:\/\//.test(p)) {
        return <a key={i} href={p} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all">{p}</a>;
      }
      if (!names.length) return <span key={i}>{p}</span>;
      const re = new RegExp(`(@(?:${names.map(esc).join('|')}))`, 'g');
      return p.split(re).map((q, j) => {
        if (q.startsWith('@') && names.some((n: string) => `@${n}` === q)) {
          const isMe = me && q === `@${me.name}`;
          return <span key={`${i}-${j}`} className={`px-1 rounded font-semibold ${isMe ? 'bg-magenta/25 text-[#f480b0]' : 'bg-primer/20 text-blue-300'}`}>{q}</span>;
        }
        return <span key={`${i}-${j}`}>{q}</span>;
      });
    });
  };

  const member = (id: string) => teamMembers.find((m: any) => m.id === id);
  const pins = msgs.filter((m) => m.pinned);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-kartu-hover">
      {/* header channel */}
      <div className="h-12 border-b border-white/10 flex items-center gap-2 px-4 shrink-0">
        {onBack && (
          <button onClick={onBack} className="md:hidden p-1 -ml-2 mr-0.5 text-gray-400 hover:text-white shrink-0">
            <ChevronLeft size={18} />
          </button>
        )}
        {channel.is_announcement ? <Megaphone size={16} className="text-amber-400" />
          : channel.is_private ? <Lock size={15} className="text-gray-500" />
          : <Hash size={16} className="text-gray-500" />}
        <span className="text-sm font-bold text-gray-100">{channel.name}</span>
        {channel.description && <>
          <span className="w-px h-4 bg-kartu-hover mx-1 hidden sm:block" />
          <span className="text-xs text-gray-500 truncate hidden sm:block">{channel.description}</span>
        </>}
        {pins.length > 0 && (
          <button onClick={() => setShowPins((v) => !v)} className="ml-auto flex items-center gap-1 text-[11px] text-gray-400 hover:text-white bg-white/5 px-2 py-1 rounded-lg shrink-0">
            <Pin size={12} /> {pins.length}
          </button>
        )}
      </div>

      {/* pinned */}
      {showPins && pins.length > 0 && (
        <div className="border-b border-white/10 bg-kartu px-4 py-2.5 max-h-40 overflow-y-auto shrink-0">
          <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-1.5">Pesan Tersemat</p>
          {pins.map((m) => (
            <div key={m.id} className="text-xs text-gray-300 py-1 flex gap-2">
              <span className="font-semibold text-gray-400 shrink-0">{member(m.author_id)?.name?.split(' ')[0]}:</span>
              <span className="truncate">{m.content || '📎 lampiran'}</span>
            </div>
          ))}
        </div>
      )}

      {/* daftar pesan */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
        {loading ? <div className="h-full min-h-[60vh] flex items-center justify-center"><LoadingLogo size={48} text="Memuat pesan" /></div> : msgs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4"><Hash size={24} className="text-gray-600" /></div>
            <p className="text-sm text-gray-400 font-semibold">Selamat datang di #{channel.name}</p>
            <p className="text-xs text-gray-600 mt-1">{canPost ? 'Ini awal percakapan. Sapa timmu!' : 'Hanya manajer yang dapat mengirim di channel ini.'}</p>
          </div>
        ) : msgs.map((m, i) => {
          const prev = msgs[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          const grouped = prev && !newDay && prev.author_id === m.author_id
            && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000)
            && !m.reply_to;
          const a = member(m.author_id);
          const mine = m.author_id === currentUserId;
          const myRx = rx.filter((r) => r.message_id === m.id);
          const grouping: Record<string, any[]> = {};
          myRx.forEach((r) => { (grouping[r.emoji] = grouping[r.emoji] || []).push(r); });
          const replied = m.reply_to ? msgs.find((x) => x.id === m.reply_to) : null;
          const mentionsMe = me && String(m.content || '').includes(`@${me.name}`);

          return (
            <div key={m.id}>
              {newDay && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">{dayLabel(m.created_at)}</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              )}

              <div className={`group/msg relative flex gap-3 px-2 -mx-2 py-0.5 rounded-lg hover:bg-white/5 ${mentionsMe ? 'bg-amber-500/[0.06] border-l-2 border-amber-500/60' : ''} ${grouped ? '' : 'mt-3'}`}>
                {grouped ? (
                  <span className="w-9 shrink-0 text-[9px] text-gray-700 opacity-0 group-hover/msg:opacity-100 text-right pt-1">{timeOf(m.created_at)}</span>
                ) : (
                  <Avatar url={a?.avatarUrl} name={a?.name} initials={a?.initials || '?'} className={`w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${mColor(a)}`} />
                )}

                <div className="flex-1 min-w-0">
                  {replied && (
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mb-0.5 truncate">
                      <CornerUpLeft size={10} className="shrink-0" />
                      <span className="font-semibold text-gray-400">{member(replied.author_id)?.name?.split(' ')[0]}</span>
                      <span className="truncate">{replied.content || '📎 lampiran'}</span>
                    </div>
                  )}

                  {!grouped && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-bold" style={{ color: a?.color?.match(/#[0-9a-fA-F]{3,8}/)?.[0] || '#579bfc' }} title={a?.name}>{namaPendek(a) || 'Tanpa Nama'}</span>
                      <span className="text-[10px] text-gray-600">{timeOf(m.created_at)}</span>
                    </div>
                  )}

                  {editing?.id === m.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null); }}
                        className="flex-1 bg-input border border-white/10 rounded-lg px-3 py-1.5 text-[13px] text-white outline-none focus:border-primer" />
                      <button onClick={saveEdit} className="p-1.5 text-emerald-400 hover:bg-kartu-hover rounded"><Check size={14} /></button>
                      <button onClick={() => setEditing(null)} className="p-1.5 text-gray-500 hover:bg-kartu-hover rounded"><X size={14} /></button>
                    </div>
                  ) : (
                    <>
                      {m.content && (
                        isOnlyEmoji(m.content) ? (
                          <p className="text-4xl leading-tight mt-1">{m.content}</p>
                        ) : (
                          <p className="text-[13px] text-gray-200 leading-relaxed break-words whitespace-pre-wrap">
                            {renderBody(m.content)}
                            {m.edited_at && <span className="text-[9px] text-gray-600 ml-1.5">(diedit)</span>}
                          </p>
                        )
                      )}

                      {(m.attachments || []).map((att: any, k: number) => (
                        att.type === 'sticker' ? (
                          <img key={k} src={att.url} alt={att.name} className="mt-1.5 w-28 h-28 object-contain" />
                        ) : /^image\//.test(att.type || '') ? (
                          <button key={k} onClick={() => setLightbox(att.url)} className="block mt-1.5" title="Lihat gambar">
                            <img src={att.url} alt={att.name} className="max-w-xs max-h-64 rounded-lg border border-white/10 hover:border-white/10 transition-colors" />
                          </button>
                        ) : (
                          <a key={k} href={att.url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-2 bg-kartu border border-white/10 hover:border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300">
                            <FileText size={13} className="text-blue-400" /> {att.name}
                          </a>
                        )
                      ))}

                      {m.task_ref && <TaskCard taskId={m.task_ref} />}

                      {Object.keys(grouping).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {Object.entries(grouping).map(([emo, list]: any) => {
                            const mineR = list.some((r: any) => r.member_id === currentUserId);
                            return (
                              <button key={emo} onClick={() => react(m.id, emo)}
                                title={list.map((r: any) => member(r.member_id)?.name).filter(Boolean).join(', ')}
                                className={`flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-md border transition-colors ${mineR ? 'bg-primer/20 border-primer/50 text-blue-200' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/10'}`}>
                                <span>{emo}</span><span className="font-semibold">{list.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* toolbar hover */}
                {!editing && (
                  <div className="absolute -top-3 right-2 hidden group-hover/msg:flex items-center gap-0.5 bg-kartu border border-white/10 rounded-lg shadow-lg px-1 py-0.5 z-20">
                    <div className="relative">
                      <button onClick={() => setEmojiFor(emojiFor === m.id ? null : m.id)} title="Reaksi" className="p-1.5 text-gray-400 hover:text-white rounded"><Smile size={14} /></button>
                      {emojiFor === m.id && (
                        <div className="absolute right-0 top-full mt-1 flex gap-0.5 bg-kartu border border-white/10 rounded-lg p-1 shadow-xl z-30">
                          {EMOJIS.map((e) => <button key={e} onClick={() => react(m.id, e)} className="w-7 h-7 rounded hover:bg-kartu-hover text-sm">{e}</button>)}
                        </div>
                      )}
                    </div>
                    {canPost && <button onClick={() => setReplyTo(m)} title="Balas" className="p-1.5 text-gray-400 hover:text-white rounded"><Reply size={14} /></button>}
                    {isManager && <button onClick={() => setTaskModal(m)} title="Jadikan tugas" className="p-1.5 text-gray-400 hover:text-blue-300 rounded"><ListPlus size={14} /></button>}
                    {(isManager || mine) && <button onClick={() => pin(m)} title={m.pinned ? 'Lepas pin' : 'Sematkan'} className={`p-1.5 rounded hover:text-amber-300 ${m.pinned ? 'text-amber-400' : 'text-gray-400'}`}><Pin size={14} /></button>}
                    {mine && <button onClick={() => { setEditing(m); setEditText(m.content || ''); }} title="Edit" className="p-1.5 text-gray-400 hover:text-white rounded"><Pencil size={14} /></button>}
                    {(mine || isManager) && <button onClick={() => remove(m.id)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-400 rounded"><Trash2 size={14} /></button>}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {typing.length > 0 && (
          <p className="text-[11px] text-gray-500 italic mt-2 px-2">
            {typing.join(', ')} sedang mengetik…
          </p>
        )}
      </div>

      {/* composer */}
      <div className="shrink-0 border-t border-white/10 bg-kartu-hover px-4 py-3">
        {replyTo && (
          <div className="flex items-center gap-2 mb-2 bg-kartu border border-white/10 rounded-lg px-3 py-1.5">
            <CornerUpLeft size={12} className="text-blue-400 shrink-0" />
            <span className="text-[11px] text-gray-400 truncate flex-1">
              Membalas <b className="text-gray-300">{member(replyTo.author_id)?.name}</b>: {replyTo.content?.slice(0, 60) || '📎 lampiran'}
            </span>
            <button onClick={() => setReplyTo(null)} className="p-0.5 text-gray-500 hover:text-white"><X size={13} /></button>
          </div>
        )}

        {attachTask && (
          <div className="flex items-center gap-2 mb-2 bg-primer/10 border border-primer/30 rounded-lg px-3 py-1.5">
            <Link2 size={12} className="text-blue-400 shrink-0" />
            <span className="text-[11px] text-blue-200 truncate flex-1">Tugas ditempel: {findTask(boardsDataMap, attachTask)?.item?.name || 'tugas'}</span>
            <button onClick={() => setAttachTask(null)} className="p-0.5 text-gray-500 hover:text-white"><X size={13} /></button>
          </div>
        )}

        {!canPost ? (
          <p className="text-xs text-gray-600 text-center py-2.5 bg-kartu border border-white/10 rounded-xl">
            <Megaphone size={12} className="inline mr-1.5 -mt-0.5" /> Channel pengumuman — hanya manajer yang dapat mengirim pesan.
          </p>
        ) : (
          <div className="relative">
            {mentionList.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-kartu border border-white/10 rounded-xl shadow-2xl p-1 z-30">
                {mentionList.map((m: any) => (
                  <button key={m.id} onClick={() => pickMention(m.name)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-left">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${mColor(m)}`}>{m.initials}</span>
                    <span className="text-[11px] text-gray-200 truncate">{m.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ══ PANEL EMOJI & STIKER ══ */}
            {pickerTab && (
              <>
                <div className="fixed inset-0 z-[95]" onClick={() => setPickerTab(null)} />
                <div className="absolute bottom-full left-0 mb-2 w-[min(340px,90vw)] bg-kartu border border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden">
                  <div className="flex items-center gap-1 p-2 border-b border-white/10/70">
                    <button onClick={() => setPickerTab('emoji')} className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg transition-colors ${pickerTab === 'emoji' ? 'bg-primer text-white' : 'text-gray-400 hover:text-white'}`}>
                      <Smile size={13} /> Emoji
                    </button>
                    <button onClick={() => setPickerTab('stiker')} className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold py-1.5 rounded-lg transition-colors ${pickerTab === 'stiker' ? 'bg-primer text-white' : 'text-gray-400 hover:text-white'}`}>
                      <Sticker size={13} /> Stiker
                    </button>
                    <button onClick={() => setPickerTab(null)} className="p-1.5 text-gray-500 hover:text-white"><X size={14} /></button>
                  </div>

                  {pickerTab === 'emoji' ? (
                    <>
                      <div className="flex gap-1 px-2 pt-2 overflow-x-auto">
                        {EMOJI_GROUPS.map((g) => (
                          <button key={g.id} onClick={() => setEmojiCat(g.id)}
                            className={`text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap transition-colors ${emojiCat === g.id ? 'bg-kartu-hover text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                            {g.label}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-48 overflow-y-auto overscroll-contain">
                        {(EMOJI_GROUPS.find((g) => g.id === emojiCat)?.list || []).map((e, i) => (
                          <button key={`${e}-${i}`} onClick={() => { setText((t) => t + e); }}
                            className="h-8 w-8 flex items-center justify-center text-lg rounded-lg hover:bg-white/5 transition-colors">
                            {e}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="p-2.5 max-h-56 overflow-y-auto overscroll-contain">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider mb-1.5">Stiker Cepat</p>
                      <div className="grid grid-cols-6 gap-1 mb-3">
                        {BUILTIN_STICKERS.map((e) => (
                          <button key={e} onClick={() => sendBigEmoji(e)} title="Kirim sebagai stiker"
                            className="h-11 flex items-center justify-center text-2xl rounded-xl bg-white/5 hover:bg-kartu-hover transition-colors">
                            {e}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-wider">Stiker Tim ({stickers.length})</p>
                        {isManager && (
                          <button onClick={() => stickerFileRef.current?.click()} className="flex items-center gap-1 text-[9px] font-bold text-blue-400 hover:text-blue-300">
                            <Plus size={10} /> Tambah
                          </button>
                        )}
                      </div>
                      <input ref={stickerFileRef} type="file" accept="image/*" hidden
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSticker(f); e.currentTarget.value = ''; }} />

                      {stickers.length === 0 ? (
                        <p className="text-[10px] text-gray-600 text-center py-4">
                          {isManager ? 'Belum ada. Klik "Tambah" untuk unggah stiker tim.' : 'Belum ada stiker tim.'}
                        </p>
                      ) : (
                        <div className="grid grid-cols-4 gap-1.5">
                          {stickers.map((st) => (
                            <div key={st.id} className="relative group/st">
                              <button onClick={() => sendSticker(st)} className="w-full aspect-square rounded-xl bg-white/5 hover:bg-kartu-hover p-1.5 transition-colors">
                                <img src={st.url} alt={st.name} className="w-full h-full object-contain" />
                              </button>
                              {isManager && (
                                <button onClick={() => removeSticker(st.id)} title="Hapus stiker"
                                  className="absolute -top-1 -right-1 opacity-0 group-hover/st:opacity-100 p-1 bg-red-500 text-white rounded-full transition-opacity">
                                  <TrashIcon size={9} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="flex items-end gap-2 bg-kartu border border-white/10 focus-within:border-white/10 rounded-xl px-3 py-2 transition-colors">
              <input ref={fileRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.currentTarget.value = ''; }} />
              <button onClick={() => setPickerTab(pickerTab ? null : 'emoji')} title="Emoji & stiker" className={`p-1.5 rounded transition-colors shrink-0 ${pickerTab ? 'text-amber-300' : 'text-gray-500 hover:text-amber-300'}`}>
                <Smile size={16} />
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={uploading} title="Lampirkan file" className="p-1.5 text-gray-500 hover:text-white rounded transition-colors shrink-0">
                <Paperclip size={16} />
              </button>
              <button onClick={() => setPickerOpen(true)} title="Tempel tugas" className="p-1.5 text-gray-500 hover:text-blue-300 rounded transition-colors shrink-0">
                <ListPlus size={16} />
              </button>
              <textarea
                rows={1} value={text}
                onChange={(e) => onType(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder={uploading ? 'Mengunggah…' : `Kirim pesan ke #${channel.name}`}
                className="flex-1 bg-transparent text-[13px] text-white outline-none resize-none max-h-32 py-1.5 placeholder:text-gray-600"
              />
              <button onClick={send} disabled={!text.trim() && !attachTask} className="p-1.5 text-blue-400 hover:text-blue-300 disabled:text-gray-700 rounded transition-colors shrink-0">
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {pickerOpen && <TaskPicker onPick={(id: string) => { setAttachTask(id); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />}
      {taskModal && <CreateTaskModal message={taskModal} onDone={() => setTaskModal(null)} onClose={() => setTaskModal(null)} />}

      {/* Pratinjau gambar — dulu membuka tab baru, yang berarti keluar
          dari percakapan lalu harus kembali lagi. Sekarang menumpang
          di atas ruang chat dan ditutup dengan klik, Escape, atau silang. */}
      {lightbox && (
        <>
          <div className="fixed inset-0 bg-black/85 z-[140]" onClick={() => setLightbox(null)} />
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 pointer-events-none">
            <img src={lightbox} alt="Pratinjau gambar" className="max-w-full max-h-full rounded-xl object-contain pointer-events-auto" />
          </div>
          <a
            href={lightbox} target="_blank" rel="noreferrer"
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[160] text-[11px] text-gray-400 hover:text-white bg-kartu/90 border border-white/10 rounded-lg px-3 py-1.5"
          >
            Buka ukuran asli
          </a>
          <button
            onClick={() => setLightbox(null)}
            title="Tutup"
            className="fixed top-4 right-4 z-[160] p-2 bg-kartu/90 text-white rounded-lg hover:bg-kartu-hover"
          >
            <X size={18} />
          </button>
        </>
      )}
    </div>
  );
}
