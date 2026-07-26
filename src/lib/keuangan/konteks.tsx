// src/lib/keuangan/konteks.tsx
//
// Peran keuangan dibaca SEKALI di layout, lalu dibagikan ke semua halaman
// lewat context. Tanpa ini, setiap halaman akan menanyakan peran sendiri
// ke database setiap kali dibuka.

'use client';

import { createContext, useContext, useMemo } from 'react';
import { bolehAturAkses, bolehTulis, type PeranKeuangan } from '@/lib/keuangan/klien';

type IsiKonteks = {
  peran: PeranKeuangan;
  /** admin & finance boleh mencatat transaksi, mengatur anggaran/kategori. */
  bisaTulis: boolean;
  /** Hanya admin yang boleh mengubah daftar siapa yang punya akses. */
  bisaAturAkses: boolean;
};

const Konteks = createContext<IsiKonteks | null>(null);

export function KeuanganProvider({
  peran,
  children,
}: {
  peran: PeranKeuangan;
  children: React.ReactNode;
}) {
  // useMemo supaya identitas objeknya tetap. Nilai context yang berganti
  // identitas tiap render pernah memicu gelung tak berujung di modul Chat —
  // jangan diulang di sini.
  const nilai = useMemo<IsiKonteks>(
    () => ({
      peran,
      bisaTulis: bolehTulis(peran),
      bisaAturAkses: bolehAturAkses(peran),
    }),
    [peran],
  );

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

export function useKeuangan(): IsiKonteks {
  const v = useContext(Konteks);
  if (!v) throw new Error('useKeuangan() dipakai di luar KeuanganProvider.');
  return v;
}
