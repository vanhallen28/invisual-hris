// src/components/management/StatusBaca.tsx
// Siapa yang belum membaca Pedoman berlaku. Data dari RPC mgmt_status_baca (dihitung di server: cocok user_id
// ATAU email/emailLogin; hanya karyawan aktif yang punya akun; owner & akses ditutup tidak dihitung).
// PM/HR/SM/owner: semua; leader: divisinya. Yang belum dipetakan bisa dipetakan HR/SM.
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { muatPetaLibur } from "@/lib/hariLiburData";
import type { PetaLibur } from "@/lib/hariLibur";
import { bisa, DIVISI_LABEL, type PeranManagement } from "@/lib/management/akses";
import { aturDivisiStaf, muatStatusBaca, type BarisStatusBaca, type VersiPedoman } from "@/lib/management/pedoman";
import { adalahHariKerja, isoWib, tambahHariIso } from "@/lib/management/hariKerja";
import { Kosong, Lencana, kelasInput } from "./ui";

const URUT = ["sosmed", "service", "marketplace", "lainnya", "_"];

/** Jumlah hari kerja setelah tanggal terbit sampai hari ini (hari terbit tidak dihitung). */
export function hariKerjaSejak(terbitIso: string, hariIni: string, peta?: PetaLibur | null): number {
  let n = 0;
  for (let d = tambahHariIso(terbitIso, 1), i = 0; d <= hariIni && i < 400; d = tambahHariIso(d, 1), i++) if (adalahHariKerja(d, peta)) n++;
  return n;
}

export default function StatusBaca({ versi, peran, divisi }: { versi: VersiPedoman; peran: PeranManagement[]; divisi: string[] }) {
  const toast = useToast();
  const semua = bisa(peran, "lihat_status_baca_semua");
  const bolehPetakan = bisa(peran, "atur_divisi_staf");
  const divisiLeader = divisi.filter((d) => d !== "hr");
  const [baris, setBaris] = useState<BarisStatusBaca[] | null | undefined>(undefined);
  const [peta, setPeta] = useState<PetaLibur | null>(null);
  const hariIni = isoWib(new Date());
  const terbit = versi.diterbitkan_pada ? isoWib(new Date(versi.diterbitkan_pada)) : versi.berlaku_mulai || hariIni;

  const muat = useCallback(async () => {
    const [r, libur] = await Promise.all([muatStatusBaca(supabase, versi.id), muatPetaLibur(supabase, terbit, hariIni).catch(() => null)]);
    setBaris(r); setPeta(libur);
  }, [versi.id, terbit, hariIni]);
  useEffect(() => { const t = setTimeout(muat, 0); return () => clearTimeout(t); }, [muat]);

  if (baris === undefined) return <p className="py-8 text-center text-sm text-gray-500" aria-busy="true">Memuat status baca…</p>;
  if (baris === null) return <Kosong>Status baca belum tersedia.</Kosong>;
  const belum = baris.filter((s) => !s.sudah);
  const umur = hariKerjaSejak(terbit, hariIni, peta);
  const grup = URUT.map((k) => ({ k, isi: belum.filter((s) => (s.divisi || "_") === k) })).filter((g) => g.isi.length > 0);

  const petakan = async (s: BarisStatusBaca, d: string) => {
    if (!d) return;
    const r = await aturDivisiStaf(supabase, s.id_karyawan, d);
    if (!r.ok) { toast.gagal(r.pesan || "Gagal memetakan divisi."); return; }
    toast.sukses(`${s.nama} dipetakan ke ${DIVISI_LABEL[d] || d}.`);
    muat();
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-kartu p-5" data-status-baca>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Belum membaca Pedoman {versi.versi}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{semua ? "Semua karyawan aktif yang punya akun." : `Hanya divisi ${divisiLeader.map((d) => DIVISI_LABEL[d] || d).join(", ") || "Anda"}.`} Terbit {umur} hari kerja lalu; lewat 3 hari kerja, leader diingatkan.</p>
        </div>
        <p className="font-mono text-sm text-gray-300" data-ringkas-baca><b className="text-white">{baris.length - belum.length}</b> dari {baris.length} sudah membaca</p>
      </div>
      {grup.length === 0 ? <Kosong>Semua sudah membaca Pedoman {versi.versi}.</Kosong> : grup.map((g) => (
        <div key={g.k} className="space-y-2" data-grup-baca={g.k}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{g.k === "_" ? "Belum dipetakan" : DIVISI_LABEL[g.k] || g.k} · {g.isi.length}</p>
          {g.isi.map((s) => (
            <div key={s.id_karyawan} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-input px-3 py-2.5" data-belum-baca={s.id_karyawan}>
              <div className="min-w-0"><p className="text-sm font-semibold text-white">{s.nama}</p><p className="font-mono text-[11px] text-gray-500">{s.id_karyawan}</p></div>
              <div className="flex flex-wrap items-center gap-2">
                {umur >= 3 ? <Lencana warna="merah">Lewat 3 hari kerja</Lencana> : <Lencana warna="kuning">Belum membaca</Lencana>}
                {g.k === "_" && bolehPetakan && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-400">Divisi
                    <select className={`${kelasInput} w-auto py-1 text-xs`} defaultValue="" onChange={(e) => petakan(s, e.target.value)} data-petakan={s.id_karyawan} aria-label={`Divisi ${s.nama}`}>
                      <option value="">Pilih…</option>
                      {["sosmed", "service", "marketplace", "lainnya"].map((d) => <option key={d} value={d}>{DIVISI_LABEL[d]}</option>)}
                    </select>
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
