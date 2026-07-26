// src/components/keuangan/FilterTransaksi.tsx
'use client';

import { useEffect, useState } from 'react';
import { periodLabel, shiftPeriod } from '@/lib/keuangan/format';
import type { Jenis, Kategori } from '@/lib/keuangan/tipe';

export type NilaiSaringan = {
  periode: string;      // "2026-07"
  semuaBulan: boolean;
  jenis: '' | Jenis;
  kategoriId: string;
  cari: string;
};

type Props = {
  kategori: Kategori[];
  nilai: NilaiSaringan;
  onUbah: (n: NilaiSaringan) => void;
};

const KELAS =
  'rounded-lg border border-white/10 bg-input px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-primer';

export default function FilterTransaksi({ kategori, nilai, onUbah }: Props) {
  // Kotak cari ditahan sebentar sebelum menembak query, supaya tidak
  // memanggil database di setiap ketukan tombol.
  const [teksCari, setTeksCari] = useState(nilai.cari);

  useEffect(() => { setTeksCari(nilai.cari); }, [nilai.cari]);

  useEffect(() => {
    if (teksCari === nilai.cari) return;
    const t = setTimeout(() => onUbah({ ...nilai, cari: teksCari }), 400);
    return () => clearTimeout(t);
  }, [teksCari]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {!nilai.semuaBulan && (
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-input">
          <button
            type="button"
            onClick={() => onUbah({ ...nilai, periode: shiftPeriod(nilai.periode, -1) })}
            className="px-2.5 py-2 text-gray-400 transition-colors hover:text-white"
            aria-label="Bulan sebelumnya"
          >
            ‹
          </button>
          <span className="min-w-[110px] text-center text-[13px] font-semibold text-white">
            {periodLabel(nilai.periode)}
          </span>
          <button
            type="button"
            onClick={() => onUbah({ ...nilai, periode: shiftPeriod(nilai.periode, 1) })}
            className="px-2.5 py-2 text-gray-400 transition-colors hover:text-white"
            aria-label="Bulan berikutnya"
          >
            ›
          </button>
        </div>
      )}

      <select
        className={KELAS}
        value={nilai.semuaBulan ? '1' : ''}
        onChange={(e) => onUbah({ ...nilai, semuaBulan: e.target.value === '1' })}
      >
        <option value="" className="bg-kartu">Periode terpilih</option>
        <option value="1" className="bg-kartu">Semua bulan</option>
      </select>

      <select
        className={KELAS}
        value={nilai.jenis}
        onChange={(e) => onUbah({ ...nilai, jenis: e.target.value as '' | Jenis })}
      >
        <option value="" className="bg-kartu">Semua jenis</option>
        <option value="in" className="bg-kartu">Pemasukan</option>
        <option value="out" className="bg-kartu">Pengeluaran</option>
      </select>

      <select
        className={KELAS}
        value={nilai.kategoriId}
        onChange={(e) => onUbah({ ...nilai, kategoriId: e.target.value })}
      >
        <option value="" className="bg-kartu">Semua kategori</option>
        {kategori.map((k) => (
          <option key={k.id} value={k.id} className="bg-kartu">{k.name}</option>
        ))}
      </select>

      <input
        type="search"
        placeholder="Cari keterangan…"
        value={teksCari}
        onChange={(e) => setTeksCari(e.target.value)}
        className={`${KELAS} placeholder-gray-600`}
      />
    </div>
  );
}
