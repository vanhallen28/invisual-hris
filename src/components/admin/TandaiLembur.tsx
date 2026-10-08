// src/components/admin/TandaiLembur.tsx
// Tombol + jendela "Tandai lembur" untuk HR/manajer (Dasbor › Log absensi live,
// Kehadiran › detail sel). Menyimpan ke tabel `lembur` lewat lib/lemburData.ts;
// bila tanggal lampau dan absen hari kompensasinya sudah ada, status hari itu
// langsung dinilai ulang (Terlambat → Tepat Waktu) dan hasilnya disebut di toast.
// Boleh di akhir pekan / tanggal merah; kompensasi jatuh di hari kerja berikutnya.
"use client";

import { useEffect, useState } from "react";
import { Moon, Check } from "lucide-react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { isoDari, tambahHari } from "@/lib/rentangTanggal";
import { teksTanggal } from "@/lib/tanggalTampil";
import { dariMenit, formatDurasi, hariKerjaBerikutnya, keMenit, labelKompensasi, MENIT_LEMBUR_MIN, tandaAktif, type Kompensasi, type TandaLembur } from "@/lib/lembur";
import { batalkanLembur, jadwalKaryawan, tandaiLembur } from "@/lib/lemburData";
import { hariNonKerja, infoLibur, type PetaLibur } from "@/lib/hariLibur";
import { muatPetaSekitar } from "@/lib/hariLiburData";

type Props = {
  idKaryawan: string;
  nama: string;
  /** Tanggal terkunci (mis. dari sel Kehadiran). Tanpa ini: pemilih tanggal, bawaan hari ini. */
  tanggal?: string;
  /** Tanda yang sudah ada untuk tanggal itu (aktif atau dibatalkan) — menampilkan tombol Batalkan. */
  tandaAda?: TandaLembur | null;
  onSelesai?: () => void;
  kecil?: boolean;
};

const HARI_MUNDUR_MAKS = 60;

