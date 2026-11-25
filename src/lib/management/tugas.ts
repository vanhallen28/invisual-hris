// src/lib/management/tugas.ts
// Management → Tugas (tugas.sql): alur harian leader yang searah —
//   Pagi: maks. 3 Fokus hari ini → Siang: ubah status, centang tugas rutin → Sore: Ringkasan Harian
//   (terisi dari fokus & tugas yang selesai) → dibaca management.
// Centang OTOMATIS memakai aturan yang sama dengan panel "Perlu tindakan" (hitungPerluTindakan), jadi
// keduanya tidak pernah berbeda pendapat. Murni (tanpa alias @/) agar bisa diuji node.
/* eslint-disable @typescript-eslint/no-explicit-any -- klien supabase & baris tabel diteruskan dari pemanggil */
import type { ItemTindakan } from "./perluTindakan";
import { panggilRpc, type HasilRpc } from "./usulan";

export type Ritme = "harian" | "mingguan" | "bulanan";
export type SumberOtomatis = "ringkasan_harian" | "serah_terima" | "tindak_lanjut" | "teruskan_usulan" | "putuskan_usulan" | "review_dea" | "kalender_bulanan" | "cuti";
export type ButirRutin = { id: string; judul: string; ritme: Ritme; waktu?: string; otomatis?: SumberOtomatis };
export type StatusFokus = "belum" | "sedang" | "selesai";
export type Fokus = { id: string; anggota_id: string; tanggal: string; judul: string; asal: "tugas" | "serah_terima" | "sendiri"; ref_id: string | null; status: StatusFokus; terbawa: boolean; urutan: number };
export type Tugas = { id: string; judul: string; catatan: string | null; untuk_anggota: string; dari_email: string; tenggat: string; status: "berjalan" | "selesai" | "batal"; selesai_pada: string | null; alasan_batal: string | null; dibuat_pada: string };
export type Anggota = { id: string; nama: string; email: string; peran: string; divisi: string | null; aktif: boolean };

export const MAKS_FOKUS = 3;
export const LABEL_STATUS_FOKUS: Record<StatusFokus, string> = { belum: "Belum mulai", sedang: "Sedang dikerjakan", selesai: "Selesai" };
export const LABEL_RITME: Record<Ritme, string> = { harian: "Hari ini", mingguan: "Minggu ini", bulanan: "Bulan ini" };

// ── Waktu (WIB) ───────────────────────────────────────────────────────────────────
const WIB = 7 * 3_600_000;
/** "YYYY-MM-DD" hari ini di WIB. */
export const hariIniWib = (sekarang: Date) => new Date(sekarang.getTime() + WIB).toISOString().slice(0, 10);
/** Menit sejak 00.00 WIB. */
export const menitWib = (sekarang: Date) => { const d = new Date(sekarang.getTime() + WIB); return d.getUTCHours() * 60 + d.getUTCMinutes(); };

/** Minggu ISO "IYYY-Www" (CERMIN to_char(…, 'IYYY-"W"IW') di tugas.sql). */
export function mingguIso(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const hari = (d.getUTCDay() + 6) % 7;                 // Senin = 0
  d.setUTCDate(d.getUTCDate() - hari + 3);              // Kamis minggu ini menentukan tahun ISO
  const tahun = d.getUTCFullYear();
  const kamisPertama = new Date(Date.UTC(tahun, 0, 4));
  const minggu = 1 + Math.round(((d.getTime() - kamisPertama.getTime()) / 86_400_000 - 3 + ((kamisPertama.getUTCDay() + 6) % 7)) / 7);
  return `${tahun}-W${String(minggu).padStart(2, "0")}`;
}
/** Periode berjalan sebuah ritme (CERMIN mgmt_periode_rutin). */
export const periodeRutin = (ritme: Ritme, iso: string): string =>
  ritme === "harian" ? iso.slice(0, 10) : ritme === "mingguan" ? mingguIso(iso) : iso.slice(0, 7);

