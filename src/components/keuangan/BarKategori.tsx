// src/components/keuangan/BarKategori.tsx
'use client';

import { rp } from '@/lib/keuangan/format';
import type { TotalKategori } from '@/lib/keuangan/tipe';

export default function BarKategori({ item }: { item: TotalKategori[] }) {
  if (!item.length) {
    return (
      <p className="px-5 py-8 text-center text-sm text-gray-500">
        Belum ada pengeluaran di periode ini.
      </p>
    );
  }

  const total = item.reduce((a, i) => a + i.total, 0);
  const maks = item[0].total;

  return (
    <div className="flex flex-col gap-3 px-5 pt-1 pb-5">
      {item.slice(0, 7).map((i) => (
        <div key={i.kategoriId}>
          <div className="mb-1.5 flex justify-between gap-3 text-[13px]">
            <span className="font-medium text-gray-200">{i.nama}</span>
            <span className="text-gray-500">
              {rp(i.total)} · {Math.round((i.total / total) * 100)}%
            </span>
          </div>
          <div className="h-[7px] overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-red-400/70"
              style={{ width: `${(i.total / maks) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
