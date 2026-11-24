// src/components/management/FormUsulan.tsx
// Formulir usulan. Jalur darurat hanya Studio Manager; jalur internal hanya leader untuk divisinya sendiri.
// Validasi di sini hanya untuk kenyamanan — aturan sebenarnya ditegakkan RPC mgmt_ajukan_usulan.
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { DIVISI_LABEL, type PeranManagement } from "@/lib/management/akses";
import { BATAS_DARURAT_PER_BULAN, LABEL_STATUS, SUMBER_USULAN, ajukanUsulan, type JalurUsulan } from "@/lib/management/usulan";
import { isoWib } from "@/lib/management/hariKerja";
import { PesanGalat, kelasInput, kelasLabel, kelasTombol, kelasTombolUtama } from "./ui";
import type { Usulan } from "./TabUsulan";

const DIVISI = ["sosmed", "service", "marketplace", "hr", "semua"];

/** Jumlah usulan darurat pada bulan (WIB) yang sama dengan `iso`. */
export const daruratSebulan = (usulan: Usulan[], iso: string) =>
  usulan.filter((u) => u.jalur === "darurat" && isoWib(new Date(u.dibuat_pada)).slice(0, 7) === isoWib(new Date(iso)).slice(0, 7)).length;

export default function FormUsulan({ peran, divisi, bagian, usulan, onBatal, onSelesai }: {
  peran: PeranManagement[]; divisi: string[]; bagian: string[]; usulan: Usulan[]; onBatal: () => void; onSelesai: (id?: string) => void;
}) {
  const toast = useToast();
  const sm = peran.includes("studio_manager");
  const divLeader = divisi.filter((d) => d !== "hr");
  const jalurBoleh: { k: JalurUsulan; l: string }[] = [{ k: "biasa", l: "Biasa" }];
  if (sm) jalurBoleh.push({ k: "darurat", l: "Darurat" });
  if (divLeader.length) jalurBoleh.push({ k: "internal", l: "Internal (divisi saya)" });

  const [judul, setJudul] = useState("");
  const [masalah, setMasalah] = useState("");
  const [perubahan, setPerubahan] = useState("");
  const [bag, setBag] = useState("");
  const [sumber, setSumber] = useState(sm ? "studio_manager" : peran.includes("pm") ? "pm" : peran.includes("hr") ? "hr" : divLeader.length ? "leader" : "rapat");
  const [jalur, setJalur] = useState<JalurUsulan>("biasa");
  const [div, setDiv] = useState<string[]>([]);
  const [sejak, setSejak] = useState("");
  const [atasNamaOwner, setAtasNamaOwner] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const darurat = daruratSebulan(usulan, new Date().toISOString());
  const divTampil = jalur === "internal" ? [divLeader[0]] : div;

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat("");
    const kosong = [[judul, "judul"], [masalah, "masalah"], [perubahan, "perubahan"], [bag, "bagian Pedoman"]].filter(([v]) => !v.trim()).map(([, l]) => l);
    if (kosong.length) { setGalat(`Lengkapi ${kosong.join(", ")}.`); return; }
    if (!divTampil.length || !divTampil[0]) { setGalat("Pilih minimal satu divisi terdampak."); return; }
    if (jalur === "darurat" && !sejak) { setGalat("Isi \"Berlaku sejak\" untuk jalur darurat."); return; }
    setSibuk(true);
    const r = await ajukanUsulan(supabase, {
      judul: judul.trim(), masalah: masalah.trim(), perubahan: perubahan.trim(), bagian: bag.trim(), divisi: divTampil, sumber, jalur,
      berlakuSejak: jalur === "darurat" ? new Date(`${sejak}:00+07:00`).toISOString() : null, atasNamaOwner: sm && atasNamaOwner,
    });
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal mengajukan usulan."); return; }
    toast.sukses(`${r.data?.nomor} tercatat — ${LABEL_STATUS[r.data?.status || "diajukan"]}.`);
    onSelesai(r.data?.id);
  };

  return (
    <form onSubmit={kirim} noValidate className="space-y-4 rounded-xl border border-white/10 bg-kartu p-5" data-form-usulan>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-sm font-bold text-white">Ajukan usulan</h2><p className="mt-0.5 text-xs text-gray-500">Nomor dibuat otomatis, mis. U-2026-007.</p></div>
        <button type="button" className={kelasTombol} onClick={onBatal} disabled={sibuk}>Batal</button>
      </div>
      <label className={kelasLabel} htmlFor="us-judul">Judul<input id="us-judul" className={kelasInput} value={judul} onChange={(e) => setJudul(e.target.value)} /></label>
      <label className={kelasLabel} htmlFor="us-masalah">Masalah yang diselesaikan<textarea id="us-masalah" className={`${kelasInput} min-h-[76px]`} value={masalah} onChange={(e) => setMasalah(e.target.value)} /></label>
      <label className={kelasLabel} htmlFor="us-perubahan">Perubahan yang diusulkan<textarea id="us-perubahan" className={`${kelasInput} min-h-[76px]`} value={perubahan} onChange={(e) => setPerubahan(e.target.value)} /></label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className={kelasLabel} htmlFor="us-bagian">Bagian Pedoman yang terkena
          {bagian.length
            ? <select id="us-bagian" className={kelasInput} value={bag} onChange={(e) => setBag(e.target.value)}><option value="">Pilih bagian…</option>{Array.from(new Set(bagian)).map((b) => <option key={b} value={b}>{b}</option>)}<option value="Bagian baru">Bagian baru (belum ada di Pedoman)</option></select>
            : <input id="us-bagian" className={kelasInput} value={bag} onChange={(e) => setBag(e.target.value)} placeholder="Belum ada Pedoman berlaku — tulis nama bagian" />}
        </label>
        <label className={kelasLabel} htmlFor="us-sumber">Sumber
          <select id="us-sumber" className={kelasInput} value={atasNamaOwner ? "owner" : sumber} disabled={atasNamaOwner} onChange={(e) => setSumber(e.target.value)}>
            {SUMBER_USULAN.filter((s) => s.nilai !== "owner" || atasNamaOwner || peran.includes("owner")).map((s) => <option key={s.nilai} value={s.nilai}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <label className={kelasLabel} htmlFor="us-jalur">Jalur
        <select id="us-jalur" className={kelasInput} value={jalur} onChange={(e) => setJalur(e.target.value as JalurUsulan)}>
          {jalurBoleh.map((j) => <option key={j.k} value={j.k}>{j.l}</option>)}
        </select>
        <span className="font-normal text-gray-500">
          {jalur === "internal" ? "Berlaku otomatis setelah 3 hari kerja bila tidak ada keberatan dari divisi lain."
            : jalur === "darurat" ? "Langsung berlaku. Gugur otomatis bila tidak disahkan di rapat mingguan berikutnya."
            : "Diteruskan PM ke cek dampak, lalu diputuskan Studio Manager di rapat mingguan."}
        </span>
      </label>
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-gray-400">Divisi terdampak</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {DIVISI.map((d) => {
            const kunci = jalur === "internal";
            return (
              <label key={d} className={`flex items-center gap-1.5 text-sm ${kunci && d !== divLeader[0] ? "text-gray-600" : "text-gray-200"}`}>
                <input type="checkbox" disabled={kunci} checked={divTampil.includes(d)} onChange={(e) => setDiv(e.target.checked ? [...div, d] : div.filter((x) => x !== d))} data-divisi-usulan={d} />
                {DIVISI_LABEL[d]}
              </label>
            );
          })}
        </div>
      </fieldset>
      {jalur === "darurat" && (
        <div className="space-y-2 rounded-lg border border-red-500/20 bg-red-500/[0.05] p-3" data-darurat>
          <p className={`text-xs ${darurat >= BATAS_DARURAT_PER_BULAN ? "font-semibold text-red-300" : "text-gray-300"}`} data-hitung-darurat>
            Darurat bulan ini: <span className="font-mono">{darurat}/{BATAS_DARURAT_PER_BULAN}</span>
            {darurat >= BATAS_DARURAT_PER_BULAN ? " — usulan ini melebihi batas dan akan dibahas di Review Bulanan." : ""}
          </p>
          <label className={kelasLabel} htmlFor="us-sejak">Berlaku sejak<input id="us-sejak" type="datetime-local" className={kelasInput} value={sejak} onChange={(e) => setSejak(e.target.value)} /></label>
          <p className="text-[11px] text-gray-500">Tidak boleh di masa depan atau lebih dari 7 hari ke belakang. Dicatat lebih dari 24 jam setelahnya ditandai &ldquo;Terlambat dicatat&rdquo;.</p>
        </div>
      )}
      {sm && (
        <label className="flex items-start gap-2 text-sm text-gray-200"><input type="checkbox" className="mt-1" checked={atasNamaOwner} onChange={(e) => setAtasNamaOwner(e.target.checked)} data-atas-nama-owner />
          <span>Atas nama owner (permintaan Dea/owner yang dicatat Studio Manager)</span></label>
      )}
      <PesanGalat pesan={galat} />
      <div className="flex justify-end"><button type="submit" className={kelasTombolUtama} disabled={sibuk} data-kirim-usulan>{sibuk ? "Mengirim…" : "Kirim usulan"}</button></div>
    </form>
  );
}