/** Langkah alur harian: 1 rencana pagi (< 10.00), 2 kerjakan, 3 ringkasan (≥ 17.30), 4 sudah kirim. */
export function langkahSekarang(sekarang: Date, ringkasanTerkirim: boolean): 1 | 2 | 3 | 4 {
  if (ringkasanTerkirim) return 4;
  const m = menitWib(sekarang);
  return m < 10 * 60 ? 1 : m < 17 * 60 + 30 ? 2 : 3;
}

// ── Tugas yang diberikan ──────────────────────────────────────────────────────────
export type WarnaTugas = "merah" | "kuning" | "normal" | "selesai" | "batal";
/** Merah: lewat tenggat. Kuning: sisa < 25% durasi (seperti kartu serah terima). */
export function warnaTugas(t: Pick<Tugas, "status" | "tenggat" | "dibuat_pada">, sekarang: Date): WarnaTugas {
  if (t.status === "selesai") return "selesai";
  if (t.status === "batal") return "batal";
  const tg = Date.parse(t.tenggat), s = sekarang.getTime();
  if (s > tg) return "merah";
  return tg - s < 0.25 * (tg - Date.parse(t.dibuat_pada)) ? "kuning" : "normal";
}
export const tugasTepatWaktu = (t: Pick<Tugas, "selesai_pada" | "tenggat">): boolean | null => (t.selesai_pada ? Date.parse(t.selesai_pada) <= Date.parse(t.tenggat) : null);

/** Kolom papan: berjalan (belum lewat), terlambat (berjalan & lewat), selesai minggu ini (Senin 00.00 WIB). */
export function kolomPapan(tugas: Tugas[], sekarang: Date): { berjalan: Tugas[]; terlambat: Tugas[]; selesai: Tugas[] } {
  const iso = hariIniWib(sekarang);
  const d = new Date(`${iso}T00:00:00Z`); const hari = (d.getUTCDay() + 6) % 7;
  const awalMinggu = Date.parse(`${new Date(d.getTime() - hari * 86_400_000).toISOString().slice(0, 10)}T00:00:00+07:00`);
  const urut = (a: Tugas, b: Tugas) => Date.parse(a.tenggat) - Date.parse(b.tenggat);
  return {
    berjalan: tugas.filter((t) => t.status === "berjalan" && Date.parse(t.tenggat) >= sekarang.getTime()).sort(urut),
    terlambat: tugas.filter((t) => t.status === "berjalan" && Date.parse(t.tenggat) < sekarang.getTime()).sort(urut),
    selesai: tugas.filter((t) => t.status === "selesai" && t.selesai_pada && Date.parse(t.selesai_pada) >= awalMinggu).sort((a, b) => Date.parse(b.selesai_pada!) - Date.parse(a.selesai_pada!)),
  };
}

// ── Centang otomatis ──────────────────────────────────────────────────────────────
/** Status sumber otomatis untuk SATU orang, dari item "Perlu tindakan" miliknya + data harian.
 *  null = tidak bisa dipastikan di sini (mis. cuti: approvals hanya terbaca HR) → tidak dihitung. */
export function statusOtomatis(k: { items: ItemTindakan[]; ringkasanTerkirim: boolean | null; kalenderDiajukan: boolean | null; leader: boolean }): Record<SumberOtomatis, boolean | null> {
  const ada = (awal: string, syarat: (i: ItemTindakan) => boolean = () => true) => k.items.some((i) => i.kunci.startsWith(awal) && syarat(i));
  return {
    ringkasan_harian: k.leader ? k.ringkasanTerkirim : null,
    serah_terima: !ada("st-masuk:", (i) => i.mendesak),
    tindak_lanjut: !ada("st-terlambat:"),
    teruskan_usulan: !ada("teruskan:"),
    putuskan_usulan: !ada("putuskan:"),
    review_dea: !ada("review:"),
    kalender_bulanan: k.kalenderDiajukan,
    cuti: null,
  };
}
/** Kalender/jadwal bulan depan sudah diajukan: kartu kalender_bulanan dari divisi ini bertenggat bulan ini & selesai. */
export function kalenderDiajukan(serahTerima: any[] | null, divisi: string[], isoHariIni: string): boolean | null {
  if (!serahTerima || !divisi.length) return null;
  const bulan = isoHariIni.slice(0, 7);
  const kartu = serahTerima.filter((k) => k.jenis === "kalender_bulanan" && divisi.includes(k.dari_divisi) && k.status !== "batal"
    && new Date(Date.parse(k.tenggat) + WIB).toISOString().slice(0, 7) === bulan);
  return kartu.some((k) => k.status === "selesai");
}

