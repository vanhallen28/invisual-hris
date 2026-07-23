"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Warna aksen berdasarkan jenis aksi
function tone(action: string) {
  const a = (action || "").toLowerCase();
  if (a.includes("hapus")) return { c: "#f87171", bg: "bg-red-500/10", b: "border-red-500/20" };
  if (a.includes("blast")) return { c: "#f480b0", bg: "bg-magenta/10", b: "border-magenta/20" };
  if (a.includes("setujui")) return { c: "#4ADE80", bg: "bg-green-500/10", b: "border-green-500/20" };
  if (a.includes("tolak")) return { c: "#F5A623", bg: "bg-yellow-500/10", b: "border-yellow-500/20" };
  if (a.includes("penilaian")) return { c: "#c084fc", bg: "bg-purple-500/10", b: "border-purple-500/20" };
  return { c: "#8ba7ff", bg: "bg-primer/10", b: "border-primer/20" };
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(300);
        setLogs(data || []);
      } catch { /* diamkan */ }
      setLoading(false);
    })();
  }, []);

  const filtered = logs.filter((l) => {
    const s = q.trim().toLowerCase();
    return !s || [l.actor, l.action, l.target, l.detail].some((v) => String(v || "").toLowerCase().includes(s));
  });

  const fmt = (ts: string) => {
    try { return new Date(ts).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return ts; }
  };

  return (
    <div className="w-full flex flex-col gap-5 pb-28 md:pb-10 font-sans">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Log Aktivitas</h1>
        <p className="text-sm text-gray-500 mt-1">Catatan aksi sensitif admin — siapa, apa, dan kapan. Menampilkan 300 aktivitas terbaru.</p>
      </div>

      <div className="relative">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama admin, aksi, atau target…" className="w-full bg-latar border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-primer outline-none placeholder-gray-600 transition-colors" />
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><img src="/logo.png" className="w-9 h-9 animate-spin object-contain" style={{ animationDuration: "3s" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-500 text-sm relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
          {logs.length === 0 ? "Belum ada aktivitas tercatat." : "Tak ada hasil untuk pencarian itu."}
        </div>
      ) : (
        <div className="flex flex-col gap-2 mo-stagger">
          {filtered.map((l) => {
            const t = tone(l.action);
            return (
              <div key={l.id} className="p-3.5 flex items-start gap-3 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
                <div className={`w-9 h-9 rounded-lg ${t.bg} border ${t.b} flex items-center justify-center shrink-0`}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.c }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                    <span className="text-sm font-bold" style={{ color: t.c }}>{l.action}</span>
                    {l.target && <span className="text-xs text-gray-400 truncate">→ {l.target}</span>}
                  </div>
                  {l.detail && <p className="text-[11px] text-gray-500 mt-0.5 truncate">{l.detail}</p>}
                  <p className="text-[11px] text-gray-600 mt-1 font-mono truncate">{l.actor}</p>
                </div>
                <span className="text-[10px] text-gray-600 whitespace-nowrap shrink-0 mt-0.5">{fmt(l.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
