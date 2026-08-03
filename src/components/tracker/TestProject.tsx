'use client';
// Test Project — kanvas kolaboratif di dalam HRIS.
//
// Tombolnya duduk di side peek, di bawah Project Brief. Kanvasnya sendiri
// dibuka satu layar penuh, karena editor ini butuh ruang untuk toolbar,
// panel layer, dan panel properti sekaligus.
//
// Tidak ada layar login. Staf sudah masuk lewat portal, jadi kanvas
// menumpang sesi Supabase yang sama.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { supabase } from '@/lib/supabase';
import { Shapes, Plus, X, Trash2, FileText, ChevronLeft, Upload } from 'lucide-react';
import { ACCEPT_IMPOR, PESAN_FIG, pesanTakDidukung, pilahBerkas } from '@/kanvas/lib/impor';
import { useToast } from "@/components/Toast";

// Proyek bersama, disiapkan oleh kanvas.sql.
const PROYEK = '11111111-2222-4333-8444-555555555555';

// Yjs menyentuh objek browser, jadi editor tak boleh ikut bundel server.
const EditorClient = dynamic(
  () => import('@/kanvas/EditorClient').then((m) => m.EditorClient),
  { ssr: false }
);

// CSS milik proyek kanvas. Aslinya global (html, body), tetapi di dalam
// HRIS harus dilingkupi — kalau tidak, ukuran huruf 13px dan warnanya
// ikut mengubah seluruh aplikasi. Semua diletakkan di bawah .kanvas-root.
const GAYA_KANVAS = `
.kanvas-root {
  --surface-0: #0e0e11;
  --surface-1: #16161a;
  --surface-2: #1e1e24;
  --line: #26262d;
  --line-strong: #35353f;
  --text-0: #e9e9ec;
  --text-1: #9b9ba6;
  --text-2: #66666f;
  --accent: #4d8dff;
  --accent-soft: #4d8dff28;
  --artboard: #ffffff;
  --void: #121216;
  --radius: 3px;

  background: var(--surface-0);
  color: var(--text-0);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}
.kanvas-root .num {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  letter-spacing: -0.01em;
}
/* Seret di kanvas dulu ikut menyorot SELURUH teks antarmuka — nama layer,
   judul panel, label — karena user-select hanya dipasang di permukaan
   kanvas. Sekarang dimatikan untuk seluruh editor, lalu dihidupkan lagi
   khusus di isian teks supaya tetap bisa disalin dan disunting. */
.kanvas-root {
  user-select: none;
  -webkit-user-select: none;
}
.kanvas-root input,
.kanvas-root textarea,
.kanvas-root [contenteditable="true"] {
  user-select: text;
  -webkit-user-select: text;
}
.kanvas-root .canvas-surface {
  touch-action: none;
}
.kanvas-root :focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}
`;

type Berkas = { id: string; name: string; updated_at: string };

