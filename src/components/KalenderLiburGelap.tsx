// src/components/KalenderLiburGelap.tsx
// Tanggal "Hari Ini • …" di kepala Dasbor HR (tema GELAP) yang bisa diklik → kalender bulan
// berisi tanggal merah dari tabel `hari_libur` (libur nasional, cuti bersama, libur kantor).
// Pasangan tema gelap dari brutal/KalenderLiburNB (logika sama: useKalenderLibur). Hanya
// pengingat — tidak mengubah data. Tampilan tanggal saat diam sama persis seperti sebelumnya.
"use client";

import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { LABEL_JENIS, type HariLibur } from "@/lib/hariLibur";
import { BULAN_ID, tanggalDari } from "@/lib/rentangTanggal";
import { HARI_KALENDER, useKalenderLibur } from "@/components/useKalenderLibur";

const WARNA_TAG: Record<string, string> = {
  nasional: "bg-red-500/15 text-red-300 border-red-500/30",
  cuti_bersama: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  kantor: "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

function kelasSel(o: { luar: boolean; merah: boolean; masuk: boolean; minggu: boolean; hariIni: boolean }) {
  const dasar = "h-9 rounded-lg flex items-center justify-center text-sm font-semibold tabular-nums border transition-colors";
  if (o.hariIni) return `${dasar} bg-primer text-white border-primer ${o.merah ? "ring-2 ring-red-400/70" : ""}`;
  if (o.merah) return `${dasar} bg-red-500/20 text-red-300 border-red-500/40 ${o.luar ? "opacity-50" : ""}`;
  if (o.masuk) return `${dasar} border-dashed border-white/30 text-gray-300 ${o.luar ? "opacity-50" : ""}`;
  if (o.luar) return `${dasar} border-transparent text-gray-600`;
  if (o.minggu) return `${dasar} border-transparent text-red-400/80`;
  return `${dasar} border-transparent text-gray-200 bg-white/[0.03]`;
}

export default function KalenderLiburGelap({ todayISO, label, className = "" }: { todayISO: string; label: string; className?: string }) {
  const { buka, setBuka, bulan, sel, daftar, peta, merahBulanIni, masukBulanIni, geser, panel, tombol } = useKalenderLibur(todayISO);
  const judul = `${BULAN_ID[bulan.m]} ${bulan.y}`;
  const baris = (x: HariLibur, masuk: boolean) => (
    <li key={x.tanggal} className="flex items-center gap-2.5 text-xs">
      <b className="w-6 text-right text-white tabular-nums">{tanggalDari(x.tanggal).getDate()}</b>
      <span className="flex-1 min-w-0 text-gray-200 truncate" title={x.nama}>{x.nama}</span>
      <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${masuk ? "bg-white/5 text-gray-300 border-white/15" : WARNA_TAG[x.jenis] || WARNA_TAG.kantor}`}>{masuk ? "Masuk kerja" : LABEL_JENIS[x.jenis]}</span>
    </li>
  );

  return (
    <>
      <p className={className}>
        <button ref={tombol} type="button" onClick={() => setBuka(true)} aria-haspopup="dialog" aria-expanded={buka}
          title="Buka kalender tanggal merah" className="cursor-pointer uppercase hover:text-white hover:underline decoration-dotted underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primer rounded" data-chip-kalender>
          {label}
        </button>
      </p>
      {buka && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setBuka(false); }} data-kalender-libur>
          <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="kal-gelap-judul" tabIndex={-1}
            className="bg-kartu border border-white/10 rounded-2xl shadow-2xl w-full max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-4 md:p-5 outline-none animate-in zoom-in-95 duration-150 text-left">
            <div className="flex items-center gap-2 mb-3">
              <button type="button" onClick={() => geser(-1)} aria-label="Bulan sebelumnya" className="w-8 h-8 shrink-0 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 flex items-center justify-center"><ChevronLeft className="w-4 h-4" aria-hidden /></button>
              <h2 id="kal-gelap-judul" className="flex-1 text-center text-base font-bold text-white">{judul}</h2>
              <button type="button" onClick={() => geser(1)} aria-label="Bulan berikutnya" className="w-8 h-8 shrink-0 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 flex items-center justify-center"><ChevronRight className="w-4 h-4" aria-hidden /></button>
              <button type="button" onClick={() => setBuka(false)} aria-label="Tutup kalender" className="w-8 h-8 shrink-0 rounded-lg text-gray-500 hover:text-white hover:bg-white/5 flex items-center justify-center"><X className="w-4 h-4" aria-hidden /></button>
            </div>
            <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Kalender ${judul}`}>
              {HARI_KALENDER.map((h, i) => <span key={h} role="columnheader" className={`text-center text-[10px] font-bold uppercase tracking-wider pb-1 ${i === 6 ? "text-red-400/80" : "text-gray-500"}`}>{h}</span>)}
              {sel.map((s, i) => {
                const x = peta.get(s.iso);
                const merah = !!x?.libur;
                const masuk = !!x && !x.libur;
                return (
                  <span key={s.iso} role="gridcell" title={x ? `${x.nama} · ${LABEL_JENIS[x.jenis]}${x.libur ? "" : " (masuk kerja)"}` : undefined}
                    className={kelasSel({ luar: !s.diBulan, merah, masuk, minggu: i % 7 === 6, hariIni: s.iso === todayISO })}
                    data-luar={s.diBulan ? undefined : ""} data-merah={merah ? "" : undefined} data-masuk={masuk ? "" : undefined}
                    data-hari-ini={s.iso === todayISO ? "" : undefined} data-tanggal={s.iso}>
                    {tanggalDari(s.iso).getDate()}
                  </span>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-white/5" data-kal-daftar>
              {daftar === undefined ? (
                <p className="text-xs text-gray-500">Memuat tanggal merah…</p>
              ) : merahBulanIni.length === 0 && masukBulanIni.length === 0 ? (
                <p className="text-xs text-gray-500">Tidak ada tanggal merah di bulan ini.</p>
              ) : (
                <ul className="space-y-2">
                  {merahBulanIni.map((x) => baris(x, false))}
                  {masukBulanIni.map((x) => baris(x, true))}
                </ul>
              )}
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded bg-red-500/30 border border-red-500/50" /> tanggal merah</span>
                <span className="inline-flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded bg-primer" /> hari ini</span>
                <span className="basis-full">Daftar diatur HR di Pengaturan › Kalender Kerja</span>
              </p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
