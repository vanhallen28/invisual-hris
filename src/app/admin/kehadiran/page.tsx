// src/app/admin/kehadiran/page.tsx
"use client";

import { useState, useEffect } from "react";

type StatusKehadiran = "Hadir" | "Telat" | "Alpa" | "Cuti/Sakit" | "WFH" | "Libur";

export default function AdminKehadiranPage() {
  const [selectedMonth, setSelectedMonth] = useState("Juni 2026");
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any>({ lupaClockOut: [], seringTelat: [], palingDisiplin: [] });

  // Fungsi pembantu pembuatan pola heatmap acak
  const generateBulan = (pola: StatusKehadiran[]): StatusKehadiran[] => {
    let hari: StatusKehadiran[] = [];
    for (let i = 1; i <= 30; i++) {
      if (i % 7 === 0 || i % 7 === 6) hari.push("Libur"); 
      else hari.push(pola[i % pola.length]);
    }
    return hari;
  };

  useEffect(() => {
    // MEMANGGIL MASTER DATABASE KARYAWAN
    const savedDatabase = localStorage.getItem("invisualEmployeeDB");
    if (savedDatabase) {
      const parsedData = JSON.parse(savedDatabase);
      const activeEmps = parsedData.filter((emp: any) => emp.isAktif !== false);

      // Generate Baris Heatmap berdasarkan karyawan asli
      const dynamicHeatmap = activeEmps.map((emp: any) => {
        // Beri variasi absensi secara acak agar visualnya terlihat hidup
        const polaAcak = Math.random() > 0.7 
          ? ["Hadir", "Hadir", "Telat", "Hadir", "Hadir"] 
          : Math.random() > 0.8 
          ? ["WFH", "WFH", "Hadir", "Cuti/Sakit", "Hadir"]
          : ["Hadir", "Hadir", "Hadir", "Hadir", "Hadir"];
          
        return {
          id: emp.idKaryawan,
          nama: emp.nama,
          divisi: emp.organisasi || emp.jabatan || "-",
          dataHarian: generateBulan(polaAcak)
        };
      });
      setHeatmapData(dynamicHeatmap);

      // Mengisi widget anomali dengan nama asli dari database
      if (activeEmps.length > 2) {
        setAnomalies({
          lupaClockOut: [{ nama: activeEmps[0].nama, tanggal: "Kemarin", jamMasuk: "08:50" }],
          seringTelat: [{ nama: activeEmps[1].nama, totalTelat: 4, tren: "Meningkat" }],
          palingDisiplin: [{ nama: activeEmps[2].nama, rekor: "100% Tepat Waktu" }]
        });
      }
    }
  }, []);

  const getColorByStatus = (status: StatusKehadiran) => {
    switch (status) {
      case "Hadir": return "bg-green-500 hover:bg-green-400 border-green-600";
      case "Telat": return "bg-yellow-500 hover:bg-yellow-400 border-yellow-600";
      case "Alpa": return "bg-red-500 hover:bg-red-400 border-red-600 animate-pulse";
      case "Cuti/Sakit": return "bg-purple-500 hover:bg-purple-400 border-purple-600";
      case "WFH": return "bg-blue-500 hover:bg-blue-400 border-blue-600";
      case "Libur": return "bg-white/5 border-white/10";
      default: return "bg-gray-800 border-gray-700";
    }
  };

  return (
    <div className="max-w-[1400px] w-full flex flex-col gap-8 pb-10">
      
      {/* HEADER HALAMAN */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Manajemen Kehadiran</h1>
          <p className="text-gray-400 text-sm">Pusat analitik dan pelacakan kedisiplinan karyawan Invisual Studio.</p>
        </div>
        <select 
          value={selectedMonth} 
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-[#1c1c1c] border border-white/10 rounded-xl px-5 py-3 text-sm text-white focus:outline-none focus:border-[#2b5cd5] font-bold shadow-lg cursor-pointer"
        >
          <option value="Juni 2026">Juni 2026</option>
          <option value="Mei 2026">Mei 2026</option>
        </select>
      </div>

      {/* FITUR 1: SMART ANOMALY CENTER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="bg-[#141414] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-yellow-500/30 transition-all">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl"></div>
          <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4 relative z-10">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2.25V15m0 0l-3-3m3 3l3-3m-3 3V12M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div><h2 className="font-bold text-white text-sm">Sering Terlambat</h2><p className="text-[10px] text-gray-400 uppercase tracking-widest">Peringatan</p></div>
          </div>
          <div className="space-y-3 relative z-10">
            {anomalies.seringTelat.map((emp:any, idx:number) => (
              <div key={idx} className="flex justify-between items-center bg-[#1a1a1a] p-3 rounded-xl border border-white/5">
                <span className="text-sm font-semibold text-gray-200">{emp.nama}</span>
                <span className="bg-yellow-500/20 text-yellow-400 text-xs font-bold px-2 py-1 rounded border border-yellow-500/20">{emp.totalTelat}x Telat</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#141414] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-red-500/30 transition-all">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-red-500/10 rounded-full blur-3xl"></div>
          <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4 relative z-10">
            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <div><h2 className="font-bold text-white text-sm">Lupa Clock-Out</h2><p className="text-[10px] text-gray-400 uppercase tracking-widest">Tindakan</p></div>
          </div>
          <div className="space-y-3 relative z-10">
            {anomalies.lupaClockOut.map((emp:any, idx:number) => (
              <div key={idx} className="flex justify-between items-center bg-[#1a1a1a] p-3 rounded-xl border border-white/5">
                <div><span className="text-sm font-semibold text-gray-200 block">{emp.nama}</span><span className="text-[10px] text-gray-500">Masuk: {emp.jamMasuk}</span></div>
                <button className="text-[10px] font-bold text-[#2b5cd5] hover:text-white bg-[#2b5cd5]/10 hover:bg-[#2b5cd5] px-3 py-1.5 rounded transition-colors">Tutup Sesi</button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#141414] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:border-green-500/30 transition-all">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-green-500/10 rounded-full blur-3xl"></div>
          <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4 relative z-10">
            <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>
            </div>
            <div><h2 className="font-bold text-white text-sm">Paling Disiplin</h2><p className="text-[10px] text-gray-400 uppercase tracking-widest">Apresiasi</p></div>
          </div>
          <div className="space-y-3 relative z-10">
            {anomalies.palingDisiplin.map((emp:any, idx:number) => (
              <div key={idx} className="flex justify-between items-center bg-[#1a1a1a] p-3 rounded-xl border border-white/5">
                <span className="text-sm font-semibold text-gray-200">{emp.nama}</span>
                <span className="bg-green-500/20 text-green-400 text-xs font-bold px-2 py-1 rounded border border-green-500/20">{emp.rekor}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* FITUR 2: TIMESHEET HEATMAP */}
      <div className="bg-[#141414] border border-white/5 rounded-3xl shadow-2xl flex flex-col overflow-hidden relative">
        <div className="p-6 border-b border-white/5 bg-[#1a1a1a] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div><h2 className="font-bold text-white text-lg">Timesheet Heatmap</h2><p className="text-xs text-gray-400 mt-1">Matriks kehadiran visual per karyawan dari Master Database.</p></div>
          <div className="flex flex-wrap gap-3 md:gap-4 bg-[#0a0a0a] p-3 rounded-xl border border-white/5">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Hadir</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-yellow-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Telat</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">WFH/WFC</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-purple-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Cuti/Sakit</span></div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase">Alpa</span></div>
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar pb-4">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-[#0f0f0f] border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-semibold text-xs text-gray-400 uppercase tracking-widest sticky left-0 bg-[#0f0f0f] z-20 shadow-[5px_0_10px_rgba(0,0,0,0.3)] w-64 border-r border-white/5">Karyawan</th>
                {Array.from({ length: 30 }).map((_, i) => (
                  <th key={i} className="px-2 py-4 font-semibold text-[10px] text-gray-500 text-center border-l border-white/5">{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {heatmapData.length === 0 ? (
                 <tr><td colSpan={31} className="px-6 py-10 text-center text-gray-500">Belum ada data karyawan. Tambahkan di menu Data Karyawan.</td></tr>
              ) : (
                heatmapData.map((emp) => (
                  <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4 sticky left-0 bg-[#141414] z-10 shadow-[5px_0_10px_rgba(0,0,0,0.3)] border-r border-white/5">
                      <p className="font-bold text-white text-sm truncate max-w-[200px]">{emp.nama}</p>
                      <p className="text-[10px] text-gray-500">{emp.divisi}</p>
                    </td>
                    {emp.dataHarian.map((status: StatusKehadiran, index: number) => (
                      <td key={index} className="px-1 py-4 text-center border-l border-white/5 border-dashed">
                        <div title={`Tgl ${index + 1} - ${status}`} className={`w-6 h-6 md:w-7 md:h-7 mx-auto rounded border opacity-90 hover:opacity-100 hover:scale-110 transition-all cursor-crosshair ${getColorByStatus(status)}`}></div>
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