export type StatusButir = { butir: ButirRutin; periode: string; selesai: boolean | null; otomatis: boolean };
export function statusRutin(rutin: ButirRutin[], cek: { rutin_id: string; periode: string }[], oto: Record<SumberOtomatis, boolean | null>, isoHariIni: string): StatusButir[] {
  const sudah = new Set(cek.map((c) => `${c.rutin_id}|${c.periode}`));
  return rutin.map((b) => {
    const periode = periodeRutin(b.ritme, isoHariIni);
    return b.otomatis
      ? { butir: b, periode, selesai: oto[b.otomatis] ?? null, otomatis: true }
      : { butir: b, periode, selesai: sudah.has(`${b.id}|${periode}`), otomatis: false };
  });
}
/** Hitungan per ritme (butir yang tidak bisa dipastikan tidak dihitung). */
export function hitungKepatuhan(st: StatusButir[]): Record<Ritme, { selesai: number; total: number }> {
  const out = { harian: { selesai: 0, total: 0 }, mingguan: { selesai: 0, total: 0 }, bulanan: { selesai: 0, total: 0 } };
  for (const s of st) { if (s.selesai === null) continue; out[s.butir.ritme].total++; if (s.selesai) out[s.butir.ritme].selesai++; }
  return out;
}

// ── Ringkasan Harian terisi dari Tugas ────────────────────────────────────────────
/** Selesai = fokus selesai + tugas & serah terima yang selesai hari ini (maks. 3, tanpa ganda).
 *  Hambatan = fokus yang belum selesai, diakhiri " — " supaya leader tinggal menulis alasannya (maks. 3). */
export function isiRingkasan(d: { fokus: Fokus[]; tugasSelesai: string[]; serahTerimaSelesai: string[] }): { selesai: string[]; hambatan: string[] } {
  const unik = (xs: string[]) => {   // tanpa ganda (abaikan huruf besar/kecil); ejaan pertama yang dipakai
    const lihat = new Set<string>();
    return xs.map((x) => x.trim()).filter((x) => x && !lihat.has(x.toLowerCase()) && !!lihat.add(x.toLowerCase()));
  };
  const selesai = unik([...d.fokus.filter((f) => f.status === "selesai").map((f) => f.judul), ...d.tugasSelesai, ...d.serahTerimaSelesai]).slice(0, 3);
  const hambatan = d.fokus.filter((f) => f.status !== "selesai").map((f) => `${f.judul.trim()} — `).slice(0, 3);
  return { selesai, hambatan };
}

