// src/components/management/RiwayatPedoman.tsx
// Riwayat versi Pedoman (berlaku & arsip) + perbandingan baris dengan versi sebelumnya.
// Tautan usulan hanya terbaca anggota Management (RLS); karyawan lain melihat ringkasannya saja.
"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { teksTanggalISO } from "@/lib/tanggalTampil";
import { diffBaris, muatBaris, type BarisDiff, type VersiPedoman } from "@/lib/management/pedoman";
import { muatUsulan } from "@/lib/management/usulan";
import { Kosong, Lencana, kelasTombol } from "./ui";

export default function RiwayatPedoman({ versi, management }: { versi: VersiPedoman[]; management: boolean }) {
  const terbit = useMemo(() => versi.filter((v) => v.status !== "draf")
    .sort((a, b) => String(b.diterbitkan_pada || "").localeCompare(String(a.diterbitkan_pada || ""))), [versi]);
  const [tautan, setTautan] = useState<Record<string, string[]>>({});
  const [buka, setBuka] = useState<string | null>(null);

  useEffect(() => {
    if (!management) return;
    let hidup = true;
    (async () => {
      const [baris, usulan] = await Promise.all([muatBaris(supabase, "mgmt_pedoman_usulan"), muatUsulan(supabase)]);
      const nomor = new Map((usulan || []).map((u) => [u.id, u.nomor]));
      const peta: Record<string, string[]> = {};
      for (const b of baris) (peta[b.versi_id] ||= []).push(nomor.get(b.usulan_id) || "—");
      if (hidup) setTautan(peta);
    })();
    return () => { hidup = false; };
  }, [management]);

  if (terbit.length === 0) return <Kosong>Belum ada versi Pedoman yang terbit.</Kosong>;
  return (
    <div className="space-y-3" data-riwayat-pedoman>
      {terbit.map((v, i) => {
        const sebelum = terbit[i + 1];
        return (
          <section key={v.id} className="rounded-xl border border-white/10 bg-kartu p-4" data-versi={v.versi}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-mono text-sm font-bold text-white">{v.versi}</h3>
              <Lencana warna={v.status === "berlaku" ? "hijau" : "abu"}>{v.status === "berlaku" ? "Berlaku" : "Arsip"}</Lencana>
              {v.pengesahan_awal ? <Lencana warna="ungu">Pengesahan awal</Lencana> : null}
              {v.berlaku_mulai ? <span className="text-xs text-gray-500">berlaku mulai {teksTanggalISO(v.berlaku_mulai)}</span> : null}
            </div>
            <p className="mt-2 text-sm text-gray-300">{v.ringkasan_perubahan || "—"}</p>
            {management && (tautan[v.id]?.length ? <p className="mt-1 text-xs text-gray-500">Usulan: <span className="font-mono text-gray-300">{tautan[v.id].join(", ")}</span></p> : null)}
            {sebelum && (
              <button type="button" className={`${kelasTombol} mt-3`} aria-expanded={buka === v.id} onClick={() => setBuka(buka === v.id ? null : v.id)} data-bandingkan={v.versi}>
                {buka === v.id ? "Tutup perbandingan" : `Bandingkan dengan ${sebelum.versi}`}
              </button>
            )}
            {sebelum && buka === v.id && <Perbandingan lama={sebelum.isi_md} baru={v.isi_md} />}
          </section>
        );
      })}
    </div>
  );
}

/** Baris yang berubah + 2 baris konteks; baris sama yang panjang diringkas. Label teks, tidak hanya warna. */
function Perbandingan({ lama, baru }: { lama: string; baru: string }) {
  const baris = useMemo(() => diffBaris(lama, baru), [lama, baru]);
  const tampil = useMemo(() => {
    const dekat = baris.map((_, i) => baris.slice(Math.max(0, i - 2), i + 3).some((b) => b.jenis !== "sama"));
    const out: (BarisDiff | { lewati: number })[] = [];
    let lewati = 0;
    baris.forEach((b, i) => {
      if (dekat[i]) { if (lewati) out.push({ lewati }); lewati = 0; out.push(b); } else lewati++;
    });
    if (lewati) out.push({ lewati });
    return out;
  }, [baris]);
  const ubah = baris.filter((b) => b.jenis !== "sama").length;
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-white/10 font-mono text-[12px]" data-diff>
      {ubah === 0 ? <p className="p-3 text-gray-500">Tidak ada perbedaan isi.</p> : tampil.map((b, i) => (
        <Fragment key={i}>
          {"lewati" in b
            ? <div className="px-3 py-1 text-gray-600">… {b.lewati} baris sama</div>
            : <div className={`flex gap-2 whitespace-pre-wrap px-3 py-0.5 ${b.jenis === "tambah" ? "bg-emerald-500/10 text-emerald-300" : b.jenis === "hapus" ? "bg-red-500/10 text-red-300" : "text-gray-500"}`} data-diff-jenis={b.jenis}>
                <span className="w-[84px] shrink-0 font-bold">{b.jenis === "tambah" ? "+ ditambah" : b.jenis === "hapus" ? "− dihapus" : ""}</span>
                <span className={b.jenis === "hapus" ? "line-through" : ""}>{b.teks || " "}</span>
              </div>}
        </Fragment>
      ))}
    </div>
  );
}
