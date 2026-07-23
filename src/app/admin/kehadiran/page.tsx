// src/app/admin/kehadiran/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { saringTerlambat, fleksibelIds, terlambat } from "@/lib/keterlambatan";
import LeaveCalendar from "@/components/LeaveCalendar";
import { rapikanNama, namaResmi } from "@/lib/nama";
import { supabase } from "@/lib/supabase";
import { excludeOwners } from "@/lib/owners";

type StatusKehadiran = "Hadir" | "Telat" | "Alpa" | "Cuti/Sakit" | "WFH" | "Libur" | "-";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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

export default function AdminKehadiranPage() {
  const today = new Date();
  const todayISO = isoOf(today);
  const currentYM = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;

  const [selectedYM, setSelectedYM] = useState(currentYM);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [closingId, setClosingId] = useState<string | null>(null);

  // Pilihan bulan: 12 bulan terakhir
  const monthOptions = useMemo(() => {
    const out: { value: string; label: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      out.push({ value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: `${BULAN[d.getMonth()]} ${d.getFullYear()}` });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [empRes, attRes, apprRes] = await Promise.all([
        supabase.from("employees").select("*").order("nama", { ascending: true }),
        supabase.from("attendance").select("*").like("tanggal", `${selectedYM}%`),
        supabase.from("approvals").select("*").eq("status", "Disetujui"),
      ]);
      // Owner dikecualikan dari statistik operasional
      setEmployees(excludeOwners((empRes.data || []).filter((e: any) => e.isAktif !== false)));
      setAttendance(attRes.data || []);
      setLeaves(
        (apprRes.data || [])
          .map((l: any) => ({ ...l, range: parseRange(l.tanggal) }))
          .filter((l: any) => l.range),
      );
    } catch {
      /* diamkan — tampilkan keadaan kosong */
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYM]);

  const [yearStr, monthStr] = selectedYM.split("-");
  const year = Number(yearStr);
  const monthIdx = Number(monthStr) - 1;
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  // ── HEATMAP dari data nyata ──
  const heatmapData = useMemo(() => {
    const fleks = fleksibelIds(employees);
    // index absensi: "idKaryawan|tanggal" → baris
    const attIndex: Record<string, any> = {};
    attendance.forEach((a) => { attIndex[`${a.idKaryawan}|${a.tanggal}`] = a; });

    return employees.map((emp) => {
      const joined = emp.tanggalBergabung ? String(emp.tanggalBergabung).slice(0, 10) : null;
      const empLeaves = leaves.filter((l) => l.idKaryawan === emp.idKaryawan && l.jenis !== "Izin Terlambat");

      const dataHarian: StatusKehadiran[] = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, monthIdx, d);
        const iso = isoOf(dateObj);
        const dow = dateObj.getDay();

        if (joined && iso < joined) { dataHarian.push("-"); continue; }           // belum bergabung
        const att = attIndex[`${emp.idKaryawan}|${iso}`];
        if (att) { dataHarian.push(terlambat(att, fleks) ? "Telat" : "Hadir"); continue; }
        const leave = empLeaves.find((l) => iso >= l.range.start && iso <= l.range.end);
        if (leave) { dataHarian.push(kindOf(leave.jenis)); continue; }
        if (dow === 0 || dow === 6) { dataHarian.push("Libur"); continue; }       // akhir pekan
        dataHarian.push(iso < todayISO ? "Alpa" : "-");                           // hari depan dibiarkan kosong
      }

      return { id: emp.idKaryawan, nama: rapikanNama(emp.nama), divisi: emp.jabatan || emp.organisasi || "-", dataHarian };
    });
  }, [employees, attendance, leaves, year, monthIdx, daysInMonth, todayISO]);

  // ── RINGKASAN BULAN INI ──
  const summary = useMemo(() => {
    const s = { hadir: 0, telat: 0, izin: 0, alpa: 0 };
    heatmapData.forEach((row) =>
      row.dataHarian.forEach((st) => {
        if (st === "Hadir") s.hadir++;
        else if (st === "Telat") s.telat++;
        else if (st === "Cuti/Sakit" || st === "WFH") s.izin++;
        else if (st === "Alpa") s.alpa++;
      }),
    );
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

  const monthLabel = `${BULAN[monthIdx]} ${year}`;

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

      {/* RINGKASAN BULAN */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Hadir Tepat Waktu", value: summary.hadir, color: "text-green-400", bar: "bg-green-500" },
          { label: "Terlambat", value: summary.telat, color: "text-yellow-400", bar: "bg-yellow-500" },
          { label: "Izin / Cuti / WFH", value: summary.izin, color: "text-purple-400", bar: "bg-purple-500" },
          { label: "Alpa", value: summary.alpa, color: "text-red-400", bar: "bg-red-500" },
        ].map((s) => (
          <div key={s.label} className="p-5 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
            <div className={`absolute left-0 top-0 h-full w-1 ${s.bar}`} />
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{isLoading ? "–" : s.value}<span className="text-xs text-gray-600 font-bold ml-1">hari</span></p>
          </div>
        ))}
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

      {/* TIMESHEET HEATMAP — data nyata */}
      <div className="flex flex-col overflow-hidden relative rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
        <div className="p-6 border-b border-white/5 bg-kartu-hover flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h2 className="font-bold text-white text-lg">Timesheet Heatmap</h2><p className="text-xs text-gray-400 mt-1">Matriks kehadiran harian — {monthLabel}.</p></div>
          <div className="flex flex-wrap gap-3 md:gap-4 bg-latar p-3 rounded-xl border border-white/10">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Hadir</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Telat</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">WFH/WFC</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Cuti/Sakit</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Alpa</span></div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar pb-4">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-latar border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-semibold text-xs text-gray-400 uppercase tracking-widest sticky left-0 bg-latar z-20 shadow-[5px_0_10px_rgba(0,0,0,0.3)] w-64 border-r border-white/5">Karyawan</th>
                {Array.from({ length: daysInMonth }).map((_, i) => (
                  <th key={i} className="px-2 py-4 font-semibold text-[10px] text-gray-500 text-center border-l border-white/5">{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading ? (
                <tr><td colSpan={daysInMonth + 1} className="px-6 py-10 text-center text-gray-500">Memuat data absensi…</td></tr>
              ) : heatmapData.length === 0 ? (
                <tr><td colSpan={daysInMonth + 1} className="px-6 py-10 text-center text-gray-500">Belum ada data karyawan aktif.</td></tr>
              ) : (
                heatmapData.map((emp) => (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 sticky left-0 bg-kartu z-10 shadow-[5px_0_10px_rgba(0,0,0,0.3)] border-r border-white/5">
                      <p className="font-bold text-white text-sm truncate max-w-[200px]">{emp.nama}</p>
                      <p className="text-[10px] text-gray-500">{emp.divisi}</p>
                    </td>
                    {emp.dataHarian.map((status: StatusKehadiran, index: number) => (
                      <td key={index} className="px-1 py-4 text-center border-l border-white/5 border-dashed">
                        <div title={`${index + 1} ${BULAN[monthIdx]} — ${status === "-" ? "Tidak ada data" : status}`} className={`w-6 h-6 md:w-7 md:h-7 mx-auto rounded border opacity-90 hover:opacity-100 hover:scale-110 transition-all cursor-crosshair ${getColorByStatus(status)}`}></div>
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
