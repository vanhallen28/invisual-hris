// src/lib/payroll/klien.ts
// Sisi PERAMBAN: kueri tabel payroll lewat RLS (sesi pengguna) dan pemanggil
// rute /api/payroll/* (token Bearer dari sesi, seperti pushNotify).
// Semua fungsi mengembalikan { ok: true, ... } | { ok: false, pesan } — tidak melempar.
import type { Rentang } from "@/lib/rentangTanggal";
import { angkaAman, type PeriodeBaris, type SlipBaris } from "./hitung";

type SB = any;
export type HasilApi<T> = ({ ok: true } & T) | { ok: false; pesan: string; status?: number; tabelBelumAda?: boolean };
export type RiwayatSlip = SlipBaris & { periode: PeriodeBaris };
export type ProgresKirim = { terkirim: number; gagal: number; simulasi: number; diproses: number; sisa: number; batasLaju?: boolean };

/** Batas putaran kirimSemua (× 5 slip per putaran) — pengaman bila server tidak pernah maju. */
export const PUTARAN_MAKS = 60;
const PER_PANGGILAN = 5; // = BATAS_KIRIM di server
/** Saat Resend membatasi laju (429), tunggu ini sebelum putaran berikutnya; menyerah setelah BATAS_LAJU_MAKS kali berturut-turut. */
export const JEDA_BATAS_LAJU_MS = 3000;
export const BATAS_LAJU_MAKS = 5;
const tidur = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Galat PostgREST/Postgres yang berarti tabel payroll belum dibuat (payroll.sql belum dijalankan). */
export function tabelBelumAda(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || "");
  const msg = String(err.message || "");
  return code === "PGRST205" || code === "42P01" || /could not find the table/i.test(msg) || /relation .* does not exist/i.test(msg);
}
const PESAN_TABEL = "Tabel payroll belum ada di database — jalankan payroll.sql di Supabase › SQL Editor.";
const gagalDari = (err: any, cadangan: string) => {
  const hilang = tabelBelumAda(err);
  return { ok: false as const, pesan: hilang ? PESAN_TABEL : String(err?.message || cadangan), tabelBelumAda: hilang };
};

/** Semua periode yang boleh dilihat pengguna (HR: semua; karyawan: final miliknya), terbaru dulu. */
export async function muatPeriode(sb: SB): Promise<HasilApi<{ periode: PeriodeBaris[] }>> {
  try {
    const { data, error } = await sb.from("payroll_periode").select("*").order("sampai", { ascending: false });
    if (error) return gagalDari(error, "Gagal memuat periode.");
    return { ok: true, periode: (data || []) as PeriodeBaris[] };
  } catch (e: any) { return gagalDari(e, "Gagal memuat periode."); }
}

/** Slip satu periode, urut nama. */
export async function muatSlip(sb: SB, periodeId: string): Promise<HasilApi<{ slips: SlipBaris[] }>> {
  try {
    const { data, error } = await sb.from("payroll_slip").select("*").eq("periode_id", periodeId).order("nama", { ascending: true });
    if (error) return gagalDari(error, "Gagal memuat slip.");
    return { ok: true, slips: (data || []) as SlipBaris[] };
  } catch (e: any) { return gagalDari(e, "Gagal memuat slip."); }
}

/**
 * Riwayat slip satu karyawan + data periodenya, terbaru dulu.
 * Karyawan: RLS hanya meloloskan periode FINAL miliknya. HR: semua (draf pun), bedakan lewat periode.status.
 */
