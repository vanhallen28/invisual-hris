// src/components/management/EditorPedoman.tsx
// Editor Pedoman (PM/Studio Manager): satu draf, pratinjau, simpan draf, terbitkan versi baru.
// Aturan terbit (wajib usulan tertaut, pengesahan awal, ringkasan) ditegakkan RPC; galatnya ditampilkan apa adanya.
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import type { PeranManagement } from "@/lib/management/akses";
import { simpanDraf, terbitkanPedoman, type VersiPedoman } from "@/lib/management/pedoman";
import { renderPedoman } from "@/lib/management/pedomanRender";
import { LABEL_STATUS, STATUS_BOLEH_TAUT, muatUsulan, type StatusUsulan } from "@/lib/management/usulan";
import { isoWib } from "@/lib/management/hariKerja";
import { Dialog, Lencana, PesanGalat, kelasInput, kelasLabel, kelasTombol, kelasTombolUtama } from "./ui";

/** "v1.1" → "v1.2"; tanpa versi → "v1.0". */
export const versiBerikut = (v?: string | null) => {
  const m = /^v(\d+)\.(\d+)$/.exec(String(v || "").trim());
  return m ? `v${m[1]}.${Number(m[2]) + 1}` : "v1.0";
};

export default function EditorPedoman({ versi, peran, onTerbit, onSimpan }: { versi: VersiPedoman[]; peran: PeranManagement[]; onTerbit: () => void; onSimpan: () => void }) {
  const toast = useToast();
  const draf = versi.find((v) => v.status === "draf");
  const berlaku = versi.find((v) => v.status === "berlaku");
  const adaVersiTerbit = versi.some((v) => v.status !== "draf");
  const [nomor, setNomor] = useState(draf?.versi || versiBerikut(berlaku?.versi));
  const [isi, setIsi] = useState(draf?.isi_md ?? berlaku?.isi_md ?? "");
  const [ringkasan, setRingkasan] = useState(draf?.ringkasan_perubahan ?? "");
  const [lihat, setLihat] = useState<"tulis" | "pratinjau">("tulis");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const [dialog, setDialog] = useState(false);
  const pratinjau = useMemo(() => (lihat === "pratinjau" ? renderPedoman(isi) : ""), [isi, lihat]);

  const simpan = async () => {
    setSibuk(true); setGalat("");
    const r = await simpanDraf(supabase, nomor, isi, ringkasan);
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal menyimpan draf."); return; }
    toast.sukses(`Draf ${nomor} tersimpan.`);
    onSimpan();
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-kartu p-5" data-editor-pedoman>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-white">{draf ? `Draf ${draf.versi}` : "Draf baru"}</h3>
        {berlaku ? <span className="text-xs text-gray-500">versi berlaku: {berlaku.versi}</span> : <span className="text-xs text-gray-500">belum ada versi berlaku</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
        <label className={kelasLabel} htmlFor="ed-versi">Nomor versi<input id="ed-versi" className={kelasInput} value={nomor} onChange={(e) => setNomor(e.target.value)} /></label>
        <label className={kelasLabel} htmlFor="ed-ringkasan">Ringkasan perubahan<input id="ed-ringkasan" className={kelasInput} value={ringkasan} onChange={(e) => setRingkasan(e.target.value)} placeholder="Wajib diisi sebelum terbit" /></label>
      </div>
      <div className="flex gap-1.5" role="group" aria-label="Mode editor">
        {(["tulis", "pratinjau"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={lihat === m} onClick={() => setLihat(m)} className={`rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer ${lihat === m ? "border-white bg-white text-black" : "border-white/10 text-gray-400"}`}>{m === "tulis" ? "Tulis" : "Pratinjau"}</button>
        ))}
      </div>
      {lihat === "tulis"
        ? <label className={kelasLabel} htmlFor="ed-isi">Isi Pedoman (Markdown)<textarea id="ed-isi" className={`${kelasInput} min-h-[360px] font-mono text-[13px] leading-relaxed`} value={isi} onChange={(e) => setIsi(e.target.value)} /></label>
        : <div className="max-h-[480px] overflow-y-auto rounded-lg border border-white/10 bg-input p-4 text-sm text-gray-300 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-white [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-white [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: pratinjau }} />}
      <PesanGalat pesan={galat} />
      <div className="flex flex-wrap gap-2">
        <button type="button" className={kelasTombol} onClick={simpan} disabled={sibuk} data-simpan-draf>{sibuk ? "Menyimpan…" : "Simpan draf"}</button>
        <button type="button" className={kelasTombolUtama} onClick={() => setDialog(true)} disabled={sibuk} data-buka-terbitkan>Terbitkan…</button>
      </div>
      {dialog && (
        <DialogTerbitkan nomor={nomor} isi={isi} ringkasan={ringkasan} setRingkasan={setRingkasan}
          bolehPengesahanAwal={peran.includes("studio_manager") && !adaVersiTerbit}
          onTutup={() => setDialog(false)} onSelesai={() => { setDialog(false); toast.sukses(`Pedoman ${nomor} terbit.`); onTerbit(); }} />
      )}
    </div>
  );
}

function DialogTerbitkan({ nomor, isi, ringkasan, setRingkasan, bolehPengesahanAwal, onTutup, onSelesai }: {
  nomor: string; isi: string; ringkasan: string; setRingkasan: (s: string) => void; bolehPengesahanAwal: boolean; onTutup: () => void; onSelesai: () => void;
}) {
  const [mulai, setMulai] = useState(isoWib(new Date()));
  const [usulan, setUsulan] = useState<{ id: string; nomor: string; judul: string; status: StatusUsulan }[] | null>(null);
  const [pilih, setPilih] = useState<string[]>([]);
  const [awal, setAwal] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  useEffect(() => {
    let hidup = true;
    muatUsulan(supabase).then((u) => { if (hidup) setUsulan((u || []).filter((x) => STATUS_BOLEH_TAUT.includes(x.status))); });
    return () => { hidup = false; };
  }, []);

  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    setSibuk(true); setGalat("");
    const d = await simpanDraf(supabase, nomor, isi, ringkasan);          // simpan suntingan terakhir dulu
    const r = d.ok ? await terbitkanPedoman(supabase, mulai, awal ? [] : pilih, awal) : d;
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal menerbitkan."); return; }
    onSelesai();
  };

  return (
    <Dialog judul={`Terbitkan Pedoman ${nomor}`} sub="Versi berlaku saat ini menjadi arsip; semua orang diminta membaca ulang." onTutup={onTutup} sibuk={sibuk} data-dialog-terbitkan="">
      <form onSubmit={kirim} noValidate className="space-y-4">
        <label className={kelasLabel} htmlFor="tb-mulai">Berlaku mulai<input id="tb-mulai" type="date" className={kelasInput} value={mulai} onChange={(e) => setMulai(e.target.value)} /></label>
        <label className={kelasLabel} htmlFor="tb-ringkasan">Ringkasan perubahan<input id="tb-ringkasan" className={kelasInput} value={ringkasan} onChange={(e) => setRingkasan(e.target.value)} /></label>
        {bolehPengesahanAwal && (
          <label className="flex items-start gap-2 text-sm text-gray-200"><input type="checkbox" checked={awal} onChange={(e) => setAwal(e.target.checked)} className="mt-1" data-pengesahan-awal />
            <span>Pengesahan awal (versi pertama, disahkan di rapat pengesahan) — tanpa usulan tertaut</span></label>
        )}
        {!awal && (
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-xs font-semibold text-gray-400">Usulan yang mengesahkan perubahan ini</legend>
            {usulan === null ? <p className="text-xs text-gray-500">Memuat usulan…</p>
              : usulan.length === 0 ? <p className="text-xs text-gray-500">Belum ada usulan yang Disetujui, Uji coba, atau Darurat.</p>
              : usulan.map((u) => (
                <label key={u.id} className="flex items-start gap-2 rounded-lg border border-white/5 bg-input p-2.5 text-sm text-gray-200">
                  <input type="checkbox" className="mt-1" checked={pilih.includes(u.id)} onChange={(e) => setPilih(e.target.checked ? [...pilih, u.id] : pilih.filter((x) => x !== u.id))} data-taut-usulan={u.nomor} />
                  <span className="min-w-0"><span className="font-mono text-xs text-gray-500">{u.nomor}</span> {u.judul} <Lencana>{LABEL_STATUS[u.status]}</Lencana></span>
                </label>
              ))}
          </fieldset>
        )}
        <PesanGalat pesan={galat} />
        <div className="flex justify-end gap-2">
          <button type="button" className={kelasTombol} onClick={onTutup} disabled={sibuk}>Batal</button>
          <button type="submit" className={kelasTombolUtama} disabled={sibuk} data-kirim-terbitkan>{sibuk ? "Menerbitkan…" : "Terbitkan"}</button>
        </div>
      </form>
    </Dialog>
  );
}
