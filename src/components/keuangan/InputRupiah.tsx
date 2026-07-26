// src/components/keuangan/InputRupiah.tsx
'use client';

import { digits, groupDigits, rp } from '@/lib/keuangan/format';

type Props = {
  nilai: number;
  onUbah: (n: number) => void;
  id?: string;
};

/** Input rupiah dengan pemisah ribuan otomatis saat diketik. */
export default function InputRupiah({ nilai, onUbah, id }: Props) {
  const teks = nilai ? nilai.toLocaleString('id-ID') : '';

  return (
    <div>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder="0"
        value={teks}
        onChange={(e) => onUbah(digits(groupDigits(e.target.value)))}
        className="w-full rounded-lg border border-white/10 bg-input px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder-gray-600 focus:border-primer"
      />
      {nilai > 0 && <p className="mt-1 text-[11.5px] text-gray-500">{rp(nilai)}</p>}
    </div>
  );
}
