// src/components/AvatarKaryawan.tsx
// Avatar karyawan berdasarkan ID karyawan (atau nama sebagai cadangan), memakai
// foto profil yang sudah ditetapkan di data karyawan (employees.avatarUrl).
// Bila karyawan belum punya foto / foto gagal dimuat → inisial nama (sama
// seperti tampilan lama), jadi tidak ada yang "rusak" bila data belum lengkap.
//
// Daftar avatar dimuat SEKALI lalu dibagi ke semua pemakai di halaman yang sama
// (satu kueri ringan: idKaryawan, nama, avatarUrl), disegarkan bila sudah > 5 menit.
// Gambar dimuat malas (loading="lazy") agar daftar panjang tidak boros kuota.
"use client";

import { useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import { urlThumbnail } from "@/lib/thumbnail";

type Peta = {
  id: Record<string, string>;        // idKaryawan → URL avatar
  dikenal: Record<string, true>;     // semua idKaryawan yang ada (punya avatar atau tidak)
  nama: Record<string, string>;      // nama (dinormalkan) → URL avatar, cadangan bila ID tak ada
};

const KOSONG: Peta = { id: {}, dikenal: {}, nama: {} };
const UMUR_MS = 5 * 60 * 1000;
const JEDA_GAGAL_MS = 30 * 1000;

let peta: Peta = KOSONG;
let waktuMuat = 0;
let waktuGagal = 0;
let sedangMuat: Promise<void> | null = null;
const pendengar = new Set<() => void>();

const normNama = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

function muat(): Promise<void> {
  if (sedangMuat) return sedangMuat;
  const kini = Date.now();
  if (waktuMuat && kini - waktuMuat < UMUR_MS) return Promise.resolve();
  if (waktuGagal && kini - waktuGagal < JEDA_GAGAL_MS) return Promise.resolve();
  sedangMuat = (async () => {
    try {
      const { data, error } = await supabase.from("employees").select("idKaryawan, nama, avatarUrl");
      if (error || !data) { waktuGagal = Date.now(); return; }
      const baru: Peta = { id: {}, dikenal: {}, nama: {} };
      (data as any[]).forEach((e) => {
        const id = e?.idKaryawan != null && e.idKaryawan !== "" ? String(e.idKaryawan) : "";
        if (id) baru.dikenal[id] = true;
        const url = String(e?.avatarUrl ?? "").trim();
        if (!url) return;
        if (id) baru.id[id] = url;
        const n = normNama(e.nama);
        if (n && !(n in baru.nama)) baru.nama[n] = url;
      });
      peta = baru;
      waktuMuat = Date.now();
      waktuGagal = 0;
      pendengar.forEach((f) => f());
    } catch {
      waktuGagal = Date.now();   // gagal → tetap inisial; dicoba lagi paling cepat 30 dtk kemudian
    } finally {
      sedangMuat = null;
    }
  })();
  return sedangMuat;
}

function langganan(f: () => void) {
  pendengar.add(f);
  void muat();
  return () => { pendengar.delete(f); };
}
const ambil = () => peta;
const ambilServer = () => KOSONG;

/** URL avatar karyawan (kosong bila belum ada). */
export function useUrlAvatar(id?: string | number | null, nama?: string | null): string {
  const p = useSyncExternalStore(langganan, ambil, ambilServer);
  const kunci = id != null && id !== "" ? String(id) : "";
  // ID dikenal → pakai avatar milik ID itu saja (jangan meminjam foto orang lain yang kebetulan senama).
  if (kunci && p.dikenal[kunci]) return p.id[kunci] || "";
  return p.nama[normNama(nama)] || "";
}

export default function AvatarKaryawan({ id, nama, className = "" }: {
  id?: string | number | null;
  nama?: string | null;
  className?: string;
}) {
  const url = useUrlAvatar(id, nama);
  const [urlGagal, setUrlGagal] = useState("");
  // Tampilan memakai thumbnail Cloudinary (lib/thumbnail.ts); bila gagal → URL asli → inisial.
  const [thumbGagal, setThumbGagal] = useState("");
  if (url && urlGagal !== url) {
    const kecil = urlThumbnail(url);
    const pakaiAsli = thumbGagal === url || kecil === url;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={pakaiAsli ? url : kecil}
        alt={nama || "avatar"}
        loading="lazy"
        decoding="async"
        onError={() => (pakaiAsli ? setUrlGagal(url) : setThumbGagal(url))}
        className={`${className} object-cover`}
      />
    );
  }
  return <div className={className}>{nama ? String(nama).charAt(0).toUpperCase() : "?"}</div>;
}
