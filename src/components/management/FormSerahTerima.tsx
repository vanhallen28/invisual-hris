// src/components/management/FormSerahTerima.tsx
// Formulir serah terima baru. Isian menyesuaikan jenis; pratinjau tenggat memakai rumus yang sama dengan SQL (serahTerima.ts).
// Validasi di sini hanya untuk kenyamanan — aturan sebenarnya ditegakkan RPC mgmt_buat_serah_terima.
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import type { PetaLibur } from "@/lib/hariLibur";
import { PERAN_LABEL, SEMUA_PERAN, type PeranManagement } from "@/lib/management/akses";
import {
  DIVISI_SERAH_TERIMA, JENIS_SERAH_TERIMA, LABEL_JENIS, SELESAI_SAAT, buatSerahTerima, pakaiMulai, pjOtomatis, tautanSah, tenggatSerahTerima,
  type JenisSerahTerima,
} from "@/lib/management/serahTerima";
import { PesanGalat, kelasInput, kelasLabel, kelasTombol, kelasTombolUtama } from "./ui";
import { LABEL_DIVISI_ST, inputWib, waktuWib } from "./waktuSt";

/** Arah bawaan per jenis (PRD P2a) — tetap bisa diubah pembuat. */
const BAWAAN: Record<JenisSerahTerima, [string, string]> = {
  calon_klien: ["sosmed", "owner"], kartu_proyek: ["owner", "service"], review_dea: ["service", "owner"], portofolio: ["service", "sosmed"],
  info_rilis: ["marketplace", "sosmed"], qc_studio_project: ["service", "marketplace"], kalender_bulanan: ["sosmed", "pm"], lainnya: ["pm", "sosmed"],
};
const BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

/** Tiga bulan ke depan (tanggal 1), mulai bulan depan — dasar isian "Bulan rencana". */
function bulanDepan(sekarang: Date): string[] {
  const y = Number(inputWib(sekarang).slice(0, 4)), m = Number(inputWib(sekarang).slice(5, 7));
  return [1, 2, 3].map((i) => { const t = new Date(Date.UTC(y, m - 1 + i, 1)); return t.toISOString().slice(0, 10); });
}

