// src/components/management/DetailUsulan.tsx
// Detail usulan: isi, linimasa, cek dampak, dan aksi kontekstual. Tombol hanya tampil bila bisa() DAN transisiSah();
// database tetap menjadi penentu akhir (pesan galat RPC ditampilkan apa adanya).
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { teksTanggal, teksTanggalISO } from "@/lib/tanggalTampil";
import type { PetaLibur } from "@/lib/hariLibur";
import { bisa, DIVISI_LABEL, type PeranManagement } from "@/lib/management/akses";
import {
  BATAS_DARURAT_PER_BULAN, LABEL_DAMPAK, LABEL_JALUR, LABEL_STATUS, SUMBER_USULAN, ajukanKeberatan, ajukanUlang, batasGugur, isiDampak,
  putuskanUsulan, teruskanUsulan, terlambatDicatat, transisiSah, umurMerah, type NilaiDampak, type StatusUsulan,
} from "@/lib/management/usulan";
import { isoWib, rapatSasaran, tambahHariIso } from "@/lib/management/hariKerja";
import { Dialog, Lencana, PesanGalat, kelasInput, kelasLabel, kelasTombol, kelasTombolUtama, type Warna } from "./ui";
import { WARNA_STATUS, umurHari, type Dampak, type Usulan } from "./TabUsulan";

