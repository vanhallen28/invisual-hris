// src/lib/management/serahTerima.ts
// Serah terima lintas divisi — tenggat per jenis (CERMIN mgmt_tenggat_serah_terima di management-p2.sql),
// penanggung jawab otomatis, warna kartu, batas tindak lanjut PM, ketepatan; + pemanggil RPC.
// Murni (tanpa alias @/) agar bisa diuji dengan node --experimental-strip-types.
/* eslint-disable @typescript-eslint/no-explicit-any -- klien supabase & baris tabel diteruskan dari pemanggil */
import type { PetaLibur } from "../hariLibur";
import type { PeranManagement } from "./akses";
import { JAM_MULAI, JAM_SELESAI, adalahHariKerja, instanWib, isoWib, tambahHariIso, tambahJamKerja } from "./hariKerja";
import { panggilRpc, type HasilRpc } from "./usulan";

export type JenisSerahTerima = "calon_klien" | "kartu_proyek" | "review_dea" | "portofolio" | "info_rilis" | "qc_studio_project" | "kalender_bulanan" | "lainnya";
export type Warna = "selesai" | "merah" | "kuning" | "normal";

export const JENIS_SERAH_TERIMA: JenisSerahTerima[] = ["calon_klien", "kartu_proyek", "review_dea", "portofolio", "info_rilis", "qc_studio_project", "kalender_bulanan", "lainnya"];
export const LABEL_JENIS: Record<JenisSerahTerima, string> = {
  calon_klien: "Calon klien → Dea", kartu_proyek: "Kartu proyek", review_dea: "Review Dea", portofolio: "Portofolio ke Sosmed",
  info_rilis: "Info rilis ke Sosmed", qc_studio_project: "QC studio project", kalender_bulanan: "Kalender bulan depan", lainnya: "Lainnya",
};
/** Keterangan "selesai saat …" per jenis (PRD P2a). */
export const SELESAI_SAAT: Record<JenisSerahTerima, string> = {
  calon_klien: "Ditandai diteruskan ke Dea", kartu_proyek: "Tautan kartu Daily Task (CLIENT WORK) diisi", review_dea: "Keputusan Dea dicatat: disetujui atau revisi",
  portofolio: "Kartu dikirim ke Sosmed", info_rilis: "Kartu dikirim ke Sosmed", qc_studio_project: "QC ditandai selesai (lolos atau tidak)",
  kalender_bulanan: "Kalender atau jadwal rilis diajukan", lainnya: "Ditandai selesai",
};
/** Durasi dalam jam kerja (1 hari kerja = 9 jam). Jenis lain memakai tanggal. */
export const DURASI_JAM: Partial<Record<JenisSerahTerima, number>> = { calon_klien: 9, kartu_proyek: 9, review_dea: 9, portofolio: 27, qc_studio_project: 18 };
export const DIVISI_SERAH_TERIMA = ["sosmed", "service", "marketplace", "hr", "pm", "owner"] as const;
export const pakaiMulai = (j: JenisSerahTerima) => DURASI_JAM[j] !== undefined;

export function tenggatSerahTerima(jenis: JenisSerahTerima, i: { mulai?: Date | null; tanggalRilis?: string | null; bulanRencana?: string | null; tenggatManual?: Date | null }, peta?: PetaLibur | null): Date {
  const durasi = DURASI_JAM[jenis];
  if (durasi) { if (!i.mulai) throw new Error("Waktu mulai wajib diisi untuk jenis ini."); return tambahJamKerja(i.mulai, durasi, peta); }
  if (jenis === "info_rilis") { if (!i.tanggalRilis) throw new Error("Tanggal rilis wajib diisi."); return instanWib(tambahHariIso(i.tanggalRilis.slice(0, 10), -3), JAM_SELESAI); }
  if (jenis === "kalender_bulanan") {
    if (!i.bulanRencana) throw new Error("Bulan rencana wajib diisi.");
    const akhirBulanLalu = tambahHariIso(`${i.bulanRencana.slice(0, 7)}-01`, -1);   // tanggal 25 bulan sebelumnya, walau libur
    return instanWib(`${akhirBulanLalu.slice(0, 7)}-25`, JAM_SELESAI);
  }
  if (!i.tenggatManual) throw new Error("Tenggat wajib diisi untuk jenis Lainnya.");
  return i.tenggatManual;
}

/** Penanggung jawab otomatis (sama dengan mgmt_buat_serah_terima). null = dipilih pembuat (Lainnya). */
export function pjOtomatis(jenis: JenisSerahTerima, dari: string): PeranManagement | null {
  switch (jenis) {
    case "calon_klien": return "leader_sosmed";
    case "kartu_proyek": case "portofolio": return "leader_service";
    case "review_dea": return "owner";
    case "info_rilis": case "qc_studio_project": return "leader_marketplace";
    case "kalender_bulanan": return dari === "sosmed" ? "leader_sosmed" : "leader_marketplace";
    default: return null;
  }
}

