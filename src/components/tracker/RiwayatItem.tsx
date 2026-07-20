'use client';
// Riwayat — daftar perubahan pada satu item: siapa, apa, kapan.
// Datanya ditangkap trigger di database, jadi tak ada perubahan yang lolos.
// Ditutup secara bawaan supaya panel tidak jadi panjang.

import React, { useState, useEffect, useCallback } from 'react';
import { History, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import Avatar from '@/components/Avatar';

const BATAS = 40;

const mColor = (m: any) => (m?.color && String(m.color).startsWith('bg-') ? m.color : 'bg-[#579bfc]');

const jarak = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'baru saja';
  if (d < 3600) return `${Math.floor(d / 60)} menit lalu`;
  if (d < 86400) return `${Math.floor(d / 3600)} jam lalu`;
  if (d < 604800) return `${Math.floor(d / 86400)} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

const potong = (v: any, n = 40) => {
  const t = String(v ?? '').trim();
  if (!t) return '';
  return t.length > n ? t.slice(0, n) + '…' : t;
};

export default function RiwayatItem({ itemId }: { itemId: string }) {
  const { supabase, teamMembers, columns, subColumns }: any = useDashboard();

  const [buka, setBuka] = useState(false);
  const [baris, setBaris] = useState<any[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [siap, setSiap] = useState(true);
  const [jumlah, setJumlah] = useState<number | null>(null);

  const namaKolom = useCallback((id: string) => {
    const semua = [...(columns || []), ...(subColumns || [])];
    return semua.find((c: any) => c.id === id)?.label || 'kolom';
  }, [columns, subColumns]);

  const orang = useCallback((id: string) =>
    (teamMembers || []).find((m: any) => m.id === id), [teamMembers]);

  // Hitungan saja saat panel dibuka — murah, dan angkanya jadi petunjuk.
  useEffect(() => {
    if (!supabase || !itemId) return;
    let hidup = true;
    (async () => {
      try {
        const { count, error } = await supabase
          .from('item_activity').select('id', { count: 'exact', head: true }).eq('item_id', itemId);
        if (error) throw new Error(error.message);
        if (hidup) { setJumlah(count || 0); setSiap(true); }
      } catch { if (hidup) setSiap(false); }
    })();
    return () => { hidup = false; };
  }, [supabase, itemId]);

  const muat = useCallback(async () => {
    if (!supabase || !itemId) return;
    setMemuat(true);
    try {
      const { data, error } = await supabase
        .from('item_activity').select('*')
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
        .limit(BATAS);
      if (error) throw new Error(error.message);
      setBaris(data || []);
      setSiap(true);
    } catch { setSiap(false); }
    setMemuat(false);
  }, [supabase, itemId]);

  useEffect(() => { if (buka) muat(); }, [buka, muat]);

  if (!siap) return null;                       // tabelnya belum dibuat — diam saja
  if (jumlah === 0 && !buka) return null;       // belum ada riwayat

  const kalimat = (r: any) => {
    const kolom = r.column_id ? namaKolom(r.column_id) : '';
    switch (r.kind) {
      case 'dibuat':
        return <>membuat item ini</>;
      case 'nama':
        return <>mengubah nama menjadi <span className="text-zinc-300">{potong(r.nilai_baru)}</span></>;
      case 'pic-tambah': {
        const m = orang(r.nilai_baru);
        return <>menugaskan <span className="text-zinc-300">{m?.name || 'seseorang'}</span></>;
      }
      case 'pic-lepas': {
        const m = orang(r.nilai_lama);
        return <>melepas <span className="text-zinc-300">{m?.name || 'seseorang'}</span></>;
      }
      default: {
        const lama = potong(r.nilai_lama, 24);
        const baru = potong(r.nilai_baru, 24);
        return (
          <>
            mengubah <span className="text-zinc-400">{kolom}</span>
            {lama ? <> dari <span className="text-zinc-500 line-through">{lama}</span></> : null}
            {baru ? <> menjadi <span className="text-zinc-300">{baru}</span></> : <> menjadi kosong</>}
          </>
        );
      }
    }
  };

  return (
    <div className="border-t border-zinc-800/60 pt-4 mt-4">
      <div className="flex items-center gap-2">
        <button onClick={() => setBuka((v) => !v)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
          {buka ? <ChevronDown size={13} className="text-zinc-500 shrink-0" /> : <ChevronRight size={13} className="text-zinc-600 shrink-0" />}
          <History size={13} className="text-zinc-500 shrink-0" />
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 truncate">Riwayat</h4>
          {jumlah !== null && jumlah > 0 && (
            <span className="text-[10px] text-zinc-600 shrink-0">{jumlah > BATAS ? `${BATAS}+` : jumlah}</span>
          )}
        </button>
        {buka && (
          <button onClick={muat} disabled={memuat} title="Muat ulang"
            className="p-1 text-zinc-600 hover:text-white transition-colors shrink-0 disabled:opacity-40">
            <RefreshCw size={11} className={memuat ? 'animate-spin' : ''} />
          </button>
        )}
      </div>

      {buka && (
        <div className="mt-2.5 flex flex-col gap-2.5">
          {memuat && baris.length === 0 && <p className="text-[11px] text-zinc-600">Memuat riwayat…</p>}
          {!memuat && baris.length === 0 && <p className="text-[11px] text-zinc-600">Belum ada perubahan tercatat.</p>}

          {baris.map((r) => {
            const m = orang(r.actor_id);
            return (
              <div key={r.id} className="flex items-start gap-2">
                <Avatar url={m?.avatarUrl} name={m?.name} initials={m?.initials}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0 mt-0.5 ${mColor(m)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-zinc-500 leading-snug">
                    <span className="text-zinc-300 font-semibold">{m?.name || 'Seseorang'}</span>{' '}
                    {kalimat(r)}
                  </p>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{jarak(r.created_at)}</p>
                </div>
              </div>
            );
          })}

          {baris.length >= BATAS && (
            <p className="text-[10px] text-zinc-600">Menampilkan {BATAS} perubahan terakhir.</p>
          )}
        </div>
      )}
    </div>
  );
}
