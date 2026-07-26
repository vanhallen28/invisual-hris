// src/components/keuangan/TabelTransaksi.tsx
'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { hapusTransaksi, totalDari } from '@/lib/keuangan/data';
import { formatDate, rp } from '@/lib/keuangan/format';
import type { BarisTransaksi } from '@/lib/keuangan/tipe';

type Props = {
  baris: BarisTransaksi[];
  bisaTulis: boolean;
  onBerubah: () => void;
};

export default function TabelTransaksi({ baris, bisaTulis, onBerubah }: Props) {
  const toast = useToast();
  const [sedangHapus, setSedangHapus] = useState('');

  const total = totalDari(baris);

  // confirm() bawaan browser sudah dibuang dari seluruh HRIS — pakai
  // konfirmasi bertema dari komponen Toast.
  const hapus = async (t: BarisTransaksi) => {
    const ya = await toast.konfirmasi(
      `Hapus transaksi ${rp(t.amount)} (${t.category_name}, ${formatDate(t.occurred_on)})? Tindakan ini tidak bisa dibatalkan.`,
      { labelYa: 'Hapus', labelTidak: 'Batal' },
    );
    if (!ya) return;

    setSedangHapus(t.id);
    try {
      await hapusTransaksi(t.id);
      toast.sukses('Transaksi dihapus.');
      onBerubah();
    } catch (err: unknown) {
      toast.gagal(err instanceof Error ? err.message : 'Gagal menghapus transaksi.');
    }
    setSedangHapus('');
  };

  if (baris.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <p className="text-sm font-semibold text-gray-400">Belum ada transaksi</p>
        <p className="mt-1 text-[13px] text-gray-600">
          Tidak ada yang cocok dengan saringan saat ini.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
      <table className="tabel-baris-rapi w-full min-w-[760px] text-left text-[13.5px] text-gray-300">
        <thead className="bg-kartu-hover text-[11px] uppercase tracking-wider text-gray-400">
          <tr>
            <th className="rounded-tl-xl px-4 py-3 font-semibold whitespace-nowrap">Tanggal</th>
            <th className="px-4 py-3 font-semibold">Keterangan</th>
            <th className="px-4 py-3 font-semibold">Kategori</th>
            <th className="px-4 py-3 font-semibold">Akun</th>
            <th className="px-4 py-3 text-right font-semibold">Jumlah</th>
            <th className="rounded-tr-xl px-4 py-3" />
          </tr>
        </thead>

        <tbody>
          {baris.map((t) => (
            <tr key={t.id}>
              <td className="px-4 py-3 whitespace-nowrap text-gray-500">{formatDate(t.occurred_on)}</td>
              <td className="px-4 py-3 text-gray-200">{t.note || '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    t.kind === 'in'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {t.category_name}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">{t.account_name}</td>
              <td
                className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                  t.kind === 'in' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {t.kind === 'in' ? '+' : '\u2212'}{rp(t.amount)}
              </td>
              <td className="px-4 py-3 text-right">
                {bisaTulis && (
                  <button
                    type="button"
                    onClick={() => hapus(t)}
                    disabled={sedangHapus === t.id}
                    title="Hapus transaksi"
                    className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 px-4 py-3">
        <span className="text-[12px] text-gray-500">
          {baris.length} baris · masuk{' '}
          <span className="font-semibold text-green-400">{rp(total.masuk)}</span> · keluar{' '}
          <span className="font-semibold text-red-400">{rp(total.keluar)}</span>
        </span>
        <span className="text-[13px] font-bold text-white">
          Selisih: {rp(total.bersih)}
        </span>
      </div>
    </div>
  );
}
