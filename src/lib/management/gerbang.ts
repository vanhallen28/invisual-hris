// src/lib/management/gerbang.ts
// Gerbang Section Management (management-gerbang.sql): selama sakelar `mgmt_terbuka_anggota` MATI,
// Management & Pedoman hanya untuk akun @invisual.studio. Penegakan di database (mgmt_terbuka(),
// mgmt_peran_saya, pagar RLS mgmt_gerbang); berkas ini untuk sakelar di Pengaturan, catatan di tab
// Anggota, dan pengingat pagi (service role). Sebelum SQL dijalankan: "belum terpasang" = perilaku lama.
// Murni (tanpa alias @/) agar bisa diuji dengan node --experimental-strip-types.
/* eslint-disable @typescript-eslint/no-explicit-any -- klien supabase diteruskan dari pemanggil */

export const KUNCI_GERBANG = "mgmt_terbuka_anggota";
export const emailStudio = (email?: string | null): boolean =>
  typeof email === "string" && email.trim().toLowerCase().endsWith("@invisual.studio");

/** Galat "fungsi tidak ada" dari PostgREST = management-gerbang.sql belum dijalankan. */
const fungsiTidakAda = (e: any): boolean =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function|does not exist/i.test(String(e.message || "")));

export type StatusGerbang = { terpasang: boolean; terbuka: boolean };

/** Untuk tampilan (akun yang login). Galat lain → dianggap tertutup. */
export async function statusGerbang(sb: any): Promise<StatusGerbang> {
  try {
    const { error } = await sb.rpc("mgmt_terbuka");
    if (error) return fungsiTidakAda(error) ? { terpasang: false, terbuka: true } : { terpasang: true, terbuka: false };
    const { data, error: e2 } = await sb.from("pengaturan").select("nilai").eq("kunci", KUNCI_GERBANG).maybeSingle();
    return { terpasang: true, terbuka: !e2 && data?.nilai === "true" };
  } catch {
    return { terpasang: false, terbuka: true };
  }
}

/** Simpan sakelar (hanya HR/@invisual.studio — ditegakkan RLS tabel pengaturan). Pesan galat atau null. */
export async function simpanGerbang(sb: any, terbuka: boolean): Promise<string | null> {
  try {
    const { error } = await sb.from("pengaturan").upsert({ kunci: KUNCI_GERBANG, nilai: terbuka ? "true" : "false" }, { onConflict: "kunci" });
    return error ? (error.message || "Gagal menyimpan.") : null;
  } catch (e: any) {
    return e?.message || "Gagal menyimpan.";
  }
}

/** Server (service role, tanpa email): mgmt_terbuka() = nilai sakelar. Belum dipasang → terbuka (perilaku lama);
 *  galat lain → tertutup (lebih aman: hanya akun @invisual.studio yang diingatkan). */
export async function gerbangTerbukaServer(sb: any): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("mgmt_terbuka");
    if (error) return fungsiTidakAda(error);
    return data === true;
  } catch {
    return true;
  }
}
