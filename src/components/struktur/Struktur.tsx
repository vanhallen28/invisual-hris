// src/components/struktur/Struktur.tsx
// Halaman Struktur Perusahaan: bagan Owner → Studio Manager → PM & HR → 3 Leader → staf per divisi.
// Klik simpul → laci Jobdesk / SOP / Tugas rutin / KPI / Riwayat (LaciPosisi). Edit & penempatan staf hanya
// untuk akun @invisual.studio (ditegakkan database lewat RPC; lihat struktur.sql).
// Warna kartu & palet (struktur-warna.sql): hanya aktif bila org_struktur() mengirim palet; tanpa warna = tampilan bawaan.
"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DIVISI_UTAMA, LABEL_DIVISI, cariPosisiStaf, muatStruktur, susunBagan, tempatkanStaf,
  type Bagan, type DataStruktur, type Divisi, type HasilMuat, type Simpul, type Staf,
} from "@/lib/struktur/struktur";
import { cariWarna, gayaWarna, pemakaianWarna, type WarnaPalet } from "@/lib/struktur/warna";
import { Kosong, Lencana, PesanGalat, kelasTombol } from "@/components/management/ui";
import LaciPosisi, { type Pilihan } from "./LaciPosisi";
import EditorPalet from "./EditorPalet";
import "./warna-kartu.css";   // gaya kartu berwarna — hanya dimuat di halaman ini

const LABEL_JENIS: Record<string, string> = { owner: "Owner", studio_manager: "Management", pm: "Pendukung", hr: "Pendukung", leader: "Leader" };

function TombolSimpul({ s, dipilih, onPilih, warna }: { s: Simpul; dipilih: boolean; onPilih: () => void; warna: WarnaPalet | null }) {
  const p = s.posisi;
  const g = gayaWarna(warna);
  return (
    <button type="button" onClick={onPilih} aria-pressed={dipilih} data-simpul={p.jenis} data-warna={g["data-warna"]} style={g.style}
      className={`grid w-44 max-w-full gap-0.5 rounded-xl border bg-kartu px-3.5 py-3 text-left transition-colors sm:w-48 ${dipilih ? "border-tint ring-1 ring-tint" : "border-white/15 hover:border-white/35"} ${p.jenis === "pm" || p.jenis === "hr" ? "border-dashed" : ""}${g.className ? ` ${g.className}` : ""}`}>
      <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">{LABEL_JENIS[p.jenis]}{p.jenis === "leader" && p.divisi ? ` · ${LABEL_DIVISI[p.divisi]}` : ""}</span>
      <span className={`text-sm font-semibold ${s.nama ? "text-white" : "italic text-gray-500"}`}>{s.nama || "Belum ada pemegang"}</span>
      <span className="text-xs text-gray-400">{p.judul}</span>
    </button>
  );
}

function Tingkat({ children, garis = true }: { children: React.ReactNode; garis?: boolean }) {
  return (
    <div className="relative flex w-full flex-wrap justify-center gap-3">
      {garis && <span aria-hidden className="absolute -top-6 left-1/2 h-6 w-px bg-white/15" />}
      {children}
    </div>
  );
}

