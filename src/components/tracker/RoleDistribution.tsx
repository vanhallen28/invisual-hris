'use client';
// Role Distribution — tabel mini di dalam side peek item.
// Kolomnya dibuat sendiri (teks atau tag berwarna), seluruh selnya bisa diedit.
// Hanya manager yang boleh membuat dan mengubah; itu juga dijaga di database
// lewat trigger, jadi bukan sekadar tombol yang disembunyikan.

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, X, Trash2, Type, Tags, Users2, User, Search, Check, ListChecks } from 'lucide-react';
import { useDashboard } from '@/components/tracker/DashboardContext';
import InlineEdit from './InlineEdit';
import Avatar from '@/components/Avatar';
import { namaPendek, cocokNama } from '@/lib/tracker/nama';

type Kolom = { id: string; label: string; type: 'teks' | 'tag' | 'orang'; manual?: boolean };

// Kolom yang namanya berbau orang otomatis memakai pemilih anggota,
// jadi Person / PIC / Penanggung Jawab tak perlu diketik manual.
const POLA_ORANG = /(person|people|pic\b|penanggung|orang|assignee|owner|anggota|member)/i;
const tebakTipe = (label: string): Kolom['type'] => (POLA_ORANG.test(String(label)) ? 'orang' : 'teks');

// Kolom bernama PIC / Person / People langsung jadi pemilih orang —
// termasuk kolom lama yang terlanjur tersimpan sebagai teks atau tag.
// Kecuali jenisnya pernah diubah manual lewat ikon di kepala kolom.
// Urutan penentuan: pilihan manual → nama berbau orang → kolom papan
// bernama sama yang punya daftar pilihan → jenis tersimpan.
const tipeEfektif = (col: Kolom, opsi: any[] = []): 'teks' | 'tag' | 'orang' | 'pilihan' => {
  if (col.manual) return col.type;
  if (POLA_ORANG.test(String(col.label))) return 'orang';
  if (opsi.length) return 'pilihan';
  return col.type;
};
type Baris = { id: string; cells: Record<string, any> };
type Data = { columns: Kolom[]; rows: Baris[] };

const KOSONG: Data = { columns: [], rows: [] };

const PALET = ['#579bfc', '#00c875', '#fdab3d', '#e2445c', '#a25ddc', '#ff5ac4', '#9d99ff', '#1d9e75'];
const warnaTag = (t: string) =>
  PALET[Math.abs([...String(t)].reduce((a, c) => a + c.charCodeAt(0), 0)) % PALET.length];

const idBaru = () => Math.random().toString(36).slice(2, 9);
const mColor = (m: any) => (m?.color && String(m.color).startsWith('bg-') ? m.color : 'bg-primer-terang');

// Susunan awal, meniru contoh yang dipakai tim.
const BAWAAN: Data = {
  columns: [
    { id: 'c1', label: 'Person', type: 'orang' },
    { id: 'c2', label: 'Stage', type: 'tag' },
    { id: 'c3', label: 'Status', type: 'tag' },
  ],
  rows: [{ id: idBaru(), cells: {} }],
};

/* ══════════ Sel bertipe tag ══════════ */
function SelTag({ nilai, boleh, onChange }: any) {
  const [tulis, setTulis] = useState(false);
  const [teks, setTeks] = useState('');
  const arr: string[] = Array.isArray(nilai) ? nilai : nilai ? [String(nilai)] : [];

  const tambah = () => {
    const t = teks.trim();
    if (t && !arr.includes(t)) onChange([...arr, t]);
    setTeks(''); setTulis(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {arr.map((t) => (
        <span
          key={t}
          className="group/tag inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded"
          style={{ background: warnaTag(t) + '26', color: warnaTag(t), border: `1px solid ${warnaTag(t)}55` }}
        >
          {t}
          {boleh && (
            <button onClick={() => onChange(arr.filter((x) => x !== t))} className="opacity-0 group-hover/tag:opacity-100 transition-opacity hover:text-white" title="Hapus tag">
              <X size={9} />
            </button>
          )}
        </span>
      ))}

      {boleh && (tulis ? (
        <input
          autoFocus value={teks} onChange={(e) => setTeks(e.target.value)}
          onBlur={tambah}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tambah(); } if (e.key === 'Escape') { setTeks(''); setTulis(false); } }}
          placeholder="Tulis lalu Enter"
          className="bg-latar border border-blue-500 rounded px-1.5 py-0.5 text-[10px] text-white outline-none w-28"
        />
      ) : (
        <button onClick={() => setTulis(true)} className="text-gray-600 hover:text-blue-400 transition-colors" title="Tambah tag">
          <Plus size={11} />
        </button>
      ))}

      {!boleh && arr.length === 0 && <span className="text-[11px] text-gray-600">—</span>}
    </div>
  );
}

