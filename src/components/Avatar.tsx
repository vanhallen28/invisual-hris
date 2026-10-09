"use client";
import { useState } from "react";
import { urlThumbnail } from "@/lib/thumbnail";

// Menampilkan avatar custom (gambar) bila ada URL; jika tidak / gagal dimuat,
// jatuh ke inisial nama. `className` mengatur ukuran, bentuk, warna latar, dll.
export default function Avatar({ url, name, initials, className = "" }: any) {
  const [err, setErr] = useState(false);
  // Tampilan memakai thumbnail Cloudinary (lib/thumbnail.ts); bila thumbnail gagal → URL asli → inisial.
  const [thumbGagal, setThumbGagal] = useState(false);
  const fallback = initials || (name ? String(name).charAt(0).toUpperCase() : "?");
  if (url && !err) {
    const kecil = urlThumbnail(url);
    const pakaiAsli = thumbGagal || kecil === url;
    return <img src={pakaiAsli ? url : kecil} alt={name || "avatar"} onError={() => (pakaiAsli ? setErr(true) : setThumbGagal(true))} className={`${className} object-cover`} />;
  }
  return <div className={className}>{fallback}</div>;
}
