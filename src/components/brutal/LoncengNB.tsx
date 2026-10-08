// src/components/brutal/LoncengNB.tsx
// Lonceng notifikasi tema Neo-Brutal: angka magenta = jumlah hal yang perlu ditindaklanjuti,
// klik membuka daftar singkat (tiap baris menuju tempat penyelesaiannya). Tidak menyimpan
// apa pun — isinya dihitung dari data dasbor yang sudah dimuat halaman.
"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

export type ButirLonceng = { kunci: string; label: string; jumlah: number; warna?: string; href?: string; onClick?: () => void };

export default function LoncengNB({ butir, judul = "Perlu ditindaklanjuti" }: { butir: ButirLonceng[]; judul?: string }) {
  const [buka, setBuka] = useState(false);
  const akar = useRef<HTMLDivElement>(null);
  const idPanel = useId();
  const aktif = butir.filter((b) => b.jumlah > 0);
  const total = aktif.reduce((s, b) => s + b.jumlah, 0);

  useEffect(() => {
    if (!buka) return;
    const luar = (e: MouseEvent | TouchEvent) => { if (akar.current && !akar.current.contains(e.target as Node)) setBuka(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setBuka(false); };
    document.addEventListener("mousedown", luar);
    document.addEventListener("touchstart", luar);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", luar); document.removeEventListener("touchstart", luar); document.removeEventListener("keydown", esc); };
  }, [buka]);

  return (
    <div className="nb-lonceng" ref={akar} data-lonceng>
      <button type="button" onClick={() => setBuka((v) => !v)} aria-expanded={buka} aria-controls={idPanel}
        aria-label={total ? `${judul}: ${total}` : `${judul}: tidak ada`} title={judul}>
        <Bell aria-hidden />
      </button>
      {total > 0 && <span className="nb-lonceng-angka" aria-hidden data-lonceng-angka>{total > 99 ? "99+" : total}</span>}
      {buka && (
        <div className="nb-tarik" id={idPanel} role="dialog" aria-label={judul}>
          <p className="nb-tarik-judul" style={{ margin: 0 }}>{judul}</p>
          {aktif.length === 0 ? (
            <p className="nb-tarik-kosong" style={{ margin: 0 }}>Tidak ada yang perlu ditindaklanjuti.</p>
          ) : aktif.map((b) => {
            const isi = (<><span>{b.label}</span><span className={`nb-hitung ${b.warna || ""}`}>{b.jumlah}</span></>);
            return b.href ? (
              <Link key={b.kunci} href={b.href} className="nb-tarik-baris" onClick={() => setBuka(false)}>{isi}</Link>
            ) : (
              <button key={b.kunci} type="button" className="nb-tarik-baris" onClick={() => { setBuka(false); b.onClick?.(); }}>{isi}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
