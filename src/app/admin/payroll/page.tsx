// src/app/admin/payroll/page.tsx
// Payroll per PERIODE GAJI (21 → 20) dengan alur Draf → Final → Kirim.
//
//   • Periode & slip tersimpan di tabel payroll_periode / payroll_slip (payroll.sql).
//   • Draf  : HR mengisi gaji pokok / bonus / potongan / catatan per slip (Input Gaji).
//             Kehadiran dihitung langsung dari attendance rentang periode (potretKehadiran).
//   • Final : angka terkunci (trigger DB), potret kehadiran disimpan ke slip,
//             karyawan dapat melihat slipnya di Profil; push "Slip gaji terbit".
//   • Kirim : slip PDF dikirim ke email karyawan lewat /api/payroll/kirim
//             (≤ 5 per panggilan, berulang sampai selesai; status per slip).
//
// Aksi yang mengubah status (buat/sinkron/finalkan/buka/kirim) lewat rute API
// (HR + service role); pembacaan & Input Gaji lewat RLS sesi HR (lib/payroll/klien.ts).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import { KerangkaTabel, KeadaanKosong } from "@/components/Kerangka";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import { pushNotify } from "@/lib/push";
import AvatarKaryawan from "@/components/AvatarKaryawan";
import SlipModal from "@/components/payroll/SlipModal";
import { isoDari, labelRentang, labelTanggal } from "@/lib/rentangTanggal";
import { fleksibelIds } from "@/lib/keterlambatan";
import {
  formatRupiah, keSlipTampil, labelPeriode, periodeBerjalan, pilihanPeriodeBaru, potretKehadiran,
  ringkasanPeriode, peringatanFinal, ringkasanEmail, namaBerkasSlip, angkaAman,
  type PeriodeBaris, type SlipBaris, type SlipTampil,
} from "@/lib/payroll/hitung";
import { unduhSlipPdf } from "@/lib/payroll/slipPdf";
import {
  muatPeriode, muatSlip, simpanSlip, buatPeriode, sinkronPeriode, finalkanPeriode, bukaKunciPeriode, kirimSlip, kirimSemua,
  type ProgresKirim,
} from "@/lib/payroll/klien";

type Keadaan = "memuat" | "siap" | "tabelBelumAda" | "galat";
type FormEdit = { gajiPokok: string; bonus: string; potongan: string; catatan: string };

// Ambil SEMUA baris dengan paginasi ber-ORDER (hindari batas 1000 baris Supabase) — sama dengan Kehadiran.
async function ambilSemuaBaris(bangun: () => any): Promise<any[]> {
  const semua: any[] = [];
  const uk = 1000;
  for (let dari = 0, put = 0; put < 100; put++, dari += uk) {
    const { data, error } = await bangun().order("id", { ascending: true }).range(dari, dari + uk - 1);
    if (error) throw error;
    const b = data || [];
    semua.push(...b);
    if (b.length < uk) break;
  }
  return semua;
}

