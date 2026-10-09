// src/components/brutal/AvatarNB.tsx
// Avatar bulat khusus tema Neo-Brutal: foto profil (sumber sama dengan AvatarKaryawan) atau
// dua huruf inisial di atas warna pastel yang tetap per orang. Hanya dipakai tata letak brutal.
"use client";

import { useState } from "react";
import { useUrlAvatar } from "@/components/AvatarKaryawan";
import { urlThumbnail } from "@/lib/thumbnail";

const PALET = ["var(--nb-kuning)", "var(--nb-ungu)", "var(--nb-jingga)", "var(--nb-hijau)", "var(--nb-biru)", "var(--nb-pink)"];

export function inisialNB(nama?: string | null): string {
  const kata = String(nama ?? "").trim().split(/\s+/).filter(Boolean);
  if (kata.length === 0) return "?";
  const a = kata[0]!.charAt(0);
  const b = kata.length > 1 ? kata[kata.length - 1]!.charAt(0) : kata[0]!.charAt(1);
  return (a + (b || "")).toUpperCase();
}

export function warnaNB(kunci?: string | number | null): string {
  const s = String(kunci ?? "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALET[h % PALET.length]!;
}

export default function AvatarNB({ id, nama, className = "nb-avatar", warna }: {
  id?: string | number | null;
  nama?: string | null;
  className?: string;
  warna?: string;
}) {
  const url = useUrlAvatar(id, nama);
  const [urlGagal, setUrlGagal] = useState("");
  const [thumbGagal, setThumbGagal] = useState("");
  const pakaiFoto = !!url && urlGagal !== url;
  const kecil = urlThumbnail(url);
  const pakaiAsli = thumbGagal === url || kecil === url;
  return (
    <span className={className} style={{ background: warna || warnaNB(id ?? nama) }} aria-hidden>
      {pakaiFoto
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={pakaiAsli ? url : kecil} alt="" loading="lazy" decoding="async" onError={() => (pakaiAsli ? setUrlGagal(url) : setThumbGagal(url))} />
        : inisialNB(nama)}
    </span>
  );
}
