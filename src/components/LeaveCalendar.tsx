"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { rapikanNama } from "@/lib/nama";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// Ambil rentang tanggal dari string approvals ("2025-07-16" atau "2025-07-16 s/d 2025-07-20").
function parseRange(t: string) {
  const dates = String(t || "").match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (!dates.length) return null;
  return { start: dates[0], end: dates.length > 1 ? dates[1] : dates[0] };
}
function statusColor(s: string) {
  if (s === "Disetujui") return { bg: "bg-green-500/15", t: "text-green-300", dot: "#4ADE80" };
  return { bg: "bg-yellow-500/15", t: "text-yellow-300", dot: "#F5A623" }; // Menunggu
}

export default function LeaveCalendar() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [daftarBuka, setDaftarBuka] = useState(true);   // dropdown Daftar Cuti/Izin
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("approvals").select("*").in("status", ["Disetujui", "Menunggu"]).neq("jenis", "Izin Terlambat").order("id", { ascending: false });
        setLeaves((data || []).map((l: any) => ({ ...l, range: parseRange(l.tanggal) })).filter((l: any) => l.range));
      } catch { /* diamkan */ }
      setLoading(false);
    })();
  }, []);

  const cells = useMemo(() => {
    const startDow = new Date(ym.y, ym.m, 1).getDay();
    const days = new Date(ym.y, ym.m + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [ym]);

  const iso = (d: number) => `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const leavesOn = (d: number) => { const day = iso(d); return leaves.filter((l) => day >= l.range.start && day <= l.range.end); };

  const monthStart = iso(1);
  const monthEnd = iso(new Date(ym.y, ym.m + 1, 0).getDate());
  const monthLeaves = leaves
    .filter((l) => l.range.start <= monthEnd && l.range.end >= monthStart)
    .sort((a, b) => a.range.start.localeCompare(b.range.start));

  const prev = () => setYm((p) => (p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 }));
  const next = () => setYm((p) => (p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 }));
  const goToday = () => setYm({ y: today.getFullYear(), m: today.getMonth() });

  const btn = "w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center transition-all active:scale-90";

  return (
    <div className="p-5 md:p-6 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primer/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-tint-redup"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-white">Kalender Cuti &amp; Izin</h2>
            <p className="text-[11px] text-gray-500">Pantau cuti karyawan bulan ini &amp; yang akan datang</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={prev} className={btn} title="Bulan sebelumnya"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
          <span className="text-sm font-bold text-white min-w-[120px] text-center">{BULAN[ym.m]} {ym.y}</span>
          <button onClick={next} className={btn} title="Bulan berikutnya"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
          <button onClick={goToday} className="ml-1 px-3 h-8 rounded-lg bg-primer/10 hover:bg-primer/20 text-tint-redup text-xs font-bold transition-all active:scale-95 border border-primer/20">Hari Ini</button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><img src="/logo.png" className="w-9 h-9 animate-spin object-contain" style={{ animationDuration: "3s" }} /></div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 md:gap-1.5">
            {HARI.map((h) => (
              <div key={h} className="text-center text-[9px] md:text-[10px] font-bold text-gray-500 uppercase py-1">{h}</div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={i} className="min-h-[52px] md:min-h-[84px]" />;
              const day = iso(d);
              const list = leavesOn(d);
              const isToday = day === todayISO;
              return (
                <div key={i} className={`rounded-lg border p-1 md:p-1.5 min-h-[52px] md:min-h-[84px] overflow-hidden ${isToday ? "border-primer bg-primer/5" : "border-white/5 bg-kartu"}`}>
                  <div className={`text-[10px] md:text-xs font-bold mb-1 ${isToday ? "text-tint-redup" : "text-gray-400"}`}>{d}</div>
                  <div className="space-y-0.5">
                    {list.slice(0, 3).map((l, j) => {
                      const sc = statusColor(l.status);
                      return (
                        <div key={j} className={`text-[8px] md:text-[9px] font-bold px-1 py-0.5 rounded ${sc.bg} ${sc.t} truncate`} title={`${rapikanNama(l.nama)} — ${l.jenis} (${l.status})`}>
                          {rapikanNama(l.nama).split(" ")[0] || "?"}
                        </div>
                      );
                    })}
                    {list.length > 3 && <div className="text-[8px] text-gray-500 px-1">+{list.length - 3} lagi</div>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />Disetujui</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />Menunggu</span>
          </div>

          <div className="mt-5 border-t border-white/5 pt-4">
            <button
              onClick={() => setDaftarBuka((v) => !v)}
              aria-expanded={daftarBuka}
              className="w-full flex items-center gap-2 mb-3 group/dd cursor-pointer text-left"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth={3} stroke="currentColor"
                className={`w-3 h-3 text-gray-500 transition-transform duration-200 ${daftarBuka ? "rotate-90" : ""}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span className="text-[10px] font-black text-gray-500 group-hover/dd:text-gray-300 uppercase tracking-widest transition-colors">
                Daftar Cuti/Izin — {BULAN[ym.m]} {ym.y}
              </span>
              <span className="ml-auto text-[10px] font-bold text-tint-redup bg-primer/10 border border-primer/20 px-2 py-0.5 rounded-full">
                {monthLeaves.length}
              </span>
            </button>
            {!daftarBuka ? null : monthLeaves.length === 0 ? (
              <p className="text-xs text-gray-600 py-2">Tak ada pengajuan cuti/izin pada bulan ini.</p>
            ) : (
              <div className="space-y-2">
                {monthLeaves.map((l, i) => {
                  const sc = statusColor(l.status);
                  return (
                    <div key={i} className="flex items-center gap-3 bg-kartu border border-white/10 rounded-xl p-2.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc.dot }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{rapikanNama(l.nama)} <span className="text-[10px] font-normal text-gray-500">· {l.jenis}</span></p>
                        <p className="text-[10px] text-gray-500 truncate">{l.tanggal}{l.alasan ? ` — ${l.alasan}` : ""}</p>
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${sc.bg} ${sc.t} shrink-0`}>{l.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
