// src/app/admin/keuangan/kategori/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import LoadingLogo from '@/components/LoadingLogo';
import KelolaKategori from '@/components/keuangan/KelolaKategori';
import { ambilKategori } from '@/lib/keuangan/data';
import { useKeuangan } from '@/lib/keuangan/konteks';
import type { Kategori } from '@/lib/keuangan/tipe';

export default function KeuanganKategoriPage() {
  const { bisaTulis } = useKeuangan();
  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setKategori(await ambilKategori());
      setGalat('');
    } catch (e: unknown) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
    setMemuat(false);
  }, []);

  useEffect(() => { muat(); }, [muat]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Kategori</h1>
        <p className="mt-1 text-sm text-gray-400">
          Pengelompokan pemasukan dan pengeluaran. Kategori yang sudah dipakai
          transaksi tidak bisa dihapus.
        </p>
      </div>

      {galat && (
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4">
          <p className="text-[13px] text-red-200">{galat}</p>
        </div>
      )}

      {memuat ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <LoadingLogo size={40} text="Memuat kategori" />
        </div>
      ) : (
        <KelolaKategori kategori={kategori} bisaTulis={bisaTulis} onBerubah={muat} />
      )}
    </div>
  );
}
