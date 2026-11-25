// src/lib/struktur/struktur.ts
// Struktur Perusahaan (struktur.sql): posisi Owner → Studio Manager → PM & HR → 3 Leader → staf per divisi.
// Baca lewat RPC org_struktur() (hak lihat ditentukan database: @invisual.studio selalu, karyawan lain bila
// sakelar `struktur_terbuka` nyala). Tulis hanya lewat RPC (hanya @invisual.studio).
// Murni (tanpa alias @/) agar bisa diuji dengan node --experimental-strip-types.
/* eslint-disable @typescript-eslint/no-explicit-any -- klien supabase diteruskan dari pemanggil */

export type JenisPosisi = "owner" | "studio_manager" | "pm" | "hr" | "leader" | "staf";
export type Divisi = "sosmed" | "service" | "marketplace" | "lainnya";
export type Ritme = "harian" | "mingguan" | "bulanan";
export type SumberOtomatis = "ringkasan_harian" | "serah_terima" | "tindak_lanjut" | "teruskan_usulan" | "putuskan_usulan" | "review_dea" | "kalender_bulanan" | "cuti";
export type ButirRutin = { id: string; judul: string; ritme: Ritme; waktu?: string; otomatis?: SumberOtomatis };

export type Posisi = {
  id: string; jenis: JenisPosisi; judul: string; divisi: Divisi | null; peran_mgmt: string | null;
  pemegang_manual: string[]; urutan: number; jobdesk_md: string; sop_md: string; rutin: ButirRutin[];
  bagian_pedoman: string | null; versi: number; diubah_oleh?: string | null; diubah_pada?: string | null;
};
export type Pemegang = { peran: string; divisi: string | null; nama: string };
export type Staf = { id: string; nama: string; jabatan: string | null; divisi: Divisi | null };
export type DataStruktur = { bolehEdit: boolean; terbuka: boolean; posisi: Posisi[]; pemegang: Pemegang[]; staf: Staf[] };
export type HasilMuat = { status: "belum_dipasang" } | { status: "tertutup" } | { status: "galat"; pesan: string } | { status: "ok"; data: DataStruktur };

export const KUNCI_SAKELAR_STRUKTUR = "struktur_terbuka";
export const DIVISI_UTAMA: Divisi[] = ["sosmed", "service", "marketplace"];
export const LABEL_DIVISI: Record<Divisi, string> = { sosmed: "Sosmed", service: "Service", marketplace: "Marketplace", lainnya: "Lainnya" };
export const LABEL_RITME: Record<Ritme, string> = { harian: "Harian", mingguan: "Mingguan", bulanan: "Bulanan" };
/** CERMIN org__cek_rutin di struktur.sql. Data yang dipakai untuk mencentang otomatis (tahap Tugas). */
export const SUMBER_OTOMATIS: Record<SumberOtomatis, string> = {
  ringkasan_harian: "Ringkasan Harian terkirim",
  serah_terima: "Kartu serah terima miliknya tidak terlambat",
  tindak_lanjut: "Kartu merah sudah ditindaklanjuti",
  teruskan_usulan: "Usulan baru sudah diteruskan",
  putuskan_usulan: "Usulan siap diputuskan sudah diputuskan",
  review_dea: "Review Dea sudah diputuskan",
  kalender_bulanan: "Kalender/jadwal bulan depan diajukan",
  cuti: "Tidak ada cuti menunggu > 2 hari kerja",
};
export const BATAS = { judul: 80, isi: 20000, rutin: 40, judulRutin: 120, waktu: 40, pemegang: 10, namaPemegang: 60, catatan: 200 };

/** Galat "fungsi tidak ada" dari PostgREST = struktur.sql belum dijalankan. */
export const fungsiTidakAda = (e: any): boolean =>
  !!e && (e.code === "PGRST202" || e.code === "42883" || /could not find the function|does not exist/i.test(String(e.message || "")));

const teks = (v: unknown) => (typeof v === "string" ? v : "");
function rapikanRutin(v: unknown): ButirRutin[] {
  if (!Array.isArray(v)) return [];
  return v.filter((b) => b && typeof b === "object").map((b: any) => ({
    id: teks(b.id), judul: teks(b.judul), ritme: (["harian", "mingguan", "bulanan"].includes(b.ritme) ? b.ritme : "harian") as Ritme,
    ...(teks(b.waktu) ? { waktu: teks(b.waktu) } : {}), ...(b.otomatis && b.otomatis in SUMBER_OTOMATIS ? { otomatis: b.otomatis as SumberOtomatis } : {}),
  }));
}