const WARNA_DAMPAK: Record<NilaiDampak, Warna> = { tidak_berdampak: "hijau", perlu_penyesuaian: "kuning", bertentangan: "merah", tidak_mengisi: "abu" };
const jam = (iso: string) => { const d = new Date(new Date(iso).getTime() + 7 * 3_600_000); return `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const waktu = (iso: string | null | undefined) => (iso ? `${teksTanggal(isoWib(new Date(iso)))} ${jam(iso)}` : "—");
type Aksi = "teruskan" | "dampak" | "putuskan" | "evaluasi" | "keberatan";

export default function DetailUsulan({ u, semua, dampak, peran, divisi, peta, hariRapat = 1, onKembali, onUbah }: {
  u: Usulan; semua: Usulan[]; dampak: Dampak[]; peran: PeranManagement[]; divisi: string[]; peta: PetaLibur | null; hariRapat?: number; onKembali: () => void; onUbah: () => Promise<void> | void;
}) {
  const toast = useToast();
  const [aksi, setAksi] = useState<Aksi | null>(null);
  const [divisiDampak, setDivisiDampak] = useState<string>("");
  const [gugur, setGugur] = useState<string | null>(null);
  const [galat, setGalat] = useState("");
  const sekarang = new Date();
  const hariIni = isoWib(sekarang);

  useEffect(() => {
    if (u.status !== "berlaku_darurat" || !u.berlaku_sejak) return;
    let hidup = true;
    batasGugur(supabase, u.berlaku_sejak).then((g) => { if (hidup) setGugur(g); });
    return () => { hidup = false; };
  }, [u.status, u.berlaku_sejak]);

  const urutDarurat = u.jalur === "darurat"
    ? semua.filter((x) => x.jalur === "darurat" && isoWib(new Date(x.dibuat_pada)).slice(0, 7) === isoWib(new Date(u.dibuat_pada)).slice(0, 7))
        .sort((a, b) => a.dibuat_pada.localeCompare(b.dibuat_pada)).findIndex((x) => x.id === u.id) + 1
    : 0;
  const dampakSaya = dampak.filter((d) => divisi.includes(d.divisi));
  const bisaKeberatan = u.status === "masa_keberatan" && (!u.masa_keberatan_sampai || Date.parse(u.masa_keberatan_sampai) > sekarang.getTime())
    && (peran.includes("pm") || divisi.some((d) => !u.divisi_terdampak.includes(d)));
  const dampakTerbuka = !u.tenggat_dampak || Date.parse(u.tenggat_dampak) > sekarang.getTime();
  const ujiSelesai = u.status === "uji_coba" && !!u.uji_coba_sampai && u.uji_coba_sampai <= hariIni;

  const sederhana = async (fn: () => Promise<{ ok: boolean; pesan?: string }>, sukses: string) => {
    setGalat("");
    const r = await fn();
    if (!r.ok) { setGalat(r.pesan || "Gagal menyimpan."); return; }
    toast.sukses(sukses); await onUbah();
  };
  const selesai = async (pesan: string) => { setAksi(null); toast.sukses(pesan); await onUbah(); };

  const lini: { label: string; waktu: string; ket?: string }[] = [{ label: "Diajukan", waktu: u.dibuat_pada, ket: u.pengusul_email }];
  if (u.diteruskan_pada) lini.push({ label: "Diteruskan ke cek dampak", waktu: u.diteruskan_pada, ket: u.rapat_sasaran ? `rapat sasaran ${teksTanggalISO(u.rapat_sasaran)}` : undefined });
  if (u.diputuskan_pada) lini.push({ label: "Diputuskan", waktu: u.diputuskan_pada, ket: [u.diputuskan_oleh, u.keputusan_alasan ? `“${u.keputusan_alasan}”` : ""].filter(Boolean).join(" · ") });

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-kartu p-5" data-detail-usulan={u.nomor}>
      <button type="button" className={kelasTombol} onClick={onKembali}>← Semua usulan</button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-gray-500">{u.nomor} · Jalur {LABEL_JALUR[u.jalur].toLowerCase()}</p>
          <h2 className="mt-1 text-lg font-bold text-white">{u.judul}</h2>
        </div>
        <div className="flex flex-wrap gap-1.5" data-lencana-usulan>
          <Lencana warna={WARNA_STATUS[u.status]}>{LABEL_STATUS[u.status]}</Lencana>
          {umurMerah(u.dibuat_pada, u.status, sekarang) && <Lencana warna="merah">Lewat 7 hari</Lencana>}
          {u.jalur === "darurat" && terlambatDicatat(u.dibuat_pada, u.berlaku_sejak) && <Lencana warna="merah">Terlambat dicatat (&gt; 24 jam)</Lencana>}
          {urutDarurat > BATAS_DARURAT_PER_BULAN && <Lencana warna="kuning">Melebihi batas — dibahas di Review Bulanan</Lencana>}
          {u.atas_nama_owner && <Lencana warna="ungu">Atas nama owner</Lencana>}
        </div>
      </div>
      {u.status === "berlaku_darurat" && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2 text-xs text-red-200" data-info-gugur>
          Berlaku sejak {waktu(u.berlaku_sejak)}{gugur ? <> · Gugur otomatis pada {waktu(gugur)} bila belum disahkan</> : null}.
        </p>
      )}
      {u.status === "masa_keberatan" && u.masa_keberatan_sampai && (
        <p className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-xs text-violet-200">Masa keberatan sampai {waktu(u.masa_keberatan_sampai)}. Tanpa keberatan, otomatis berlaku.</p>
      )}
      {u.status === "uji_coba" && u.uji_coba_sampai && (
        <p className="rounded-lg border border-violet-500/20 bg-violet-500/[0.06] px-3 py-2 text-xs text-violet-200">Uji coba sampai {teksTanggalISO(u.uji_coba_sampai)}{ujiSelesai ? " — sudah waktunya dievaluasi." : "."}</p>
      )}

      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
        <dl className="grid gap-3 text-sm">
          <Isian label="Masalah">{u.masalah}</Isian>
          <Isian label="Perubahan yang diusulkan">{u.perubahan}</Isian>
          <Isian label="Bagian Pedoman">{u.bagian_pedoman}</Isian>
          <Isian label="Divisi terdampak">{u.divisi_terdampak.map((d) => DIVISI_LABEL[d] || d).join(", ")}</Isian>
          <Isian label="Sumber">{SUMBER_USULAN.find((s) => s.nilai === u.sumber)?.label || u.sumber} · umur {umurHari(u.dibuat_pada, sekarang)} hari</Isian>
        </dl>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Linimasa</p>
          <ol className="mt-2 border-l-2 border-white/10 pl-4">
            {lini.map((l, i) => (
              <li key={i} className="relative pb-3 text-sm text-gray-200 before:absolute before:-left-[21px] before:top-1.5 before:h-2.5 before:w-2.5 before:rounded-full before:border-2 before:border-white/20 before:bg-kartu">
                {l.label}<span className="block text-xs text-gray-500">{waktu(l.waktu)}{l.ket ? ` · ${l.ket}` : ""}</span>
              </li>
            ))}
            <li className="relative text-sm font-semibold text-white before:absolute before:-left-[21px] before:top-1.5 before:h-2.5 before:w-2.5 before:rounded-full before:bg-white">
              {LABEL_STATUS[u.status]}<span className="block text-xs font-normal text-gray-500">status sekarang</span>
            </li>
          </ol>
        </div>
      </div>

      {dampak.length > 0 && (
        <div className="space-y-2" data-tabel-dampak>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-white">Cek dampak</h3>
            {u.tenggat_dampak && <span className="text-xs text-gray-500">Tenggat {waktu(u.tenggat_dampak)}{u.rapat_sasaran ? ` · rapat sasaran ${teksTanggalISO(u.rapat_sasaran)}` : ""}</span>}
          </div>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[480px] text-sm">
              <thead><tr className="border-b border-white/10 text-left text-[10.5px] uppercase tracking-wide text-gray-500"><th className="px-3 py-2">Divisi</th><th className="px-3 py-2">Penilaian</th><th className="px-3 py-2">Alasan</th></tr></thead>
              <tbody>{dampak.sort((a, b) => a.divisi.localeCompare(b.divisi)).map((d) => (
                <tr key={d.divisi} className="border-b border-white/5 last:border-0" data-dampak={d.divisi}>
                  <td className="px-3 py-2 text-gray-200">{DIVISI_LABEL[d.divisi] || d.divisi}</td>
                  <td className="px-3 py-2">{d.nilai ? <Lencana warna={WARNA_DAMPAK[d.nilai as NilaiDampak]}>{LABEL_DAMPAK[d.nilai as NilaiDampak]}</Lencana> : <Lencana warna="kuning">Menunggu</Lencana>}</td>
                  <td className="px-3 py-2 text-gray-400">{d.alasan || "—"}</td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>
      )}

      <PesanGalat pesan={galat} />
      <div className="flex flex-wrap gap-2" data-aksi-usulan>
        {bisa(peran, "teruskan_usulan") && u.status === "diajukan" && transisiSah(u.status, "cek_dampak") &&
          <button type="button" className={kelasTombolUtama} onClick={() => setAksi("teruskan")} data-aksi="teruskan">Teruskan ke cek dampak</button>}
        {bisa(peran, "isi_dampak") && u.status === "cek_dampak" && dampakTerbuka && dampakSaya.map((d) => (
          <button key={d.divisi} type="button" className={kelasTombolUtama} onClick={() => { setDivisiDampak(d.divisi); setAksi("dampak"); }} data-aksi="isi-dampak" data-divisi={d.divisi}>
            {d.nilai ? "Ubah" : "Isi"} cek dampak {DIVISI_LABEL[d.divisi]}
          </button>))}
        {bisa(peran, "putuskan_usulan") && (u.status === "siap_diputuskan" || u.status === "berlaku_darurat") &&
          <button type="button" className={kelasTombolUtama} onClick={() => setAksi("putuskan")} data-aksi="putuskan">Putuskan</button>}
        {bisa(peran, "putuskan_usulan") && ujiSelesai &&
          <button type="button" className={kelasTombolUtama} onClick={() => setAksi("evaluasi")} data-aksi="evaluasi">Evaluasi uji coba</button>}
        {bisa(peran, "teruskan_usulan") && u.status === "ditunda" && transisiSah(u.status, "siap_diputuskan") &&
          <button type="button" className={kelasTombol} onClick={() => sederhana(() => ajukanUlang(supabase, u.id), `${u.nomor} kembali ke Siap diputuskan.`)} data-aksi="ajukan-ulang">Ajukan ulang</button>}
        {bisaKeberatan && transisiSah(u.status, "cek_dampak") &&
          <button type="button" className={`${kelasTombol} border-red-500/30 text-red-300`} onClick={() => setAksi("keberatan")} data-aksi="keberatan">Ajukan keberatan</button>}
      </div>

      {aksi === "teruskan" && <DialogTeruskan u={u} peta={peta} hariRapat={hariRapat} onTutup={() => setAksi(null)} onSelesai={selesai} />}
      {aksi === "dampak" && <DialogDampak u={u} divisi={divisiDampak} awal={dampak.find((d) => d.divisi === divisiDampak)} onTutup={() => setAksi(null)} onSelesai={selesai} />}
      {(aksi === "putuskan" || aksi === "evaluasi") && <DialogPutuskan u={u} semua={semua} hariIni={hariIni} onTutup={() => setAksi(null)} onSelesai={selesai} />}
      {aksi === "keberatan" && <DialogKeberatan u={u} onTutup={() => setAksi(null)} onSelesai={selesai} />}
    </div>
  );
}

function Isian({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt><dd className="mt-0.5 whitespace-pre-wrap text-gray-200">{children}</dd></div>;
}

function Aksi2({ sibuk, onTutup, label, bahaya = false, data }: { sibuk: boolean; onTutup: () => void; label: string; bahaya?: boolean; data: string }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" className={kelasTombol} onClick={onTutup} disabled={sibuk}>Batal</button>
      <button type="submit" className={bahaya ? `${kelasTombol} border-red-500/40 bg-red-500/15 text-red-200` : kelasTombolUtama} disabled={sibuk} data-kirim={data}>{sibuk ? "Menyimpan…" : label}</button>
    </div>
  );
}

function DialogTeruskan({ u, peta, hariRapat, onTutup, onSelesai }: { u: Usulan; peta: PetaLibur | null; hariRapat: number; onTutup: () => void; onSelesai: (p: string) => void }) {
  const [div, setDiv] = useState<string[]>(u.divisi_terdampak);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const pra = rapatSasaran(new Date(), hariRapat, peta);
  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!div.length) { setGalat("Pilih minimal satu divisi."); return; }
    setSibuk(true); setGalat("");
    const r = await teruskanUsulan(supabase, u.id, div);
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal meneruskan."); return; }
    onSelesai(`${u.nomor} diteruskan ke cek dampak.`);
  };
  return (
    <Dialog judul={`Teruskan ${u.nomor}`} sub="Leader divisi terpilih menilai dampaknya sebelum rapat." onTutup={onTutup} sibuk={sibuk} data-dialog-usulan="teruskan">
      <form onSubmit={kirim} noValidate className="space-y-4">
        <fieldset><legend className="mb-1.5 text-xs font-semibold text-gray-400">Divisi yang menilai dampak</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">{["sosmed", "service", "marketplace", "hr", "semua"].map((d) => (
            <label key={d} className="flex items-center gap-1.5 text-sm text-gray-200"><input type="checkbox" checked={div.includes(d)} onChange={(e) => setDiv(e.target.checked ? [...div, d] : div.filter((x) => x !== d))} />{DIVISI_LABEL[d]}</label>))}</div>
        </fieldset>
        <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-300" data-pratinjau-rapat>Rapat sasaran <b>{teksTanggalISO(pra.rapat)}</b> · tenggat cek dampak <b>{teksTanggal(isoWib(pra.tenggatDampak))} 18.00</b> (hari kerja terakhir sebelum rapat, minimal 1 hari kerja dari sekarang).</p>
        <PesanGalat pesan={galat} />
        <Aksi2 sibuk={sibuk} onTutup={onTutup} label="Teruskan" data="teruskan" />
      </form>
    </Dialog>
  );
}

function DialogDampak({ u, divisi, awal, onTutup, onSelesai }: { u: Usulan; divisi: string; awal?: Dampak; onTutup: () => void; onSelesai: (p: string) => void }) {
  const [nilai, setNilai] = useState<string>(awal?.nilai && awal.nilai !== "tidak_mengisi" ? awal.nilai : "");
  const [alasan, setAlasan] = useState(awal?.alasan || "");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nilai) { setGalat("Pilih penilaian."); return; }
    if (nilai !== "tidak_berdampak" && !alasan.trim()) { setGalat("Alasan wajib untuk Perlu penyesuaian dan Bertentangan."); return; }
    setSibuk(true); setGalat("");
    const r = await isiDampak(supabase, u.id, divisi, nilai, alasan.trim());
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal menyimpan."); return; }
    onSelesai(r.data?.status === "siap_diputuskan" ? `Semua divisi sudah menilai — ${u.nomor} siap diputuskan.` : "Penilaian dampak tersimpan.");
  };
  return (
    <Dialog judul={`Cek dampak ${u.nomor}`} sub={`Divisi ${DIVISI_LABEL[divisi] || divisi}${u.tenggat_dampak ? ` · bisa diubah sampai ${waktu(u.tenggat_dampak)}` : ""}`} onTutup={onTutup} sibuk={sibuk} data-dialog-usulan="dampak">
      <form onSubmit={kirim} noValidate className="space-y-4">
        <fieldset className="grid gap-2"><legend className="mb-1 text-xs font-semibold text-gray-400">Penilaian</legend>
          {(["tidak_berdampak", "perlu_penyesuaian", "bertentangan"] as const).map((n) => (
            <label key={n} className="flex items-center gap-2 text-sm text-gray-200"><input type="radio" name="nilai-dampak" value={n} checked={nilai === n} onChange={() => setNilai(n)} data-nilai={n} />{LABEL_DAMPAK[n]}</label>))}
        </fieldset>
        <label className={kelasLabel} htmlFor="dp-alasan">Alasan<textarea id="dp-alasan" className={`${kelasInput} min-h-[76px]`} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Wajib untuk Perlu penyesuaian dan Bertentangan" /></label>
        <PesanGalat pesan={galat} />
        <Aksi2 sibuk={sibuk} onTutup={onTutup} label="Simpan penilaian" data="dampak" />
      </form>
    </Dialog>
  );
}

function DialogPutuskan({ u, semua, hariIni, onTutup, onSelesai }: { u: Usulan; semua: Usulan[]; hariIni: string; onTutup: () => void; onSelesai: (p: string) => void }) {
  const opsi: { k: StatusUsulan; l: string }[] = u.status === "uji_coba"
    ? [{ k: "berlaku", l: "Berlaku permanen" }, { k: "dicabut", l: "Cabut" }, { k: "diganti", l: "Ganti dengan usulan lain" }]
    : u.status === "berlaku_darurat"
      ? [{ k: "disetujui", l: "Setuju (sahkan permanen)" }, { k: "ditolak", l: "Tolak" }]
      : [{ k: "disetujui", l: "Setuju" }, { k: "uji_coba", l: "Uji coba 2–4 minggu" }, { k: "ditolak", l: "Tolak" }, { k: "ditunda", l: "Tunda (perlu data)" }];
  const [kep, setKep] = useState<StatusUsulan>(opsi[0].k);
  const [alasan, setAlasan] = useState("");
  const [sampai, setSampai] = useState(tambahHariIso(hariIni, 21));
  const [pengganti, setPengganti] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const min = tambahHariIso(hariIni, 14), max = tambahHariIso(hariIni, 28);
  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alasan.trim()) { setGalat("Alasan keputusan wajib diisi."); return; }
    if (kep === "uji_coba" && (!sampai || sampai < min || sampai > max)) { setGalat("Tanggal akhir uji coba harus 14–28 hari dari hari ini."); return; }
    if (kep === "diganti" && !pengganti) { setGalat("Pilih usulan pengganti."); return; }
    setSibuk(true); setGalat("");
    const r = await putuskanUsulan(supabase, u.id, kep, alasan.trim(), { ujiCobaSampai: kep === "uji_coba" ? sampai : undefined, penggantiId: kep === "diganti" ? pengganti : undefined });
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal menyimpan keputusan."); return; }
    onSelesai(`${u.nomor}: ${LABEL_STATUS[kep]}.`);
  };
  return (
    <Dialog judul={u.status === "uji_coba" ? `Evaluasi uji coba ${u.nomor}` : `Putuskan ${u.nomor}`} sub="Hanya Studio Manager. Alasan dicatat dan tampil di linimasa." onTutup={onTutup} sibuk={sibuk} data-dialog-usulan="putuskan">
      <form onSubmit={kirim} noValidate className="space-y-4">
        <label className={kelasLabel} htmlFor="pt-kep">Keputusan<select id="pt-kep" className={kelasInput} value={kep} onChange={(e) => setKep(e.target.value as StatusUsulan)}>{opsi.map((o) => <option key={o.k} value={o.k}>{o.l}</option>)}</select></label>
        {kep === "uji_coba" && <label className={kelasLabel} htmlFor="pt-sampai">Uji coba sampai<input id="pt-sampai" type="date" className={kelasInput} min={min} max={max} value={sampai} onChange={(e) => setSampai(e.target.value)} /><span className="font-normal text-gray-500">{teksTanggalISO(min)} – {teksTanggalISO(max)} (14–28 hari)</span></label>}
        {kep === "diganti" && <label className={kelasLabel} htmlFor="pt-pengganti">Usulan pengganti<select id="pt-pengganti" className={kelasInput} value={pengganti} onChange={(e) => setPengganti(e.target.value)}><option value="">Pilih usulan…</option>{semua.filter((x) => x.id !== u.id).map((x) => <option key={x.id} value={x.id}>{x.nomor} — {x.judul}</option>)}</select></label>}
        <label className={kelasLabel} htmlFor="pt-alasan">Alasan keputusan<textarea id="pt-alasan" className={`${kelasInput} min-h-[76px]`} value={alasan} onChange={(e) => setAlasan(e.target.value)} /></label>
        <PesanGalat pesan={galat} />
        <Aksi2 sibuk={sibuk} onTutup={onTutup} label="Simpan keputusan" data="putuskan" />
      </form>
    </Dialog>
  );
}

function DialogKeberatan({ u, onTutup, onSelesai }: { u: Usulan; onTutup: () => void; onSelesai: (p: string) => void }) {
  const [alasan, setAlasan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alasan.trim()) { setGalat("Alasan keberatan wajib diisi."); return; }
    setSibuk(true); setGalat("");
    const r = await ajukanKeberatan(supabase, u.id, alasan.trim());
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal menyimpan keberatan."); return; }
    onSelesai(`Keberatan tercatat — ${u.nomor} pindah ke jalur biasa dan masuk cek dampak.`);
  };
  return (
    <Dialog judul={`Keberatan atas ${u.nomor}`} sub="Usulan pindah ke jalur biasa dan langsung masuk cek dampak; divisi Anda ikut menilai." onTutup={onTutup} sibuk={sibuk} data-dialog-usulan="keberatan">
      <form onSubmit={kirim} noValidate className="space-y-4">
        <label className={kelasLabel} htmlFor="kb-alasan">Alasan keberatan<textarea id="kb-alasan" className={`${kelasInput} min-h-[76px]`} value={alasan} onChange={(e) => setAlasan(e.target.value)} /></label>
        <PesanGalat pesan={galat} />
        <Aksi2 sibuk={sibuk} onTutup={onTutup} label="Ajukan keberatan" bahaya data="keberatan" />
      </form>
    </Dialog>
  );
}