// ── Muat & RPC ────────────────────────────────────────────────────────────────────
/** Tab Tugas hanya tampil bila tugas.sql terpasang & tabel terbaca. */
export async function adaTugas(sb: any): Promise<boolean> {
  try {
    const { error } = await sb.from("mgmt_tugas").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
}
const baca = async (q: any) => { try { const { data, error } = await q; return error ? null : data; } catch { return null; } };

export type DataTugas = { anggota: Anggota[]; idSaya: string | null; rutinPeran: { peran: string; judul: string; rutin: ButirRutin[] }[]; fokusSaya: Fokus[] | null; fokusHariIni: Fokus[]; cek: { anggota_id: string; rutin_id: string; periode: string }[]; tugas: Tugas[] };

export async function muatDataTugas(sb: any, isoHariIni: string): Promise<DataTugas | null> {
  const awalBulanLalu = `${new Date(Date.parse(`${isoHariIni.slice(0, 7)}-01T00:00:00Z`) - 86_400_000).toISOString().slice(0, 7)}-01`;
  const periode = [periodeRutin("harian", isoHariIni), periodeRutin("mingguan", isoHariIni), periodeRutin("bulanan", isoHariIni)];
  const [anggota, id, rutinPeran, fokus, cek, tugas] = await Promise.all([
    baca(sb.from("mgmt_anggota").select("id,nama,email,peran,divisi,aktif").eq("aktif", true).order("nama")),
    baca(sb.rpc("mgmt_anggota_id_saya")),
    baca(sb.rpc("mgmt_rutin_peran")),
    baca(sb.from("mgmt_fokus").select("*").eq("tanggal", isoHariIni).order("urutan")),
    baca(sb.from("mgmt_rutin_cek").select("anggota_id,rutin_id,periode").in("periode", periode)),
    baca(sb.from("mgmt_tugas").select("*").or(`status.eq.berjalan,dibuat_pada.gte.${awalBulanLalu}`).order("tenggat").limit(500)),
  ]);
  if (!anggota || !tugas) return null;
  const idSaya = typeof id === "string" && id ? id : null;
  // Fokus saya lewat RPC: membawa fokus yang belum selesai dari hari kerja sebelumnya (sekali per hari).
  const fokusSaya = idSaya ? (((await baca(sb.rpc("mgmt_fokus_hari_ini"))) as Fokus[] | null) ?? ((fokus as Fokus[] | null) || []).filter((f) => f.anggota_id === idSaya)) : null;
  const lain = ((fokus as Fokus[] | null) || []).filter((f) => f.anggota_id !== idSaya);
  return {
    anggota: anggota as Anggota[], idSaya,
    rutinPeran: Array.isArray(rutinPeran) ? (rutinPeran as any[]).map((r) => ({ peran: String(r.peran), judul: String(r.judul || ""), rutin: Array.isArray(r.rutin) ? r.rutin : [] })) : [],
    fokusSaya, fokusHariIni: [...lain, ...(fokusSaya || [])],
    cek: (cek as any[]) || [], tugas: tugas as Tugas[],
  };
}

export const beriTugas = (sb: any, d: { untuk: string; judul: string; catatan?: string | null; tenggat: string }): Promise<HasilRpc<{ id: string }>> =>
  panggilRpc(sb, "mgmt_beri_tugas", { p_untuk: d.untuk, p_judul: d.judul, p_catatan: d.catatan || null, p_tenggat: d.tenggat });
export const selesaikanTugas = (sb: any, id: string) => panggilRpc(sb, "mgmt_selesaikan_tugas", { p_id: id });
export const batalkanTugas = (sb: any, id: string, alasan: string) => panggilRpc(sb, "mgmt_batalkan_tugas", { p_id: id, p_alasan: alasan });
export const tambahFokus = (sb: any, judul: string, asal: Fokus["asal"], ref: string | null) => panggilRpc(sb, "mgmt_tambah_fokus", { p_judul: judul, p_asal: asal, p_ref: ref });
export const ubahFokus = (sb: any, id: string, status: StatusFokus) => panggilRpc(sb, "mgmt_ubah_fokus", { p_id: id, p_status: status });
export const hapusFokus = (sb: any, id: string) => panggilRpc(sb, "mgmt_hapus_fokus", { p_id: id });
export const centangRutin = (sb: any, rutinId: string, cek: boolean) => panggilRpc(sb, "mgmt_centang_rutin", { p_rutin_id: rutinId, p_cek: cek });

/** Validasi formulir "Tugas baru" (cermin mgmt_beri_tugas). */
export function validasiTugasBaru(d: { untuk: string; judul: string; catatan?: string; tenggat: string }, sekarang: Date): string | null {
  if (!d.untuk) return "Pilih penerima tugas.";
  const j = d.judul.trim();
  if (!j || j.length > 200) return "Judul tugas wajib diisi (maks. 200 karakter).";
  if ((d.catatan || "").length > 1000) return "Catatan maks. 1000 karakter.";
  const t = Date.parse(d.tenggat);
  if (!Number.isFinite(t)) return "Isi tenggat.";
  if (t < sekarang.getTime()) return "Tenggat tidak boleh di masa lalu.";
  if (t > sekarang.getTime() + 180 * 86_400_000) return "Tenggat paling jauh 180 hari ke depan.";
  return null;
}
