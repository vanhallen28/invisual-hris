// src/components/brutal/GrafikKehadiranNB.tsx
// Kartu "KEHADIRAN 7 HARI" di Dasbor HR (tema Neo-Brutal): persentase karyawan yang
// ber-absen pada 7 hari kerja terakhir (Sabtu/Minggu & tanggal merah dilewati).
// Batang hari ini berwarna pink karena harinya masih berjalan.
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { muatPetaSekitar } from "@/lib/hariLiburData";
import { hariKerjaTerakhir, kehadiranPerHari, type HariKehadiran } from "@/lib/kehadiran7Hari";
import { tanggalDari } from "@/lib/rentangTanggal";
import type { BarisKaryawan } from "@/components/brutal/tipe";

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const pendek = (iso: string) => { const d = tanggalDari(iso); return `${d.getDate()}/${d.getMonth() + 1}`; };

export default function GrafikKehadiranNB({ todayISO, employees, versi }: { todayISO: string; employees: (BarisKaryawan & { tanggalBergabung?: string | null })[]; versi: number }) {
  const [data, setData] = useState<HariKehadiran[] | null>(null);
  const [galat, setGalat] = useState(false);
  const kunciKaryawan = employees.length;

  useEffect(() => {
    if (!kunciKaryawan) return;
    let hidup = true;
    (async () => {
      try {
        const peta = await muatPetaSekitar(supabase, todayISO).catch(() => null);
        const hari = hariKerjaTerakhir(todayISO, 7, peta);
        if (!hari.length) { if (hidup) setData([]); return; }
        const { data: abs, error } = await supabase.from("attendance").select("idKaryawan, tanggal, waktuMasuk").gte("tanggal", hari[0]!).lte("tanggal", todayISO);
        if (error) throw error;
        if (hidup) { setData(kehadiranPerHari(hari, abs || [], employees, todayISO)); setGalat(false); }
      } catch { if (hidup) setGalat(true); }
    })();
    return () => { hidup = false; };
    // employees dibaca lewat kunciKaryawan; versi = log absensi berubah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayISO, kunciKaryawan, versi]);

  const ringkas = data && data.length ? `${data.map((d) => `${pendek(d.tanggal)} ${d.persen}%`).join(", ")}` : "";

  return (
    <section className="nb-kartu" aria-labelledby="nb-judul-grafik" data-grafik-7hari>
      <div className="nb-kartu-kepala">
        <h2 id="nb-judul-grafik">Kehadiran 7 hari</h2>
        <span className="nb-legenda"><span>% karyawan hadir</span><span><i className="nb-pink" />hari ini (berjalan)</span></span>
      </div>
      {galat ? (
        <p className="nb-kosong">Grafik belum bisa dimuat. Coba muat ulang halaman.</p>
      ) : !data ? (
        <p className="nb-kosong">Memuat grafik…</p>
      ) : data.length === 0 ? (
        <p className="nb-kosong">Belum ada hari kerja untuk ditampilkan.</p>
      ) : (
        <div className="nb-grafik" style={{ ["--n" as string]: data.length }}>
          <div className="nb-grafik-plot" role="img" aria-label={`Persentase karyawan hadir per hari kerja: ${ringkas}`}>
            {data.map((d) => (
              <div key={d.tanggal} className="nb-batang-kolom">
                <span className="nb-batang-nilai" aria-hidden>{d.persen}%</span>
                <div className="nb-batang" tabIndex={0} data-hari-ini={d.hariIni ? "" : undefined} data-batang={d.tanggal}
                  style={{ height: `${Math.max(d.persen, 2) * 0.8}%` }}
                  aria-label={`${HARI[tanggalDari(d.tanggal).getDay()]} ${pendek(d.tanggal)}: ${d.hadir} dari ${d.total} hadir (${d.persen}%)`} />
                <span className="nb-tip" aria-hidden>{HARI[tanggalDari(d.tanggal).getDay()]} {pendek(d.tanggal)}<br />{d.hadir} dari {d.total} hadir{d.hariIni ? " · masih berjalan" : ""}</span>
              </div>
            ))}
          </div>
          <div className="nb-grafik-sumbu" aria-hidden>
            {data.map((d) => <span key={d.tanggal}>{pendek(d.tanggal)}</span>)}
          </div>
          <table className="nb-sr">
            <caption>Kehadiran 7 hari kerja terakhir</caption>
            <thead><tr><th>Tanggal</th><th>Hadir</th><th>Karyawan</th><th>Persen</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.tanggal}><td>{d.tanggal}</td><td>{d.hadir}</td><td>{d.total}</td><td>{d.persen}%</td></tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