export default function Struktur({ portal }: { portal: "admin" | "user" }) {
  const [hasil, setHasil] = useState<HasilMuat | undefined>(undefined);
  const [pilihan, setPilihan] = useState<Pilihan | null>(null);
  const [aturTempat, setAturTempat] = useState(false);
  const [sibukTempat, setSibukTempat] = useState<string | null>(null);
  const [galatTempat, setGalatTempat] = useState<string | null>(null);
  const [aturPalet, setAturPalet] = useState(false);
  const laci = useRef<HTMLDivElement>(null);
  const editorPalet = useRef<HTMLDivElement>(null);

  const muat = async () => {
    const h = await muatStruktur(supabase);
    setHasil(h);
    return h;
  };
  useEffect(() => {
    let hidup = true;
    muatStruktur(supabase).then((h) => { if (hidup) setHasil(h); });
    return () => { hidup = false; };
  }, []);

  if (hasil === undefined) return <div className="py-20 text-center text-sm text-gray-500" aria-busy="true">Memuat struktur…</div>;
  if (hasil.status !== "ok") {
    return (
      <section className="rounded-xl border border-white/10 bg-kartu p-5" data-struktur-tertutup>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">Struktur Perusahaan</h1>
        <p className="mt-2 text-sm text-gray-400">
          {hasil.status === "galat" ? `Gagal memuat: ${hasil.pesan}` : hasil.status === "belum_dipasang" ? "Fitur Struktur belum tersedia." : "Struktur perusahaan belum dibuka untuk akun Anda."}
        </p>
      </section>
    );
  }

  const data: DataStruktur = hasil.data;
  const bagan: Bagan = susunBagan(data);
  const pilih = (p: Pilihan) => {
    setPilihan(p);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
      requestAnimationFrame(() => laci.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };
  const kunciPilihan = pilihan?.jenis === "simpul" ? pilihan.kunci : pilihan?.jenis === "staf" ? `staf:${pilihan.staf.id}` : null;
  const simpul = (s: Simpul) => <TombolSimpul key={s.kunci} s={s} dipilih={kunciPilihan === s.kunci} warna={cariWarna(data.palet, s.posisi.warna)} onPilih={() => pilih({ jenis: "simpul", kunci: s.kunci, posisiId: s.posisi.id, nama: s.nama })} />;
  const fiturWarna = !!data.palet;
  const pakai = pemakaianWarna(data.posisi);
  const legenda = (data.palet?.warna || []).filter((w) => pakai.has(w.id));
  const bukaPalet = () => {
    setAturPalet(true);
    requestAnimationFrame(() => editorPalet.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const ubahTempat = async (st: Staf, dv: string) => {
    if (!dv || dv === st.divisi) return;
    setSibukTempat(st.id); setGalatTempat(null);
    const g = await tempatkanStaf(supabase, st.id, dv as Divisi);
    if (g) setGalatTempat(g);
    await muat();
    setSibukTempat(null);
  };
  const chipStaf = (st: Staf) => {
    if (aturTempat) return (
    <label key={st.id} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs text-gray-300" data-atur-staf={st.id}>
      <span className="min-w-0 flex-1 basis-28"><span className="text-white">{st.nama}</span> <span className="text-gray-500">{st.jabatan || "Tanpa jabatan"}</span></span>
      <select value={st.divisi || ""} disabled={sibukTempat === st.id} onChange={(e) => ubahTempat(st, e.target.value)} aria-label={`Divisi ${st.nama}`}
        className="rounded-md border border-white/10 bg-input px-1.5 py-1 text-xs text-white">
        {!st.divisi && <option value="">Pilih divisi</option>}
        {[...DIVISI_UTAMA, "lainnya" as Divisi].map((d) => <option key={d} value={d}>{LABEL_DIVISI[d]}</option>)}
      </select>
    </label>
    );
    const g = gayaWarna(cariWarna(data.palet, cariPosisiStaf(data.posisi, st.divisi, st.jabatan)?.warna), "chip-warna");
    return (
      <button key={st.id} type="button" onClick={() => pilih({ jenis: "staf", staf: st })} aria-pressed={kunciPilihan === `staf:${st.id}`} data-staf={st.id} data-warna={g["data-warna"]} style={g.style}
        className={`rounded-full border px-2.5 py-1 text-left text-xs transition-colors ${kunciPilihan === `staf:${st.id}` ? "border-tint text-white" : "border-white/10 bg-white/[0.04] text-gray-300 hover:border-white/30"}${g.className ? ` ${g.className}` : ""}`}>
        {st.nama}{st.jabatan ? <span className="ml-1 text-gray-500">{st.jabatan}</span> : null}
      </button>
    );
  };

  return (
    <div className="grid gap-5" data-struktur>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">Struktur Perusahaan</h1>
          <p className="mt-1 text-sm text-gray-400">Klik peran atau nama untuk melihat jobdesk, SOP, dan tugas rutinnya.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.bolehEdit && <Lencana warna="biru">Anda bisa mengedit</Lencana>}
          {data.bolehEdit && <Lencana warna={data.terbuka ? "hijau" : "abu"} data-status-struktur={data.terbuka ? "terbuka" : "tertutup"}>{data.terbuka ? "Terlihat semua karyawan" : "Hanya @invisual.studio"}</Lencana>}
          {data.bolehEdit && fiturWarna && (
            <button type="button" className={kelasTombol} onClick={() => (aturPalet ? setAturPalet(false) : bukaPalet())} aria-pressed={aturPalet} data-atur-palet>
              {aturPalet ? "Tutup palet" : "Palet warna"}
            </button>
          )}
          {data.bolehEdit && (
            <button type="button" className={kelasTombol} onClick={() => { setAturTempat((v) => !v); setGalatTempat(null); }} aria-pressed={aturTempat} data-atur-penempatan>
              {aturTempat ? "Selesai mengatur" : "Atur penempatan staf"}
            </button>
          )}
        </div>
      </div>

      {legenda.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-legenda aria-label="Legenda warna">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-wider text-gray-500">Legenda</span>
          {legenda.map((w) => {
            const g = gayaWarna(w, "chip-warna");
            return <span key={w.id} style={g.style} data-legenda-warna={w.id} className="chip-warna rounded-full border border-white/10 px-2.5 py-1 text-xs font-semibold text-white">{w.nama}</span>;
          })}
        </div>
      )}

      {aturPalet && data.bolehEdit && data.palet && (
        <div ref={editorPalet} className="scroll-mt-20">
          <EditorPalet palet={data.palet} posisi={data.posisi} onTersimpan={muat} onTutup={() => setAturPalet(false)} />
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 rounded-xl border border-white/10 bg-kartu p-4 md:p-6" aria-label="Bagan struktur">
          <div className="grid justify-items-center gap-6">
            <Tingkat garis={false}>{bagan.owner.map(simpul)}</Tingkat>
            {bagan.sm.length > 0 && <Tingkat>{bagan.sm.map(simpul)}</Tingkat>}
            {bagan.pendukung.length > 0 && <Tingkat>{bagan.pendukung.map(simpul)}</Tingkat>}
            <div className="relative grid w-full gap-3 md:grid-cols-3">
              <span aria-hidden className="absolute -top-6 left-1/2 hidden h-6 w-px bg-white/15 md:block" />
              {bagan.divisi.map((g) => (
                <div key={g.divisi} className={`grid min-w-0 content-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.015] p-3 ${g.divisi === "lainnya" ? "md:col-span-3" : ""}`} data-divisi={g.divisi}>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">Divisi {LABEL_DIVISI[g.divisi]}</span>
                  {g.leader.length > 0 && <div className="grid gap-2 [&>button]:w-full">{g.leader.map(simpul)}</div>}
                  <div className={aturTempat ? "grid min-w-0 gap-1.5" : "flex flex-wrap gap-1.5"}>
                    {g.staf.length ? g.staf.map(chipStaf) : <span className="text-xs text-gray-600">Belum ada staf</span>}
                  </div>
                </div>
              ))}
            </div>
            {(bagan.belumDitempatkan.length > 0 || aturTempat) && (
              <div className="w-full rounded-xl border border-dashed border-white/15 p-3" data-belum-ditempatkan>
                <p className="mb-2 text-xs text-gray-400"><span className="font-semibold text-gray-300">Belum ditempatkan ({bagan.belumDitempatkan.length})</span>
                  {data.bolehEdit ? (aturTempat ? " · pilih divisi untuk tiap orang." : " · tekan \"Atur penempatan staf\" untuk memilih divisinya.") : null}</p>
                <div className={aturTempat ? "grid gap-1.5 md:grid-cols-2" : "flex flex-wrap gap-1.5"}>
                  {bagan.belumDitempatkan.length ? bagan.belumDitempatkan.map(chipStaf) : <span className="text-xs text-gray-600">Semua staf sudah ditempatkan.</span>}
                </div>
              </div>
            )}
            <PesanGalat pesan={galatTempat} />
          </div>
        </section>

        <div ref={laci} className="scroll-mt-20 lg:sticky lg:top-6">
          {pilihan
            ? <LaciPosisi key={kunciPilihan || ""} pilihan={pilihan} data={data} bagan={bagan} portal={portal} onTersimpan={muat} onAturPalet={bukaPalet} />
            : <Kosong>Pilih peran atau nama di bagan untuk melihat jobdesk, SOP, tugas rutin, dan KPI-nya.</Kosong>}
        </div>
      </div>
    </div>
  );
}