/** Batas tindak lanjut PM (KPI PM2): tenggat 09–15 → 18.00 hari itu; ≥15.00 → 12.00 hari kerja berikutnya;
 *  di luar hari kerja / sebelum 09.00 → 12.00 hari kerja pertama sejak tenggat. */
export function batasTindakLanjut(tenggat: Date, peta?: PetaLibur | null): Date {
  const iso = isoWib(tenggat);
  const jamWib = (tenggat.getTime() - instanWib(iso, 0).getTime()) / 3_600_000;
  if (adalahHariKerja(iso, peta) && jamWib >= JAM_MULAI && jamWib < 15) return instanWib(iso, JAM_SELESAI);
  let d = adalahHariKerja(iso, peta) && jamWib < JAM_MULAI ? iso : tambahHariIso(iso, 1);
  for (let i = 0; i < 400 && !adalahHariKerja(d, peta); i++) d = tambahHariIso(d, 1);
  return instanWib(d, 12);
}

/** Merah: lewat tenggat. Kuning: sisa < 25% durasi (dari mulai, atau dibuat bila tanpa mulai). */
export function warnaKartu(k: { status: string; dibuatPada: string; mulai?: string | null; tenggat: string }, sekarang: Date): Warna {
  if (k.status !== "berjalan") return "selesai";
  const t = Date.parse(k.tenggat), s = sekarang.getTime();
  if (s > t) return "merah";
  const awal = Date.parse(k.mulai || k.dibuatPada);
  return t - s < 0.25 * (t - awal) ? "kuning" : "normal";
}

/** true/false bila selesai; null bila belum selesai. */
export const tepatWaktu = (k: { tenggat: string; selesaiPada: string | null }): boolean | null =>
  k.selesaiPada ? Date.parse(k.selesaiPada) <= Date.parse(k.tenggat) : null;

/** Tautan item Daily Task: URL http(s) atau id item polos. Skema lain (javascript:, data:, …) ditolak. */
export const tautanSah = (t: string) => /^https?:\/\/\S+$/i.test(t) || /^[\w.\-#/]+$/.test(t);
export const tautanUrl = (t: string | null | undefined) => (t && /^https?:\/\/\S+$/i.test(t) ? t : null);

// ── Pemanggil data ──────────────────────────────────────────────────────────────────
/** true bila tabel mgmt_serah_terima bisa dibaca (management-p2.sql sudah dijalankan). Kueri ringan, 1 baris. */
export async function adaSerahTerima(sb: any): Promise<boolean> {
  try {
    const { error } = await sb.from("mgmt_serah_terima").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

/** Kartu serah terima. `sejak` (YYYY-MM-DD) → hanya yang berjalan + yang dibuat/selesai sejak tanggal itu (beban tidak tumbuh terus). */
export async function muatSerahTerima(sb: any, sejak?: string): Promise<any[] | null> {
  try {
    let q = sb.from("mgmt_serah_terima").select("*");
    if (sejak && /^\d{4}-\d{2}-\d{2}$/.test(sejak)) q = q.or(`status.eq.berjalan,selesai_pada.gte.${sejak},dibuat_pada.gte.${sejak}`);
    const { data, error } = await q.order("tenggat", { ascending: true });
    return error ? null : (data || []);
  } catch {
    return null;
  }
}

export const buatSerahTerima = (sb: any, d: { jenis: JenisSerahTerima; dari: string; ke: string; judul: string; catatan?: string | null; mulai?: string | null;
  tanggalRilis?: string | null; bulanRencana?: string | null; tenggatManual?: string | null; tautanItem?: string | null; peranPj?: string | null }): Promise<HasilRpc<{ id: string; tenggat: string }>> =>
  panggilRpc(sb, "mgmt_buat_serah_terima", {
    p_jenis: d.jenis, p_dari: d.dari, p_ke: d.ke, p_judul: d.judul, p_catatan: d.catatan || null, p_mulai: d.mulai || null,
    p_tanggal_rilis: d.tanggalRilis || null, p_bulan_rencana: d.bulanRencana || null, p_tenggat_manual: d.tenggatManual || null,
    p_tautan_item: d.tautanItem || null, p_peran_pj: d.peranPj || null,
  });
export const selesaikanSerahTerima = (sb: any, id: string, hasil?: string | null, tautan?: string | null) =>
  panggilRpc<{ tepat_waktu: boolean }>(sb, "mgmt_selesaikan_serah_terima", { p_id: id, p_hasil: hasil || null, p_tautan_item: tautan || null });
export const tindaklanjuti = (sb: any, id: string, catatan: string) => panggilRpc(sb, "mgmt_tindaklanjuti", { p_id: id, p_catatan: catatan });
export const ubahMulai = (sb: any, id: string, mulai: string, alasan: string) => panggilRpc(sb, "mgmt_ubah_mulai", { p_id: id, p_mulai: mulai, p_alasan: alasan });
export const batalkanSerahTerima = (sb: any, id: string, alasan: string) => panggilRpc(sb, "mgmt_batalkan_serah_terima", { p_id: id, p_alasan: alasan });
