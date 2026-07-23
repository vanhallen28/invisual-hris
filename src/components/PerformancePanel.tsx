"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";

const ASPEK = [
  { key: "kualitas", label: "Kualitas Kerja" },
  { key: "kedisiplinan", label: "Kedisiplinan" },
  { key: "kolaborasi", label: "Kolaborasi" },
  { key: "inisiatif", label: "Inisiatif" },
] as const;

function Stars({ value, onChange, readOnly }: any) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(n)}
          className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold transition-all ${n <= value ? "bg-primer text-white" : "bg-white/5 text-gray-600"} ${readOnly ? "cursor-default" : "hover:scale-110 active:scale-90"}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// Warna & label berdasarkan skor (0-100)
function grade(rate: number) {
  if (rate >= 95) return { label: "Sangat Baik", color: "#4ADE80", bg: "bg-green-500/10" };
  if (rate >= 85) return { label: "Baik", color: "#8ba7ff", bg: "bg-primer/10" };
  if (rate >= 70) return { label: "Cukup", color: "#F5A623", bg: "bg-yellow-500/10" };
  return { label: "Perlu Perhatian", color: "#f480b0", bg: "bg-magenta/10" };
}

export default function PerformancePanel({ idKaryawan, editable = false }: any) {
  const [perf, setPerf] = useState<any>(null);
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>({ kualitas: 4, kedisiplinan: 4, kolaborasi: 4, inisiatif: 4, catatan: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<any>(null);

  const load = async () => {
    if (!idKaryawan) { setLoading(false); return; }
    setLoading(true);
    try {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      const since = d.toISOString().split("T")[0];
      const { data: att } = await supabase
        .from("attendance")
        .select("status, tanggal")
        .eq("idKaryawan", idKaryawan)
        .gte("tanggal", since);
      const hadir = (att || []).length;
      const terlambat = (att || []).filter((a: any) => a.status === "Terlambat").length;
      const tepat = hadir - terlambat;
      const rate = hadir ? Math.round((tepat / hadir) * 100) : 0;
      setPerf({ hadir, terlambat, tepat, rate });

      const { data: rev } = await supabase
        .from("performance_reviews")
        .select("*")
        .eq("idKaryawan", idKaryawan)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (rev) {
        setReview(rev);
        if (editable) setForm({ kualitas: rev.kualitas ?? 4, kedisiplinan: rev.kedisiplinan ?? 4, kolaborasi: rev.kolaborasi ?? 4, inisiatif: rev.inisiatif ?? 4, catatan: rev.catatan || "" });
      }
    } catch {
      /* diamkan */
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [idKaryawan]); // eslint-disable-line

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      const reviewer = u?.user?.email || null;
      const periode = new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });
      const { error } = await supabase.from("performance_reviews").insert([{
        idKaryawan,
        periode,
        kualitas: form.kualitas,
        kedisiplinan: form.kedisiplinan,
        kolaborasi: form.kolaborasi,
        inisiatif: form.inisiatif,
        catatan: form.catatan || null,
        reviewer,
      }]);
      if (error) throw error;
      logAudit("Beri Penilaian Kinerja", idKaryawan);
      setMsg({ t: "ok", m: "Penilaian berhasil disimpan." });
      await load();
    } catch (e: any) {
      setMsg({ t: "err", m: "Gagal menyimpan: " + (e?.message || "coba lagi.") });
    }
    setSaving(false);
  };

  const avg = review ? (review.kualitas + review.kedisiplinan + review.kolaborasi + review.inisiatif) / 4 : null;
  const g = perf ? grade(perf.rate) : null;

  return (
    <div className="p-5 md:p-6 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-lg bg-primer/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-tint-redup"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
        </div>
        <h2 className="text-base md:text-lg font-bold text-white tracking-wide">Performa &amp; Penilaian Kinerja</h2>
      </div>

      {loading ? (
        <div className="py-10 flex justify-center"><img src="/logo.png" className="w-8 h-8 animate-spin object-contain" style={{ animationDuration: "3s" }} /></div>
      ) : (
        <div className="space-y-5">
          {/* PERFORMA 30 HARI */}
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Performa 30 Hari Terakhir</p>
            <div className="grid grid-cols-3 gap-2.5 mb-3">
              <div className="bg-kartu rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-white">{perf?.hadir ?? 0}</p>
                <p className="text-[9px] text-gray-500 mt-0.5 uppercase">Hadir</p>
              </div>
              <div className="bg-kartu rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-green-400">{perf?.tepat ?? 0}</p>
                <p className="text-[9px] text-gray-500 mt-0.5 uppercase">Tepat Waktu</p>
              </div>
              <div className="bg-kartu rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-magenta">{perf?.terlambat ?? 0}</p>
                <p className="text-[9px] text-gray-500 mt-0.5 uppercase">Terlambat</p>
              </div>
            </div>
            <div className={`${g?.bg} rounded-xl p-4 border border-white/5`}>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tingkat Ketepatan</p>
                  <p className="text-3xl font-black" style={{ color: g?.color }}>{perf?.rate ?? 0}%</p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ color: g?.color, backgroundColor: (g?.color || "#fff") + "22" }}>{g?.label}</span>
              </div>
              <div className="h-2 bg-black/30 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${perf?.rate ?? 0}%`, backgroundColor: g?.color }} />
              </div>
              {perf?.hadir === 0 && <p className="text-[10px] text-gray-600 mt-2">Belum ada data absensi dalam 30 hari terakhir.</p>}
            </div>
          </div>

          {/* PENILAIAN TERAKHIR */}
          <div className="border-t border-white/5 pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Penilaian Kualitatif</p>
              {avg !== null && <span className="text-xs font-bold text-tint-redup">Rata-rata {avg.toFixed(1)}/5</span>}
            </div>
            {review ? (
              <div className="space-y-2.5">
                {ASPEK.map((a) => (
                  <div key={a.key} className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">{a.label}</span>
                    <Stars value={review[a.key] || 0} readOnly />
                  </div>
                ))}
                {review.catatan && (
                  <div className="bg-kartu rounded-xl p-3 mt-3">
                    <p className="text-[10px] text-gray-500 uppercase mb-1">Catatan</p>
                    <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{review.catatan}</p>
                  </div>
                )}
                <p className="text-[10px] text-gray-600 mt-2">Periode {review.periode || "—"}{review.reviewer ? ` • oleh ${review.reviewer}` : ""}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-600 py-2">Belum ada penilaian kualitatif.</p>
            )}
          </div>

          {/* FORM PENILAIAN (admin) */}
          {editable && (
            <div className="border-t border-white/5 pt-5">
              <p className="text-[10px] font-black text-tint-redup uppercase tracking-widest mb-3">Beri / Perbarui Penilaian</p>
              <div className="space-y-3">
                {ASPEK.map((a) => (
                  <div key={a.key} className="flex items-center justify-between">
                    <span className="text-xs text-gray-300">{a.label}</span>
                    <Stars value={form[a.key]} onChange={(n: number) => setForm({ ...form, [a.key]: n })} />
                  </div>
                ))}
                <textarea rows={3} placeholder="Catatan / umpan balik (opsional)..." value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} className="w-full bg-kartu border border-white/10 rounded-xl p-3 text-xs text-white focus:border-primer outline-none resize-none placeholder-gray-600 transition-colors" />
                {msg && <p className={`text-xs px-3 py-2 rounded-lg ${msg.t === "ok" ? "text-emerald-300 bg-emerald-500/[0.07] border border-emerald-500/20" : "text-red-400 bg-red-500/[0.06] border border-red-500/20"}`}>{msg.m}</p>}
                <button onClick={save} disabled={saving} className="w-full bg-primer hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold py-2.5 rounded-lg transition-all active:scale-95">{saving ? "Menyimpan…" : "Simpan Penilaian"}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
