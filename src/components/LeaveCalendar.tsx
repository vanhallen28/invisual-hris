"use client";
// Kalender Cuti & Izin (halaman Kehadiran admin).
// • Klik tanggal → semua cuti/izin/WFH pada hari itu
// • Klik nama (di kalender maupun daftar) → rincian pengajuan
// • Pengajuan "Menunggu" bisa langsung disetujui / ditolak dari sini
//   (efek sama dengan tombol di Dashboard: status, notifikasi, audit log)
// • Saring per status (klik legenda) & per jenis
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase";
import { rapikanNama } from "@/lib/nama";
import { useToast } from "@/components/Toast";
import { putuskanPengajuan } from "@/lib/keputusanIzin";
import AvatarKaryawan from "@/components/AvatarKaryawan";

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const HARI_PANJANG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

const pad = (n: number) => String(n).padStart(2, "0");
const dariIso = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y || 1970, (m || 1) - 1, d || 1); };
const tglPanjang = (iso: string) => { const d = dariIso(iso); return `${HARI_PANJANG[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
const tglPendek = (iso: string) => { const d = dariIso(iso); return `${d.getDate()} ${BULAN[d.getMonth()]!.slice(0, 3)} ${d.getFullYear()}`; };
const utc = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return Date.UTC(y || 1970, (m || 1) - 1, d || 1); };
const lamaHari = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 86400000) + 1;

// Ambil rentang tanggal dari string approvals ("2025-07-16" atau "2025-07-16 s/d 2025-07-20").
function parseRange(t: string) {
  const dates = String(t || "").match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (!dates.length) return null;
  return { start: dates[0]!, end: dates.length > 1 ? dates[1]! : dates[0]! };
}
function statusColor(s: string) {
  if (s === "Disetujui") return { bg: "bg-green-500/15", t: "text-green-300", dot: "#4ADE80" };
  return { bg: "bg-yellow-500/15", t: "text-yellow-300", dot: "#F5A623" }; // Menunggu
}

type Kategori = "cuti" | "sakit" | "izin" | "remote";
const KATEGORI: Record<Kategori, { label: string; dot: string }> = {
  cuti: { label: "Cuti", dot: "bg-purple-400" },
  sakit: { label: "Sakit", dot: "bg-red-400" },
  izin: { label: "Izin", dot: "bg-orange-400" },
  remote: { label: "WFH/WFC", dot: "bg-blue-400" },
};
function kategoriDari(jenis: string): Kategori {
  const j = String(jenis || "");
  if (/WFH|WFC|Work\s*From/i.test(j)) return "remote";
  if (/sakit/i.test(j)) return "sakit";
  if (/cuti/i.test(j)) return "cuti";
  return "izin";
}
// id pengajuan dari aplikasi = "req-<milidetik>" → tanggal diajukan
function waktuDiajukan(id: any): string | null {
  const m = String(id || "").match(/^req-(\d{12,14})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]));
  if (isNaN(d.getTime())) return null;
  return `${d.getDate()} ${BULAN[d.getMonth()]!.slice(0, 3)} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Ambil semua baris dengan paginasi ber-ORDER (hindari batas 1000 baris Supabase).
async function ambilSemuaPengajuan(): Promise<any[]> {
  const semua: any[] = [];
  for (let dari = 0, put = 0; put < 50; put++, dari += 1000) {
    const { data, error } = await supabase
      .from("approvals").select("*")
      .in("status", ["Disetujui", "Menunggu"]).neq("jenis", "Izin Terlambat")
      .order("id", { ascending: true }).range(dari, dari + 999);
    if (error) throw error;
    semua.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return semua;
}

export default function LeaveCalendar({ onBerubah }: { onBerubah?: () => void } = {}) {
  const toast = useToast();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [galat, setGalat] = useState("");
  const [daftarBuka, setDaftarBuka] = useState(true);   // dropdown Daftar Cuti/Izin
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const [ym, setYm] = useState({ y: today.getFullYear(), m: today.getMonth() });
  // Saringan: status (klik legenda) & jenis
  const [tampilStatus, setTampilStatus] = useState<{ Disetujui: boolean; Menunggu: boolean }>({ Disetujui: true, Menunggu: true });
  const [jenisDipilih, setJenisDipilih] = useState<Kategori | "semua">("semua");
  // Jendela: rincian tanggal & rincian satu pengajuan
  const [hariDipilih, setHariDipilih] = useState<string | null>(null);
  const [rincianId, setRincianId] = useState<any>(null);
  const [memproses, setMemproses] = useState<any>(null);

  const muat = useCallback(async () => {
    setGalat("");
    try {
      const data = await ambilSemuaPengajuan();
      setLeaves(data.map((l: any) => ({ ...l, range: parseRange(l.tanggal), kat: kategoriDari(l.jenis) })).filter((l: any) => l.range));
    } catch (e: any) {
      setGalat(e?.message || "Gagal memuat kalender cuti.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { muat(); }, [muat]);

  // Escape: tutup rincian dulu, lalu jendela tanggal
  useEffect(() => {
    if (!hariDipilih && rincianId == null) return;
    const t = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (rincianId != null) setRincianId(null); else setHariDipilih(null);
    };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, [hariDipilih, rincianId]);

  const tersaring = useMemo(
    () => leaves.filter((l) => (l.status === "Disetujui" ? tampilStatus.Disetujui : tampilStatus.Menunggu) && (jenisDipilih === "semua" || l.kat === jenisDipilih)),
    [leaves, tampilStatus, jenisDipilih],
  );

  const cells = useMemo(() => {
    const startDow = new Date(ym.y, ym.m, 1).getDay();
    const days = new Date(ym.y, ym.m + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) arr.push(null);
    for (let d = 1; d <= days; d++) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [ym]);

  const iso = (d: number) => `${ym.y}-${pad(ym.m + 1)}-${pad(d)}`;
  const padaHari = (day: string) => tersaring.filter((l) => day >= l.range.start && day <= l.range.end);
  const leavesOn = (d: number) => padaHari(iso(d));

  const monthStart = iso(1);
  const monthEnd = iso(new Date(ym.y, ym.m + 1, 0).getDate());
  const monthLeaves = tersaring
    .filter((l) => l.range.start <= monthEnd && l.range.end >= monthStart)
    .sort((a, b) => a.range.start.localeCompare(b.range.start));
  const jumlahMenunggu = monthLeaves.filter((l) => l.status !== "Disetujui").length;

  const prev = () => setYm((p) => (p.m === 0 ? { y: p.y - 1, m: 11 } : { y: p.y, m: p.m - 1 }));
  const next = () => setYm((p) => (p.m === 11 ? { y: p.y + 1, m: 0 } : { y: p.y, m: p.m + 1 }));
  const goToday = () => setYm({ y: today.getFullYear(), m: today.getMonth() });

  const putuskan = async (l: any, action: "Disetujui" | "Ditolak") => {
    if (action === "Ditolak") {
      const ya = await toast.konfirmasi(`Tolak pengajuan ${l.jenis} dari ${rapikanNama(l.nama)}?`, { labelYa: "Tolak" });
      if (!ya) return;
    }
    setMemproses(l.id);
    try {
      await putuskanPengajuan(supabase, l, action);
      toast.sukses(`Pengajuan ${rapikanNama(l.nama)} ${action === "Disetujui" ? "disetujui" : "ditolak"}.`);
      if (action === "Ditolak" && rincianId === l.id) setRincianId(null);
      await muat();
      onBerubah?.();   // segarkan kartu & heatmap halaman Kehadiran
    } catch (e: any) {
      toast.gagal("Gagal memperbarui status: " + (e?.message || e));
    }
    setMemproses(null);
  };

  const btn = "w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 flex items-center justify-center transition-all active:scale-90";
  const rincian = rincianId != null ? leaves.find((l) => l.id === rincianId) || null : null;
  const daftarHari = hariDipilih ? padaHari(hariDipilih) : [];

  const tombolKeputusan = (l: any, kecil = false) => l.status === "Disetujui" ? null : (
    <div className={`flex gap-1.5 ${kecil ? "" : "mt-3"}`}>
      <button type="button" disabled={memproses === l.id} onClick={(e) => { e.stopPropagation(); putuskan(l, "Disetujui"); }}
        className={`${kecil ? "px-2.5 py-1 text-[11px]" : "flex-1 py-2.5 text-xs"} font-bold rounded-lg bg-green-600 hover:bg-green-500 text-white disabled:opacity-50`}>
        {memproses === l.id ? "…" : "Setujui"}
      </button>
      <button type="button" disabled={memproses === l.id} onClick={(e) => { e.stopPropagation(); putuskan(l, "Ditolak"); }}
        className={`${kecil ? "px-2.5 py-1 text-[11px]" : "flex-1 py-2.5 text-xs"} font-bold rounded-lg bg-white/5 hover:bg-red-500/80 text-gray-300 hover:text-white border border-white/10 disabled:opacity-50`}>
        Tolak
      </button>
    </div>
  );

  const chipJenis = (kat: Kategori) => (
    <span className="inline-flex items-center gap-1 text-[11px] text-gray-400"><span className={`w-1.5 h-1.5 rounded-full ${KATEGORI[kat].dot}`} />{KATEGORI[kat].label}</span>
  );

  return (
    <div className="p-5 md:p-6 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primer/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-tint-redup"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
          </div>
          <div>
            <h2 className="text-base md:text-lg font-bold text-white">Kalender Cuti &amp; Izin</h2>
            <p className="text-[11px] text-gray-500">Klik tanggal atau nama untuk melihat rincian &amp; menyetujui pengajuan</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={prev} className={btn} title="Bulan sebelumnya"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg></button>
          <span className="text-sm font-bold text-white min-w-[120px] text-center">{BULAN[ym.m]} {ym.y}</span>
          <button onClick={next} className={btn} title="Bulan berikutnya"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg></button>
          <button onClick={goToday} className="ml-1 px-3 h-8 rounded-lg bg-primer/10 hover:bg-primer/20 text-tint-redup text-xs font-bold transition-all active:scale-95 border border-primer/20">Hari Ini</button>
        </div>
      </div>

      {/* Saringan jenis */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(["semua", "cuti", "sakit", "izin", "remote"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setJenisDipilih(k)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${jenisDipilih === k ? "bg-primer text-white border-primer" : "bg-white/[0.03] text-gray-400 border-white/10 hover:text-white hover:border-white/20"}`}>
            {k !== "semua" && <span className={`w-1.5 h-1.5 rounded-full ${KATEGORI[k].dot}`} />}
            {k === "semua" ? "Semua jenis" : KATEGORI[k].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><img src="/logo.png" alt="" className="w-9 h-9 animate-spin object-contain" style={{ animationDuration: "3s" }} /></div>
      ) : galat ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300">Gagal memuat: {galat}</p>
          <button onClick={() => { setLoading(true); muat(); }} className="shrink-0 text-xs font-bold text-white bg-red-500/80 hover:bg-red-500 px-3 py-1.5 rounded-lg">Coba lagi</button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 gap-1 md:gap-1.5">
            {HARI.map((h, i) => (
              <div key={h} className={`text-center text-[10px] md:text-[11px] font-bold uppercase py-1 ${i === 0 || i === 6 ? "text-gray-600" : "text-gray-500"}`}>{h}</div>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <div key={i} className="min-h-[52px] md:min-h-[84px]" />;
              const day = iso(d);
              const list = leavesOn(d);
              const isToday = day === todayISO;
              const akhirPekan = i % 7 === 0 || i % 7 === 6;
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  aria-label={`${tglPanjang(day)} — ${list.length} cuti/izin`}
                  onClick={() => setHariDipilih(day)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHariDipilih(day); } }}
                  className={`rounded-lg border p-1 md:p-1.5 min-h-[52px] md:min-h-[84px] overflow-hidden cursor-pointer transition-colors hover:border-primer-terang/60 focus:outline-none focus:ring-2 focus:ring-primer-terang ${isToday ? "border-primer bg-primer/5" : akhirPekan ? "border-white/5 bg-white/[0.015]" : "border-white/5 bg-kartu"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] md:text-xs font-bold ${isToday ? "text-tint-redup" : akhirPekan ? "text-gray-600" : "text-gray-400"}`}>{d}</span>
                    {list.length > 0 && <span className="md:hidden text-[10px] font-bold text-tint-redup">{list.length}</span>}
                  </div>
                  <div className="space-y-0.5 hidden md:block">
                    {list.slice(0, 3).map((l, j) => {
                      const sc = statusColor(l.status);
                      return (
                        <button
                          key={j}
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setRincianId(l.id); }}
                          className={`w-full flex items-center gap-1 text-left text-[10px] font-bold px-1 py-0.5 rounded ${sc.bg} ${sc.t} truncate hover:brightness-125`}
                          title={`${rapikanNama(l.nama)} — ${l.jenis} (${l.status})`}
                        >
                          <span className={`w-1 h-1 rounded-full shrink-0 ${KATEGORI[l.kat as Kategori].dot}`} />
                          <span className="truncate">{rapikanNama(l.nama).split(" ")[0] || "?"}</span>
                        </button>
                      );
                    })}
                    {list.length > 3 && <div className="text-[10px] text-gray-500 px-1">+{list.length - 3} lagi</div>}
                  </div>
                  {/* ponsel: titik saja agar muat */}
                  <div className="flex flex-wrap gap-0.5 md:hidden">
                    {list.slice(0, 6).map((l, j) => <span key={j} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: statusColor(l.status).dot }} />)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legenda = saringan status (bisa diklik) */}
          <div className="flex flex-wrap items-center gap-2 mt-4 text-[11px] text-gray-400">
            {(["Disetujui", "Menunggu"] as const).map((st) => (
              <button key={st} type="button" aria-pressed={tampilStatus[st]}
                onClick={() => setTampilStatus((s) => ({ ...s, [st]: !s[st] }))}
                title={tampilStatus[st] ? `Sembunyikan yang ${st.toLowerCase()}` : `Tampilkan yang ${st.toLowerCase()}`}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-opacity ${tampilStatus[st] ? "border-white/10 bg-white/[0.03]" : "border-dashed border-white/10 opacity-40 line-through"}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${st === "Disetujui" ? "bg-green-500" : "bg-yellow-500"}`} />{st}
              </button>
            ))}
            <span className="text-gray-600">· klik untuk menyaring</span>
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
              <span className="text-[11px] font-black text-gray-500 group-hover/dd:text-gray-300 uppercase tracking-wider transition-colors">
                Daftar Cuti/Izin — {BULAN[ym.m]} {ym.y}
              </span>
              {jumlahMenunggu > 0 && (
                <span className="ml-auto text-[11px] font-bold text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">{jumlahMenunggu} menunggu</span>
              )}
              <span className={`${jumlahMenunggu > 0 ? "" : "ml-auto"} text-[11px] font-bold text-tint-redup bg-primer/10 border border-primer/20 px-2 py-0.5 rounded-full`}>
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
                    <div
                      key={i}
                      role="button"
                      tabIndex={0}
                      onClick={() => setRincianId(l.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setRincianId(l.id); } }}
                      className="flex items-center gap-3 bg-kartu border border-white/10 rounded-xl p-2.5 cursor-pointer hover:border-white/20 hover:bg-white/[0.04] transition-colors focus:outline-none focus:ring-2 focus:ring-primer-terang"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sc.dot }} />
                      <AvatarKaryawan id={l.idKaryawan} nama={rapikanNama(l.nama)} className="hidden sm:flex w-8 h-8 shrink-0 rounded-full bg-white/5 border border-white/10 text-white items-center justify-center font-bold text-xs" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{rapikanNama(l.nama)} <span className="text-[11px] font-normal text-gray-500">· {l.jenis}</span></p>
                        <p className="text-[11px] text-gray-500 truncate">{l.tanggal}{l.alasan ? ` — ${l.alasan}` : ""}</p>
                      </div>
                      {tombolKeputusan(l, true)}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sc.bg} ${sc.t} shrink-0`}>{l.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Jendela dirender ke <body> (portal): kartu kalender memakai transform saat
          di-hover, yang membuat "fixed" ikut kartu dan jendela terpotong. */}
      {/* ── JENDELA: SEMUA CUTI/IZIN PADA SATU TANGGAL ── */}
      {hariDipilih && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setHariDipilih(null)}>
          <div className="bg-kartu rounded-xl border border-white/10 w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-white/5 bg-kartu-hover flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="font-bold text-white text-sm">{tglPanjang(hariDipilih)}</p>
                <p className="text-[11px] text-gray-500">{daftarHari.length} cuti/izin{jenisDipilih !== "semua" || !tampilStatus.Disetujui || !tampilStatus.Menunggu ? " (sesuai saringan)" : ""}</p>
              </div>
              <button onClick={() => setHariDipilih(null)} className="sentuh text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg shrink-0" title="Tutup"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 space-y-2">
              {daftarHari.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">Tidak ada cuti/izin pada tanggal ini.</p>
              ) : daftarHari.map((l) => {
                const sc = statusColor(l.status);
                return (
                  <div key={l.id} role="button" tabIndex={0} onClick={() => setRincianId(l.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") setRincianId(l.id); }}
                    className="bg-input rounded-lg border border-white/5 p-3 cursor-pointer hover:border-white/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AvatarKaryawan id={l.idKaryawan} nama={rapikanNama(l.nama)} className="w-9 h-9 shrink-0 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-bold text-sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{rapikanNama(l.nama)}</p>
                          <p className="text-[11px] text-gray-400 truncate">{l.jenis}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sc.bg} ${sc.t} shrink-0`}>{l.status}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-[11px] text-gray-500">{l.range.start === l.range.end ? tglPendek(l.range.start) : `${tglPendek(l.range.start)} – ${tglPendek(l.range.end)}`}</span>
                      {tombolKeputusan(l, true)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ── JENDELA: RINCIAN SATU PENGAJUAN ── */}
      {rincian && (() => {
        const sc = statusColor(rincian.status);
        const diajukan = waktuDiajukan(rincian.id);
        const baris = (label: string, nilai: any) => (
          <div className="flex justify-between gap-4 py-1.5 border-b border-white/5 last:border-0">
            <span className="text-[11px] text-gray-500 shrink-0">{label}</span>
            <span className="text-[12px] text-gray-200 text-right break-words">{nilai}</span>
          </div>
        );
        return createPortal(
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setRincianId(null)}>
            <div className="bg-kartu rounded-xl border border-white/10 w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-white/5 bg-kartu-hover flex justify-between items-start gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <AvatarKaryawan id={rincian.idKaryawan} nama={rapikanNama(rincian.nama)} className="w-10 h-10 shrink-0 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-bold text-sm" />
                  <div className="min-w-0">
                    <p className="font-bold text-white text-sm truncate">{rapikanNama(rincian.nama)}</p>
                    <div className="flex items-center gap-2 mt-0.5">{chipJenis(rincian.kat)}<span className={`text-[10px] font-bold px-2 py-0.5 rounded ${sc.bg} ${sc.t}`}>{rincian.status}</span></div>
                  </div>
                </div>
                <button onClick={() => setRincianId(null)} className="sentuh text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg shrink-0" title="Tutup"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
              </div>
              <div className="p-4">
                {baris("Jenis", rincian.jenis || "-")}
                {baris("Periode", rincian.range.start === rincian.range.end ? tglPanjang(rincian.range.start) : `${tglPendek(rincian.range.start)} – ${tglPendek(rincian.range.end)}`)}
                {baris("Lama", `${lamaHari(rincian.range.start, rincian.range.end)} hari`)}
                {rincian.idKaryawan && baris("ID karyawan", rincian.idKaryawan)}
                {diajukan && baris("Diajukan", diajukan)}
                <div className="mt-3">
                  <p className="text-[11px] text-gray-500 mb-1">Alasan</p>
                  <p className="text-[12px] text-gray-300 italic whitespace-pre-wrap break-words">{rincian.alasan ? `"${rincian.alasan}"` : "Tidak ada keterangan."}</p>
                </div>
                {tombolKeputusan(rincian)}
              </div>
            </div>
          </div>,
          document.body,
        );
      })()}
    </div>
  );
}
