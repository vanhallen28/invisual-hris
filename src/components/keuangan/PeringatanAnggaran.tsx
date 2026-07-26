// src/components/keuangan/PeringatanAnggaran.tsx
'use client';

import { rp } from '@/lib/keuangan/format';
import type { StatusAnggaran } from '@/lib/keuangan/tipe';

export default function PeringatanAnggaran({ item }: { item: StatusAnggaran[] }) {
  const kritis = item.filter((b) => b.tingkat !== 'ok');

  if (!kritis.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-6 text-center">
        <p className="text-sm font-semibold text-green-400">Semua anggaran aman ✓</p>
        <p className="mt-1 text-[13px] text-gray-500">
          Tidak ada kategori yang melewati 80% dari batasnya.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {kritis.map((b) => {
        const lewat = b.tingkat === 'over';
        return (
          <div
            key={b.kategoriId}
            className={`flex items-start gap-3 rounded-xl border border-l-[3px] px-4 py-3 text-[13.5px] ${
              lewat
                ? 'border-white/10 border-l-red-400 bg-red-500/10'
                : 'border-white/10 border-l-amber-400 bg-amber-500/10'
            }`}
          >
            <span
              className={`shrink-0 pt-0.5 text-[10px] font-bold uppercase tracking-wider ${
                lewat ? 'text-red-400' : 'text-amber-400'
              }`}
            >
              {lewat ? 'lewat' : 'waspada'}
            </span>
            <div className="text-gray-300">
              <b className="text-white">{b.nama}</b> — {rp(b.terpakai)} dari anggaran{' '}
              {rp(b.anggaran)} ({Math.round(b.persen)}%)
              {lewat && (
                <div className="text-gray-500">Kelebihan {rp(b.terpakai - b.anggaran)}.</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