export async function muatRiwayatSlipSaya(sb: SB, idKaryawan: string): Promise<HasilApi<{ riwayat: RiwayatSlip[] }>> {
  const id = String(idKaryawan || "").trim();
  if (!id) return { ok: true, riwayat: [] };
  try {
    // Kolom eksplisit: jejak pengubah (diubah_oleh) tidak ikut terkirim ke peramban karyawan.
    const { data, error } = await sb
      .from("payroll_slip")
      .select("id,periode_id,idKaryawan,nama,jabatan,nama_bank,no_rekening,email,gaji_pokok,bonus,potongan,catatan,hadir,telat,gaji_bersih,email_status,email_dikirim_pada,email_galat, periode:payroll_periode!inner(id,label,dari,sampai,status,difinalkan_pada,dikirim_pada)")
      .eq("idKaryawan", id);
    if (error) return gagalDari(error, "Gagal memuat riwayat slip.");
    const riwayat = ((data || []) as RiwayatSlip[]).filter((r) => r.periode).sort((a, b) => String(b.periode.sampai).localeCompare(String(a.periode.sampai)));
    return { ok: true, riwayat };
  } catch (e: any) { return gagalDari(e, "Gagal memuat riwayat slip."); }
}

/**
 * Simpan angka slip (hanya saat periode draf — trigger DB menolak bila final).
 * `simpanMaster`: gaji pokok juga ditulis ke employees (kolom `kolomMaster`, bawaan `gajipokok`)
 * agar periode berikutnya memakai angka baru.
 */
export async function simpanSlip(
  sb: SB,
  slipId: string,
  nilai: { gajiPokok: number; bonus: number; potongan: number; catatan: string },
  opsi: { simpanMaster?: boolean; kolomMaster?: string; idKaryawan: string; oleh: string },
): Promise<HasilApi<{ gajiPokok: number; bonus: number; potongan: number; catatan: string | null }>> {
  const gp = angkaAman(nilai.gajiPokok), bo = angkaAman(nilai.bonus), po = angkaAman(nilai.potongan);
  const catatan = String(nilai.catatan || "").trim() || null;
  try {
    const { data, error } = await sb.from("payroll_slip").update({ gaji_pokok: gp, bonus: bo, potongan: po, catatan, diubah_oleh: opsi.oleh }).eq("id", slipId).select("id");
    if (error) return gagalDari(error, "Gagal menyimpan slip.");
    if (!(data || []).length) return { ok: false, pesan: "Slip tidak ditemukan atau sudah tidak bisa diubah — muat ulang halaman." };
    if (opsi.simpanMaster && opsi.idKaryawan) {
      const kolom = opsi.kolomMaster || "gajipokok";
      const { error: e2 } = await sb.from("employees").update({ [kolom]: gp }).eq("idKaryawan", opsi.idKaryawan);
      if (e2) return { ok: false, pesan: `Slip tersimpan, tetapi gaji pokok master gagal diperbarui: ${e2.message || e2}` };
    }
    return { ok: true, gajiPokok: gp, bonus: bo, potongan: po, catatan };
  } catch (e: any) { return gagalDari(e, "Gagal menyimpan slip."); }
}

