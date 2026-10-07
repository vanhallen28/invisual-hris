"use client";
// Cangkang kartu anomali Kehadiran yang bisa dilipat. Kelas luar SAMA dengan kartu
// lama (warna/sudut/glow) supaya tampilan saat terbuka tidak berubah. Keadaan lipat
// diingat per perangkat (localStorage, lib/kehadiranKartu). Bawaan: terbuka.
//
// Sumber kebenaran = cache di memori modul (dihidrasi dari localStorage sekali);
// localStorage hanya persistensi usaha-terbaik, jadi klik tetap bekerja walau
// storage diblokir (mode privat / kuota). Dibaca lewat useSyncExternalStore: saat
// hidrasi dipakai nilai server (terbuka) agar HTML server & klien sama, lalu React
// merender ulang dengan nilai tersimpan.
//
// Aksesibilitas: judul tetap <h2> di luar tombol (tetap terbaca sebagai heading);
// tombol chevron membawa aria-expanded/aria-controls; seluruh kepala kartu bisa
// diklik dengan tetikus. Isi yang melebar ada di aliran dokumen biasa (bukan
// fixed/absolute) sehingga aman di dalam kartu ber-hover:-translate-y.
import { useSyncExternalStore, type ReactNode } from "react";
import { bacaLipat, tulisLipat, type IdKartu } from "@/lib/kehadiranKartu";

const NADA = {
  kuning: { hover: "hover:border-yellow-500/30", blur: "bg-yellow-500/10", ikon: "bg-yellow-500/10 text-yellow-500" },
  merah:  { hover: "hover:border-red-500/30",    blur: "bg-red-500/10",    ikon: "bg-red-500/10 text-red-500" },
  hijau:  { hover: "hover:border-green-500/30",  blur: "bg-green-500/10",  ikon: "bg-green-500/10 text-green-500" },
} as const;

// Cache keadaan lipat (satu untuk semua kartu di halaman) + pendengar perubahan.
let cache: Partial<Record<IdKartu, boolean>> | null = null;
const bacaCache = () => (cache ??= bacaLipat());
const pendengar = new Set<() => void>();
const berlangganan = (cb: () => void) => { pendengar.add(cb); return () => { pendengar.delete(cb); }; };
const snapshotServer = () => false;

export default function KartuLipat({ id, judul, sub, ikon, nada, ringkas, children }: {
  id: IdKartu;
  judul: string;
  sub: string;
  ikon: ReactNode;
  nada: keyof typeof NADA;
  /** Teks singkat saat terlipat, mis. "5 orang" / "3 sesi". */
  ringkas: string;
  children: ReactNode;
}) {
  const terlipat = useSyncExternalStore(berlangganan, () => bacaCache()[id] === true, snapshotServer);
  const n = NADA[nada];
  const idIsi = `kartu-${id}-isi`;
  const ubah = () => {
    const v = !terlipat;
    cache = { ...bacaCache(), [id]: v };
    tulisLipat(id, v);
    pendengar.forEach((cb) => cb());
  };
  return (
    <div data-kartu={id} className={`p-6 relative overflow-hidden group ${n.hover} transition-all rounded-xl border border-white/10 bg-white/[0.03] duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow`}>
      <div className={`absolute -right-10 -top-10 w-32 h-32 ${n.blur} rounded-full blur-3xl`}></div>
      <div
        onClick={ubah}
        className={`flex items-center gap-3 relative z-10 cursor-pointer select-none ${terlipat ? "" : "mb-5 border-b border-white/5 pb-4"}`}
        title={terlipat ? "Buka kartu" : "Lipat kartu"}
      >
        <div className={`w-10 h-10 rounded-full ${n.ikon} flex items-center justify-center shrink-0`}>{ikon}</div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-white text-sm">{judul}</h2>
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">{sub}</p>
        </div>
        {terlipat && <span className="text-xs text-gray-400 shrink-0">{ringkas}</span>}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); ubah(); }}
          aria-expanded={!terlipat}
          aria-controls={terlipat ? undefined : idIsi}
          aria-label={`${terlipat ? "Buka" : "Lipat"} kartu ${judul}`}
          className="w-7 h-7 -mr-1 rounded-lg flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 shrink-0"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            className={`w-4 h-4 transition-transform duration-300 ${terlipat ? "" : "rotate-180"}`} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>
      {!terlipat && <div id={idIsi} className="space-y-3 relative z-10">{children}</div>}
    </div>
  );
}
