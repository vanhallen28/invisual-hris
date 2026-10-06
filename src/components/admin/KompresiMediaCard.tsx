// src/components/admin/KompresiMediaCard.tsx
// Status kompresi media (Cloudinary) di halaman Pengaturan admin.
// Hanya MEMBACA status dari server; kunci API diatur lewat environment (lihat .env.example).
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { BATAS } from "@/lib/cloudinary/aturan";

type Status = {
  aktif: boolean;
  alasan?: "env" | "dimatikan";
  cloudName?: string;
  folder?: string;
  galat?: string;
  pemakaian?: {
    paket?: string | null;
    kredit?: { terpakai: number | null; batas: number | null; persen: number | null } | null;
    penyimpananByte?: number | null;
    bandwidthByte?: number | null;
    transformasi?: number | null;
    jumlahAset?: number | null;
    diperbarui?: string | null;
  };
};

const ukuran = (b?: number | null) => {
  if (b == null || !Number.isFinite(b)) return "-";
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  if (b >= 1024 ** 2) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(0, Math.round(b / 1024))} KB`;
};
const angka = (n?: number | null) => (n == null || !Number.isFinite(n) ? "-" : n.toLocaleString("id-ID", { maximumFractionDigits: 2 }));

async function token() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

async function ambilStatus(): Promise<{ status: Status | null; galat: string }> {
  try {
    const res = await fetch("/api/cloudinary/status", { headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
    const j = await res.json().catch(() => null);
    if (!res.ok) throw new Error(j?.error || `Server menjawab ${res.status}`);
    return { status: j, galat: "" };
  } catch (e: any) {
    return { status: null, galat: e?.message || "Gagal memeriksa status." };
  }
}

/** `dibuka`: status (termasuk pemakaian kredit dari Admin API Cloudinary) baru diambil saat bagian ini dibuka. */
export default function KompresiMediaCard({ dibuka = true }: { dibuka?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [bersih, setBersih] = useState<{ sibuk: boolean; pesan: string }>({ sibuk: false, pesan: "" });

  const terapkan = useCallback((h: { status: Status | null; galat: string }) => {
    setStatus(h.status); setGalat(h.galat); setMemuat(false);
  }, []);

  const [sudahDimuat, setSudahDimuat] = useState(false);
  useEffect(() => {
    if (!dibuka || sudahDimuat) return;
    let hidup = true;
    void ambilStatus().then((h) => { if (hidup) { terapkan(h); setSudahDimuat(true); } });
    return () => { hidup = false; };
  }, [dibuka, sudahDimuat, terapkan]);

  const muat = async () => {
    setMemuat(true); setGalat("");
    terapkan(await ambilStatus());
  };

  const bersihkan = async () => {
    setBersih({ sibuk: true, pesan: "" });
    try {
      const res = await fetch("/api/cloudinary/bersihkan", { method: "POST", headers: { Authorization: `Bearer ${await token()}` } });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || `Server menjawab ${res.status}`);
      setBersih({ sibuk: false, pesan: j?.nonaktif ? "Cloudinary belum aktif." : `Selesai — ${j?.dihapus ?? 0} salinan sementara dihapus.` });
    } catch (e: any) {
      setBersih({ sibuk: false, pesan: "Gagal: " + (e?.message || "coba lagi") });
    }
  };

  const k = status?.pemakaian?.kredit;
  const persen = k?.persen != null ? Math.min(100, Math.max(0, k.persen)) : null;

  return (
    <div className="flex flex-col gap-4">
      {memuat ? (
        <p className="text-xs text-gray-500">Memeriksa status Cloudinary…</p>
      ) : galat ? (
        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{galat}</div>
      ) : status && !status.aktif ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] p-3.5 text-xs text-amber-100/90 leading-relaxed">
          <p className="font-bold text-amber-300 mb-1">
            {status.alasan === "dimatikan" ? "Dimatikan lewat CLOUDINARY_AKTIF=0" : "Belum aktif — kunci Cloudinary belum diisi"}
          </p>
          <p>Unggahan saat ini memakai alur lama (Supabase, tanpa kompresi Cloudinary). Untuk mengaktifkan, isi di Vercel › Settings › Environment Variables lalu deploy ulang:</p>
          <pre className="mt-2 bg-black/40 border border-white/10 rounded-lg p-2.5 text-[11px] text-gray-200 overflow-x-auto">{`CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...`}</pre>
          <p className="mt-2 text-amber-100/70">Atau satu baris: <code className="text-amber-200">CLOUDINARY_URL=cloudinary://key:secret@cloud</code></p>
        </div>
      ) : status ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-400">Cloud</span>
            <span className="font-mono text-white bg-white/5 border border-white/10 rounded px-2 py-0.5">{status.cloudName}</span>
            <span className="text-gray-400 ml-2">Folder</span>
            <span className="font-mono text-white bg-white/5 border border-white/10 rounded px-2 py-0.5">{status.folder}</span>
            {status.pemakaian?.paket && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-tint-redup">Paket {status.pemakaian.paket}</span>}
          </div>
          {status.galat ? (
            <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              Kunci terisi tetapi ditolak Cloudinary: {status.galat}. Periksa API key / secret, lalu deploy ulang.
            </div>
          ) : (
            <>
              {k && (
                <div>
                  <div className="flex justify-between text-[11px] text-gray-400 mb-1">
                    <span>Kredit bulan ini</span>
                    <span className="font-mono text-gray-200">{angka(k.terpakai)} / {angka(k.batas)}{persen != null ? ` (${angka(persen)}%)` : ""}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full ${persen != null && persen >= 80 ? "bg-red-500" : persen != null && persen >= 60 ? "bg-amber-400" : "bg-primer-terang"}`} style={{ width: `${persen ?? 0}%` }} />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  ["Penyimpanan", ukuran(status.pemakaian?.penyimpananByte)],
                  ["Bandwidth", ukuran(status.pemakaian?.bandwidthByte)],
                  ["Transformasi", angka(status.pemakaian?.transformasi)],
                  ["Jumlah aset", angka(status.pemakaian?.jumlahAset)],
                ].map(([l, v]) => (
                  <div key={l} className="bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{l}</p>
                    <p className="text-sm font-bold text-white mt-0.5">{v}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : null}

      <div className="text-[11px] text-gray-500 leading-relaxed border-t border-white/5 pt-3">
        <p className="font-bold text-gray-400 mb-1">Aturan kompresi</p>
        <p>• Gambar: sisi terpanjang maks {BATAS.gambarPx} px (avatar &amp; stiker {BATAS.gambarKecilPx} px), kualitas otomatis. Foto HEIC iPhone diubah ke JPG.</p>
        <p>• Video: maks ±720p ({BATAS.videoPx} px), kualitas otomatis, disimpan MP4. Video &gt; {BATAS.videoMaksByte / 1024 / 1024} MB memakai alur lama.</p>
        <p>• Avatar, chat, Daily Task, dokumen, stiker, Setoran: disimpan &amp; ditayangkan dari Cloudinary.</p>
        <p>• Selfie absen &amp; lampiran Pesan Pribadi: hanya dikompres, lalu tetap disimpan privat di Supabase.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void muat()} disabled={memuat} className="text-xs font-bold text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-lg disabled:opacity-50">
          {memuat ? "Memeriksa…" : "Periksa lagi"}
        </button>
        {status?.aktif && !status.galat && (
          <button type="button" onClick={bersihkan} disabled={bersih.sibuk} className="text-xs font-bold text-tint bg-primer/10 hover:bg-primer/20 border border-primer/30 px-3 py-2 rounded-lg disabled:opacity-50">
            {bersih.sibuk ? "Membersihkan…" : "Bersihkan salinan sementara"}
          </button>
        )}
        {bersih.pesan && <span className="text-[11px] text-gray-400">{bersih.pesan}</span>}
      </div>
    </div>
  );
}
