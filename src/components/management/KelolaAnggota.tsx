// src/components/management/KelolaAnggota.tsx
// Daftar anggota Management (penentu akses menu). Tambah / nonaktifkan / aktifkan lewat RPC mgmt_atur_anggota.
// Akun @invisual.studio non-owner (HR, master) & owner sudah otomatis berakses — tidak perlu dicatat di sini.
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { bisa, DIVISI_LABEL, DIVISI_LEADER, PERAN_LABEL, SEMUA_PERAN, type PeranManagement } from "@/lib/management/akses";
import { panggilRpc } from "@/lib/management/usulan";
import { Dialog, Kosong, Lencana, PesanGalat, kelasInput, kelasLabel, kelasTombol, kelasTombolUtama } from "./ui";
import ImporCsv from "./ImporCsv";

type Anggota = { id: string; email: string; nama: string; peran: PeranManagement; divisi: string | null; aktif: boolean };
const WAJIB: PeranManagement[] = ["studio_manager", "pm", "hr", "leader_sosmed", "leader_service", "leader_marketplace"];

/** `impor`: tampilkan "Impor dari sheet" (hanya bila SQL P2 terpasang; Studio Manager — status akhir usulan = keputusan SM). */
export default function KelolaAnggota({ peran, impor = false }: { peran: PeranManagement[]; impor?: boolean }) {
  const toast = useToast();
  const [baris, setBaris] = useState<Anggota[] | null | undefined>(undefined);
  const [tambah, setTambah] = useState(false);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [galat, setGalat] = useState("");
  const [bukaImpor, setBukaImpor] = useState(false);

  const muat = useCallback(async () => {
    const { data, error } = await supabase.from("mgmt_anggota").select("id, email, nama, peran, divisi, aktif").order("peran").order("nama");
    setBaris(error ? null : (data as Anggota[]) || []);
  }, []);
  useEffect(() => { const t = setTimeout(muat, 0); return () => clearTimeout(t); }, [muat]);

  if (!bisa(peran, "kelola_anggota")) return <Kosong>Hanya Studio Manager, HR, atau owner yang dapat mengelola anggota.</Kosong>;
  if (baris === undefined) return <p className="py-10 text-center text-sm text-gray-500" aria-busy="true">Memuat anggota…</p>;
  if (baris === null) return <Kosong>Daftar anggota belum tersedia.</Kosong>;

  const kosong = WAJIB.filter((p) => !baris.some((b) => b.aktif && b.peran === p));
  // Sama dengan mgmt_atur_anggota: peran Studio Manager/PM hanya diberi/diubah oleh Studio Manager atau owner.
  const bolehAtas = peran.includes("studio_manager") || peran.includes("owner");
  const ubahAktif = async (a: Anggota) => {
    setSibuk(a.id); setGalat("");
    const r = await panggilRpc(supabase, "mgmt_atur_anggota", { p_aksi: a.aktif ? "nonaktifkan" : "aktifkan", p_id: a.id, p_email: null, p_nama: null, p_peran: null, p_divisi: null });
    setSibuk(null);
    if (!r.ok) { setGalat(r.pesan || "Gagal menyimpan."); return; }
    toast.sukses(`${a.nama} ${a.aktif ? "dinonaktifkan" : "diaktifkan"}.`);
    muat();
  };

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-kartu p-5" data-kelola-anggota>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-[62ch]">
          <h2 className="text-sm font-bold text-white">Anggota Management</h2>
          <p className="mt-0.5 text-xs text-gray-500">Penentu siapa yang melihat menu Management. Peran manager di Daily Task tidak dipakai. Owner (Dea, Riza, Tryan) dan akun @invisual.studio (HR, master) sudah otomatis berakses.</p>
        </div>
        {impor && peran.includes("studio_manager") ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={kelasTombol} onClick={() => setBukaImpor(true)} data-impor-sheet>Impor dari sheet</button>
            <button type="button" className={kelasTombolUtama} onClick={() => setTambah(true)} data-tambah-anggota>+ Tambah anggota</button>
          </div>
        ) : <button type="button" className={kelasTombolUtama} onClick={() => setTambah(true)} data-tambah-anggota>+ Tambah anggota</button>}
      </div>
      {bukaImpor && <ImporCsv onTutup={() => setBukaImpor(false)} />}
      {kosong.length > 0 && (
        <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs text-amber-200" data-peran-kosong>
          Belum ada anggota aktif untuk peran: {kosong.map((p) => PERAN_LABEL[p]).join(", ")}.
        </p>
      )}
      <PesanGalat pesan={galat} />
      {baris.length === 0 ? <Kosong>Belum ada anggota. — <button type="button" className="text-tint underline cursor-pointer" onClick={() => setTambah(true)}>Tambah anggota</button></Kosong> : (
        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-white/10 text-left text-[10.5px] uppercase tracking-wide text-gray-500">
              {["Nama", "Email", "Peran", "Divisi", "Status", ""].map((h, i) => <th key={i} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody>{baris.map((a) => (
              <tr key={a.id} className="border-b border-white/5 last:border-0" data-anggota={a.email}>
                <td className="px-3 py-2.5 text-white">{a.nama}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{a.email}</td>
                <td className="px-3 py-2.5 text-gray-300">{PERAN_LABEL[a.peran]}</td>
                <td className="px-3 py-2.5 text-gray-400">{a.divisi ? DIVISI_LABEL[a.divisi] : "—"}</td>
                <td className="px-3 py-2.5">{a.aktif ? <Lencana warna="hijau">Aktif</Lencana> : <Lencana>Nonaktif</Lencana>}</td>
                <td className="px-3 py-2.5 text-right">{(bolehAtas || (a.peran !== "studio_manager" && a.peran !== "pm")) && <button type="button" className={kelasTombol} disabled={sibuk === a.id} onClick={() => ubahAktif(a)}>{a.aktif ? "Nonaktifkan" : "Aktifkan"}</button>}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      {tambah && <DialogTambah bolehAtas={bolehAtas} onTutup={() => setTambah(false)} onSelesai={(n) => { setTambah(false); toast.sukses(`${n} ditambahkan.`); muat(); }} />}
    </div>
  );
}

function DialogTambah({ bolehAtas, onTutup, onSelesai }: { bolehAtas: boolean; onTutup: () => void; onSelesai: (nama: string) => void }) {
  // Owner tidak perlu dicatat (otomatis dari OWNER_EMAILS); SM/PM hanya oleh SM/owner.
  const pilihan = SEMUA_PERAN.filter((p) => p !== "owner" && (bolehAtas || (p !== "studio_manager" && p !== "pm")));
  const [email, setEmail] = useState("");
  const [nama, setNama] = useState("");
  const [peran, setPeran] = useState<PeranManagement>(bolehAtas ? "pm" : "hr");
  const [divisi, setDivisi] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [galat, setGalat] = useState("");
  const leader = !!DIVISI_LEADER[peran];
  const kirim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !nama.trim()) { setGalat("Email dan nama wajib diisi."); return; }
    setSibuk(true); setGalat("");
    const r = await panggilRpc(supabase, "mgmt_atur_anggota", { p_aksi: "tambah", p_id: null, p_email: email.trim(), p_nama: nama.trim(), p_peran: peran, p_divisi: leader ? divisi || null : null });
    setSibuk(false);
    if (!r.ok) { setGalat(r.pesan || "Gagal menambah anggota."); return; }
    onSelesai(nama.trim());
  };
  return (
    <Dialog judul="Tambah anggota Management" sub="Pakai email akun login orangnya (akun pribadi atau @invisual.studio)." onTutup={onTutup} sibuk={sibuk} data-dialog-anggota="">
      <form onSubmit={kirim} noValidate className="space-y-4">
        <label className={kelasLabel} htmlFor="ag-email">Email akun<input id="ag-email" type="email" className={kelasInput} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@gmail.com" /></label>
        <label className={kelasLabel} htmlFor="ag-nama">Nama<input id="ag-nama" className={kelasInput} value={nama} onChange={(e) => setNama(e.target.value)} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={kelasLabel} htmlFor="ag-peran">Peran<select id="ag-peran" className={kelasInput} value={peran} onChange={(e) => setPeran(e.target.value as PeranManagement)}>{pilihan.map((p) => <option key={p} value={p}>{PERAN_LABEL[p]}</option>)}</select></label>
          <label className={kelasLabel} htmlFor="ag-divisi">Divisi {leader ? "(wajib untuk leader)" : "(hanya leader)"}
            <select id="ag-divisi" className={kelasInput} value={divisi} disabled={!leader} onChange={(e) => setDivisi(e.target.value)}>
              <option value="">—</option>{["sosmed", "service", "marketplace"].map((d) => <option key={d} value={d}>{DIVISI_LABEL[d]}</option>)}
            </select>
          </label>
        </div>
        <PesanGalat pesan={galat} />
        <div className="flex justify-end gap-2">
          <button type="button" className={kelasTombol} onClick={onTutup} disabled={sibuk}>Batal</button>
          <button type="submit" className={kelasTombolUtama} disabled={sibuk} data-kirim-anggota>{sibuk ? "Menyimpan…" : "Tambah"}</button>
        </div>
      </form>
    </Dialog>
  );
}