export default function FormSerahTerima({ peran, divisi, peta, onBatal, onSelesai }: {
  peran: PeranManagement[]; divisi: string[]; peta: PetaLibur | null; onBatal: () => void; onSelesai: () => void;
}) {
  const toast = useToast();
  const [sekarang] = useState(() => new Date());
  const divSaya = divisi.find((d) => d !== "hr") || (peran.some((p) => p === "pm" || p === "studio_manager") ? "pm" : peran.includes("owner") ? "owner" : "pm");
  const arahAwal = (j: JenisSerahTerima): [string, string] => (j === "lainnya" ? [divSaya, divSaya === "sosmed" ? "service" : "sosmed"] : BAWAAN[j]);

  const [jenis, setJenis] = useState<JenisSerahTerima>("calon_klien");
  const [dari, setDari] = useState(BAWAAN.calon_klien[0]);
  const [ke, setKe] = useState(BAWAAN.calon_klien[1]);
  const [judul, setJudul] = useState("");
  const [catatan, setCatatan] = useState("");
  const [mulai, setMulai] = useState(() => inputWib(sekarang));
  const [rilis, setRilis] = useState("");
  const pilihanBulan = bulanDepan(sekarang);
  const [bulan, setBulan] = useState(pilihanBulan[0]);
  const [tenggatManual, setTenggatManual] = useState("");
  const [pj, setPj] = useState<PeranManagement>("pm");
  const [tautan, setTautan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const gantiJenis = (j: JenisSerahTerima) => { const [a, b] = arahAwal(j); setJenis(j); setDari(a); setKe(b); setGalat(""); };
  const keInstan = (v: string) => (v ? new Date(`${v}:00+07:00`) : null);

  let pratinjau: Date | null = null;
  try {
    pratinjau = tenggatSerahTerima(jenis, { mulai: keInstan(mulai), tanggalRilis: rilis || null, bulanRencana: bulan, tenggatManual: keInstan(tenggatManual) }, peta);
    if (Number.isNaN(pratinjau.getTime())) pratinjau = null;
  } catch { pratinjau = null; }
  const pjTampil = jenis === "lainnya" ? pj : pjOtomatis(jenis, dari);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat("");
    const kosong: string[] = [];
    if (!judul.trim()) kosong.push("judul");
    if (pakaiMulai(jenis) && !mulai) kosong.push("waktu mulai");
    if (jenis === "info_rilis" && !rilis) kosong.push("tanggal rilis");
    if (jenis === "lainnya" && !tenggatManual) kosong.push("tenggat");
    if (kosong.length) { setGalat(`Lengkapi ${kosong.join(", ")}.`); return; }
    if (dari === ke) { setGalat("Divisi asal dan tujuan tidak boleh sama."); return; }
    if (jenis === "lainnya" && (keInstan(tenggatManual)?.getTime() || 0) <= Date.now()) { setGalat("Tenggat tidak boleh di masa lalu."); return; }
    if (tautan.trim() && !tautanSah(tautan.trim())) { setGalat("Tautan harus diawali http:// atau https://, atau berupa id item Daily Task."); return; }
    setSibuk(true);
    const r = await buatSerahTerima(supabase, {
      jenis, dari, ke, judul: judul.trim(), catatan: catatan.trim() || null,
      mulai: pakaiMulai(jenis) ? keInstan(mulai)?.toISOString() : null,
      tanggalRilis: jenis === "info_rilis" ? rilis : null,
      bulanRencana: jenis === "kalender_bulanan" ? bulan : null,
      tenggatManual: jenis === "lainnya" ? keInstan(tenggatManual)?.toISOString() : null,
      tautanItem: tautan.trim() || null, peranPj: jenis === "lainnya" ? pj : null,
    });
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal membuat serah terima."); return; }
    toast.sukses(`Serah terima tercatat — tenggat ${r.data?.tenggat ? waktuWib(r.data.tenggat) : "-"}.`);
    onSelesai();
  };

  const maksMulai = inputWib(sekarang), minMulai = inputWib(new Date(sekarang.getTime() - 7 * 86_400_000));
  return (
    <form onSubmit={kirim} noValidate className="space-y-4 rounded-xl border border-white/10 bg-kartu p-5" data-form-st>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="text-sm font-bold text-white">Serah terima baru</h2>
          <p className="mt-0.5 text-xs text-gray-500">Tenggat dihitung dalam hari kerja: Senin–Jumat 09.00–18.00 WIB, tanpa hari libur.</p></div>
        <button type="button" className={kelasTombol} onClick={onBatal} disabled={sibuk} data-batal-st>Batal</button>
      </div>
      <label className={kelasLabel} htmlFor="st-jenis">Jenis
        <select id="st-jenis" className={kelasInput} value={jenis} onChange={(e) => gantiJenis(e.target.value as JenisSerahTerima)}>
          {JENIS_SERAH_TERIMA.map((j) => <option key={j} value={j}>{LABEL_JENIS[j]}</option>)}
        </select>
        <span className="font-normal text-gray-500">Selesai saat: {SELESAI_SAAT[jenis]}.</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={kelasLabel} htmlFor="st-dari">Dari
          <select id="st-dari" className={kelasInput} value={dari} onChange={(e) => setDari(e.target.value)}>
            {DIVISI_SERAH_TERIMA.map((d) => <option key={d} value={d}>{LABEL_DIVISI_ST[d]}</option>)}
          </select></label>
        <label className={kelasLabel} htmlFor="st-ke">Ke
          <select id="st-ke" className={kelasInput} value={ke} onChange={(e) => setKe(e.target.value)}>
            {DIVISI_SERAH_TERIMA.map((d) => <option key={d} value={d}>{LABEL_DIVISI_ST[d]}</option>)}
          </select></label>
      </div>
      <label className={kelasLabel} htmlFor="st-judul">Judul<input id="st-judul" className={kelasInput} value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="mis. Portofolio Batik Rara" /></label>

      {pakaiMulai(jenis) && (
        <label className={kelasLabel} htmlFor="st-mulai">Waktu mulai
          <input id="st-mulai" type="datetime-local" className={kelasInput} value={mulai} min={minMulai} max={maksMulai} onChange={(e) => setMulai(e.target.value)} />
          <span className="font-normal text-gray-500">Tidak boleh di masa depan atau lebih dari 7 hari ke belakang. Setelah dibuat, hanya PM yang bisa mengubahnya.</span>
        </label>
      )}
      {jenis === "info_rilis" && (
        <label className={kelasLabel} htmlFor="st-rilis">Tanggal rilis
          <input id="st-rilis" type="date" className={kelasInput} value={rilis} onChange={(e) => setRilis(e.target.value)} />
          <span className="font-normal text-gray-500">Tenggat: 3 hari sebelum rilis, pukul 18.00.</span>
        </label>
      )}
      {jenis === "kalender_bulanan" && (
        <label className={kelasLabel} htmlFor="st-bulan">Bulan rencana
          <select id="st-bulan" className={kelasInput} value={bulan} onChange={(e) => setBulan(e.target.value)}>
            {pilihanBulan.map((b) => <option key={b} value={b}>{BLN[Number(b.slice(5, 7)) - 1]} {b.slice(0, 4)}</option>)}
          </select>
          <span className="font-normal text-gray-500">Tenggat: tanggal 25 bulan sebelumnya, pukul 18.00.</span>
        </label>
      )}
      {jenis === "lainnya" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={kelasLabel} htmlFor="st-tenggat">Tenggat<input id="st-tenggat" type="datetime-local" className={kelasInput} value={tenggatManual} onChange={(e) => setTenggatManual(e.target.value)} /></label>
          <label className={kelasLabel} htmlFor="st-pj">Penanggung jawab
            <select id="st-pj" className={kelasInput} value={pj} onChange={(e) => setPj(e.target.value as PeranManagement)}>
              {SEMUA_PERAN.map((p) => <option key={p} value={p}>{PERAN_LABEL[p]}</option>)}
            </select></label>
        </div>
      )}
      <label className={kelasLabel} htmlFor="st-tautan-baru">Tautan item Daily Task <span className="font-normal text-gray-500">(opsional{jenis === "kartu_proyek" ? "; wajib saat diselesaikan" : ""})</span>
        <input id="st-tautan-baru" className={kelasInput} value={tautan} onChange={(e) => setTautan(e.target.value)} placeholder="https://… atau id item" /></label>
      <label className={kelasLabel} htmlFor="st-catatan">Catatan <span className="font-normal text-gray-500">(opsional)</span>
        <textarea id="st-catatan" className={`${kelasInput} min-h-[64px]`} value={catatan} onChange={(e) => setCatatan(e.target.value)} /></label>

      <div className={`rounded-lg px-3 py-2 text-xs ${pratinjau && pratinjau <= sekarang ? "border border-red-500/25 bg-red-500/10 text-red-200" : "bg-white/5 text-gray-300"}`} data-pratinjau-tenggat aria-live="polite">
        {pratinjau ? <>Tenggat <b>{waktuWib(pratinjau.toISOString())}</b></> : <>Tenggat muncul setelah isian waktu terisi</>}
        {pjTampil ? <> · Penanggung jawab <b>{PERAN_LABEL[pjTampil]}</b></> : null}
        {pratinjau && pratinjau <= sekarang ? <span className="block mt-1 font-semibold">Tenggat sudah lewat — kartu langsung tercatat terlambat.</span> : null}
      </div>
      <PesanGalat pesan={galat} />
      <div className="flex justify-end"><button type="submit" className={kelasTombolUtama} disabled={sibuk} data-kirim-st>{sibuk ? "Menyimpan…" : "Buat serah terima"}</button></div>
    </form>
  );
}