/** Hasil RPC org_struktur() → bentuk aman (kolom hilang diisi bawaan). */
export function bacaHasilStruktur(raw: any): HasilMuat {
  if (!raw || typeof raw !== "object") return { status: "galat", pesan: "Data struktur tidak terbaca." };
  if (raw.boleh_lihat !== true) return { status: "tertutup" };
  const posisi: Posisi[] = (Array.isArray(raw.posisi) ? raw.posisi : []).map((p: any) => ({
    id: String(p.id), jenis: p.jenis, judul: teks(p.judul), divisi: p.divisi ?? null, peran_mgmt: p.peran_mgmt ?? null,
    pemegang_manual: Array.isArray(p.pemegang_manual) ? p.pemegang_manual.map(String) : [], urutan: Number(p.urutan) || 0,
    jobdesk_md: teks(p.jobdesk_md), sop_md: teks(p.sop_md), rutin: rapikanRutin(p.rutin), bagian_pedoman: p.bagian_pedoman ?? null,
    versi: Number(p.versi) || 1, diubah_oleh: p.diubah_oleh ?? null, diubah_pada: p.diubah_pada ?? null,
  }));
  const pemegang: Pemegang[] = (Array.isArray(raw.pemegang) ? raw.pemegang : []).map((x: any) => ({ peran: teks(x.peran), divisi: x.divisi ?? null, nama: teks(x.nama) }));
  const staf: Staf[] = (Array.isArray(raw.staf) ? raw.staf : []).map((x: any) => ({ id: String(x.id), nama: teks(x.nama), jabatan: x.jabatan ? String(x.jabatan) : null, divisi: x.divisi ?? null }));
  return { status: "ok", data: { bolehEdit: raw.boleh_edit === true, terbuka: raw.terbuka === true, posisi, pemegang, staf } };
}

export async function muatStruktur(sb: any): Promise<HasilMuat> {
  try {
    const { data, error } = await sb.rpc("org_struktur");
    if (error) return fungsiTidakAda(error) ? { status: "belum_dipasang" } : { status: "galat", pesan: error.message || "Gagal memuat struktur." };
    return bacaHasilStruktur(data);
  } catch (e: any) {
    return { status: "galat", pesan: e?.message || "Gagal memuat struktur." };
  }
}

/** Untuk menu: true hanya bila SQL terpasang DAN akun boleh melihat. */
export async function bolehLihatStruktur(sb: any): Promise<boolean> {
  try {
    const { data, error } = await sb.rpc("org_boleh_lihat");
    return !error && data === true;
  } catch {
    return false;
  }
}

// ── Susunan bagan ─────────────────────────────────────────────────────────────────
export type Simpul = { posisi: Posisi; nama: string | null; kunci: string };
export type KelompokDivisi = { divisi: Divisi; leader: Simpul[]; staf: Staf[] };
export type Bagan = { owner: Simpul[]; sm: Simpul[]; pendukung: Simpul[]; divisi: KelompokDivisi[]; belumDitempatkan: Staf[] };

const kapital = (s: string) => s.replace(/(^|\s)\p{Ll}/gu, (m) => m.toUpperCase());

/** Nama pemegang posisi: manual (owner / pengganti) lebih dulu, lalu dari Management → Anggota. Kosong → satu simpul "belum ada". */
export function namaPemegang(p: Posisi, pemegang: Pemegang[]): string[] {
  const dariAnggota = p.peran_mgmt ? pemegang.filter((x) => x.peran === p.peran_mgmt).map((x) => kapital(x.nama.trim())).filter(Boolean) : [];
  const semua = [...p.pemegang_manual.map((n) => n.trim()).filter(Boolean), ...dariAnggota];
  return [...new Set(semua)];
}
const simpulDari = (p: Posisi, pemegang: Pemegang[]): Simpul[] => {
  const n = namaPemegang(p, pemegang);
  return n.length ? n.map((nama, i) => ({ posisi: p, nama, kunci: `${p.id}:${i}` })) : [{ posisi: p, nama: null, kunci: `${p.id}:-` }];
};

