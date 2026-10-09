// src/components/brutal/DasborHRBrutal.tsx
// Tata letak Dasbor HR KHUSUS tema Neo-Brutal (mockup 8 Okt 2026). Dirender oleh
// app/admin/dashboard/page.tsx hanya bila tema = Neo-Brutal; tema gelap tetap memakai
// tata letak lamanya yang tidak diubah.
//
// Komponen ini murni tampilan: semua data, angka turunan, dan aksi (setujui/tolak,
// buka rincian, galeri foto, tandai lembur, aksi cepat) datang dari halaman lewat props,
// jadi logikanya tetap satu sumber dengan tema gelap.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Camera, Download, Mail, MessageCircle, Wallet, Database } from "lucide-react";
import { supabase } from "@/lib/supabase";
import TandaiLembur from "@/components/admin/TandaiLembur";
import KartuLembur from "@/components/admin/KartuLembur";
import KartuOnline from "@/components/admin/KartuOnline";
import InfoLibur from "@/components/InfoLibur";
import AvatarNB from "@/components/brutal/AvatarNB";
import { namaPanggilan } from "@/lib/nama";
import { teksTanggal } from "@/lib/tanggalTampil";
import { periodeGaji, labelRentang } from "@/lib/rentangTanggal";
import { menitWajib, teksMenit, type TandaLembur } from "@/lib/lembur";
import type { BarisAbsen, BarisKaryawan, BarisPengajuan } from "@/components/brutal/tipe";
import CariKaryawanNB from "@/components/brutal/CariKaryawanNB";
import KalenderLiburNB from "@/components/brutal/KalenderLiburNB";
import LoncengNB from "@/components/brutal/LoncengNB";
import GrafikKehadiranNB from "@/components/brutal/GrafikKehadiranNB";
import KartuDailyTaskNB from "@/components/brutal/KartuDailyTaskNB";
import { muatRingkasDailyTask } from "@/lib/tracker/ringkasDasborData";
import type { RingkasDailyTask } from "@/lib/tracker/ringkasDasbor";

type Keputusan = "normal" | "sesuai_telat";

export type PropsDasborHRBrutal = {
  todayISO: string;
  isLoading: boolean;
  employees: BarisKaryawan[];
  onTimeToday: BarisAbsen[];
  lateToday: BarisAbsen[];
  approvedLeaves: unknown[];
  remoteToday: unknown[];
  belumAbsen: number;
  hadirTotal: number;
  absenLog: BarisAbsen[];
  pendingApprovals: BarisPengajuan[];
  jamMasukPetaHariIni: Record<string, string>;
  tandaLemburHariIni: Record<string, TandaLembur>;
  saringLog: "semua" | "masuk" | "pulang";
  setSaringLog: (v: "semua" | "masuk" | "pulang") => void;
  anomali: { jumlah: number; total: number; data: number; telat: number; sembunyi: boolean; onSembunyi: () => void; onTampil: () => void };
  versiLembur: number;
  bukaRincian: (kunci: string) => void;
  bukaFoto: (fokusId: string | null) => void;
  onKeputusan: (id: string, aksi: "Disetujui" | "Ditolak", keputusan?: Keputusan) => void;
  onLemburBerubah: () => void;
  aksi: { exportCsv: () => void; email: () => void; wa: () => void; payroll: () => void; backup: () => void };
};

