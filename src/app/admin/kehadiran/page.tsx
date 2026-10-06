// src/app/admin/kehadiran/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { fleksibelIds, terlambat } from "@/lib/keterlambatan";
import LeaveCalendar from "@/components/LeaveCalendar";
import { rapikanNama, namaResmi } from "@/lib/nama";
import { supabase } from "@/lib/supabase";
import { excludeOwners } from "@/lib/owners";

type StatusKehadiran = "Hadir" | "Telat" | "Alpa" | "Cuti/Sakit" | "WFH" | "Libur" | "-";
type Sel = { iso: string; status: StatusKehadiran; att?: any; leave?: any };
type Kategori = "hadir" | "telat" | "izin" | "alpa";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const HARI_HURUF = ["Mg", "Sn", "Sl", "Rb", "Km", "Jm", "Sb"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dariIso = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const tglPendek = (iso: string) => { const d = dariIso(iso); return `${HARI[d.getDay()].slice(0, 3)}, ${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)}`; };
const tglPanjang = (iso: string) => { const d = dariIso(iso); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
const normNama = (v: any) => String(v ?? "").trim().toLowerCase();
// Periode tutup-buku: mulai tgl ini tiap bulan s/d (tgl ini - 1) bulan berikutnya.
const TGL_MULAI_PERIODE = 21;

// Ambil rentang tanggal dari string approvals ("2026-07-16" atau "2026-07-16 s/d 2026-07-20").
function parseRange(t: string) {
  const dates = String(t || "").match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (!dates.length) return null;
  return { start: dates[0], end: dates.length > 1 ? dates[1] : dates[0] };
}

// Jenis izin → warna heatmap
function kindOf(jenis: string): "WFH" | "Cuti/Sakit" {
  const j = String(jenis || "").toLowerCase();
  if (j.includes("wfh") || j.includes("wfc") || j.includes("work from")) return "WFH";
  return "Cuti/Sakit";
}

// Ambil SEMUA baris dgn paginasi ber-ORDER (hindari batas 1000 baris Supabase;
// ORDER BY id membuat halaman stabil — tanpa urutan, baris bisa terlewat/ganda).
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

const KATEGORI: Record<Kategori, { judul: string; warna: string; bar: string; satuan: string; kosong: string }> = {
  hadir: { judul: "Hadir Tepat Waktu", warna: "text-green-400", bar: "bg-green-500", satuan: "hari tepat waktu", kosong: "Belum ada kehadiran tepat waktu di periode ini." },
  telat: { judul: "Terlambat", warna: "text-yellow-400", bar: "bg-yellow-500", satuan: "hari telat", kosong: "Tidak ada keterlambatan di periode ini. 🎉" },
  izin: { judul: "Izin / Cuti / WFH", warna: "text-purple-400", bar: "bg-purple-500", satuan: "hari izin", kosong: "Tidak ada izin/cuti/WFH di periode ini." },
  alpa: { judul: "Alpa", warna: "text-red-400", bar: "bg-red-500", satuan: "hari alpa", kosong: "Tidak ada alpa di periode ini. 🎉" },
};
const cocokKategori = (k: Kategori, st: StatusKehadiran) =>
  (k === "hadir" && st === "Hadir") || (k === "telat" && st === "Telat") || (k === "izin" && (st === "Cuti/Sakit" || st === "WFH")) || (k === "alpa" && st === "Alpa");

export default function AdminKehadiranPage() {
  const today = new Date();
  const todayISO = isoOf(today);
  const _anchorM = today.getDate() >= TGL_MULAI_PERIODE ? today.getMonth() : today.getMonth() - 1;
  const _anchorDate = new Date(today.getFullYear(), _anchorM, 1);
  const currentYM = `${_anchorDate.getFullYear()}-${pad(_anchorDate.getMonth() + 1)}`;

  const [selectedYM, setSelectedYM] = useState(currentYM);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [galatMuat, setGalatMuat] = useState("");
  const [closingId, setClosingId] = useState<string | null>(null);
  // Rincian kartu ringkasan (diklik) & detail sel heatmap (diklik)
  const [rincian, setRincian] = useState<Kategori | null>(null);
  const [bukaOrang, setBukaOrang] = useState<string | null>(null);
  const [detailSel, setDetailSel] = useState<{ baris: any; sel: Sel } | null>(null);
  const [cariNama, setCariNama] = useState("");

  // Pilihan bulan: 12 bulan terakhir
  const monthOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    const anchorM = today.getDate() >= TGL_MULAI_PERIODE ? today.getMonth() : today.getMonth() - 1;
    for (let i = 0; i < 12; i++) {
      const s = new Date(today.getFullYear(), anchorM - i, TGL_MULAI_PERIODE);
      const e = new Date(today.getFullYear(), anchorM - i + 1, TGL_MULAI_PERIODE - 1);
      out.push({ value: `${s.getFullYear()}-${pad(s.getMonth() + 1)}`, label: `${TGL_MULAI_PERIODE} ${BULAN[s.getMonth()].slice(0, 3)} – ${TGL_MULAI_PERIODE - 1} ${BULAN[e.getMonth()].slice(0, 3)} ${e.getFullYear()}` });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setGalatMuat("");
    try {
      const [pY, pM] = selectedYM.split("-").map(Number);
      const periodeStartISO = isoOf(new Date(pY, pM - 1, TGL_MULAI_PERIODE));
      const periodeEndISO = isoOf(new Date(pY, pM - 1 + 1, TGL_MULAI_PERIODE - 1));
      const [empRes, absensiSemua, izinSemua] = await Promise.all([
        supabase.from("employees").select("*").order("nama", { ascending: true }),
        ambilSemuaBaris(() => supabase.from("attendance").select("*").gte("tanggal", periodeStartISO).lte("tanggal", periodeEndISO)),
        // Izin Terlambat bukan ketidakhadiran → tak perlu dimuat di sini.
        ambilSemuaBaris(() => supabase.from("approvals").select("*").eq("status", "Disetujui").neq("jenis", "Izin Terlambat")),
      ]);
      // Owner dikecualikan dari statistik operasional
      setEmployees(excludeOwners((empRes.data || []).filter((e: any) => e.isAktif !== false)));
      setAttendance(absensiSemua);
      setLeaves(
        izinSemua
          .map((l: any) => ({ ...l, range: parseRange(l.tanggal) }))
          .filter((l: any) => l.range),
      );
    } catch (e: any) {
      setGalatMuat(e?.message || "Gagal memuat data kehadiran.");
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYM]);

  // Tutup jendela dengan tombol Escape
  useEffect(() => {
    const tutup = (e: KeyboardEvent) => { if (e.key === "Escape") { setRincian(null); setDetailSel(null); } };
    window.addEventListener("keydown", tutup);
    return () => window.removeEventListener("keydown", tutup);
  }, []);

  const [yearStr, monthStr] = selectedYM.split("-");
  const year = Number(yearStr);
  const monthIdx = Number(monthStr) - 1;
  const periodeHari = useMemo(() => {
    const arr: Date[] = [];
    const s = new Date(year, monthIdx, TGL_MULAI_PERIODE);
    const e = new Date(year, monthIdx + 1, TGL_MULAI_PERIODE - 1);
    for (let dt = new Date(s); dt <= e; dt.setDate(dt.getDate() + 1)) arr.push(new Date(dt));
    return arr;
  }, [year, monthIdx]);

  // ── HEATMAP dari data nyata (setiap sel menyimpan sumber datanya untuk rincian) ──
  const heatmapData = useMemo(() => {
    const fleks = fleksibelIds(employees);
    // index absensi: "idKaryawan|tanggal" → baris
    const attIndex: Record<string, any> = {};
    attendance.forEach((a) => { attIndex[`${a.idKaryawan}|${a.tanggal}`] = a; });

    return employees.map((emp) => {
      const joined = emp.tanggalBergabung ? String(emp.tanggalBergabung).slice(0, 10) : null;
      // Cocokkan izin lewat idKaryawan; cadangan lewat nama untuk pengajuan lama tanpa idKaryawan.
      const empLeaves = leaves.filter((l) =>
        l.jenis !== "Izin Terlambat" &&
        ((l.idKaryawan && String(l.idKaryawan) === String(emp.idKaryawan)) || (!l.idKaryawan && normNama(l.nama) === normNama(emp.nama))),
      );

      const sel: Sel[] = [];
      for (const dateObj of periodeHari) {
        const iso = isoOf(dateObj);
        const dow = dateObj.getDay();

        if (joined && iso < joined) { sel.push({ iso, status: "-" }); continue; }               // belum bergabung
        const att = attIndex[`${emp.idKaryawan}|${iso}`];
        if (att) { sel.push({ iso, status: terlambat(att, fleks) ? "Telat" : "Hadir", att }); continue; }
        const leave = empLeaves.find((l) => iso >= l.range.start && iso <= l.range.end);
        if (leave) { sel.push({ iso, status: kindOf(leave.jenis), leave }); continue; }
        if (dow === 0 || dow === 6) { sel.push({ iso, status: "Libur" }); continue; }            // akhir pekan
        sel.push({ iso, status: iso < todayISO ? "Alpa" : "-" });                                // hari depan dibiarkan kosong
      }

      const hitung = { hadir: 0, telat: 0, izin: 0, alpa: 0 };
      sel.forEach((x) => {
        if (x.status === "Hadir") hitung.hadir++;
        else if (x.status === "Telat") hitung.telat++;
        else if (x.status === "Cuti/Sakit" || x.status === "WFH") hitung.izin++;
        else if (x.status === "Alpa") hitung.alpa++;
      });

      return {
        id: emp.idKaryawan, nama: rapikanNama(emp.nama), divisi: emp.jabatan || emp.organisasi || "-", emp,
        sel, dataHarian: sel.map((x) => x.status), hitung,
      };
    });
  }, [employees, attendance, leaves, periodeHari, todayISO]);

  // ── RINGKASAN PERIODE ──
  const summary = useMemo(() => {
    const s = { hadir: 0, telat: 0, izin: 0, alpa: 0, cutiSakit: 0, wfh: 0, orang: { hadir: 0, telat: 0, izin: 0, alpa: 0 } };
    heatmapData.forEach((row) => {
      row.sel.forEach((x) => {
        if (x.status === "Hadir") s.hadir++;
        else if (x.status === "Telat") s.telat++;
        else if (x.status === "Cuti/Sakit") { s.izin++; s.cutiSakit++; }
        else if (x.status === "WFH") { s.izin++; s.wfh++; }
        else if (x.status === "Alpa") s.alpa++;
      });
      (Object.keys(s.orang) as Kategori[]).forEach((k) => { if (row.hitung[k] > 0) s.orang[k]++; });
    });
    return s;
  }, [heatmapData]);

  // ── ANOMALI (terhitung dari data nyata) ──
  const lupaClockOut = useMemo(
    () =>
      attendance
        .filter((a) => !a.waktuKeluar && a.tanggal < todayISO)
        .sort((a, b) => String(b.tanggal).localeCompare(String(a.tanggal)))
        .slice(0, 5),
    [attendance, todayISO],
  );

  const seringTelat = useMemo(() => {
    const count: Record<string, number> = {};
    attendance.forEach((a) => { if (terlambat(a, fleksibelIds(employees))) count[a.idKaryawan] = (count[a.idKaryawan] || 0) + 1; });
    return employees
      .map((e) => ({ nama: rapikanNama(e.nama), totalTelat: count[e.idKaryawan] || 0 }))
      .filter((x) => x.totalTelat > 0)
      .sort((a, b) => b.totalTelat - a.totalTelat)
      .slice(0, 5);
  }, [employees, attendance]);

  const palingDisiplin = useMemo(() => {
    const fleksSet = fleksibelIds(employees);
    const hadir: Record<string, number> = {};
    const telat: Record<string, number> = {};
    attendance.forEach((a) => {
      if (terlambat(a, fleksSet)) telat[a.idKaryawan] = (telat[a.idKaryawan] || 0) + 1;
      else hadir[a.idKaryawan] = (hadir[a.idKaryawan] || 0) + 1;
    });
    return employees
      .map((e) => ({ nama: rapikanNama(e.nama), hadir: hadir[e.idKaryawan] || 0, telat: telat[e.idKaryawan] || 0 }))
      .filter((x) => x.telat === 0 && x.hadir > 0)
      .sort((a, b) => b.hadir - a.hadir)
      .slice(0, 5);
  }, [employees, attendance]);

  // ── RINCIAN KARTU (kategori → per karyawan) ──
  const dataRincian = useMemo(() => {
    if (!rincian) return null;
    const orang = heatmapData
      .map((row) => ({ row, hari: row.sel.filter((x) => cocokKategori(rincian, x.status)) }))
      .filter((x) => x.hari.length > 0)
      .sort((a, b) => b.hari.length - a.hari.length || a.row.nama.localeCompare(b.row.nama));
    const totalHari = orang.reduce((n, x) => n + x.hari.length, 0);
    // Rincian izin per jenis (Cuti Tahunan, Izin Tidak Masuk, Izin Sakit, WFH/WFC, …)
    const perJenis: Record<string, number> = {};
    if (rincian === "izin") orang.forEach((x) => x.hari.forEach((h) => { const j = h.leave?.jenis || "Izin"; perJenis[j] = (perJenis[j] || 0) + 1; }));
    return { orang, totalHari, perJenis };
  }, [rincian, heatmapData]);

  // Tutup sesi absensi yang lupa clock-out (pakai jam keluar standar karyawan)
  const closeSession = async (row: any) => {
    const key = row.id || `${row.idKaryawan}|${row.tanggal}`;
    setClosingId(key);
    try {
      const emp = employees.find((e) => e.idKaryawan === row.idKaryawan);
      const jamKeluar = emp?.jamKeluar || "17:00";
      const q = supabase.from("attendance").update({ waktuKeluar: jamKeluar });
      const { error } = row.id
        ? await q.eq("id", row.id)
        : await q.eq("idKaryawan", row.idKaryawan).eq("tanggal", row.tanggal);
      if (!error) await fetchData();
    } catch {
      /* diamkan */
    }
    setClosingId(null);
  };

  const getColorByStatus = (status: StatusKehadiran) => {
    switch (status) {
      case "Hadir": return "bg-green-500 hover:bg-green-400 border-green-600";
      case "Telat": return "bg-yellow-500 hover:bg-yellow-400 border-yellow-600";
      case "Alpa": return "bg-red-500 hover:bg-red-400 border-red-600";
      case "Cuti/Sakit": return "bg-purple-500 hover:bg-purple-400 border-purple-600";
      case "WFH": return "bg-blue-500 hover:bg-blue-400 border-blue-600";
      case "Libur": return "bg-white/5 border-white/10";
      default: return "bg-white/[0.02] border-white/5";
    }
  };
  const labelStatus = (st: StatusKehadiran) =>
    st === "Hadir" ? "Hadir tepat waktu" : st === "Telat" ? "Terlambat" : st === "Cuti/Sakit" ? "Cuti / Izin / Sakit" : st === "WFH" ? "WFH / WFC" : st === "Alpa" ? "Alpa" : st === "Libur" ? "Libur (akhir pekan)" : "Tidak ada data";
  const lupaKeluar = (x: Sel) => !!x.att && !x.att.waktuKeluar && x.iso < todayISO;

  // Satu baris rincian per hari (dipakai jendela rincian kartu)
  const ketHari = (x: Sel) => {
    if (x.att) {
      const mode = x.att.mode_kerja ? ` · ${x.att.mode_kerja}` : "";
      return `Masuk ${x.att.waktuMasuk || "-"} · Pulang ${x.att.waktuKeluar || (x.iso < todayISO ? "lupa clock-out" : "belum")}${mode}`;
    }
    if (x.leave) return `${x.leave.jenis || "Izin"}${x.leave.alasan ? ` — "${String(x.leave.alasan).slice(0, 80)}${String(x.leave.alasan).length > 80 ? "…" : ""}"` : ""}`;
    if (x.status === "Alpa") return "Tidak ada absen & tidak ada izin disetujui";
    return labelStatus(x.status);
  };

  const monthLabel = `${TGL_MULAI_PERIODE} ${BULAN[monthIdx].slice(0, 3)} – ${TGL_MULAI_PERIODE - 1} ${BULAN[(monthIdx + 1) % 12].slice(0, 3)} ${new Date(year, monthIdx + 1, TGL_MULAI_PERIODE - 1).getFullYear()}`;
  const barisTampil = cariNama.trim() ? heatmapData.filter((r) => normNama(r.nama).includes(normNama(cariNama))) : heatmapData;

  const kartu: { k: Kategori; value: number; ket: string }[] = [
    { k: "hadir", value: summary.hadir, ket: `${summary.orang.hadir} orang · total hadir ${summary.hadir + summary.telat} hari` },
    { k: "telat", value: summary.telat, ket: `${summary.orang.telat} orang` },
    { k: "izin", value: summary.izin, ket: `${summary.cutiSakit} cuti/izin/sakit · ${summary.wfh} WFH/WFC` },
    { k: "alpa", value: summary.alpa, ket: `${summary.orang.alpa} orang` },
  ];

  return (
    <div className="max-w-[1400px] w-full flex flex-col gap-8 pb-10">

      {/* HEADER HALAMAN */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Manajemen Kehadiran</h1>
          <p className="text-gray-400 text-sm">Analitik kedisiplinan dari data absensi asli — periode {monthLabel}.</p>
        </div>
        <select
          value={selectedYM}
          onChange={(e) => setSelectedYM(e.target.value)}
          className="bg-input border border-white/10 rounded-xl px-5 py-3 text-sm text-white focus:outline-none focus:border-primer-terang font-bold shadow-lg cursor-pointer"
        >
          {monthOptions.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      {galatMuat && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300">Gagal memuat data: {galatMuat}</p>
          <button onClick={fetchData} className="shrink-0 text-xs font-bold text-white bg-red-500/80 hover:bg-red-500 px-3 py-1.5 rounded-lg">Coba lagi</button>
        </div>
      )}

      {/* RINGKASAN PERIODE — tiap kartu membuka rincian per karyawan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kartu.map(({ k, value, ket }) => {
          const meta = KATEGORI[k];
          return (
            <button
              key={k}
              type="button"
              onClick={() => { setRincian(k); setBukaOrang(null); }}
              disabled={isLoading}
              className="group text-left p-5 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow cursor-pointer disabled:cursor-wait"
            >
              <div className={`absolute left-0 top-0 h-full w-1 ${meta.bar}`} />
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{meta.judul}</p>
              <p className={`text-2xl font-black ${meta.warna}`}>{isLoading ? "–" : value}<span className="text-xs text-gray-600 font-bold ml-1">hari</span></p>
              <p className="text-[11px] text-gray-500 mt-1 truncate">{isLoading ? " " : ket}</p>
              <span className="mt-1 inline-block text-[11px] text-tint opacity-0 transition-opacity group-hover:opacity-100">Lihat rincian →</span>
            </button>
          );
        })}
      </div>

      {/* SMART ANOMALY CENTER — data nyata */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        <div className="p-6 relative overflow-hidden group hover:border-yellow-500/30 transition-all rounded-xl border border-white/10 bg-white/[0.03] duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl"></div>
          <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4 relative z-10">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2.25V15m0 0l-3-3m3 3l3-3m-3 3V12M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div><h2 className="font-bold text-white text-sm">Sering Terlambat</h2><p className="text-[10px] text-gray-400 uppercase tracking-widest">Peringatan</p></div>
          </div>
          <div className="space-y-3 relative z-10">
            {isLoading ? (
              <p className="text-xs text-gray-600">Memuat…</p>
            ) : seringTelat.length === 0 ? (
              <p className="text-xs text-gray-600">Tidak ada keterlambatan bulan ini. 🎉</p>
            ) : seringTelat.map((emp: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center bg-kartu-hover p-3 rounded-xl border border-white/10">
                <span className="text-sm font-semibold text-gray-200 truncate mr-2">{emp.nama}</span>
                <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-1 rounded border border-yellow-500/20 shrink-0">{emp.totalTelat}x Telat</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 relative overflow-hidden group hover:border-red-500/30 transition-all rounded-xl border border-white/10 bg-white/[0.03] duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-red-500/10 rounded-full blur-3xl"></div>
          <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4 relative z-10">
            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div><h2 className="font-bold text-white text-sm">Lupa Clock-Out</h2><p className="text-[10px] text-gray-400 uppercase tracking-widest">Tindakan</p></div>
          </div>
          <div className="space-y-3 relative z-10">
            {isLoading ? (
              <p className="text-xs text-gray-600">Memuat…</p>
            ) : lupaClockOut.length === 0 ? (
              <p className="text-xs text-gray-600">Semua sesi absensi tertutup rapi.</p>
            ) : lupaClockOut.map((row: any, idx: number) => {
              const key = row.id || `${row.idKaryawan}|${row.tanggal}`;
              return (
                <div key={idx} className="flex justify-between items-center bg-kartu-hover p-3 rounded-xl border border-white/10 gap-2">
                  <div className="min-w-0">
                    <span className="text-sm font-semibold text-gray-200 block truncate">{namaResmi(row.idKaryawan, employees, row.nama)}</span>
                    <span className="text-[10px] text-gray-500">{row.tanggal} · Masuk {row.waktuMasuk || "-"}</span>
                  </div>
                  <button
                    onClick={() => closeSession(row)}
                    disabled={closingId === key}
                    className="text-[10px] font-bold text-primer-terang hover:text-white bg-primer-terang/10 hover:bg-primer-terang px-3 py-1.5 rounded transition-colors shrink-0 disabled:opacity-40"
                  >
                    {closingId === key ? "…" : "Tutup Sesi"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 relative overflow-hidden group hover:border-green-500/30 transition-all rounded-xl border border-white/10 bg-white/[0.03] duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
          <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4 relative z-10">
            <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
            </div>
            <div><h2 className="font-bold text-white text-sm">Paling Disiplin</h2><p className="text-[10px] text-gray-400 uppercase tracking-widest">Apresiasi</p></div>
          </div>
          <div className="space-y-3 relative z-10">
            {isLoading ? (
              <p className="text-xs text-gray-600">Memuat…</p>
            ) : palingDisiplin.length === 0 ? (
              <p className="text-xs text-gray-600">Belum ada data absensi bulan ini.</p>
            ) : palingDisiplin.map((emp: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center bg-kartu-hover p-3 rounded-xl border border-white/10 gap-2">
                <span className="text-sm font-semibold text-gray-200 truncate">{emp.nama}</span>
                <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded border border-green-500/20 shrink-0">{emp.hadir} hari tepat waktu</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <LeaveCalendar />

      {/* TIMESHEET HEATMAP — data nyata; klik sel untuk melihat rincian hari itu */}
      <div className="flex flex-col overflow-hidden relative rounded-xl border border-white/10 bg-white/[0.03] transition-colors duration-300 hover:border-white/20 kartu-glow">
        <div className="p-6 border-b border-white/5 bg-kartu-hover flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h2 className="font-bold text-white text-lg">Timesheet Heatmap</h2>
            <p className="text-xs text-gray-400 mt-1">Matriks kehadiran harian — {monthLabel}. Klik kotak untuk melihat rinciannya.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
            <input
              value={cariNama}
              onChange={(e) => setCariNama(e.target.value)}
              placeholder="Cari karyawan…"
              className="bg-latar border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primer-terang sm:w-48"
            />
            <div className="flex flex-wrap gap-3 md:gap-4 bg-latar p-3 rounded-xl border border-white/10">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Hadir</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Telat</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">WFH/WFC</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Cuti/Sakit</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Alpa</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-white/5 border border-white/10"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Libur</span></div>
              <div className="flex items-center gap-1.5"><div className="relative w-3 h-3 rounded bg-green-500"><span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-white ring-1 ring-black/60"></span></div><span className="text-[10px] text-gray-400 font-bold uppercase">Lupa clock-out</span></div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar pb-4">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-latar border-b border-white/5">
              <tr>
                <th className="px-6 py-3 font-semibold text-xs text-gray-400 uppercase tracking-widest sticky left-0 bg-latar z-20 shadow-[5px_0_10px_rgba(0,0,0,0.3)] w-64 border-r border-white/5">Karyawan</th>
                {periodeHari.map((dt, i) => {
                  const iso = isoOf(dt);
                  const akhirPekan = dt.getDay() === 0 || dt.getDay() === 6;
                  const hariIni = iso === todayISO;
                  return (
                    <th key={i} title={tglPanjang(iso)} className={`px-1 py-2 font-semibold text-center border-l border-white/5 ${akhirPekan ? "bg-white/[0.02]" : ""} ${hariIni ? "bg-primer-terang/15" : ""}`}>
                      <span className={`block text-[9px] ${akhirPekan ? "text-gray-600" : "text-gray-500"}`}>{HARI_HURUF[dt.getDay()]}</span>
                      <span className={`block text-[10px] ${hariIni ? "text-tint font-black" : "text-gray-500"}`}>{dt.getDate()}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={periodeHari.length + 1} className="px-6 py-10 text-center text-gray-500">Memuat data absensi…</td></tr>
              ) : heatmapData.length === 0 ? (
                <tr><td colSpan={periodeHari.length + 1} className="px-6 py-10 text-center text-gray-500">Belum ada data karyawan aktif.</td></tr>
              ) : barisTampil.length === 0 ? (
                <tr><td colSpan={periodeHari.length + 1} className="px-6 py-10 text-center text-gray-500">Tidak ada karyawan bernama &quot;{cariNama}&quot;.</td></tr>
              ) : (
                barisTampil.map((emp) => (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-3 sticky left-0 bg-kartu z-10 shadow-[5px_0_10px_rgba(0,0,0,0.3)] border-r border-white/5 min-w-[190px]">
                      <p className="font-bold text-white text-sm truncate max-w-[200px]">{emp.nama}</p>
                      <p className="text-[10px] text-gray-500 truncate max-w-[200px]">{emp.divisi}</p>
                      <p className="text-[10px] font-bold mt-0.5 flex gap-2 whitespace-nowrap" title="Hadir · Telat · Izin/Cuti/WFH · Alpa">
                        <span className="text-green-400">H {emp.hitung.hadir}</span>
                        <span className="text-yellow-400">T {emp.hitung.telat}</span>
                        <span className="text-purple-400">I {emp.hitung.izin}</span>
                        <span className="text-red-400">A {emp.hitung.alpa}</span>
                      </p>
                    </td>
                    {emp.sel.map((x: Sel, index: number) => (
                      <td key={index} className={`px-1 py-3 text-center border-l border-white/5 border-dashed ${x.iso === todayISO ? "bg-primer-terang/[0.06]" : ""}`}>
                        <button
                          type="button"
                          onClick={() => setDetailSel({ baris: emp, sel: x })}
                          title={`${tglPanjang(x.iso)} — ${labelStatus(x.status)}${x.att ? ` · masuk ${x.att.waktuMasuk || "-"}` : ""}${lupaKeluar(x) ? " · lupa clock-out" : ""}`}
                          className={`relative block w-6 h-6 md:w-7 md:h-7 mx-auto rounded border opacity-90 hover:opacity-100 hover:scale-110 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primer-terang ${getColorByStatus(x.status)}`}
                        >
                          {lupaKeluar(x) && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-white ring-1 ring-black/60"></span>}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── JENDELA RINCIAN KARTU ── */}
      {rincian && dataRincian && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setRincian(null)}>
          <div className="bg-kartu rounded-xl border border-white/10 w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/5 bg-kartu-hover flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h2 className={`font-bold text-sm uppercase tracking-wider ${KATEGORI[rincian].warna}`}>{KATEGORI[rincian].judul}</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">{monthLabel} · {dataRincian.orang.length} orang · {dataRincian.totalHari} hari</p>
              </div>
              <button onClick={() => setRincian(null)} className="text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg shrink-0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
              {rincian === "izin" && Object.keys(dataRincian.perJenis).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(dataRincian.perJenis).sort((a, b) => b[1] - a[1]).map(([jenis, n]) => (
                    <span key={jenis} className={`text-[10px] font-bold px-2 py-1 rounded border ${kindOf(jenis) === "WFH" ? "bg-blue-500/10 text-blue-300 border-blue-500/20" : "bg-purple-500/10 text-purple-300 border-purple-500/20"}`}>{jenis}: {n} hari</span>
                  ))}
                </div>
              )}
              {dataRincian.orang.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">{KATEGORI[rincian].kosong}</p>
              ) : (
                <div className="space-y-2">
                  {dataRincian.orang.length > 0 && <p className="text-[10px] text-gray-500">Klik nama untuk melihat tanggalnya.</p>}
                  {dataRincian.orang.map(({ row, hari }) => {
                    const buka = bukaOrang === row.id;
                    return (
                      <div key={row.id} className="bg-input rounded-lg border border-white/5 overflow-hidden">
                        <button type="button" onClick={() => setBukaOrang(buka ? null : row.id)} className="w-full flex justify-between items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-white truncate">{row.nama}</p>
                            <p className="text-[10px] text-gray-500 truncate">{row.divisi}</p>
                          </div>
                          <span className={`text-xs font-bold shrink-0 ${KATEGORI[rincian].warna}`}>{hari.length} {KATEGORI[rincian].satuan} {buka ? "▴" : "▾"}</span>
                        </button>
                        {buka && (
                          <div className="border-t border-white/5 px-3 py-2 space-y-1.5">
                            {hari.map((h) => (
                              <button key={h.iso} type="button" onClick={() => setDetailSel({ baris: row, sel: h })} className="w-full flex gap-3 text-left text-[11px] hover:bg-white/5 rounded px-1 py-0.5">
                                <span className="text-gray-300 font-mono shrink-0 w-24">{tglPendek(h.iso)}</span>
                                <span className="text-gray-400 min-w-0 break-words">{ketHari(h)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/5 bg-kartu-hover">
              <button onClick={() => setRincian(null)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors">Tutup Jendela</button>
            </div>
          </div>
        </div>
      )}

      {/* ── JENDELA DETAIL SEL HEATMAP ── */}
      {detailSel && (() => {
        const { baris, sel: x } = detailSel;
        const att = x.att, lv = x.leave;
        const baris1 = (label: string, nilai: any, warna?: string) => (
          <div key={label} className="flex justify-between gap-4 py-1.5 border-b border-white/5 last:border-0">
            <span className="text-[11px] text-gray-500 shrink-0">{label}</span>
            <span className={`text-[12px] text-right break-words ${warna || "text-gray-200"}`}>{nilai}</span>
          </div>
        );
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setDetailSel(null)}>
            <div className="bg-kartu rounded-xl border border-white/10 w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-white/5 bg-kartu-hover flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm truncate">{baris.nama}</p>
                  <p className="text-[11px] text-gray-500">{tglPanjang(x.iso)}</p>
                </div>
                <button onClick={() => setDetailSel(null)} className="text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg shrink-0"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-4 h-4 rounded border ${getColorByStatus(x.status)}`}></span>
                  <span className="text-sm font-bold text-white">{labelStatus(x.status)}</span>
                </div>
                {att ? (
                  <div>
                    {baris1("Jam masuk", att.waktuMasuk || "-")}
                    {baris1("Jadwal masuk", baris.emp?.fleksibel === true ? "Fleksibel" : (baris.emp?.jamMasuk || "-"))}
                    {baris1("Jam pulang", att.waktuKeluar || (x.iso < todayISO ? "Lupa clock-out" : "Belum clock-out"), !att.waktuKeluar && x.iso < todayISO ? "text-red-400" : undefined)}
                    {att.jamPulangSeharusnya && baris1("Wajib pulang", att.jamPulangSeharusnya)}
                    {baris1("Status tercatat", att.status || "-")}
                    {att.mode_kerja && baris1("Mode kerja", att.mode_kerja)}
                    {att.lokasi && baris1("Lokasi", att.lokasi)}
                    {att.anomali_disetujui === true && baris1("Keterlambatan", "Sudah disetujui admin", "text-green-400")}
                  </div>
                ) : lv ? (
                  <div>
                    {baris1("Jenis", lv.jenis || "-")}
                    {baris1("Periode izin", lv.range ? (lv.range.start === lv.range.end ? tglPendek(lv.range.start) : `${tglPendek(lv.range.start)} – ${tglPendek(lv.range.end)}`) : (lv.tanggal || "-"))}
                    {baris1("Status", lv.status || "-", "text-green-400")}
                    <div className="mt-2 text-[12px] text-gray-300 italic whitespace-pre-wrap break-words">{lv.alasan ? `"${lv.alasan}"` : "Tidak ada keterangan."}</div>
                  </div>
                ) : (
                  <p className="text-[12px] text-gray-400 leading-relaxed">
                    {x.status === "Alpa" ? "Tidak ada catatan absen dan tidak ada izin yang disetujui untuk hari kerja ini."
                      : x.status === "Libur" ? "Akhir pekan — tidak dihitung hari kerja."
                      : x.iso > todayISO ? "Hari ini belum terjadi."
                      : x.iso === todayISO ? "Belum ada absen hari ini."
                      : "Belum bergabung pada tanggal ini."}
                  </p>
                )}
              </div>
              <div className="p-4 border-t border-white/5 bg-kartu-hover">
                <button onClick={() => setDetailSel(null)} className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors">Tutup</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