const waktu = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `${Math.max(1, Math.floor(d / 60))} menit lalu`;
  if (d < 86400) return `${Math.floor(d / 3600)} jam lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
};

export default function TestProject() {
  const toast = useToast();
  const [buka, setBuka] = useState(false);
  const [saya, setSaya] = useState<{ id: string; nama: string } | null>(null);
  const [daftar, setDaftar] = useState<Berkas[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [aktif, setAktif] = useState<any>(null);   // berkas yang sedang dibuka
  const [terpasang, setTerpasang] = useState(false);
  useEffect(() => setTerpasang(true), []);

  /* ── Siapkan sesi & keanggotaan, lalu ambil daftar berkas ── */
  const siapkan = useCallback(async () => {
    setMemuat(true); setGalat(null);
    try {
      const { data: sesi } = await supabase.auth.getUser();
      const u = sesi?.user;
      if (!u) throw new Error('Sesi tidak ditemukan. Coba masuk ulang.');
      setSaya({ id: u.id, nama: String(u.email || 'Tanpa nama').split('@')[0] });

      // Bergabung ke proyek bersama. Kalau sudah jadi anggota,
      // penyisipan ditolak karena kunci ganda — itu wajar, diabaikan.
      await supabase.from('project_members')
        .insert({ project_id: PROYEK, user_id: u.id, role: 'editor' });

      const { data, error } = await supabase
        .from('kanvas_files').select('id, name, updated_at')
        .eq('project_id', PROYEK)
        .order('updated_at', { ascending: false });
      if (error) throw new Error(error.message);
      setDaftar(data || []);
    } catch (e: any) {
      setGalat(e?.message || String(e));
    }
    setMemuat(false);
  }, []);

  useEffect(() => { if (buka && !aktif) siapkan(); }, [buka, aktif, siapkan]);

  /* ── Aksi berkas ── */

  /* Impor dari halaman daftar.
     Berkas yang sah membuat kanvas BARU bernama sesuai berkasnya, lalu
     kanvas itu langsung dibuka dan berkasnya ditaruh di sana. Menaruh node
     ke Y.Doc dari luar editor terlalu berisiko, jadi berkasnya dititipkan
     lewat prop dan editor yang menempatkannya setelah siap. */
  const imporRef = useRef<HTMLInputElement>(null);
  const [berkasAwal, setBerkasAwal] = useState<File[] | null>(null);

  const pilihImpor = async (daftarBerkas: FileList | null) => {
    if (!daftarBerkas?.length || sibuk) return;
    const { dipakai, fig, ditolak } = pilahBerkas(Array.from(daftarBerkas));

    if (fig.length) toast.info(PESAN_FIG);
    if (ditolak.length) toast.gagal(pesanTakDidukung(ditolak[0]));
    if (!dipakai.length) return;

    setSibuk(true);
    try {
      const namaDariBerkas = dipakai[0].name.replace(/\.[^.]+$/, '').slice(0, 60) || `Kanvas ${daftar.length + 1}`;
      const { data, error } = await supabase
        .from('kanvas_files').insert({ project_id: PROYEK, name: namaDariBerkas })
        .select('id, name, updated_at').single();
      if (error) throw new Error(error.message);
      setDaftar((d) => [data as Berkas, ...d]);
      setBerkasAwal(dipakai);
      await bukaBerkas(data as Berkas);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    setSibuk(false);
  };

  const buatBerkas = async () => {
    if (sibuk) return;
    setSibuk(true);
    try {
      const nama = `Kanvas ${daftar.length + 1}`;
      const { data, error } = await supabase
        .from('kanvas_files').insert({ project_id: PROYEK, name: nama })
        .select('id, name, updated_at').single();
      if (error) throw new Error(error.message);
      setDaftar((d) => [data as Berkas, ...d]);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    setSibuk(false);
  };

  const hapusBerkas = async (b: Berkas) => {
    if (!(await toast.konfirmasi(`Hapus kanvas "${b.name}"? Isinya ikut terhapus.`, { labelYa: "Hapus" }))) return;
    try {
      const { error } = await supabase.from('kanvas_files').delete().eq('id', b.id);
      if (error) throw new Error(error.message);
      setDaftar((d) => d.filter((x) => x.id !== b.id));
    } catch (e: any) { setGalat(e?.message || String(e)); }
  };

  const bukaBerkas = async (b: Berkas) => {
    setSibuk(true); setGalat(null);
    try {
      const { data, error } = await supabase
        .from('kanvas_files').select('id, name, project_id, ydoc')
        .eq('id', b.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('Kanvas tidak ditemukan.');
      setAktif(data);
    } catch (e: any) { setGalat(e?.message || String(e)); }
    setSibuk(false);
  };

  const tutupSemua = () => { setAktif(null); setBuka(false); };

  return (
    <div className="px-6 pb-5">
      <button
        onClick={() => setBuka(true)}
        className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-600 border border-blue-500/30 hover:border-blue-500 text-blue-200 hover:text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
      >
        <Shapes size={13} className="shrink-0" />
        Test Project
      </button>

      {/* Dipasang ke document.body. Side peek memakai transform untuk
          animasi geser, dan itu membuat elemen fixed di dalamnya ikut
          terkurung — kanvas jadi sesempit panelnya. Portal melepaskannya.
          Kanvas mengambil seluruh layar, seperti halaman Chat. */}
      {buka && terpasang && createPortal(
        <div className="kanvas-root fixed inset-0 z-[160] flex flex-col">
          <style dangerouslySetInnerHTML={{ __html: GAYA_KANVAS }} />

          {/* ══ Kepala ══ */}
          <div className="h-12 shrink-0 border-b border-white/10 bg-kartu-hover flex items-center gap-2 px-3">
            {aktif ? (
              <button onClick={() => setAktif(null)} title="Kembali ke daftar"
                className="p-1.5 text-gray-400 hover:text-white transition-colors">
                <ChevronLeft size={16} />
              </button>
            ) : (
              <Shapes size={15} className="text-gray-500 ml-1 shrink-0" />
            )}
            <span className="text-sm font-bold text-white truncate flex-1">
              {aktif ? aktif.name : 'Test Project'}
            </span>
            {!aktif && (
              <>
                <input ref={imporRef} type="file" accept={ACCEPT_IMPOR} multiple hidden
                  onChange={(e) => { pilihImpor(e.target.files); e.currentTarget.value = ''; }} />
                <button onClick={() => imporRef.current?.click()} disabled={sibuk}
                  title="Impor SVG, PNG, JPG — atau lihat panduan untuk berkas .fig"
                  className="flex items-center gap-1.5 text-[11px] font-bold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                  <Upload size={12} /> Impor
                </button>
                <button onClick={buatBerkas} disabled={sibuk}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-white bg-primer hover:bg-blue-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                  <Plus size={12} /> Kanvas baru
                </button>
              </>
            )}
            <button onClick={tutupSemua} title="Tutup"
              className="p-1.5 text-gray-400 hover:text-white transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>

          {/* ══ Isi ══ */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {aktif && saya ? (
              <EditorClient
                fileId={aktif.id}
                fileName={aktif.name}
                projectId={aktif.project_id}
                snapshot={(aktif.ydoc as string | null) ?? null}
                saya={saya}
                berkasAwal={berkasAwal}
                onBerkasAwalSelesai={() => setBerkasAwal(null)}
              />
            ) : (
              <div className="h-full overflow-y-auto p-6">
                {galat && (
                  <div className="mb-4 text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    {galat}
                  </div>
                )}

                {memuat && <p className="text-xs text-gray-500">Memuat daftar kanvas…</p>}

                {!memuat && daftar.length === 0 && !galat && (
                  <div className="text-center py-20">
                    <Shapes size={28} className="text-gray-700 mx-auto mb-3" />
                    <p className="text-xs text-gray-500 mb-4">Belum ada kanvas.</p>
                    <button onClick={buatBerkas} disabled={sibuk}
                      className="text-[11px] font-bold text-white bg-primer hover:bg-blue-600 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors">
                      Buat kanvas pertama
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl">
                  {daftar.map((b) => (
                    <div key={b.id} className="group relative rounded-xl border border-white/10 bg-kartu-hover hover:border-white/10 transition-colors overflow-hidden">
                      <button onClick={() => bukaBerkas(b)} disabled={sibuk} className="block w-full text-left">
                        <div className="aspect-[4/3] bg-kartu flex items-center justify-center">
                          <FileText size={22} className="text-gray-700" />
                        </div>
                        <div className="px-3 py-2">
                          <p className="text-[12px] font-semibold text-gray-200 truncate">{b.name}</p>
                          <p className="text-[10px] text-gray-600">{waktu(b.updated_at)}</p>
                        </div>
                      </button>
                      <button onClick={() => hapusBerkas(b)} title="Hapus kanvas"
                        className="absolute top-1.5 right-1.5 p-1 bg-kartu/90 rounded text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