/* ══════════ Sel bertipe orang ══════════ */
// Daftarnya ditarik dari anggota tim, bukan diketik.
// Pemilihnya melebar ke bawah di dalam sel — bukan melayang — karena
// tabel ini berada di area bergulir yang akan memotong dropdown melayang.
function SelOrang({ nilai, boleh, teamMembers, onChange }: any) {
  const [buka, setBuka] = useState(false);
  const [q, setQ] = useState('');
  const arr: string[] = Array.isArray(nilai) ? nilai : nilai ? [String(nilai)] : [];
  const terpilih = (teamMembers || []).filter((m: any) => arr.includes(m.id));
  const cocok = (teamMembers || []).filter((m: any) =>
    cocokNama(m, q));

  const toggle = (id: string) =>
    onChange(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {terpilih.map((m: any) => (
          <span key={m.id} className="group/orang inline-flex items-center gap-1 text-[10px] pl-0.5 pr-1.5 py-0.5 rounded-full border border-blue-500/40 bg-blue-500/10 text-gray-100">
            <Avatar url={m.avatarUrl} name={m.name} initials={m.initials} className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0 ${mColor(m)}`} />
            <span className="truncate max-w-[90px]" title={m.name}>{namaPendek(m)}</span>
            {boleh && (
              <button onClick={() => toggle(m.id)} className="opacity-0 group-hover/orang:opacity-100 transition-opacity hover:text-red-400" title="Lepas">
                <X size={9} />
              </button>
            )}
          </span>
        ))}

        {/* Nilai lama dari kolom tag yang berubah jadi kolom orang —
            ditampilkan redup agar tak hilang diam-diam, dan bisa dilepas. */}
        {arr.filter((v) => !(teamMembers || []).some((m: any) => m.id === v)).map((v) => (
          <span key={v} className="group/asing inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-gray-500">
            <span className="truncate max-w-[90px] line-through">{v}</span>
            {boleh && (
              <button onClick={() => onChange(arr.filter((x) => x !== v))} className="opacity-0 group-hover/asing:opacity-100 transition-opacity hover:text-red-400" title="Buang">
                <X size={9} />
              </button>
            )}
          </span>
        ))}

        {boleh && (
          <button onClick={() => { setBuka(!buka); setQ(''); }} className="text-gray-600 hover:text-blue-400 transition-colors" title="Pilih orang">
            <Plus size={11} />
          </button>
        )}
        {!boleh && terpilih.length === 0 && <span className="text-[11px] text-gray-600">—</span>}
      </div>

      {boleh && buka && (
        <div className="bg-kartu border border-white/10 rounded-lg p-1.5">
          <div className="flex items-center gap-1.5 bg-latar border border-white/10 rounded px-2 py-1 mb-1">
            <Search size={10} className="text-gray-500 shrink-0" />
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…"
              onKeyDown={(e) => { if (e.key === 'Escape') setBuka(false); }}
              className="bg-transparent text-[10px] text-white outline-none w-full"
            />
          </div>
          <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5">
            {cocok.map((m: any) => {
              const on = arr.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggle(m.id)}
                  className={`flex items-center gap-1.5 px-1.5 py-1 rounded text-left transition-colors ${on ? 'bg-blue-500/15' : 'hover:bg-white/5'}`}>
                  <Avatar url={m.avatarUrl} name={m.name} initials={m.initials} className={`w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-white shrink-0 ${mColor(m)}`} />
                  <span className={`text-[10px] truncate flex-1 ${on ? 'text-white font-semibold' : 'text-gray-300'}`}>{m.name}</span>
                  {on && <Check size={10} className="text-blue-400 shrink-0" />}
                </button>
              );
            })}
            {cocok.length === 0 && <p className="text-[10px] text-gray-600 text-center py-2">Tak ada nama yang cocok.</p>}
          </div>
          <button onClick={() => setBuka(false)} className="w-full mt-1 text-[10px] text-gray-500 hover:text-white py-1 transition-colors">Selesai</button>
        </div>
      )}
    </div>
  );
}

/* ══════════ Sel bertipe pilihan ══════════ */
// Opsinya diambil dari kolom papan bernama sama — Stage, Status, dan
// sejenisnya — lengkap dengan warna yang sudah dipakai di tabel utama.
function SelPilihan({ nilai, boleh, opsi, onChange }: any) {
  const [buka, setBuka] = useState(false);
  const arr: string[] = Array.isArray(nilai) ? nilai : nilai ? [String(nilai)] : [];
  const warna = (teks: string) => opsi.find((o: any) => o.text === teks)?.color || '';
  const kenal = (teks: string) => opsi.some((o: any) => o.text === teks);

  const toggle = (teks: string) =>
    onChange(arr.includes(teks) ? arr.filter((x) => x !== teks) : [...arr, teks]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {arr.map((t) => (
          <span
            key={t}
            className={`group/pil inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
              kenal(t) ? `${warna(t)} text-white` : 'border border-white/10 bg-white/5 text-gray-500'
            }`}
          >
            <span className={kenal(t) ? '' : 'line-through'}>{t}</span>
            {boleh && (
              <button onClick={() => onChange(arr.filter((x) => x !== t))} className="opacity-0 group-hover/pil:opacity-100 transition-opacity hover:text-red-300" title="Lepas">
                <X size={9} />
              </button>
            )}
          </span>
        ))}

        {boleh && (
          <button onClick={() => setBuka(!buka)} className="text-gray-600 hover:text-blue-400 transition-colors" title="Pilih">
            <Plus size={11} />
          </button>
        )}
        {!boleh && arr.length === 0 && <span className="text-[11px] text-gray-600">—</span>}
      </div>

      {boleh && buka && (
        <div className="bg-kartu border border-white/10 rounded-lg p-1.5">
          <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1">
            {opsi.map((o: any) => {
              const on = arr.includes(o.text);
              return (
                <button
                  key={o.id} onClick={() => toggle(o.text)}
                  className={`text-[10px] font-semibold px-2 py-1 rounded transition-all ${on ? `${o.color} text-white` : 'bg-white/5 text-gray-400 hover:bg-kartu-hover'}`}
                >
                  {o.text}
                </button>
              );
            })}
            {opsi.length === 0 && <p className="text-[10px] text-gray-600 py-1">Kolom papan ini belum punya pilihan.</p>}
          </div>
          <button onClick={() => setBuka(false)} className="w-full mt-1 text-[10px] text-gray-500 hover:text-white py-1 transition-colors">Selesai</button>
        </div>
      )}
    </div>
  );
}

/* ══════════ Komponen utama ══════════ */
export default function RoleDistribution({ itemId }: { itemId: string }) {
  const { supabase, isManager, pushToast, triggerConfirm, teamMembers, columns, labels }: any = useDashboard();

  // Cari kolom papan yang namanya sama, lalu pakai daftar pilihannya.
  // Inilah yang membuat Stage & Status memakai opsi yang sama persis
  // dengan yang tampil di bagian Fields di atasnya — warna ikut.
  const opsiUntuk = (label: string) => {
    const nama = String(label || '').trim().toLowerCase();
    if (!nama) return [];
    const c = (columns || []).find((x: any) => String(x.label || '').trim().toLowerCase() === nama);
    return c ? (labels?.[c.id] || []) : [];
  };
  const [data, setData] = useState<Data | null>(null);
  const [memuat, setMemuat] = useState(true);
  const boleh = !!isManager;

  const muat = useCallback(async () => {
    if (!supabase || !itemId) return;
    setMemuat(true);
    try {
      const { data: baris, error } = await supabase
        .from('items').select('role_distribution').eq('id', itemId).maybeSingle();
      if (error) throw new Error(error.message);
      const isi = baris?.role_distribution;
      setData(isi && Array.isArray(isi.columns) ? isi : null);
    } catch {
      setData(null);   // kolomnya belum dibuat di database — perlakukan sebagai kosong
    }
    setMemuat(false);
  }, [supabase, itemId]);

  useEffect(() => { muat(); }, [muat]);

  const simpan = async (next: Data) => {
    const sebelum = data;
    setData(next);                                  // tampilkan dulu, biar terasa cepat
    try {
      const { error } = await supabase.from('items').update({ role_distribution: next }).eq('id', itemId);
      if (error) throw new Error(error.message);
    } catch (e: any) {
      setData(sebelum);                             // gagal → kembalikan seperti semula
      pushToast?.('Gagal menyimpan Role Distribution: ' + (e?.message || e));
    }
  };

  const d = data || KOSONG;

  const ubahSel = (rowId: string, colId: string, val: any) =>
    simpan({ ...d, rows: d.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: val } } : r)) });

  const tambahBaris = () => simpan({ ...d, rows: [...d.rows, { id: idBaru(), cells: {} }] });
  const hapusBaris = (rowId: string) => simpan({ ...d, rows: d.rows.filter((r) => r.id !== rowId) });

  const tambahKolom = () =>
    simpan({ ...d, columns: [...d.columns, { id: idBaru(), label: 'Kolom baru', type: 'teks' }] });

  const ubahKolom = (colId: string, patch: Partial<Kolom>) =>
    simpan({ ...d, columns: d.columns.map((c) => (c.id === colId ? { ...c, ...patch } : c)) });

  const hapusKolom = (col: Kolom) =>
    triggerConfirm?.('Hapus Kolom', `Hapus kolom "${col.label}" beserta isinya?`, () =>
      simpan({
        ...d,
        columns: d.columns.filter((c) => c.id !== col.id),
        rows: d.rows.map((r) => { const cells = { ...r.cells }; delete cells[col.id]; return { ...r, cells }; }),
      }));

  /* ── Keadaan kosong ── */
  if (memuat) {
    return (
      <div className="border-t border-white/10 pt-5 mt-5">
        <p className="text-[11px] text-gray-600">Memuat Role Distribution…</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="border-t border-white/10 pt-5 mt-5">
        <div className="flex items-center gap-2 mb-3">
          <Users2 size={14} className="text-gray-500" />
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Role Distribution</h4>
        </div>
        {boleh ? (
          <button
            onClick={() => simpan(BAWAAN)}
            className="flex items-center gap-2 text-[11px] font-bold text-blue-300 hover:text-white bg-blue-500/10 hover:bg-blue-600 border border-blue-500/30 px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={12} /> Buat Role Distribution
          </button>
        ) : (
          <p className="text-[11px] text-gray-600">Belum dibuat. Hanya manager yang dapat membuatnya.</p>
        )}
      </div>
    );
  }

  return (
    <div className="border-t border-white/10 pt-5 mt-5">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Users2 size={14} className="text-gray-500 shrink-0" />
          <h4 className="text-[11px] font-bold uppercase tracking-widest text-gray-500 truncate">Role Distribution</h4>
        </div>
        {boleh && (
          <button onClick={tambahKolom} className="flex items-center gap-1 text-[10px] font-bold text-gray-400 hover:text-white bg-kartu-hover hover:bg-kartu-hover px-2 py-1 rounded transition-colors shrink-0" title="Tambah kolom">
            <Plus size={11} /> Kolom
          </button>
        )}
      </div>

      <div className="overflow-x-auto custom-scrollbar rounded-lg border border-white/10">
        <table className="w-full text-left" style={{ minWidth: Math.max(320, d.columns.length * 150) }}>
          <thead>
            <tr className="bg-kartu/60">
              {d.columns.map((col) => {
                const opsi = opsiUntuk(col.label);
                const te = tipeEfektif(col, opsi);
                return (
                <th key={col.id} className="group/col px-2.5 py-2 border-r border-white/10 last:border-r-0 align-middle">
                  <div className="flex items-center gap-1">
                    <div className="flex-1 min-w-0">
                      {boleh ? (
                        <InlineEdit
                          value={col.label}
                          onSave={(v: string) => ubahKolom(col.id, col.manual ? { label: v } : { label: v, type: tebakTipe(v) })}
                          textClassName="text-[10px] font-bold uppercase tracking-wide text-gray-400 truncate hover:text-white"
                          className="text-[10px] font-bold uppercase"
                        />
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 truncate">{col.label}</span>
                      )}
                    </div>
                    {boleh && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/col:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => ubahKolom(col.id, { type: te === 'teks' ? 'tag' : te === 'tag' ? 'orang' : 'teks', manual: true })}
                          className="p-0.5 text-gray-600 hover:text-blue-400 transition-colors"
                          title={te === 'pilihan' ? 'Mengikuti pilihan kolom papan — klik untuk atur sendiri' : te === 'teks' ? 'Sekarang teks — klik untuk tag' : te === 'tag' ? 'Sekarang tag — klik untuk orang' : 'Sekarang orang — klik untuk teks'}
                        >
                          {te === 'teks' ? <Type size={10} /> : te === 'tag' ? <Tags size={10} /> : te === 'orang' ? <User size={10} /> : <ListChecks size={10} />}
                        </button>
                        <button onClick={() => hapusKolom(col)} className="p-0.5 text-gray-600 hover:text-red-400 transition-colors" title="Hapus kolom">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </th>
                );
              })}
              {boleh && <th className="w-8" />}
            </tr>
          </thead>

          <tbody>
            {d.rows.map((row) => (
              <tr key={row.id} className="group/row border-t border-white/10 hover:bg-white/5 transition-colors">
                {d.columns.map((col) => {
                  const opsi = opsiUntuk(col.label);
                  const te = tipeEfektif(col, opsi);
                  return (
                  <td key={col.id} className="px-2.5 py-2 border-r border-white/10 last:border-r-0 align-top">
                    {te === 'pilihan' ? (
                      <SelPilihan nilai={row.cells[col.id]} boleh={boleh} opsi={opsi} onChange={(v: any) => ubahSel(row.id, col.id, v)} />
                    ) : te === 'tag' ? (
                      <SelTag nilai={row.cells[col.id]} boleh={boleh} onChange={(v: any) => ubahSel(row.id, col.id, v)} />
                    ) : te === 'orang' ? (
                      <SelOrang nilai={row.cells[col.id]} boleh={boleh} teamMembers={teamMembers} onChange={(v: any) => ubahSel(row.id, col.id, v)} />
                    ) : boleh ? (
                      <InlineEdit
                        value={row.cells[col.id] || ''}
                        onSave={(v: string) => ubahSel(row.id, col.id, v)}
                        placeholder="—"
                        textClassName="text-[11px] text-gray-200 truncate text-left"
                        className="text-[11px]"
                      />
                    ) : (
                      <span className="text-[11px] text-gray-300">{row.cells[col.id] || '—'}</span>
                    )}
                  </td>
                  );
                })}
                {boleh && (
                  <td className="px-1 align-middle">
                    <button onClick={() => hapusBaris(row.id)} className="p-1 text-gray-700 hover:text-red-400 opacity-0 group-hover/row:opacity-100 transition-all" title="Hapus baris">
                      <Trash2 size={11} />
                    </button>
                  </td>
                )}
              </tr>
            ))}

            {d.rows.length === 0 && (
              <tr><td colSpan={d.columns.length + 1} className="px-3 py-4 text-center text-[11px] text-gray-600">Belum ada baris.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {boleh && (
        <button onClick={tambahBaris} className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-blue-300 transition-colors">
          <Plus size={12} /> Tambah baris
        </button>
      )}
    </div>
  );
}
