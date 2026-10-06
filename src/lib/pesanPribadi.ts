// src/lib/pesanPribadi.ts — lapisan data Pesan Pribadi (personal chat)
//
// Terpisah TOTAL dari chat channel (chat_channels / chat_messages): tabel,
// aturan akses, dan bucket lampirannya sendiri (lihat pesan-pribadi.sql).
// Aturan "karyawan hanya boleh dengan HR/manager" dijaga di database;
// kode di sini hanya memanggilnya.
type SB = any;

export const BUCKET_PESAN_PRIBADI = "pesan-pribadi";
export const MAKS_LAMPIRAN_MB = 10;

export type Peran = "HR" | "Manager" | "Karyawan";
export type Kontak = { id: string; nama: string; peran: Peran };
export type Utas = {
  id: string; anggota_a: string; anggota_b: string;
  terakhir_isi: string | null; terakhir_oleh: string | null; terakhir_pada: string | null;
  dibaca_a_pada: string | null; dibaca_b_pada: string | null; dibuat_pada: string;
};
export type Lampiran = { path: string; nama: string; tipe: string; ukuran: number };
export type Pesan = { id: string; utas_id: string; pengirim: string; isi: string; lampiran: Lampiran | null; dibuat_pada: string };

/** Galat karena SQL belum dijalankan (fungsi/tabel belum ada)? */
export function belumDipasang(e: any): boolean {
  const kode = String(e?.code || "");
  const pesan = String(e?.message || e || "").toLowerCase();
  return kode === "PGRST202" || kode === "PGRST205" || kode === "42883" || kode === "42P01"
    || pesan.includes("could not find the function") || pesan.includes("does not exist") || pesan.includes("schema cache");
}

const lempar = (error: any) => { const e: any = new Error(error?.message || String(error)); e.code = error?.code; throw e; };

export async function muatKontak(supabase: SB): Promise<Kontak[]> {
  const { data, error } = await supabase.rpc("pp_kontak");
  if (error) lempar(error);
  return (data || []).map((k: any) => ({ id: String(k.id), nama: String(k.nama || "Tanpa nama"), peran: (k.peran as Peran) || "Karyawan" }));
}

export async function muatUtas(supabase: SB): Promise<Utas[]> {
  const { data, error } = await supabase.from("pesan_pribadi_utas").select("*").order("terakhir_pada", { ascending: false, nullsFirst: false }).limit(500);
  if (error) lempar(error);
  return data || [];
}

export async function bukaUtas(supabase: SB, lawanId: string): Promise<string> {
  const { data, error } = await supabase.rpc("pp_buka_utas", { p_lawan: lawanId });
  if (error) lempar(error);
  return String(data);
}

/** Pesan terbaru (atau lebih lama dari `sebelum`), urut lama → baru. */
export async function muatPesan(supabase: SB, utasId: string, sebelum?: string | null, batas = 50): Promise<Pesan[]> {
  let q = supabase.from("pesan_pribadi").select("*").eq("utas_id", utasId);
  if (sebelum) q = q.lt("dibuat_pada", sebelum);
  const { data, error } = await q.order("dibuat_pada", { ascending: false }).limit(batas);
  if (error) lempar(error);
  return (data || []).slice().reverse();
}

export async function kirimPesan(supabase: SB, utasId: string, isi: string, lampiran?: Lampiran | null): Promise<Pesan> {
  const { data, error } = await supabase.from("pesan_pribadi").insert({ utas_id: utasId, isi, lampiran: lampiran || null }).select().single();
  if (error) lempar(error);
  return data;
}

export async function hapusPesan(supabase: SB, p: Pesan): Promise<void> {
  const { error } = await supabase.from("pesan_pribadi").delete().eq("id", p.id);
  if (error) lempar(error);
  if (p.lampiran?.path) { try { await supabase.storage.from(BUCKET_PESAN_PRIBADI).remove([p.lampiran.path]); } catch { /* diamkan */ } }
}

export async function tandaiDibaca(supabase: SB, utasId: string): Promise<void> {
  try { await supabase.rpc("pp_tandai_dibaca", { p_utas: utasId }); } catch { /* lencana saja; jangan ganggu */ }
}

/** Jumlah belum dibaca per utas. null = gagal / fitur belum dipasang (SQL belum dijalankan). */
export async function belumDibaca(supabase: SB): Promise<Record<string, number> | null> {
  try {
    const { data, error } = await supabase.rpc("pp_belum_dibaca");
    if (error) return null;
    const out: Record<string, number> = {};
    (data || []).forEach((r: any) => { if (r?.utas_id) out[String(r.utas_id)] = Number(r.jumlah) || 0; });
    return out;
  } catch { return null; }
}

export const totalBelum = (m: Record<string, number> | null | undefined) => Object.values(m || {}).reduce((a, b) => a + (b || 0), 0);

/** Nama event jendela: ruang Pesan Pribadi melaporkan total belum dibaca ke lencana sidebar. */
export const EVENT_BELUM_DIBACA = "pesan-pribadi-belum-dibaca";

export async function unggahLampiran(supabase: SB, utasId: string, file: File): Promise<Lampiran> {
  if (file.size > MAKS_LAMPIRAN_MB * 1024 * 1024) throw new Error(`Ukuran berkas maksimal ${MAKS_LAMPIRAN_MB} MB.`);
  const aman = file.name.replace(/[^\w.\-]/g, "_").slice(-80) || "berkas";
  const path = `${utasId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${aman}`;
  const { error } = await supabase.storage.from(BUCKET_PESAN_PRIBADI).upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) lempar(error);
  return { path, nama: file.name, tipe: file.type || "", ukuran: file.size };
}

/** Tautan sementara (1 jam) untuk lampiran. */
export async function urlLampiran(supabase: SB, paths: string[]): Promise<Record<string, string>> {
  const unik = Array.from(new Set(paths.filter(Boolean)));
  const out: Record<string, string> = {};
  if (!unik.length) return out;
  try {
    const { data } = await supabase.storage.from(BUCKET_PESAN_PRIBADI).createSignedUrls(unik, 3600);
    (data || []).forEach((d: any) => { if (d?.signedUrl && d?.path) out[d.path] = d.signedUrl; });
  } catch { /* diamkan */ }
  return out;
}

/** Lawan bicara dalam utas. */
export const lawanDari = (u: Utas, saya: string) => (u.anggota_a === saya ? u.anggota_b : u.anggota_a);

/** Kapan lawan terakhir membaca utas ini. */
export const dibacaLawan = (u: Utas, saya: string) => (u.anggota_a === saya ? u.dibaca_b_pada : u.dibaca_a_pada);

export const ukuranTeks = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
