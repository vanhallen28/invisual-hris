// src/components/management/TabUsulan.tsx
// Log Usulan Perubahan: daftar + filter, formulir, detail. Semua perubahan status lewat RPC (lib/management/usulan).
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { muatPetaLibur } from "@/lib/hariLiburData";
import type { PetaLibur } from "@/lib/hariLibur";
import { bisa, DIVISI_LABEL, type PeranManagement } from "@/lib/management/akses";
import { bagianPedoman, muatVersi } from "@/lib/management/pedoman";
import { LABEL_JALUR, LABEL_STATUS, muatDampak, muatUsulan, umurMerah, type JalurUsulan, type StatusUsulan } from "@/lib/management/usulan";
import { isoWib, tambahHariIso } from "@/lib/management/hariKerja";
import { Kosong, Lencana, kelasInput, kelasLabel, kelasTombol, kelasTombolUtama, type Warna } from "./ui";
import FormUsulan from "./FormUsulan";
import DetailUsulan from "./DetailUsulan";

export type Usulan = {
  id: string; nomor: string; judul: string; masalah: string; perubahan: string; bagian_pedoman: string; divisi_terdampak: string[];
  sumber: string; jalur: JalurUsulan; status: StatusUsulan; pengusul_email: string; atas_nama_owner: boolean; berlaku_sejak: string | null;
  diteruskan_pada: string | null; rapat_sasaran: string | null; tenggat_dampak: string | null; masa_keberatan_sampai: string | null;
  keputusan_alasan: string | null; diputuskan_oleh: string | null; diputuskan_pada: string | null; uji_coba_sampai: string | null;
  pengganti_id: string | null; dibuat_pada: string;
};
export type Dampak = { usulan_id: string; divisi: string; nilai: string | null; alasan: string | null; diisi_oleh: string | null; diisi_pada: string | null };

