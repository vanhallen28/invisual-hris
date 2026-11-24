// src/components/management/useMenuManagement.ts
// Status menu Management untuk layout: peran akun + apakah ada Pedoman berlaku.
// SQL belum dijalankan / galat → peran null & adaPedoman false → menu, banner, tab tidak tampil (perilaku lama).
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { muatPeranSaya, type PeranManagement } from "@/lib/management/akses";

export function useMenuManagement(): { peran: PeranManagement[] | null; adaPedoman: boolean } {
  const [peran, setPeran] = useState<PeranManagement[] | null>(null);
  const [adaPedoman, setAdaPedoman] = useState(false);
  useEffect(() => {
    let hidup = true;
    const periksaPedoman = async () => {
      try {
        const { data: v, error } = await supabase.from("mgmt_pedoman_versi").select("id").eq("status", "berlaku").limit(1);
        if (hidup && !error && Array.isArray(v)) setAdaPedoman(v.length > 0);
      } catch { /* abaikan */ }
    };
    (async () => {
      const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (!hidup || !data?.user) return;
      const p = await muatPeranSaya(supabase);
      if (!hidup || p === null) return;            // fitur belum dipasang
      setPeran(p);
      await periksaPedoman();
      window.addEventListener(EVENT_PEDOMAN, periksaPedoman);
    })();
    return () => { hidup = false; window.removeEventListener(EVENT_PEDOMAN, periksaPedoman); };
  }, []);
  return { peran, adaPedoman };
}

/** Dikirim TabPedoman setelah konfirmasi baca / penerbitan versi → banner memeriksa ulang. */
export const EVENT_PEDOMAN = "invisual:pedoman-berubah";
export const kabariPedomanBerubah = () => { try { window.dispatchEvent(new Event(EVENT_PEDOMAN)); } catch { /* abaikan */ } };
