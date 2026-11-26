// src/components/struktur/Karakter.tsx
// Karakter karyawan di Struktur — SAMA PERSIS dengan halaman Karyawan & Kehadiran: komponen AvatarKaryawan
// (foto employees.avatarUrl → thumbnail Cloudinary → URL asli → huruf awal) dan kelas avatar yang sama, sehingga
// tema gelap maupun Neo-Brutal memperlakukannya seperti avatar di halaman lain. Hanya ukurannya yang berbeda.
"use client";

import AvatarKaryawan from "@/components/AvatarKaryawan";

const UKURAN = { kecil: "w-7 h-7 text-[11px]", sedang: "w-14 h-14 text-xl", besar: "w-16 h-16 text-2xl" } as const;

export default function Karakter({ id, nama, ukuran = "sedang" }: { id: string | null; nama: string | null; ukuran?: keyof typeof UKURAN }) {
  return (
    <span data-karakter className="contents">
      <AvatarKaryawan id={id} nama={nama} className={`${UKURAN[ukuran]} shrink-0 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-bold`} />
    </span>
  );
}
