// src/components/brutal/KalenderLiburNB.tsx
// Chip tanggal di kepala Dasbor (tema Neo-Brutal) yang bisa diklik → kalender bulan berisi
// tanggal merah dari tabel `hari_libur` (libur nasional, cuti bersama yang diliburkan, libur
// kantor). Hanya pengingat: tidak mengubah data apa pun. Kelola daftarnya di
// Pengaturan › Kalender Kerja › Hari Libur & Cuti Bersama.
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { muatHariLibur } from "@/lib/hariLiburData";
import { LABEL_JENIS, type HariLibur } from "@/lib/hariLibur";
import { BULAN_ID, gridBulan, tanggalDari } from "@/lib/rentangTanggal";

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default function KalenderLiburNB({ todayISO, label }: { todayISO: string; label: string }) {
  const [buka, setBuka] = useState(false);
  const t0 = tanggalDari(todayISO);
  const [bulan, setBulan] = useState({ y: t0.getFullYear(), m: t0.getMonth() });
  const [libur, setLibur] = useState<Record<string, HariLibur[]>>({});   // kunci "y-m" → daftar tanggal libur
  const panel = useRef<HTMLDivElement>(null);
  const tombol = useRef<HTMLButtonElement>(null);

  const kunci = `${bulan.y}-${bulan.m}`;
  const sel = gridBulan(bulan.y, bulan.m);
  // Dimuat per bulan saat kalender terbuka; hasil disimpan per kunci bulan (belum ada = memuat).
  // muatHariLibur sendiri disimpan 60 dtk (gabungMuat) → bolak-balik bulan tidak memukul server.
  useEffect(() => {
    if (!buka || libur[kunci] !== undefined) return;
    const k = kunci;
    muatHariLibur(supabase, sel[0]!.iso, sel[sel.length - 1]!.iso).then((d) => setLibur((l) => ({ ...l, [k]: d })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buka, kunci]);

  useEffect(() => {
    if (!buka) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { setBuka(false); tombol.current?.focus(); } };
    document.addEventListener("keydown", esc);
    panel.current?.focus();
    return () => document.removeEventListener("keydown", esc);
  }, [buka]);

  const daftar = libur[kunci];
  const peta = new Map((daftar || []).map((x) => [x.tanggal, x]));
  const merahBulanIni = (daftar || []).filter((x) => x.libur && tanggalDari(x.tanggal).getMonth() === bulan.m);
  const masukBulanIni = (daftar || []).filter((x) => !x.libur && tanggalDari(x.tanggal).getMonth() === bulan.m);
  const geser = (n: number) => setBulan((b) => { const d = new Date(b.y, b.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

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