export const WARNA_STATUS: Record<StatusUsulan, Warna> = {
  diajukan: "abu", cek_dampak: "biru", siap_diputuskan: "kuning", disetujui: "hijau", uji_coba: "ungu", ditolak: "merah", ditunda: "abu",
  berlaku: "hijau", dicabut: "merah", diganti: "abu", berlaku_darurat: "merah", gugur: "abu", masa_keberatan: "ungu",
};
const bulanWib = (iso: string) => isoWib(new Date(iso)).slice(0, 7);
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const teksBulan = (ym: string) => `${BLN[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const umurHari = (iso: string, sekarang = new Date()) => Math.max(0, Math.floor((sekarang.getTime() - Date.parse(iso)) / 86_400_000));

export default function TabUsulan({ peran, divisi, idAwal }: { peran: PeranManagement[]; divisi: string[]; idAwal?: string | null }) {
  const [usulan, setUsulan] = useState<Usulan[] | null | undefined>(undefined);
  const [dampak, setDampak] = useState<Dampak[]>([]);
  const [bagian, setBagian] = useState<string[]>([]);
  const [peta, setPeta] = useState<PetaLibur | null>(null);
  const [hariRapat, setHariRapat] = useState(1);   // pengaturan.mgmt_hari_rapat (1 = Senin), sama dengan mgmt_hari_rapat() di SQL
  const [tampil, setTampil] = useState<{ v: "daftar" } | { v: "form" } | { v: "detail"; id: string }>(idAwal ? { v: "detail", id: idAwal } : { v: "daftar" });
  const [f, setF] = useState({ status: "", jalur: "", divisi: "", bulan: "" });

  const muat = useCallback(async () => {
    const [u, d] = await Promise.all([muatUsulan(supabase), muatDampak(supabase)]);
    setUsulan(u as Usulan[] | null); setDampak(d as Dampak[]);
  }, []);
  useEffect(() => {
    let hidup = true;
    (async () => {
      const hari = isoWib(new Date());
      const [u, d, v, p, hr] = await Promise.all([muatUsulan(supabase), muatDampak(supabase), muatVersi(supabase), muatPetaLibur(supabase, tambahHariIso(hari, -14), tambahHariIso(hari, 70)).catch(() => null),
        Promise.resolve(supabase.from("pengaturan").select("nilai").eq("kunci", "mgmt_hari_rapat").maybeSingle()).catch(() => ({ data: null }))]);
      if (!hidup) return;
      setUsulan(u as Usulan[] | null); setDampak(d as Dampak[]); setPeta(p);
      const nilaiHr = String((hr as { data: { nilai?: string } | null })?.data?.nilai || "").trim();
      if (/^[1-7]$/.test(nilaiHr)) setHariRapat(Number(nilaiHr));
      const berlaku = (v || []).find((x) => x.status === "berlaku");
      setBagian(berlaku ? bagianPedoman(berlaku.isi_md) : []);
    })();
    return () => { hidup = false; };
  }, []);

  const bulanAda = useMemo(() => Array.from(new Set((usulan || []).map((u) => bulanWib(u.dibuat_pada)))).sort().reverse(), [usulan]);
  const tersaring = useMemo(() => (usulan || []).filter((u) =>
    (!f.status || u.status === f.status) && (!f.jalur || u.jalur === f.jalur)
    && (!f.divisi || u.divisi_terdampak.includes(f.divisi)) && (!f.bulan || bulanWib(u.dibuat_pada) === f.bulan)), [usulan, f]);

  if (usulan === undefined) return <p className="py-10 text-center text-sm text-gray-500" aria-busy="true">Memuat usulan…</p>;
  if (usulan === null) return <Kosong>Log Usulan belum tersedia.</Kosong>;

  if (tampil.v === "form") {
    return <FormUsulan peran={peran} divisi={divisi} bagian={bagian} usulan={usulan}
      onBatal={() => setTampil({ v: "daftar" })} onSelesai={async (id) => { await muat(); setTampil(id ? { v: "detail", id } : { v: "daftar" }); }} />;
  }
  if (tampil.v === "detail") {
    const u = usulan.find((x) => x.id === tampil.id);
    if (u) return <DetailUsulan u={u} semua={usulan} dampak={dampak.filter((d) => d.usulan_id === u.id)} peran={peran} divisi={divisi} peta={peta} hariRapat={hariRapat}
      onKembali={() => setTampil({ v: "daftar" })} onUbah={muat} />;
  }

  const bolehAjukan = bisa(peran, "ajukan_usulan");
  const sekarang = new Date();
  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-kartu p-5" data-tab-usulan>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-white">Log Usulan Perubahan</h2>
          <p className="mt-0.5 text-xs text-gray-500">Satu pintu untuk semua usulan aturan — dari rapat, HR, leader, chat/WA, maupun owner.</p>
        </div>
        {bolehAjukan && <button type="button" className={kelasTombolUtama} onClick={() => setTampil({ v: "form" })} data-ajukan-usulan>+ Ajukan usulan</button>}
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <label className={kelasLabel}>Status<select className={kelasInput} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} data-filter-status>
          <option value="">Semua status</option>{Object.entries(LABEL_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className={kelasLabel}>Jalur<select className={kelasInput} value={f.jalur} onChange={(e) => setF({ ...f, jalur: e.target.value })} data-filter-jalur>
          <option value="">Semua jalur</option>{Object.entries(LABEL_JALUR).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className={kelasLabel}>Divisi<select className={kelasInput} value={f.divisi} onChange={(e) => setF({ ...f, divisi: e.target.value })}>
          <option value="">Semua divisi</option>{["sosmed", "service", "marketplace", "hr", "semua"].map((d) => <option key={d} value={d}>{DIVISI_LABEL[d]}</option>)}</select></label>
        <label className={kelasLabel}>Bulan<select className={kelasInput} value={f.bulan} onChange={(e) => setF({ ...f, bulan: e.target.value })}>
          <option value="">Semua bulan</option>{bulanAda.map((b) => <option key={b} value={b}>{teksBulan(b)}</option>)}</select></label>
      </div>
      {usulan.length === 0 ? (
        <Kosong>Belum ada usulan.{bolehAjukan ? <> — <button type="button" className="text-tint underline cursor-pointer" onClick={() => setTampil({ v: "form" })}>Ajukan usulan</button></> : null}</Kosong>
      ) : tersaring.length === 0 ? (
        <Kosong>Tidak ada usulan yang cocok dengan filter. — <button type="button" className="text-tint underline cursor-pointer" onClick={() => setF({ status: "", jalur: "", divisi: "", bulan: "" })}>Hapus filter</button></Kosong>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-white/10 text-left text-[10.5px] uppercase tracking-wide text-gray-500">
              {["Nomor", "Judul", "Jalur", "Status", "Divisi", "Umur"].map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}
            </tr></thead>
            <tbody>
              {tersaring.map((u) => (
                <tr key={u.id} tabIndex={0} className="cursor-pointer border-b border-white/5 last:border-0 hover:bg-white/[0.03] focus:bg-white/[0.05] focus:outline-none"
                  onClick={() => setTampil({ v: "detail", id: u.id })} onKeyDown={(e) => { if (e.key === "Enter") setTampil({ v: "detail", id: u.id }); }} data-baris-usulan={u.nomor}>
                  <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{u.nomor}</td>
                  <td className="px-3 py-2.5 text-white">{u.judul}</td>
                  <td className="px-3 py-2.5 text-gray-400">{LABEL_JALUR[u.jalur]}</td>
                  <td className="px-3 py-2.5"><Lencana warna={WARNA_STATUS[u.status]}>{LABEL_STATUS[u.status]}</Lencana></td>
                  <td className="px-3 py-2.5 text-gray-400">{u.divisi_terdampak.map((d) => DIVISI_LABEL[d] || d).join(", ")}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-gray-400">{umurHari(u.dibuat_pada, sekarang)} hari {umurMerah(u.dibuat_pada, u.status, sekarang) ? <Lencana warna="merah">Lewat 7 hari</Lencana> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-gray-600">Klik baris untuk melihat detail, cek dampak, dan keputusan. <button type="button" className={`${kelasTombol} ml-1 px-2 py-0.5 text-[11px]`} onClick={muat}>Muat ulang</button></p>
    </div>
  );
}
