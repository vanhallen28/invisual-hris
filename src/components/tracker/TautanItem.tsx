'use client';
// Project Brief — tombol pintas di dalam side peek item.
// Manager mengisi nama dan alamatnya; siapa pun yang membuka item
// tinggal menekannya untuk langsung menuju tautan tersebut.
// Hak akses dijaga di database lewat trigger, bukan sekadar tombol tersembunyi.

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Pencil, Link2, ExternalLink } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';

type Tautan = { id: string; label: string; url: string };

const idBaru = () => Math.random().toString(36).slice(2, 9);

const rapikan = (u: string) => {
  const t = u.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

export default function TautanItem({ itemId }: { itemId: string }) {
  const { supabase, isManager, pushToast, triggerConfirm }: any = useDashboard();
  const boleh = !!isManager;

  const [daftar, setDaftar] = useState<Tautan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [siap, setSiap] = useState(true);

  const [sunting, setSunting] = useState<string | null>(null);   // id yang sedang disunting, '' = baru
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');

  const muat = useCallback(async () => {
    if (!supabase || !itemId) return;
    setMemuat(true);
    try {
      const { data, error } = await supabase.from('items').select('tautan').eq('id', itemId).maybeSingle();
      if (error) throw new Error(error.message);
      setDaftar(Array.isArray(data?.tautan) ? data.tautan : []);
      setSiap(true);
    } catch {
      setSiap(false);            // kolomnya belum dibuat
    }
    setMemuat(false);
  }, [supabase, itemId]);

  useEffect(() => { muat(); }, [muat]);

  const simpan = async (next: Tautan[]) => {
    const sebelum = daftar;
    setDaftar(next);                                    // tampilkan dulu
    try {
      const { error } = await supabase.from('items').update({ tautan: next }).eq('id', itemId);
      if (error) throw new Error(error.message);
    } catch (e: any) {
      setDaftar(sebelum);                               // gagal → kembalikan
      pushToast?.('Gagal menyimpan: ' + (e?.message || e));
    }
  };

  const mulaiBaru = () => { setSunting(''); setLabel(''); setUrl(''); };
  const mulaiSunting = (t: Tautan) => { setSunting(t.id); setLabel(t.label); setUrl(t.url); };
  const batal = () => { setSunting(null); setLabel(''); setUrl(''); };

  const simpanBorang = async () => {
    const u = rapikan(url);
    const l = label.trim();
    if (!u) { pushToast?.('Alamat tautan belum diisi.'); return; }
    const next = sunting
      ? daftar.map((t) => (t.id === sunting ? { ...t, label: l || u, url: u } : t))
      : [...daftar, { id: idBaru(), label: l || u, url: u }];
    batal();
    await simpan(next);
  };

  const hapus = (t: Tautan) =>
    triggerConfirm?.('Hapus brief', `Hapus "${t.label}"?`, () =>
      simpan(daftar.filter((x) => x.id !== t.id)));

  if (memuat) return null;

  if (!siap) {
    return (
      <div className="px-6 pb-5">
        <p className="text-[11px] text-gray-600">Kolom tautan belum disiapkan. Jalankan <span className="text-gray-400">tautan-item.sql</span> di Supabase.</p>
      </div>
    );
  }

  // Karyawan tanpa tautan sama sekali: tak perlu ada bagian kosong.
  if (!boleh && daftar.length === 0) return null;

  return (
    <div className="px-6 pb-5">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 size={13} className="text-gray-500 shrink-0" />
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 truncate">Project Brief</h4>
        </div>
        {boleh && sunting === null && (
          <button onClick={mulaiBaru}
            className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-white bg-kartu-hover hover:bg-kartu-hover px-2 py-1 rounded transition-colors shrink-0">
            <Plus size={11} /> Tambah
          </button>
        )}
      </div>

      {/* ── Tombol tautan ── */}
      <div className="flex flex-wrap gap-2">
        {daftar.map((t) => (
          <div key={t.id} className="group/t relative">
            <a
              href={t.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-200 hover:text-white text-xs font-semibold pl-3 pr-3 py-2 rounded-lg transition-colors max-w-[240px]"
            >
              <ExternalLink size={13} className="shrink-0" />
              <span className="truncate">{t.label}</span>
            </a>

            {boleh && (
              <div className="absolute -top-1.5 -right-1.5 flex items-center gap-0.5 opacity-0 group-hover/t:opacity-100 transition-opacity">
                <button onClick={() => mulaiSunting(t)} title="Ubah"
                  className="p-1 bg-kartu-hover border border-white/10 rounded text-gray-400 hover:text-white transition-colors">
                  <Pencil size={9} />
                </button>
                <button onClick={() => hapus(t)} title="Hapus"
                  className="p-1 bg-kartu-hover border border-white/10 rounded text-gray-500 hover:text-red-400 transition-colors">
                  <Trash2 size={9} />
                </button>
              </div>
            )}
          </div>
        ))}

        {boleh && daftar.length === 0 && sunting === null && (
          <p className="text-[11px] text-gray-600 py-1">Belum ada brief. Tekan Tambah untuk mengisi.</p>
        )}
      </div>

      {/* ── Borang isi ── */}
      {boleh && sunting !== null && (
        <div className="bg-kartu border border-white/10 rounded-lg p-2.5 mt-2.5 flex flex-col gap-2">
          <input
            value={label} onChange={(e) => setLabel(e.target.value)} autoFocus
            placeholder="Nama tombol — misalnya Brief CIRI"
            onKeyDown={(e) => { if (e.key === 'Enter') simpanBorang(); if (e.key === 'Escape') batal(); }}
            className="bg-latar border border-white/10 focus:border-blue-500 rounded px-2 py-1.5 text-[11px] text-white outline-none transition-colors"
          />
          <input
            value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="Tempel alamat tautan…"
            onKeyDown={(e) => { if (e.key === 'Enter') simpanBorang(); if (e.key === 'Escape') batal(); }}
            className="bg-latar border border-white/10 focus:border-blue-500 rounded px-2 py-1.5 text-[11px] text-white outline-none transition-colors"
          />
          <div className="flex justify-end gap-2">
            <button onClick={batal} className="text-[10px] text-gray-500 hover:text-white px-2 py-1 transition-colors">Batal</button>
            <button onClick={simpanBorang} disabled={!url.trim()}
              className="text-[10px] font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1 rounded transition-colors">
              {sunting ? 'Simpan' : 'Tambahkan'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
