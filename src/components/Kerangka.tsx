// src/components/Kerangka.tsx
// Kerangka (skeleton) pengganti spinner layar penuh: bentuk halaman tetap
// terlihat saat data dimuat, sehingga tidak ada "lompatan" tata letak.
// Murni tampilan — tidak memuat data apa pun.

export function KerangkaBaris({ lebar = "w-full", tinggi = "h-3.5", className = "" }: { lebar?: string; tinggi?: string; className?: string }) {
  return <span aria-hidden className={`block rounded-md bg-white/[0.07] animate-pulse ${lebar} ${tinggi} ${className}`} />;
}

/** Kerangka tabel/daftar: n baris berisi avatar bulat + dua garis teks + kapsul kanan. */
export function KerangkaTabel({ baris = 4, label = "Memuat data…" }: { baris?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="flex flex-col gap-3" data-kerangka>
      <span className="sr-only">{label}</span>
      {Array.from({ length: baris }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3.5">
          <span aria-hidden className="h-10 w-10 shrink-0 rounded-full bg-white/[0.07] animate-pulse" />
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <KerangkaBaris lebar={i % 2 ? "w-2/5" : "w-1/3"} />
            <KerangkaBaris lebar="w-1/4" tinggi="h-2.5" />
          </div>
          <KerangkaBaris lebar="w-20" tinggi="h-7" className="rounded-lg hidden sm:block" />
          <KerangkaBaris lebar="w-16" tinggi="h-7" className="rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Kerangka kartu kepala halaman (judul + subjudul + tombol). */
export function KerangkaKepala() {
  return (
    <div aria-hidden className="p-6 rounded-xl border border-white/10 bg-white/[0.03] flex flex-col lg:flex-row justify-between gap-4">
      <div className="flex flex-col gap-2.5">
        <KerangkaBaris lebar="w-44" tinggi="h-6" />
        <KerangkaBaris lebar="w-64" tinggi="h-3" />
      </div>
      <div className="flex gap-3">
        <KerangkaBaris lebar="w-24" tinggi="h-10" className="rounded-xl" />
        <KerangkaBaris lebar="w-40" tinggi="h-10" className="rounded-xl" />
      </div>
    </div>
  );
}

/** Keadaan kosong yang seragam: ikon, judul, penjelasan, dan (opsional) satu aksi. */
export function KeadaanKosong({ judul, keterangan, aksi, ikon, className = "" }: { judul: string; keterangan?: string; aksi?: React.ReactNode; ikon?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 ${className}`} data-kosong-ui>
      <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-500 mb-3" aria-hidden>
        {ikon || (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
        )}
      </div>
      <p className="text-sm font-bold text-white">{judul}</p>
      {keterangan && <p className="text-xs text-gray-400 mt-1 max-w-sm leading-relaxed">{keterangan}</p>}
      {aksi && <div className="mt-4 flex flex-wrap justify-center gap-2">{aksi}</div>}
    </div>
  );
}
