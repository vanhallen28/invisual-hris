// src/lib/gabungMuat.ts
// Menggabungkan permintaan data IDENTIK yang terjadi bersamaan (mis. dua komponen di
// halaman yang sama memuat daftar hari libur yang sama) menjadi satu permintaan.
// `umurMs` > 0 → hasil juga disimpan sebentar; 0 → hanya selama permintaan berjalan.
// Disimpan per klien Supabase (WeakMap), jadi uji dengan klien tiruan tidak saling bocor.
type Entri = { janji: Promise<unknown>; kedaluwarsa: number };
const simpanan = new WeakMap<object, Map<string, Entri>>();

export function gabungMuat<T>(pemilik: object, kunci: string, muat: () => Promise<T>, umurMs = 0): Promise<T> {
  let peta = simpanan.get(pemilik);
  if (!peta) { peta = new Map(); simpanan.set(pemilik, peta); }
  const kini = Date.now();
  const ada = peta.get(kunci);
  if (ada && (ada.kedaluwarsa === Infinity || ada.kedaluwarsa > kini)) return ada.janji as Promise<T>;
  const entri: Entri = { janji: Promise.resolve(), kedaluwarsa: Infinity };   // Infinity = masih berjalan
  const janji = muat().then(
    (v) => { if (peta!.get(kunci) === entri) { if (umurMs > 0) entri.kedaluwarsa = Date.now() + umurMs; else peta!.delete(kunci); } return v; },
    (e) => { if (peta!.get(kunci) === entri) peta!.delete(kunci); throw e; },
  );
  entri.janji = janji;
  peta.set(kunci, entri);
  return janji;
}

/** Lupakan simpanan berawalan `awalan` (dipanggil setelah data diubah). */
export function lupakanMuat(pemilik: object, awalan: string): void {
  const peta = simpanan.get(pemilik);
  if (!peta) return;
  for (const k of [...peta.keys()]) if (k.startsWith(awalan)) peta.delete(k);
}
