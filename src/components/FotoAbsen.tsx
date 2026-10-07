// src/components/FotoAbsen.tsx
// Tampilan foto selfie absensi untuk HR.
//   • FotoAbsenPasangan — foto masuk & pulang satu baris absensi (dipakai di detail heatmap)
//   • GaleriFotoAbsen   — jendela galeri foto absen per tanggal (hari kerja 7 hari terakhir; Sabtu & Minggu tidak ditampilkan)
// Foto disimpan privat; yang ditampilkan adalah tautan sementara (1 jam).
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { rapikanNama } from "@/lib/nama";
import { ambilUrlFotoAbsen, fotoKedaluwarsa, UMUR_FOTO_HARI, FOTO_ABSEN_MULAI } from "@/lib/fotoAbsen";
import AvatarKaryawan from "@/components/AvatarKaryawan";

const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const pad = (n: number) => String(n).padStart(2, "0");
const isoDari = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tglDari = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };

/**
 * Tanggal yang bisa dipilih di galeri: masa simpan foto (7 hari terakhir), tetapi
 * TANPA Sabtu & Minggu (hari libur) dan tidak sebelum fitur foto absen aktif.
 * Urut terbaru → terlama.
 */
function daftarTanggalGaleri(hariIni: string): string[] {
  const d0 = tglDari(hariIni);
  return Array.from({ length: UMUR_FOTO_HARI }, (_, i) => new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() - i))
    .filter((d) => d.getDay() !== 0 && d.getDay() !== 6)
    .map(isoDari)
    .filter((iso) => iso >= FOTO_ABSEN_MULAI);
}
const selisihHari = (a: string, b: string) => Math.round((tglDari(b).getTime() - tglDari(a).getTime()) / 86400000);

function Lightbox({ src, onTutup }: { src: string; onTutup: () => void }) {
  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onTutup(); } };
    window.addEventListener("keydown", t, true);
    return () => window.removeEventListener("keydown", t, true);
  }, [onTutup]);
  return (
    <>
      <div className="fixed inset-0 bg-black/90 z-[150]" onClick={onTutup} />
      <div className="fixed inset-0 z-[155] flex items-center justify-center p-4 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Foto absen" className="max-w-full max-h-full rounded-xl object-contain pointer-events-auto" />
      </div>
      <button onClick={onTutup} title="Tutup" className="fixed top-4 right-4 z-[160] p-2 bg-kartu/90 text-white rounded-lg hover:bg-kartu-hover">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </>
  );
}

