'use client';
// Setoran Daily — ruang khusus di dalam Chat.
// Tiap anggota mengirim tangkapan layar sebagai bukti laporan harian.
// Setoran otomatis hilang setelah 30 hari, berikut berkasnya di storage.

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Camera, ChevronLeft, X, Search, Check, Trash2, Users, Plus, Paperclip, Send, Lock } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import Avatar from '@/components/Avatar';
import LoadingLogo from '@/components/LoadingLogo';
import {
  loadSetoranMembers, addSetoranMember, removeSetoranMember,
  loadSetoranPosts, uploadSetoran, deleteSetoran, purgeSetoranKedaluwarsa,
  tandaiSetoranDilihat, tandaiSetoranDicek, SETORAN_HARI,
} from '@/lib/tracker/setoran';
import { namaPendek } from '@/lib/tracker/nama';

const mColor = (m: any) => (m?.color && String(m.color).startsWith('bg-') ? m.color : 'bg-[#579bfc]');
const hariISO = (d: any) => new Date(d).toISOString().slice(0, 10);
const tglPendek = (d: any) =>
  new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const jam = (d: any) =>
  new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

/* ══════ Modal kelola anggota (manajer) ══════ */
function AnggotaModal({ anggotaIds, onClose, onChanged }: any) {
  const { supabase, teamMembers, currentUserId, pushToast }: any = useDashboard();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const daftar = (teamMembers || []).filter((m: any) =>
    String(m.name || '').toLowerCase().includes(q.toLowerCase()));

  const toggle = async (m: any) => {
    const ada = anggotaIds.includes(m.id);
    setBusy(m.id);
    try {
      if (ada) { await removeSetoranMember(supabase, m.id); pushToast(`${m.name} dikeluarkan`); }
      else { await addSetoranMember(supabase, m.id, currentUserId); pushToast(`${m.name} ditambahkan`); }
      await onChanged();
    } catch (e: any) { pushToast('Gagal: ' + (e?.message || e)); }
    setBusy(null);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[120]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md bg-[#2a2c38] border border-zinc-700 rounded-2xl shadow-2xl z-[130] p-5 max-h-[86vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white">Kelola Anggota Setoran</h3>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
        </div>

        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 mb-2">
          <Search size={12} className="text-zinc-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…"
            className="bg-transparent text-[11px] text-white outline-none w-full" />
        </div>

        <p className="text-[10px] text-zinc-500 mb-2">
          Anggota terpilih: <span className="text-zinc-300 font-semibold">{anggotaIds.length}</span> orang.
          Hanya mereka yang bisa mengirim setoran.
        </p>

        <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col gap-0.5 min-h-0">
          {daftar.map((m: any) => {
            const on = anggotaIds.includes(m.id);
            return (
              <button key={m.id} onClick={() => toggle(m)} disabled={busy === m.id}
                className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors disabled:opacity-50 ${on ? 'bg-[#124bce]/10' : 'hover:bg-zinc-700/50'}`}>
                <Avatar url={m.avatarUrl} name={m.name} initials={m.initials}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white ${mColor(m)}`} />
                <span className={`text-[11px] flex-1 truncate ${on ? 'text-white font-semibold' : 'text-zinc-400'}`} title={m.name}>{namaPendek(m)}</span>
                {on ? <Check size={13} className="text-blue-400" /> : <Plus size={13} className="text-zinc-600" />}
              </button>
            );
          })}
          {daftar.length === 0 && <p className="text-[11px] text-zinc-600 text-center py-6">Tidak ada nama yang cocok.</p>}
        </div>
      </div>
    </>
  );
}

