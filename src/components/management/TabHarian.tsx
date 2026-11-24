// src/components/management/TabHarian.tsx
// Ringkasan Harian (PRD P2b): formulir leader (maks 3 butir × 280 karakter per isian, sebelum 18.00 WIB) dan
// linimasa 5 hari kerja terakhir untuk ketiga divisi: Tepat waktu / Terlambat / Tidak mengirim / Cuti.
// Aturan sebenarnya ditegakkan RPC mgmt_kirim_ringkasan (management-p2.sql).
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { muatPetaLibur } from "@/lib/hariLiburData";
import type { PetaLibur } from "@/lib/hariLibur";
import { teksTanggalISO } from "@/lib/tanggalTampil";
import { adalahLeader, DIVISI_LABEL, type PeranManagement } from "@/lib/management/akses";
import { adalahHariKerja, isoWib, tambahHariIso } from "@/lib/management/hariKerja";
import {
  BATAS_RINGKASAN, MAKS_BUTIR, MAKS_KARAKTER, hariDihitung, kirimRingkasan, muatAwalRingkasan, muatCutiLeader, muatLeader, muatRingkasan, petaCutiLeader,
  rapikanButir, ringkasanTepatWaktu, validasiButir,
} from "@/lib/management/harian";
import { Kosong, Lencana, PesanGalat, kelasInput, kelasLabel, kelasTombolUtama, type Warna } from "./ui";
import { waktuWib } from "./waktuSt";

type Ringkasan = { id: string; user_id: string; divisi: string; tanggal: string; selesai: string[]; hambatan: string[]; butuh_divisi: string | null; dikirim_pertama_pada: string; diubah_pada: string };
const DIVISI_LEADER = ["sosmed", "service", "marketplace"] as const;
const BUTUH = ["sosmed", "service", "marketplace", "hr"];
const HARI_LINIMASA = 5;
const jam = (iso: string) => waktuWib(iso).split(" ").pop();

