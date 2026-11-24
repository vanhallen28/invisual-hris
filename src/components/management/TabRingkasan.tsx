// src/components/management/TabRingkasan.tsx
// Ringkasan: panel "Perlu tindakan saya" + papan kondisi (usulan berjalan, umur usulan, status baca Pedoman).
// Papan Serah Terima & Ringkasan Harian menyusul di P2.
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { muatPetaLibur } from "@/lib/hariLiburData";
import { bisa, type PeranManagement } from "@/lib/management/akses";
import { muatBaris, muatStatusBaca, muatVersi, sudahBaca } from "@/lib/management/pedoman";
import { hitungPerluTindakan, type ItemTindakan } from "@/lib/management/perluTindakan";
import { LABEL_STATUS, muatDampak, muatUsulan, sudahDiputuskan, umurMerah, type StatusUsulan } from "@/lib/management/usulan";
import { isoWib, tambahHariIso } from "@/lib/management/hariKerja";
import PerluTindakan from "./PerluTindakan";
import { Lencana } from "./ui";
import { WARNA_STATUS } from "./TabUsulan";

type Papan = { usulan: { id: string; nomor: string; judul: string; status: StatusUsulan; dibuat_pada: string }[]; baca: { sudah: number; total: number; versi: string } | null };

export default function TabRingkasan({ peran, divisi }: { peran: PeranManagement[]; divisi: string[]; portal: "admin" | "user" }) {
  const pathname = usePathname();
  const [item, setItem] = useState<ItemTindakan[] | null>(null);
  const [papan, setPapan] = useState<Papan | null>(null);

  useEffect(() => {
    let hidup = true;
    (async () => {
      const hari = isoWib(new Date());
      const [{ data: au }, usulan, dampak, versi, tautan, peta] = await Promise.all([
        supabase.auth.getUser().catch(() => ({ data: { user: null } })), muatUsulan(supabase), muatDampak(supabase), muatVersi(supabase),
        muatBaris(supabase, "mgmt_pedoman_usulan"), muatPetaLibur(supabase, tambahHariIso(hari, -30), tambahHariIso(hari, 7)).catch(() => null),
      ]);
      const uid = au?.user?.id;
      const berlaku = (versi || []).find((v) => v.status === "berlaku");
      const belumBaca = !!berlaku && !!uid && !(await sudahBaca(supabase, berlaku.id, uid));
      let baca: Papan["baca"] = null;
      if (berlaku && bisa(peran, "lihat_status_baca_semua")) {
        const st = await muatStatusBaca(supabase, berlaku.id);
        if (st) baca = { versi: berlaku.versi, total: st.length, sudah: st.filter((x) => x.sudah).length };
      }
      if (!hidup) return;
      setItem(hitungPerluTindakan({ usulan: usulan || [], dampak, tautanPedoman: tautan.map((t) => String(t.usulan_id)), pedomanBelumDibaca: belumBaca, peta }, peran, divisi, new Date()));
      setPapan({ usulan: (usulan || []) as Papan["usulan"], baca });
    })();
    return () => { hidup = false; };
  }, [peran, divisi]);

  const sekarang = new Date();
  const berjalan = (papan?.usulan || []).filter((u) => !sudahDiputuskan(u.status));
  const tua = berjalan.filter((u) => umurMerah(u.dibuat_pada, u.status, sekarang));
  const hitung = (s: StatusUsulan) => berjalan.filter((u) => u.status === s).length;

  return (
    <div className="space-y-4" data-tab-ringkasan>
      <PerluTindakan item={item} dasar={pathname || ""} />
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-white/10 bg-kartu p-5" data-papan="usulan">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Usulan berjalan</p>
          <p className="mt-1 font-display text-3xl text-white tabular-nums">{papan ? berjalan.length : "–"}</p>
          <ul className="mt-3 grid gap-1.5">
            {(["diajukan", "cek_dampak", "siap_diputuskan", "berlaku_darurat", "masa_keberatan", "ditunda"] as StatusUsulan[]).map((s) => (
              <li key={s} className="flex items-center justify-between text-xs"><Lencana warna={WARNA_STATUS[s]}>{LABEL_STATUS[s]}</Lencana><span className="font-mono text-gray-300 tabular-nums">{papan ? hitung(s) : "–"}</span></li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-white/10 bg-kartu p-5" data-papan="umur">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Umur usulan</p>
          <p className="mt-1 font-display text-3xl text-white tabular-nums">{papan ? tua.length : "–"}</p>
          <p className="text-xs text-gray-500">belum diputuskan lebih dari 7 hari</p>
          <ul className="mt-3 grid gap-1.5">{tua.slice(0, 5).map((u) => <li key={u.id} className="text-xs text-gray-300"><span className="font-mono text-gray-500">{u.nomor}</span> {u.judul} <Lencana warna="merah">Lewat 7 hari</Lencana></li>)}</ul>
        </section>
        <section className="rounded-xl border border-white/10 bg-kartu p-5" data-papan="baca">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Status baca Pedoman{papan?.baca ? ` ${papan.baca.versi}` : ""}</p>
          {papan?.baca ? (
            <>
              <p className="mt-1 font-display text-3xl text-white tabular-nums">{papan.baca.sudah}/{papan.baca.total}</p>
              <p className="text-xs text-gray-500">sudah mengonfirmasi · target ≥ 95% dalam 3 hari kerja</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${papan.baca.sudah} dari ${papan.baca.total} sudah membaca`}>
                <div className="h-full bg-emerald-400" style={{ width: `${papan.baca.total ? Math.round((papan.baca.sudah / papan.baca.total) * 100) : 0}%` }} />
              </div>
            </>
          ) : <p className="mt-2 text-xs text-gray-500">{papan ? "Tampil untuk PM, HR, Studio Manager, dan owner setelah ada Pedoman yang berlaku." : "Memuat…"}</p>}
        </section>
      </div>
      <p className="text-[11px] text-gray-600">Papan Serah Terima dan Ringkasan Harian ditambahkan di tahap berikutnya (P2).</p>
    </div>
  );
}
