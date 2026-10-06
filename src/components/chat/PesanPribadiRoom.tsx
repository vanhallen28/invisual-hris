'use client';
// Pesan Pribadi — obrolan 1-lawan-1 antara HR/manager dan karyawan.
// Karyawan hanya bisa memulai obrolan dengan HR atau manager (dijaga database).
// Terpisah total dari channel chat: tabel, realtime, dan lampirannya sendiri.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, Plus, Search, Send, Paperclip, Trash2, X, FileText, Lock, MessageCircle, Check, CheckCheck } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import Avatar from '@/components/Avatar';
import LoadingLogo from '@/components/LoadingLogo';
import { useToast } from '@/components/Toast';
import { pushNotify } from '@/lib/push';
import { namaPendek } from '@/lib/tracker/nama';
import {
  type Kontak, type Utas, type Pesan, type Peran,
  muatKontak, muatUtas, bukaUtas, muatPesan, kirimPesan, hapusPesan, tandaiDibaca, belumDibaca,
  unggahLampiran, urlLampiran, lawanDari, dibacaLawan, belumDipasang, ukuranTeks, totalBelum,
  EVENT_BELUM_DIBACA, MAKS_LAMPIRAN_MB, lampiranBisaDikompres,
} from '@/lib/pesanPribadi';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const pad = (n: number) => String(n).padStart(2, '0');
const kunciHari = (t: string) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
const jam = (t: string) => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
function labelHari(t: string) {
  const d = new Date(t), k = new Date();
  const kemarin = new Date(k.getFullYear(), k.getMonth(), k.getDate() - 1);
  if (kunciHari(t) === kunciHari(k.toISOString())) return 'Hari ini';
  if (kunciHari(t) === kunciHari(kemarin.toISOString())) return 'Kemarin';
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}
function waktuDaftar(t: string | null) {
  if (!t) return '';
  const d = new Date(t);
  return kunciHari(t) === kunciHari(new Date().toISOString()) ? jam(t) : `${d.getDate()} ${BULAN[d.getMonth()]}`;
}
const mColor = (m: any) => (m?.color && String(m.color).startsWith('bg-') ? m.color : 'bg-primer-terang');
const t0 = (s: string | null | undefined) => (s ? new Date(s).getTime() : 0);
/** Gabung dua daftar pesan tanpa duplikat, urut lama → baru. */
const gabungPesan = (a: Pesan[], b: Pesan[]) => {
  const peta = new Map<string, Pesan>();
  [...a, ...b].forEach((p) => peta.set(p.id, p));
  return Array.from(peta.values()).sort((x, y) => t0(x.dibuat_pada) - t0(y.dibuat_pada));
};

