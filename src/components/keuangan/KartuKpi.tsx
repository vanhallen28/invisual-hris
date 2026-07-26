// src/components/keuangan/KartuKpi.tsx
'use client';

import { rp } from '@/lib/keuangan/format';

type Warna = 'masuk' | 'keluar' | 'bersih' | 'netral';

const WARNA_NILAI: Record<Warna, string> = {
  masuk: 'text-green-400',
  keluar: 'text-red-400',
  bersih: 'text-tint',
  netral: 'text-white',
};

export default function KartuKpi({
  label,
  nilai,
  warna = 'netral',
  kaki,
}: {
  label: string;
  nilai: number;
  warna?: Warna;
  kaki?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-1.5 text-2xl font-black ${WARNA_NILAI[warna]}`}>{rp(nilai)}</p>
      {kaki && <p className="mt-1 text-[11px] text-gray-500">{kaki}</p>}
    </div>
  );
}
