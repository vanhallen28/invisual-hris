// src/components/keuangan/KelolaKategori.tsx
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { hapusKategori, tambahKategori } from '@/lib/keuangan/data';
import type { Jenis, Kategori } from '@/lib/keuangan/tipe';

type Props = {
  kategori: Kategori[];
  bisaTulis: boolean;
  onBerubah: () => void;
};

const KELAS_ISIAN =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-input px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primer';
const KELAS_LABEL = 'text-[11px] font-bold uppercase tracking-wider text-gray-500';

export default function KelolaKategori({ kategori, bisaTulis, onBerubah }: Props) {
  const toast = useToast();
  const [nama, setNama] = useState('');
  const [jenis, setJenis] = useState<Jenis>('out');
  const [sibuk, setSibuk] = useState(false);

  const tambah = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sibuk) return;
    setSibuk(true);
    try {
      await tambahKategori(nama, jenis);
      toast.sukses(`Kategori "${nama.trim()}" ditambahkan.`);
      setNama('');
      onBerubah();
    } catch (err: unknown) {
      toast.gagal(err instanceof Error ? err.message : 'Gagal menambah kategori.');
    }
    setSibuk(false);
  };

  const hapus = async (k: Kategori) => {
    const ya = await toast.konfirmasi(`Hapus kategori "${k.name}"?`, {
      labelYa: 'Hapus',
      labelTidak: 'Batal',
    });
    if (!ya) return;

    setSibuk(true);
    try {
      await hapusKategori(k.id);
      toast.sukses('Kategori dihapus.');
      onBerubah();
    } catch (err: unknown) {
      toast.gagal(err instanceof Error ? err.message : 'Gagal menghapus kategori.');
    }
    setSibuk(false);
  };

  return (
    <div className="space-y-6">
      {bisaTulis && (
        <form
          onSubmit={tambah}
          className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 kartu-glow"
        >
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[2fr_1fr_auto]">
            <div>
              <label className={KELAS_LABEL} htmlFor="nama-kategori">Nama kategori baru</label>
              <input
                id="nama-kategori"
                type="text"
                required
                placeholder="Contoh: Biaya Konsultan"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className={`${KELAS_ISIAN} placeholder-gray-600`}
              />
            </div>
            <div>
              <label className={KELAS_LABEL} htmlFor="jenis-kategori">Jenis</label>
              <select
                id="jenis-kategori"
                value={jenis}
                onChange={(e) => setJenis(e.target.value as Jenis)}
                className={KELAS_ISIAN}
              >
                <option value="out" className="bg-kartu">Pengeluaran</option>
                <option value="in" className="bg-kartu">Pemasukan</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={sibuk}
              className="rounded-lg bg-primer px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primer-terang disabled:opacity-50"
            >
              Tambah
            </button>
          </div>
        </form>
      )}

      {(['in', 'out'] as const).map((j) => {
        const daftar = kategori.filter((k) => k.kind === j);
        return (
          <div key={j}>
            <h3 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {j === 'in' ? 'Pemasukan' : 'Pengeluaran'} ({daftar.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {daftar.length === 0 && (
                <p className="text-[13px] text-gray-600">Belum ada kategori.</p>
              )}
              {daftar.map((k) => (
                <span
                  key={k.id}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                    j === 'in'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {k.name}
                  {k.is_system ? (
                    <span className="text-[9px] uppercase tracking-wider text-gray-500">
                      terkunci
                    </span>
                  ) : (
                    bisaTulis && (
                      <button
                        type="button"
                        onClick={() => hapus(k)}
                        disabled={sibuk}
                        aria-label={`Hapus ${k.name}`}
                        className="text-gray-500 transition-colors hover:text-white disabled:opacity-40"
                      >
                        <X size={12} />
                      </button>
                    )
                  )}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
