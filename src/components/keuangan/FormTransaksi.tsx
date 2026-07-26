// src/components/keuangan/FormTransaksi.tsx
'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import InputRupiah from '@/components/keuangan/InputRupiah';
import { simpanTransaksi, type IsianTransaksi } from '@/lib/keuangan/data';
import { todayISO } from '@/lib/keuangan/format';
import type { Akun, Jenis, Kategori } from '@/lib/keuangan/tipe';

type Props = {
  kategori: Kategori[];
  akun: Akun[];
  bisaTulis: boolean;
  /** Dipanggil setelah tersimpan supaya daftar di halaman ikut segar. */
  onTersimpan: () => void;
};

const KELAS_ISIAN =
  'mt-1.5 w-full rounded-lg border border-white/10 bg-input px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-primer';
const KELAS_LABEL = 'text-[11px] font-bold uppercase tracking-wider text-gray-500';

export default function FormTransaksi({ kategori, akun, bisaTulis, onTersimpan }: Props) {
  const toast = useToast();

  const [jenis, setJenis] = useState<Jenis>('in');
  const [tanggal, setTanggal] = useState(todayISO());
  const [catatan, setCatatan] = useState('');
  const [kategoriId, setKategoriId] = useState('');
  const [akunId, setAkunId] = useState('');
  const [jumlah, setJumlah] = useState(0);
  const [menyimpan, setMenyimpan] = useState(false);

  const pilihanKategori = kategori.filter((k) => k.kind === jenis);

  // Kategori ikut berganti saat jenis diubah — kalau tidak, pilihan lama
  // (mis. kategori pemasukan) bisa ikut terkirim untuk pengeluaran.
  useEffect(() => {
    setKategoriId(pilihanKategori[0]?.id ?? '');
  }, [jenis, kategori]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!akunId && akun.length) setAkunId(akun[0].id);
  }, [akun, akunId]);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (menyimpan) return;

    const isian: IsianTransaksi = {
      occurred_on: tanggal,
      kind: jenis,
      category_id: kategoriId,
      account_id: akunId,
      amount: jumlah,
      note: catatan,
    };

    setMenyimpan(true);
    try {
      await simpanTransaksi(isian);
      toast.sukses('Transaksi tersimpan.');
      // Tanggal & jenis sengaja DIPERTAHANKAN: saat mencatat banyak
      // transaksi sekaligus, mengetik ulang tanggalnya melelahkan.
      setCatatan('');
      setJumlah(0);
      onTersimpan();
    } catch (err: unknown) {
      toast.gagal(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.');
    }
    setMenyimpan(false);
  };

  if (!bisaTulis) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
        <p className="text-[13px] text-gray-500">
          Peran Anda hanya bisa melihat, jadi form pencatatan disembunyikan.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={kirim}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 kartu-glow"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div>
          <span className={KELAS_LABEL}>Jenis</span>
          <div className="mt-1.5 flex overflow-hidden rounded-lg border border-white/10 bg-input">
            {(['in', 'out'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setJenis(k)}
                aria-pressed={jenis === k}
                className={`flex-1 px-2 py-2.5 text-[12px] font-bold transition-colors ${
                  jenis === k
                    ? k === 'in'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {k === 'in' ? 'Masuk' : 'Keluar'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={KELAS_LABEL} htmlFor="tanggal">Tanggal</label>
          <input
            id="tanggal"
            type="date"
            required
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className={KELAS_ISIAN}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={KELAS_LABEL} htmlFor="catatan">Keterangan</label>
          <input
            id="catatan"
            type="text"
            placeholder="Contoh: Invoice #204 — PT Sinar"
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            className={`${KELAS_ISIAN} placeholder-gray-600`}
          />
        </div>

        <div>
          <label className={KELAS_LABEL} htmlFor="kategori">Kategori</label>
          <select
            id="kategori"
            required
            value={kategoriId}
            onChange={(e) => setKategoriId(e.target.value)}
            className={KELAS_ISIAN}
          >
            {pilihanKategori.map((k) => (
              <option key={k.id} value={k.id} className="bg-kartu">{k.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={KELAS_LABEL} htmlFor="akun">Akun</label>
          <select
            id="akun"
            required
            value={akunId}
            onChange={(e) => setAkunId(e.target.value)}
            className={KELAS_ISIAN}
          >
            {akun.map((a) => (
              <option key={a.id} value={a.id} className="bg-kartu">{a.name}</option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <span className={KELAS_LABEL}>Jumlah (Rp)</span>
          <div className="mt-1.5">
            <InputRupiah nilai={jumlah} onUbah={setJumlah} id="jumlah" />
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button
          type="submit"
          disabled={menyimpan}
          className="rounded-lg bg-primer px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primer-terang disabled:opacity-50"
        >
          {menyimpan ? 'Menyimpan…' : 'Simpan Transaksi'}
        </button>
      </div>
    </form>
  );
}
