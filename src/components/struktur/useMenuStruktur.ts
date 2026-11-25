// src/components/struktur/useMenuStruktur.ts
// Menu "Struktur" tampil hanya bila struktur.sql terpasang DAN database mengizinkan akun ini melihat
// (@invisual.studio selalu; karyawan lain bila sakelar Pengaturan nyala). Belum dipasang / galat → tersembunyi.
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { bolehLihatStruktur } from "@/lib/struktur/struktur";

/** Dikirim sakelar Pengaturan setelah diubah → menu memeriksa ulang. */
export const EVENT_STRUKTUR = "invisual:struktur-berubah";
export const kabariStrukturBerubah = () => { try { window.dispatchEvent(new Event(EVENT_STRUKTUR)); } catch { /* abaikan */ } };

export function useMenuStruktur(): boolean {
  const [boleh, setBoleh] = useState(false);
  useEffect(() => {
    let hidup = true;
    const periksa = async () => {
      const { data } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
      if (!hidup || !data?.user) return;
      const b = await bolehLihatStruktur(supabase);
      if (hidup) setBoleh(b);
    };
    periksa();
    window.addEventListener(EVENT_STRUKTUR, periksa);
    return () => { hidup = false; window.removeEventListener(EVENT_STRUKTUR, periksa); };
  }, []);
  return boleh;
}
