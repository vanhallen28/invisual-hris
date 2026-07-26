// src/app/admin/keuangan/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import LoadingLogo from '@/components/LoadingLogo';
import BarKategori from '@/components/keuangan/BarKategori';
import GrafikTren from '@/components/keuangan/GrafikTren';
import KartuKpi from '@/components/keuangan/KartuKpi';
import PemilihPeriode from '@/components/keuangan/PemilihPeriode';
import PeringatanAnggaran from '@/components/keuangan/PeringatanAnggaran';
import {
  ambilAnggaran, ambilKategori, ambilTren, saldoKumulatif,
  statusAnggaran, totalDari, totalKategori, transaksiBulan, transaksiTerakhir,
} from '@/lib/keuangan/data';
import { formatDate, pctChange, rp, shiftPeriod, toPeriod, todayISO } from '@/lib/keuangan/format';
import type {
  Anggaran, BarisTransaksi, Kategori, TitikTren,
} from '@/lib/keuangan/tipe';

function Perubahan({ kini, lalu, terbalik }: { kini: number; lalu: number; terbalik?: boolean }) {
  const d = pctChange(kini, lalu);
  if (d === null) return <span className="text-gray-600">bulan lalu belum ada data</span>;
  const bagus = terbalik ? d <= 0 : d >= 0;
  return (
    <>
      <span className={bagus ? 'text-green-400' : 'text-red-400'}>
        {d >= 0 ? 'naik' : 'turun'} {Math.abs(Math.round(d))}%
      </span>{' '}
      vs bulan lalu
    </>
  );
}

export default function KeuanganRingkasanPage() {
  const [periode, setPeriode] = useState(toPeriod(todayISO()));

  const [kini, setKini] = useState<BarisTransaksi[]>([]);
  const [lalu, setLalu] = useState<BarisTransaksi[]>([]);
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [anggaran, setAnggaran] = useState<Anggaran[]>([]);
  const [tren, setTren] = useState<TitikTren[]>([]);
  const [terakhir, setTerakhir] = useState<BarisTransaksi[]>([]);
  const [saldo, setSaldo] = useState(0);

  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [a, b, c, d, e, f, g] = await Promise.all([
        transaksiBulan(periode),
        transaksiBulan(shiftPeriod(periode, -1)),
        ambilKategori(),
        ambilAnggaran(),
        ambilTren(periode, 6),
        transaksiTerakhir(8),
        saldoKumulatif(periode),
      ]);
      setKini(a); setLalu(b); setKategori(c);
      setAnggaran(d); setTren(e); setTerakhir(f); setSaldo(g);
      setGalat('');
    } catch (err: unknown) {
      setGalat(err instanceof Error ? err.message : String(err));
    }
    setMemuat(false);
  }, [periode]);

  useEffect(() => { muat(); }, [muat]);

  const t = totalDari(kini);
  const tl = totalDari(lalu);
  const status = statusAnggaran(kini, anggaran, kategori);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Ringkasan</h1>
          <p className="mt-1 text-sm text-gray-400">
            Keuangan perusahaan bulan berjalan.
          </p>
        </div>
        <PemilihPeriode periode={periode} onUbah={setPeriode} />
      </div>

      {galat && (
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4">
          <p className="text-[13px] text-red-200">{galat}</p>
        </div>
      )}

      {memuat ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingLogo size={44} text="Menghitung ringkasan" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KartuKpi label="Pemasukan" nilai={t.masuk} warna="masuk"
              kaki={<Perubahan kini={t.masuk} lalu={tl.masuk} />} />
            <KartuKpi label="Pengeluaran" nilai={t.keluar} warna="keluar"
              kaki={<Perubahan kini={t.keluar} lalu={tl.keluar} terbalik />} />
            <KartuKpi label="Laba / Rugi" nilai={t.bersih} warna={t.bersih >= 0 ? 'masuk' : 'keluar'}
              kaki={t.masuk > 0 ? `Margin ${Math.round((t.bersih / t.masuk) * 100)}%` : '—'} />
            <KartuKpi label="Saldo Kumulatif" nilai={saldo} warna="bersih"
              kaki="seluruh transaksi s/d akhir periode" />
          </div>

          <section className="mt-7">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Peringatan Anggaran
            </h2>
            <PeringatanAnggaran item={status} />
          </section>

          <section className="mt-7 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_1fr]">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] kartu-glow">
              <h2 className="px-5 pt-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Tren 6 Bulan
              </h2>
              <div className="px-2">
                <GrafikTren data={tren} />
              </div>
              <div className="flex gap-4 px-5 pb-4 text-[11.5px] text-gray-400">
                <span className="inline-flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 rounded-[2px] bg-green-400/80" />Pemasukan
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="inline-block h-2.5 w-2.5 rounded-[2px] bg-red-400/80" />Pengeluaran
                </span>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] kartu-glow">
              <h2 className="px-5 pt-5 pb-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Pengeluaran per Kategori
              </h2>
              <BarKategori item={totalKategori(kini, 'out')} />
            </div>
          </section>

          <section className="mt-7">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Transaksi Terakhir
            </h2>

            {terakhir.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center">
                <p className="text-sm font-semibold text-gray-400">Belum ada transaksi</p>
                <p className="mt-1 text-[13px] text-gray-600">
                  Buka tab{' '}
                  <Link href="/admin/keuangan/transaksi" className="text-tint hover:underline">
                    Transaksi
                  </Link>{' '}
                  untuk mulai mencatat.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03]">
                <table className="tabel-baris-rapi w-full min-w-[680px] text-left text-[13.5px] text-gray-300">
                  <thead className="bg-kartu-hover text-[11px] uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="rounded-tl-xl px-4 py-3 font-semibold">Tanggal</th>
                      <th className="px-4 py-3 font-semibold">Keterangan</th>
                      <th className="px-4 py-3 font-semibold">Kategori</th>
                      <th className="px-4 py-3 font-semibold">Akun</th>
                      <th className="rounded-tr-xl px-4 py-3 text-right font-semibold">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {terakhir.map((x) => (
                      <tr key={x.id}>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">{formatDate(x.occurred_on)}</td>
                        <td className="px-4 py-3 text-gray-200">{x.note || '—'}</td>
                        <td className="px-4 py-3 text-gray-400">{x.category_name}</td>
                        <td className="px-4 py-3 text-gray-500">{x.account_name}</td>
                        <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                          x.kind === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                          {x.kind === 'in' ? '+' : '\u2212'}{rp(x.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
