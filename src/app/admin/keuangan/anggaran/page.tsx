// src/app/admin/keuangan/anggaran/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import LoadingLogo from '@/components/LoadingLogo';
import FormAnggaran from '@/components/keuangan/FormAnggaran';
import PemilihPeriode from '@/components/keuangan/PemilihPeriode';
import PeringatanAnggaran from '@/components/keuangan/PeringatanAnggaran';
import {
  ambilAnggaran, ambilKategori, statusAnggaran, transaksiBulan,
} from '@/lib/keuangan/data';
import { toPeriod, todayISO } from '@/lib/keuangan/format';
import { useKeuangan } from '@/lib/keuangan/konteks';
import type { Anggaran, BarisTransaksi, Kategori } from '@/lib/keuangan/tipe';

export default function KeuanganAnggaranPage() {
  const { bisaTulis } = useKeuangan();
  const [periode, setPeriode] = useState(toPeriod(todayISO()));

  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [anggaran, setAnggaran] = useState<Anggaran[]>([]);
  const [baris, setBaris] = useState<BarisTransaksi[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [k, a, b] = await Promise.all([
        ambilKategori(),
        ambilAnggaran(),
        transaksiBulan(periode),
      ]);
      setKategori(k); setAnggaran(a); setBaris(b);
      setGalat('');
    } catch (e: unknown) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
    setMemuat(false);
  }, [periode]);

  useEffect(() => { muat(); }, [muat]);

  const pengeluaran = kategori.filter((k) => k.kind === 'out');
  const status = statusAnggaran(baris, anggaran, kategori);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Anggaran</h1>
          <p className="mt-1 text-sm text-gray-400">
            Batas belanja bulanan per kategori pengeluaran.
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
        <div className="flex min-h-[30vh] items-center justify-center">
          <LoadingLogo size={40} text="Memuat anggaran" />
        </div>
      ) : (
        <>
          <section className="mb-7">
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Realisasi bulan terpilih
            </h2>
            <PeringatanAnggaran item={status} />
          </section>

          <FormAnggaran
            kategori={pengeluaran}
            anggaran={anggaran}
            bisaTulis={bisaTulis}
            onTersimpan={muat}
          />
        </>
      )}
    </div>
  );
}
