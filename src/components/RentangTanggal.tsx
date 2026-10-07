// src/components/RentangTanggal.tsx
// Pemilih rentang tanggal (kalender) + preset cepat. Dipakai halaman Kehadiran.
// Klik tanggal pertama = "dari", klik kedua = "sampai". Preset langsung diterapkan.
"use client";

import { useEffect, useState } from "react";
import {
  type Rentang, type KunciPreset, PRESET, BULAN_ID, MAKS_HARI_RENTANG,
  rentangPreset, presetCocok, labelRentang, rapikanRentang, gridBulan,
  tanggalDari, jumlahHari, isoValid, periodeGaji, selisihHari, tambahHari,
} from "@/lib/rentangTanggal";

// Isian tanggal diketik: terima hanya tahun wajar (cegah "0002-…" saat tahun baru diketik sebagian).
const tanggalWajar = (v: string) => isoValid(v) && v >= "2000-01-01" && v <= "2100-12-31";

const HARI_KOP = ["Sn", "Sl", "Rb", "Km", "Jm", "Sb", "Mg"];

type Props = {
  nilai: Rentang;
  onChange: (r: Rentang) => void;
  hariIni: string;
  disabled?: boolean;
};

export default function RentangTanggal({ nilai, onChange, hariIni, disabled }: Props) {
  const [buka, setBuka] = useState(false);
  const [dari, setDari] = useState(nilai.dari);
  const [sampai, setSampai] = useState<string | null>(nilai.sampai);
  // Teks isian Dari/Sampai disimpan terpisah supaya mengetik tahun digit demi digit tidak terpental.
  const [teksDari, setTeksDari] = useState(nilai.dari);
  const [teksSampai, setTeksSampai] = useState(nilai.sampai);
  const [hover, setHover] = useState<string | null>(null);
  const [tampil, setTampil] = useState(() => { const d = tanggalDari(nilai.dari); return { y: d.getFullYear(), m: d.getMonth() }; });

  const aktif = presetCocok(nilai, hariIni);
  // 12 periode gaji terakhir (pengganti daftar periode di dropdown lama)
  const daftarPeriode = Array.from({ length: 12 }, (_, i) => periodeGaji(hariIni, -i));

  const aturDraf = (d: string, s: string | null) => {
    setDari(d); setSampai(s);
    setTeksDari(d); setTeksSampai(s ?? "");
  };

  const bukaPanel = () => {
    if (disabled) return;
    aturDraf(nilai.dari, nilai.sampai);
    setHover(null);
    const d = tanggalDari(nilai.dari);
    setTampil({ y: d.getFullYear(), m: d.getMonth() });
    setBuka(true);
  };

  useEffect(() => {
    if (!buka) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === "Escape") setBuka(false); };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [buka]);

  const pilihPreset = (k: KunciPreset) => {
    onChange(rentangPreset(k, hariIni));
    setBuka(false);
  };

  const klikTanggal = (iso: string) => {
    if (sampai !== null) { aturDraf(iso, null); return; }   // mulai pilihan baru
    const r = rapikanRentang(dari, iso);
    if (!r) return;
    aturDraf(r.dari, r.sampai);
  };

  // Diterapkan saat isian ditinggalkan (blur/Enter), BUKAN tiap ketukan: saat mengetik
  // per digit, browser sempat memberi tanggal antara (mis. tgl "02" sebelum "25").
  const komitInput = (jenis: "dari" | "sampai") => {
    const v = jenis === "dari" ? teksDari : teksSampai;
    if (!tanggalWajar(v)) return;                       // belum lengkap → abaikan
    // Tanggal yang baru diketik dipertahankan; ujung lainnya yang menyesuaikan.
    let a = jenis === "dari" ? v : dari;
    let b = jenis === "sampai" ? v : (sampai ?? v);
    if (a > b) { if (jenis === "dari") b = a; else a = b; }
    if (jenis === "sampai" && selisihHari(a, b) + 1 > MAKS_HARI_RENTANG) a = tambahHari(b, -(MAKS_HARI_RENTANG - 1));
    const r = rapikanRentang(a, b);
    if (!r) return;
    aturDraf(r.dari, r.sampai);
    const d = tanggalDari(jenis === "dari" ? r.dari : r.sampai);
    setTampil({ y: d.getFullYear(), m: d.getMonth() });
  };

  const terapkan = () => {
    // Isian yang diketik tapi belum ditinggalkan tetap ikut diterapkan
    const a = tanggalWajar(teksDari) ? teksDari : dari;
    const b = tanggalWajar(teksSampai) ? teksSampai : sampai;
    if (b === null) return;
    const r = rapikanRentang(a, b);
    if (r) onChange(r);
    setBuka(false);
  };

  const geser = (n: number) => setTampil((t) => { const d = new Date(t.y, t.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  // Rentang yang disorot: pilihan lengkap, atau pratinjau mengikuti kursor
  const ujung = sampai ?? hover;
  const [sA, sB] = ujung ? (ujung < dari ? [ujung, dari] : [dari, ujung]) : [dari, dari];
  const draf = sampai !== null ? { dari, sampai } : null;

  const renderBulan = (y: number, m: number, kelas = "") => (
    <div key={`${y}-${m}`} className={`w-full sm:w-[252px] ${kelas}`}>
      <p className="text-center text-xs font-bold text-white mb-2">{BULAN_ID[m]} {y}</p>
      <div className="grid grid-cols-7 gap-y-1">
        {HARI_KOP.map((h, i) => (
          <span key={h} className={`text-center text-[11px] font-bold ${i >= 5 ? "text-gray-600" : "text-gray-500"}`}>{h}</span>
        ))}
        {gridBulan(y, m).map(({ iso, diBulan }) => {
          if (!diBulan) return <span key={iso} className="h-8" />;
          const ujungKiri = iso === sA, ujungKanan = iso === sB;
          const dalam = iso >= sA && iso <= sB;
          const hariIniIni = iso === hariIni;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => klikTanggal(iso)}
              onMouseEnter={() => { if (sampai === null) setHover(iso); }}
              className={`relative h-8 text-xs transition-colors ${dalam ? "bg-primer/25" : ""} ${ujungKiri ? "rounded-l-lg" : ""} ${ujungKanan ? "rounded-r-lg" : ""}`}
            >
              <span className={`mx-auto flex h-8 w-8 items-center justify-center rounded-lg ${
                ujungKiri || ujungKanan ? "bg-primer text-white font-bold" : dalam ? "text-white" : "text-gray-300 hover:bg-white/10"
              } ${hariIniIni && !(ujungKiri || ujungKanan) ? "ring-1 ring-tint/60 font-bold" : ""}`}>
                {tanggalDari(iso).getDate()}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const kedua = new Date(tampil.y, tampil.m + 1, 1);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={bukaPanel}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={buka}
        className="flex items-center gap-2.5 bg-input border border-white/10 hover:border-white/20 rounded-xl px-4 py-3 text-sm text-white font-bold shadow-lg cursor-pointer disabled:cursor-wait disabled:opacity-70 focus:outline-none focus:border-primer-terang"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-tint shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
        <span className="whitespace-nowrap">{labelRentang(nilai)}</span>
        <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">{jumlahHari(nilai)} hari</span>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={`w-3.5 h-3.5 text-gray-500 transition-transform ${buka ? "rotate-180" : ""}`}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      </button>

      {buka && (
        <>
          <div className="fixed inset-0 z-[110] bg-black/60 md:bg-transparent" onClick={() => setBuka(false)} />
          <div
            role="dialog"
            aria-label="Pilih rentang tanggal"
            className="fixed inset-x-0 bottom-0 z-[120] max-h-[88vh] overflow-y-auto rounded-t-2xl md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:max-h-none md:overflow-visible md:rounded-xl bg-kartu border border-white/10 shadow-2xl"
          >
            <div className="flex flex-col md:flex-row">
              {/* PRESET */}
              <div className="md:w-48 shrink-0 border-b md:border-b-0 md:border-r border-white/10 p-3">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Cepat</p>
                <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
                  {PRESET.map((p) => (
                    <button
                      key={p.kunci}
                      type="button"
                      onClick={() => pilihPreset(p.kunci)}
                      className={`shrink-0 text-left text-xs px-3 py-2 rounded-lg whitespace-nowrap transition-colors ${aktif === p.kunci ? "bg-primer text-white font-bold" : "text-gray-300 bg-white/[0.03] md:bg-transparent hover:bg-white/10"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <label className="block mt-3 px-1">
                  <span className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Periode gaji (21–20)</span>
                  <select
                    value=""
                    onChange={(e) => { const p = daftarPeriode[Number(e.target.value)]; if (p) { onChange(p); setBuka(false); } }}
                    className="w-full bg-latar border border-white/10 rounded-lg px-2 py-2 text-xs text-white outline-none focus:border-primer-terang cursor-pointer"
                  >
                    <option value="" disabled>Pilih periode…</option>
                    {daftarPeriode.map((p, i) => <option key={p.dari} value={i}>{labelRentang(p)}</option>)}
                  </select>
                </label>
              </div>

              {/* KALENDER */}
              <div className="p-4 flex-1">
                <div className="flex items-center justify-between mb-1">
                  <button type="button" onClick={() => geser(-1)} title="Bulan sebelumnya" className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                  </button>
                  <p className="text-[11px] text-gray-500">{sampai === null ? "Pilih tanggal akhir" : "Klik tanggal untuk memilih ulang"}</p>
                  <button type="button" onClick={() => geser(1)} title="Bulan berikutnya" className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                  </button>
                </div>
                <div className="flex gap-6" onMouseLeave={() => setHover(null)}>
                  {renderBulan(tampil.y, tampil.m)}
                  {renderBulan(kedua.getFullYear(), kedua.getMonth(), "hidden md:block")}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Dari</span>
                    <input type="date" value={teksDari} onChange={(e) => setTeksDari(e.target.value)} onBlur={() => komitInput("dari")} onKeyDown={(e) => { if (e.key === "Enter") komitInput("dari"); }} className="w-full bg-latar border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-primer-terang [color-scheme:dark]" />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-bold text-gray-500 uppercase mb-1">Sampai</span>
                    <input type="date" value={teksSampai} onChange={(e) => setTeksSampai(e.target.value)} onBlur={() => komitInput("sampai")} onKeyDown={(e) => { if (e.key === "Enter") komitInput("sampai"); }} className="w-full bg-latar border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white outline-none focus:border-primer-terang [color-scheme:dark]" />
                  </label>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                  <p className="text-[11px] text-gray-400 min-w-0">
                    {draf ? <><span className="text-white font-bold">{labelRentang(draf)}</span> · {jumlahHari(draf)} hari</> : <>Mulai {labelRentang({ dari, sampai: dari })} — pilih tanggal akhir</>}
                    <span className="block text-[11px] text-gray-600">Maksimal {MAKS_HARI_RENTANG} hari.</span>
                  </p>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => setBuka(false)} className="text-xs font-bold text-gray-300 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">Batal</button>
                    <button type="button" onClick={terapkan} disabled={sampai === null && !tanggalWajar(teksSampai)} className="text-xs font-bold text-white px-4 py-2 rounded-lg bg-primer hover:bg-primer-terang disabled:opacity-40">Terapkan</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
