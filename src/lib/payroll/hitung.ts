// src/lib/payroll/hitung.ts
// Fungsi murni payroll (tanpa React/Supabase) — dipakai halaman Payroll,
// Profil, detail karyawan, rute API, dan pembuat PDF.
//
// Model: satu PERIODE gaji (21 → 20, label = bulan tanggal `sampai`) berisi
// satu SLIP per karyawan. Slip = gaji_pokok + bonus − potongan (tiga komponen).
import { type Rentang, periodeGaji, BULAN_ID } from "@/lib/rentangTanggal";
import { terlambat } from "@/lib/keterlambatan";

export type StatusPeriode = "draf" | "final";
export type EmailStatus = "belum" | "terkirim" | "gagal" | "simulasi";

/** Baris tabel `payroll_periode`. */
export type PeriodeBaris = {
  id: string;
  label: string;
  dari: string;
  sampai: string;
  status: StatusPeriode;
  dibuat_pada?: string;
  dibuat_oleh?: string | null;
  difinalkan_pada?: string | null;
  difinalkan_oleh?: string | null;
  dikirim_pada?: string | null;
};

/** Baris tabel `payroll_slip` (angka numeric dari PostgREST bisa berupa string). */
export type SlipBaris = {
  id: string;
  periode_id: string;
  idKaryawan: string;
  nama: string;
  jabatan?: string | null;
  nama_bank?: string | null;
  no_rekening?: string | null;
  email?: string | null;
  gaji_pokok: number;
  bonus: number;
  potongan: number;
  catatan?: string | null;
  hadir: number;
  telat: number;
  gaji_bersih?: number;
  email_status: EmailStatus;
  email_dikirim_pada?: string | null;
  email_galat?: string | null;
};

/** Bentuk yang dipakai PayslipDocument & PDF (nama field lama dipertahankan). */
export type SlipTampil = {
  idKaryawan: string;
  nama: string;
  jabatan: string;
  namaBank: string;
  noRekening: string;
  gajiPokok: number;
  bonusManual: number;
  potonganManual: number;
  totalPendapatan: number;
  totalPotongan: number;
  gajiBersih: number;
  hadir: number;
  telat: number;
  catatan: string;
};

/**
 * Angka aman untuk uang: bukan angka / negatif → 0; dibulatkan 2 desimal.
 * Teks berformat Indonesia ditoleransi: "Rp 1.500.000", "1.500.000,50", "1500000,5".
 */
