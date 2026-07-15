'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Hash, Lock, Megaphone, Plus, ChevronLeft, ChevronDown, X, Settings2,
  Users, Trash2, Check, Search, Bell, BellOff, Volume2, Video,
} from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import ItemDetailPanel from '@/components/tracker/ItemDetailPanel';
import ChatRoom from '@/components/chat/ChatRoom';
import VoiceRoom from '@/components/chat/VoiceRoom';
import LoadingLogo from '@/components/LoadingLogo';
import { enablePush, disablePush, pushStatus, clearBadge } from '@/lib/push';
import {
  loadChannels, loadChannelMembers, createChannel, updateChannel, deleteChannel,
  setChannelMembers, unreadByChannel,
} from '@/lib/tracker/chat';

const mColor = (m: any) => (m?.color && String(m.color).startsWith('bg-') ? m.color : 'bg-[#579bfc]');

/* ══════ Modal kelola channel (manajer) ══════ */
function ChannelModal({ channel, members, onClose, onSaved }: any) {
  const { supabase, teamMembers, currentUserId, pushToast }: any = useDashboard();
  const isNew = !channel?.id;
  const [name, setName] = useState(channel?.name || '');
  const [category, setCategory] = useState(channel?.category || 'UMUM');
  const [desc, setDesc] = useState(channel?.description || '');
  const [priv, setPriv] = useState(!!channel?.is_private);
  const [ann, setAnn] = useState(!!channel?.is_announcement);
  const [voice, setVoice] = useState(!!channel?.is_voice);
  const [sel, setSel] = useState<string[]>(members || []);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = teamMembers.filter((m: any) => String(m.name || '').toLowerCase().includes(q.toLowerCase()));
  const cls = "w-full bg-[#1a1c23] border border-zinc-700 focus:border-blue-500/60 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none";

  const submit = async () => {
    const nm = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (!nm) { pushToast('Nama channel wajib diisi.'); return; }
    setBusy(true);
    try {
      let id = channel?.id;
      if (isNew) {
        const row = await createChannel(supabase, {
          name: nm, category: category.trim().toUpperCase() || 'UMUM', description: desc.trim() || null,
          is_private: priv, is_announcement: ann, is_voice: voice, created_by: currentUserId,
        });
        id = row.id;
      } else {
        await updateChannel(supabase, id, {
          name: nm, category: category.trim().toUpperCase() || 'UMUM',
          description: desc.trim() || null, is_private: priv, is_announcement: ann, is_voice: voice,
        });
      }
      if (priv) await setChannelMembers(supabase, id, sel);
      else await setChannelMembers(supabase, id, []);
      pushToast(isNew ? `Channel #${nm} dibuat` : 'Channel diperbarui');
      onSaved();
    } catch (e: any) { pushToast('Gagal: ' + (e?.message || e)); }
    setBusy(false);
  };

  const hapus = async () => {
    if (!channel?.id) return;
    setBusy(true);
    try { await deleteChannel(supabase, channel.id); pushToast('Channel dihapus'); onSaved(); }
    catch (e: any) { pushToast('Gagal hapus: ' + (e?.message || e)); }
    setBusy(false);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[120]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md bg-[#2a2c38] border border-zinc-700 rounded-2xl shadow-2xl z-[130] p-5 max-h-[86vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">{isNew ? 'Buat Channel' : `Kelola #${channel.name}`}</h3>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Nama Channel</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="misal: brief-harian" className={cls} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Kategori</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="UMUM / DIVISI" className={cls} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Deskripsi</label>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Topik channel ini…" className={cls} />
          </div>

          <div className="flex flex-col gap-2 bg-[#1a1c23] border border-zinc-800 rounded-xl p-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} className="accent-[#2b5cd5]" />
              <Lock size={12} className="text-zinc-500" />
              <span className="text-xs text-zinc-300">Channel privat — hanya anggota terpilih</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={ann} onChange={(e) => setAnn(e.target.checked)} className="accent-amber-500" />
              <Megaphone size={12} className="text-amber-400" />
              <span className="text-xs text-zinc-300">Channel pengumuman — hanya manajer bisa kirim</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} className="accent-emerald-500" />
              <Volume2 size={12} className="text-emerald-400" />
              <span className="text-xs text-zinc-300">Channel suara — voice & video call</span>
            </label>
          </div>

          {priv && (
            <div>
              <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-1.5">Anggota ({sel.length})</label>
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 mb-1.5">
                <Search size={12} className="text-zinc-500" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…" className="bg-transparent text-[11px] text-white outline-none w-full" />
              </div>
              <div className="max-h-44 overflow-y-auto flex flex-col gap-0.5">
                {filtered.map((m: any) => {
                  const on = sel.includes(m.id);
                  return (
                    <button key={m.id} onClick={() => setSel((s) => (on ? s.filter((x) => x !== m.id) : [...s, m.id]))}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left ${on ? 'bg-blue-500/10' : 'hover:bg-zinc-700/50'}`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white ${mColor(m)}`}>{m.initials}</span>
                      <span className={`text-[11px] flex-1 truncate ${on ? 'text-white font-semibold' : 'text-zinc-400'}`}>{m.name}</span>
                      {on && <Check size={12} className="text-blue-400" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button onClick={submit} disabled={busy} className="mt-1 w-full bg-[#2b5cd5] hover:bg-blue-600 disabled:opacity-60 text-white text-xs font-bold py-2.5 rounded-lg transition-all">
            {busy ? 'Menyimpan…' : isNew ? 'Buat Channel' : 'Simpan Perubahan'}
          </button>

          {!isNew && (
            <button onClick={hapus} disabled={busy} className="w-full flex items-center justify-center gap-1.5 text-[11px] text-zinc-600 hover:text-red-400 py-2 transition-colors">
              <Trash2 size={12} /> Hapus channel ini
            </button>
          )}
        </div>
      </div>
    </>
  );
}

/* ══════════════ APLIKASI CHAT ══════════════ */
export default function ChatApp() {
  const { supabase, currentUserId, teamMembers, currentUserRole, pushToast, isLoaded }: any = useDashboard();
  const isManager = currentUserRole === 'manager';
  const pathname = usePathname();
  const backHref = pathname && pathname.startsWith('/admin') ? '/admin/dashboard' : '/user/dashboard';

  const [channels, setChannels] = useState<any[]>([]);
  const [chMembers, setChMembers] = useState<any[]>([]);
  const [active, setActive] = useState<any>(null);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [mobileRoom, setMobileRoom] = useState(false); // mobile: false = daftar channel, true = ruang chat
  const [chLoading, setChLoading] = useState(true);
  const [modal, setModal] = useState<any>(null);
  const [online, setOnline] = useState<string[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [notif, setNotif] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [voiceCh, setVoiceCh] = useState<any>(null); // channel voice yang sedang diikuti

  useEffect(() => { setNotif(pushStatus()); clearBadge(); }, []);

  const toggleNotif = async () => {
    try {
      if (notif === 'granted') { await disablePush(supabase); setNotif('default'); pushToast('Notifikasi dimatikan'); }
      else { await enablePush(supabase, currentUserId); setNotif('granted'); pushToast('🔔 Notifikasi aktif — pesan baru akan muncul di HP'); }
    } catch (e: any) { pushToast(e?.message || 'Gagal mengaktifkan notifikasi'); }
  };

  const me = teamMembers.find((m: any) => m.id === currentUserId);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setChLoading(true);
    try {
      const [cs, cm, un] = await Promise.all([
        loadChannels(supabase), loadChannelMembers(supabase), unreadByChannel(supabase),
      ]);
      setChannels(cs); setChMembers(cm); setUnread(un);
      setActive((a: any) => (a ? cs.find((c: any) => c.id === a.id) || cs[0] || null : cs[0] || null));
    } catch (e: any) { pushToast('Gagal memuat channel: ' + (e?.message || e)); }
    setChLoading(false);
  }, [supabase, pushToast]);

  useEffect(() => { if (isLoaded) refresh(); }, [isLoaded, refresh]);

  /* badge belum dibaca untuk channel LAIN + notif mention */
  useEffect(() => {
    if (!supabase || !currentUserId) return;
    const ch = supabase
      .channel('chat-global')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (p: any) => {
        const m = p.new;
        if (m.author_id === currentUserId) return;
        if (active?.id === m.channel_id) return;
        setUnread((u) => ({ ...u, [m.channel_id]: (u[m.channel_id] || 0) + 1 }));
        if (me && String(m.content || '').includes(`@${me.name}`)) {
          const cname = channels.find((c: any) => c.id === m.channel_id)?.name || 'channel';
          pushToast(`🔔 Kamu disebut di #${cname}`, () => {
            const c = channels.find((x: any) => x.id === m.channel_id);
            if (c) { setActive(c); setUnread((u) => ({ ...u, [c.id]: 0 })); }
          }, 'Buka', 12000);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, currentUserId, active?.id, channels, me, pushToast]);

  /* presence: siapa online */
  useEffect(() => {
    if (!supabase || !currentUserId) return;
    const ch = supabase.channel('chat-presence', { config: { presence: { key: currentUserId } } });
    ch.on('presence', { event: 'sync' }, () => {
      setOnline(Object.keys(ch.presenceState() || {}));
    }).subscribe(async (st: string) => {
      if (st === 'SUBSCRIBED') await ch.track({ at: Date.now() });
    });
    return () => { supabase.removeChannel(ch); };
  }, [supabase, currentUserId]);

  const openChannel = (c: any) => {
    setActive(c); setMobileRoom(true);
    setUnread((u) => ({ ...u, [c.id]: 0 }));
  };

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    channels.forEach((c) => { (g[c.category || 'UMUM'] = g[c.category || 'UMUM'] || []).push(c); });
    return g;
  }, [channels]);

  const membersOfActive = active
    ? (active.is_private
        ? chMembers.filter((m) => m.channel_id === active.id).map((m) => m.member_id)
        : teamMembers.map((m: any) => m.id))
    : [];

  return (
    <div className="fixed inset-0 z-[70] flex bg-[#1e2029] text-zinc-100 font-sans overflow-hidden">

      {/* ══ SIDEBAR CHANNEL ══ */}
      <aside className={`${mobileRoom ? 'hidden' : 'flex'} md:flex w-full md:w-64 shrink-0 flex-col bg-[#15171c] border-r border-zinc-800/80`}>
        <div className="h-12 border-b border-zinc-800 flex items-center gap-2 px-3 shrink-0">
          <Link href={backHref} title="Kembali ke Portal" className="flex items-center gap-1 text-xs font-bold text-white bg-[#2b5cd5] hover:bg-[#2450bd] px-2.5 py-1.5 rounded-lg transition-all shadow-[0_0_12px_rgba(43,92,213,0.4)]">
            <ChevronLeft size={14} /> Portal
          </Link>
          <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest ml-1">Chat</span>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain py-3 px-2">
          {chLoading && <div className="min-h-[55vh] flex items-center justify-center"><LoadingLogo size={44} text="Memuat channel" /></div>}
          {!chLoading && Object.entries(grouped).map(([cat, list]: any) => (
            <div key={cat} className="mb-3">
              <button onClick={() => setCollapsed((c) => ({ ...c, [cat]: !c[cat] }))}
                className="w-full flex items-center gap-1 px-1.5 py-1 text-[10px] font-black text-zinc-500 hover:text-zinc-300 uppercase tracking-wider transition-colors">
                <ChevronDown size={11} className={`transition-transform ${collapsed[cat] ? '-rotate-90' : ''}`} />
                {cat}
              </button>

              {!collapsed[cat] && list.map((c: any) => {
                const on = active?.id === c.id;
                const n = unread[c.id] || 0;
                return (
                  <div key={c.id} className="group/ch relative">
                    <button onClick={() => openChannel(c)}
                      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${on ? 'bg-zinc-700/60 text-white' : n > 0 ? 'text-white hover:bg-zinc-800/60' : 'text-zinc-500 hover:bg-zinc-800/40 hover:text-zinc-300'}`}>
                      {c.is_voice ? <Volume2 size={14} className="shrink-0 text-emerald-400/80" />
                        : c.is_announcement ? <Megaphone size={14} className="shrink-0 text-amber-400/80" />
                        : c.is_private ? <Lock size={12} className="shrink-0" />
                        : <Hash size={14} className="shrink-0" />}
                      <span className={`text-[13px] truncate flex-1 text-left ${n > 0 && !on ? 'font-bold' : 'font-medium'}`}>{c.name}</span>
                      {n > 0 && !on && <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full shrink-0">{n > 99 ? '99+' : n}</span>}
                    </button>
                    {isManager && (
                      <button onClick={() => setModal({ channel: c, members: chMembers.filter((m) => m.channel_id === c.id).map((m) => m.member_id) })}
                        title="Kelola channel"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-100 md:opacity-0 md:group-hover/ch:opacity-100 p-1 text-zinc-500 hover:text-white bg-[#15171c] rounded transition-opacity">
                        <Settings2 size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {isManager && !chLoading && (
            <button onClick={() => setModal({ channel: null, members: [] })}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-1 rounded-lg text-[13px] text-zinc-500 hover:text-white hover:bg-zinc-800/40 transition-colors">
              <Plus size={14} /> Buat Channel
            </button>
          )}
        </div>

        {/* footer: aku */}
        {me && (
          <div className="h-14 border-t border-zinc-800 flex items-center gap-2.5 px-3 shrink-0 bg-[#101216]">
            <div className="relative shrink-0">
              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${mColor(me)}`}>{me.initials}</span>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-[#101216]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-zinc-200 truncate">{me.name}</p>
              <p className="text-[10px] text-zinc-500">{isManager ? 'Manager' : 'Member'}</p>
            </div>
            {voiceCh && (
              <button onClick={() => { openChannel(voiceCh); }} title="Kembali ke ruang suara"
                className="p-2 rounded-lg text-emerald-400 bg-emerald-500/10 shrink-0 animate-pulse">
                <Volume2 size={15} />
              </button>
            )}
            {notif !== 'unsupported' && (
              <button onClick={toggleNotif} title={notif === 'granted' ? 'Matikan notifikasi' : 'Aktifkan notifikasi di HP'}
                className={`p-2 rounded-lg transition-colors shrink-0 ${notif === 'granted' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}`}>
                {notif === 'granted' ? <Bell size={15} /> : <BellOff size={15} />}
              </button>
            )}
          </div>
        )}
      </aside>

      {/* ══ RUANG CHAT ══ */}
      <div className={`${mobileRoom ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0`}>
        {voiceCh && voiceCh.id === active?.id ? (
          <VoiceRoom channel={voiceCh} onLeave={() => setVoiceCh(null)} />
        ) : active?.is_voice ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
              <Volume2 size={28} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{active.name}</p>
              <p className="text-xs text-zinc-500 mt-1">Channel suara · {active.description || 'Ngobrol langsung dengan tim'}</p>
            </div>
            <button onClick={() => setVoiceCh(active)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] active:scale-95">
              <Volume2 size={16} /> Gabung Suara
            </button>
            <p className="text-[10px] text-zinc-600 max-w-xs">Mikrofon akan aktif saat bergabung. Kamera & berbagi layar bisa dinyalakan lewat kontrol di bawah.</p>
          </div>
        ) : active ? (
          <ChatRoom channel={active} onBack={() => setMobileRoom(false)} recipients={membersOfActive.filter((id: string) => id !== currentUserId)} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-zinc-600">{channels.length === 0 ? 'Belum ada channel.' : 'Pilih channel di sebelah kiri.'}</p>
          </div>
        )}
      </div>

      {/* ══ DAFTAR ANGGOTA ══ */}
      <aside className="hidden xl:flex w-56 shrink-0 flex-col bg-[#15171c] border-l border-zinc-800/80">
        <div className="h-12 border-b border-zinc-800 flex items-center gap-2 px-4 shrink-0">
          <Users size={14} className="text-zinc-500" />
          <span className="text-[11px] font-black text-zinc-400 uppercase tracking-wider">Anggota</span>
        </div>
        <div className="flex-1 overflow-y-auto py-3 px-2">
          {['online', 'offline'].map((grp) => {
            const list = teamMembers.filter((m: any) => {
              const isOn = online.includes(m.id);
              const inCh = membersOfActive.includes(m.id);
              return inCh && (grp === 'online' ? isOn : !isOn);
            });
            if (!list.length) return null;
            return (
              <div key={grp} className="mb-3">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-wider px-2 mb-1.5">
                  {grp === 'online' ? `Online — ${list.length}` : `Offline — ${list.length}`}
                </p>
                {list.map((m: any) => (
                  <div key={m.id} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg ${grp === 'offline' ? 'opacity-40' : ''}`}>
                    <div className="relative shrink-0">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${mColor(m)}`}>{m.initials}</span>
                      {grp === 'online' && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-[#15171c]" />}
                    </div>
                    <span className="text-xs text-zinc-300 truncate">{m.name}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </aside>

      {modal && (
        <ChannelModal
          channel={modal.channel} members={modal.members}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); refresh(); }}
        />
      )}

      <ItemDetailPanel />
    </div>
  );
}
