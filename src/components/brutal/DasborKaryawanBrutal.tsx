// src/components/brutal/DasborKaryawanBrutal.tsx
// Tata letak Dasbor karyawan KHUSUS tema Neo-Brutal (mockup 8 Okt 2026). Dirender oleh
// app/user/dashboard/page.tsx hanya bila tema = Neo-Brutal; tema gelap tetap memakai
// tata letak lamanya yang tidak diubah.
//
// Alur absen (kamera, geofence, wajib alasan telat, kompensasi lembur) tetap milik halaman:
// komponen ini hanya memanggil fungsi yang sama dan memasang ref video/kanvas yang sama.
// Tambahan khusus tampilan ini: jam berjalan dan ringkasan periode gaji (Hadir / Terlambat /
// Izin / Sisa cuti) — dihitung persis seperti kartu ringkasan di halaman Absen.
"use client";

import { useEffect, useState, type RefObject } from "react";
import { Camera, MapPin, Moon, CircleCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import InfoLibur from "@/components/InfoLibur";
import LoadingLogo from "@/components/LoadingLogo";
import AvatarNB from "@/components/brutal/AvatarNB";
import LoncengNB from "@/components/brutal/LoncengNB";
import { teksTanggal } from "@/lib/tanggalTampil";
import { periodeGaji, labelRentang } from "@/lib/rentangTanggal";
import { ringkasKehadiran } from "@/lib/ringkasanKehadiran";
import { labelKompensasi, formatDurasi, MENIT_LEMBUR_MIN, type KompensasiAktif, type TandaLembur } from "@/lib/lembur";
import type { BarisAbsen, BarisKaryawan, BarisPengajuan, BarisTugas } from "@/components/brutal/tipe";
import { keteranganRemote, modeBawaan, type ModeKerja, type StatusRemote } from "@/lib/kerjaRemote";

export type PropsDasborKaryawanBrutal = {
  currentUser: BarisKaryawan | null;
  todayISO: string;
  todayAttendance: BarisAbsen | null;
  jamMasuk: string;
  jamKeluar: string;
  isFleksibel: boolean;
  kantorRadius: number;
  modeKerja: ModeKerja;
  setModeKerja: (m: ModeKerja) => void;
  stRemote: Record<"WFH" | "WFC", StatusRemote>;
  bolehWFH: boolean;
  bolehWFC: boolean;
  captureMode: "in" | "out" | null;
  cameraOn: boolean;
  capturedPhoto: string | null;
  isFlashing: boolean;
  isActionLoading: boolean;
  hasCameraPermission: boolean | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  startCapture: (mode: "in" | "out") => void;
  cancelCapture: () => void;
  handleClockIn: () => void;
  handleClockOut: () => void;
  tandaHariIni: TandaLembur | null;
  kompensasiHariIni: KompensasiAktif | null;
  myTasks: BarisTugas[];
  recentAttendances: BarisAbsen[];
  recentLeaves: BarisPengajuan[];
};

const jamSekarang = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Jam besar yang berjalan (diperbarui tiap detik, hanya angka jam:menit). */
function JamBerjalan() {
  const [jam, setJam] = useState(jamSekarang);
  useEffect(() => {
    const t = window.setInterval(() => setJam(jamSekarang()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="nb-jam-angka" data-jam-berjalan>{jam}</span>;
}

// Warna lencana status tugas (Daily Task / Content Hub).
function warnaTugas(status: unknown): string {
  const s = String(status ?? "");
  if (/done|selesai|publish|tayang|approved|disetujui/i.test(s)) return "nb-hijau";
  if (/review|acc|menunggu|approval/i.test(s)) return "nb-ungu";
  if (/revisi|revision|stuck|tolak/i.test(s)) return "nb-pink";
  if (/progress|working|dikerjakan|proses/i.test(s)) return "nb-kuning";
  return "nb-biru";
}

function warnaPengajuan(status: unknown): string {
  return status === "Disetujui" ? "nb-hijau" : status === "Ditolak" ? "nb-pink" : "nb-kuning";
}

export default function DasborKaryawanBrutal({ videoRef, canvasRef, ...p }: PropsDasborKaryawanBrutal) {
  const u: BarisKaryawan = p.currentUser || {};
  const hariIni = p.todayAttendance;
  const safeId = u.idKaryawan || u.id_karyawan || u.id || "INV-UNKNOWN";
  const namaDepan = String(u.nama || "").split(" ")[0] || "Karyawan";
  const selesai = p.todayAttendance?.waktuKeluar != null;
  const sudahMasuk = !!p.todayAttendance?.waktuMasuk;
  const tanggalPanjang = (() => {
    const [y, m, d] = p.todayISO.split("-").map(Number);
    return new Date(y!, (m || 1) - 1, d || 1).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  })();

  // Ringkasan periode gaji berjalan (21→20) — kueri ringan sendiri, gagal pun dasbor tetap jalan.
  const periode = periodeGaji(p.todayISO);
  const [ringkas, setRingkas] = useState<{ hadir: number; terlambat: number; sakitIzin: number } | null>(null);
  const kunciSegar = `${p.todayAttendance?.id ?? ""}|${p.todayAttendance?.waktuMasuk ?? ""}|${p.todayAttendance?.waktuKeluar ?? ""}|${p.recentLeaves.length}`;
  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const [abs, req] = await Promise.all([
          supabase.from("attendance").select("tanggal, waktuMasuk, status").eq("idKaryawan", safeId).gte("tanggal", periode.dari).lte("tanggal", periode.sampai),
          supabase.from("approvals").select("jenis, tanggal, status").eq("idKaryawan", safeId),
        ]);
        if (hidup) setRingkas(ringkasKehadiran(abs.data || [], req.data || [], periode));
      } catch { /* ringkasan bersifat tambahan */ }
    })();
    return () => { hidup = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeId, periode.dari, periode.sampai, kunciSegar]);

  // Status di pojok kartu absen
  const status = selesai ? { teks: "Selesai", warna: "nb-hijau" }
    : sudahMasuk ? { teks: "Sedang bekerja", warna: "nb-biru" }
    : { teks: "Belum absen", warna: "nb-putih" };

  // Pilihan lokasi kerja: saat kamera menyala (clock-in) bisa dipilih seperti tema gelap;
  // sebelum itu hanya menunjukkan mode bawaan & mana yang sudah disetujui HR.
  const pilihMode = p.captureMode === "in";
  const modeTampil: ModeKerja = pilihMode ? p.modeKerja : modeBawaan(p.stRemote);
  const opsiMode = [
    { key: "Kantor" as const, boleh: true },
    { key: "WFH" as const, boleh: p.bolehWFH },
    { key: "WFC" as const, boleh: p.bolehWFC },
  ];
  const teksLokasi = modeTampil === "Kantor"
    ? `Kantor InVisual · radius ${p.kantorRadius} m${pilihMode ? " · dicek saat absen" : ""}`
    : `${modeTampil} disetujui hari ini · tanpa cek lokasi`;

  const kameraTampil = !selesai && p.hasCameraPermission !== false;
  // Foto hasil jepretan hanya tampil selama proses absen; sesudahnya kotak kembali menampilkan jam.
  const fotoTampil = !!p.capturedPhoto && (!!p.captureMode || p.isActionLoading);
  const modusKamera = p.cameraOn || fotoTampil || p.isActionLoading;
  const sisaCuti = u.sisaCuti ?? 12;

  // Isi lonceng — dihitung dari data dasbor yang sudah dimuat.
  const lupaPulang = p.recentAttendances.filter((a) => !a.waktuKeluar && String(a.tanggal ?? "") < p.todayISO).length;
  const tugasHariIni = p.myTasks.filter((t) => {
    if (!t.publish_at) return false;
    const d = new Date(t.publish_at);
    if (isNaN(d.getTime())) return false;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === p.todayISO;
  }).length;
  const pengajuanMenunggu = p.recentLeaves.filter((l) => l.status === "Menunggu").length;

  return (
    <div className="nb-dasbor" data-dasbor-brutal="karyawan">
      {/* KEPALA: avatar + sapaan + tanggal */}
      <div className="nb-k-kepala">
        <AvatarNB id={u.idKaryawan || u.id_karyawan} nama={u.nama} className="nb-k-avatar" warna="var(--nb-pink)" />
        <div style={{ minWidth: 0 }}>
          <h1>Halo, {namaDepan}!</h1>
          <p>{tanggalPanjang}</p>
        </div>
        <LoncengNB butir={[
          { kunci: "lupa", label: "Lupa absen pulang", jumlah: lupaPulang, warna: "nb-jingga", href: "/user/kehadiran" },
          { kunci: "tugas", label: "Tugas bertanggal hari ini", jumlah: tugasHariIni, warna: "nb-kuning", href: "/user/daily-task" },
          { kunci: "pengajuan", label: "Pengajuan menunggu keputusan HR", jumlah: pengajuanMenunggu, warna: "nb-biru", href: "/user/kehadiran" },
        ]} />
      </div>

      <InfoLibur />

      <div className="nb-k-grid">
        {/* KARTU ABSEN (kuning) */}
        <section className="nb-absen" aria-label="Absen cepat">
          <span className={`nb-absen-status ${status.warna}`}>{status.teks}</span>
          <div className="nb-absen-atas">
            <span>JAM KERJA</span>
            <span className="nb-mono">{p.isFleksibel ? "Fleksibel" : `${p.jamMasuk} – ${p.jamKeluar}`}</span>
          </div>

          <div className="nb-jam" data-kamera={modusKamera ? "" : undefined}>
            {p.isFlashing && <div style={{ position: "absolute", inset: 0, background: "#fff", zIndex: 5 }} />}
            {p.isActionLoading && (
              <div style={{ position: "absolute", inset: 0, zIndex: 4, background: "rgba(255,243,214,.92)", display: "grid", placeItems: "center" }}>
                <LoadingLogo size={56} text="Menyimpan Wajah..." />
              </div>
            )}
            {fotoTampil ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.capturedPhoto || ""} alt="Selfie absensi" />
            ) : kameraTampil ? (
              <video ref={videoRef} autoPlay playsInline muted style={{ transform: "scaleX(-1)", opacity: p.cameraOn ? 1 : 0 }} />
            ) : null}
            {!modusKamera && (
              p.hasCameraPermission === false && !selesai ? (
                <div className="nb-jam-pesan"><b>Kamera ditolak</b><span>Izinkan kamera di pengaturan browser.</span></div>
              ) : (
                <>
                  <JamBerjalan />
                  <span className="nb-jam-wib">WIB</span>
                </>
              )
            )}
            {p.cameraOn && !p.capturedPhoto && (
              <>
                <span className="nb-jam-catatan" style={{ top: 8, right: 8, maxWidth: "70%", textAlign: "right" }}>Foto disimpan 7 hari untuk verifikasi HR, lalu terhapus otomatis</span>
                <span className="nb-jam-catatan nb-mono" style={{ bottom: 8, left: 8 }}>● Face ID</span>
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {sudahMasuk && !selesai && (
            <p className="nb-baris-lokasi"><MapPin aria-hidden />Absen masuk dari {hariIni?.mode_kerja || "Kantor"}</p>
          )}
          {!sudahMasuk && (
            <>
              <p className="nb-baris-lokasi"><MapPin aria-hidden />{teksLokasi}</p>
              <div className="nb-mode" role={pilihMode ? "radiogroup" : undefined} aria-label="Lokasi kerja">
                {opsiMode.map((o) => {
                  const aktif = modeTampil === o.key;
                  if (pilihMode) {
                    return (
                      <button key={o.key} type="button" role="radio" aria-checked={aktif} disabled={!o.boleh}
                        onClick={() => p.setModeKerja(o.key)} data-aktif={aktif ? "" : undefined} data-mati={o.boleh ? undefined : ""}
                        title={o.boleh ? undefined : `Pengajuan ${o.key} hari ini belum disetujui`}>{o.key}</button>
                    );
                  }
                  return (
                    <span key={o.key} data-aktif={aktif ? "" : undefined} data-mati={o.boleh ? undefined : ""}
                      title={o.boleh ? (aktif ? "Mode bawaan hari ini" : "Disetujui — pilih setelah menekan Clock In") : `Pengajuan ${o.key} hari ini belum disetujui`}>{o.key}</span>
                  );
                })}
              </div>
              {pilihMode && keteranganRemote(p.stRemote) && <p className="nb-mode-ket">{keteranganRemote(p.stRemote)}</p>}
            </>
          )}

          {selesai ? (
            <div className="nb-clock nb-selesai" role="status"><CircleCheck aria-hidden /> Absensi selesai</div>
          ) : p.captureMode ? (
            <div className="nb-clock-baris">
              <button type="button" className={`nb-clock ${p.captureMode === "out" ? "nb-biru" : ""}`} onClick={p.captureMode === "in" ? p.handleClockIn : p.handleClockOut} disabled={p.isActionLoading || !p.cameraOn}>
                <Camera aria-hidden /> {p.isActionLoading ? "Menyimpan…" : "Absen sekarang"}
              </button>
              <button type="button" className="nb-tombol" onClick={p.cancelCapture} disabled={p.isActionLoading}>Batal</button>
            </div>
          ) : !p.todayAttendance ? (
            <button type="button" className="nb-clock" onClick={() => p.startCapture("in")}><Camera aria-hidden /> Clock in</button>
          ) : (
            <button type="button" className="nb-clock nb-biru" onClick={() => p.startCapture("out")}><Camera aria-hidden /> Clock out</button>
          )}

          {hariIni?.waktuMasuk && (
            <div className="nb-hari-ini">
              <div>
                <small>Masuk</small>
                <b className="nb-mono">{hariIni.waktuMasuk}</b>
                {hariIni.status && <span>{hariIni.status}</span>}
              </div>
              <div>
                <small>Pulang</small>
                <b className="nb-mono">{hariIni.waktuKeluar || "--:--"}</b>
                {!hariIni.waktuKeluar && hariIni.jamPulangSeharusnya && <span>Wajib: {hariIni.jamPulangSeharusnya}</span>}
              </div>
            </div>
          )}
          {p.tandaHariIni && (
            <p className="nb-catatan" data-chip-lembur><Moon aria-hidden /><span>Ditandai lembur hari ini — hari kerja berikutnya {labelKompensasi(p.tandaHariIni.kompensasi, p.jamMasuk, p.jamKeluar)} (berlaku bila clock-out ≥ 1 jam setelah jam pulang).</span></p>
          )}
          {p.kompensasiHariIni && (
            <p className="nb-catatan" data-chip-kompensasi><CircleCheck aria-hidden /><span>Kompensasi lembur {teksTanggal(p.kompensasiHariIni.dari, { tahun: false })}: {labelKompensasi(p.kompensasiHariIni.tanda.kompensasi, p.jamMasuk, p.jamKeluar)}{p.kompensasiHariIni.terpakai ? " · terpakai" : ""}.</span></p>
          )}
        </section>

        <div className="nb-k-kanan">
          {/* UBIN RINGKASAN periode gaji berjalan */}
          <div className="nb-ubin-baris" title={`Periode ${labelRentang(periode)}`} data-ringkasan-periode={`${periode.dari}/${periode.sampai}`}>
            <div className="nb-ubin nb-hijau"><b data-ringkas="hadir">{ringkas ? ringkas.hadir : "–"}</b><span>Hadir</span></div>
            <div className="nb-ubin nb-pink"><b data-ringkas="terlambat">{ringkas ? ringkas.terlambat : "–"}</b><span>Terlambat</span></div>
            <div className="nb-ubin nb-putih"><b data-ringkas="sakit-izin">{ringkas ? ringkas.sakitIzin : "–"}</b><span>Izin</span></div>
            <div className="nb-ubin nb-biru"><b>{sisaCuti}</b><span>Sisa cuti</span></div>
          </div>

          {/* TUGAS SAYA */}
          <section className="nb-bagian" aria-labelledby="nb-judul-tugas">
            <div className="nb-bagian-kepala">
              <h2 id="nb-judul-tugas">Tugas saya</h2>
              <a href="/user/daily-task" className="nb-tautan">Lihat semua</a>
            </div>
            {p.myTasks.length === 0 ? (
              <p className="nb-baris" style={{ margin: 0, fontSize: 13 }}>Belum ada tugas untuk Anda. Brief baru akan muncul di sini.</p>
            ) : p.myTasks.map((t, i) => (
              <div key={t.id || i} className="nb-baris">
                <div>
                  <b>{t.title || "Tanpa judul"}</b>
                  <small>{t.publish_at ? new Date(t.publish_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "Belum dijadwalkan"}</small>
                </div>
                <span className={`nb-pil ${warnaTugas(t.status)}`}>{t.status || "Brief"}</span>
              </div>
            ))}
          </section>

          <div className="nb-dua-kolom">
            {/* RIWAYAT ABSENSI */}
            <section className="nb-bagian" aria-labelledby="nb-judul-riwayat">
              <div className="nb-bagian-kepala">
                <h2 id="nb-judul-riwayat">Riwayat absen</h2>
                <a href="/user/kehadiran" className="nb-tautan">Absen →</a>
              </div>
              {p.recentAttendances.length === 0 ? (
                <p className="nb-baris" style={{ margin: 0, fontSize: 13 }}>Belum ada riwayat — absen pertama Anda akan tercatat di sini.</p>
              ) : p.recentAttendances.map((att, i) => (
                <div key={i} className="nb-baris">
                  <div>
                    <b title={att.tanggal}>{teksTanggal(att.tanggal)}</b>
                    <small>{att.lokasi}</small>
                  </div>
                  <div className="nb-baris-kanan">
                    <span className="nb-mono" style={{ fontSize: 12.5 }}>{att.waktuMasuk}{att.waktuKeluar ? ` – ${att.waktuKeluar}` : ""}</span>
                    <div>
                      {!att.waktuKeluar && String(att.tanggal ?? "") < p.todayISO
                        ? <span className="nb-tag nb-jingga">Lupa absen pulang</span>
                        : <span className={`nb-tag ${att.status === "Terlambat" ? "nb-pink" : "nb-hijau"}`}>{att.status}</span>}
                      {Number(att.lembur_menit) >= MENIT_LEMBUR_MIN && <span className="nb-tag nb-kuning" title="Lembur tercatat">Lembur {formatDurasi(Number(att.lembur_menit))}</span>}
                      {att.kompensasi_lembur && <span className="nb-tag nb-hijau" title={`Kompensasi lembur ${att.kompensasi_dari || ""}`}>Kompensasi</span>}
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* STATUS PENGAJUAN */}
            <section className="nb-bagian" aria-labelledby="nb-judul-pengajuan-saya">
              <div className="nb-bagian-kepala">
                <h2 id="nb-judul-pengajuan-saya">Pengajuan</h2>
                <a href="/user/kehadiran" className="nb-tautan">Ajukan →</a>
              </div>
              {p.recentLeaves.length === 0 ? (
                <p className="nb-baris" style={{ margin: 0, fontSize: 13 }}>Belum ada pengajuan.</p>
              ) : p.recentLeaves.map((leave, i) => (
                <div key={i} className="nb-baris">
                  <div>
                    <b>{leave.jenis}</b>
                    <small title={leave.tanggal}>{teksTanggal(leave.tanggal)}</small>
                  </div>
                  <span className={`nb-pil ${warnaPengajuan(leave.status)}`}>{leave.status}</span>
                </div>
              ))}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
