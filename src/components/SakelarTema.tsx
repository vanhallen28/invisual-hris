// src/components/SakelarTema.tsx
// Sakelar tema Gelap / Terang (beta). Dipasang di Pengaturan (HR) dan Profil (karyawan).
"use client";

import { useTema, type Tema } from "@/lib/tema";

const PILIHAN: { nilai: Tema; label: string; ikon: React.ReactNode }[] = [
  {
    nilai: "gelap", label: "Gelap",
    ikon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /></svg>,
  },
  {
    nilai: "terang", label: "Terang",
    ikon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>,
  },
];

export default function SakelarTema({ className = "" }: { className?: string }) {
  const [tema, setTema] = useTema();
  return (
    <div className={`p-5 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] kartu-glow ${className}`} data-sakelar-tema>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-white">Tampilan</p>
          <p className="text-xs text-gray-500 mt-0.5">Tema terang masih <b className="text-amber-300">beta</b> — Daily Task & Chat belum sepenuhnya mengikuti. Tersimpan di perangkat ini.</p>
        </div>
        <div role="radiogroup" aria-label="Tema tampilan" className="inline-flex shrink-0 rounded-xl border border-white/10 bg-input p-1">
          {PILIHAN.map((p) => {
            const aktif = tema === p.nilai;
            return (
              <button
                key={p.nilai}
                type="button"
                role="radio"
                aria-checked={aktif}
                onClick={() => setTema(p.nilai)}
                data-tema-pilih={p.nilai}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors ${aktif ? "bg-primer text-white shadow" : "text-gray-400 hover:text-white hover:bg-white/5"}`}
              >
                {p.ikon}{p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
