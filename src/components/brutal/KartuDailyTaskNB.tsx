// src/components/brutal/KartuDailyTaskNB.tsx
// Kartu ungu "DAILY TASK" di Dasbor HR (tema Neo-Brutal). Angka dari ringkasDailyTask
// (aturan tahap yang sama dengan Antrean ACC). `ringkas`: undefined = memuat, null = gagal.
"use client";

import Link from "next/link";
import type { RingkasDailyTask } from "@/lib/tracker/ringkasDasbor";

export default function KartuDailyTaskNB({ ringkas }: { ringkas: RingkasDailyTask | null | undefined }) {
  const p = ringkas?.papan || null;
  return (
    <section className="nb-kartu nb-daily" aria-labelledby="nb-judul-daily" data-kartu-daily>
      <div className="nb-kartu-kepala"><h2 id="nb-judul-daily">Daily Task</h2></div>
      {ringkas === null ? (
        <p className="nb-kosong" style={{ paddingTop: 0 }}>Ringkasan Daily Task belum bisa dimuat.</p>
      ) : (
        <>
          <div className="nb-daily-ubin">
            <Link href="/admin/daily-task" title="Brief yang menunggu persetujuan project manager (Antrean)">
              <b data-daily="menunggu">{ringkas ? ringkas.menunggu : "–"}</b><span>Menunggu ACC</span>
            </Link>
            <Link href="/admin/daily-task" title="Brief berjalan yang bertanggal hari ini">
              <b data-daily="tempo">{ringkas ? ringkas.tempoHariIni : "–"}</b><span>Tempo hari ini</span>
            </Link>
          </div>
          {p ? (
            <>
              <div className="nb-progres-kepala" title={`${p.selesai} dari ${p.total} brief selesai`}>
                <span>{/^board\b/i.test(p.nama) ? p.nama : `Board ${p.nama}`}</span><span className="nb-mono" data-daily="persen">{p.persen}%</span>
              </div>
              <div className="nb-progres" role="progressbar" aria-label={`Progres board ${p.nama}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.persen}>
                <span style={{ width: `${p.persen}%` }} data-nol={p.persen === 0 ? "" : undefined} />
              </div>
            </>
          ) : ringkas ? (
            <p className="nb-progres-kepala" style={{ margin: 0 }}><span>Belum ada brief yang berjalan.</span></p>
          ) : null}
        </>
      )}
      <div className="nb-daily-kaki">
        <Link href="/admin/daily-task" className="nb-tombol nb-hitam">Buka Daily Task →</Link>
      </div>
    </section>
  );
}
