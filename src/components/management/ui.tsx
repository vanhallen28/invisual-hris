// src/components/management/ui.tsx — potongan tampilan bersama section Management (tema Gelap & Neo-Brutal).
"use client";

import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useJebakFokus } from "@/lib/fokus";

export type Warna = "abu" | "hijau" | "kuning" | "merah" | "biru" | "ungu";
const WARNA: Record<Warna, string> = {
  abu: "bg-white/5 text-gray-300 border-white/10",
  hijau: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
  kuning: "bg-amber-500/10 text-amber-300 border-amber-500/25",
  merah: "bg-red-500/10 text-red-300 border-red-500/25",
  biru: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
  ungu: "bg-violet-500/10 text-violet-300 border-violet-500/25",
};

/** Label status — selalu berteks (status tidak dibedakan dengan warna saja). */
export function Lencana({ warna = "abu", children, ...rest }: { warna?: Warna; children: ReactNode } & Record<`data-${string}`, string | undefined>) {
  return <span {...rest} className={`inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wide ${WARNA[warna]}`}>{children}</span>;
}

export function Kosong({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-gray-400">{children}</div>;
}

export function PesanGalat({ pesan }: { pesan?: string | null }) {
  if (!pesan) return null;
  return <p role="alert" data-galat-mgmt className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">{pesan}</p>;
}

export const kelasInput = "w-full rounded-lg border border-white/10 bg-input px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:border-white/30 focus:outline-none";
export const kelasLabel = "grid gap-1.5 text-xs font-semibold text-gray-400";
export const kelasTombol = "inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-gray-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 transition-colors cursor-pointer";
export const kelasTombolUtama = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-black hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-40 transition-colors cursor-pointer";

/** Dialog modal: portal ke body, fokus terjebak, Escape/klik latar menutup (kecuali sedang menyimpan). */
export function Dialog({ judul, sub, onTutup, sibuk = false, children, ...rest }: { judul: string; sub?: ReactNode; onTutup: () => void; sibuk?: boolean; children: ReactNode } & Record<`data-${string}`, string | undefined>) {
  const kotak = useRef<HTMLDivElement>(null);
  useJebakFokus(kotak, true, () => { if (!sibuk) onTutup(); });
  if (typeof document === "undefined") return null;
  return createPortal(
    <div {...rest} className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="judul-dialog-mgmt"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !sibuk) onTutup(); }}>
      <div ref={kotak} className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-kartu shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/5 bg-kartu-hover p-5">
          <div className="min-w-0">
            <h2 id="judul-dialog-mgmt" className="text-lg font-bold text-white">{judul}</h2>
            {sub ? <p className="mt-0.5 text-xs text-gray-400">{sub}</p> : null}
          </div>
          <button type="button" onClick={onTutup} disabled={sibuk} className="px-2 text-xl leading-none text-gray-500 hover:text-white" aria-label="Tutup">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