export function susunBagan(d: DataStruktur): Bagan {
  const urut = [...d.posisi].sort((a, b) => a.urutan - b.urutan || a.judul.localeCompare(b.judul));
  const jenis = (j: JenisPosisi) => urut.filter((p) => p.jenis === j).flatMap((p) => simpulDari(p, d.pemegang));
  const adaLainnya = d.staf.some((s) => s.divisi === "lainnya");
  const divisi: KelompokDivisi[] = [...DIVISI_UTAMA, ...(adaLainnya ? (["lainnya"] as Divisi[]) : [])].map((dv) => ({
    divisi: dv,
    leader: urut.filter((p) => p.jenis === "leader" && p.divisi === dv).flatMap((p) => simpulDari(p, d.pemegang)),
    staf: d.staf.filter((s) => s.divisi === dv).sort((a, b) => (a.jabatan || "").localeCompare(b.jabatan || "") || a.nama.localeCompare(b.nama)),
  }));
  return {
    owner: jenis("owner"), sm: jenis("studio_manager"), pendukung: [...jenis("pm"), ...jenis("hr")], divisi,
    belumDitempatkan: d.staf.filter((s) => !s.divisi).sort((a, b) => a.nama.localeCompare(b.nama)),
  };
}

/** Posisi staf (jobdesk per divisi + jabatan, tanpa beda huruf besar/kecil). */
export const cariPosisiStaf = (posisi: Posisi[], divisi: Divisi | null, jabatan: string | null): Posisi | null =>
  !divisi || !jabatan ? null : posisi.find((p) => p.jenis === "staf" && p.divisi === divisi && p.judul.trim().toLowerCase() === jabatan.trim().toLowerCase()) || null;

/** Atasan langsung (teks) untuk sebuah posisi. */
export function atasanDari(p: Pick<Posisi, "jenis" | "divisi">, bagan: Bagan): string {
  const nm = (s: Simpul[]) => s.map((x) => (x.nama ? `${x.nama} (${x.posisi.judul})` : x.posisi.judul)).join(", ") || "—";
  switch (p.jenis) {
    case "owner": return "—";
    case "studio_manager": return "Owner";
    case "pm": case "hr": case "leader": return nm(bagan.sm);
    case "staf": return nm(bagan.divisi.find((d) => d.divisi === p.divisi)?.leader || []);
  }
}