/* ══════════════ RUANG SETORAN ══════════════ */
export default function SetoranRoom({ onBack }: { onBack?: () => void }) {
  const { supabase, currentUserId, currentUserRole, teamMembers, pushToast, isLoaded }: any = useDashboard();
  const isManager = currentUserRole === 'manager';

  const [anggota, setAnggota] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buka, setBuka] = useState<string | null>(null);   // user_id yang galerinya dibuka
  const [kelola, setKelola] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<File[]>([]);             // berkas siap kirim (boleh lebih dari satu)
  const [pendingUrls, setPendingUrls] = useState<string[]>([]);   // pratinjau tiap berkas
  const [caption, setCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const anggotaIds = useMemo(() => anggota.map((a) => a.user_id), [anggota]);
  const sayaAnggota = anggotaIds.includes(currentUserId);
  const hariIni = hariISO(Date.now());

  const refresh = useCallback(async () => {
    if (!supabase) return;
    try {
      const [a, p] = await Promise.all([loadSetoranMembers(supabase), loadSetoranPosts(supabase)]);
      setAnggota(a); setPosts(p);
    } catch (e: any) {
      pushToast('Gagal memuat setoran: ' + (e?.message || e));
    }
    setLoading(false);
  }, [supabase, pushToast]);

  useEffect(() => { if (isLoaded) refresh(); }, [isLoaded, refresh]);

  // Lepaskan pratinjau lokal agar tidak membebani memori.
  // Simpan URL pratinjau di ref agar bisa dibersihkan saat komponen ditutup.
  const ujungRef = useRef<HTMLDivElement>(null);   // penanda dasar daftar
  const urlRef = useRef<string[]>([]);
  useEffect(() => { urlRef.current = pendingUrls; }, [pendingUrls]);
  useEffect(() => () => { urlRef.current.forEach((u) => URL.revokeObjectURL(u)); }, []);

  // Bersihkan setoran kedaluwarsa (berikut berkasnya) saat manajer membuka ruang ini.
  useEffect(() => {
    if (!isLoaded || !isManager || !supabase) return;
    (async () => {
      try {
        const n = await purgeSetoranKedaluwarsa(supabase);
        if (n > 0) { pushToast(`${n} setoran lewat ${SETORAN_HARI} hari dibersihkan`); refresh(); }
      } catch { /* diamkan — bukan kegagalan yang mengganggu */ }
    })();
  }, [isLoaded, isManager, supabase, pushToast, refresh]);

  // Tandai sudah dilihat, supaya lencana di sidebar ikut bersih.
  useEffect(() => {
    if (!isLoaded || !currentUserId) return;
    tandaiSetoranDilihat();
    try { window.dispatchEvent(new CustomEvent('setoran-dilihat')); } catch { /* abaikan */ }
  }, [isLoaded, currentUserId, posts]);

  const postsOf = useCallback(
    (uid: string) => posts.filter((p) => p.user_id === uid),
    [posts]);

  // Menerima banyak berkas sekaligus — dari tombol lampir maupun tempel.
  const tambahBerkas = (masuk: FileList | File[]) => {
    const daftar = Array.from(masuk);
    const lolos: File[] = [];
    for (const f of daftar) {
      if (!f.type.startsWith('image/')) { pushToast(`${f.name} bukan gambar, dilewati.`); continue; }
      if (f.size > 8 * 1024 * 1024) { pushToast(`${f.name} lebih dari 8 MB, dilewati.`); continue; }
      lolos.push(f);
    }
    if (!lolos.length) return;
    setPending((p) => [...p, ...lolos]);
    setPendingUrls((u) => [...u, ...lolos.map((f) => URL.createObjectURL(f))]);
  };

  const hapusSatu = (i: number) => {
    setPendingUrls((u) => { if (u[i]) URL.revokeObjectURL(u[i]); return u.filter((_, x) => x !== i); });
    setPending((p) => p.filter((_, x) => x !== i));
  };

  const batalPending = () => {
    pendingUrls.forEach((u) => URL.revokeObjectURL(u));
    setPending([]); setPendingUrls([]); setCaption('');
  };

  // Tempel tangkapan layar dari papan klip (Ctrl+V / ⌘V).
  // Dipasang di window, bukan di elemen: peristiwa tempel hanya terjadi
  // pada elemen yang sedang difokus, dan <div> tidak bisa difokus — kalau
  // dipasang di sana, menempel baru bekerja setelah kolom teks diklik.
  const tempelRef = useRef<(e: ClipboardEvent) => void>(() => {});
  tempelRef.current = (e: ClipboardEvent) => {
    if (!sayaAnggota || uploading) return;
    const berkas: File[] = [];
    for (const item of Array.from(e.clipboardData?.items || [])) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) {
          // Tangkapan layar dari papan klip sering tanpa nama — beri nama sendiri.
          berkas.push(f.name && f.name !== 'image.png' ? f
            : new File([f], `tangkapan-${Date.now()}.png`, { type: f.type }));
        }
      }
    }
    if (berkas.length) { e.preventDefault(); tambahBerkas(berkas); }
  };

  useEffect(() => {
    const dengar = (e: ClipboardEvent) => tempelRef.current(e);
    window.addEventListener('paste', dengar);
    return () => window.removeEventListener('paste', dengar);
  }, []);

  const kirim = async () => {
    if (uploading) return;
    const adaTeks = !!caption.trim();
    if (!pending.length && !adaTeks) return;
    setUploading(true);
    try {
      const hasil: any[] = [];
      if (!pending.length) {
        // Catatan QC tanpa gambar.
        hasil.push(await uploadSetoran(supabase, null, currentUserId, caption));
      } else {
        // Keterangan menempel pada berkas pertama saja agar tidak terulang.
        for (let i = 0; i < pending.length; i++) {
          hasil.push(await uploadSetoran(supabase, pending[i], currentUserId, i === 0 ? caption : ''));
        }
      }
      batalPending();
      // Sisipkan langsung ke daftar, bukan memuat ulang semuanya — kalau
      // seluruh daftar diambil ulang, layarnya berkedip seperti menyegarkan.
      const baru = hasil.filter(Boolean);
      if (baru.length) setPosts((lama) => [...baru, ...lama]);
      else await refresh();
    } catch (e: any) { pushToast('Gagal mengirim: ' + (e?.message || e)); }
    setUploading(false);
  };

  const tambahSaya = async () => {
    try {
      await addSetoranMember(supabase, currentUserId, currentUserId);
      pushToast('Kamu ditambahkan sebagai anggota setoran');
      await refresh();
    } catch (e: any) { pushToast('Gagal: ' + (e?.message || e)); }
  };

  // Manager membuka aliran seseorang → setoran orang itu ditandai sudah dicek,
  // sehingga lencana birunya hilang untuk semua manager, bukan cuma di perangkat ini.
  const bukaOrang = async (uid: string) => {
    setBuka(uid);
    if (!isManager) return;
    const adaYangBelum = posts.some((p) => p.user_id === uid && !p.dilihat_pada);
    if (!adaYangBelum) return;
    const stempel = new Date().toISOString();
    setPosts((lama) => lama.map((p) =>
      (p.user_id === uid && !p.dilihat_pada ? { ...p, dilihat_pada: stempel } : p)));
    try { await tandaiSetoranDicek(supabase, uid); }
    catch { /* gagal menandai tak boleh mengganggu tampilan */ }
  };

  const hapus = async (p: any) => {
    try { await deleteSetoran(supabase, p); pushToast('Setoran dihapus'); await refresh(); }
    catch (e: any) { pushToast('Gagal hapus: ' + (e?.message || e)); }
  };

  const barisAnggota = useMemo(() => {
    return anggotaIds.map((uid) => {
      const m = (teamMembers || []).find((x: any) => x.id === uid);
      const mine = postsOf(uid);
      return {
        uid,
        nama: namaPendek(m) || 'Tanpa nama',
        namaPenuh: m?.name || 'Tanpa nama',
        avatarUrl: m?.avatarUrl,
        initials: m?.initials,
        color: mColor(m),
        jumlah: mine.length,
        belum: mine.filter((p) => !p.dilihat_pada).length,   // yang belum dicek manager
        terakhir: mine[0] || null,
        sudahHariIni: mine.some((p) => hariISO(p.created_at) === hariIni),
      };
    }).sort((a, b) => Number(b.sudahHariIni) - Number(a.sudahHariIni) || a.nama.localeCompare(b.nama));
  }, [anggotaIds, teamMembers, postsOf, hariIni]);

  const sudah = barisAnggota.filter((b) => b.sudahHariIni).length;
  const dibuka = buka ? barisAnggota.find((b) => b.uid === buka) : null;
  // Turun ke pesan terbaru saat membuka orang atau saat ada kiriman baru.
  useEffect(() => {
    if (!dibuka) return;
    ujungRef.current?.scrollIntoView({ block: 'end' });
  }, [dibuka, posts.length]);


  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-[#1e2029]">

      {/* ══ Kepala ══ */}
      <div className="h-12 border-b border-zinc-800 flex items-center gap-2 px-3 shrink-0 bg-[#1e2029]">
        {onBack && (
          <button onClick={onBack} className="md:hidden p-1.5 text-zinc-400 hover:text-white shrink-0">
            <ChevronLeft size={18} />
          </button>
        )}
        <Camera size={15} className="text-amber-400 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-white truncate">Setoran Daily</p>
          <p className="text-[10px] text-zinc-500 truncate">
            {anggotaIds.length} anggota · {sudah} sudah setor hari ini
          </p>
        </div>
        {isManager && (
          <button onClick={() => setKelola(true)} title="Kelola anggota"
            className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg transition-colors shrink-0">
            <Users size={13} /> <span className="hidden sm:inline">Anggota</span>
          </button>
        )}
      </div>

      {/* ══ Isi ══ */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center"><LoadingLogo size={44} text="Memuat setoran" /></div>
      ) : anggotaIds.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Camera size={26} className="text-amber-400" />
          </div>
          <p className="text-sm font-bold text-white">Belum ada anggota setoran</p>
          <p className="text-xs text-zinc-500 max-w-xs">
            {isManager
              ? 'Tambahkan anggota lewat tombol Anggota di kanan atas. Hanya mereka yang bisa mengirim setoran.'
              : 'Hubungi manajer untuk didaftarkan sebagai anggota setoran.'}
          </p>
          {isManager && (
            <button onClick={() => setKelola(true)}
              className="mt-1 flex items-center gap-2 bg-[#124bce] hover:bg-blue-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all">
              <Plus size={14} /> Tambah Anggota
            </button>
          )}
        </div>
      ) : dibuka ? (
        /* ── Galeri satu orang ── */
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="sticky top-0 z-10 flex items-center gap-2.5 px-4 py-3 bg-[#1e2029] border-b border-zinc-800">
            <button onClick={() => setBuka(null)} className="p-1 text-zinc-400 hover:text-white shrink-0">
              <ChevronLeft size={18} />
            </button>
            <Avatar url={dibuka.avatarUrl} name={dibuka.nama} initials={dibuka.initials}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${dibuka.color}`} />
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white truncate" title={dibuka.namaPenuh}>{dibuka.nama}</p>
              <p className="text-[10px] text-zinc-500">{dibuka.jumlah} setoran dalam {SETORAN_HARI} hari</p>
            </div>
          </div>

          {dibuka.jumlah === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-16">Belum ada setoran.</p>
          ) : (
            /* Alur percakapan — terlama di atas, terbaru di bawah, seperti chat biasa. */
            <div className="flex flex-col gap-3 p-4">
              {[...postsOf(dibuka.uid)].reverse().map((p) => {
                const bolehHapus = p.user_id === currentUserId || isManager;
                const punyaSaya = p.user_id === currentUserId;
                return (
                  <div key={p.id} className={`group flex flex-col gap-1 max-w-[85%] ${punyaSaya ? 'self-end items-end' : 'self-start items-start'}`}>
                    <div className={`rounded-2xl overflow-hidden border ${punyaSaya ? 'border-[#124bce]/40 bg-[#124bce]/10' : 'border-zinc-800 bg-[#15171c]'}`}>
                      {p.image_url && (
                        <button onClick={() => setLightbox(p.image_url)} className="block">
                          <img src={p.image_url} alt={`Setoran ${tglPendek(p.created_at)}`} loading="lazy"
                            className="max-h-72 w-auto object-cover" />
                        </button>
                      )}
                      {p.caption && (
                        <p className="text-[12px] text-zinc-200 leading-relaxed whitespace-pre-wrap break-words px-3 py-2">
                          {p.caption}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-[9px] text-zinc-600">{tglPendek(p.created_at)} · {jam(p.created_at)}</span>
                      {bolehHapus && (
                        <button onClick={() => hapus(p)} title="Hapus"
                          className="text-zinc-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={ujungRef} />
            </div>
          )}
        </div>
      ) : (
        /* ── Daftar anggota ── */
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <p className="text-[10px] text-zinc-600 px-4 pt-3 pb-2">
            Setoran otomatis terhapus setelah {SETORAN_HARI} hari, berikut berkasnya.
          </p>

          {barisAnggota.map((b) => (
            <button key={b.uid} onClick={() => bukaOrang(b.uid)}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-zinc-800/70 hover:bg-zinc-800/40 transition-colors text-left">
              <Avatar url={b.avatarUrl} name={b.nama} initials={b.initials}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 ${b.color}`} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-semibold text-white truncate">{b.nama}</p>
                  {b.uid === currentUserId && <span className="text-[9px] text-zinc-500 shrink-0">(kamu)</span>}
                </div>
                <p className={`text-[11px] truncate ${b.sudahHariIni ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {b.sudahHariIni
                    ? `Sudah setor hari ini · ${jam(b.terakhir.created_at)}`
                    : b.terakhir ? `Terakhir ${tglPendek(b.terakhir.created_at)}` : 'Belum pernah setor'}
                </p>
              </div>

              {b.terakhir?.image_url && (
                <img src={b.terakhir.image_url} alt="" loading="lazy"
                  className="w-9 h-9 rounded-lg object-cover border border-zinc-700 shrink-0" />
              )}
              {b.belum > 0 && (
                <span className="text-[10px] font-bold bg-[#124bce] text-white min-w-[22px] text-center px-1.5 py-0.5 rounded-full shrink-0"
                  title={`${b.belum} setoran belum dicek`}>
                  {b.belum}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ══ Kolom kirim ══ */}
      <div className="border-t border-zinc-800 px-3 py-2.5 shrink-0 bg-[#1e2029]">
        {!sayaAnggota ? (
          <div className="flex items-center gap-2 px-1 py-1.5">
            <Lock size={13} className="text-zinc-600 shrink-0" />
            <span className="text-[11px] text-zinc-500 flex-1">
              Kamu belum terdaftar sebagai anggota setoran.
            </span>
            {isManager && (
              <button onClick={tambahSaya}
                className="text-[11px] font-bold text-white bg-[#124bce] hover:bg-blue-600 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                Tambahkan saya
              </button>
            )}
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <div className="flex items-center gap-2 mb-2 bg-[#15171c] border border-zinc-800 rounded-xl p-2 overflow-x-auto">
                {pending.map((f, i) => (
                  <div key={`${f.name}-${i}`} className="relative shrink-0">
                    <img src={pendingUrls[i] || ''} alt={f.name}
                      className="w-11 h-11 rounded-lg object-cover border border-zinc-700" />
                    <button onClick={() => hapusSatu(i)} title="Buang"
                      className="absolute -top-1.5 -right-1.5 bg-zinc-900 border border-zinc-700 rounded-full p-0.5 text-zinc-400 hover:text-red-400 transition-colors">
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <span className="text-[10px] text-zinc-500 px-1 shrink-0">{pending.length} berkas</span>
                <button onClick={batalPending} title="Batalkan semua"
                  className="ml-auto p-1 text-zinc-500 hover:text-white shrink-0"><X size={14} /></button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input ref={fileRef} type="file" accept="image/*" multiple hidden
                onChange={(e) => { const f = e.target.files; if (f?.length) tambahBerkas(f); e.currentTarget.value = ''; }} />

              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                title="Pilih tangkapan layar (bisa lebih dari satu)"
                className="p-2.5 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors shrink-0 disabled:opacity-50">
                <Paperclip size={16} />
              </button>

              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!uploading) kirim(); } }}
                placeholder="Tulis pesan…"
                className="flex-1 min-w-0 bg-[#15171c] border border-zinc-700 focus:border-[#124bce]/60 rounded-xl px-3 py-2.5 text-xs text-zinc-100 outline-none transition-colors" />

              <button onClick={kirim} disabled={uploading || (!pending.length && !caption.trim())}
                title="Kirim"
                className="flex items-center gap-1.5 bg-[#124bce] hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shrink-0">
                <Send size={14} /> {uploading ? 'Mengirim…' : 'Kirim'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ══ Pratinjau gambar ══ */}
      {lightbox && (
        <>
          <div className="fixed inset-0 bg-black/85 z-[140]" onClick={() => setLightbox(null)} />
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 pointer-events-none">
            <img src={lightbox} alt="Setoran" className="max-w-full max-h-full rounded-xl object-contain pointer-events-auto" />
          </div>
          <button onClick={() => setLightbox(null)}
            className="fixed top-4 right-4 z-[160] p-2 bg-zinc-900/90 text-white rounded-lg hover:bg-zinc-800">
            <X size={18} />
          </button>
        </>
      )}

      {kelola && (
        <AnggotaModal
          anggotaIds={anggotaIds}
          onClose={() => setKelola(false)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