// "9:05" / "09.05" → menit sejak 00:00
function keMenit(v: unknown): number | null {
  const m = String(v ?? "").match(/(\d{1,2})[:.](\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Label & warna lencana jenis pengajuan (WFH biru, cuti kuning, izin telat pink, sakit jingga, lainnya ungu).
function tagJenis(jenis: unknown): { label: string; warna: string } {
  const j = String(jenis ?? "");
  if (/WFC/i.test(j)) return { label: "WFC", warna: "nb-biru" };
  if (/WFH|Work From/i.test(j)) return { label: "WFH", warna: "nb-biru" };
  if (/Izin Terlambat/i.test(j)) return { label: "Izin telat", warna: "nb-pink" };
  if (/Sakit/i.test(j)) return { label: "Sakit", warna: "nb-jingga" };
  if (/Cuti/i.test(j)) return { label: "Cuti", warna: "nb-kuning" };
  return { label: j || "Izin", warna: "nb-ungu" };
}

function Kpi({ label, angka, ket, warna, onClick, judul }: { label: string; angka: ReactNode; ket: ReactNode; warna: string; onClick: () => void; judul: string }) {
  return (
    <button type="button" className={`nb-kpi ${warna}`} onClick={onClick} title={judul}>
      <span className="nb-kpi-label">{label}</span>
      <span className="nb-kpi-angka">{angka}</span>
      <span className="nb-kpi-ket">{ket}</span>
    </button>
  );
}

export default function DasborHRBrutal(p: PropsDasborHRBrutal) {
  const { employees, isLoading } = p;
  const strip = (n: number) => (isLoading ? "–" : n);
  const empPeta: Record<string, BarisKaryawan> = {};
  employees.forEach((e) => { if (e?.idKaryawan != null) empPeta[String(e.idKaryawan)] = e; });

  // Menit terlambat per baris (dari jam masuk karyawan; bawaan 09:00).
  const menitTelat = (a: BarisAbsen) => {
    const m = keMenit(a?.waktuMasuk);
    const j = keMenit(empPeta[String(a?.idKaryawan ?? "")]?.jamMasuk || "09:00");
    return m == null || j == null ? 0 : Math.max(0, m - j);
  };
  const idTelat = new Set(p.lateToday.map((a) => String(a.idKaryawan ?? "")));
  const rataTelat = p.lateToday.length ? Math.round(p.lateToday.reduce((s: number, a) => s + menitTelat(a), 0) / p.lateToday.length) : 0;

  // Jam masuk yang paling umum (untuk keterangan "Belum absen").
  const hitungJam: Record<string, number> = {};
  employees.forEach((e) => { const j = String(e?.jamMasuk || "09:00").slice(0, 5); hitungJam[j] = (hitungJam[j] || 0) + 1; });
  const jamUmum = Object.entries(hitungJam).sort((a, b) => b[1] - a[1])[0]?.[0] || "09:00";

  const periode = periodeGaji(p.todayISO);

  // Ringkasan Daily Task (kartu ungu + lonceng). undefined = memuat, null = gagal.
  const [daily, setDaily] = useState<RingkasDailyTask | null | undefined>(undefined);
  useEffect(() => {
    let hidup = true;
    muatRingkasDailyTask(supabase, p.todayISO).then((r) => { if (hidup) setDaily(r); });
    return () => { hidup = false; };
  }, [p.todayISO]);
  const tanggalChip = (() => {
    const [y, m, d] = p.todayISO.split("-").map(Number);
    return new Date(y!, (m || 1) - 1, d || 1).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
  })();

  // Log absensi: satu baris per karyawan (data halaman sudah unik & urut jam masuk terbaru).
  // Saringan memakai state halaman yang sama: "masuk" = belum pulang, "pulang" = sudah pulang.
  const sudahPulang = p.absenLog.filter((a) => !!a.waktuKeluar).length;
  const belumPulang = p.absenLog.length - sudahPulang;
  const barisLog = p.saringLog === "semua" ? p.absenLog : p.absenLog.filter((a) => (p.saringLog === "pulang" ? !!a.waktuKeluar : !a.waktuKeluar));

  return (
    <div className="nb-dasbor" data-dasbor-brutal="hr">
      {/* KEPALA: judul + tanggal + periode gaji */}
      <div className="nb-kepala">
        <h1>Dasbor</h1>
        <KalenderLiburNB todayISO={p.todayISO} label={tanggalChip} />
        <span className="nb-meta">
          <span className="nb-periode">Periode gaji {labelRentang(periode)}</span>
          <button type="button" className="nb-tautan" onClick={() => p.bukaRincian("total")}>Total karyawan {strip(employees.length)} →</button>
        </span>
        <div className="nb-kepala-kanan">
          <CariKaryawanNB employees={employees} />
          <LoncengNB butir={[
            { kunci: "pengajuan", label: "Pengajuan menunggu keputusan", jumlah: isLoading ? 0 : p.pendingApprovals.length, warna: "nb-pink", onClick: () => document.getElementById("nb-judul-pengajuan")?.scrollIntoView({ behavior: "smooth", block: "start" }) },
            { kunci: "anomali", label: "Data & keterlambatan perlu ditinjau", jumlah: isLoading ? 0 : p.anomali.total, warna: "nb-kuning", onClick: () => p.bukaRincian("anomali") },
            { kunci: "acc", label: "Brief menunggu ACC (Daily Task)", jumlah: daily?.menunggu || 0, warna: "nb-ungu", href: "/admin/daily-task" },
          ]} />
        </div>
      </div>

      <InfoLibur peran="hr" />

      {/* UBIN KPI — klik membuka daftar nama yang sama dengan tema gelap */}
      <div className="nb-kpi-baris" data-kpi-brutal>
        <Kpi label="Hadir" warna="nb-hijau" angka={strip(p.hadirTotal)} judul="Lihat daftar tepat waktu"
          onClick={() => p.bukaRincian("hadir")} ket={isLoading ? "memuat…" : `dari ${employees.length} karyawan`} />
        <Kpi label="Terlambat" warna="nb-pink" angka={strip(p.lateToday.length)} judul="Lihat daftar terlambat"
          onClick={() => p.bukaRincian("terlambat")} ket={p.lateToday.length ? `rata-rata ${rataTelat} menit` : "tidak ada yang terlambat"} />
        <Kpi label="WFH / WFC" warna="nb-biru" angka={strip(p.remoteToday.length)} judul="Lihat daftar WFH / WFC"
          onClick={() => p.bukaRincian("remote")} ket="sudah disetujui" />
        <Kpi label="Sakit / Cuti" warna="nb-kuning" angka={strip(p.approvedLeaves.length)} judul="Lihat daftar sakit / cuti"
          onClick={() => p.bukaRincian("absen")} ket="sakit · cuti · izin" />
        <Kpi label="Belum absen" warna="nb-putih" angka={strip(p.belumAbsen)} judul="Lihat daftar belum absen"
          onClick={() => p.bukaRincian("belum")} ket={`jam masuk ${jamUmum}`} />
      </div>

      {/* Data karyawan belum lengkap / keterlambatan belum ditinjau (daftar & aksinya tetap di jendela "anomali") */}
      {!isLoading && p.anomali.jumlah > 0 && !p.anomali.sembunyi && (
        <div className="nb-pita" data-panel-anomali>
          <p>
            <b>Perlu dilengkapi:</b>{" "}
            {p.anomali.data > 0 && <>{p.anomali.data} data karyawan belum lengkap</>}
            {p.anomali.data > 0 && p.anomali.telat > 0 && <> · </>}
            {p.anomali.telat > 0 && <>{p.anomali.telat} keterlambatan hari ini belum ditinjau</>}
          </p>
          <div className="nb-pita-aksi">
            <button type="button" className="nb-tombol nb-kecil" onClick={p.anomali.onSembunyi}>Sembunyikan hari ini</button>
            <button type="button" className="nb-tombol nb-kecil nb-hitam" onClick={() => p.bukaRincian("anomali")}>Tinjau {p.anomali.total}</button>
          </div>
        </div>
      )}
      {!isLoading && p.anomali.jumlah > 0 && p.anomali.sembunyi && (
        <div className="nb-pita-kecil" data-panel-anomali="tersembunyi">
          <span><b>{p.anomali.total}</b> hal perlu ditinjau (disembunyikan hari ini)</span>
          <button type="button" className="nb-tautan" onClick={p.anomali.onTampil}>Tampilkan</button>
        </div>
      )}

      <div className="nb-grid-utama">
        <div className="nb-kolom">
        {/* LOG ABSENSI */}
        <section className="nb-kartu" aria-labelledby="nb-judul-log">
          <div className="nb-kartu-kepala">
            <h2 id="nb-judul-log">Log absensi</h2>
            <span className="nb-live">LIVE</span>
            <button type="button" className="nb-tombol nb-ungu" style={{ marginLeft: "auto" }} onClick={() => p.bukaFoto(null)} title="Lihat foto selfie absensi (7 hari terakhir)">
              <Camera aria-hidden /> Foto absen
            </button>
          </div>
          <div className="nb-saring nb-saring-baris" role="group" aria-label="Saring log absensi">
            {([["semua", "Semua", p.absenLog.length], ["masuk", "Belum pulang", belumPulang], ["pulang", "Sudah pulang", sudahPulang]] as const).map(([k, label, n]) => (
              <button key={k} type="button" aria-pressed={p.saringLog === k} onClick={() => p.setSaringLog(k)}>{label} {n}</button>
            ))}
          </div>
          <div role="table" aria-label="Log absensi hari ini">
            <div className="nb-tabel-kepala" role="row">
              <span role="columnheader">Karyawan</span><span role="columnheader">Masuk</span>
              <span role="columnheader">Lokasi</span><span role="columnheader">Status</span><span role="columnheader" aria-label="Aksi" />
            </div>
            <div className="nb-tabel-badan">
              {barisLog.map((a) => {
                const id = String(a.idKaryawan ?? "");
                const emp = empPeta[id];
                const mode = a.mode_kerja || "Kantor";
                const remote = mode !== "Kantor";
                const telat = !remote && idTelat.has(id);
                const adaFoto = !!a.foto_masuk || !!a.foto_keluar;
                return (
                  <div key={String(a.id ?? id ?? a.nama)} className="nb-tabel-baris" role="row" data-log-baris={id}>
                    <div className="nb-sel-org" role="cell">
                      <AvatarNB id={a.idKaryawan} nama={a.nama} />
                      <div style={{ minWidth: 0 }}>
                        <b title={a.nama}>{namaPanggilan(a.idKaryawan, employees, a.nama)}</b>
                        <small>{emp?.jabatan || a.idKaryawan || " "}</small>
                      </div>
                    </div>
                    <span className="nb-sel-info nb-sel-jam" data-label="Masuk" role="cell">
                      <span className="nb-mono">{a.waktuMasuk || "--:--"}</span>
                      {a.waktuKeluar && <small title="Jam pulang">pulang <span className="nb-mono">{a.waktuKeluar}</span></small>}
                    </span>
                    <span className="nb-sel-info" data-label="Lokasi" role="cell"><span className="nb-lokasi">{mode}</span></span>
                    <span className="nb-sel-info nb-sel-status" role="cell">
                      {remote ? <span className="nb-pil nb-biru">{mode} disetujui</span>
                        : telat ? <span className="nb-pil nb-pink">Terlambat {menitTelat(a)} mnt</span>
                        : <span className="nb-pil nb-hijau">{a.status === "Terlambat" ? "Terlambat (fleksibel)" : "Tepat waktu"}</span>}
                      {a.kompensasi_lembur && <span className="nb-tag nb-hijau" title={`Kompensasi lembur ${a.kompensasi_dari || ""}`} data-lencana="kompensasi">kompensasi</span>}
                      {a.waktuKeluar && p.tandaLemburHariIni[id] && Number(a.lembur_menit) >= menitWajib(p.tandaLemburHariIni[id]) && <span className="nb-tag nb-kuning" title={`Ditandai lembur & clock-out ≥ ${teksMenit(menitWajib(p.tandaLemburHariIni[id]))} setelah jam wajib pulang`} data-lencana="lembur">lembur</span>}
                    </span>
                    <span className="nb-sel-aksi" role="cell">
                      <TandaiLembur kecil idKaryawan={id} nama={a.nama || ""} tanggal={p.todayISO} tandaAda={p.tandaLemburHariIni[id] || null} onSelesai={p.onLemburBerubah} />
                      <button type="button" className="nb-ikon" onClick={() => p.bukaFoto(id)} data-kosong={adaFoto ? undefined : ""}
                        title={adaFoto ? "Lihat foto absen" : "Foto absen (belum ada)"} aria-label={`Lihat foto absen ${a.nama}`}>
                        <Camera aria-hidden />
                      </button>
                    </span>
                  </div>
                );
              })}
              {p.absenLog.length === 0 ? (
                <p className="nb-kosong">{isLoading ? "Memuat log absensi…" : "Belum ada yang absen hari ini."}</p>
              ) : barisLog.length === 0 ? (
                <p className="nb-kosong">{p.saringLog === "pulang" ? "Belum ada yang clock-out hari ini." : "Semua yang absen sudah pulang."}</p>
              ) : null}
            </div>
          </div>
        </section>

        <GrafikKehadiranNB todayISO={p.todayISO} employees={employees} versi={p.absenLog.length} />
        </div>

        <div className="nb-kolom">
        {/* PENGAJUAN */}
        <section className="nb-kartu" aria-labelledby="nb-judul-pengajuan">
          <div className="nb-kartu-kepala" style={{ justifyContent: "space-between" }}>
            <h2 id="nb-judul-pengajuan">Pengajuan</h2>
            <span className="nb-hitung" title={`${p.pendingApprovals.length} menunggu keputusan`}>{isLoading ? "–" : p.pendingApprovals.length}</span>
          </div>
          {isLoading ? (
            <p className="nb-kosong">Memuat pengajuan…</p>
          ) : p.pendingApprovals.length === 0 ? (
            <div className="nb-beres"><b>Semua beres</b><span>Tidak ada pengajuan tertunda.</span></div>
          ) : (
            <div className="nb-daftar">
              {p.pendingApprovals.map((req) => {
                const tag = tagJenis(req.jenis);
                const izinTelat = /Izin Terlambat/i.test(String(req.jenis || ""));
                const jamIn = p.jamMasukPetaHariIni[String(req.idKaryawan ?? "")];
                return (
                  <div key={req.id} className="nb-item" data-pengajuan={req.id}>
                    <div className="nb-item-atas">
                      <b title={req.nama}>{namaPanggilan(req.idKaryawan, employees, req.nama)}</b>
                      <span className={`nb-tag ${tag.warna}`} title={req.jenis}>{tag.label}</span>
                    </div>
                    <p className="nb-item-ket">
                      {req.tanggal ? <span title={req.tanggal}>{teksTanggal(req.tanggal)}</span> : null}
                      {izinTelat && jamIn ? <> · <span className="nb-mono">clock-in {jamIn}</span></> : null}
                      {" · "}{req.alasan ? req.alasan : <i>tanpa keterangan</i>}
                    </p>
                    {izinTelat ? (
                      <div className="nb-item-aksi nb-tiga">
                        <button type="button" className="nb-tombol nb-hijau" onClick={() => p.onKeputusan(req.id, "Disetujui", "normal")} title="Keterlambatan dimaafkan — pulang jam normal">ACC normal</button>
                        <button type="button" className="nb-tombol nb-biru" onClick={() => p.onKeputusan(req.id, "Disetujui", "sesuai_telat")} title="Wajib ganti jam — pulang sesuai keterlambatan (clock-in + durasi kerja di Pengaturan)">ACC +jam</button>
                        <button type="button" className="nb-tombol" onClick={() => p.onKeputusan(req.id, "Ditolak")}>Tolak</button>
                      </div>
                    ) : (
                      <div className="nb-item-aksi">
                        <button type="button" className="nb-tombol nb-hijau" onClick={() => p.onKeputusan(req.id, "Disetujui")}>Setujui</button>
                        <button type="button" className="nb-tombol" onClick={() => p.onKeputusan(req.id, "Ditolak")}>Tolak</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <KartuDailyTaskNB ringkas={daily} />
        </div>
      </div>

      <div className="nb-grid-bawah">
        {/* Lembur hari ini (hanya tampil bila ada tanda) */}
        <KartuLembur versi={p.versiLembur} hariIni={p.todayISO} employees={employees} onUbah={p.onLemburBerubah}
          bungkus={(isi) => <section className="nb-kartu nb-isi nb-lebar">{isi}</section>} />
        <section className="nb-kartu nb-isi"><KartuOnline employees={employees} /></section>
        <section className="nb-kartu" aria-labelledby="nb-judul-aksi">
          <div className="nb-kartu-kepala"><h2 id="nb-judul-aksi">Aksi cepat</h2></div>
          <div className="nb-aksi-cepat nb-isi" style={{ paddingTop: 0 }} data-aksi-cepat>
            <button type="button" className="nb-tombol" onClick={p.aksi.exportCsv}><Download aria-hidden /> Export CSV</button>
            <button type="button" className="nb-tombol" onClick={p.aksi.email}><Mail aria-hidden /> Email Blast</button>
            <button type="button" className="nb-tombol nb-hijau" onClick={p.aksi.wa}><MessageCircle aria-hidden /> WhatsApp Blast</button>
            <button type="button" className="nb-tombol nb-ungu" onClick={p.aksi.payroll} title="Buka Payroll (finalkan periode lalu kirim slip ke email)"><Wallet aria-hidden /> Kirim Slip Gaji</button>
            <button type="button" className="nb-tombol" onClick={p.aksi.backup}><Database aria-hidden /> Backup DB</button>
          </div>
        </section>
      </div>
    </div>
  );
}