// ── KPI dari Pedoman ──────────────────────────────────────────────────────────────
/** Tabel KPI di bawah judul "### {bagian}" pada Pedoman (Bagian 5). null bila tidak ada. */
export function kpiDariPedoman(md: string, bagian: string | null): string | null {
  if (!md || !bagian) return null;
  const baris = md.split(/\r?\n/);
  const mulai = baris.findIndex((b) => /^###\s+/.test(b) && b.replace(/^###\s+/, "").trim().toLowerCase() === bagian.trim().toLowerCase());
  if (mulai < 0) return null;
  let akhir = baris.length;
  for (let i = mulai + 1; i < baris.length; i++) if (/^#{2,3}\s+/.test(baris[i])) { akhir = i; break; }
  const isi = baris.slice(mulai + 1, akhir);
  const awalTabel = isi.findIndex((b, i) => /^\|\s*Kode\s*\|/i.test(b) && /^\|[\s:|-]+\|?\s*$/.test(isi[i + 1] || ""));
  if (awalTabel < 0) return null;
  const tabel: string[] = [];
  for (let i = awalTabel; i < isi.length && /^\|/.test(isi[i].trim()); i++) tabel.push(isi[i].trim());
  return tabel.length >= 3 ? tabel.join("\n") : null;
}

// ── Validasi (cermin struktur.sql) ────────────────────────────────────────────────
export function validasiRutin(r: ButirRutin[]): string | null {
  if (r.length > BATAS.rutin) return `Maksimal ${BATAS.rutin} tugas rutin per posisi.`;
  const ids = new Set<string>();
  for (const b of r) {
    if (!/^[a-z0-9_-]{1,40}$/.test(b.id) || ids.has(b.id)) return "Id tugas rutin tidak valid atau ganda.";
    ids.add(b.id);
    const j = b.judul.trim();
    if (j.length < 1 || j.length > BATAS.judulRutin) return `Judul tugas rutin wajib diisi (maks. ${BATAS.judulRutin} karakter).`;
    if (!["harian", "mingguan", "bulanan"].includes(b.ritme)) return "Ritme tugas rutin harus harian, mingguan, atau bulanan.";
    if ((b.waktu || "").trim().length > BATAS.waktu) return `Keterangan waktu maks. ${BATAS.waktu} karakter.`;
    if (b.otomatis && !(b.otomatis in SUMBER_OTOMATIS)) return "Sumber otomatis tidak dikenal.";
  }
  return null;
}
/** Id baru yang belum dipakai (r1, r2, …). */
export function idRutinBaru(r: ButirRutin[]): string {
  let n = r.length + 1;
  const ada = new Set(r.map((b) => b.id));
  while (ada.has(`r${n}`)) n++;
  return `r${n}`;
}
/** Teks "Riza, Tryan" → ["Riza","Tryan"] (kosong dibuang, maks. 10). */
export const pisahPemegang = (t: string): string[] => t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, BATAS.pemegang);

// ── RPC tulis ─────────────────────────────────────────────────────────────────────
export type HasilTulis = { ok: true; versi: number; id?: string } | { ok: false; pesan: string; tabrakan?: boolean };
const pesanGalat = (e: any): string => String(e?.message || "Gagal menyimpan.").replace(/^.*?ERROR:\s*/, "");

export async function simpanPosisi(sb: any, p: { id: string; versi: number; judul: string; jobdesk: string; sop: string; rutin: ButirRutin[]; pemegang: string[]; catatan?: string }): Promise<HasilTulis> {
  try {
    const { data, error } = await sb.rpc("org_simpan_posisi", {
      p_id: p.id, p_versi: p.versi, p_judul: p.judul, p_jobdesk: p.jobdesk, p_sop: p.sop,
      p_rutin: p.rutin.map((b) => ({ id: b.id, judul: b.judul.trim(), ritme: b.ritme, ...(b.waktu?.trim() ? { waktu: b.waktu.trim() } : {}), ...(b.otomatis ? { otomatis: b.otomatis } : {}) })),
      p_pemegang: p.pemegang, p_catatan: p.catatan?.trim() || null,
    });
    if (error) return { ok: false, pesan: pesanGalat(error), tabrakan: error.code === "40001" };
    return { ok: true, versi: Number(data?.versi) || p.versi + 1 };
  } catch (e: any) {
    return { ok: false, pesan: pesanGalat(e) };
  }
}

export async function pastikanPosisiStaf(sb: any, divisi: Divisi, jabatan: string): Promise<HasilTulis> {
  try {
    const { data, error } = await sb.rpc("org_posisi_staf", { p_divisi: divisi, p_jabatan: jabatan });
    if (error) return { ok: false, pesan: pesanGalat(error) };
    return { ok: true, id: String(data?.id), versi: Number(data?.versi) || 1 };
  } catch (e: any) {
    return { ok: false, pesan: pesanGalat(e) };
  }
}

/** Penempatan staf ke divisi — RPC Management yang sudah ada (HR/Studio Manager). */
export async function tempatkanStaf(sb: any, idKaryawan: string, divisi: Divisi): Promise<string | null> {
  try {
    const { error } = await sb.rpc("mgmt_atur_divisi_staf", { p_id_karyawan: idKaryawan, p_divisi: divisi });
    return error ? pesanGalat(error) : null;
  } catch (e: any) {
    return pesanGalat(e);
  }
}

export type VersiRiwayat = { versi: number; judul: string; jobdesk_md: string; sop_md: string; rutin: ButirRutin[]; pemegang_manual: string[]; catatan: string | null; diubah_oleh: string | null; diubah_pada: string };
export async function muatRiwayat(sb: any, posisiId: string): Promise<VersiRiwayat[] | null> {
  try {
    const { data, error } = await sb.from("org_posisi_riwayat").select("versi,judul,jobdesk_md,sop_md,rutin,pemegang_manual,catatan,diubah_oleh,diubah_pada")
      .eq("posisi_id", posisiId).order("versi", { ascending: false }).limit(50);
    if (error || !Array.isArray(data)) return null;
    return data.map((r: any) => ({ ...r, rutin: rapikanRutin(r.rutin), pemegang_manual: Array.isArray(r.pemegang_manual) ? r.pemegang_manual : [] }));
  } catch {
    return null;
  }
}

// ── Sakelar Pengaturan ────────────────────────────────────────────────────────────
export type StatusSakelar = { terpasang: boolean; terbuka: boolean };
export async function statusSakelarStruktur(sb: any): Promise<StatusSakelar> {
  try {
    const { error } = await sb.rpc("org_boleh_lihat");
    if (error) return fungsiTidakAda(error) ? { terpasang: false, terbuka: false } : { terpasang: true, terbuka: false };
    const { data, error: e2 } = await sb.from("pengaturan").select("nilai").eq("kunci", KUNCI_SAKELAR_STRUKTUR).maybeSingle();
    return { terpasang: true, terbuka: !e2 && data?.nilai === "true" };
  } catch {
    return { terpasang: false, terbuka: false };
  }
}
export async function simpanSakelarStruktur(sb: any, terbuka: boolean): Promise<string | null> {
  try {
    const { error } = await sb.from("pengaturan").upsert({ kunci: KUNCI_SAKELAR_STRUKTUR, nilai: terbuka ? "true" : "false" }, { onConflict: "kunci" });
    return error ? (error.message || "Gagal menyimpan.") : null;
  } catch (e: any) {
    return e?.message || "Gagal menyimpan.";
  }
}
