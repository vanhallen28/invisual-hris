// src/components/management/TabSerahTerima.tsx
// Papan Serah Terima lintas divisi: Berjalan · Terlambat · Selesai minggu ini, filter, ketepatan bulan berjalan, dan aksi kartu.
// Tombol hanya tampil bila peran mengizinkan; penegakan sebenarnya di RPC management-p2.sql.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { muatPetaLibur } from "@/lib/hariLiburData";
import type { PetaLibur } from "@/lib/hariLibur";
import { bisa, PERAN_LABEL, SEMUA_PERAN, type PeranManagement } from "@/lib/management/akses";
import { isoWib, tambahHariIso } from "@/lib/management/hariKerja";
import {
  DIVISI_SERAH_TERIMA, JENIS_SERAH_TERIMA, LABEL_JENIS, SELESAI_SAAT, batalkanSerahTerima, batasTindakLanjut, muatSerahTerima, pakaiMulai,
  selesaikanSerahTerima, tautanSah, tautanUrl, tenggatSerahTerima, tepatWaktu, tindaklanjuti, ubahMulai, warnaKartu, type JenisSerahTerima,
} from "@/lib/management/serahTerima";
import { Dialog, Kosong, Lencana, PesanGalat, kelasInput, kelasLabel, kelasTombol, kelasTombolUtama, type Warna } from "./ui";
import FormSerahTerima from "./FormSerahTerima";
import { LABEL_DIVISI_ST, inputWib, waktuWib } from "./waktuSt";

export type SerahTerima = {
  id: string; jenis: JenisSerahTerima; dari_divisi: string; ke_divisi: string; penanggung_jawab_peran: PeranManagement; judul: string; catatan: string | null;
  mulai: string | null; tanggal_rilis: string | null; bulan_rencana: string | null; tenggat: string; status: "berjalan" | "selesai" | "batal";
  selesai_pada: string | null; hasil: string | null; tautan_item: string | null; ditindaklanjuti_pada: string | null; catatan_tindak_lanjut: string | null;
  dibuat_oleh: string; dibuat_pada: string;
};
type Aksi = { jenis: "selesai" | "tindak" | "mulai" | "batal"; k: SerahTerima };
type Kolom = "berjalan" | "terlambat" | "selesai";

const LABEL_HASIL: Record<string, string> = { disetujui: "Disetujui", revisi: "Revisi", lolos: "Lolos", tidak_lolos: "Tidak lolos" };
const PILIHAN_HASIL: Partial<Record<JenisSerahTerima, string[]>> = { review_dea: ["disetujui", "revisi"], qc_studio_project: ["lolos", "tidak_lolos"] };
const GARIS: Record<Warna, string> = { merah: "border-l-red-400/70", kuning: "border-l-amber-400/70", hijau: "border-l-emerald-400/60", biru: "border-l-cyan-400/60", abu: "border-l-white/15", ungu: "border-l-violet-400/60" };

/** Label kartu — selalu berteks. */
function labelKartu(k: SerahTerima, sekarang: Date): { teks: string; warna: Warna } {
  if (k.status === "selesai") return tepatWaktu({ tenggat: k.tenggat, selesaiPada: k.selesai_pada }) ? { teks: "Tepat waktu", warna: "hijau" } : { teks: "Lewat tenggat", warna: "merah" };
  const w = warnaKartu({ status: k.status, dibuatPada: k.dibuat_pada, mulai: k.mulai, tenggat: k.tenggat }, sekarang);
  if (w === "merah") return k.ditindaklanjuti_pada ? { teks: "Ditindaklanjuti", warna: "biru" } : { teks: "Terlambat", warna: "merah" };
  if (w === "kuning") return { teks: "Hampir tenggat", warna: "kuning" };
  return { teks: "Berjalan", warna: "abu" };
}

