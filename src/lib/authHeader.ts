// src/lib/authHeader.ts
// Header untuk memanggil rute API internal yang memverifikasi pemanggil di server
// (`Authorization: Bearer <access_token sesi Supabase>`). Tanpa sesi → tanpa Authorization
// (server akan menolak dengan 401 — tidak ada data yang bocor).
import { supabase } from "@/lib/supabase";

export async function headerAuth(json = true): Promise<Record<string, string>> {
  const h: Record<string, string> = json ? { "Content-Type": "application/json" } : {};
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (token) h.Authorization = `Bearer ${token}`;
  } catch { /* tanpa sesi */ }
  return h;
}
