// src/lib/audit.ts
// Pencatatan aktivitas admin (audit log). Fire-and-forget: tak pernah
// mengganggu aksi utama — kalau gagal mencatat, diam saja.
import { supabase } from "@/lib/supabase";

export async function logAudit(action: string, target?: string, detail?: string) {
  try {
    const { data } = await supabase.auth.getUser();
    await supabase.from("audit_log").insert([{
      actor: data?.user?.email || "sistem",
      action,
      target: target || null,
      detail: detail || null,
    }]);
  } catch {
    /* diamkan — logging tak boleh menggagalkan aksi utama */
  }
}