/** POST /api/payroll/<path> dengan token sesi. Respons { error } → ok:false. */
export async function panggilApi<T = Record<string, unknown>>(sb: SB, path: "periode" | "finalkan" | "kirim", body: any): Promise<HasilApi<T>> {
  try {
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return { ok: false, pesan: "Sesi tidak ditemukan — masuk ulang lalu coba lagi." };
    const res = await fetch(`/api/payroll/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body || {}),
    });
    let j: any = null;
    try { j = await res.json(); } catch { j = null; }
    if (!res.ok || !j || j.error) return { ok: false, pesan: String(j?.error || `Permintaan gagal (HTTP ${res.status}).`), status: res.status };
    return { ok: true, ...(j as T) };
  } catch (e: any) { return { ok: false, pesan: String(e?.message || e || "Gagal menghubungi server.") }; }
}

export const buatPeriode = (sb: SB, r: Rentang) => panggilApi<{ id: string; jumlah: number; sudahAda: boolean }>(sb, "periode", { dari: r.dari, sampai: r.sampai });
export const sinkronPeriode = (sb: SB, periodeId: string) => panggilApi<{ ditambahkan: number; diperbarui: number }>(sb, "periode", { periodeId, sinkron: true });
export const finalkanPeriode = (sb: SB, periodeId: string) => panggilApi<{ jumlah: number; userIds: string[]; label: string }>(sb, "finalkan", { periodeId, aksi: "final" });
export const bukaKunciPeriode = (sb: SB, periodeId: string) => panggilApi<{ sudahTerkirim: number }>(sb, "finalkan", { periodeId, aksi: "draf" });
export const kirimSlip = (sb: SB, periodeId: string, idKaryawan?: string[]) => panggilApi<ProgresKirim & { label: string }>(sb, "kirim", idKaryawan ? { periodeId, idKaryawan } : { periodeId });

/**
 * Kirim bertahap (≤ 5 per panggilan) sampai selesai.
 *   target "belum"  → server memilih slip berstatus belum, berulang sampai sisa 0.
 *   target string[] → daftar idKaryawan eksplisit (mis. kirim ulang yang gagal), dipecah per 5.
 * `onMaju` dipanggil tiap putaran dengan akumulasi. Galat di tengah → ok:false + akumulasi sejauh itu.
 */
export async function kirimSemua(sb: SB, periodeId: string, target: "belum" | string[], onMaju: (s: ProgresKirim) => void): Promise<HasilApi<ProgresKirim>> {
  const akum: ProgresKirim = { terkirim: 0, gagal: 0, simulasi: 0, diproses: 0, sisa: 0 };
  const tambah = (r: ProgresKirim) => { akum.terkirim += r.terkirim || 0; akum.gagal += r.gagal || 0; akum.simulasi += r.simulasi || 0; akum.diproses += r.diproses || 0; };
  const PESAN_LAJU = "Layanan email membatasi laju pengiriman; tunggu sebentar lalu klik Kirim lagi untuk melanjutkan.";
  if (Array.isArray(target)) {
    const antre = Array.from(new Set(target.map(String).filter(Boolean)));
    let lajuBeruntun = 0;
    while (antre.length) {
      const potong = antre.slice(0, PER_PANGGILAN);
      const r = await kirimSlip(sb, periodeId, potong);
      if (!r.ok) return { ...r, ...akum, ok: false };
      tambah(r);
      antre.splice(0, r.diproses);   // yang belum diproses (mis. tertahan batas laju) tetap di antrean
      akum.sisa = antre.length;
      onMaju({ ...akum });
      if (r.batasLaju) { if (++lajuBeruntun >= BATAS_LAJU_MAKS) return { ok: false, pesan: PESAN_LAJU, ...akum }; await tidur(JEDA_BATAS_LAJU_MS); }
      else if (r.diproses === 0) return { ok: false, pesan: `Pengiriman tidak maju (sisa ${akum.sisa}).`, ...akum };
      else lajuBeruntun = 0;
    }
    return { ok: true, ...akum };
  }
  let sisaLalu = Infinity, lajuBeruntun = 0;
  for (let putaran = 1; putaran <= PUTARAN_MAKS; putaran++) {
    const r = await kirimSlip(sb, periodeId);
    if (!r.ok) return { ...r, ...akum, ok: false };
    tambah(r); akum.sisa = r.sisa || 0;
    onMaju({ ...akum });
    if (akum.sisa <= 0) return { ok: true, ...akum };
    if (r.batasLaju) {
      if (++lajuBeruntun >= BATAS_LAJU_MAKS) return { ok: false, pesan: PESAN_LAJU, ...akum };
      await tidur(JEDA_BATAS_LAJU_MS);
      continue;   // sisa boleh sama — server sengaja tidak memproses apa pun
    }
    lajuBeruntun = 0;
    if (r.diproses === 0 || akum.sisa >= sisaLalu) return { ok: false, pesan: `Pengiriman tidak maju (sisa ${akum.sisa}); coba lagi atau kirim per karyawan.`, ...akum };
    sisaLalu = akum.sisa;
  }
  return { ok: false, pesan: `Berhenti setelah ${PUTARAN_MAKS} putaran; sisa ${akum.sisa} slip — jalankan "Kirim" lagi untuk melanjutkan.`, ...akum };
}
