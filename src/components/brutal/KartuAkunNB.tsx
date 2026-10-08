// src/components/brutal/KartuAkunNB.tsx
// Kartu akun di bawah sidebar HR (tema Neo-Brutal): avatar, nama, email, tombol keluar.
// Klik kartu → Pengaturan (menggantikan ikon roda gigi hanya di tema ini).
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AvatarNB from "@/components/brutal/AvatarNB";

export default function KartuAkunNB({ onKeluar }: { onKeluar: () => void }) {
  const [akun, setAkun] = useState<{ nama: string; email: string } | null>(null);
  useEffect(() => {
    let hidup = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!hidup) return;
      const u = data?.user;
      const meta = (u?.user_metadata || {}) as Record<string, unknown>;
      const nama = String(meta.full_name || meta.name || "").trim();
      setAkun({ nama: !nama || /^hr$/i.test(nama) ? "Tim HR" : nama, email: u?.email || "" });
    }).catch(() => { if (hidup) setAkun({ nama: "Tim HR", email: "" }); });
    return () => { hidup = false; };
  }, []);
  const nama = akun?.nama || "Tim HR";
  return (
    <div className="nb-akun-sidebar" data-kartu-akun>
      <Link href="/admin/pengaturan" title="Pengaturan akun">
        <AvatarNB nama={nama === "Tim HR" ? "H R" : nama} warna="var(--nb-pink)" />
        <span style={{ minWidth: 0 }}><b>{nama}</b><small>{akun?.email || " "}</small></span>
      </Link>
      <button type="button" onClick={onKeluar} title="Keluar" aria-label="Keluar"><LogOut aria-hidden /></button>
    </div>
  );
}
