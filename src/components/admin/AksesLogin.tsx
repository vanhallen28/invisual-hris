// src/components/admin/AksesLogin.tsx
// Menu HR untuk AKSES LOGIN (akses-login.sql, 2 Nov 2026) — terpisah dari Arsip:
//   LencanaAkses · TombolAkses · DialogAkses · PanelAkses · BagianAksesForm · KeteranganAkses
//   (halaman Karyawan) dan KartuAksesOtomatis (halaman Pengaturan).
// Semua perubahan lewat RPC atur_akses_login (lib/aksesLogin). Database yang memblokir akun,
// memutus sesi, menghapus langganan notifikasi, dan mencatat Log Aktivitas.
// Bila SQL belum dijalankan, halaman tidak merender komponen ini (kolomAksesAda = false).
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- data baris karyawan dinamis, sama seperti halaman Karyawan */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, LockOpen, CalendarClock, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { useJebakFokus } from "@/lib/fokus";
import { isOwnerEmail } from "@/lib/owners";
import { teksTanggal } from "@/lib/tanggalTampil";
import {
  ALASAN_AKSES, adaPengecualian, akunHR, aksesDitutup, akanDitutupOtomatis, alasanKedaluwarsa, aturAksesLogin, bacaSakelarOtomatis,
  bukaPerluPengecualian, hariIniWib, simpanSakelarOtomatis, teksStatusAkses,
} from "@/lib/aksesLogin";

type Emp = Record<string, any>;
export type ModeAkses = "tutup" | "buka" | "pengecualian";

const emailSama = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
/** Baris milik akun yang sedang login (email atau emailLogin). */
const barisSaya = (e: Emp, emailSaya: string) => emailSama(e.email, emailSaya) || emailSama(e.emailLogin, emailSaya);
const tglPendek = (s?: string | null) => (s ? teksTanggal(String(s).slice(0, 10), { hari: false }) : "");

/** Email akun HR yang sedang login (untuk menyembunyikan tombol di barisnya sendiri). */
export function useEmailSaya(): string {
  const [email, setEmail] = useState("");
  useEffect(() => {
    let hidup = true;
    supabase.auth.getUser().then(({ data }) => { if (hidup) setEmail(String(data?.user?.email || "").toLowerCase()); }).catch(() => {});
    return () => { hidup = false; };
  }, []);
  return email;
}

/** Sakelar "Tutup akses otomatis" (bawaan mati). */
export function useSakelarOtomatis(): boolean {
  const [nyala, setNyala] = useState(false);
  useEffect(() => {
    let hidup = true;
    bacaSakelarOtomatis(supabase).then((v) => { if (hidup) setNyala(v); });
    return () => { hidup = false; };
  }, []);
  return nyala;
}

export function LencanaAkses({ emp }: { emp: Emp }) {
  if (!aksesDitutup(emp)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide bg-red-500/10 text-red-400 border border-red-500/25" title={teksStatusAkses(emp)} data-lencana-akses>
      <Lock className="w-3 h-3" aria-hidden />Akses ditutup
    </span>
  );
}

