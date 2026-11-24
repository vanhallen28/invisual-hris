// src/lib/management/usulan.ts
// Log Usulan Perubahan — status, transisi, nomor (CERMIN RPC mgmt_* di management-p1.sql) + pemanggil RPC.
// Semua perubahan status hanya lewat RPC; aturan di sini dipakai untuk menampilkan tombol yang sah saja.
// Murni (tanpa alias @/) agar bisa diuji dengan node --experimental-strip-types.
/* eslint-disable @typescript-eslint/no-explicit-any -- klien supabase & baris tabel diteruskan dari pemanggil */

export type StatusUsulan = "diajukan" | "cek_dampak" | "siap_diputuskan" | "disetujui" | "uji_coba" | "ditolak" | "ditunda"
  | "berlaku" | "dicabut" | "diganti" | "berlaku_darurat" | "gugur" | "masa_keberatan";
export type JalurUsulan = "biasa" | "darurat" | "internal";
export type NilaiDampak = "tidak_berdampak" | "perlu_penyesuaian" | "bertentangan" | "tidak_mengisi";

export const TRANSISI: Record<StatusUsulan, StatusUsulan[]> = {
  diajukan: ["cek_dampak"],
  cek_dampak: ["siap_diputuskan"],
  siap_diputuskan: ["disetujui", "uji_coba", "ditolak", "ditunda"],
  ditunda: ["siap_diputuskan"],
  disetujui: ["berlaku"],
  uji_coba: ["berlaku", "dicabut", "diganti"],
  berlaku_darurat: ["disetujui", "ditolak", "gugur"],
  masa_keberatan: ["berlaku", "cek_dampak"],
  berlaku: [], ditolak: [], dicabut: [], diganti: [], gugur: [],
};
export const STATUS_AWAL: Record<JalurUsulan, StatusUsulan> = { biasa: "diajukan", darurat: "berlaku_darurat", internal: "masa_keberatan" };
export const LABEL_STATUS: Record<StatusUsulan, string> = {
  diajukan: "Diajukan", cek_dampak: "Cek dampak", siap_diputuskan: "Siap diputuskan", disetujui: "Disetujui",
  uji_coba: "Uji coba", ditolak: "Ditolak", ditunda: "Ditunda", berlaku: "Berlaku", dicabut: "Dicabut",
  diganti: "Diganti", berlaku_darurat: "Berlaku (darurat)", gugur: "Gugur", masa_keberatan: "Masa keberatan",
};
export const LABEL_JALUR: Record<JalurUsulan, string> = { biasa: "Biasa", darurat: "Darurat", internal: "Internal" };
export const LABEL_DAMPAK: Record<NilaiDampak, string> = {
  tidak_berdampak: "Tidak berdampak", perlu_penyesuaian: "Perlu penyesuaian", bertentangan: "Bertentangan", tidak_mengisi: "Tidak mengisi",
};
export const SUMBER_USULAN: { nilai: string; label: string }[] = [
  { nilai: "rapat", label: "Rapat" }, { nilai: "hr", label: "HR" }, { nilai: "leader", label: "Leader" },
  { nilai: "chat", label: "Chat/WA" }, { nilai: "owner", label: "Owner" }, { nilai: "pm", label: "PM" },
  { nilai: "studio_manager", label: "Studio Manager" },
];
/** Status usulan yang boleh ditautkan saat menerbitkan versi Pedoman. */
export const STATUS_BOLEH_TAUT: StatusUsulan[] = ["disetujui", "uji_coba", "berlaku_darurat", "berlaku", "gugur", "dicabut", "ditolak"];
export const BATAS_DARURAT_PER_BULAN = 2;
const BELUM: StatusUsulan[] = ["diajukan", "cek_dampak", "siap_diputuskan", "ditunda", "berlaku_darurat", "masa_keberatan"];

export const transisiSah = (dari: StatusUsulan, ke: StatusUsulan): boolean => (TRANSISI[dari] || []).includes(ke);
export const sudahDiputuskan = (s: StatusUsulan): boolean => !BELUM.includes(s);
export const formatNomorUsulan = (tahun: number, urut: number): string => `U-${tahun}-${String(urut).padStart(3, "0")}`;
/** Lebih dari 7 hari & belum diputuskan → label "Lewat 7 hari". */
export const umurMerah = (dibuatPada: string, status: StatusUsulan, sekarang: Date): boolean =>
  !sudahDiputuskan(status) && sekarang.getTime() - Date.parse(dibuatPada) > 7 * 86_400_000;
