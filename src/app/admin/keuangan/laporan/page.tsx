// src/app/admin/keuangan/laporan/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
// FileText & Download dipilih karena sudah terbukti dipakai di berkas
// lain proyek ini. `Printer` belum pernah dipakai, jadi keberadaannya di
// versi lucide yang terpasang tidak bisa dibuktikan tanpa npm install.
import { Download, FileText } from 'lucide-react';
import LoadingLogo from '@/components/LoadingLogo';
import { useToast } from '@/components/Toast';
import PemilihPeriode from '@/components/keuangan/PemilihPeriode';
import TabelLaporan from '@/components/keuangan/TabelLaporan';
import { cetakLaporan, unduhBerkas } from '@/lib/keuangan/cetak';
import { ambilKategori, transaksiBulan } from '@/lib/keuangan/data';
import { shiftPeriod, toPeriod, todayISO } from '@/lib/keuangan/format';
import { csvRekap, ringkasLaporan, susunLaporan } from '@/lib/keuangan/laporan';
import type { BarisTransaksi, Kategori } from '@/lib/keuangan/tipe';

export default function KeuanganLaporanPage() {
  const toast = useToast();
  const [periode, setPeriode] = useState(toPeriod(todayISO()));

  const [kategori, setKategori] = useState<Kategori[]>([]);
  const [kini, setKini] = useState<BarisTransaksi[]>([]);
  const [lalu, setLalu] = useState<BarisTransaksi[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [k, a, b] = await Promise.all([
        ambilKategori(),
        transaksiBulan(periode),
        transaksiBulan(shiftPeriod(periode, -1)),
      ]);
      setKategori(k); setKini(a); setLalu(b);
      setGalat('');
    } catch (e: unknown) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
    setMemuat(false);
  }, [periode]);

  useEffect(() => { muat(); }, [muat]);

  const laporan = susunLaporan(kategori, kini, lalu);
  const kosong = kini.length === 0 && lalu.length === 0;

  const ekspor = () => {
    if (!kini.length) {
      toast.info('Belum ada transaksi di bulan ini untuk diekspor.');
      return;
    }
    unduhBerkas(`rekap-keuangan-${periode}.csv`, csvRekap(kini, periode));
    toast.sukses(`CSV rekap ${periode} terunduh.`);
  };

  const cetak = () => {
    if (kosong) {
      toast.info('Belum ada data untuk dicetak.');
      return;
    }
    const berhasil = cetakLaporan(laporan, periode);
    if (!berhasil) {
      toast.gagal('Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini, lalu coba lagi.');
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Laporan</h1>
          <p className="mt-1 text-sm text-gray-400">
            Rekapitulasi per pos, dibandingkan dengan bulan sebelumnya.
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
        <div className="flex min-h-[35vh] items-center justify-center">
          <LoadingLogo size={42} text="Menyusun laporan" />
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={ekspor}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-[13px] font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Download size={14} /> Ekspor CSV
            </button>

            <button
              type="button"
              onClick={cetak}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3.5 py-2 text-[13px] font-semibold text-gray-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              <FileText size={14} /> Cetak / PDF
            </button>

            {!kosong && (
              <span className="ml-auto text-[12px] text-gray-500">{ringkasLaporan(laporan)}</span>
            )}
          </div>

          <TabelLaporan laporan={laporan} kosong={kosong} />

          <p className="mt-3 text-[12px] leading-relaxed text-gray-500">
            Selisih dihitung terhadap bulan sebelumnya. Persentase pengeluaran dihitung
            dari total pengeluaran bulan berjalan. Pos tanpa angka di kedua bulan tidak
            ditampilkan. Hasil cetak sengaja berlatar terang agar terbaca di kertas.
          </p>
        </>
      )}
    </div>
  );
}
