// src/lib/management/harian.ts
// Ringkasan Harian leader (PRD P2b): batas 18.00 WIB, hari yang dihitung (hari kerja, bukan libur, bukan cuti/izin/sakit
// Disetujui), validasi butir (maks 3 × 280 karakter) — CERMIN mgmt_kirim_ringkasan di management-p2.sql; + pemanggil data.
// Murni (tanpa alias @/) agar bisa diuji dengan node --experimental-strip-types.
/* eslint-disable @typescript-eslint/no-explicit-any -- klien supabase & baris tabel diteruskan dari pemanggil */
import type { PetaLibur } from "../hariLibur";
import { adalahHariKerja, instanWib, tambahHariIso } from "./hariKerja";
import { panggilRpc, type HasilRpc } from "./usulan";

export const BATAS_RINGKASAN = { jam: 18, menit: 0 } as const;
export const MAKS_BUTIR = 3;
export const MAKS_KARAKTER = 280;
const MAKS_HARI_PENGAJUAN = 366;

/** Tepat waktu bila KIRIM PERTAMA sebelum 18.00 WIB pada `tanggal` (suntingan sesudahnya tidak mengubah ini). */
export const ringkasanTepatWaktu = (dikirimPertamaPada: string, tanggal: string): boolean =>
  Date.parse(dikirimPertamaPada) < instanWib(tanggal.slice(0, 10), BATAS_RINGKASAN.jam, BATAS_RINGKASAN.menit).getTime();

/** Hari wajib ringkasan: hari kerja (Sen–Jum, bukan hari_libur.libur) dan leader tidak sedang cuti/izin/sakit Disetujui. */
export const hariDihitung = (tanggal: string, peta: PetaLibur | null, cutiDisetujui: Set<string>): boolean =>
  adalahHariKerja(tanggal, peta) && !cutiDisetujui.has(tanggal);

/** Butir yang dikirim (dirapikan, butir kosong dibuang). */
export const rapikanButir = (butir: string[]) => butir.map((x) => x.trim()).filter(Boolean);

/** Pesan galat bila butir melanggar batas; null bila sah. Pesan sama dengan RPC. */
export function validasiButir(butir: string[]): string | null {
  const b = rapikanButir(butir);
  if (b.length > MAKS_BUTIR) return `Maksimal ${MAKS_BUTIR} butir per isian.`;
  if (b.some((x) => x.length > MAKS_KARAKTER)) return `Setiap butir paling banyak ${MAKS_KARAKTER} karakter.`;
  return null;
}

/** Jenis pengajuan yang membebaskan dari Ringkasan Harian (sama dengan filter mgmt_cuti_leader). Bukan Izin Terlambat/WFH/WFC. */
export const jenisBebasRingkasan = (jenis: string) => /^cuti/i.test(String(jenis || "").trim()) || ["Izin Sakit", "Izin Tidak Masuk"].includes(String(jenis || "").trim());

/** Teks `approvals.tanggal` → daftar tanggal ISO. "YYYY-MM-DD", "A s/d B" (rentang, maks 366 hari), embel-embel diabaikan. */
export function tanggalPengajuan(teks: string): string[] {
  const [awal, akhir] = String(teks || "").match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (!awal) return [];
  if (!akhir || !/s\/d|sd|–|hingga|sampai/i.test(teks.replace(/\(.*\)/, ""))) return [awal];
  const out: string[] = [];
  for (let d = awal; d <= akhir && out.length < MAKS_HARI_PENGAJUAN; d = tambahHariIso(d, 1)) out.push(d);
  return out;
}

/** Baris mgmt_cuti_leader → Map<divisi, Set<tanggal>>. */
export function petaCutiLeader(baris: { divisi: string; tanggal: string }[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of baris || []) {
    const s = m.get(r.divisi) || new Set<string>();
    for (const t of tanggalPengajuan(r.tanggal)) s.add(t);
    m.set(r.divisi, s);
  }
  return m;
}

// ── Pemanggil data ──────────────────────────────────────────────────────────────────
/** true bila tabel mgmt_ringkasan_harian bisa dibaca (management-p2.sql sudah dijalankan). Kueri ringan, 1 baris. */
export async function adaRingkasanHarian(sb: any): Promise<boolean> {
  try {
    const { error } = await sb.from("mgmt_ringkasan_harian").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}

/** Leader aktif per divisi (nama untuk linimasa). [] bila galat. */
export async function muatLeader(sb: any): Promise<{ divisi: string; nama: string }[]> {
  try {
    const { data, error } = await sb.from("mgmt_anggota").select("nama, peran, divisi, aktif");
    if (error || !Array.isArray(data)) return [];
    return data.filter((a: any) => a.aktif && String(a.peran).startsWith("leader_") && a.divisi).map((a: any) => ({ divisi: a.divisi, nama: a.nama }));
  } catch {
    return [];
  }
}

export const kirimRingkasan = (sb: any, d: { tanggal: string; selesai: string[]; hambatan: string[]; butuhDivisi: string | null }): Promise<HasilRpc<{ dikirim_pertama_pada: string }>> =>
  panggilRpc(sb, "mgmt_kirim_ringkasan", { p_tanggal: d.tanggal, p_selesai: rapikanButir(d.selesai), p_hambatan: rapikanButir(d.hambatan), p_butuh_divisi: d.butuhDivisi || null });

/** Ringkasan pada rentang tanggal (inklusif). null = tabel belum ada / galat. */
export async function muatRingkasan(sb: any, dari: string, sampai: string): Promise<any[] | null> {
  try {
    const { data, error } = await sb.from("mgmt_ringkasan_harian").select("*").gte("tanggal", dari).lte("tanggal", sampai).order("tanggal", { ascending: false });
    return error ? null : (data || []);
  } catch {
    return null;
  }
}

/** Tanggal ringkasan PERTAMA yang pernah dikirim (awal fitur dipakai). null bila belum ada / galat. */
export async function muatAwalRingkasan(sb: any): Promise<string | null> {
  try {
    const { data, error } = await sb.from("mgmt_ringkasan_harian").select("tanggal").order("tanggal", { ascending: true }).limit(1);
    return !error && Array.isArray(data) && data[0]?.tanggal ? String(data[0].tanggal).slice(0, 10) : null;
  } catch {
    return null;
  }
}

/** Tanggal cuti/izin/sakit Disetujui milik leader (RPC terbatas). [] bila galat. */
export async function muatCutiLeader(sb: any, dari: string, sampai: string): Promise<{ divisi: string; tanggal: string }[]> {
  try {
    const { data, error } = await sb.rpc("mgmt_cuti_leader", { p_dari: dari, p_sampai: sampai });
    return !error && Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