export function angkaAman(v: unknown): number {
  let n: number;
  if (typeof v === "number") n = v;
  else {
    let t = String(v ?? "").trim().replace(/^rp\.?\s*/i, "").replace(/\s/g, "");
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");   // 1.500.000,50
    else if (/^-?\d+,\d+$/.test(t)) t = t.replace(",", ".");                                // 1500000,5
    n = parseFloat(t);
  }
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** gaji_pokok + bonus − potongan (bisa negatif bila potongan > pendapatan). */
export const gajiBersih = (gp: number, bonus: number, potongan: number) =>
  Math.round((num(gp) + num(bonus) - num(potongan)) * 100) / 100;

export function keSlipTampil(b: SlipBaris): SlipTampil {
  const gp = num(b.gaji_pokok), bo = num(b.bonus), po = num(b.potongan);
  return {
    idKaryawan: String(b.idKaryawan ?? ""),
    nama: b.nama || "-",
    jabatan: b.jabatan || "-",
    namaBank: b.nama_bank || "CASH",
    noRekening: b.no_rekening || "-",
    gajiPokok: gp,
    bonusManual: bo,
    potonganManual: po,
    totalPendapatan: Math.round((gp + bo) * 100) / 100,
    totalPotongan: po,
    gajiBersih: gajiBersih(gp, bo, po),
    hadir: num(b.hadir),
    telat: num(b.telat),
    catatan: String(b.catatan || "").trim(),
  };
}

/** "Oktober 2026" = bulan dari tanggal `sampai` (21 Sep – 20 Okt → Oktober). */
export function labelPeriode(r: Rentang): string {
  const [y, m] = String(r.sampai || "").split("-").map(Number);
  return `${BULAN_ID[((m || 1) - 1 + 12) % 12]} ${y || ""}`.trim();
}

/** Periode gaji yang memuat `hariIni` (YYYY-MM-DD lokal). */
export const periodeBerjalan = (hariIni: string): Rentang => periodeGaji(hariIni);

/** n periode terakhir (termasuk yang berjalan), terbaru dulu. */
export const pilihanPeriodeBaru = (hariIni: string, n = 12): Rentang[] =>
  Array.from({ length: n }, (_, i) => periodeGaji(hariIni, -i));

/** Karyawan aktif = `isAktif` bukan false (null/undefined dianggap aktif, sama dengan Karyawan & Dasbor). */
export const karyawanAktif = (e: any) => !!e && e.isAktif !== false;

/** Gaji pokok master dari employees — kolom asli `gajipokok`; varian lama ditoleransi. */
export const gajiPokokMaster = (e: any) => angkaAman(e?.gajipokok ?? e?.gajiPokok ?? e?.gajipoko ?? 0);

/** Email karyawan (kolom `email` = login; `emailLogin` varian lama), huruf kecil. */
export const emailKaryawan = (e: any) => String(e?.email || e?.emailLogin || "").trim().toLowerCase();

/**
 * Potret kehadiran satu karyawan dalam rentang periode — dihitung per HARI
 * (baris absen ganda di tanggal yang sama dihitung satu; telat bila ada baris
 * telat hari itu), sama dengan heatmap Kehadiran yang mengindeks idKaryawan|tanggal.
 * Memakai terlambat() yang sama dengan halaman Kehadiran (fleksibel tidak telat).
 */
export function potretKehadiran(attendance: any[], idKaryawan: string, fleks: Set<string>, r: Rentang): { hadir: number; telat: number } {
  const id = String(idKaryawan);
  const perHari = new Map<string, boolean>();
  (attendance || []).forEach((a) => {
    if (String(a?.idKaryawan ?? "") !== id) return;
    const t = String(a?.tanggal || "").slice(0, 10);
    if (!t || t < r.dari || t > r.sampai) return;
    perHari.set(t, (perHari.get(t) || false) || terlambat(a, fleks));
  });
  let hadir = 0, telat = 0;
  perHari.forEach((t) => { if (t) telat++; else hadir++; });
  return { hadir, telat };
}

export function ringkasanPeriode(slips: SlipBaris[]) {
  const s = { orang: 0, gajiPokok: 0, bonus: 0, potongan: 0, thp: 0 };
  (slips || []).forEach((x) => {
    s.orang++;
    s.gajiPokok += num(x.gaji_pokok);
    s.bonus += num(x.bonus);
    s.potongan += num(x.potongan);
    s.thp += gajiBersih(x.gaji_pokok, x.bonus, x.potongan);
  });
  return s;
}

/** Nama karyawan yang slipnya tanpa email / tanpa rekening — ditampilkan sebelum finalisasi. */
export function peringatanFinal(slips: SlipBaris[]) {
  const tanpaEmail: string[] = [], tanpaRekening: string[] = [];
  (slips || []).forEach((x) => {
    if (!String(x.email || "").trim()) tanpaEmail.push(x.nama);
    if (!String(x.no_rekening || "").trim()) tanpaRekening.push(x.nama);
  });
  return { tanpaEmail, tanpaRekening };
}

export function ringkasanEmail(slips: SlipBaris[]) {
  const s: Record<EmailStatus, number> = { terkirim: 0, gagal: 0, simulasi: 0, belum: 0 };
  (slips || []).forEach((x) => {
    const k = String(x.email_status || "belum") as EmailStatus;
    if (k in s) s[k]++; else s.belum++;
  });
  return s;
}

/** "Slip-Gaji-Oktober-2026-Andi-Pratama.pdf" — hanya huruf/angka & tanda hubung. */
export const namaBerkasSlip = (label: string, nama: string) =>
  `Slip-Gaji-${[label, nama].filter(Boolean).join("-").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}.pdf`;

export const formatRupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num(n));
