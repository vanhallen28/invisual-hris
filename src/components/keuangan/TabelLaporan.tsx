// src/components/keuangan/TabelLaporan.tsx
'use client';

import { rp } from '@/lib/keuangan/format';
import type { Laporan } from '@/lib/keuangan/laporan';

export default function TabelLaporan({ laporan, kosong }: { laporan: Laporan; kosong: boolean }) {
  if (kosong) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center">
        <p className="text-sm font-semibold text-gray-400">Belum ada data untuk dilaporkan</p>
        <p className="mt-1 text-[13px] text-gray-600">
          Tidak ada transaksi di bulan ini maupun bulan sebelumnya.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
      <table className="w-full min-w-[720px] text-left text-[13.5px] text-gray-300">
        <thead className="bg-kartu-hover text-[11px] uppercase tracking-wider text-gray-400">
          <tr>
            <th className="rounded-tl-xl px-4 py-3 font-semibold">Pos</th>
            <th className="px-4 py-3 text-right font-semibold">Bulan Ini</th>
            <th className="px-4 py-3 text-right font-semibold">Bulan Lalu</th>
            <th className="px-4 py-3 text-right font-semibold">Selisih</th>
            <th className="rounded-tr-xl px-4 py-3 text-right font-semibold">% Total</th>
          </tr>
        </thead>

        <tbody>
          {laporan.baris.map((b, i) => {
            if (b.jenis === 'kepala') {
              return (
                <tr key={`k-${i}`}>
                  <td
                    colSpan={5}
                    className="px-4 pt-6 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500"
                  >
                    {b.label}
                  </td>
                </tr>
              );
            }

            const selisih = b.kini - b.lalu;
            const akhir = b.jenis === 'akhir';
            const tebal = akhir || b.jenis === 'total';

            return (
              <tr key={`b-${i}`} className={tebal ? 'border-t border-white/15' : ''}>
                <td
                  className={`px-4 py-2.5 ${tebal ? 'font-bold text-white' : 'pl-8 text-gray-300'} ${
                    akhir ? 'text-[15px]' : ''
                  }`}
                >
                  {b.label}
                </td>
                <td
                  className={`px-4 py-2.5 text-right whitespace-nowrap ${
                    tebal ? 'font-bold' : ''
                  } ${akhir ? (b.kini >= 0 ? 'text-green-400' : 'text-red-400') : 'text-gray-200'}`}
                >
                  {rp(b.kini)}
                </td>
                <td className="px-4 py-2.5 text-right whitespace-nowrap text-gray-500">
                  {rp(b.lalu)}
                </td>
                <td
                  className={`px-4 py-2.5 text-right whitespace-nowrap ${
                    selisih >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {selisih >= 0 ? '+' : '\u2212'}{rp(Math.abs(selisih))}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500">
                  {b.jenis === 'baris' && b.porsi !== null ? `${Math.round(b.porsi)}%` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
