// src/components/admin/KartuHariLibur.tsx
// Pengaturan HR › "Hari Libur & Cuti Bersama" (tabel hari_libur, hari-libur.sql).
//   • Daftar per tahun: libur nasional (selalu libur), cuti bersama (sakelar Libur/Masuk),
//     libur kantor (tambah/hapus). Setiap perubahan tercatat di Log Aktivitas.
//   • Dipakai heatmap & Kalender Cuti (tidak dihitung alpa) dan lembur (hari kompensasi
//     melewati tanggal merah). Tabel belum ada → petunjuk menjalankan SQL.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, CalendarX2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { LABEL_JENIS, type HariLibur, type JenisLibur } from "@/lib/hariLibur";
import { hapusLibur, muatSemuaLibur, setelLibur, tambahLibur } from "@/lib/hariLiburData";
import { teksTanggal } from "@/lib/tanggalTampil";

const WARNA_JENIS: Record<JenisLibur, string> = {
  nasional: "text-red-300 bg-red-500/10 border-red-500/25",
  cuti_bersama: "text-amber-200 bg-amber-500/10 border-amber-500/25",
  kantor: "text-tint bg-primer/10 border-primer/25",
};

export default function KartuHariLibur({ dibuka }: { dibuka: boolean }) {
  const toast = useToast();
  const [muat, setMuat] = useState<{ ada: boolean; baris: HariLibur[]; pesan?: string } | null>(null);
  const [tahun, setTahun] = useState(() => new Date().getFullYear());
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [form, setForm] = useState<{ tanggal: string; nama: string; jenis: JenisLibur }>({ tanggal: "", nama: "", jenis: "kantor" });

  const segarkan = useCallback(async () => { setMuat(await muatSemuaLibur(supabase)); }, []);
  useEffect(() => {
    if (!dibuka || muat) return;
    let batal = false;
    muatSemuaLibur(supabase).then((r) => { if (!batal) setMuat(r); });
    return () => { batal = true; };
  }, [dibuka, muat]);

  const daftarTahun = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear(), new Date().getFullYear() + 1]);
    (muat?.baris || []).forEach((x) => set.add(Number(x.tanggal.slice(0, 4))));
    return [...set].sort((a, b) => a - b);
  }, [muat]);
  const barisTahun = useMemo(() => (muat?.baris || []).filter((x) => x.tanggal.startsWith(`${tahun}-`)), [muat, tahun]);
  const hitung = useMemo(() => ({
    nasional: barisTahun.filter((x) => x.jenis === "nasional").length,
    cuti: barisTahun.filter((x) => x.jenis === "cuti_bersama").length,
    cutiLibur: barisTahun.filter((x) => x.jenis === "cuti_bersama" && x.libur).length,
    kantor: barisTahun.filter((x) => x.jenis === "kantor").length,
  }), [barisTahun]);

  if (!muat) return <p className="text-xs text-gray-500 py-3">Memuat daftar hari libur…</p>;
  if (!muat.ada) {
    return (
      <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3 text-xs text-amber-200 leading-relaxed" data-libur-belum-ada>
        Tabel hari libur belum ada. Jalankan <b>hari-libur.sql</b> sekali di Supabase › SQL Editor — isinya sudah memuat libur nasional &amp; cuti bersama 2026–2027 (SKB 3 Menteri).
        Sampai itu, hanya Sabtu–Minggu yang dianggap libur.
      </div>
    );
  }

  const ubahSakelar = async (x: HariLibur, libur: boolean) => {
    setSibuk(x.tanggal);
    try {
      const r = await setelLibur(supabase, x, libur);
      if (!r.ok) { toast.gagal(r.pesan); return; }
      toast.sukses(`${teksTanggal(x.tanggal)} · ${x.nama}: ${libur ? "libur" : "masuk kerja"}.`);
      await segarkan();
    } finally { setSibuk(null); }
  };
  const hapus = async (x: HariLibur) => {
    const ya = await toast.konfirmasi(`Hapus ${x.nama} (${teksTanggal(x.tanggal)}) dari daftar hari libur?${x.jenis === "nasional" ? " Hanya lakukan bila tanggalnya salah atau direvisi pemerintah." : ""}`, { labelYa: "Hapus", labelTidak: "Batal" });
    if (!ya) return;
    setSibuk(x.tanggal);
    try {
      const r = await hapusLibur(supabase, x);
      if (!r.ok) { toast.gagal(r.pesan); return; }
      toast.sukses("Hari libur dihapus.");
      await segarkan();
    } finally { setSibuk(null); }
  };
  const tambah = async (e: React.FormEvent) => {
    e.preventDefault();
    const ada = muat.baris.find((x) => x.tanggal === form.tanggal);
    if (ada) { toast.gagal(`Tanggal itu sudah ada di daftar: ${ada.nama}.`); return; }
    setSibuk("baru");
    try {
      const r = await tambahLibur(supabase, form);
      if (!r.ok) { toast.gagal(r.pesan); return; }
      toast.sukses(`${form.nama.trim()} ditambahkan.`);
      setTahun(Number(form.tanggal.slice(0, 4)));
      setForm({ tanggal: "", nama: "", jenis: "kantor" });
      await segarkan();
    } finally { setSibuk(null); }
  };

  const inputCls = "w-full bg-input border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white focus:border-primer-terang outline-none transition-colors [color-scheme:dark]";

  return (
    <div className="space-y-4" data-kartu-hari-libur>
      <p className="text-xs text-gray-400 leading-relaxed">
        Tanggal merah tidak dihitung alpa di heatmap Kehadiran, dan kompensasi lembur jatuh di hari kerja sesudahnya.
        Cuti bersama bisa disetel <b>Libur</b> atau <b>Masuk</b> sesuai kebijakan kantor.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="tablist" aria-label="Tahun">
          {daftarTahun.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={t === tahun} onClick={() => setTahun(t)}
              className={`sentuh px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${t === tahun ? "bg-primer text-white border-primer" : "bg-white/[0.03] text-gray-400 border-white/10 hover:text-white"}`}>{t}</button>
          ))}
        </div>
        <span className="text-[11px] text-gray-500 ml-auto" data-ringkas-libur>
          {hitung.nasional} libur nasional · {hitung.cuti} cuti bersama ({hitung.cutiLibur} libur){hitung.kantor ? ` · ${hitung.kantor} libur kantor` : ""}
        </span>
      </div>

      {muat.pesan && muat.baris.length === 0 ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3" data-libur-galat>
          <p className="text-xs text-red-300">Gagal memuat daftar: {muat.pesan}</p>
          <button type="button" onClick={() => { setMuat(null); }} className="shrink-0 text-xs font-bold text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-lg">Coba lagi</button>
        </div>
      ) : barisTahun.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-4 text-xs text-gray-400">
          <CalendarX2 className="w-5 h-5 text-gray-500 shrink-0" />
          <span>Belum ada hari libur tahun {tahun}. Tambahkan dari SKB 3 Menteri atau libur kantor lewat formulir di bawah.</span>
        </div>
      ) : (
        <ul className="divide-y divide-white/5 rounded-lg border border-white/10 overflow-hidden">
          {barisTahun.map((x) => (
            <li key={x.tanggal} className="flex items-center gap-3 px-3 py-2.5 bg-white/[0.015]" data-libur-baris={x.tanggal}>
              <span className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                <span className="sm:w-28 shrink-0 text-xs font-bold text-white tabular-nums">{teksTanggal(x.tanggal, { tahun: false })}</span>
                <span className="min-w-0 flex flex-col items-start gap-1">
                  <span className="text-xs text-gray-300 break-words">{x.nama}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${WARNA_JENIS[x.jenis]}`}>{LABEL_JENIS[x.jenis]}</span>
                </span>
              </span>
              {x.jenis === "nasional" ? (
                <span className="shrink-0 sm:w-[7.5rem] text-right text-[11px] text-gray-500">Selalu libur</span>
              ) : (
                <div className="shrink-0 flex rounded-lg border border-white/10 overflow-hidden" role="radiogroup" aria-label={`${x.nama}: libur atau masuk`} data-sakelar-libur={x.tanggal}>
                  {([true, false] as const).map((v) => (
                    <button key={String(v)} type="button" role="radio" aria-checked={x.libur === v} disabled={sibuk === x.tanggal}
                      onClick={() => { if (x.libur !== v) ubahSakelar(x, v); }}
                      className={`sentuh px-3 py-1 text-[11px] font-bold transition-colors disabled:opacity-50 ${x.libur === v ? (v ? "bg-red-600 text-white" : "bg-green-600 text-white") : "bg-transparent text-gray-400 hover:text-white"}`}>
                      {v ? "Libur" : "Masuk"}
                    </button>
                  ))}
                </div>
              )}
              {(
                <button type="button" onClick={() => hapus(x)} disabled={sibuk === x.tanggal} title="Hapus dari daftar" aria-label={`Hapus ${x.nama}`}
                  className="sentuh shrink-0 p-1.5 rounded-lg text-gray-500 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={tambah} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2.5" data-form-libur>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tambah hari libur</p>
        <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr_150px] gap-2">
          <input type="date" aria-label="Tanggal" value={form.tanggal} onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))} className={inputCls} required />
          <input type="text" aria-label="Nama hari libur" placeholder="mis. Ulang tahun Invisual" maxLength={120} value={form.nama} onChange={(e) => setForm((f) => ({ ...f, nama: e.target.value }))} className={inputCls} required />
          <select aria-label="Jenis" value={form.jenis} onChange={(e) => setForm((f) => ({ ...f, jenis: e.target.value as JenisLibur }))} className={inputCls}>
            <option value="kantor">Libur kantor</option>
            <option value="cuti_bersama">Cuti bersama</option>
            <option value="nasional">Libur nasional</option>
          </select>
        </div>
        <button type="submit" disabled={sibuk === "baru"} className="inline-flex items-center gap-1.5 bg-primer-terang hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all">
          <Plus className="w-3.5 h-3.5" /> {sibuk === "baru" ? "Menyimpan…" : "Tambah"}
        </button>
      </form>
    </div>
  );
}