const jamPendek = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${labelTanggal(isoDari(d), false)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const KELAS_AVATAR = "w-8 h-8 shrink-0 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-bold text-[11px]";
const KELAS_INPUT = "w-full bg-input border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none placeholder-gray-600";
const KELAS_TOMBOL_ABU = "bg-white/5 hover:bg-white/10 text-gray-300 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap";
const KELAS_TOMBOL_BIRU = "bg-primer-terang hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap";

export default function AdminPayrollPage() {
  const toast = useToast();
  const todayISO = isoDari(new Date());

  const [keadaan, setKeadaan] = useState<Keadaan>("memuat");
  const [pesanGalat, setPesanGalat] = useState("");
  const [hrEmail, setHrEmail] = useState("");
  const [periode, setPeriode] = useState<PeriodeBaris[]>([]);
  const [aktifId, setAktifId] = useState("");
  const [slips, setSlips] = useState<SlipBaris[]>([]);
  const [memuatSlip, setMemuatSlip] = useState(false);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [sibuk, setSibuk] = useState<string | null>(null);
  const [progres, setProgres] = useState<(ProgresKirim & { total: number }) | null>(null);
  const [pilihBaru, setPilihBaru] = useState(false);

  // Nomor urut pemuatan: respons periode lama yang datang belakangan tidak boleh menimpa periode yang sedang dipilih.
  const urutMuat = useRef(0);
  const [edit, setEdit] = useState<{ slip: SlipBaris; form: FormEdit; simpanMaster: boolean } | null>(null);
  const [lihat, setLihat] = useState<{ slip: SlipTampil; draf: boolean } | null>(null);
  const [dialogFinal, setDialogFinal] = useState(false);

  const aktif = useMemo(() => periode.find((p) => p.id === aktifId) || null, [periode, aktifId]);
  const draf = aktif?.status === "draf";
  const fleks = useMemo(() => fleksibelIds(employees), [employees]);
  const ringkas = useMemo(() => ringkasanPeriode(slips), [slips]);
  const email = useMemo(() => ringkasanEmail(slips), [slips]);
  const peringatan = useMemo(() => peringatanFinal(slips), [slips]);
  const berjalan = useMemo(() => periodeBerjalan(todayISO), [todayISO]);
  const berjalanAda = periode.some((p) => p.dari === berjalan.dari && p.sampai === berjalan.sampai);
  const pilihanBaru = useMemo(() => pilihanPeriodeBaru(todayISO, 12).filter((r) => !periode.some((p) => p.dari === r.dari && p.sampai === r.sampai)), [todayISO, periode]);

  /** Kehadiran per baris: draf → dihitung dari attendance; final → potret tersimpan di slip. */
  const kehadiran = (s: SlipBaris) => {
    if (!aktif || !draf) return { hadir: Number(s.hadir || 0), telat: Number(s.telat || 0) };
    return potretKehadiran(attendance, s.idKaryawan, fleks, { dari: aktif.dari, sampai: aktif.sampai });
  };

  // ── Pemuatan ──────────────────────────────────────────────────────────
  const muatDaftarPeriode = async (pilih?: string) => {
    const r = await muatPeriode(supabase);
    if (!r.ok) {
      setPesanGalat(r.pesan);
      setKeadaan(r.tabelBelumAda ? "tabelBelumAda" : "galat");
      return null;
    }
    setPeriode(r.periode);
    const id = pilih && r.periode.some((p) => p.id === pilih) ? pilih : (r.periode[0]?.id || "");
    setAktifId(id);
    setKeadaan("siap");
    return r.periode.find((p) => p.id === id) || null;
  };

  const muatIsiPeriode = async (p: PeriodeBaris | null) => {
    const urut = ++urutMuat.current;
    const masihAktif = () => urut === urutMuat.current;
    if (!p) { setSlips([]); setAttendance([]); return; }
    setMemuatSlip(true);
    try {
      const r = await muatSlip(supabase, p.id);
      if (!masihAktif()) return;
      if (!r.ok) { toast.gagal(r.pesan); setSlips([]); return; }
      setSlips(r.slips);
      if (p.status === "draf") {
        const att = await ambilSemuaBaris(() => supabase.from("attendance").select("*").gte("tanggal", p.dari).lte("tanggal", p.sampai));
        if (!masihAktif()) return;
        setAttendance(att);
      } else {
        setAttendance([]);
      }
    } catch (e: any) {
      if (masihAktif()) toast.gagal(e?.message || "Gagal memuat data periode.");
    } finally {
      if (masihAktif()) setMemuatSlip(false);
    }
  };

  useEffect(() => {
    let batal = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (batal) return;
      setHrEmail(String(data?.session?.user?.email || ""));
      const { data: emp } = await supabase.from("employees").select("*");
      if (batal) return;
      setEmployees(emp || []);
      const p = await muatDaftarPeriode();
      if (batal) return;
      await muatIsiPeriode(p);
    })();
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pilihPeriode = async (id: string) => {
    setAktifId(id);
    setPilihBaru(false);
    await muatIsiPeriode(periode.find((p) => p.id === id) || null);
  };

  const muatUlang = async (id = aktifId) => {
    const p = await muatDaftarPeriode(id);
    await muatIsiPeriode(p);
  };

  // ── Aksi periode ─────────────────────────────────────────────────────
  const aksiBuatPeriode = async (r: { dari: string; sampai: string }) => {
    setSibuk("buat");
    try {
      const h = await buatPeriode(supabase, r);
      if (!h.ok) { toast.gagal(h.pesan); return; }
      toast.sukses(h.sudahAda ? `Periode ${labelPeriode(r)} sudah ada.` : `Periode ${labelPeriode(r)} dibuat — ${h.jumlah} slip karyawan.`);
      setPilihBaru(false);
      await muatUlang(h.id);
    } finally { setSibuk(null); }
  };

  const aksiSinkron = async () => {
    if (!aktif) return;
    setSibuk("sinkron");
    try {
      const h = await sinkronPeriode(supabase, aktif.id);
      if (!h.ok) { toast.gagal(h.pesan); return; }
      const bagian = [h.ditambahkan ? `${h.ditambahkan} karyawan ditambahkan` : "", h.diperbarui ? `${h.diperbarui} data karyawan (email/rekening) disegarkan` : ""].filter(Boolean);
      toast.sukses(bagian.length ? `${bagian.join(", ")}.` : "Semua karyawan aktif sudah ada dan datanya mutakhir.");
      if (h.ditambahkan || h.diperbarui) await muatIsiPeriode(aktif);
    } finally { setSibuk(null); }
  };

  const aksiFinalkan = async () => {
    if (!aktif) return;
    setSibuk("final");
    try {
      const h = await finalkanPeriode(supabase, aktif.id);
      if (!h.ok) { toast.gagal(h.pesan); return; }
      setDialogFinal(false);
      toast.sukses(`Periode ${h.label} difinalkan (${h.jumlah} slip). Karyawan kini bisa melihat slipnya di Profil.`);
      if (h.userIds?.length) {
        await pushNotify(supabase, { memberIds: h.userIds, title: `Slip gaji ${h.label} terbit`, body: "Buka Profil untuk melihat slip Anda.", url: "/user/profil", tag: "payroll" });
      }
      await muatUlang(aktif.id);
    } finally { setSibuk(null); }
  };

  const aksiBukaKunci = async () => {
    if (!aktif) return;
    const peringatanKirim = email.terkirim > 0 ? ` ${email.terkirim} slip sudah dikirim ke email — bila angkanya diubah, slip yang sudah diterima karyawan akan berbeda dari yang di HRIS.` : "";
    const ya = await toast.konfirmasi(`Buka kunci periode ${aktif.label}? Slip akan kembali ke Draf dan disembunyikan dari karyawan sampai difinalkan lagi.${peringatanKirim}`, { labelYa: "Buka kunci", labelTidak: "Batal" });
    if (!ya) return;
    setSibuk("buka");
    try {
      const h = await bukaKunciPeriode(supabase, aktif.id);
      if (!h.ok) { toast.gagal(h.pesan); return; }
      toast.info(`Periode ${aktif.label} kembali ke Draf.`);
      await muatUlang(aktif.id);
    } finally { setSibuk(null); }
  };

  const ringkasHasilKirim = (s: ProgresKirim) =>
    [s.terkirim ? `${s.terkirim} terkirim` : "", s.gagal ? `${s.gagal} gagal` : "", s.simulasi ? `${s.simulasi} simulasi (RESEND_API_KEY belum diset)` : ""].filter(Boolean).join(" · ") || "tidak ada slip yang diproses";

  const aksiKirim = async (target: "belum" | string[]) => {
    if (!aktif) return;
    const total = target === "belum" ? email.belum : target.length;
    if (!total) { toast.info("Tidak ada slip yang perlu dikirim."); return; }
    setSibuk("kirim");
    setProgres({ terkirim: 0, gagal: 0, simulasi: 0, diproses: 0, sisa: total, total });
    try {
      const h = await kirimSemua(supabase, aktif.id, target, (s) => setProgres({ ...s, total }));
      if (!h.ok) toast.gagal(`${h.pesan} (${ringkasHasilKirim(h as unknown as ProgresKirim)})`);
      else if (h.gagal) toast.info(`Selesai: ${ringkasHasilKirim(h)}.`);
      else toast.sukses(`Selesai: ${ringkasHasilKirim(h)}.`);
      await muatUlang(aktif.id);
    } finally { setSibuk(null); setProgres(null); }
  };

  const aksiKirimSatu = async (s: SlipBaris) => {
    if (!aktif) return;
    setSibuk(`kirim:${s.idKaryawan}`);
    try {
      const h = await kirimSlip(supabase, aktif.id, [s.idKaryawan]);
      if (!h.ok) { toast.gagal(h.pesan); return; }
      if (h.terkirim) toast.sukses(`Slip ${s.nama} terkirim ke ${s.email}.`);
      else if (h.simulasi) toast.info(`Slip ${s.nama} — mode simulasi (RESEND_API_KEY belum diset).`);
      else toast.gagal(`Slip ${s.nama} gagal dikirim.`);
      await muatIsiPeriode(aktif);
    } finally { setSibuk(null); }
  };

  // ── Input Gaji ───────────────────────────────────────────────────────
  const bukaEdit = (s: SlipBaris) => setEdit({
    slip: s,
    form: { gajiPokok: String(s.gaji_pokok ?? ""), bonus: String(s.bonus ?? ""), potongan: String(s.potongan ?? ""), catatan: String(s.catatan || "") },
    simpanMaster: false,
  });

  const simpanEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const emp = employees.find((x) => String(x.idKaryawan) === String(edit.slip.idKaryawan));
    const kolomMaster = emp && "gajipokok" in emp ? "gajipokok" : emp && "gajipoko" in emp ? "gajipoko" : emp && "gajiPokok" in emp ? "gajiPokok" : "gajipokok";
    setSibuk("simpan");
    try {
      const h = await simpanSlip(supabase, edit.slip.id, {
        gajiPokok: angkaAman(edit.form.gajiPokok), bonus: angkaAman(edit.form.bonus), potongan: angkaAman(edit.form.potongan), catatan: edit.form.catatan,
      }, { simpanMaster: edit.simpanMaster, kolomMaster, idKaryawan: edit.slip.idKaryawan, oleh: hrEmail });
      if (!h.ok) { toast.gagal(h.pesan); return; }
      setSlips((prev) => prev.map((s) => s.id === edit.slip.id ? { ...s, gaji_pokok: h.gajiPokok, bonus: h.bonus, potongan: h.potongan, catatan: h.catatan } : s));
      if (edit.simpanMaster) setEmployees((prev) => prev.map((x) => String(x.idKaryawan) === String(edit.slip.idKaryawan) ? { ...x, [kolomMaster]: h.gajiPokok } : x));
      toast.sukses(`Komponen gaji ${edit.slip.nama} tersimpan${edit.simpanMaster ? " (gaji pokok tetap ikut diperbarui)" : ""}.`);
      setEdit(null);
    } finally { setSibuk(null); }
  };

  const thpPratinjau = edit ? angkaAman(edit.form.gajiPokok) + angkaAman(edit.form.bonus) - angkaAman(edit.form.potongan) : 0;

  const tampil = (s: SlipBaris): SlipTampil => {
    const k = kehadiran(s);
    return { ...keSlipTampil(s), hadir: k.hadir, telat: k.telat };
  };

  // ── Tampilan ─────────────────────────────────────────────────────────
  if (keadaan === "memuat") {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[75vh] animate-in fade-in zoom-in-95 duration-500">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-primer-terang/20 rounded-full blur-2xl animate-pulse"></div>
          <img src="/logo.png" alt="Memuat Payroll..." className="relative w-16 h-16 animate-spin object-contain" style={{ animationDuration: "3s" }} />
        </div>
        <p className="text-gray-500 text-[11px] md:text-xs font-mono tracking-[0.25em] uppercase mt-8 animate-pulse">Memuat Data Payroll...</p>
      </div>
    );
  }

  if (keadaan === "tabelBelumAda" || keadaan === "galat") {
    return (
      <div className="w-full flex flex-col gap-6 pb-10 font-sans text-gray-300 animate-in fade-in duration-500">
        <div className="p-6 rounded-xl border border-amber-500/30 bg-amber-500/5" data-payroll-petunjuk>
          <h1 className="text-xl font-bold text-white">Payroll belum siap</h1>
          {keadaan === "tabelBelumAda" ? (
            <>
              <p className="text-sm text-gray-300 mt-2">Tabel <code className="font-mono text-amber-300">payroll_periode</code> dan <code className="font-mono text-amber-300">payroll_slip</code> belum ada di database.</p>
              <ol className="text-sm text-gray-400 mt-3 list-decimal list-inside space-y-1">
                <li>Buka Supabase › <b>SQL Editor</b>.</li>
                <li>Jalankan berkas <code className="font-mono text-amber-300">payroll.sql</code> (sekali; aman diulang).</li>
                <li>Muat ulang halaman ini.</li>
              </ol>
            </>
          ) : (
            <p className="text-sm text-red-300 mt-2">{pesanGalat}</p>
          )}
          <button type="button" onClick={() => { setKeadaan("memuat"); muatUlang(); }} className={`${KELAS_TOMBOL_BIRU} mt-4`}>Muat ulang</button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6 pb-10 font-sans text-gray-300 animate-in fade-in duration-500">

      {/* KEPALA: periode, status, ringkasan */}
      <div className="p-6 shadow-lg flex flex-col gap-5 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-500/10 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-white tracking-tight">Payroll</h1>
            <p className="text-sm text-gray-400 mt-1">Periode gaji tanggal 21 – 20. Isi komponen gaji saat <b>Draf</b>, <b>Finalkan</b> agar karyawan bisa melihat slip, lalu <b>Kirim</b> ke email.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {periode.length > 0 && (
              <select value={aktifId} onChange={(e) => pilihPeriode(e.target.value)} disabled={!!sibuk || memuatSlip} className="max-w-full bg-kartu-hover border border-white/10 px-4 py-2.5 rounded-xl text-sm font-bold text-tint outline-none" data-periode>
                {periode.map((p) => <option key={p.id} value={p.id}>{p.label} ({labelRentang({ dari: p.dari, sampai: p.sampai })}) — {p.status === "final" ? "Final" : "Draf"}</option>)}
              </select>
            )}
            {!berjalanAda && (
              <button type="button" onClick={() => aksiBuatPeriode(berjalan)} disabled={!!sibuk} className={KELAS_TOMBOL_BIRU} data-aksi="mulai">
                {sibuk === "buat" ? "Membuat…" : `Mulai periode ${labelPeriode(berjalan)}`}
              </button>
            )}
            <button type="button" onClick={() => setPilihBaru((v) => !v)} disabled={!!sibuk} className={KELAS_TOMBOL_ABU} data-aksi="periode-lain">Buat periode lain…</button>
          </div>
        </div>

        {pilihBaru && (
          <div className="relative z-10 flex flex-wrap gap-2 p-3 rounded-xl border border-white/10 bg-black/20" data-pilihan-periode>
            {pilihanBaru.length === 0 && <span className="text-xs text-gray-500">Semua periode 12 bulan terakhir sudah dibuat.</span>}
            {pilihanBaru.map((r) => (
              <button key={r.dari} type="button" onClick={() => aksiBuatPeriode(r)} disabled={!!sibuk} className={KELAS_TOMBOL_ABU}>
                {labelPeriode(r)} <span className="text-gray-500 font-normal">({labelRentang(r)})</span>
              </button>
            ))}
          </div>
        )}

        {aktif && (
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-black text-white">{aktif.label}</span>
              <span className="text-xs text-gray-500 font-mono">{labelRentang({ dari: aktif.dari, sampai: aktif.sampai })}</span>
              <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${draf ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-green-500/10 text-green-300 border-green-500/30"}`} data-status={aktif.status}>
                {draf ? "Draf" : "Final"}
              </span>
              {!draf && aktif.difinalkan_pada && <span className="text-[11px] text-gray-500">difinalkan {jamPendek(aktif.difinalkan_pada)}{aktif.difinalkan_oleh ? ` oleh ${aktif.difinalkan_oleh}` : ""}</span>}
              {!draf && (
                <span className="text-[11px] text-gray-400" data-ringkas-email>
                  Email: <b className="text-green-300">{email.terkirim}</b> dari {slips.length} terkirim
                  {email.gagal > 0 && <> · <b className="text-red-300">{email.gagal} gagal</b></>}
                  {email.simulasi > 0 && <> · <b className="text-blue-300">{email.simulasi} simulasi</b></>}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs" data-ringkasan>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Karyawan</p><p className="text-white font-bold text-sm mt-0.5">{ringkas.orang}</p></div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Gaji Pokok</p><p className="text-white font-bold text-sm mt-0.5">{formatRupiah(ringkas.gajiPokok)}</p></div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Bonus</p><p className="text-green-300 font-bold text-sm mt-0.5">{formatRupiah(ringkas.bonus)}</p></div>
              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="text-gray-500 uppercase tracking-wider text-[10px] font-bold">Potongan</p><p className="text-red-300 font-bold text-sm mt-0.5">{formatRupiah(ringkas.potongan)}</p></div>
              <div className="rounded-xl border border-green-500/20 bg-green-500/10 px-3 py-2"><p className="text-green-400/70 uppercase tracking-wider text-[10px] font-bold">Total Take Home Pay</p><p className="text-green-300 font-black text-sm mt-0.5" data-total-thp>{formatRupiah(ringkas.thp)}</p></div>
            </div>
            <div className="flex flex-wrap gap-2" data-aksi-periode>
              {draf ? (
                <>
                  <button type="button" onClick={aksiSinkron} disabled={!!sibuk} className={KELAS_TOMBOL_ABU} data-aksi="sinkron" title="Tambah karyawan aktif yang belum punya slip & segarkan email/rekening dari data karyawan">{sibuk === "sinkron" ? "Memeriksa…" : "Sinkronkan karyawan"}</button>
                  <button type="button" onClick={() => setDialogFinal(true)} disabled={!!sibuk || slips.length === 0} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed" data-aksi="final">Finalkan periode</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => aksiKirim("belum")} disabled={!!sibuk || email.belum === 0} className="bg-primer-terang hover:bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-md disabled:opacity-40 disabled:cursor-not-allowed" data-aksi="kirim">
                    {sibuk === "kirim" ? "Mengirim…" : `Kirim slip ke email (${email.belum} belum)`}
                  </button>
                  {email.gagal > 0 && (
                    <button type="button" onClick={() => aksiKirim(slips.filter((s) => s.email_status === "gagal").map((s) => s.idKaryawan))} disabled={!!sibuk} className="bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-40" data-aksi="kirim-gagal">
                      Kirim ulang yang gagal ({email.gagal})
                    </button>
                  )}
                  <button type="button" onClick={aksiBukaKunci} disabled={!!sibuk} className={KELAS_TOMBOL_ABU} data-aksi="buka">{sibuk === "buka" ? "Membuka…" : "Buka kunci (kembali ke Draf)"}</button>
                </>
              )}
            </div>
            {progres && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3" data-progres={`${progres.diproses}/${progres.total}`}>
                <div className="flex justify-between text-xs text-gray-300 mb-1.5">
                  <span>Mengirim slip… <b className="text-white">{progres.diproses} dari {progres.total}</b></span>
                  <span className="text-gray-500">{progres.terkirim} terkirim · {progres.gagal} gagal{progres.simulasi ? ` · ${progres.simulasi} simulasi` : ""}</span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden"><div className="h-full bg-primer-terang transition-all duration-300" style={{ width: `${progres.total ? Math.min(100, Math.round((progres.diproses / progres.total) * 100)) : 0}%` }} /></div>
              </div>
            )}
          </div>
        )}
        {!aktif && (
          <p className="relative z-10 text-sm text-gray-500" data-kosong>Belum ada periode gaji. Klik <b>Mulai periode {labelPeriode(berjalan)}</b> untuk membuat slip semua karyawan aktif.</p>
        )}
      </div>

      {/* TABEL SLIP */}
      {aktif && (
        <div className="p-3 md:p-4 overflow-hidden relative rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
          {memuatSlip ? (
            <KerangkaTabel baris={4} label="Memuat slip…" />
          ) : slips.length === 0 ? (
            <KeadaanKosong
              judul="Belum ada slip di periode ini"
              keterangan={draf ? "Sinkronkan karyawan untuk membuat slip bagi semua karyawan aktif." : "Periode ini tidak memiliki slip."}
              aksi={draf ? <button type="button" onClick={aksiSinkron} disabled={!!sibuk} className={KELAS_TOMBOL_BIRU}>Sinkronkan karyawan</button> : undefined}
            />
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-sm text-gray-300 min-w-[860px] tabel-baris-rapi" data-tabel-slip>
                <thead className="bg-kartu-hover text-gray-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-2.5 py-3 rounded-tl-xl font-semibold">Karyawan</th>
                    <th className="px-2.5 py-3 font-semibold text-center">Kehadiran</th>
                    <th className="px-2.5 py-3 font-semibold text-right">Gaji Pokok</th>
                    <th className="px-2.5 py-3 font-semibold text-right text-green-400">Bonus</th>
                    <th className="px-2.5 py-3 font-semibold text-right text-red-400">Potongan</th>
                    <th className="px-2.5 py-3 font-semibold text-right text-green-400" title="Take Home Pay = gaji pokok + bonus − potongan">THP</th>
                    {!draf && <th className="px-2.5 py-3 font-semibold text-center">Email</th>}
                    <th className="px-2.5 py-3 rounded-tr-xl font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {slips.map((s, i) => {
                    const k = kehadiran(s);
                    const thp = keSlipTampil(s).gajiBersih;
                    const sibukBaris = sibuk === `kirim:${s.idKaryawan}`;
                    return (
                      <tr key={s.id || `${s.idKaryawan}-${i}`} data-baris={s.idKaryawan}>
                        <td className="px-2.5 py-3">
                          <div className="flex items-center gap-3">
                            <AvatarKaryawan id={s.idKaryawan} nama={s.nama} className={KELAS_AVATAR} />
                            <div className="min-w-0">
                              <p className="font-bold text-white whitespace-nowrap" title={s.nama}>{s.nama}</p>
                              <p className="text-[11px] text-gray-500 font-mono mt-0.5 whitespace-nowrap">{s.idKaryawan} • {s.jabatan || "-"}{s.catatan ? <NotebookPen className="inline w-3 h-3 ml-1 text-amber-300/80 align-[-2px]" aria-label={`Catatan: ${s.catatan}`} /> : null}{draf && !s.email && <span className="ml-1 text-amber-300" title="Karyawan tidak punya email — slip tidak bisa dikirim. Lengkapi di data karyawan." data-email="belum">• Tanpa email</span>}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2.5 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5" data-kehadiran={`${k.hadir}/${k.telat}`}>
                            <span className="bg-green-500/10 text-green-400 text-[11px] font-bold px-2 py-0.5 rounded whitespace-nowrap" title="Hari hadir tepat waktu">{k.hadir} Hadir</span>
                            {k.telat > 0 && <span className="bg-yellow-500/10 text-yellow-400 text-[11px] font-bold px-2 py-0.5 rounded whitespace-nowrap" title="Hari terlambat">{k.telat} Telat</span>}
                          </div>
                        </td>
                        <td className="px-2.5 py-3 text-right font-medium tabular-nums whitespace-nowrap" data-gaji>{formatRupiah(Number(s.gaji_pokok))}</td>
                        <td className="px-2.5 py-3 text-right font-medium text-green-400 tabular-nums whitespace-nowrap">{Number(s.bonus) > 0 ? formatRupiah(Number(s.bonus)) : "-"}</td>
                        <td className="px-2.5 py-3 text-right font-medium text-red-400 tabular-nums whitespace-nowrap">{Number(s.potongan) > 0 ? `-${formatRupiah(Number(s.potongan))}` : "-"}</td>
                        <td className="px-2.5 py-3 text-right whitespace-nowrap">
                          <span className="bg-green-500/10 text-green-400 font-black px-2.5 py-1.5 rounded-lg border border-green-500/20 tabular-nums" data-thp>{formatRupiah(thp)}</span>
                        </td>
                        {!draf && <td className="px-2.5 py-3 text-center">
                          {s.email_status === "terkirim" && <span className="bg-green-500/10 text-green-300 text-[11px] font-bold px-2 py-0.5 rounded" title={s.email || ""} data-email="terkirim">Terkirim {jamPendek(s.email_dikirim_pada)}</span>}
                          {s.email_status === "gagal" && <span className="bg-red-500/10 text-red-300 text-[11px] font-bold px-2 py-0.5 rounded cursor-help" title={s.email_galat || "Gagal"} data-email="gagal">Gagal ⓘ</span>}
                          {s.email_status === "simulasi" && <span className="bg-blue-500/10 text-blue-300 text-[11px] font-bold px-2 py-0.5 rounded" title="RESEND_API_KEY belum diset — email tidak benar-benar terkirim" data-email="simulasi">Simulasi</span>}
                          {(!s.email_status || s.email_status === "belum") && <span className="text-[11px] text-gray-500" title={s.email || "tanpa email"} data-email="belum">{s.email ? "Belum" : "Tanpa email"}</span>}
                        </td>}
                        <td className="px-2.5 py-3 text-center">
                          <div className="flex gap-1.5 justify-center flex-nowrap">
                            {draf && <button type="button" onClick={() => bukaEdit(s)} disabled={!!sibuk} className={KELAS_TOMBOL_ABU} data-aksi="input" title="Isi gaji pokok, bonus, potongan">Input Gaji</button>}
                            <button type="button" onClick={() => setLihat({ slip: tampil(s), draf })} className={KELAS_TOMBOL_BIRU} data-aksi="lihat" title="Lihat slip">Slip</button>
                            {!draf && <button type="button" onClick={() => unduhSlipPdf(tampil(s), aktif.label, namaBerkasSlip(aktif.label, s.nama))} className={KELAS_TOMBOL_ABU} data-aksi="unduh" title="Unduh PDF">PDF</button>}
                            {!draf && <button type="button" onClick={() => aksiKirimSatu(s)} disabled={!!sibuk || !s.email} className={KELAS_TOMBOL_ABU} data-aksi="kirim-ulang" title={s.email ? `${s.email_status === "terkirim" ? "Kirim ulang" : "Kirim"} ke ${s.email}` : "Karyawan tidak punya email"}>{sibukBaris ? "…" : s.email_status === "terkirim" ? "Kirim ulang" : "Kirim"}</button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: INPUT GAJI (hanya draf) */}
      {edit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" data-modal-edit>
          <div className="bg-kartu border border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-white/5 bg-kartu-hover flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-white">Input Gaji</h2>
                <p className="text-xs text-gray-400 mt-0.5">{aktif?.label} · <span className="text-tint font-bold">{edit.slip.nama}</span></p>
              </div>
              <button type="button" onClick={() => setEdit(null)} className="text-gray-500 hover:text-white text-xl leading-none px-2" aria-label="Tutup">×</button>
            </div>
            <form onSubmit={simpanEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Gaji Pokok (Rp)</label>
                <input type="number" min={0} step="any" placeholder="0" value={edit.form.gajiPokok} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, gajiPokok: e.target.value } })} className={`${KELAS_INPUT} focus:border-primer-terang`} name="gajiPokok" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-green-400 mb-1 uppercase tracking-wider">Bonus / Insentif (Rp)</label>
                <input type="number" min={0} step="any" placeholder="0" value={edit.form.bonus} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, bonus: e.target.value } })} className={`${KELAS_INPUT} focus:border-green-500`} name="bonus" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-red-400 mb-1 uppercase tracking-wider">Potongan / Kasbon (Rp)</label>
                <input type="number" min={0} step="any" placeholder="0" value={edit.form.potongan} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, potongan: e.target.value } })} className={`${KELAS_INPUT} focus:border-red-500`} name="potongan" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1 uppercase tracking-wider">Catatan (tampil di slip, opsional)</label>
                <input type="text" maxLength={200} placeholder="mis. Kasbon 1×, lembur proyek X" value={edit.form.catatan} onChange={(e) => setEdit({ ...edit, form: { ...edit.form, catatan: e.target.value } })} className={`${KELAS_INPUT} focus:border-primer-terang`} name="catatan" />
              </div>
              <label className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer select-none">
                <input type="checkbox" checked={edit.simpanMaster} onChange={(e) => setEdit({ ...edit, simpanMaster: e.target.checked })} className="mt-0.5 accent-blue-500" name="simpanMaster" />
                <span>Simpan juga sebagai <b className="text-gray-200">gaji pokok tetap</b> karyawan (dipakai periode berikutnya)</span>
              </label>
              <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-2.5 text-xs flex justify-between">
                <span className="text-gray-400">Take Home Pay</span>
                <span className={`font-black ${thpPratinjau < 0 ? "text-red-300" : "text-green-300"}`} data-thp-pratinjau>{formatRupiah(thpPratinjau)}</span>
              </div>
              {thpPratinjau < 0 && <p className="text-[11px] text-red-300" data-peringatan="thp-negatif">Potongan melebihi pendapatan — Take Home Pay negatif. Periksa kembali angkanya.</p>}
              <div className="pt-4 flex gap-3 border-t border-white/5 mt-2">
                <button type="button" onClick={() => setEdit(null)} className="w-1/3 py-2.5 text-xs font-bold text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">Batal</button>
                <button type="submit" disabled={sibuk === "simpan"} className="w-2/3 flex justify-center items-center gap-2 py-2.5 text-xs font-bold text-white bg-green-600 hover:bg-green-500 rounded-xl shadow-lg transition-colors disabled:opacity-60">
                  {sibuk === "simpan" && <img src="/logo.png" className="w-4 h-4 animate-spin object-contain" style={{ animationDuration: "3s" }} alt="" />}
                  {sibuk === "simpan" ? "Menyimpan..." : "💾 Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG: FINALKAN */}
      {dialogFinal && aktif && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" data-dialog-final>
          <div className="bg-kartu border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-white/5 bg-kartu-hover">
              <h2 className="text-lg font-bold text-white">Finalkan periode {aktif.label}?</h2>
              <p className="text-xs text-gray-400 mt-0.5">Setelah final, angka slip terkunci dan karyawan bisa melihat slipnya di Profil. Anda masih bisa membuka kunci bila perlu.</p>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Slip</p><p className="text-white font-bold">{ringkas.orang} karyawan</p></div>
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"><p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">Total THP</p><p className="text-green-300 font-black">{formatRupiah(ringkas.thp)}</p></div>
              </div>
              {peringatan.tanpaEmail.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200" data-peringatan="email">
                  <b>Tanpa email ({peringatan.tanpaEmail.length}):</b> {peringatan.tanpaEmail.join(", ")} — slip tidak bisa dikirim ke email, tetapi tetap tampil di Profil.
                </div>
              )}
              {peringatan.tanpaRekening.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200" data-peringatan="rekening">
                  <b>Tanpa nomor rekening ({peringatan.tanpaRekening.length}):</b> {peringatan.tanpaRekening.join(", ")}.
                </div>
              )}
              <div className="pt-4 flex gap-3 border-t border-white/5">
                <button type="button" onClick={() => setDialogFinal(false)} disabled={sibuk === "final"} className="w-1/3 py-2.5 text-xs font-bold text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">Batal</button>
                <button type="button" onClick={aksiFinalkan} disabled={sibuk === "final"} className="w-2/3 py-2.5 text-xs font-bold text-white bg-green-600 hover:bg-green-500 rounded-xl shadow-lg transition-colors disabled:opacity-60" data-aksi="final-ya">
                  {sibuk === "final" ? "Memfinalkan…" : "Ya, finalkan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SLIP */}
      {lihat && aktif && <SlipModal slip={lihat.slip} label={aktif.label} draf={lihat.draf} onTutup={() => setLihat(null)} />}
    </div>
  );
}