/** Tombol per baris. varian "ikon" (tabel desktop) atau "teks" (kartu ponsel). */
export function TombolAkses({ emp, emailSaya, onPilih, varian = "ikon" }: { emp: Emp; emailSaya: string; onPilih: (emp: Emp, mode: ModeAkses) => void; varian?: "ikon" | "teks" }) {
  if (!emailSaya || barisSaya(emp, emailSaya)) return null;   // tunggu email diketahui; tak ada tombol di baris sendiri
  const tutup = aksesDitutup(emp);
  const label = tutup ? `Buka akses login ${emp.nama}` : `Tutup akses login ${emp.nama}`;
  if (varian === "teks") {
    return (
      <button type="button" onClick={() => onPilih(emp, tutup ? "buka" : "tutup")} data-tombol-akses={tutup ? "buka" : "tutup"} aria-label={label}
        className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95 flex items-center gap-1.5 ${tutup ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20" : "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10"}`}>
        {tutup ? <LockOpen className="w-4 h-4" aria-hidden /> : <Lock className="w-4 h-4" aria-hidden />}{tutup ? "Buka akses" : "Tutup akses"}
      </button>
    );
  }
  return (
    <button type="button" onClick={() => onPilih(emp, tutup ? "buka" : "tutup")} data-tombol-akses={tutup ? "buka" : "tutup"} title={tutup ? "Buka akses login" : "Tutup akses login"} aria-label={label}
      className={`sentuh p-2 rounded-lg transition-all border border-transparent ${tutup ? "text-green-400/80 hover:text-green-300 hover:bg-green-500/10 hover:border-green-500/20" : "text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/10"}`}>
      {tutup ? <LockOpen className="w-5 h-5" aria-hidden /> : <Lock className="w-5 h-5" aria-hidden />}
    </button>
  );
}

/** Jendela konfirmasi tutup / buka / pengecualian. */
export function DialogAkses({ emp, mode, onTutup, onSelesai }: { emp: Emp; mode: ModeAkses; onTutup: () => void; onSelesai: () => void }) {
  const toast = useToast();
  const hari = hariIniWib();
  const sakelar = useSakelarOtomatis();
  const kotak = useRef<HTMLDivElement>(null);
  const [alasan, setAlasan] = useState<string>(alasanKedaluwarsa(emp, hari) || "keluar");
  const [arsipkan, setArsipkan] = useState(emp.isAktif !== false);
  const [sampai, setSampai] = useState<string>(emp.tetapAksesSampai && String(emp.tetapAksesSampai) >= hari ? String(emp.tetapAksesSampai).slice(0, 10) : "");
  const [yakinOwner, setYakinOwner] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  useJebakFokus(kotak, true, () => { if (!sibuk) onTutup(); });

  const owner = isOwnerEmail(emp.email) || isOwnerEmail(emp.emailLogin);
  const hr = akunHR(emp);
  const wajibSampai = mode === "buka" && bukaPerluPengecualian(emp, hari, sakelar);

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat("");
    if (mode === "tutup" && (owner || hr) && !yakinOwner) { setGalat(`Centang konfirmasi untuk menutup akses akun ${owner ? "owner" : "HR/admin"}.`); return; }
    if (wajibSampai && (!sampai || sampai < hari)) { setGalat("Isi “Tetap akses sampai” (hari ini atau setelahnya) — tanggal magang/kontraknya sudah lewat dan penutupan otomatis menyala."); return; }
    if (sampai && sampai < hari) { setGalat("Tanggal “Tetap akses sampai” tidak boleh sebelum hari ini."); return; }
    setSibuk(true);
    const r = await aturAksesLogin(supabase, { idKaryawan: emp.idKaryawan, aksi: mode, alasan, sampai: sampai || null, arsipkan: mode === "tutup" && arsipkan });
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal menyimpan."); return; }
    toast.sukses(mode === "tutup" ? `Akses login ${emp.nama} ditutup.` : mode === "buka" ? `Akses login ${emp.nama} dibuka kembali.` : sampai ? `${emp.nama} tetap bisa akses sampai ${tglPendek(sampai)}.` : `Pengecualian ${emp.nama} dihapus.`);
    onSelesai();
  };

  const judul = mode === "tutup" ? "Tutup akses login?" : mode === "buka" ? "Buka akses login?" : "Pengecualian penutupan otomatis";
  const ke = alasanKedaluwarsa(emp, hari);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !sibuk) onTutup(); }} role="dialog" aria-modal="true" aria-labelledby="judul-akses" data-dialog-akses={mode}>
      <div ref={kotak} className="bg-kartu border border-white/10 rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-white/5 bg-kartu-hover flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h2 id="judul-akses" className="text-lg font-bold text-white">{judul}</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate"><span className="text-tint font-bold">{emp.nama}</span> · {emp.idKaryawan}{emp.status ? ` · ${emp.status}` : ""}</p>
          </div>
          <button type="button" onClick={onTutup} disabled={sibuk} className="text-gray-500 hover:text-white text-xl leading-none px-2" aria-label="Tutup">×</button>
        </div>
        <form onSubmit={simpan} noValidate className="p-6 space-y-4">
          {mode === "tutup" && (
            <>
              <ul className="text-xs text-gray-300 space-y-1.5 bg-red-500/[0.06] border border-red-500/20 rounded-xl p-3.5 list-disc pl-7">
                <li>Tidak bisa login lagi (email/password maupun Google).</li>
                <li>Sesi yang masih terbuka diputus; notifikasi ke HP-nya berhenti.</li>
                <li>Data karyawan, absensi, slip, chat, dan tugasnya <b>tetap tersimpan</b>. Bisa dibuka kembali kapan saja.</li>
              </ul>
              <div>
                <label htmlFor="akses-alasan" className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Alasan</label>
                <select id="akses-alasan" value={alasan} onChange={(e) => setAlasan(e.target.value)} className="w-full bg-input border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white">
                  {ALASAN_AKSES.map((a) => <option key={a} value={a}>{a[0].toUpperCase() + a.slice(1)}</option>)}
                </select>
              </div>
              <label className="flex items-start gap-2.5 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" checked={arsipkan} onChange={(e) => setArsipkan(e.target.checked)} className="accent-primer w-4 h-4 mt-0.5" data-arsipkan />
                <span>Sekalian arsipkan <span className="block text-[11px] text-gray-500">Disembunyikan dari daftar aktif, statistik, dan absen.</span></span>
              </label>
              {(owner || hr) && (
                <label className="flex items-start gap-2.5 text-sm text-amber-300 cursor-pointer bg-amber-500/[0.07] border border-amber-500/25 rounded-xl p-3">
                  <input type="checkbox" checked={yakinOwner} onChange={(e) => setYakinOwner(e.target.checked)} className="accent-primer w-4 h-4 mt-0.5" data-yakin-owner />
                  <span>Ini akun <b>{owner ? "owner" : "HR/admin"}</b>. Saya yakin ingin menutup aksesnya.</span>
                </label>
              )}
            </>
          )}
          {mode !== "tutup" && (
            <div>
              {mode === "buka" && <p className="text-xs text-gray-300 mb-3">{teksStatusAkses(emp) || "Akses ditutup."} Setelah dibuka, ia bisa login lagi dengan password lamanya.</p>}
              {ke && <p className="text-[11px] text-amber-300/90 mb-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-1.5">{ke === "magang selesai" ? `Masa magang berakhir ${tglPendek(emp.tanggalSelesaiMagang)}.` : `Kontrak berakhir ${tglPendek(emp.tanggalBerakhirKontrak)}.`} {sakelar ? "Penutupan otomatis menyala — tanpa pengecualian, akses akan ditutup lagi malam ini." : "Penutupan otomatis sedang mati."}</p>}
              <label htmlFor="akses-sampai" className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Tetap akses sampai {wajibSampai ? <span className="text-red-400">(wajib)</span> : <span className="normal-case font-normal text-gray-500">(opsional)</span>}</label>
              <input id="akses-sampai" type="date" value={sampai} min={hari} onChange={(e) => setSampai(e.target.value)} className="w-full bg-input border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white" />
              <p className="text-[11px] text-gray-500 mt-1">Selama tanggal ini belum lewat, penutupan otomatis melewati karyawan ini.{mode === "pengecualian" ? " Kosongkan untuk menghapus pengecualian." : ""}</p>
            </div>
          )}
          {galat && <p className="text-xs text-red-400 font-medium" role="alert" data-galat-akses>{galat}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onTutup} disabled={sibuk} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl text-sm border border-white/10">Batal</button>
            <button type="submit" disabled={sibuk} className={`flex-1 py-2.5 font-bold rounded-xl text-sm disabled:opacity-50 ${mode === "tutup" ? "bg-red-600 hover:bg-red-500 text-white" : "bg-white text-black hover:bg-gray-200"}`} data-simpan-akses>
              {sibuk ? "Menyimpan…" : mode === "tutup" ? "Tutup akses" : mode === "buka" ? "Buka akses" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

/** Panel pengingat di atas daftar karyawan. Hanya menampilkan; HR yang memutuskan. */
export function PanelAkses({ employees, emailSaya, onPilih }: { employees: Emp[]; emailSaya: string; onPilih: (emp: Emp, mode: ModeAkses) => void }) {
  const sakelar = useSakelarOtomatis();
  const [bukaArsip, setBukaArsip] = useState(false);
  const hari = hariIniWib();
  const bukanSaya = (e: Emp) => !barisSaya(e, emailSaya);
  const berakhir = employees.filter((e) => bukanSaya(e) && !aksesDitutup(e) && !!alasanKedaluwarsa(e, hari));
  const idBerakhir = new Set(berakhir.map((e) => e.idKaryawan));
  // Akun HR/admin yang sengaja diarsip (agar tak masuk statistik) tidak diingatkan di sini.
  const arsipAktif = employees.filter((e) => bukanSaya(e) && e.isAktif === false && !aksesDitutup(e) && !idBerakhir.has(e.idKaryawan) && !akunHR(e));
  const magangSegera = employees
    .filter((e) => e.isAktif !== false && !aksesDitutup(e) && e.tanggalSelesaiMagang && String(e.tanggalSelesaiMagang).slice(0, 10) >= hari)
    .map((e) => ({ e, sisa: Math.round((Date.parse(String(e.tanggalSelesaiMagang).slice(0, 10)) - Date.parse(hari)) / 86400000) }))
    .filter((x) => x.sisa <= 7).sort((a, b) => a.sisa - b.sisa);
  if (!berakhir.length && !arsipAktif.length && !magangSegera.length) return null;

  const baris = "flex flex-wrap items-center justify-between gap-2 text-xs bg-black/20 rounded-lg px-3 py-2";
  const tombol = "px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors";
  return (
    <div className="flex flex-col gap-3" data-panel-akses>
      {magangSegera.length > 0 && (
        <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06]" data-panel-magang-segera>
          <p className="text-sm font-bold text-cyan-300 mb-2.5">Pengingat Magang — {magangSegera.length} anak magang selesai dalam 7 hari</p>
          <div className="flex flex-col gap-1.5">
            {magangSegera.map(({ e, sisa }) => (
              <div key={e.idKaryawan} className={baris}>
                <span className="font-bold text-white truncate">{e.nama} <span className="text-gray-500 font-normal">· {e.institusiMagang || e.jabatan || "-"}</span></span>
                <span className="text-cyan-300 font-mono">{sisa === 0 ? "Selesai HARI INI" : `${sisa} hari lagi`} ({tglPendek(e.tanggalSelesaiMagang)})</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {berakhir.length > 0 && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/[0.06]" data-panel-berakhir>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
            <p className="text-sm font-bold text-red-300">
              {sakelar ? `Akses ditutup otomatis malam ini (00:05) — ${berakhir.filter((e) => akanDitutupOtomatis(e, hari)).length} orang` : `Magang/kontrak sudah berakhir, akses masih aktif — ${berakhir.length} orang`}
            </p>
            <a href="/admin/pengaturan#akses-otomatis" className="text-[11px] font-bold text-gray-400 hover:text-white underline underline-offset-2">Penutupan otomatis: {sakelar ? "menyala" : "mati"}</a>
          </div>
          <div className="flex flex-col gap-1.5">
            {berakhir.map((e) => {
              const ke = alasanKedaluwarsa(e, hari);
              const kecuali = adaPengecualian(e, hari);
              const hr = String(e.email || "").toLowerCase().endsWith("@invisual.studio");
              return (
                <div key={e.idKaryawan} className={baris} data-baris-berakhir={e.idKaryawan}>
                  <span className="min-w-0">
                    <span className="font-bold text-white">{e.nama}</span>
                    <span className="text-gray-400"> · {ke === "magang selesai" ? `magang selesai ${tglPendek(e.tanggalSelesaiMagang)}` : `kontrak berakhir ${tglPendek(e.tanggalBerakhirKontrak)}`}</span>
                    {kecuali && <span className="text-green-400"> · pengecualian s/d {tglPendek(e.tetapAksesSampai)}</span>}
                    {hr && <span className="text-gray-500"> · akun @invisual.studio (tidak otomatis)</span>}
                  </span>
                  <span className="flex gap-1.5 shrink-0">
                    <button type="button" onClick={() => onPilih(e, "pengecualian")} className={`${tombol} bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 inline-flex items-center gap-1`}><CalendarClock className="w-3.5 h-3.5" aria-hidden />{kecuali ? "Ubah pengecualian" : "Beri pengecualian"}</button>
                    <button type="button" onClick={() => onPilih(e, "tutup")} className={`${tombol} bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25`} data-tutup-sekarang={e.idKaryawan}>Tutup sekarang</button>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {arsipAktif.length > 0 && (
        <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03]" data-panel-arsip-aktif>
          <button type="button" onClick={() => setBukaArsip((v) => !v)} aria-expanded={bukaArsip} className="w-full flex items-center justify-between gap-2 text-left">
            <span className="text-sm font-bold text-gray-200">Diarsip tapi akses masih aktif — {arsipAktif.length} orang <span className="text-gray-500 font-normal text-xs">({arsipAktif.filter((e) => e.isFreelancer).length} freelancer)</span></span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${bukaArsip ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {bukaArsip && (
            <div className="flex flex-col gap-1.5 mt-3">
              <p className="text-[11px] text-gray-500 mb-1">Biarkan aktif untuk freelancer atau yang memang masih perlu akses; tutup untuk yang sudah keluar.</p>
              {arsipAktif.map((e) => (
                <div key={e.idKaryawan} className={baris} data-baris-arsip={e.idKaryawan}>
                  <span className="min-w-0"><span className="font-bold text-white">{e.nama}</span><span className="text-gray-500"> · {e.status || "-"}</span>
                    {e.isFreelancer && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase">Freelancer</span>}
                  </span>
                  <button type="button" onClick={() => onPilih(e, "tutup")} className={`${tombol} bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 inline-flex items-center gap-1`}><Lock className="w-3.5 h-3.5" aria-hidden />Tutup akses</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Bagian di form ubah karyawan. */
export function BagianAksesForm({ emp, emailSaya, onPilih }: { emp: Emp; emailSaya: string; onPilih: (emp: Emp, mode: ModeAkses) => void }) {
  const hari = hariIniWib();
  const tutup = aksesDitutup(emp);
  const sendiri = !emailSaya || barisSaya(emp, emailSaya);
  return (
    <div className={`p-5 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${tutup ? "bg-red-500/[0.04] border-red-500/25" : "bg-input border-white/5"}`} data-bagian-akses>
      <div className="pr-3 min-w-0">
        <h3 className="text-xs font-bold text-gray-400 uppercase mb-1 font-mono">Akses Login</h3>
        <p className="text-[11px] text-gray-500">
          {tutup ? teksStatusAkses(emp) : "Aktif — bisa login ke HRIS. Terpisah dari status Arsip di atas."}
          {!tutup && adaPengecualian(emp, hari) && <span className="text-green-400"> Pengecualian penutupan otomatis s/d {tglPendek(emp.tetapAksesSampai)}.</span>}
          {sendiri && " (akun Anda sendiri — tidak bisa diubah dari sini)"}
        </p>
      </div>
      {!sendiri && (
        <div className="flex gap-2 shrink-0">
          {!tutup && <button type="button" onClick={() => onPilih(emp, "pengecualian")} className="px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 inline-flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" aria-hidden />Pengecualian</button>}
          <button type="button" onClick={() => onPilih(emp, tutup ? "buka" : "tutup")} className={`px-3 py-2 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 ${tutup ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20" : "bg-red-500/10 text-red-300 border-red-500/25 hover:bg-red-500/20"}`}>
            {tutup ? <LockOpen className="w-3.5 h-3.5" aria-hidden /> : <Lock className="w-3.5 h-3.5" aria-hidden />}{tutup ? "Buka akses" : "Tutup akses"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Satu baris keterangan di profil karyawan. */
export function KeteranganAkses({ emp }: { emp: Emp }) {
  if (!aksesDitutup(emp)) return null;
  return <p className="col-span-2 text-xs font-bold text-red-400 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2 flex items-center gap-2" data-keterangan-akses><Lock className="w-3.5 h-3.5" aria-hidden />{teksStatusAkses(emp)}</p>;
}

/** Kartu sakelar di Pengaturan. */
export function KartuAksesOtomatis() {
  const [nyala, setNyala] = useState(false);
  const [siap, setSiap] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [terpasang, setTerpasang] = useState(false);
  const toast = useToast();
  useEffect(() => {
    let h = true;
    (async () => {
      // Kartu hanya tampil bila akses-login.sql sudah dijalankan (kolom aksesLogin ada).
      try { const { error } = await supabase.from("employees").select("aksesLogin").limit(1); if (!h || error) return; } catch { return; }
      const v = await bacaSakelarOtomatis(supabase);
      if (h) { setTerpasang(true); setNyala(v); setSiap(true); }
    })();
    return () => { h = false; };
  }, []);
  const ubah = async () => {
    const baru = !nyala;
    setSibuk(true);
    const ok = await simpanSakelarOtomatis(supabase, baru);
    setSibuk(false);
    if (ok) { setNyala(baru); toast.sukses(baru ? "Penutupan akses otomatis dinyalakan." : "Penutupan akses otomatis dimatikan."); }
    else toast.gagal("Gagal menyimpan. Pastikan akses-login.sql sudah dijalankan.");
  };
  if (!terpasang) return null;
  return (
    <div id="akses-otomatis" className="p-5 mb-5 rounded-xl border border-white/10 bg-white/[0.03] scroll-mt-24" data-kartu-akses-otomatis>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">Akses Login — Tutup Otomatis saat Magang/Kontrak Berakhir</h3>
          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">Jika aktif, setiap hari pukul <span className="text-tint font-bold">00:05 WIB</span> akses login ditutup untuk karyawan yang tanggal selesai magang atau berakhir kontraknya sudah lewat, kecuali yang diberi pengecualian. Akun @invisual.studio tidak pernah ditutup otomatis. Penutupan manual tetap lewat tombol 🔒 di halaman Karyawan.</p>
        </div>
        <button type="button" role="switch" aria-checked={nyala} aria-label="Tutup akses otomatis" onClick={ubah} disabled={sibuk || !siap} className={`shrink-0 w-14 h-8 rounded-full border transition-colors relative ${nyala ? "bg-primer-terang border-primer" : "bg-white/10 border-white/20"} ${sibuk || !siap ? "opacity-50" : ""}`} data-sakelar-akses>
          <span className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${nyala ? "left-7" : "left-1"}`}></span>
        </button>
      </div>
      <p className={`text-[11px] font-bold mt-3 ${nyala ? "text-green-400" : "text-gray-500"}`}>{nyala ? "AKTIF — akses ditutup otomatis setelah magang/kontrak berakhir" : "MATI — akses hanya ditutup manual oleh HR"}</p>
    </div>
  );
}
