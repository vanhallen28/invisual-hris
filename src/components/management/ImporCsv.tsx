// src/components/management/ImporCsv.tsx
// Impor SEKALI dari sheet sementara (CSV): Log Usulan & Serah Terima yang masih berjalan.
// Alur: pilih/tempel CSV → pratinjau + validasi per baris → impor baris yang siap satu per satu → laporan per baris.
// Hanya Studio Manager; aturan ditegakkan RPC (mgmt_impor_usulan, mgmt_ajukan_usulan, mgmt_buat_serah_terima).
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { muatPetaLibur } from "@/lib/hariLiburData";
import type { PetaLibur } from "@/lib/hariLibur";
import { isoWib, tambahHariIso } from "@/lib/management/hariKerja";
import { KOLOM_SERAH_TERIMA, KOLOM_USULAN, bacaCsv, validasiSerahTerima, validasiUsulan, type DataSerahTerima, type DataUsulan, type Hasil } from "@/lib/management/imporCsv";
import { buatSerahTerima, muatSerahTerima } from "@/lib/management/serahTerima";
import { ajukanUsulan, imporUsulan, muatUsulan } from "@/lib/management/usulan";
import { Lencana, PesanGalat, kelasInput, kelasLabel, kelasTombol, kelasTombolUtama } from "./ui";

type Rencana = Hasil<DataUsulan> | Hasil<DataSerahTerima>;
type Akhir = { ok: boolean; teks: string };

