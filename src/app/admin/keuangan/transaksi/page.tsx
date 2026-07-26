// src/app/admin/keuangan/transaksi/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import LoadingLogo from '@/components/LoadingLogo';
import FilterTransaksi, { type NilaiSaringan } from '@/components/keuangan/FilterTransaksi';
import FormTransaksi from '@/components/keuangan/FormTransaksi';
import TabelTransaksi from '@/components/keuangan/TabelTransaksi';
import { ambilAkun, ambilKategori, cariTransaksi } from '@/lib/keuangan/data';
import { todayISO, toPeriod } from '@/lib/keuangan/format';
import { useKeuangan } from '@/lib/keuangan/konteks';
import type { Akun, BarisTransaksi, Kategori } from '@/lib/keuangan/tipe';

export default function KeuanganTransaksiPage() {
  const { bisaTulis } = useKeuangan();

  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [akun, setAkun] = useState<Akun[]>([]);
  const [baris, setBaris] = useState<BarisTransaksi[]>([]);

  const [memuatMaster, setMemuatMaster] = useState(true);
  const [memuatBaris, setMemuatBaris] = useState(true);
  const [galat, setGalat] = useState('');

  const [saring, setSaring] = useState<NilaiSaringan>({
    periode: toPeriod(todayISO()),
    semuaBulan: false,
    jenis: '',
    kategoriId: '',
    cari: '',
  });

  // Master (kategori + akun) hanya perlu diambil sekali.
  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const [k, a] = await Promise.all([ambilKategori(), ambilAkun()]);
        if (!hidup) return;
        setKategori(k);
        setAkun(a);
      } catch (e: unknown) {
        if (hidup) setGalat(e instanceof Error ? e.message : String(e));
      } finally {
        if (hidup) setMemuatMaster(false);
      }
    })();
    return () => { hidup = false; };
  }, []);

  // Daftar transaksi ikut berubah setiap saringan berubah.
  const muatBaris = useCallback(async () => {
    setMemuatBaris(true);
    try {
      const data = await cariTransaksi({
        periode: saring.semuaBulan ? undefined : saring.periode,
        jenis: saring.jenis || undefined,
        kategoriId: saring.kategoriId || undefined,
        cari: saring.cari.trim() || undefined,
      });
      setBaris(data);
      setGalat('');
    } catch (e: unknown) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
    setMemuatBaris(false);
  }, [saring]);

  useEffect(() => { muatBaris(); }, [muatBaris]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-white">Transaksi</h1>
        <p className="mt-1 text-sm text-gray-400">
          Catatan pemasukan dan pengeluaran perusahaan.
        </p>
      </div>

      {galat && (
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 p-4">
          <p className="text-[13px] text-red-200">{galat}</p>
        </div>
      )}

      {memuatMaster ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <LoadingLogo size={40} text="Memuat kategori & akun" />
        </div>
      ) : (
        <>
          <FormTransaksi
            kategori={kategori}
            akun={akun}
            bisaTulis={bisaTulis}
            onTersimpan={muatBaris}
          />

          <div className="mt-7">
            <FilterTransaksi kategori={kategori} nilai={saring} onUbah={setSaring} />

            {memuatBaris ? (
              <div className="flex min-h-[25vh] items-center justify-center">
                <LoadingLogo size={36} text="Memuat transaksi" />
              </div>
            ) : (
              <TabelTransaksi baris={baris} bisaTulis={bisaTulis} onBerubah={muatBaris} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