/** Senin (WIB) minggu ini. */
const seninIni = (hari: string) => tambahHariIso(hari, -((new Date(`${hari}T00:00:00Z`).getUTCDay() + 6) % 7));
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export default function TabSerahTerima({ peran, divisi }: { peran: PeranManagement[]; divisi: string[] }) {
  const [daftar, setDaftar] = useState<SerahTerima[] | null | undefined>(undefined);
  const [peta, setPeta] = useState<PetaLibur | null>(null);
  const [email, setEmail] = useState("");
  const [form, setForm] = useState(false);
  const [aksi, setAksi] = useState<Aksi | null>(null);
  const [f, setF] = useState({ divisi: "", jenis: "" });
  const [sekarang, setSekarang] = useState(() => new Date());   // diperbarui setiap data dimuat

  // Yang ditampilkan: berjalan + selesai/batal sejak awal bulan lalu (cukup untuk "Selesai minggu ini" & ketepatan bulan ini).
  const sejak = () => { const h = isoWib(new Date()); return `${tambahHariIso(`${h.slice(0, 7)}-01`, -1).slice(0, 7)}-01`; };
  const muat = useCallback(async () => { const d = await muatSerahTerima(supabase, sejak()); setSekarang(new Date()); setDaftar(d as SerahTerima[] | null); }, []);
  useEffect(() => {
    let hidup = true;
    (async () => {
      const hari = isoWib(new Date());
      const [d, p, u] = await Promise.all([muatSerahTerima(supabase, sejak()), muatPetaLibur(supabase, tambahHariIso(hari, -40), tambahHariIso(hari, 100)).catch(() => null),
        supabase.auth.getUser().catch(() => ({ data: { user: null } }))]);
      if (!hidup) return;
      setSekarang(new Date()); setDaftar(d as SerahTerima[] | null); setPeta(p); setEmail(String(u?.data?.user?.email || "").toLowerCase());
    })();
    return () => { hidup = false; };
  }, []);

  const hari = isoWib(sekarang);
  const senin = seninIni(hari);

  const papan = useMemo(() => {
    const kol: Record<Kolom, SerahTerima[]> = { berjalan: [], terlambat: [], selesai: [] };
    const now = sekarang;
    for (const k of daftar || []) {
      if ((f.jenis && k.jenis !== f.jenis) || (f.divisi && k.dari_divisi !== f.divisi && k.ke_divisi !== f.divisi)) continue;
      if (k.status === "berjalan") (Date.parse(k.tenggat) < now.getTime() ? kol.terlambat : kol.berjalan).push(k);
      else if (k.status === "selesai" && k.selesai_pada && isoWib(new Date(k.selesai_pada)) >= senin) kol.selesai.push(k);
    }
    kol.berjalan.sort((a, b) => Date.parse(a.tenggat) - Date.parse(b.tenggat));
    kol.terlambat.sort((a, b) => Date.parse(a.tenggat) - Date.parse(b.tenggat));
    kol.selesai.sort((a, b) => Date.parse(b.selesai_pada || "") - Date.parse(a.selesai_pada || ""));
    return kol;
  }, [daftar, f, senin, sekarang]);

  // Ketepatan bulan berjalan per penanggung jawab: kartu selesai bulan ini (tepat / total) + yang masih terlambat.
  const ketepatan = useMemo(() => {
    const bln = hari.slice(0, 7), now = sekarang.getTime();
    const m = new Map<PeranManagement, { tepat: number; total: number; telat: number }>();
    const ambil = (p: PeranManagement) => m.get(p) || (m.set(p, { tepat: 0, total: 0, telat: 0 }), m.get(p)!);
    for (const k of daftar || []) {
      if (k.status === "selesai" && k.selesai_pada && isoWib(new Date(k.selesai_pada)).slice(0, 7) === bln) {
        const x = ambil(k.penanggung_jawab_peran); x.total++; if (tepatWaktu({ tenggat: k.tenggat, selesaiPada: k.selesai_pada })) x.tepat++;
      } else if (k.status === "berjalan" && Date.parse(k.tenggat) < now) ambil(k.penanggung_jawab_peran).telat++;
    }
    return SEMUA_PERAN.filter((p) => m.has(p)).map((p) => ({ peran: p, ...m.get(p)! }));
  }, [daftar, hari, sekarang]);

  if (daftar === undefined) return <p className="py-10 text-center text-sm text-gray-500" aria-busy="true">Memuat serah terima…</p>;
  if (daftar === null) return <Kosong>Serah Terima belum tersedia.</Kosong>;
  if (form) return <FormSerahTerima peran={peran} divisi={divisi} peta={peta} onBatal={() => setForm(false)} onSelesai={async () => { await muat(); setForm(false); }} />;

  const pmSm = peran.some((p) => p === "pm" || p === "studio_manager");
  const boleh = {
    selesai: (k: SerahTerima) => k.status === "berjalan" && (k.jenis === "review_dea"
      ? peran.some((p) => p === "owner" || p === "pm" || p === "studio_manager")
      : pmSm || k.dibuat_oleh.toLowerCase() === email || divisi.includes(k.ke_divisi) || peran.includes(k.penanggung_jawab_peran)
        || (k.ke_divisi === "owner" && peran.includes("owner")) || (k.ke_divisi === "pm" && peran.includes("pm"))),
    tindak: (k: SerahTerima) => k.status === "berjalan" && bisa(peran, "tindaklanjuti") && !k.ditindaklanjuti_pada && Date.parse(k.tenggat) < sekarang.getTime(),
    mulai: (k: SerahTerima) => k.status === "berjalan" && peran.includes("pm") && pakaiMulai(k.jenis),
    batal: (k: SerahTerima) => k.status === "berjalan" && (pmSm || (!!email && k.dibuat_oleh.toLowerCase() === email)),
  };

  const kolom: { k: Kolom; judul: string }[] = [{ k: "berjalan", judul: "Berjalan" }, { k: "terlambat", judul: "Terlambat" }, { k: "selesai", judul: "Selesai minggu ini" }];
  const adaFilter = !!(f.divisi || f.jenis);
  return (
    <div className="space-y-4" data-tab-serah-terima>
      <div className="space-y-4 rounded-xl border border-white/10 bg-kartu p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white">Serah Terima</h2>
            <p className="mt-0.5 text-xs text-gray-500">Kartu lintas divisi bertenggat hari kerja (Senin–Jumat 09.00–18.00 WIB, tanpa hari libur). Lewat tenggat otomatis merah.</p>
          </div>
          {bisa(peran, "serah_terima") && <button type="button" className={kelasTombolUtama} onClick={() => setForm(true)} data-buat-st>+ Serah terima baru</button>}
        </div>
        <div className="grid grid-cols-2 gap-2 md:max-w-md">
          <label className={kelasLabel}>Divisi<select className={kelasInput} value={f.divisi} onChange={(e) => setF({ ...f, divisi: e.target.value })} data-filter-divisi>
            <option value="">Semua divisi</option>{DIVISI_SERAH_TERIMA.map((d) => <option key={d} value={d}>{LABEL_DIVISI_ST[d]}</option>)}</select></label>
          <label className={kelasLabel}>Jenis<select className={kelasInput} value={f.jenis} onChange={(e) => setF({ ...f, jenis: e.target.value })} data-filter-jenis>
            <option value="">Semua jenis</option>{JENIS_SERAH_TERIMA.map((j) => <option key={j} value={j}>{LABEL_JENIS[j]}</option>)}</select></label>
        </div>
      </div>

      {daftar.length === 0 ? (
        <Kosong>Belum ada serah terima.</Kosong>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {kolom.map(({ k: kunci, judul }) => (
            <section key={kunci} className="min-w-0 space-y-3 rounded-xl border border-white/10 bg-kartu p-4" data-kolom={kunci} aria-label={judul}>
              <h3 className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-gray-400">
                {judul}<span className="font-mono text-gray-500">{papan[kunci].length}</span>
              </h3>
              {papan[kunci].length === 0
                ? <p className="text-xs text-gray-600">{adaFilter ? "Tidak ada yang cocok dengan filter." : "Tidak ada."}</p>
                : papan[kunci].map((k) => <Kartu key={k.id} k={k} sekarang={sekarang} peta={peta} boleh={boleh} onAksi={(jenis) => setAksi({ jenis, k })} />)}
            </section>
          ))}
        </div>
      )}

      <section className="rounded-xl border border-white/10 bg-kartu p-5" data-ketepatan>
        <h3 className="text-sm font-bold text-white">Ketepatan bulan ini <span className="font-normal text-gray-500">({BLN[Number(hari.slice(5, 7)) - 1]} {hari.slice(0, 4)})</span></h3>
        <p className="mt-0.5 text-xs text-gray-500">Kartu yang selesai bulan ini per penanggung jawab: tepat waktu / total.</p>
        {ketepatan.length === 0 ? <p className="mt-3 text-xs text-gray-600">Belum ada serah terima selesai bulan ini.</p> : (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ketepatan.map((x) => (
              <li key={x.peran} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm" data-ketepatan-peran={x.peran}>
                <span className="min-w-0 text-gray-200">{PERAN_LABEL[x.peran]}</span>
                <span className="text-right font-mono text-xs tabular-nums text-gray-300">
                  {x.total ? <>{x.tepat}/{x.total} <span className="text-gray-500">({Math.round((x.tepat / x.total) * 100)}%)</span></> : "0/0"}
                  {x.telat ? <span className="block text-red-300">{x.telat} masih terlambat</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {aksi && <DialogAksi aksi={aksi} peta={peta} onTutup={() => setAksi(null)} onBerhasil={async () => { setAksi(null); await muat(); }} />}
    </div>
  );
}

function Kartu({ k, sekarang, peta, boleh, onAksi }: {
  k: SerahTerima; sekarang: Date; peta: PetaLibur | null;
  boleh: Record<Aksi["jenis"], (k: SerahTerima) => boolean>; onAksi: (j: Aksi["jenis"]) => void;
}) {
  const l = labelKartu(k, sekarang);
  const url = tautanUrl(k.tautan_item);
  const merahBelum = k.status === "berjalan" && Date.parse(k.tenggat) < sekarang.getTime() && !k.ditindaklanjuti_pada;
  const tombol: { j: Aksi["jenis"]; teks: string }[] = [
    { j: "selesai", teks: k.jenis === "review_dea" ? "Catat keputusan" : "Selesaikan" },
    { j: "tindak", teks: "Sudah ditindaklanjuti" }, { j: "mulai", teks: "Ubah waktu mulai" }, { j: "batal", teks: "Batalkan" },
  ];
  const tampil = tombol.filter((t) => boleh[t.j](k));
  return (
    <article className={`space-y-2 rounded-lg border border-white/10 border-l-2 ${GARIS[l.warna]} bg-white/[0.02] p-3`} data-kartu-st={k.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Lencana warna="abu">{LABEL_JENIS[k.jenis]}</Lencana>
        <Lencana warna={l.warna} data-label-st="">{l.teks}</Lencana>
      </div>
      <p className="break-words text-sm font-semibold text-white">{k.judul}</p>
      <p className="text-xs text-gray-400">{LABEL_DIVISI_ST[k.dari_divisi] || k.dari_divisi} → {LABEL_DIVISI_ST[k.ke_divisi] || k.ke_divisi} · PJ {PERAN_LABEL[k.penanggung_jawab_peran] || k.penanggung_jawab_peran}</p>
      <p className="font-mono text-[11px] text-gray-400">
        {k.status === "selesai" && k.selesai_pada ? <>Selesai {waktuWib(k.selesai_pada)} · tenggat {waktuWib(k.tenggat)}</> : <>Tenggat {waktuWib(k.tenggat)}</>}
      </p>
      {k.hasil && <p className="text-xs text-gray-300">Hasil: <b>{LABEL_HASIL[k.hasil] || k.hasil}</b></p>}
      {merahBelum && <p className="text-[11px] text-red-300" data-batas-tindak>Batas tindak lanjut PM: {waktuWib(batasTindakLanjut(new Date(k.tenggat), peta).toISOString())}</p>}
      {k.ditindaklanjuti_pada && <p className="break-words text-[11px] text-cyan-200">Ditindaklanjuti {waktuWib(k.ditindaklanjuti_pada)}{k.catatan_tindak_lanjut ? ` — ${k.catatan_tindak_lanjut}` : ""}</p>}
      {k.catatan && <p className="break-words text-xs text-gray-500">{k.catatan}</p>}
      {k.tautan_item && (url
        ? <a href={url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-tint underline">Item Daily Task</a>
        : <p className="truncate font-mono text-[11px] text-gray-400">Item Daily Task: {k.tautan_item}</p>)}
      {tampil.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tampil.map((t) => <button key={t.j} type="button" className={`${t.j === "tindak" ? kelasTombolUtama : kelasTombol} px-2.5 py-1.5 text-[11px]`} onClick={() => onAksi(t.j)} data-aksi-st={t.j}>{t.teks}</button>)}
        </div>
      )}
    </article>
  );
}

function DialogAksi({ aksi, peta, onTutup, onBerhasil }: { aksi: Aksi; peta: PetaLibur | null; onTutup: () => void; onBerhasil: () => void }) {
  const toast = useToast();
  const { k, jenis } = aksi;
  const [catatan, setCatatan] = useState("");
  const [hasil, setHasil] = useState("");
  const [tautan, setTautan] = useState(k.tautan_item || "");
  const [kini] = useState(() => new Date());
  const [mulai, setMulai] = useState(() => (k.mulai ? inputWib(new Date(k.mulai)) : inputWib(kini)));
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const pilihan = PILIHAN_HASIL[k.jenis];

  let tenggatBaru: Date | null = null;
  if (jenis === "mulai" && mulai) { try { tenggatBaru = tenggatSerahTerima(k.jenis, { mulai: new Date(`${mulai}:00+07:00`) }, peta); } catch { tenggatBaru = null; } }

  const judul = { selesai: k.jenis === "review_dea" ? "Catat keputusan Review Dea" : "Selesaikan serah terima", tindak: "Sudah ditindaklanjuti", mulai: "Ubah waktu mulai", batal: "Batalkan serah terima" }[jenis];
  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setGalat("");
    let r;
    if (jenis === "selesai") {
      const t = tautan.trim();
      if (pilihan && !hasil) { setGalat(k.jenis === "review_dea" ? "Isi hasil review: disetujui atau revisi." : "Isi hasil QC: lolos atau tidak lolos."); return; }
      if (t && !tautanSah(t)) { setGalat("Tautan harus diawali http:// atau https://, atau berupa id item Daily Task."); return; }
      setSibuk(true); r = await selesaikanSerahTerima(supabase, k.id, hasil || null, t || null);
    } else {
      if (jenis === "mulai" && !mulai) { setGalat("Isi waktu mulai baru."); return; }
      if (!catatan.trim()) { setGalat(jenis === "tindak" ? "Catatan tindak lanjut wajib diisi." : jenis === "mulai" ? "Alasan perubahan wajib diisi." : "Alasan pembatalan wajib diisi."); return; }
      setSibuk(true);
      r = jenis === "tindak" ? await tindaklanjuti(supabase, k.id, catatan.trim())
        : jenis === "mulai" ? await ubahMulai(supabase, k.id, new Date(`${mulai}:00+07:00`).toISOString(), catatan.trim())
        : await batalkanSerahTerima(supabase, k.id, catatan.trim());
    }
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal menyimpan."); return; }
    toast.sukses(jenis === "selesai" ? ((r.data as { tepat_waktu?: boolean } | undefined)?.tepat_waktu === false ? "Selesai — lewat tenggat." : "Selesai — tepat waktu.")
      : jenis === "tindak" ? "Tindak lanjut tercatat." : jenis === "mulai" ? "Waktu mulai diubah; tenggat dihitung ulang." : "Serah terima dibatalkan.");
    onBerhasil();
  };

  return (
    <Dialog judul={judul} sub={k.judul} onTutup={onTutup} sibuk={sibuk} data-dialog-st={jenis}>
      <form onSubmit={kirim} noValidate className="space-y-4">
        {jenis === "selesai" && <p className="text-xs text-gray-400">Selesai saat: {SELESAI_SAAT[k.jenis]}.</p>}
        {jenis === "selesai" && pilihan && (
          <label className={kelasLabel} htmlFor="st-hasil">Hasil
            <select id="st-hasil" className={kelasInput} value={hasil} onChange={(e) => setHasil(e.target.value)}>
              <option value="">Pilih hasil…</option>{pilihan.map((h) => <option key={h} value={h}>{LABEL_HASIL[h]}</option>)}
            </select></label>
        )}
        {jenis === "selesai" && k.jenis !== "review_dea" && (
          <label className={kelasLabel} htmlFor="st-tautan">Tautan item Daily Task {k.jenis === "kartu_proyek" ? <span className="font-normal text-gray-500">(wajib — kartu CLIENT WORK)</span> : <span className="font-normal text-gray-500">(opsional)</span>}
            <input id="st-tautan" className={kelasInput} value={tautan} onChange={(e) => setTautan(e.target.value)} placeholder="https://… atau id item" /></label>
        )}
        {jenis === "tindak" && <p className="text-xs text-gray-400">Tenggat {waktuWib(k.tenggat)} · batas tindak lanjut {waktuWib(batasTindakLanjut(new Date(k.tenggat), peta).toISOString())}. Catatan masuk KPI PM.</p>}
        {jenis === "mulai" && (
          <label className={kelasLabel} htmlFor="st-mulai-baru">Waktu mulai baru
            <input id="st-mulai-baru" type="datetime-local" className={kelasInput} value={mulai} max={inputWib(kini)} min={inputWib(new Date(kini.getTime() - 7 * 86_400_000))} onChange={(e) => setMulai(e.target.value)} />
            <span className="font-normal text-gray-500">{tenggatBaru ? <>Tenggat baru: <b>{waktuWib(tenggatBaru.toISOString())}</b>. </> : null}Perubahan tercatat di audit.</span>
          </label>
        )}
        {jenis !== "selesai" && (
          <label className={kelasLabel} htmlFor="st-catatan-aksi">{jenis === "tindak" ? "Catatan tindak lanjut" : "Alasan"}
            <textarea id="st-catatan-aksi" className={`${kelasInput} min-h-[72px]`} value={catatan} onChange={(e) => setCatatan(e.target.value)} /></label>
        )}
        <PesanGalat pesan={galat} />
        <div className="flex justify-end gap-2">
          <button type="button" className={kelasTombol} onClick={onTutup} disabled={sibuk}>Batal</button>
          <button type="submit" className={kelasTombolUtama} disabled={sibuk} data-kirim-aksi-st>{sibuk ? "Menyimpan…" : jenis === "batal" ? "Batalkan kartu" : "Simpan"}</button>
        </div>
      </form>
    </Dialog>
  );
}
