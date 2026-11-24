// src/lib/management/pedoman.ts
// Pedoman Induk — daftar isi, slug, bagian, diff baris (murni) + pemanggil data.
// Murni (tanpa alias @/, impor antar-berkas hanya `import type`) agar bisa diuji dengan node --experimental-strip-types.
/* eslint-disable @typescript-eslint/no-explicit-any -- klien supabase & baris tabel diteruskan dari pemanggil */
import type { HasilRpc } from "./usulan";

export type Judul = { id: string; teks: string; level: 2 | 3 };
export type BarisDiff = { jenis: "sama" | "tambah" | "hapus"; teks: string };
export type VersiPedoman = {
  id: string; versi: string; isi_md: string; ringkasan_perubahan: string; status: "draf" | "berlaku" | "arsip";
  berlaku_mulai: string | null; diterbitkan_pada: string | null; diterbitkan_oleh?: string | null; pengesahan_awal?: boolean;
};

/** Slug judul untuk id penanda bagian: huruf kecil, tanpa diakritik, non-alfanumerik → "-". */
export const slug = (s: string): string =>
  s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Pembuat id unik berurutan: "x", "x-2", … — dipakai daftar isi DAN render agar id selalu sama. */
export function pembuatId(): (teks: string) => string {
  const dipakai = new Map<string, number>();
  return (teks: string) => {
    const dasar = slug(teks) || "bagian";
    const n = (dipakai.get(dasar) || 0) + 1;
    dipakai.set(dasar, n);
    return n === 1 ? dasar : `${dasar}-${n}`;
  };
}

/** Judul level 2–3 (abaikan baris di dalam pagar kode). */
export function daftarIsi(md: string): Judul[] {
  const hasil: Judul[] = [];
  const id = pembuatId();
  let dalamKode = false;
  for (const baris of String(md || "").split("\n")) {
    if (/^\s*`{3}/.test(baris)) { dalamKode = !dalamKode; continue; }
    if (dalamKode) continue;
    const m = /^(##|###)\s+(.+?)\s*#*\s*$/.exec(baris);
    if (!m) continue;
    hasil.push({ id: id(m[2]), teks: m[2], level: m[1].length as 2 | 3 });
  }
  return hasil;
}

/** Teks semua judul level 2 — pilihan isian "Bagian Pedoman yang terkena". */
export const bagianPedoman = (md: string): string[] => daftarIsi(md).filter((j) => j.level === 2).map((j) => j.teks);

/** Perbandingan per baris (LCS). */
export function diffBaris(lama: string, baru: string): BarisDiff[] {
  const a = String(lama ?? "").split("\n"), b = String(baru ?? "").split("\n");
  const n = a.length, m = b.length;
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: BarisDiff[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ jenis: "sama", teks: a[i] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ jenis: "hapus", teks: a[i] }); i++; }
    else { out.push({ jenis: "tambah", teks: b[j] }); j++; }
  }
  while (i < n) out.push({ jenis: "hapus", teks: a[i++] });
  while (j < m) out.push({ jenis: "tambah", teks: b[j++] });
  return out;
}

// ── Pemanggil data ──────────────────────────────────────────────────────────────────
// (Pemetaan galat sama dengan panggilRpc di usulan.ts; diulang di sini karena berkas murni tidak saling impor saat runtime.)
const belumDipasang = (e: any) =>
  ["PGRST202", "42883", "42P01"].includes(String(e?.code || "")) || /does not exist|could not find the function/i.test(String(e?.message || e || ""));
const pesanGalat = (e: any) =>
  belumDipasang(e) ? "Fitur Management belum dipasang." : String(e?.message || e || "").replace(/^.*?ERROR:\s*/i, "").trim() || "Gagal menyimpan. Coba lagi.";
async function rpc<T = any>(sb: any, fn: string, arg: Record<string, unknown> = {}): Promise<HasilRpc<T>> {
  try {
    const { data, error } = await sb.rpc(fn, arg);
    return error ? { ok: false, pesan: pesanGalat(error) } : { ok: true, data: data as T };
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) };
  }
}

/** Semua versi yang boleh dibaca akun ini (karyawan: berlaku & arsip; management: + draf). null = tabel belum ada. */
export async function muatVersi(sb: any): Promise<VersiPedoman[] | null> {
  try {
    const { data, error } = await sb.from("mgmt_pedoman_versi")
      .select("id, versi, isi_md, ringkasan_perubahan, status, berlaku_mulai, diterbitkan_pada, diterbitkan_oleh, pengesahan_awal")
      .order("dibuat_pada", { ascending: false });
    return error ? null : (data || []);
  } catch {
    return null;
  }
}

export async function sudahBaca(sb: any, versiId: string, userId: string): Promise<boolean> {
  try {
    const { data, error } = await sb.from("mgmt_pedoman_baca").select("versi_id").eq("versi_id", versiId).eq("user_id", userId).maybeSingle();
    return !error && !!data;
  } catch {
    return false;
  }
}

/** Catat "sudah membaca" (hanya milik sendiri; RLS menolak user lain). Sudah tercatat sebelumnya = sukses. */
export async function konfirmasiBaca(sb: any, versiId: string, userId: string): Promise<HasilRpc> {
  try {
    const { error } = await sb.from("mgmt_pedoman_baca").insert({ versi_id: versiId, user_id: userId });
    if (error && String(error.code) !== "23505") return { ok: false, pesan: pesanGalat(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, pesan: pesanGalat(e) };
  }
}

export const simpanDraf = (sb: any, versi: string, isiMd: string, ringkasan: string) =>
  rpc(sb, "mgmt_simpan_draf", { p_versi: versi, p_isi_md: isiMd, p_ringkasan: ringkasan });
export const terbitkanPedoman = (sb: any, berlakuMulai: string, usulan: string[], pengesahanAwal = false) =>
  rpc(sb, "mgmt_terbitkan_pedoman", { p_berlaku_mulai: berlakuMulai, p_usulan: usulan, p_pengesahan_awal: pengesahanAwal });
export const aturDivisiStaf = (sb: any, idKaryawan: string, divisi: string) =>
  rpc(sb, "mgmt_atur_divisi_staf", { p_id_karyawan: idKaryawan, p_divisi: divisi });

export type BarisStatusBaca = { id_karyawan: string; nama: string; divisi: string | null; sudah: boolean };
/** Status baca dihitung di server (cocok user_id ATAU email/emailLogin; hanya karyawan aktif yang punya akun). null = galat / tak berhak. */
export async function muatStatusBaca(sb: any, versiId: string): Promise<BarisStatusBaca[] | null> {
  const r = await rpc<BarisStatusBaca[]>(sb, "mgmt_status_baca", { p_versi: versiId });
  return r.ok && Array.isArray(r.data) ? r.data : null;
}

export type AturanInternal = { nomor: string; judul: string; divisi: string[]; perubahan: string; berlaku_sejak: string | null };
export async function muatAturanInternal(sb: any): Promise<AturanInternal[]> {
  const r = await rpc<AturanInternal[]>(sb, "mgmt_aturan_internal");
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

/** Baris tabel kecil (tautan versi↔usulan, konfirmasi baca, divisi staf). [] bila galat / tidak berhak. */
export async function muatBaris(sb: any, tabel: "mgmt_pedoman_usulan" | "mgmt_pedoman_baca" | "mgmt_divisi_staf", kolom = "*"): Promise<any[]> {
  try {
    const { data, error } = await sb.from(tabel).select(kolom);
    return error ? [] : (data || []);
  } catch {
    return [];
  }
}
