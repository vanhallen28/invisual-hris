// src/components/brutal/KalenderLiburNB.tsx
// Chip tanggal di kepala Dasbor (tema Neo-Brutal) yang bisa diklik → kalender bulan berisi
// tanggal merah dari tabel `hari_libur` (libur nasional, cuti bersama yang diliburkan, libur
// kantor). Hanya pengingat: tidak mengubah data apa pun. Kelola daftarnya di
// Pengaturan › Kalender Kerja › Hari Libur & Cuti Bersama.
"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { LABEL_JENIS } from "@/lib/hariLibur";
import { BULAN_ID, tanggalDari } from "@/lib/rentangTanggal";
import { HARI_KALENDER as HARI, useKalenderLibur } from "@/components/useKalenderLibur";

export default function KalenderLiburNB({ todayISO, label }: { todayISO: string; label: string }) {
  const { buka, setBuka, bulan, sel, daftar, peta, merahBulanIni, masukBulanIni, geser, panel, tombol } = useKalenderLibur(todayISO);

  return (
    <>
      <button ref={tombol} type="button" className="nb-chip-tanggal nb-chip-klik" onClick={() => setBuka(true)}
        aria-haspopup="dialog" aria-expanded={buka} title="Buka kalender tanggal merah" data-chip-kalender>
        {label}
      </button>
      {buka && (
        <div className="nb-kal-lapis" onMouseDown={(e) => { if (e.target === e.currentTarget) setBuka(false); }} data-kalender-libur>
          <div ref={panel} className="nb-kal" role="dialog" aria-modal="true" aria-labelledby="nb-kal-judul" tabIndex={-1}>
            <div className="nb-kal-kepala">
              <button type="button" className="nb-ikon" onClick={() => geser(-1)} aria-label="Bulan sebelumnya"><ChevronLeft aria-hidden /></button>
              <h2 id="nb-kal-judul">{BULAN_ID[bulan.m]} {bulan.y}</h2>
              <button type="button" className="nb-ikon" onClick={() => geser(1)} aria-label="Bulan berikutnya"><ChevronRight aria-hidden /></button>
              <button type="button" className="nb-ikon nb-kal-tutup" onClick={() => setBuka(false)} aria-label="Tutup kalender"><X aria-hidden /></button>
            </div>
            <div className="nb-kal-grid" role="grid" aria-label={`Kalender ${BULAN_ID[bulan.m]} ${bulan.y}`}>
              {HARI.map((h, i) => <span key={h} className="nb-kal-hari" data-minggu={i === 6 ? "" : undefined} role="columnheader">{h}</span>)}
              {sel.map((s, i) => {
                const x = peta.get(s.iso);
                const merah = !!x?.libur;
                const minggu = i % 7 === 6;
                const sabtu = i % 7 === 5;
                return (
                  <span key={s.iso} role="gridcell" className="nb-kal-sel" title={x ? `${x.nama} · ${LABEL_JENIS[x.jenis]}${x.libur ? "" : " (masuk kerja)"}` : undefined}
                    data-luar={s.diBulan ? undefined : ""} data-merah={merah ? "" : undefined} data-masuk={x && !x.libur ? "" : undefined}
                    data-minggu={minggu && !merah ? "" : undefined} data-sabtu={sabtu && !merah ? "" : undefined}
                    data-hari-ini={s.iso === todayISO ? "" : undefined} data-tanggal={s.iso}>
                    {tanggalDari(s.iso).getDate()}
                  </span>
                );
              })}
            </div>
            <div className="nb-kal-daftar">
              {daftar === undefined ? (
                <p>Memuat tanggal merah…</p>
              ) : merahBulanIni.length === 0 && masukBulanIni.length === 0 ? (
                <p>Tidak ada tanggal merah di bulan ini.</p>
              ) : (
                <ul>
                  {merahBulanIni.map((x) => (
                    <li key={x.tanggal}><b className="nb-mono">{tanggalDari(x.tanggal).getDate()}</b><span>{x.nama}</span><span className={`nb-tag ${x.jenis === "nasional" ? "nb-pink" : x.jenis === "cuti_bersama" ? "nb-jingga" : "nb-biru"}`}>{LABEL_JENIS[x.jenis]}</span></li>
                  ))}
                  {masukBulanIni.map((x) => (
                    <li key={x.tanggal}><b className="nb-mono">{tanggalDari(x.tanggal).getDate()}</b><span>{x.nama}</span><span className="nb-tag">Masuk kerja</span></li>
                  ))}
                </ul>
              )}
              <p className="nb-kal-ket"><span><i className="nb-pink" /> tanggal merah</span><span><i className="nb-kuning" /> hari ini</span><span className="nb-kal-ket-catatan">Daftar diatur HR di Pengaturan › Kalender Kerja</span></p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
