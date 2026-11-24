// src/components/management/TabRingkasan.tsx
// Ringkasan: panel "Perlu tindakan saya" + papan kondisi (usulan berjalan, umur usulan, status baca Pedoman).
// Bila management-p2.sql sudah dijalankan: item P2 di "Perlu tindakan" + papan Serah Terima & Ringkasan Harian hari ini.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { muatPetaLibur } from "@/lib/hariLiburData";
import { adalahLeader, bisa, DIVISI_LABEL, type PeranManagement } from "@/lib/management/akses";
import { muatBaris, muatStatusBaca, muatVersi, sudahBaca } from "@/lib/management/pedoman";
import { hitungPerluTindakan, type ItemTindakan } from "@/lib/management/perluTindakan";
import { LABEL_STATUS, muatDampak, muatUsulan, sudahDiputuskan, umurMerah, type StatusUsulan } from "@/lib/management/usulan";
import { adalahHariKerja, isoWib, tambahHariIso } from "@/lib/management/hariKerja";
import { muatSerahTerima } from "@/lib/management/serahTerima";
import { hariDihitung, muatCutiLeader, muatRingkasan, petaCutiLeader } from "@/lib/management/harian";
import type { Fitur } from "./Management";
import PerluTindakan from "./PerluTindakan";
import { Lencana } from "./ui";
import { WARNA_STATUS } from "./TabUsulan";

type Papan = { usulan: { id: string; nomor: string; judul: string; status: StatusUsulan; dibuat_pada: string }[]; baca: { sudah: number; total: number; versi: string } | null;
  st: { status: string; tenggat: string; ditindaklanjuti_pada: string | null }[] | null; rh: { divisi: string }[] | null; cuti: Set<string>; hariKerja: boolean };
const DIVISI_LEADER = ["sosmed", "service", "marketplace"];

export default function TabRingkasan({ peran, divisi, fitur }: { peran: PeranManagement[]; divisi: string[]; portal: "admin" | "user"; fitur?: Fitur }) {
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
      // P2: hanya dimuat bila tabelnya ada (fitur dari Management) — tanpa SQL P2 tidak ada kueri tambahan.
      const divL = divisi.find((d) => DIVISI_LEADER.includes(d));
      const [st, rh, cuti] = await Promise.all([
        fitur?.serahTerima ? muatSerahTerima(supabase, tambahHariIso(hari, -1)) : Promise.resolve(null),
        fitur?.harian ? muatRingkasan(supabase, hari, hari) : Promise.resolve(null),
        fitur?.harian ? muatCutiLeader(supabase, hari, hari) : Promise.resolve([]),
      ]);
      if (!hidup) return;
      setItem(hitungPerluTindakan({
        usulan: usulan || [], dampak, tautanPedoman: tautan.map((t) => String(t.usulan_id)), pedomanBelumDibaca: belumBaca, peta,
        serahTerima: st || undefined, ringkasanHariIni: rh || undefined,
        sudahKirimRingkasan: rh ? rh.some((r) => r.user_id === uid) : undefined,
        hariIniDihitung: rh && divL && adalahLeader(peran) ? hariDihitung(hari, peta, petaCutiLeader(cuti).get(divL) || new Set()) : undefined,
      }, peran, divisi, new Date()));
      const pc = petaCutiLeader(cuti);
      setPapan({ usulan: (usulan || []) as Papan["usulan"], baca, st, rh, cuti: new Set(DIVISI_LEADER.filter((d) => pc.get(d)?.has(hari))), hariKerja: adalahHariKerja(hari, peta) });
    })();
    return () => { hidup = false; };
  }, [peran, divisi, fitur?.serahTerima, fitur?.harian]);

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
      {fitur?.serahTerima || fitur?.harian ? (
        <div className="grid gap-4 md:grid-cols-2">
          {fitur.serahTerima && (() => {
            const jalan = (papan?.st || []).filter((k) => k.status === "berjalan");
            const telat = jalan.filter((k) => Date.parse(k.tenggat) < sekarang.getTime());
            return (
              <section className="rounded-xl border border-white/10 bg-kartu p-5" data-papan="serah-terima">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Serah terima berjalan</p>
                <p className="mt-1 font-display text-3xl text-white tabular-nums">{papan?.st ? jalan.length : "–"}</p>
                <p className="text-xs text-gray-500">{telat.length} terlambat · {telat.filter((k) => !k.ditindaklanjuti_pada).length} belum ditindaklanjuti</p>
                <Link href={`${pathname}?tab=serah-terima`} className="mt-3 inline-block text-xs text-tint underline">Buka papan Serah Terima</Link>
              </section>
            );
          })()}
          {fitur.harian && (
            <section className="rounded-xl border border-white/10 bg-kartu p-5" data-papan="harian">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Ringkasan harian hari ini</p>
              {(() => {
                const ada = (d: string) => !!papan?.rh?.some((r) => r.divisi === d);
                const wajib = DIVISI_LEADER.filter((d) => !papan?.cuti.has(d) || ada(d));   // leader cuti tidak dihitung kecuali tetap mengirim
                if (papan && !papan.hariKerja) return <p className="mt-2 text-xs text-gray-500" data-bukan-hari-kerja>Hari ini bukan hari kerja — tidak ada ringkasan wajib.</p>;
                return (
                  <>
                    <p className="mt-1 font-display text-3xl text-white tabular-nums">{papan?.rh ? `${wajib.filter(ada).length}/${wajib.length}` : "–"}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {DIVISI_LEADER.map((d) => <li key={d}>{ada(d) ? <Lencana warna="hijau">{DIVISI_LABEL[d]} terkirim</Lencana>
                        : papan?.cuti.has(d) ? <Lencana warna="biru">{DIVISI_LABEL[d]} cuti</Lencana> : <Lencana warna="abu">{DIVISI_LABEL[d]} belum</Lencana>}</li>)}
                    </ul>
                  </>
                );
              })()}
              <Link href={`${pathname}?tab=harian`} className="mt-3 inline-block text-xs text-tint underline">Buka Ringkasan Harian</Link>
            </section>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-gray-600">Papan Serah Terima dan Ringkasan Harian ditambahkan di tahap berikutnya (P2).</p>
      )}
    </div>
  );
}