export default function ImporCsv({ onTutup }: { onTutup: () => void }) {
  const toast = useToast();
  const [teks, setTeks] = useState("");
  const [namaBerkas, setNamaBerkas] = useState("");
  const [ada, setAda] = useState<{ usulan: { nomor: string; judul: string }[]; st: { jenis: string; judul: string; status: string }[]; peta: PetaLibur | null } | null>(null);
  const [akhir, setAkhir] = useState<Record<number, Akhir>>({});
  const [sibuk, setSibuk] = useState(false);
  const [sekarang] = useState(() => new Date());

  // Data yang sudah tercatat — untuk cek duplikat. Dimuat ulang setelah impor, jadi memilih berkas yang sama lagi tidak menggandakan baris.
  const muatAda = useCallback(async () => {
    const h = isoWib(new Date());
    const [u, s, p] = await Promise.all([muatUsulan(supabase), muatSerahTerima(supabase, h), muatPetaLibur(supabase, tambahHariIso(h, -14), tambahHariIso(h, 120)).catch(() => null)]);
    setAda({ usulan: (u || []) as { nomor: string; judul: string }[], st: (s || []) as { jenis: string; judul: string; status: string }[], peta: p });
  }, []);
  useEffect(() => { const t = setTimeout(muatAda, 0); return () => clearTimeout(t); }, [muatAda]);

  const csv = useMemo(() => (teks.trim() ? bacaCsv(teks) : null), [teks]);
  const rencana: Rencana[] = useMemo(() => {
    if (!csv?.jenis || !ada) return [];
    // Cek duplikat di dalam berkas juga: baris yang sudah lolos ikut menjadi "ada" untuk baris berikutnya.
    const u = [...ada.usulan], s = [...ada.st];
    return csv.baris.map((b, i) => {
      if (csv.jenis === "usulan") {
        const r = validasiUsulan(b, i + 2, sekarang, u);
        if (r.ok && r.data) u.push({ nomor: `baris ${i + 2}`, judul: r.data.judul });
        return r;
      }
      const r = validasiSerahTerima(b, i + 2, sekarang, ada.peta, s);
      if (r.ok && r.data) s.push({ jenis: r.data.jenis, judul: r.data.judul, status: "berjalan" });
      return r;
    });
  }, [csv, ada, sekarang]);

  const siap = rencana.filter((r) => r.ok && r.aksi !== "lewati" && !akhir[r.baris]);
  const selesai = Object.keys(akhir).length > 0;

  const pilihBerkas = (f: File | undefined) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { setTeks(String(rd.result || "")); setNamaBerkas(f.name); setAkhir({}); };
    rd.readAsText(f);
  };

  const impor = async () => {
    setSibuk(true);
    let ok = 0, gagal = 0;
    for (const r of siap) {
      let h;
      if (r.aksi === "impor") h = await imporUsulan(supabase, r.data as DataUsulan);
      else if (r.aksi === "ajukan") { const d = r.data as DataUsulan; h = await ajukanUsulan(supabase, { ...d, jalur: "biasa" }); }
      else h = await buatSerahTerima(supabase, r.data as DataSerahTerima);
      const nomor = (h.data as { nomor?: string } | undefined)?.nomor;
      setAkhir((a) => ({ ...a, [r.baris]: h.ok ? { ok: true, teks: nomor ? `Masuk — ${nomor}` : "Masuk" } : { ok: false, teks: h.pesan || "Gagal" } }));
      if (h.ok) ok++; else gagal++;
    }
    await muatAda();
    setSibuk(false);
    if (gagal) toast.gagal(`${ok} baris masuk, ${gagal} gagal — lihat alasannya di tabel.`);
    else toast.sukses(`${ok} baris masuk.`);
  };

  return (
    <section className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4" data-impor-csv>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-[68ch]">
          <h3 className="text-sm font-bold text-white">Impor dari sheet</h3>
          <p className="mt-0.5 text-xs text-gray-500">Sekali saja, untuk memindahkan isi sheet sementara. Ekspor sheet sebagai CSV, lalu pilih berkasnya. Usulan yang sudah diputuskan dicatat dengan status &amp; tanggal aslinya; serah terima hanya yang masih berjalan.</p>
        </div>
        <button type="button" className={kelasTombol} onClick={onTutup} disabled={sibuk}>Tutup</button>
      </div>
      <details className="text-xs text-gray-400">
        <summary className="cursor-pointer font-semibold text-gray-300">Kolom yang dikenali</summary>
        <p className="mt-2 break-words"><b className="text-gray-300">Usulan:</b> <span className="font-mono">{KOLOM_USULAN.join(", ")}</span>. Status akhir: Diajukan, Disetujui, Ditolak, Ditunda, Berlaku, Dicabut. Tanggal: YYYY-MM-DD atau DD/MM/YYYY.</p>
        <p className="mt-1 break-words"><b className="text-gray-300">Serah terima:</b> <span className="font-mono">{KOLOM_SERAH_TERIMA.join(", ")}</span>. Waktu: YYYY-MM-DD HH:MM (WIB). Status: Berjalan, Selesai, atau Batal.</p>
        <p className="mt-1">Usulan berstatus Disetujui akan muncul di &ldquo;Terbitkan Pedoman&rdquo; sampai ditautkan ke versi; pakai Berlaku bila sudah masuk Pedoman.</p>
      </details>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={kelasLabel} htmlFor="impor-berkas">Berkas CSV
          <input id="impor-berkas" type="file" accept=".csv,text/csv" className={`${kelasInput} file:mr-3 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-gray-200`}
            onChange={(e) => pilihBerkas(e.target.files?.[0])} disabled={sibuk} />
          {namaBerkas ? <span className="font-normal text-gray-500">{namaBerkas}</span> : null}
        </label>
        <label className={kelasLabel} htmlFor="impor-teks">atau tempel isi CSV
          <textarea id="impor-teks" className={`${kelasInput} min-h-[72px] font-mono text-[11px]`} value={teks} disabled={sibuk}
            onChange={(e) => { setTeks(e.target.value); setNamaBerkas(""); setAkhir({}); }} placeholder="judul,masalah,perubahan,…" /></label>
      </div>
      {csv?.galat && <PesanGalat pesan={csv.galat} />}
      {csv?.jenis && (
        <>
          <p className="text-xs text-gray-300" data-ringkas-impor>
            Jenis: <b>{csv.jenis === "usulan" ? "Log Usulan" : "Serah Terima"}</b> · {rencana.length} baris · {rencana.filter((r) => r.ok && r.aksi !== "lewati").length} siap ·{" "}
            {rencana.filter((r) => r.aksi === "lewati").length} dilewati · {rencana.filter((r) => !r.ok).length} bermasalah
          </p>
          <div className="overflow-x-auto rounded-lg border border-white/10">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-white/10 text-left text-[10.5px] uppercase tracking-wide text-gray-500">
                {["Baris", "Judul", "Rencana", "Status"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {rencana.map((r) => {
                  const a = akhir[r.baris];
                  const judul = (r.data as { judul?: string } | undefined)?.judul || csv.baris[r.baris - 2]?.judul || "—";
                  return (
                    <tr key={r.baris} className="border-b border-white/5 align-top last:border-0" data-baris-impor={r.baris}>
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.baris}</td>
                      <td className="px-3 py-2 text-white">{judul}</td>
                      <td className="px-3 py-2 text-xs text-gray-400">{r.ok ? r.ringkas : <span className="text-red-300">{r.pesan}</span>}</td>
                      <td className="px-3 py-2" data-status-impor>
                        {a ? <span className="flex flex-col gap-1"><Lencana warna={a.ok ? "hijau" : "merah"}>{a.ok ? "Masuk" : "Gagal"}</Lencana><span className={`text-[11px] ${a.ok ? "text-gray-400" : "text-red-300"}`}>{a.teks}</span></span>
                          : !r.ok ? <Lencana warna="merah">Bermasalah</Lencana> : r.aksi === "lewati" ? <Lencana>Dilewati</Lencana> : <Lencana warna="biru">Siap</Lencana>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {selesai && !siap.length ? <span className="text-xs text-gray-400">Impor selesai. Baris bermasalah bisa diperbaiki di sheet lalu dipilih ulang.</span> : null}
            <button type="button" className={kelasTombolUtama} disabled={sibuk || !siap.length || !ada} onClick={impor} data-kirim-impor>
              {sibuk ? "Mengimpor…" : `Impor ${siap.length} baris`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
