// src/components/keuangan/GrafikTren.tsx
'use client';

import { periodLabel, periodShortLabel, rp, rpShort } from '@/lib/keuangan/format';
import type { TitikTren } from '@/lib/keuangan/tipe';

/**
 * Grafik batang berkelompok, SVG murni — tanpa pustaka grafik.
 * Warnanya memakai utilitas Tailwind fill- dan stroke-, bukan hex mentah,
 * supaya ikut berubah kalau palet diubah.
 */
export default function GrafikTren({ data }: { data: TitikTren[] }) {
  const L = 600;
  const T = 230;
  const tepi = 10;
  const atas = 16;
  const tinggiPlot = T - 42 - atas;
  const lebarGrup = (L - tepi * 2) / Math.max(data.length, 1);

  const maks = Math.max(1, ...data.map((d) => Math.max(d.masuk, d.keluar)));

  return (
    <svg
      viewBox={`0 0 ${L} ${T}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Tren pemasukan dan pengeluaran enam bulan terakhir"
    >
      {[0, 1, 2, 3].map((g) => (
        <line
          key={g}
          x1={tepi}
          x2={L - tepi}
          y1={atas + tinggiPlot * (g / 3)}
          y2={atas + tinggiPlot * (g / 3)}
          className="stroke-white/[0.06]"
          strokeWidth={1}
        />
      ))}

      {data.map((d, i) => {
        const tengah = tepi + lebarGrup * i + lebarGrup / 2;
        const lebar = Math.min(26, lebarGrup / 2.6);
        const tMasuk = (d.masuk / maks) * tinggiPlot;
        const tKeluar = (d.keluar / maks) * tinggiPlot;
        const bersih = d.masuk - d.keluar;

        return (
          <g key={d.periode}>
            <rect
              x={tengah - lebar - 3}
              y={atas + tinggiPlot - tMasuk}
              width={lebar}
              height={tMasuk}
              rx={2}
              className="fill-green-400/80"
            >
              <title>{`${periodLabel(d.periode)} — masuk ${rp(d.masuk)}`}</title>
            </rect>

            <rect
              x={tengah + 3}
              y={atas + tinggiPlot - tKeluar}
              width={lebar}
              height={tKeluar}
              rx={2}
              className="fill-red-400/80"
            >
              <title>{`${periodLabel(d.periode)} — keluar ${rp(d.keluar)}`}</title>
            </rect>

            <text
              x={tengah}
              y={atas + tinggiPlot + 18}
              textAnchor="middle"
              fontSize={11}
              className="fill-gray-500"
            >
              {periodShortLabel(d.periode)}
            </text>

            <text
              x={tengah}
              y={atas + tinggiPlot + 33}
              textAnchor="middle"
              fontSize={10}
              className={bersih >= 0 ? 'fill-green-400' : 'fill-red-400'}
            >
              {`${bersih >= 0 ? '+' : '\u2212'}${rpShort(bersih)}`}
            </text>
          </g>
        );
      })}

      <line
        x1={tepi}
        x2={L - tepi}
        y1={atas + tinggiPlot}
        y2={atas + tinggiPlot}
        className="stroke-white/20"
        strokeWidth={1.5}
      />
    </svg>
  );
}