export default function TandaiLembur({ idKaryawan, nama, tanggal, tandaAda, onSelesai, kecil = false }: Props) {
  const toast = useToast();
  const hariIni = isoDari(new Date());
  const [buka, setBuka] = useState(false);
  const [tgl, setTgl] = useState(tanggal || hariIni);
  const [kompensasi, setKompensasi] = useState<Kompensasi>(tandaAda?.kompensasi || "masuk_siang");
  const [catatan, setCatatan] = useState(tandaAda?.catatan || "");
  const [jadwal, setJadwal] = useState<{ jamMasuk: string; jamKeluar: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [peta, setPeta] = useState<PetaLibur | null>(null);   // tanggal merah ±31 hari (pratinjau hari kompensasi)
  const aktif = tandaAktif(tandaAda);

  // Escape menutup; jadwal karyawan dimuat saat jendela dibuka (di dalam async).
  useEffect(() => {
    if (!buka) return;
    // Fase capture + stopPropagation: Escape hanya menutup jendela ini, bukan juga jendela induk (detail sel Kehadiran).
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setBuka(false); } };
    window.addEventListener("keydown", onKey, true);
    let batal = false;
    jadwalKaryawan(supabase, idKaryawan).then((j) => { if (!batal) setJadwal({ jamMasuk: j.jamMasuk, jamKeluar: j.jamKeluar }); });
    return () => { batal = true; window.removeEventListener("keydown", onKey, true); };
  }, [buka, idKaryawan]);

  // Tanggal merah di sekitar tanggal terpilih → pratinjau hari kompensasi & catatan hari libur.
  useEffect(() => {
    if (!buka || !/^\d{4}-\d{2}-\d{2}$/.test(tgl)) return;
    let batal = false;
    muatPetaSekitar(supabase, tgl).then((p) => { if (!batal) setPeta(p); });
    return () => { batal = true; };
  }, [buka, tgl]);

  const bukaJendela = () => {
    setTgl(tanggal || hariIni);
    setKompensasi(tandaAda?.kompensasi || "masuk_siang");
    setCatatan(tandaAda?.catatan || "");
    setBuka(true);
  };

  const emailSesi = async () => String((await supabase.auth.getSession()).data?.session?.user?.email || "");

  const simpan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgl || tgl > hariIni) { toast.gagal("Tanggal lembur tidak boleh di masa depan."); return; }
    if (tgl < tambahHari(hariIni, -HARI_MUNDUR_MAKS)) { toast.gagal(`Tanggal lembur paling lama ${HARI_MUNDUR_MAKS} hari ke belakang.`); return; }
    setSibuk(true);
    try {
      const r = await tandaiLembur(supabase, { idKaryawan, nama, tanggal: tgl, kompensasi, catatan, oleh: await emailSesi() });
      if (!r.ok) { toast.gagal(r.pesan); return; }
      const label = labelKompensasi(kompensasi, jadwal?.jamMasuk || "09:00", jadwal?.jamKeluar || "18:00");
      let pesan = `Lembur ${teksTanggal(tgl)} ditandai untuk ${nama} · hari kerja berikutnya (${teksTanggal(r.hasil.hariKompensasi)}) ${label}.`;
      if (r.hasil.diubah) {
        pesan += r.hasil.statusLama !== r.hasil.statusBaru
          ? ` Absen ${teksTanggal(r.hasil.hariKompensasi, { tahun: false })} dikoreksi: ${r.hasil.statusLama} → ${r.hasil.statusBaru}.`
          : r.hasil.sah
            ? ` Kompensasi sudah diterapkan ke absen ${teksTanggal(r.hasil.hariKompensasi, { tahun: false })}.`
            : ` Kompensasi pada absen ${teksTanggal(r.hasil.hariKompensasi, { tahun: false })} dicabut.`;
      }
      if (r.hasil.lemburMenit != null && !r.hasil.sah) toast.info(`Clock-out ${tgl} hanya lembur ${formatDurasi(r.hasil.lemburMenit)} (kurang dari 1 jam) — kompensasi tidak berlaku.`);
      if (r.peringatan) toast.info(r.peringatan);
      toast.sukses(pesan);
      setBuka(false);
      onSelesai?.();
    } finally { setSibuk(false); }
  };

  const batalkan = async () => {
    if (!tandaAda?.id) return;
    const ya = await toast.konfirmasi(`Batalkan tanda lembur ${tandaAda.tanggal} untuk ${nama}? Bila kompensasinya sudah dipakai, status absen hari berikutnya akan dinilai ulang.`, { labelYa: "Batalkan tanda", labelTidak: "Kembali" });
    if (!ya) return;
    setSibuk(true);
    try {
      const r = await batalkanLembur(supabase, tandaAda, await emailSesi());
      if (!r.ok) { toast.gagal(r.pesan); return; }
      toast.info(`Tanda lembur ${tandaAda.tanggal} dibatalkan${r.hasil.diubah ? ` · absen ${r.hasil.hariKompensasi}: ${r.hasil.statusLama} → ${r.hasil.statusBaru}` : ""}.`);
      if (r.peringatan) toast.info(r.peringatan);
      setBuka(false);
      onSelesai?.();
    } finally { setSibuk(false); }
  };

  const tombolKelas = kecil
    ? `shrink-0 inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 min-h-[1.75rem] rounded-md border transition-colors ${aktif ? "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25" : "text-gray-500 border-white/10 hover:text-amber-300 hover:border-amber-500/40 hover:bg-amber-500/10"}`
    : `inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${aktif ? "bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25" : "bg-white/5 text-gray-300 border-white/10 hover:bg-amber-500/10 hover:text-amber-300 hover:border-amber-500/40"}`;

  return (
    <>
      <button type="button" onClick={bukaJendela} className={tombolKelas} title={aktif ? `Ditandai lembur (${tandaAda?.kompensasi === "pulang_cepat" ? "pulang cepat" : "masuk siang"}) — klik untuk ubah/batalkan` : "Tandai lembur → hari kerja berikutnya boleh masuk siang / pulang cepat"} data-tandai-lembur={aktif ? "aktif" : "baru"}>
        <Moon className="w-3.5 h-3.5" aria-hidden />{aktif ? <>Lembur <Check className="w-3.5 h-3.5" aria-label="ditandai" /></> : "Lembur"}
      </button>
      {buka && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !sibuk) setBuka(false); }} role="dialog" aria-modal="true" data-jendela-lembur>
          <div className="bg-kartu border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-white/5 bg-kartu-hover flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Tandai lembur</h2>
                <p className="text-xs text-gray-400 mt-0.5"><span className="text-tint font-bold">{nama}</span> · hari kerja berikutnya mendapat kompensasi bila clock-out ≥ 1 jam setelah jam pulang.</p>
              </div>
              <button type="button" onClick={() => setBuka(false)} className="text-gray-500 hover:text-white text-xl leading-none px-2" aria-label="Tutup">×</button>
            </div>
            <form onSubmit={simpan} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Tanggal lembur</label>
                <input type="date" value={tgl} max={hariIni} min={tambahHari(hariIni, -HARI_MUNDUR_MAKS)} disabled={!!tanggal} onChange={(e) => setTgl(e.target.value)} className="w-full bg-input border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400 disabled:opacity-70" name="tanggal" />
                <p className="text-[11px] text-gray-500 mt-1">Boleh tanggal lampau (maks {HARI_MUNDUR_MAKS} hari) — absen hari berikutnya yang terlanjur &quot;Terlambat&quot; akan dikoreksi otomatis.</p>
                {tgl && peta && (
                  <p className="text-[11px] text-gray-400 mt-1" data-pratinjau-kompensasi>Kompensasi jatuh pada <b className="text-amber-300">{teksTanggal(hariKerjaBerikutnya(tgl, peta), { tahun: false })}</b>.</p>
                )}
                {tgl && hariNonKerja(tgl, peta) && (
                  <p className="text-[11px] text-amber-200/90 mt-1 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-1.5" data-catatan-hari-libur>
                    {infoLibur(tgl, peta)?.nama || "Akhir pekan"}: aturannya sama dengan hari kerja — sah bila clock-out ≥ 1 jam lewat jam pulang{jadwal ? ` (≥ ${dariMenit(keMenit(jadwal.jamKeluar) + MENIT_LEMBUR_MIN)})` : ""}.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-2 uppercase tracking-wider">Kompensasi hari kerja berikutnya</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(["masuk_siang", "pulang_cepat"] as Kompensasi[]).map((k) => (
                    <label key={k} className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${kompensasi === k ? "border-amber-400/60 bg-amber-500/10" : "border-white/10 hover:border-white/20"}`}>
                      <input type="radio" name="kompensasi" value={k} checked={kompensasi === k} onChange={() => setKompensasi(k)} className="mt-0.5 accent-amber-400" />
                      <span className="text-xs">
                        <span className="block font-bold text-white">{k === "masuk_siang" ? "Masuk siang" : "Pulang cepat"}</span>
                        <span className="text-gray-400">{jadwal ? labelKompensasi(k, jadwal.jamMasuk, jadwal.jamKeluar) : k === "masuk_siang" ? "boleh masuk 1 jam lebih siang" : "boleh pulang 1 jam lebih awal"}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Catatan (opsional)</label>
                <input type="text" maxLength={200} value={catatan} onChange={(e) => setCatatan(e.target.value)} placeholder="mis. revisi klien X" className="w-full bg-input border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-amber-400 placeholder-gray-600" name="catatan" />
              </div>
              {tandaAda && (
                <p className="text-[11px] text-gray-400 rounded-lg bg-black/20 border border-white/10 px-3 py-2">
                  {aktif ? <>Sudah ditandai oleh <b className="text-gray-200">{tandaAda.ditandai_oleh || "-"}</b> ({tandaAda.kompensasi === "pulang_cepat" ? "pulang cepat" : "masuk siang"}). Simpan untuk mengubah, atau batalkan.</> : <>Tanda sebelumnya dibatalkan. Simpan untuk menandai lagi.</>}
                </p>
              )}
              <div className="pt-4 flex gap-3 border-t border-white/5 mt-2">
                {aktif && <button type="button" onClick={batalkan} disabled={sibuk} className="py-2.5 px-4 text-xs font-bold text-red-300 border border-red-500/30 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50" data-aksi="batal-lembur">Batalkan tanda</button>}
                <button type="button" onClick={() => setBuka(false)} disabled={sibuk} className="flex-1 py-2.5 text-xs font-bold text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">Tutup</button>
                <button type="submit" disabled={sibuk} className="flex-1 py-2.5 text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 rounded-xl shadow-lg transition-colors disabled:opacity-60" data-aksi="simpan-lembur">{sibuk ? "Menyimpan…" : aktif ? "Simpan perubahan" : "Tandai lembur"}</button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
