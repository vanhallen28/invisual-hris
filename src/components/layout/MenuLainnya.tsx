// src/components/layout/MenuLainnya.tsx
// Tujuan kelima pada nav bawah ponsel (admin): "Lainnya". Membuka lembar bawah
// berisi menu yang tidak muat di nav bawah, sehingga semua halaman HR tetap
// terjangkau dari ponsel. Tampilan saja — tidak menyentuh logika halaman mana pun.
"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useJebakFokus } from "@/lib/fokus";

export type ItemMenu = { name: string; href: string; icon: ReactNode; short?: string };

export default function MenuLainnya({ item, aktif, pathname }: { item: ItemMenu[]; aktif: boolean; pathname: string }) {
  const [buka, setBuka] = useState(false);
  const lembar = useRef<HTMLDivElement>(null);
  useJebakFokus(lembar, buka, () => setBuka(false));
  const tutup = () => setBuka(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setBuka(true)}
        aria-haspopup="dialog"
        aria-expanded={buka}
        data-nav-lainnya
        className={`relative flex flex-col items-center gap-1 py-1 transition-colors duration-300 cursor-pointer ${aktif || buka ? "text-primer" : "text-gray-500 hover:text-gray-300"}`}
      >
        <span className={`flex items-center justify-center w-11 h-9 rounded-2xl transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] ${aktif || buka ? "bg-primer/15 -translate-y-1 scale-105" : "translate-y-0 scale-100"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={aktif || buka ? 2.5 : 2} stroke="currentColor" className="w-6 h-6" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </span>
        <span className={`text-[11px] font-bold transition-transform duration-300 ${aktif || buka ? "-translate-y-0.5" : "translate-y-0"}`}>Lainnya</span>
      </button>

      {buka && (
        <div className="fixed inset-0 z-[110]" data-lembar-lainnya>
          <button type="button" aria-label="Tutup menu" onClick={tutup} className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default" />
          <div
            ref={lembar}
            role="dialog"
            aria-modal="true"
            aria-label="Menu lainnya"
            className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 bg-kartu px-4 pt-3 shadow-[0_-20px_60px_rgba(0,0,0,0.6)] bayangan-bawah animate-in slide-in-from-bottom-6 fade-in duration-200"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" aria-hidden />
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-sm font-bold text-white">Menu lainnya</p>
              <button type="button" onClick={tutup} className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center" aria-label="Tutup">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pb-4">
              {item.map((m) => {
                const sedang = pathname === m.href || pathname.startsWith(m.href + "/");
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={tutup}
                    aria-current={sedang ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-sm font-semibold transition-colors ${sedang ? "border-primer/40 bg-primer/15 text-white" : "border-white/10 bg-white/[0.03] text-gray-300 hover:bg-white/[0.07] hover:text-white"}`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${sedang ? "bg-primer text-white" : "bg-white/5 text-gray-400"}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5" aria-hidden>{m.icon}</svg>
                    </span>
                    <span className="leading-tight">{m.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