/** Satu kotak foto (masuk/pulang) dengan semua keadaannya. */
function KotakFoto({ label, jam, path, url, memuat, kedaluwarsa, belumPulang, hilang, onBuka, onRusak }: {
  label: string; jam?: string | null; path?: string | null; url?: string; memuat: boolean; kedaluwarsa: boolean; belumPulang?: boolean; hilang?: boolean; onBuka: (u: string) => void; onRusak?: (path: string) => void;
}) {
  const [rusak, setRusak] = useState(false);
  let pesan = "";
  if (!path) pesan = kedaluwarsa ? `Sudah terhapus otomatis (> ${UMUR_FOTO_HARI} hari)` : belumPulang ? "Belum clock-out" : "Tidak ada foto";
  else if (memuat) pesan = "Memuat…";
  else if (!url || rusak) pesan = kedaluwarsa ? `Sudah terhapus otomatis (> ${UMUR_FOTO_HARI} hari)` : hilang ? "Berkas foto tidak ditemukan di penyimpanan" : "Foto tidak bisa dibuka";
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">{label}{jam ? <span className="text-gray-300 normal-case font-mono ml-1">{jam}</span> : null}</p>
      {pesan ? (
        <div className="aspect-[3/4] rounded-lg border border-dashed border-white/10 bg-white/[0.02] flex items-center justify-center p-2 text-center">
          <span className="text-[11px] text-gray-500 leading-snug">{pesan}</span>
        </div>
      ) : (
        <button type="button" onClick={() => onBuka(url!)} className="block w-full aspect-[3/4] rounded-lg overflow-hidden border border-white/10 hover:border-primer-terang focus:outline-none focus:ring-2 focus:ring-primer-terang" title="Perbesar">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Foto ${label.toLowerCase()}`} onError={() => { setRusak(true); if (path) onRusak?.(path); }} className="w-full h-full object-cover" loading="lazy" />
        </button>
      )}
    </div>
  );
}

/** Foto masuk & pulang dari satu baris attendance. */
export function FotoAbsenPasangan({ att, hariIni }: { att: any; hariIni: string }) {
  const [url, setUrl] = useState<Record<string, string>>({});
  const [hilang, setHilang] = useState<Set<string>>(() => new Set());
  const [ditolak, setDitolak] = useState<Set<string>>(() => new Set());
  const [rusakSet, setRusakSet] = useState<Set<string>>(() => new Set());
  const [memuat, setMemuat] = useState(true);
  const [besar, setBesar] = useState<string | null>(null);
  const [ulang, setUlang] = useState(0);
  const fm = att?.foto_masuk || null, fk = att?.foto_keluar || null;

  useEffect(() => {
    let hidup = true;
    (async () => {
      setMemuat(true);
      setRusakSet(new Set());
      const h = await ambilUrlFotoAbsen(supabase, [fm, fk]);
      if (hidup) { setUrl(h.url); setHilang(h.hilang); setDitolak(h.ditolak); setMemuat(false); }
    })();
    return () => { hidup = false; };
  }, [fm, fk, ulang]);

  const lama = fotoKedaluwarsa(att?.tanggal || hariIni, hariIni);
  const tandaiRusak = (p: string) => setRusakSet((s) => (s.has(p) ? s : new Set(s).add(p)));
  const bisaDiulang = !memuat && !lama && [fm, fk].some((p) => p && (rusakSet.has(p) || (!url[p] && !hilang.has(p) && !ditolak.has(p))));
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <KotakFoto key={`m-${ulang}`} label="Masuk" jam={att?.waktuMasuk} path={fm} url={fm ? url[fm] : undefined} memuat={memuat} kedaluwarsa={lama} hilang={!!fm && hilang.has(fm)} onBuka={setBesar} onRusak={tandaiRusak} />
        <KotakFoto key={`k-${ulang}`} label="Pulang" jam={att?.waktuKeluar} path={fk} url={fk ? url[fk] : undefined} memuat={memuat} kedaluwarsa={lama} belumPulang={!att?.waktuKeluar} hilang={!!fk && hilang.has(fk)} onBuka={setBesar} onRusak={tandaiRusak} />
      </div>
      <p className="text-[11px] text-gray-600 mt-2">
        Foto disimpan {UMUR_FOTO_HARI} hari, lalu terhapus otomatis.
        {bisaDiulang && <> <button type="button" onClick={() => setUlang((n) => n + 1)} className="font-bold text-tint hover:text-white underline underline-offset-2">Muat ulang foto</button></>}
      </p>
      {besar && <Lightbox src={besar} onTutup={() => setBesar(null)} />}
    </div>
  );
}

/** Jendela galeri foto absen per tanggal (hari kerja dalam 7 hari terakhir, Sabtu & Minggu tidak ditampilkan). */
export function GaleriFotoAbsen({ hariIni, fokusId, onTutup }: { hariIni: string; fokusId?: string | null; onTutup: () => void }) {
  // Bawaan: hari ini; bila hari ini Sabtu/Minggu → hari kerja terakhir.
  const [tanggal, setTanggal] = useState(() => daftarTanggalGaleri(hariIni)[0] ?? hariIni);
  const [baris, setBaris] = useState<any[]>([]);
  const [url, setUrl] = useState<Record<string, string>>({});
  const [hilang, setHilang] = useState<Set<string>>(() => new Set());
  const [ditolak, setDitolak] = useState<Set<string>>(() => new Set());
  const [rusakSet, setRusakSet] = useState<Set<string>>(() => new Set());
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [besar, setBesar] = useState<string | null>(null);
  const [ulang, setUlang] = useState(0);

  const pilihanTanggal = useMemo(() => daftarTanggalGaleri(hariIni), [hariIni]);

  useEffect(() => {
    let hidup = true;
    (async () => {
      setMemuat(true); setGalat(""); setRusakSet(new Set());
      const { data, error } = await supabase.from("attendance").select("*").eq("tanggal", tanggal).order("waktuMasuk", { ascending: true });
      if (!hidup) return;
      if (error) { setGalat(error.message); setBaris([]); setMemuat(false); return; }
      const lihat = new Set<string>();
      const unik = (data || []).filter((a: any) => { const k = String(a.idKaryawan ?? a.id); if (lihat.has(k)) return false; lihat.add(k); return true; });
      setBaris(unik);
      const h = await ambilUrlFotoAbsen(supabase, unik.flatMap((a: any) => [a.foto_masuk, a.foto_keluar]));
      if (!hidup) return;
      setUrl(h.url);
      setHilang(h.hilang);
      setDitolak(h.ditolak);
      setMemuat(false);
    })();
    return () => { hidup = false; };
  }, [tanggal, ulang]);

  useEffect(() => {
    const t = (e: KeyboardEvent) => { if (e.key === "Escape" && !besar) onTutup(); };
    window.addEventListener("keydown", t);
    return () => window.removeEventListener("keydown", t);
  }, [besar, onTutup]);

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const arr = q ? baris.filter((a) => String(a.nama || "").toLowerCase().includes(q)) : baris.slice();
    if (fokusId) arr.sort((a, b) => (String(a.idKaryawan) === String(fokusId) ? -1 : String(b.idKaryawan) === String(fokusId) ? 1 : 0));
    return arr;
  }, [baris, cari, fokusId]);

  const adaFoto = baris.filter((a) => a.foto_masuk || a.foto_keluar).length;
  // Foto yang tercatat tetapi tautannya belum didapat / gambarnya gagal dimuat (mis. tautan
  // 1 jam sudah kedaluwarsa) — bukan karena berkasnya memang hilang atau lewat masa simpan
  // → tawarkan "Muat ulang".
  const tandaiRusak = (p: string) => setRusakSet((s) => (s.has(p) ? s : new Set(s).add(p)));
  const gagalDimuat = baris.reduce((n, a) => {
    if (fotoKedaluwarsa(a.tanggal || tanggal, hariIni)) return n;
    return n + [a.foto_masuk, a.foto_keluar].filter((p) => p && (rusakSet.has(p) || (!url[p] && !hilang.has(p) && !ditolak.has(p)))).length;
  }, 0);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onTutup}>
      <div className="bg-kartu rounded-xl border border-white/10 w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-white/5 bg-kartu-hover flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h2 className="font-bold text-white text-sm">Foto Absensi</h2>
            <p className="text-[11px] text-gray-500 mt-0.5">Selfie saat clock-in & clock-out · tersimpan {UMUR_FOTO_HARI} hari lalu terhapus otomatis</p>
          </div>
          <button onClick={onTutup} className="sentuh text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg shrink-0" title="Tutup"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="px-4 pt-3 pb-2 border-b border-white/5 flex flex-col gap-2.5">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {pilihanTanggal.map((iso) => {
              const d = tglDari(iso);
              const mundur = selisihHari(iso, hariIni);
              return (
                <button key={iso} type="button" onClick={() => setTanggal(iso)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${tanggal === iso ? "bg-primer text-white" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"}`}>
                  {mundur === 0 ? "Hari ini" : mundur === 1 ? "Kemarin" : `${HARI[d.getDay()].slice(0, 3)}, ${d.getDate()} ${BULAN[d.getMonth()]}`}
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-3">
            <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama…" className="bg-latar border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-primer-terang w-48" />
            {!memuat && !galat && (
              <span className="text-[11px] text-gray-500 text-right">
                {baris.length} absen · {adaFoto} dengan foto
                {gagalDimuat > 0 && (
                  <> · <button type="button" onClick={() => setUlang((n) => n + 1)} className="font-bold text-tint hover:text-white underline underline-offset-2">{gagalDimuat} gagal dimuat — muat ulang</button></>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
          {memuat ? (
            <p className="text-sm text-gray-500 text-center py-10">Memuat foto…</p>
          ) : galat ? (
            <div className="text-center py-10">
              <p className="text-sm text-red-300 mb-3">Gagal memuat: {galat}</p>
              <button onClick={() => setUlang((n) => n + 1)} className="text-xs font-bold text-white bg-red-500/80 hover:bg-red-500 px-3 py-1.5 rounded-lg">Coba lagi</button>
            </div>
          ) : tampil.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-10">{baris.length === 0 ? "Belum ada yang absen di tanggal ini." : `Tidak ada nama "${cari}".`}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tampil.map((a) => {
                const fokus = fokusId && String(a.idKaryawan) === String(fokusId);
                const lama = fotoKedaluwarsa(a.tanggal || tanggal, hariIni);
                return (
                  <div key={a.id ?? a.idKaryawan} className={`rounded-xl border p-3 bg-input ${fokus ? "border-primer-terang ring-1 ring-primer-terang/50" : "border-white/10"}`}>
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <AvatarKaryawan id={a.idKaryawan} nama={rapikanNama(a.nama)} className="w-7 h-7 shrink-0 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-bold text-[11px]" />
                        <p className="text-sm font-bold text-white truncate">{rapikanNama(a.nama)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {a.mode_kerja && a.mode_kerja !== "Kantor" && <span className="text-[10px] font-bold uppercase bg-primer/15 text-tint-redup px-1.5 py-0.5 rounded border border-primer/30">{a.mode_kerja}</span>}
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${a.status === "Terlambat" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-green-500/10 text-green-400 border-green-500/20"}`}>{a.status || "-"}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <KotakFoto key={`m-${a.foto_masuk || ""}-${ulang}`} label="Masuk" jam={a.waktuMasuk} path={a.foto_masuk} url={a.foto_masuk ? url[a.foto_masuk] : undefined} memuat={false} kedaluwarsa={lama} hilang={!!a.foto_masuk && hilang.has(a.foto_masuk)} onBuka={setBesar} onRusak={tandaiRusak} />
                      <KotakFoto key={`k-${a.foto_keluar || ""}-${ulang}`} label="Pulang" jam={a.waktuKeluar} path={a.foto_keluar} url={a.foto_keluar ? url[a.foto_keluar] : undefined} memuat={false} kedaluwarsa={lama} belumPulang={!a.waktuKeluar} hilang={!!a.foto_keluar && hilang.has(a.foto_keluar)} onBuka={setBesar} onRusak={tandaiRusak} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {besar && <div onClick={(e) => e.stopPropagation()}><Lightbox src={besar} onTutup={() => setBesar(null)} /></div>}
    </div>
  );
}