export default function TabHarian({ peran, divisi }: { peran: PeranManagement[]; divisi: string[] }) {
  const [data, setData] = useState<{ ringkasan: Ringkasan[] | null; cuti: Map<string, Set<string>>; peta: PetaLibur | null; leader: { divisi: string; nama: string }[]; uid: string; awal: string | null } | undefined>(undefined);
  const [sekarang, setSekarang] = useState(() => new Date());
  const hari = isoWib(sekarang);

  const muat = useCallback(async () => {
    const kini = new Date(), h = isoWib(kini), dari = tambahHariIso(h, -14);
    const [r, c, p, l, u, awal] = await Promise.all([muatRingkasan(supabase, dari, h), muatCutiLeader(supabase, dari, h),
      muatPetaLibur(supabase, dari, h).catch(() => null), muatLeader(supabase), supabase.auth.getUser().catch(() => ({ data: { user: null } })), muatAwalRingkasan(supabase)]);
    setSekarang(kini);
    setData({ ringkasan: r as Ringkasan[] | null, cuti: petaCutiLeader(c), peta: p, leader: l, uid: String(u?.data?.user?.id || ""), awal });
  }, []);
  useEffect(() => { const t = setTimeout(muat, 0); return () => clearTimeout(t); }, [muat]);

  // 5 hari kerja terakhir (termasuk hari ini bila hari kerja), terbaru di atas.
  const hariTampil = useMemo(() => {
    const out: string[] = [];
    for (let d = hari, i = 0; i < 21 && out.length < HARI_LINIMASA; i++, d = tambahHariIso(d, -1)) if (adalahHariKerja(d, data?.peta)) out.push(d);
    return out;
  }, [hari, data?.peta]);

  if (data === undefined) return <p className="py-10 text-center text-sm text-gray-500" aria-busy="true">Memuat ringkasan harian…</p>;
  if (data.ringkasan === null) return <Kosong>Ringkasan Harian belum tersedia.</Kosong>;

  const divSaya = adalahLeader(peran) ? divisi.find((d) => (DIVISI_LEADER as readonly string[]).includes(d)) : undefined;
  const milikSaya = data.ringkasan.find((r) => r.tanggal === hari && (r.user_id === data.uid));
  const namaLeader = (d: string) => data.leader.filter((x) => x.divisi === d).map((x) => x.nama).join(", ");

  return (
    <div className="space-y-4" data-tab-harian>
      <div className="rounded-xl border border-white/10 bg-kartu p-5">
        <h2 className="text-sm font-bold text-white">Ringkasan Harian</h2>
        <p className="mt-0.5 text-xs text-gray-500">Leader mengirim maks. {MAKS_BUTIR} butir &ldquo;Selesai&rdquo; dan &ldquo;Hambatan&rdquo; sebelum {String(BATAS_RINGKASAN.jam).padStart(2, "0")}.00 WIB. Boleh disunting sampai 23.59 — waktu kirim pertama yang dihitung.</p>
      </div>

      {divSaya && (
        <FormRingkasan key={milikSaya?.diubah_pada || "baru"} hari={hari} divisi={divSaya} milik={milikSaya}
          wajib={hariDihitung(hari, data.peta, data.cuti.get(divSaya) || new Set())} onTerkirim={muat} />
      )}

      <section className="space-y-3 rounded-xl border border-white/10 bg-kartu p-5" data-linimasa>
        <h3 className="text-sm font-bold text-white">Linimasa {HARI_LINIMASA} hari kerja terakhir</h3>
        {hariTampil.map((h) => (
          <div key={h} className="space-y-2" data-hari={h}>
            <p className="text-xs font-semibold text-gray-400">{teksTanggalISO(h)}{h === hari ? " · hari ini" : ""}</p>
            <div className="grid gap-2 md:grid-cols-3">
              {DIVISI_LEADER.map((d) => {
                const r = data.ringkasan!.find((x) => x.tanggal === h && x.divisi === d);
                const cuti = data.cuti.get(d)?.has(h);
                let lbl: { t: string; w: Warna };
                if (r) lbl = ringkasanTepatWaktu(r.dikirim_pertama_pada, h) ? { t: "Tepat waktu", w: "hijau" } : { t: "Terlambat", w: "merah" };
                else if (cuti) lbl = { t: "Cuti", w: "biru" };
                else if (!namaLeader(d)) lbl = { t: "Tanpa leader", w: "abu" };
                else if (h < hari && (!data.awal || h < data.awal)) lbl = { t: "Belum berlaku", w: "abu" };   // sebelum ringkasan pertama dikirim
                else if (h === hari && sekarang.getTime() < new Date(`${h}T${String(BATAS_RINGKASAN.jam).padStart(2, "0")}:00:00+07:00`).getTime()) lbl = { t: "Belum dikirim", w: "abu" };
                else lbl = { t: "Tidak mengirim", w: "merah" };
                return (
                  <article key={d} className="min-w-0 space-y-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-3" data-sel={`${h}:${d}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 text-xs font-semibold text-gray-200">{DIVISI_LABEL[d]}{namaLeader(d) ? <span className="font-normal text-gray-500"> · {namaLeader(d)}</span> : null}</span>
                      <Lencana warna={lbl.w} data-label-harian="">{lbl.t}</Lencana>
                    </div>
                    {r && (
                      <>
                        <p className="font-mono text-[11px] text-gray-500">Dikirim {jam(r.dikirim_pertama_pada)}{r.diubah_pada && Date.parse(r.diubah_pada) - Date.parse(r.dikirim_pertama_pada) > 60_000 ? ` · disunting ${jam(r.diubah_pada)}` : ""}</p>
                        <Butir judul="Selesai" isi={r.selesai} />
                        <Butir judul="Hambatan" isi={r.hambatan} />
                        {r.butuh_divisi && <p className="text-xs text-amber-200" data-butuh>Butuh bantuan dari {DIVISI_LABEL[r.butuh_divisi] || r.butuh_divisi}</p>}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function Butir({ judul, isi }: { judul: string; isi: string[] }) {
  if (!isi?.length) return null;
  return (
    <div className="text-xs">
      <p className="font-semibold text-gray-400">{judul}</p>
      <ul className="ml-4 list-disc space-y-0.5 text-gray-300">{isi.map((x, i) => <li key={i} className="break-words">{x}</li>)}</ul>
    </div>
  );
}

function FormRingkasan({ hari, divisi, milik, wajib, onTerkirim }: { hari: string; divisi: string; milik?: Ringkasan; wajib: boolean; onTerkirim: () => void }) {
  const toast = useToast();
  const isi = (a?: string[]) => [0, 1, 2].map((i) => a?.[i] || "");
  const [selesai, setSelesai] = useState(() => isi(milik?.selesai));
  const [hambatan, setHambatan] = useState(() => isi(milik?.hambatan));
  const [butuh, setButuh] = useState(milik?.butuh_divisi || "");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat("");
    const v = validasiButir(selesai) || validasiButir(hambatan);
    if (v) { setGalat(v); return; }
    if (!rapikanButir(selesai).length && !rapikanButir(hambatan).length) { setGalat("Isi minimal satu butir \"Selesai\" atau \"Hambatan\"."); return; }
    setSibuk(true);
    const r = await kirimRingkasan(supabase, { tanggal: hari, selesai, hambatan, butuhDivisi: butuh || null });
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal mengirim ringkasan."); return; }
    const tepat = r.data?.dikirim_pertama_pada ? ringkasanTepatWaktu(r.data.dikirim_pertama_pada, hari) : true;
    toast.sukses(milik ? "Ringkasan diperbarui." : tepat ? "Ringkasan terkirim — tepat waktu." : "Ringkasan terkirim — lewat 18.00.");
    onTerkirim();
  };

  const daftar = (judul: string, kunci: string, nilai: string[], ubah: (v: string[]) => void) => (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-gray-400">{judul} <span className="font-normal text-gray-500">(maks. {MAKS_BUTIR} butir)</span></legend>
      {nilai.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-4 shrink-0 text-right font-mono text-[11px] text-gray-500">{i + 1}.</span>
          <input id={`rh-${kunci}-${i}`} aria-label={`${judul} butir ${i + 1}`} className={`${kelasInput} min-w-0`} value={v} maxLength={MAKS_KARAKTER}
            onChange={(e) => ubah(nilai.map((x, j) => (j === i ? e.target.value : x)))} />
          <span className={`w-14 shrink-0 text-right font-mono text-[10.5px] tabular-nums ${v.length >= MAKS_KARAKTER ? "text-amber-300" : "text-gray-600"}`} data-hitung-karakter>{v.length}/{MAKS_KARAKTER}</span>
        </div>
      ))}
    </fieldset>
  );

  const tepat = milik ? ringkasanTepatWaktu(milik.dikirim_pertama_pada, hari) : null;
  return (
    <form onSubmit={kirim} noValidate className="space-y-4 rounded-xl border border-white/10 bg-kartu p-5" data-form-harian>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">Ringkasan saya — {DIVISI_LABEL[divisi]}</h3>
          <p className="mt-0.5 text-xs text-gray-500">{teksTanggalISO(hari)}</p>
        </div>
        {milik
          ? <span className="flex flex-wrap items-center gap-2 text-xs text-gray-400" data-status-kirim>Terkirim {jam(milik.dikirim_pertama_pada)} <Lencana warna={tepat ? "hijau" : "merah"}>{tepat ? "Tepat waktu" : "Terlambat"}</Lencana></span>
          : <Lencana warna="abu">Belum dikirim</Lencana>}
      </div>
      {!wajib && <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-gray-300" data-tidak-wajib>Hari ini tidak wajib mengirim ringkasan (cuti/izin/sakit atau hari libur). Tetap boleh mengirim bila perlu.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {daftar("Selesai", "selesai", selesai, setSelesai)}
        {daftar("Hambatan", "hambatan", hambatan, setHambatan)}
      </div>
      <label className={`${kelasLabel} sm:max-w-xs`} htmlFor="rh-butuh">Butuh bantuan dari
        <select id="rh-butuh" className={kelasInput} value={butuh} onChange={(e) => setButuh(e.target.value)}>
          <option value="">Tidak perlu</option>
          {BUTUH.filter((d) => d !== divisi).map((d) => <option key={d} value={d}>{DIVISI_LABEL[d]}</option>)}
        </select></label>
      <PesanGalat pesan={galat} />
      <div className="flex justify-end"><button type="submit" className={kelasTombolUtama} disabled={sibuk} data-kirim-harian>{sibuk ? "Mengirim…" : milik ? "Perbarui ringkasan" : "Kirim ringkasan"}</button></div>
    </form>
  );
}
