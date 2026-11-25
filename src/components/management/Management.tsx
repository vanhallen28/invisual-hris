// src/components/management/Management.tsx
// Kerangka section Management (dipakai /admin/management & /user/management).
// Tab dikendalikan ?tab= : ringkasan | pedoman | usulan | serah-terima | harian | anggota. Tab P2 hanya tampil bila tabelnya ada (SQL P2 sudah dijalankan).
// Akses ditentukan database (mgmt_peran_saya); SQL belum dijalankan → pesan "belum tersedia".
"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { bisa, muatDivisiSaya, muatPeranSaya, PERAN_LABEL, type PeranManagement } from "@/lib/management/akses";
import TabRingkasan from "./TabRingkasan";
import TabPedoman from "./TabPedoman";
import TabUsulan from "./TabUsulan";
import KelolaAnggota from "./KelolaAnggota";
import TabSerahTerima from "./TabSerahTerima";
import TabHarian from "./TabHarian";
import { adaRingkasanHarian } from "@/lib/management/harian";
import { adaSerahTerima } from "@/lib/management/serahTerima";
import { adaTugas } from "@/lib/management/tugas";
import TabTugas from "./TabTugas";

type KunciTab = "ringkasan" | "tugas" | "pedoman" | "usulan" | "serah-terima" | "harian" | "anggota";
export type Fitur = { serahTerima: boolean; harian: boolean; tugas?: boolean };
const TAB: { kunci: KunciTab; label: string; boleh?: (p: PeranManagement[], f: Fitur) => boolean }[] = [
  { kunci: "ringkasan", label: "Ringkasan" },
  { kunci: "tugas", label: "Tugas", boleh: (_p, f) => !!f.tugas },
  { kunci: "pedoman", label: "Pedoman" },
  { kunci: "usulan", label: "Usulan" },
  { kunci: "serah-terima", label: "Serah Terima", boleh: (_p, f) => f.serahTerima },
  { kunci: "harian", label: "Harian", boleh: (_p, f) => f.harian },
  { kunci: "anggota", label: "Anggota", boleh: (p) => bisa(p, "kelola_anggota") },
];

export default function Management({ portal }: { portal: "admin" | "user" }) {
  const router = useRouter();
  const pathname = usePathname();
  const cari = useSearchParams();
  const [peran, setPeran] = useState<PeranManagement[] | null | undefined>(undefined);   // undefined = memuat
  const [divisi, setDivisi] = useState<string[]>([]);
  const [fitur, setFitur] = useState<Fitur>({ serahTerima: false, harian: false });

  useEffect(() => {
    let hidup = true;
    (async () => {
      const [p, st, rh, tg] = await Promise.all([muatPeranSaya(supabase), adaSerahTerima(supabase), adaRingkasanHarian(supabase), adaTugas(supabase)]);
      const d = p && p.length ? await muatDivisiSaya(supabase) : [];
      if (hidup) { setPeran(p); setDivisi(d); setFitur({ serahTerima: st, harian: rh, tugas: tg }); }
    })();
    return () => { hidup = false; };
  }, []);

  if (peran === undefined) {
    return <div className="py-20 text-center text-sm text-gray-500" aria-busy="true">Memuat Management…</div>;
  }
  if (!peran || peran.length === 0) {
    return (
      <Kartu>
        <h1 className="font-display text-2xl font-bold text-white tracking-tight">Management</h1>
        <p className="mt-2 text-sm text-gray-400">
          {peran === null ? "Fitur Management belum tersedia." : "Halaman ini hanya untuk anggota Management."}
          {portal === "user" && peran !== null ? <> Pedoman yang berlaku bisa dibaca di <Link href="/user/pedoman" className="text-tint underline">menu Pedoman</Link>.</> : null}
        </p>
      </Kartu>
    );
  }

  const tabTampil = TAB.filter((t) => !t.boleh || t.boleh(peran, fitur));
  const diminta = cari.get("tab") as KunciTab | null;
  const tab: KunciTab = tabTampil.some((t) => t.kunci === diminta) ? (diminta as KunciTab) : "ringkasan";
  const pindah = (k: KunciTab) => router.replace(`${pathname}?tab=${k}`, { scroll: false });

  return (
    <div className="space-y-5" data-management>
      <div className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03]">
        <div>
          <h1 className="font-display text-2xl font-bold text-white tracking-tight">Management</h1>
          <p className="mt-1 text-xs text-gray-500">Pedoman, Log Usulan, dan hal yang perlu ditindaklanjuti lintas divisi.</p>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Peran Anda">
          {peran.map((p) => (
            <span key={p} className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-wide text-gray-300">{PERAN_LABEL[p]}</span>
          ))}
        </div>
      </div>

      <div role="tablist" aria-label="Bagian Management" className="flex gap-1 overflow-x-auto whitespace-nowrap border-b border-white/10 [scrollbar-width:thin]">
        {tabTampil.map((t) => (
          <button key={t.kunci} type="button" role="tab" id={`tab-${t.kunci}`} aria-selected={tab === t.kunci} aria-controls={`panel-${t.kunci}`}
            data-tab-mgmt={t.kunci} onClick={() => pindah(t.kunci)}
            className={`shrink-0 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${tab === t.kunci ? "border-white text-white" : "border-transparent text-gray-500 hover:text-gray-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "ringkasan" && <TabRingkasan peran={peran} divisi={divisi} portal={portal} fitur={fitur} />}
        {tab === "tugas" && <TabTugas key={`t-${cari.get("sub") || ""}`} peran={peran} divisi={divisi} fitur={fitur} subAwal={cari.get("sub")} />}
        {tab === "pedoman" && <TabPedoman key={`p-${cari.get("sub") || ""}`} peran={peran} divisi={divisi} subAwal={cari.get("sub")} />}
        {tab === "usulan" && <TabUsulan key={`u-${cari.get("id") || ""}`} peran={peran} divisi={divisi} idAwal={cari.get("id")} />}
        {tab === "serah-terima" && <TabSerahTerima peran={peran} divisi={divisi} />}
        {tab === "harian" && <TabHarian peran={peran} divisi={divisi} />}
        {tab === "anggota" && <KelolaAnggota peran={peran} impor={fitur.serahTerima} />}
      </div>
    </div>
  );
}

export function Kartu({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-white/10 bg-kartu p-5 ${className}`}>{children}</section>;
}