function ChipPeran({ peran }: { peran?: Peran }) {
  if (!peran || peran === 'Karyawan') return null;
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 ${peran === 'HR' ? 'bg-magenta/10 text-pink-300 border-magenta/30' : 'bg-primer/15 text-tint-redup border-primer/30'}`}>{peran}</span>
  );
}

export default function PesanPribadiRoom({ onBack, utasAwal }: { onBack: () => void; utasAwal?: string | null }) {
  const { supabase, currentUserId, teamMembers }: any = useDashboard();
  const toast = useToast();
  const saya: string = currentUserId;

  const [kontak, setKontak] = useState<Kontak[]>([]);
  const [utas, setUtas] = useState<Utas[]>([]);
  const [belum, setBelum] = useState<Record<string, number>>({});
  const [memuat, setMemuat] = useState(true);
  const [belumSiap, setBelumSiap] = useState(false);
  const [galat, setGalat] = useState('');
  const [aktif, setAktif] = useState<string | null>(null);
  const [lihatObrolan, setLihatObrolan] = useState(false); // ponsel: daftar ↔ obrolan
  const [pesan, setPesan] = useState<Pesan[]>([]);
  const [memuatPesan, setMemuatPesan] = useState(false);
  const [adaLebihLama, setAdaLebihLama] = useState(false);
  const [urlLamp, setUrlLamp] = useState<Record<string, string>>({});
  const [teks, setTeks] = useState('');
  const [mengunggah, setMengunggah] = useState(false);
  const [cari, setCari] = useState('');
  const [pemilih, setPemilih] = useState(false);
  const [cariKontak, setCariKontak] = useState('');
  const [besar, setBesar] = useState<string | null>(null);

  const gulirRef = useRef<HTMLDivElement>(null);
  const berkasRef = useRef<HTMLInputElement>(null);
  const aktifRef = useRef<string | null>(null);
  useEffect(() => { aktifRef.current = aktif; }, [aktif]);
  const idUtasRef = useRef<Set<string>>(new Set());
  useEffect(() => { idUtasRef.current = new Set(utas.map((u) => u.id)); }, [utas]);
  const nomorMuat = useRef(0);
  const awalDipakai = useRef(false);

  const kontakPeta = useMemo(() => { const m: Record<string, Kontak> = {}; kontak.forEach((k) => { m[k.id] = k; }); return m; }, [kontak]);
  const anggotaPeta = useMemo(() => { const m: Record<string, any> = {}; (teamMembers || []).forEach((x: any) => { m[x.id] = x; }); return m; }, [teamMembers]);
  const namaOrang = useCallback((id: string) => {
    const a = anggotaPeta[id];
    return (a && namaPendek(a)) || kontakPeta[id]?.nama || 'Pengguna';
  }, [anggotaPeta, kontakPeta]);

  // Lencana sidebar: laporkan total belum dibaca
  useEffect(() => {
    try { window.dispatchEvent(new CustomEvent(EVENT_BELUM_DIBACA, { detail: totalBelum(belum) })); } catch { /* diamkan */ }
  }, [belum]);

  const keBawah = (halus = false) => requestAnimationFrame(() => {
    const el = gulirRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: halus ? 'smooth' : 'auto' });
  });

  const muatSemua = useCallback(async () => {
    if (!supabase || !saya) return;
    setMemuat(true); setGalat('');
    try {
      const [k, u, b] = await Promise.all([muatKontak(supabase), muatUtas(supabase), belumDibaca(supabase)]);
      setKontak(k); setUtas(u); setBelum(b || {}); setBelumSiap(false);
    } catch (e: any) {
      if (belumDipasang(e)) setBelumSiap(true);
      else setGalat(e?.message || 'Gagal memuat pesan pribadi.');
    }
    setMemuat(false);
  }, [supabase, saya]);

  useEffect(() => { muatSemua(); }, [muatSemua]);

  // Tautan langsung (?pesan=<id utas>) dari notifikasi
  useEffect(() => {
    if (awalDipakai.current || memuat || !utasAwal) return;
    if (utas.some((u) => u.id === utasAwal)) { awalDipakai.current = true; setAktif(utasAwal); setLihatObrolan(true); }
  }, [utasAwal, utas, memuat]);

  // Buka utas → muat pesan + tandai dibaca
  useEffect(() => {
    if (!aktif || !supabase) return;
    const nomor = ++nomorMuat.current;
    setPesan([]); setMemuatPesan(true); setAdaLebihLama(false);
    (async () => {
      try {
        const rows = await muatPesan(supabase, aktif);
        if (nomor !== nomorMuat.current) return;
        setPesan((x) => gabungPesan(x, rows));   // jangan timpa pesan realtime yang tiba saat memuat
        setAdaLebihLama(rows.length >= 50);
        const u = await urlLampiran(supabase, rows.map((r) => r.lampiran?.path || '').filter(Boolean));
        if (nomor !== nomorMuat.current) return;
        setUrlLamp((x) => ({ ...x, ...u }));
        keBawah();
      } catch (e: any) {
        if (nomor === nomorMuat.current) toast.gagal('Gagal memuat percakapan: ' + (e?.message || e));
      }
      if (nomor === nomorMuat.current) setMemuatPesan(false);
    })();
    tandaiDibaca(supabase, aktif);
    setBelum((b) => (b[aktif] ? { ...b, [aktif]: 0 } : b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aktif, supabase]);

  // Realtime — satu langganan selama ruang terbuka
  useEffect(() => {
    if (!supabase || !saya || belumSiap || memuat) return;
    const ch = supabase
      .channel('pesan-pribadi-ruang')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pesan_pribadi' }, async (p: any) => {
        const m = p.new as Pesan;
        if (!m?.id) return;
        if (aktifRef.current === m.utas_id) {
          setPesan((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
          if (m.lampiran?.path) { const u = await urlLampiran(supabase, [m.lampiran.path]); setUrlLamp((x) => ({ ...x, ...u })); }
          if (m.pengirim !== saya) tandaiDibaca(supabase, m.utas_id);
          keBawah(true);
        } else if (m.pengirim !== saya) {
          setBelum((b) => ({ ...b, [m.utas_id]: (b[m.utas_id] || 0) + 1 }));
        }
        if (!idUtasRef.current.has(m.utas_id)) {
          // Utas baru (lawan baru memulai percakapan) → muat ulang daftar
          muatUtas(supabase).then(setUtas).catch(() => {});
          muatKontak(supabase).then(setKontak).catch(() => {});
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pesan_pribadi' }, (p: any) => {
        const id = p.old?.id;
        if (id) setPesan((x) => x.filter((y) => y.id !== id));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pesan_pribadi_utas' }, (p: any) => {
        const n = p.new as Utas;
        if (!n?.id) return;
        setUtas((daftar) => (daftar.some((u) => u.id === n.id) ? daftar.map((u) => (u.id === n.id ? { ...u, ...n } : u)) : [n, ...daftar]));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pesan_pribadi_utas' }, () => {
        muatUtas(supabase).then(setUtas).catch(() => {});
        muatKontak(supabase).then(setKontak).catch(() => {});
      })
      .subscribe((st: string) => {
        // (Ter)sambung → sinkronkan lagi agar pesan selama koneksi putus tidak terlewat
        if (st !== 'SUBSCRIBED') return;
        muatUtas(supabase).then(setUtas).catch(() => {});
        belumDibaca(supabase).then((b) => { if (b) setBelum({ ...b, ...(aktifRef.current ? { [aktifRef.current]: 0 } : {}) }); });
        const id = aktifRef.current;
        if (id) muatPesan(supabase, id).then((rows) => { if (aktifRef.current === id) setPesan((x) => gabungPesan(x, rows)); }).catch(() => {});
      });
    return () => { supabase.removeChannel(ch); };
  }, [supabase, saya, belumSiap, memuat]);

  // Escape: tutup pemilih kontak / pratinjau gambar
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (besar) setBesar(null); else if (pemilih) setPemilih(false); };
    window.addEventListener('keydown', t);
    return () => window.removeEventListener('keydown', t);
  }, [besar, pemilih]);

  const utasUrut = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return utas
      .filter((u) => u.terakhir_pada || u.id === aktif)   // utas kosong yang tak dibuka tidak ditampilkan
      .filter((u) => !q || namaOrang(lawanDari(u, saya)).toLowerCase().includes(q))
      .sort((a, b) => t0(b.terakhir_pada || b.dibuat_pada) - t0(a.terakhir_pada || a.dibuat_pada));
  }, [utas, cari, aktif, namaOrang, saya]);

  const utasAktif = utas.find((u) => u.id === aktif) || null;
  const lawan = utasAktif ? lawanDari(utasAktif, saya) : null;

  const mulaiDengan = async (kontakId: string) => {
    setPemilih(false); setCariKontak('');
    const ada = utas.find((u) => lawanDari(u, saya) === kontakId);
    if (ada) { setAktif(ada.id); setLihatObrolan(true); return; }
    try {
      const id = await bukaUtas(supabase, kontakId);
      const daftar = await muatUtas(supabase);
      setUtas(daftar);
      setAktif(id); setLihatObrolan(true);
    } catch (e: any) { toast.gagal('Tidak bisa memulai percakapan: ' + (e?.message || e)); }
  };

  const beritahu = (isi: string) => {
    if (!lawan || !aktif) return;
    const peranLawan = kontakPeta[lawan]?.peran;
    const aku = anggotaPeta[saya];
    pushNotify(supabase, {
      memberIds: [lawan],
      title: `Pesan pribadi • ${(aku && namaPendek(aku)) || 'Pesan baru'}`,
      body: isi,
      url: `${peranLawan === 'HR' ? '/admin/chat' : '/user/chat'}?pesan=${aktif}`,
      tag: `pp-${aktif}`,
    });
  };

  const pesanGalatKirim = (e: any) => {
    const m = String(e?.message || e || '');
    return m.includes('row-level security') ? 'Anda tidak bisa lagi mengirim pesan di percakapan ini (lawan bicara bukan HR/manager).' : m;
  };

  const kirim = async () => {
    const isi = teks.trim();
    if (!isi || !aktif) return;
    setTeks('');
    try {
      const row = await kirimPesan(supabase, aktif, isi);
      setPesan((x) => (x.some((y) => y.id === row.id) ? x : [...x, row]));
      keBawah(true);
      beritahu(isi.slice(0, 140));
    } catch (e: any) { setTeks(isi); toast.gagal('Gagal mengirim: ' + pesanGalatKirim(e)); }
  };

  const unggah = async (file: File) => {
    if (!file || !aktif) return;
    // Gambar/video yang bisa dikompres boleh lebih besar; ukuran akhirnya dicek lagi setelah dikompres.
    if (file.size > MAKS_LAMPIRAN_MB * 1024 * 1024 && !lampiranBisaDikompres(file)) { toast.gagal(`Ukuran berkas maksimal ${MAKS_LAMPIRAN_MB} MB.`); return; }
    setMengunggah(true);
    try {
      const lamp = await unggahLampiran(supabase, aktif, file);
      const row = await kirimPesan(supabase, aktif, '', lamp);
      const u = await urlLampiran(supabase, [lamp.path]);
      setUrlLamp((x) => ({ ...x, ...u }));
      setPesan((x) => (x.some((y) => y.id === row.id) ? x : [...x, row]));
      keBawah(true);
      beritahu((file.type || '').startsWith('image/') ? 'Mengirim gambar 🖼️' : `Mengirim berkas: ${file.name}`);
    } catch (e: any) { toast.gagal('Gagal mengirim lampiran: ' + pesanGalatKirim(e)); }
    setMengunggah(false);
  };

  const hapus = async (p: Pesan) => {
    const ya = await toast.konfirmasi('Hapus pesan ini? Pesan juga hilang dari lawan bicara.', { labelYa: 'Hapus' });
    if (!ya) return;
    try { await hapusPesan(supabase, p); setPesan((x) => x.filter((y) => y.id !== p.id)); }
    catch (e: any) { toast.gagal('Gagal menghapus: ' + (e?.message || e)); }
  };

  const muatLebihLama = async () => {
    if (!aktif || !pesan.length) return;
    const el = gulirRef.current;
    const tinggiAwal = el?.scrollHeight || 0;
    try {
      const rows = await muatPesan(supabase, aktif, pesan[0].dibuat_pada);
      setAdaLebihLama(rows.length >= 50);
      const u = await urlLampiran(supabase, rows.map((r) => r.lampiran?.path || '').filter(Boolean));
      setUrlLamp((x) => ({ ...x, ...u }));
      setPesan((x) => [...rows.filter((r) => !x.some((y) => y.id === r.id)), ...x]);
      requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - tinggiAwal; });
    } catch (e: any) { toast.gagal('Gagal memuat pesan lama: ' + (e?.message || e)); }
  };

  const kontakSaring = useMemo(() => {
    const q = cariKontak.trim().toLowerCase();
    const urutan: Record<string, number> = { HR: 0, Manager: 1, Karyawan: 2 };
    return kontak
      .filter((k) => !q || k.nama.toLowerCase().includes(q) || namaOrang(k.id).toLowerCase().includes(q))
      .sort((a, b) => (urutan[a.peran] - urutan[b.peran]) || namaOrang(a.id).localeCompare(namaOrang(b.id)));
  }, [kontak, cariKontak, namaOrang]);

  const sayaStaf = kontak.some((k) => k.peran === 'Karyawan') || anggotaPeta[saya]?.role === 'manager';
  const avatar = (id: string, ukuran = 'w-9 h-9 text-[11px]') => {
    const a = anggotaPeta[id];
    const nama = namaOrang(id);
    return <Avatar url={a?.avatarUrl} name={nama} initials={a?.initials || nama.charAt(0).toUpperCase()} className={`${ukuran} rounded-full flex items-center justify-center font-bold text-white shrink-0 ${mColor(a)}`} />;
  };

  // Pesan terakhir saya → status Terkirim / Dibaca
  const terakhirSaya = [...pesan].reverse().find((p) => p.pengirim === saya);
  const sudahDibaca = !!(terakhirSaya && utasAktif && t0(dibacaLawan(utasAktif, saya)) >= t0(terakhirSaya.dibuat_pada));

  /* ═════════ TAMPILAN ═════════ */
  if (belumSiap || galat) {
    return (
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-kartu-hover">
        <div className="h-12 border-b border-white/10 flex items-center gap-2 px-4 shrink-0">
          <button onClick={onBack} className="md:hidden p-1 -ml-2 text-gray-400 hover:text-white"><ChevronLeft size={18} /></button>
          <MessageCircle size={16} className="text-tint" />
          <span className="text-sm font-bold text-gray-100">Pesan Pribadi</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4"><Lock size={22} className="text-gray-500" /></div>
            {belumSiap ? (
              <>
                <p className="text-sm font-bold text-white">Pesan Pribadi belum aktif</p>
                <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">Admin perlu menjalankan berkas <span className="font-mono text-gray-300">pesan-pribadi.sql</span> di Supabase SQL Editor satu kali.</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-white">Gagal memuat pesan pribadi</p>
                <p className="text-xs text-gray-500 mt-1.5 break-words">{galat}</p>
                <button onClick={muatSemua} className="mt-4 text-xs font-bold text-white bg-primer hover:bg-primer-terang px-4 py-2 rounded-lg">Coba lagi</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex min-w-0 min-h-0 bg-kartu-hover relative">
      {/* ── DAFTAR PERCAKAPAN ── */}
      <div className={`${lihatObrolan ? 'hidden' : 'flex'} md:flex w-full md:w-72 shrink-0 flex-col border-r border-white/10 bg-kartu/60 min-h-0`}>
        <div className="h-12 border-b border-white/10 flex items-center gap-2 px-3 shrink-0">
          <button onClick={onBack} className="md:hidden p-1 -ml-1 text-gray-400 hover:text-white"><ChevronLeft size={18} /></button>
          <MessageCircle size={15} className="text-tint shrink-0" />
          <span className="text-sm font-bold text-gray-100 flex-1">Pesan Pribadi</span>
          <button onClick={() => setPemilih(true)} disabled={memuat} title="Pesan baru" className="flex items-center gap-1 text-[11px] font-bold text-white bg-primer hover:bg-primer-terang px-2.5 py-1.5 rounded-lg disabled:opacity-50">
            <Plus size={13} /> Baru
          </button>
        </div>
        <div className="px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 bg-latar border border-white/10 rounded-lg px-2.5 py-1.5">
            <Search size={12} className="text-gray-500" />
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari percakapan…" className="bg-transparent text-[12px] text-white outline-none w-full" />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 pb-3">
          {memuat ? (
            <div className="min-h-[40vh] flex items-center justify-center"><LoadingLogo size={40} text="Memuat percakapan" /></div>
          ) : utasUrut.length === 0 ? (
            <div className="text-center px-4 py-10">
              <p className="text-xs text-gray-400 font-semibold">{cari ? 'Tidak ada yang cocok.' : 'Belum ada percakapan.'}</p>
              {!cari && <p className="text-[11px] text-gray-600 mt-1">{sayaStaf ? 'Mulai percakapan pribadi dengan karyawan.' : 'Anda bisa mengirim pesan pribadi ke HR atau manager.'}</p>}
              {!cari && <button onClick={() => setPemilih(true)} className="mt-3 text-[11px] font-bold text-tint hover:text-white">+ Mulai percakapan</button>}
            </div>
          ) : utasUrut.map((u) => {
            const id = lawanDari(u, saya);
            const n = belum[u.id] || 0;
            const on = aktif === u.id;
            return (
              <button key={u.id} onClick={() => { setAktif(u.id); setLihatObrolan(true); }}
                className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors ${on ? 'bg-white/[0.07]' : 'hover:bg-white/5'}`}>
                {avatar(id)}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[13px] truncate ${n > 0 && !on ? 'font-bold text-white' : 'font-semibold text-gray-200'}`}>{namaOrang(id)}</span>
                    <ChipPeran peran={kontakPeta[id]?.peran} />
                    <span className="ml-auto text-[10px] text-gray-600 shrink-0">{waktuDaftar(u.terakhir_pada)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[11px] truncate flex-1 ${n > 0 && !on ? 'text-gray-200' : 'text-gray-500'}`}>
                      {u.terakhir_oleh === saya ? 'Anda: ' : ''}{u.terakhir_isi || 'Belum ada pesan'}
                    </span>
                    {n > 0 && !on && <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full shrink-0">{n > 99 ? '99+' : n}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── OBROLAN ── */}
      <div className={`${lihatObrolan ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-w-0 min-h-0`}>
        {!utasAktif || !lawan ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4"><MessageCircle size={24} className="text-gray-600" /></div>
              <p className="text-sm text-gray-400 font-semibold">Pilih percakapan</p>
              <p className="text-xs text-gray-600 mt-1">atau mulai yang baru dengan tombol “Baru”.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="h-12 border-b border-white/10 flex items-center gap-2.5 px-4 shrink-0">
              <button onClick={() => setLihatObrolan(false)} className="md:hidden p-1 -ml-2 text-gray-400 hover:text-white"><ChevronLeft size={18} /></button>
              {avatar(lawan, 'w-7 h-7 text-[10px]')}
              <span className="text-sm font-bold text-gray-100 truncate">{namaOrang(lawan)}</span>
              <ChipPeran peran={kontakPeta[lawan]?.peran} />
              <span className="ml-auto hidden sm:flex items-center gap-1 text-[10px] text-gray-600"><Lock size={10} /> Hanya kalian berdua</span>
            </div>

            <div ref={gulirRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
              {memuatPesan ? (
                <div className="h-full min-h-[50vh] flex items-center justify-center"><LoadingLogo size={44} text="Memuat pesan" /></div>
              ) : pesan.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-sm text-gray-400 font-semibold">Mulai percakapan dengan {namaOrang(lawan)}</p>
                  <p className="text-xs text-gray-600 mt-1">Pesan ini pribadi — hanya Anda dan {namaOrang(lawan)} yang bisa membacanya.</p>
                </div>
              ) : (
                <>
                  {adaLebihLama && (
                    <div className="text-center mb-3"><button onClick={muatLebihLama} className="text-[11px] font-bold text-tint hover:text-white bg-white/5 px-3 py-1.5 rounded-lg">Muat pesan sebelumnya</button></div>
                  )}
                  {pesan.map((p, i) => {
                    const sebelum = pesan[i - 1];
                    const hariBaru = !sebelum || kunciHari(sebelum.dibuat_pada) !== kunciHari(p.dibuat_pada);
                    const milikSaya = p.pengirim === saya;
                    const lamp = p.lampiran;
                    const url = lamp?.path ? urlLamp[lamp.path] : undefined;
                    const gambar = !!lamp && String(lamp.tipe || '').startsWith('image/');
                    return (
                      <div key={p.id}>
                        {hariBaru && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">{labelHari(p.dibuat_pada)}</span>
                            <div className="flex-1 h-px bg-white/10" />
                          </div>
                        )}
                        <div className={`group flex items-end gap-1.5 mb-1.5 ${milikSaya ? 'justify-end' : 'justify-start'}`}>
                          {milikSaya && (
                            <button onClick={() => hapus(p)} title="Hapus pesan" className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-opacity shrink-0">
                              <Trash2 size={12} />
                            </button>
                          )}
                          <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${milikSaya ? 'bg-primer text-white rounded-br-md' : 'bg-kartu border border-white/10 text-gray-100 rounded-bl-md'}`}>
                            {lamp && (
                              gambar ? (
                                url ? (
                                  <button onClick={() => setBesar(url)} className="block mb-1 rounded-lg overflow-hidden" title="Perbesar">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt={lamp.nama} className="max-h-60 max-w-full object-contain" />
                                  </button>
                                ) : <p className="text-[11px] opacity-70 mb-1">🖼️ {lamp.nama}</p>
                              ) : (
                                <a href={url || undefined} target="_blank" rel="noreferrer" download={lamp.nama}
                                  className={`flex items-center gap-2 mb-1 rounded-lg px-2.5 py-2 ${milikSaya ? 'bg-white/15 hover:bg-white/25' : 'bg-white/5 hover:bg-white/10'} ${url ? '' : 'pointer-events-none opacity-60'}`}>
                                  <FileText size={16} className="shrink-0" />
                                  <span className="min-w-0">
                                    <span className="block text-[12px] font-semibold truncate">{lamp.nama}</span>
                                    <span className="block text-[10px] opacity-70">{ukuranTeks(lamp.ukuran || 0)}</span>
                                  </span>
                                </a>
                              )
                            )}
                            {p.isi && <p className="text-[13px] whitespace-pre-wrap break-words leading-relaxed">{p.isi}</p>}
                            <p className={`text-[9px] mt-0.5 text-right ${milikSaya ? 'text-white/60' : 'text-gray-600'}`}>{jam(p.dibuat_pada)}</p>
                          </div>
                        </div>
                        {terakhirSaya?.id === p.id && (
                          <p className="text-[10px] text-gray-600 text-right -mt-0.5 mb-1.5 flex items-center justify-end gap-1">
                            {sudahDibaca ? <><CheckCheck size={11} className="text-tint" /> Dibaca</> : <><Check size={11} /> Terkirim</>}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            <div className="px-4 pb-4 pt-1 shrink-0">
              <div className="flex items-end gap-2 bg-kartu border border-white/10 rounded-xl px-3 py-2">
                <input ref={berkasRef} type="file" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) unggah(f); e.currentTarget.value = ''; }} />
                <button onClick={() => berkasRef.current?.click()} disabled={mengunggah} title={`Lampirkan berkas (maks ${MAKS_LAMPIRAN_MB} MB)`} className="p-1.5 text-gray-500 hover:text-white rounded transition-colors shrink-0 disabled:opacity-40">
                  <Paperclip size={16} />
                </button>
                <textarea
                  rows={1} value={teks}
                  onChange={(e) => setTeks(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); kirim(); } }}
                  placeholder={mengunggah ? 'Mengunggah…' : `Tulis pesan untuk ${namaOrang(lawan)}`}
                  maxLength={4000}
                  className="flex-1 bg-transparent text-[13px] text-white outline-none resize-none max-h-32 py-1.5 placeholder:text-gray-600"
                />
                <button onClick={kirim} disabled={!teks.trim()} title="Kirim" className="p-1.5 text-blue-400 hover:text-blue-300 disabled:text-gray-700 rounded transition-colors shrink-0">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── PEMILIH KONTAK ── */}
      {pemilih && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[120]" onClick={() => setPemilih(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-sm bg-kartu border border-white/10 rounded-2xl shadow-2xl z-[130] p-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-bold text-white">Pesan baru</h3>
              <button onClick={() => setPemilih(false)} className="p-1 text-gray-500 hover:text-white"><X size={16} /></button>
            </div>
            <p className="text-[11px] text-gray-500 mb-3">{sayaStaf ? 'Pilih karyawan, manager, atau HR.' : 'Karyawan dapat mengirim pesan pribadi ke HR dan manager.'}</p>
            <div className="flex items-center gap-2 bg-latar border border-white/10 rounded-lg px-2.5 py-1.5 mb-2">
              <Search size={12} className="text-gray-500" />
              <input autoFocus value={cariKontak} onChange={(e) => setCariKontak(e.target.value)} placeholder="Cari nama…" className="bg-transparent text-[12px] text-white outline-none w-full" />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5">
              {kontakSaring.length === 0 ? (
                <p className="text-[11px] text-gray-600 text-center py-6">{kontak.length === 0 ? 'Belum ada kontak yang tersedia.' : 'Tidak ada yang cocok.'}</p>
              ) : kontakSaring.map((k, i) => (
                <React.Fragment key={k.id}>
                  {(i === 0 || kontakSaring[i - 1].peran !== k.peran) && (
                    <p className="text-[10px] font-black text-gray-600 uppercase tracking-wider px-2 pt-2 pb-1">{k.peran === 'HR' ? 'HR' : k.peran === 'Manager' ? 'Manager' : 'Karyawan'}</p>
                  )}
                  <button onClick={() => mulaiDengan(k.id)} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-white/5">
                    {avatar(k.id, 'w-7 h-7 text-[10px]')}
                    <span className="text-[12px] text-gray-200 flex-1 truncate" title={k.nama}>{namaOrang(k.id)}</span>
                    <ChipPeran peran={k.peran} />
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        </>
      )}

      {besar && (
        <>
          <div className="fixed inset-0 bg-black/85 z-[140]" onClick={() => setBesar(null)} />
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 pointer-events-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={besar} alt="Pratinjau" className="max-w-full max-h-full rounded-xl object-contain pointer-events-auto" />
          </div>
          <button onClick={() => setBesar(null)} title="Tutup" className="fixed top-4 right-4 z-[160] p-2 bg-kartu/90 text-white rounded-lg hover:bg-kartu-hover"><X size={18} /></button>
        </>
      )}
    </div>
  );
}

/**
 * Lencana jumlah pesan pribadi belum dibaca untuk sidebar Chat.
 * Saat ruang terbuka, angkanya dilaporkan oleh ruang itu sendiri (event);
 * saat tertutup, dihitung dari server lalu ditambah lewat realtime.
 */
export function useLencanaPesanPribadi(supabase: any, uid: string | null | undefined, terbuka: boolean): number {
  const [n, setN] = useState(0);
  const [aktif, setAktif] = useState(false); // fitur terpasang (SQL sudah dijalankan)?
  const terbukaRef = useRef(terbuka);
  useEffect(() => { terbukaRef.current = terbuka; }, [terbuka]);

  useEffect(() => {
    if (!supabase || !uid || terbuka) return;
    let hidup = true;
    belumDibaca(supabase).then((m) => { if (!hidup) return; setAktif(m !== null); setN(totalBelum(m)); });
    return () => { hidup = false; };
  }, [supabase, uid, terbuka]);

  useEffect(() => {
    if (!supabase || !uid || !aktif) return;
    const ch = supabase
      .channel('pesan-pribadi-lencana')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pesan_pribadi' }, (p: any) => {
        if (terbukaRef.current || !p.new || p.new.pengirim === uid) return;
        setN((x) => x + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [supabase, uid, aktif]);

  useEffect(() => {
    const f = (e: any) => setN(Number(e?.detail) || 0);
    window.addEventListener(EVENT_BELUM_DIBACA, f);
    return () => window.removeEventListener(EVENT_BELUM_DIBACA, f);
  }, []);

  return n;
}
