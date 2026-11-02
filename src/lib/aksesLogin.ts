// src/lib/aksesLogin.ts
/* eslint-disable @typescript-eslint/no-explicit-any -- data baris karyawan dinamis, sama seperti halaman Karyawan */
// Akses login TERPISAH dari Arsip (akses-login.sql, 2 Nov 2026).
//   isAktif       = muncul di daftar/statistik/absen (Arsip)  — tidak berubah arti
//   isFreelancer  = freelancer, tidak wajib absen              — tidak berubah arti
//   aksesLogin    = 'aktif' | 'ditutup' — boleh masuk HRIS atau tidak
// Penegakan ada di database (blokir akun login + pagar RLS). Berkas ini hanya:
//   (1) aturan murni yang MENCERMINKAN fungsi SQL tutup_akses_kedaluwarsa() — untuk panel pengingat;
//   (2) pemanggil RPC atur_akses_login / status_akses_saya dan sakelar otomatis di `pengaturan`.
// Bila SQL belum dijalankan: kolom tak ada → kolomAksesAda() false → menu disembunyikan.
type SB = any;
type Emp = Record<string, any>;

export const KUNCI_SAKELAR_OTOMATIS = "akses_tutup_otomatis";
export const ALASAN_AKSES = ["magang selesai", "kontrak berakhir", "keluar", "lainnya"] as const;
export type StatusAkses = "aktif" | "ditutup" | "tidak_terdaftar";

/** Tanggal hari ini di WIB (UTC+7) sebagai "YYYY-MM-DD" — sama dengan (now() at time zone 'Asia/Jakarta')::date. */
export function hariIniWib(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

const tgl = (v: unknown): string => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "");
const emailHR = (e: Emp) => [e?.email, e?.emailLogin].some((x) => String(x || "").trim().toLowerCase().endsWith("@invisual.studio"));
/** Akun HR/admin (@invisual.studio di email atau emailLogin) — cermin SQL akun_hr(). */
export const akunHR = (e: Emp): boolean => emailHR(e);
const statusMagang = (e: Emp) => /(intern|magang)/i.test(String(e?.status || ""));
const statusKontrak = (e: Emp) => /(pkwt|kontrak)/i.test(String(e?.status || ""));

/** Kolom akses sudah ada di data (SQL sudah dijalankan)? */
export const kolomAksesAda = (rows: Emp[] | null | undefined): boolean =>
  Array.isArray(rows) && rows.some((r) => r && Object.prototype.hasOwnProperty.call(r, "aksesLogin"));

export const aksesDitutup = (e: Emp): boolean => e?.aksesLogin === "ditutup";

/** Masa magang/kontrak sudah lewat? (ketat: tanggal < hari ini, jadi berlaku mulai H+1).
 *  Cermin SQL alasan_akses_berakhir(): magang hanya untuk status Internship/Magang, kontrak hanya
 *  untuk PKWT/Kontrak — tanggal sisa di status lain (mis. magang yang sudah jadi Tetap) diabaikan. */
export function alasanKedaluwarsa(e: Emp, hari: string): "magang selesai" | "kontrak berakhir" | null {
  const m = tgl(e?.tanggalSelesaiMagang), k = tgl(e?.tanggalBerakhirKontrak);
  if (m && m < hari && statusMagang(e)) return "magang selesai";
  if (k && k < hari && statusKontrak(e)) return "kontrak berakhir";
  return null;
}

/** "Tetap akses sampai" masih berlaku (≥ hari ini)? */
export const adaPengecualian = (e: Emp, hari: string): boolean => {
  const s = tgl(e?.tetapAksesSampai);
  return !!s && s >= hari;
};

/** Cermin SQL tutup_akses_kedaluwarsa(): akun yang akan ditutup bila sakelar otomatis menyala. */
export const akanDitutupOtomatis = (e: Emp, hari: string): boolean =>
  !aksesDitutup(e) && !!alasanKedaluwarsa(e, hari) && !adaPengecualian(e, hari) && !emailHR(e);

/** Saat membuka akses dengan sakelar menyala: wajib isi pengecualian agar tidak tertutup lagi malam ini. */
export const bukaPerluPengecualian = (e: Emp, hari: string, sakelarNyala: boolean): boolean =>
  sakelarNyala && !!alasanKedaluwarsa(e, hari) && !emailHR(e);

/** Bersihkan pesan galat Postgres/PostgREST untuk ditampilkan. */
const pesanGalat = (err: any): string => {
  const m = String(err?.message || err || "").trim();
  return m.replace(/^.*?ERROR:\s*/i, "") || "Gagal menyimpan perubahan akses.";
};

/** Ubah akses lewat RPC (satu-satunya jalur). aksi: tutup | buka | pengecualian. */
export async function aturAksesLogin(
  sb: SB,
  o: { idKaryawan: string; aksi: "tutup" | "buka" | "pengecualian"; alasan?: string | null; sampai?: string | null; arsipkan?: boolean },
): Promise<{ ok: boolean; pesan?: string }> {
  try {
    const { error } = await sb.rpc("atur_akses_login", {
      p_idk: o.idKaryawan, p_aksi: o.aksi, p_alasan: o.alasan || null, p_sampai: o.sampai || null, p_arsipkan: !!o.arsipkan,
    });
    if (error) return { ok: false, pesan: pesanGalat(error) };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, pesan: pesanGalat(e) };
  }
}

/** Status akses akun yang sedang login. null = RPC belum ada / galat (jangan mengambil tindakan). */
export async function statusAksesSaya(sb: SB): Promise<StatusAkses | null> {
  try {
    const { data, error } = await sb.rpc("status_akses_saya");
    if (error) return null;
    return data === "aktif" || data === "ditutup" || data === "tidak_terdaftar" ? data : null;
  } catch {
    return null;
  }
}

export async function bacaSakelarOtomatis(sb: SB): Promise<boolean> {
  try {
    const { data } = await sb.from("pengaturan").select("nilai").eq("kunci", KUNCI_SAKELAR_OTOMATIS).maybeSingle();
    return data?.nilai === "true";
  } catch {
    return false;
  }
}

export async function simpanSakelarOtomatis(sb: SB, nyala: boolean): Promise<boolean> {
  try {
    const { error } = await sb.from("pengaturan").upsert({ kunci: KUNCI_SAKELAR_OTOMATIS, nilai: nyala ? "true" : "false" }, { onConflict: "kunci" });
    return !error;
  } catch {
    return false;
  }
}

/** Teks ringkas "Akses ditutup 3 Nov 2026 · otomatis · magang selesai". */
export function teksStatusAkses(e: Emp): string {
  if (!aksesDitutup(e)) return "";
  const d = e?.aksesDitutupPada ? new Date(e.aksesDitutupPada) : null;
  const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const kapan = d && !isNaN(d.getTime()) ? (() => { const w = new Date(d.getTime() + 7 * 3600_000); return `${w.getUTCDate()} ${BLN[w.getUTCMonth()]} ${w.getUTCFullYear()}`; })() : "";
  return ["Akses ditutup" + (kapan ? " " + kapan : ""), e?.aksesDitutupOleh || "", e?.aksesAlasan || ""].filter(Boolean).join(" · ");
}
