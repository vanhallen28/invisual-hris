// src/lib/management/akses.ts
// Peran & hak Section Management — CERMIN pemeriksaan peran di RPC management-p1.sql.
// Penegakan sebenarnya di database; matriks ini hanya untuk menampilkan/menyembunyikan tombol.
// Murni (tanpa alias @/) agar bisa diuji dengan node --experimental-strip-types.
/* eslint-disable @typescript-eslint/no-explicit-any -- klien supabase diteruskan dari pemanggil */

export type PeranManagement = "studio_manager" | "pm" | "hr" | "leader_sosmed" | "leader_service" | "leader_marketplace" | "owner";
export type Divisi = "sosmed" | "service" | "marketplace";
export type AksiManagement =
  | "terbitkan_pedoman" | "lihat_status_baca_semua" | "ajukan_usulan" | "teruskan_usulan" | "isi_dampak"
  | "putuskan_usulan" | "atas_nama_owner" | "kelola_anggota" | "atur_divisi_staf"
  | "serah_terima" | "tindaklanjuti" | "ringkasan_harian";

export const SEMUA_PERAN: PeranManagement[] = ["studio_manager", "pm", "hr", "leader_sosmed", "leader_service", "leader_marketplace", "owner"];
const LEADER: PeranManagement[] = ["leader_sosmed", "leader_service", "leader_marketplace"];

export const PERAN_LABEL: Record<PeranManagement, string> = {
  studio_manager: "Studio Manager", pm: "PM", hr: "HR",
  leader_sosmed: "Leader Sosmed", leader_service: "Leader Service", leader_marketplace: "Leader Marketplace", owner: "Owner",
};
export const DIVISI_LABEL: Record<string, string> = {
  sosmed: "Sosmed", service: "Service", marketplace: "Marketplace", hr: "HR", semua: "Semua", lainnya: "Lainnya",
};
/** Divisi wajib per peran leader (sama dengan mgmt_atur_anggota). */
export const DIVISI_LEADER: Partial<Record<PeranManagement, Divisi>> = {
  leader_sosmed: "sosmed", leader_service: "service", leader_marketplace: "marketplace",
};

// Sumber: PRD "Hak per peran".
const HAK: Record<AksiManagement, PeranManagement[]> = {
  terbitkan_pedoman: ["studio_manager", "pm"],
  lihat_status_baca_semua: ["studio_manager", "pm", "hr", "owner"],
  ajukan_usulan: SEMUA_PERAN,
  teruskan_usulan: ["studio_manager", "pm"],
  isi_dampak: ["hr", ...LEADER],
  putuskan_usulan: ["studio_manager"],
  atas_nama_owner: ["studio_manager"],
  kelola_anggota: ["studio_manager", "hr", "owner"],
  atur_divisi_staf: ["studio_manager", "hr"],
  serah_terima: ["studio_manager", "pm", ...LEADER, "owner"],
  tindaklanjuti: ["studio_manager", "pm"],
  ringkasan_harian: LEADER,
};

export const bisa = (peran: readonly PeranManagement[], aksi: AksiManagement): boolean => peran.some((p) => HAK[aksi].includes(p));
export const adalahLeader = (p: readonly PeranManagement[]): boolean => p.some((x) => LEADER.includes(x));
const peranSah = (x: unknown): x is PeranManagement => typeof x === "string" && (SEMUA_PERAN as string[]).includes(x);

/** Peran akun yang login. null = RPC belum ada / galat → fitur dianggap belum dipasang (menu disembunyikan). */
export async function muatPeranSaya(sb: any): Promise<PeranManagement[] | null> {
  try {
    const { data, error } = await sb.rpc("mgmt_peran_saya");
    if (error || !Array.isArray(data)) return null;
    return data.filter(peranSah);
  } catch {
    return null;
  }
}

/** Divisi yang diwakili akun (divisi leader + 'hr'). [] bila galat. */
export async function muatDivisiSaya(sb: any): Promise<string[]> {
  try {
    const { data, error } = await sb.rpc("mgmt_divisi_saya");
    return !error && Array.isArray(data) ? data.filter((x: unknown) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
