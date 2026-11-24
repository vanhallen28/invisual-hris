// src/components/management/PerluTindakan.tsx — panel "Perlu tindakan saya" (isi dari lib/management/perluTindakan).
"use client";

import Link from "next/link";
import { teksTanggal } from "@/lib/tanggalTampil";
import { isoWib } from "@/lib/management/hariKerja";
import type { ItemTindakan } from "@/lib/management/perluTindakan";
import { Lencana } from "./ui";

const jamWib = (iso: string) => { const d = new Date(Date.parse(iso) + 7 * 3_600_000); return `${String(d.getUTCHours()).padStart(2, "0")}.${String(d.getUTCMinutes()).padStart(2, "0")}`; };
const teksTenggat = (t?: string) => (!t ? "" : /^\d{4}-\d{2}-\d{2}T/.test(t) ? `Tenggat ${teksTanggal(isoWib(new Date(t)))} ${jamWib(t)}` : t);

export default function PerluTindakan({ item, dasar }: { item: ItemTindakan[] | null; dasar: string }) {
  return (
    <section className="rounded-xl border border-white/10 bg-kartu p-5" data-perlu-tindakan>
      <h2 className="text-sm font-bold text-white">Perlu tindakan saya</h2>
      {item === null ? <p className="mt-3 text-sm text-gray-500" aria-busy="true">Memuat…</p>
        : item.length === 0 ? <p className="mt-3 text-sm text-gray-400">Tidak ada yang perlu Anda tindak lanjuti saat ini. Usulan, cek dampak, dan Pedoman yang menunggu Anda akan muncul di sini.</p>
        : (
          <ul className="mt-3 grid gap-2">
            {item.map((it) => (
              <li key={it.kunci} data-tindakan={it.kunci} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${it.mendesak ? "border-red-500/30 bg-red-500/[0.06]" : "border-white/5 bg-input"}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-white">{it.judul}</p>
                  <p className="text-xs text-gray-400">{[it.ket, teksTenggat(it.tenggat)].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex items-center gap-2">
                  {it.mendesak && <Lencana warna="merah">Mendesak</Lencana>}
                  <Link href={`${dasar}${it.tautan}`} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-white/10">Buka</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
