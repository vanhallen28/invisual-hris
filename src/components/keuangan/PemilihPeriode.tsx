// src/components/keuangan/PemilihPeriode.tsx
'use client';

import { periodLabel, shiftPeriod, toPeriod, todayISO } from '@/lib/keuangan/format';

type Props = { periode: string; onUbah: (p: string) => void };

export default function PemilihPeriode({ periode, onUbah }: Props) {
  const bulanIni = toPeriod(todayISO());

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-input">
        <button
          type="button"
          onClick={() => onUbah(shiftPeriod(periode, -1))}
          className="px-2.5 py-2 text-gray-400 transition-colors hover:text-white"
          aria-label="Bulan sebelumnya"
        >
          &lsaquo;
        </button>
        <span className="min-w-[110px] text-center text-[13px] font-semibold text-white">
          {periodLabel(periode)}
        </span>
        <button
          type="button"
          onClick={() => onUbah(shiftPeriod(periode, 1))}
          className="px-2.5 py-2 text-gray-400 transition-colors hover:text-white"
          aria-label="Bulan berikutnya"
        >
          &rsaquo;
        </button>
      </div>

      {periode !== bulanIni && (
        <button
          type="button"
          onClick={() => onUbah(bulanIni)}
          className="rounded-lg border border-white/10 px-3 py-2 text-[12px] font-semibold text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          Bulan ini
        </button>
      )}
    </div>
  );
}
