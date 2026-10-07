// src/components/admin/KartuLembur.tsx
// Kartu "Lembur" di Dasbor admin: tanda lembur hari ini dan hari kerja sebelumnya
// (yang kompensasinya berlaku hari ini) + status sah/belum/kurang/batal, tombol
// Batalkan / Tandai lagi. Tidak dirender bila tidak ada tanda (return null) —
// `bungkus` dipakai agar sel bento hanya muncul saat ada isi.
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Moon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import AvatarKaryawan from "@/components/AvatarKaryawan";
import { namaPanggilan } from "@/lib/nama";
import { labelTanggal } from "@/lib/rentangTanggal";
import { hariLemburUntuk, labelKompensasi, statusTanda, tandaAktif, type AbsenRingkas, type TandaLembur } from "@/lib/lembur";
import { batalkanLembur, muatTandaLembur, tandaiLembur } from "@/lib/lemburData";

type Baris = { tanda: TandaLembur; att: AbsenRingkas | null; jamMasuk: string; jamKeluar: string };
const KELAS_AVATAR = "w-8 h-8 shrink-0 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-bold text-[11px]";
const WARNA: Record<string, string> = { sah: "text-green-300", belum: "text-tint", kurang: "text-amber-300", lupa: "text-amber-300", batal: "text-gray-500" };

export default function KartuLembur({ versi, hariIni, employees, onUbah, bungkus }: { versi: number; hariIni: string; employees: any[]; onUbah?: () => void; bungkus?: (isi: ReactNode) => ReactNode }) {
  const toast = useToast();
  const [baris, setBaris] = useState<Baris[]>([]);
  const [sibuk, setSibuk] = useState<string | null>(null);

  useEffect(() => {
    let batal = false;
    (async () => {
      const hari = [hariIni, ...hariLemburUntuk(hariIni)];
      const tanda = await muatTandaLembur(supabase, { dari: hari[hari.length - 1], sampai: hariIni, termasukBatal: true });
      if (batal) return;
      if (!tanda.length) { setBaris([]); return; }
      const ids = Array.from(new Set(tanda.map((t) => t.idKaryawan)));
      let absen: any[] = [];
      try {
        const { data } = await supabase.from("attendance").select("id, idKaryawan, tanggal, waktuMasuk, waktuKeluar, jamPulangSeharusnya, lembur_menit").in("idKaryawan", ids).in("tanggal", Array.from(new Set(tanda.map((t) => t.tanggal))));
        absen = data || [];
      } catch { absen = []; }
      if (batal) return;
      const petaEmp = new Map((employees || []).map((e: any) => [String(e.idKaryawan), e]));
      setBaris(tanda.map((t) => {
        const e = petaEmp.get(String(t.idKaryawan));
        return { tanda: t, att: absen.find((a) => String(a.idKaryawan) === String(t.idKaryawan) && String(a.tanggal).slice(0, 10) === t.tanggal) || null, jamMasuk: e?.jamMasuk || "09:00", jamKeluar: e?.jamKeluar || "18:00" };
      }));
    })();
    return () => { batal = true; };
  }, [versi, hariIni, employees]);

  if (!baris.length) return null;

  const emailSesi = async () => String((await supabase.auth.getSession()).data?.session?.user?.email || "");
  const batalkan = async (b: Baris) => {
    const nama = b.tanda.nama || b.tanda.idKaryawan;
    const ya = await toast.konfirmasi(`Batalkan tanda lembur ${b.tanda.tanggal} untuk ${nama}? Bila kompensasinya sudah dipakai, status absen hari berikutnya dinilai ulang.`, { labelYa: "Batalkan tanda", labelTidak: "Kembali" });
    if (!ya) return;
    setSibuk(b.tanda.id || "");
    try {
      const r = await batalkanLembur(supabase, b.tanda, await emailSesi());
      if (!r.ok) { toast.gagal(r.pesan); return; }
      toast.info(`Tanda lembur ${b.tanda.tanggal} dibatalkan${r.hasil.diubah ? ` · absen ${r.hasil.hariKompensasi}: ${r.hasil.statusLama} → ${r.hasil.statusBaru}` : ""}.`);
      if (r.peringatan) toast.info(r.peringatan);
      onUbah?.();
    } finally { setSibuk(null); }
  };
  const tandaiLagi = async (b: Baris) => {
    setSibuk(b.tanda.id || "");
    try {
      const r = await tandaiLembur(supabase, { idKaryawan: b.tanda.idKaryawan, nama: b.tanda.nama, tanggal: b.tanda.tanggal, kompensasi: b.tanda.kompensasi, catatan: b.tanda.catatan || "", oleh: await emailSesi() });
      if (!r.ok) { toast.gagal(r.pesan); return; }
      toast.sukses(`Lembur ${b.tanda.tanggal} ditandai lagi${r.hasil.diubah ? ` · absen ${r.hasil.hariKompensasi}: ${r.hasil.statusLama} → ${r.hasil.statusBaru}` : ""}.`);
      if (r.peringatan) toast.info(r.peringatan);
      onUbah?.();
    } finally { setSibuk(null); }
  };

  const isi = (
    <div data-kartu-lembur>
      <div className="flex justify-between items-center gap-3 mb-4 border-b border-white/5 pb-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2"><Moon className="w-4 h-4 text-amber-300" aria-hidden />Lembur</h3>
        <span className="text-[11px] text-gray-500">{baris.length} tanda · hari ini & hari kerja sebelumnya</span>
      </div>
      <div className="space-y-2">
        {baris.map((b) => {
          const st = statusTanda(b.tanda, b.att, hariIni);
          const aktif = tandaAktif(b.tanda);
          return (
            <div key={b.tanda.id || `${b.tanda.idKaryawan}-${b.tanda.tanggal}`} className="flex flex-col sm:flex-row sm:items-center gap-2 bg-black/20 border border-white/5 rounded-xl px-3 py-2.5" data-lembur-baris={`${b.tanda.idKaryawan}|${b.tanda.tanggal}`} data-lembur-status={st.kode}>
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <AvatarKaryawan id={b.tanda.idKaryawan} nama={b.tanda.nama} className={KELAS_AVATAR} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate" title={b.tanda.nama || ""}>{namaPanggilan(b.tanda.idKaryawan, employees, b.tanda.nama)} <span className="text-[11px] text-gray-500 font-normal">· {b.tanda.tanggal === hariIni ? "hari ini" : labelTanggal(b.tanda.tanggal, false)} · {labelKompensasi(b.tanda.kompensasi, b.jamMasuk, b.jamKeluar)}</span></p>
                  <p className={`text-[11px] ${WARNA[st.kode] || "text-gray-400"}`}>{st.teks}{b.tanda.catatan ? <span className="text-gray-500"> · {b.tanda.catatan}</span> : null}</p>
                </div>
              </div>
              <div className="shrink-0">
                {aktif ? (
                  <button type="button" onClick={() => batalkan(b)} disabled={!!sibuk} className="text-[11px] font-bold text-red-300 border border-red-500/30 hover:bg-red-500/10 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50" data-aksi="batal-lembur">{sibuk === b.tanda.id ? "…" : "Batalkan"}</button>
                ) : (
                  <button type="button" onClick={() => tandaiLagi(b)} disabled={!!sibuk} className="text-[11px] font-bold text-amber-300 border border-amber-500/30 hover:bg-amber-500/10 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50" data-aksi="tandai-lagi">{sibuk === b.tanda.id ? "…" : "Tandai lagi"}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
  return <>{bungkus ? bungkus(isi) : isi}</>;
}
