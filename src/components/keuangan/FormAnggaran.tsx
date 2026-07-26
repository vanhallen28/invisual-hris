// src/components/keuangan/FormAnggaran.tsx
'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { simpanAnggaran } from '@/lib/keuangan/data';
import { digits, groupDigits, rp } from '@/lib/keuangan/format';
import type { Anggaran, Kategori } from '@/lib/keuangan/tipe';

type Props = {
  kategori: Kategori[];      // hanya kategori pengeluaran
  anggaran: Anggaran[];
  bisaTulis: boolean;
  onTersimpan: () => void;
};

export default function FormAnggaran({ kategori, anggaran, bisaTulis, onTersimpan }: Props) {
  const toast = useToast();
  const [teks, setTeks] = useState<Record<string, string>>({});
  const [menyimpan, setMenyimpan] = useState(false);

  // Isian disusun ulang setiap data anggaran berubah, supaya setelah
  // menyimpan yang tampil adalah nilai dari database, bukan sisa ketikan.
  useEffect(() => {
    const awal = new Map(anggaran.map((a) => [a.category_id, a.amount_monthly]));
    const out: Record<string, string> = {};
    for (const k of kategori) {
      const v = awal.get(k.id);
      out[k.id] = v ? v.toLocaleString('id-ID') : '';
    }
    setTeks(out);
  }, [kategori, anggaran]);

  const totalAnggaran = kategori.reduce((a, k) => a + digits(teks[k.id] ?? ''), 0);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (menyimpan) return;

    const peta: Record<string, number> = {};
    for (const k of kategori) peta[k.id] = digits(teks[k.id] ?? '');

    setMenyimpan(true);
    try {
      const jumlah = await simpanAnggaran(peta);
      toast.sukses(`Anggaran disimpan untuk ${jumlah} kategori.`);
      onTersimpan();
    } catch (err: unknown) {
      toast.gagal(err instanceof Error ? err.message : 'Gagal menyimpan anggaran.');
    }
    setMenyimpan(false);
  };

  return (
    <form
      onSubmit={kirim}
      className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 kartu-glow"
    >
      <p className="mb-4 text-[13px] leading-relaxed text-gray-400">
        Batas belanja per bulan, berlaku berulang tiap bulan. Kosongkan atau isi 0
        untuk kategori tanpa anggaran. Peringatan muncul saat realisasi mencapai 80%.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kategori.map((k) => (
          <div key={k.id}>
            <label
              className="text-[11px] font-bold uppercase tracking-wider text-gray-500"
              htmlFor={`anggaran-${k.id}`}
            >
              {k.name}
            </label>
            <input
              id={`anggaran-${k.id}`}
              type="text"
              inputMode="numeric"
              placeholder="0"
              disabled={!bisaTulis}
              value={teks[k.id] ?? ''}
              onChange={(e) =>
                setTeks((s) => ({ ...s, [k.id]: groupDigits(e.target.value) }))
              }
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-input px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder-gray-600 focus:border-primer disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/10 pt-4">
        {bisaTulis && (
          <button
            type="submit"
            disabled={menyimpan}
            className="rounded-lg bg-primer px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primer-terang disabled:opacity-50"
          >
            {menyimpan ? 'Menyimpan…' : 'Simpan Anggaran'}
          </button>
        )}
        <span className="text-[13px] text-gray-400">
          Total anggaran sebulan:{' '}
          <span className="font-bold text-white">{rp(totalAnggaran)}</span>
        </span>
      </div>
    </form>
  );
}
