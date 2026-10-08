// src/components/brutal/CariKaryawanNB.tsx
// Kotak "Cari karyawan…" di kepala Dasbor HR (tema Neo-Brutal). Menyaring daftar karyawan
// yang sudah dimuat dasbor (nama, panggilan, jabatan, ID) lalu membuka halaman detailnya.
// Ctrl/⌘+K tetap membuka pencarian global yang lama.
"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import AvatarNB from "@/components/brutal/AvatarNB";
import type { BarisKaryawan } from "@/components/brutal/tipe";

const norm = (v: unknown) => String(v ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();

export function saringKaryawan(daftar: (BarisKaryawan & { panggilan?: string | null })[], kata: string, maks = 6) {
  const q = norm(kata);
  if (!q) return [];
  const skor = (e: BarisKaryawan & { panggilan?: string | null }) => {
    const nama = norm(e.nama), pg = norm(e.panggilan);
    if (nama.startsWith(q) || pg.startsWith(q)) return 0;
    if (nama.split(/\s+/).some((k) => k.startsWith(q))) return 1;
    if (nama.includes(q) || pg.includes(q)) return 2;
    if (norm(e.jabatan).includes(q) || norm(e.idKaryawan).includes(q)) return 3;
    return 9;
  };
  return daftar.map((e) => ({ e, s: skor(e) })).filter((x) => x.s < 9)
    .sort((a, b) => a.s - b.s || norm(a.e.nama).localeCompare(norm(b.e.nama))).slice(0, maks).map((x) => x.e);
}

export default function CariKaryawanNB({ employees }: { employees: (BarisKaryawan & { panggilan?: string | null })[] }) {
  const router = useRouter();
  const [kata, setKata] = useState("");
  const [buka, setBuka] = useState(false);
  const [pilih, setPilih] = useState(0);
  const idDaftar = useId();
  const hasil = saringKaryawan(employees, kata);
  const tampil = buka && kata.trim().length > 0;

  const tuju = (e?: BarisKaryawan) => {
    if (!e?.idKaryawan) return;
    setBuka(false);
    router.push(`/admin/karyawan/${encodeURIComponent(String(e.idKaryawan))}`);
  };

  return (
    <div className="nb-cari" data-cari-karyawan>
      <div className="nb-cari-kotak">
        <Search aria-hidden />
        <input
          type="search" className="bg-transparent" placeholder="Cari karyawan…" value={kata} autoComplete="off"
          role="combobox" aria-expanded={tampil} aria-controls={idDaftar} aria-autocomplete="list" aria-label="Cari karyawan"
          aria-activedescendant={tampil && hasil[pilih] ? `${idDaftar}-${pilih}` : undefined}
          onChange={(e) => { setKata(e.target.value); setPilih(0); setBuka(true); }}
          onFocus={() => setBuka(true)}
          onBlur={() => window.setTimeout(() => setBuka(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setBuka(true); setPilih((i) => Math.min(i + 1, Math.max(hasil.length - 1, 0))); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setPilih((i) => Math.max(i - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); tuju(hasil[pilih] || hasil[0]); }
            else if (e.key === "Escape") { setBuka(false); }
          }}
        />
      </div>
      {tampil && (
        <div className="nb-tarik" id={idDaftar} role="listbox" aria-label="Hasil pencarian karyawan">
          {hasil.length === 0 ? (
            <p className="nb-tarik-kosong" style={{ margin: 0 }}>Tidak ada karyawan yang cocok dengan “{kata.trim()}”.</p>
          ) : hasil.map((e, i) => (
            <button key={String(e.idKaryawan)} id={`${idDaftar}-${i}`} type="button" role="option" aria-selected={i === pilih}
              className="nb-tarik-baris" onMouseDown={(ev) => ev.preventDefault()} onClick={() => tuju(e)} onMouseEnter={() => setPilih(i)}>
              <AvatarNB id={e.idKaryawan} nama={e.nama} />
              <span style={{ minWidth: 0 }}><b>{e.nama}</b><small>{[e.jabatan, e.idKaryawan].filter(Boolean).join(" · ")}</small></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