/** Usulan darurat dicatat > 24 jam setelah mulai berlaku (KPI SM3). */
export const terlambatDicatat = (dibuatPada: string, berlakuSejak: string | null | undefined): boolean =>
  !!berlakuSejak && Date.parse(dibuatPada) - Date.parse(berlakuSejak) > 24 * 3_600_000;

// ── Pemanggil RPC ────────────────────────────────────────────────────────────────────
export type HasilRpc<T = unknown> = { ok: boolean; pesan?: string; data?: T };

const belumDipasang = (e: any): boolean => {
  const kode = String(e?.code || "");
  const pesan = String(e?.message || e || "");
  return kode === "PGRST202" || kode === "42883" || kode === "42P01" || /does not exist|could not find the function/i.test(pesan);
};
const rapikan = (e: any): string => String(e?.message || e || "").replace(/^.*?ERROR:\s*/i, "").trim() || "Gagal menyimpan. Coba lagi.";

/** Panggil RPC Management → {ok, data} atau {ok:false, pesan} (pesan Indonesia dari database). */
export async function panggilRpc<T = any>(sb: any, fn: string, arg: Record<string, unknown> = {}): Promise<HasilRpc<T>> {
  try {
    const { data, error } = await sb.rpc(fn, arg);
    if (error) return { ok: false, pesan: belumDipasang(error) ? "Fitur Management belum dipasang." : rapikan(error) };
    return { ok: true, data: data as T };
  } catch (e: any) {
    return { ok: false, pesan: belumDipasang(e) ? "Fitur Management belum dipasang." : rapikan(e) };
  }
}

export const ajukanUsulan = (sb: any, d: { judul: string; masalah: string; perubahan: string; bagian: string; divisi: string[]; sumber: string; jalur: JalurUsulan; berlakuSejak?: string | null; atasNamaOwner?: boolean }) =>
  panggilRpc<{ id: string; nomor: string; status: StatusUsulan }>(sb, "mgmt_ajukan_usulan", {
    p_judul: d.judul, p_masalah: d.masalah, p_perubahan: d.perubahan, p_bagian: d.bagian, p_divisi: d.divisi,
    p_sumber: d.sumber, p_jalur: d.jalur, p_berlaku_sejak: d.berlakuSejak || null, p_atas_nama_owner: !!d.atasNamaOwner,
  });
export const teruskanUsulan = (sb: any, id: string, divisi: string[]) => panggilRpc(sb, "mgmt_teruskan_usulan", { p_id: id, p_divisi: divisi });
export const isiDampak = (sb: any, id: string, divisi: string, nilai: string, alasan: string) =>
  panggilRpc<{ status: StatusUsulan }>(sb, "mgmt_isi_dampak", { p_id: id, p_divisi: divisi, p_nilai: nilai, p_alasan: alasan || null });
export const putuskanUsulan = (sb: any, id: string, keputusan: StatusUsulan, alasan: string, opsi: { ujiCobaSampai?: string; rapatId?: string; penggantiId?: string } = {}) =>
  panggilRpc<{ status: StatusUsulan }>(sb, "mgmt_putuskan_usulan", {
    p_id: id, p_keputusan: keputusan, p_alasan: alasan, p_uji_coba_sampai: opsi.ujiCobaSampai || null,
    p_rapat_id: opsi.rapatId || null, p_pengganti_id: opsi.penggantiId || null,
  });
export const ajukanUlang = (sb: any, id: string) => panggilRpc(sb, "mgmt_ajukan_ulang", { p_id: id });
export const ajukanKeberatan = (sb: any, id: string, alasan: string) => panggilRpc(sb, "mgmt_keberatan", { p_id: id, p_alasan: alasan });
export const batasGugur = async (sb: any, berlakuSejak: string): Promise<string | null> => {
  const r = await panggilRpc<string>(sb, "mgmt_batas_gugur", { p_berlaku_sejak: berlakuSejak });
  return r.ok && typeof r.data === "string" ? r.data : null;
};

/** Semua usulan (terbaru dulu). null = tabel belum ada / galat. */
export async function muatUsulan(sb: any): Promise<any[] | null> {
  try {
    const { data, error } = await sb.from("mgmt_usulan").select("*").order("dibuat_pada", { ascending: false });
    return error ? null : (data || []);
  } catch {
    return null;
  }
}

/** Baris cek dampak semua usulan. [] bila galat. */
export async function muatDampak(sb: any): Promise<any[]> {
  try {
    const { data, error } = await sb.from("mgmt_usulan_dampak").select("*");
    return error ? [] : (data || []);
  } catch {
    return [];
  }
}
