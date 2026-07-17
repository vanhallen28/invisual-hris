"use client";
import { useState } from "react";

// Menampilkan avatar custom (gambar) bila ada URL; jika tidak / gagal dimuat,
// jatuh ke inisial nama. `className` mengatur ukuran, bentuk, warna latar, dll.
export default function Avatar({ url, name, initials, className = "" }: any) {
  const [err, setErr] = useState(false);
  const fallback = initials || (name ? String(name).charAt(0).toUpperCase() : "?");
  if (url && !err) {
    return <img src={url} alt={name || "avatar"} onError={() => setErr(true)} className={`${className} object-cover`} />;
  }
  return <div className={className}>{fallback}</div>;
}
