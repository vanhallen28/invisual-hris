// src/lib/management/imporCsv.ts
// Impor SEKALI dari sheet sementara (CSV) ke Section Management: Log Usulan & Serah Terima yang masih berjalan.
// Baca CSV (papaparse) → kenali jenis dari kolom → validasi per baris (pesan Indonesia) → data siap kirim ke RPC.
// Aturan sebenarnya tetap ditegakkan RPC (mgmt_impor_usulan / mgmt_ajukan_usulan / mgmt_buat_serah_terima).
// Murni (tanpa alias @/) agar bisa diuji dengan node --experimental-strip-types.
import Papa from "papaparse";
import type { PetaLibur } from "../hariLibur";
import { PERAN_LABEL, SEMUA_PERAN, type PeranManagement } from "./akses";
import { instanWib, isoWib } from "./hariKerja";
import { DIVISI_SERAH_TERIMA, JENIS_SERAH_TERIMA, LABEL_JENIS, pakaiMulai, pjOtomatis, tautanSah, tenggatSerahTerima, type JenisSerahTerima } from "./serahTerima";
import { LABEL_STATUS, type StatusUsulan } from "./usulan";

export const KOLOM_USULAN = ["judul", "masalah", "perubahan", "bagian", "divisi", "sumber", "jalur", "status_akhir", "tanggal"];
export const KOLOM_SERAH_TERIMA = ["jenis", "dari", "ke", "judul", "mulai", "tanggal_rilis", "bulan_rencana", "tenggat", "penanggung_jawab", "tautan", "catatan", "status"];
/** Status akhir yang dicatat lewat mgmt_impor_usulan (keputusan lampau). "Diajukan" lewat mgmt_ajukan_usulan. */
export const STATUS_IMPOR: StatusUsulan[] = ["disetujui", "ditolak", "ditunda", "berlaku", "dicabut"];

export type Baris = Record<string, string>;
export type DataUsulan = { judul: string; masalah: string; perubahan: string; bagian: string; divisi: string[]; sumber: string; status: StatusUsulan; tanggal: string | null };
export type DataSerahTerima = { jenis: JenisSerahTerima; dari: string; ke: string; judul: string; catatan: string | null; mulai: string | null; tanggalRilis: string | null;
  bulanRencana: string | null; tenggatManual: string | null; tautanItem: string | null; peranPj: PeranManagement | null };
export type Hasil<T> = { baris: number; ok: boolean; aksi?: "impor" | "ajukan" | "buat" | "lewati"; pesan?: string; ringkas?: string; data?: T };

const kunci = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/[\s\-/]+/g, "_").replace(/[^a-z0-9_]/g, "");
const isi = (b: Baris, k: string) => String(b[k] ?? "").trim();
const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const teksTgl = (iso: string) => `${Number(iso.slice(8, 10))} ${BLN[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const teksWaktu = (d: Date) => {
  const iso = isoWib(d), w = new Date(d.getTime() + 7 * 3_600_000);
  return `${HARI[w.getUTCDay()]}, ${Number(iso.slice(8, 10))} ${BLN[Number(iso.slice(5, 7)) - 1]} ${String(w.getUTCHours()).padStart(2, "0")}.${String(w.getUTCMinutes()).padStart(2, "0")}`;
};

/** "2026-10-05" | "5/10/2026" | "05-10-2026" → "2026-10-05"; tanggal tak sah → null. */
export function ubahTanggal(t: string): string | null {
  const s = String(t || "").trim();
  let y: number, m: number, d: number;
  let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; } else if ((r = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) { d = +r[1]; m = +r[2]; y = +r[3]; } else return null;
  const x = new Date(Date.UTC(y, m - 1, d));
  return x.getUTCFullYear() === y && x.getUTCMonth() === m - 1 && x.getUTCDate() === d ? x.toISOString().slice(0, 10) : null;
}
/** "2026-11-23 10:00" | "2026-11-23T10:00" | "23/11/2026 10.30" (WIB) → Date; tanpa jam → null. */
export function ubahWaktu(t: string): Date | null {
  const r = String(t || "").trim().match(/^(.+?)[ T](\d{1,2})[:.](\d{2})$/);
  if (!r) return null;
  const tgl = ubahTanggal(r[1]), j = +r[2], mn = +r[3];
  return tgl && j < 24 && mn < 60 ? instanWib(tgl, j, mn) : null;
}

const DIVISI_USULAN: Record<string, string> = { sosmed: "sosmed", service: "service", marketplace: "marketplace", hr: "hr", semua: "semua" };
const SUMBER: Record<string, string> = { rapat: "rapat", hr: "hr", leader: "leader", chat: "chat", chat_wa: "chat", wa: "chat", whatsapp: "chat",
  owner: "owner", pm: "pm", studio_manager: "studio_manager", sm: "studio_manager" };
const STATUS_USULAN: Record<string, StatusUsulan> = Object.fromEntries(Object.entries(LABEL_STATUS).flatMap(([k, l]) => [[k, k], [kunci(l), k]])) as Record<string, StatusUsulan>;
const JENIS: Record<string, JenisSerahTerima> = Object.fromEntries(JENIS_SERAH_TERIMA.flatMap((j) => [[j, j], [kunci(LABEL_JENIS[j]), j]])) as Record<string, JenisSerahTerima>;
const DIVISI_ST: Record<string, string> = { ...Object.fromEntries(DIVISI_SERAH_TERIMA.map((d) => [d, d])), dea: "owner", owner_dea: "owner" };
const PERAN: Record<string, PeranManagement> = Object.fromEntries(SEMUA_PERAN.flatMap((p) => [[p, p], [kunci(PERAN_LABEL[p]), p]])) as Record<string, PeranManagement>;

/** Baca teks CSV → jenis (dari nama kolom) + baris (kunci kolom dinormalkan: "Status Akhir" → status_akhir). */
export function bacaCsv(teks: string): { jenis: "usulan" | "serah_terima" | null; baris: Baris[]; galat?: string } {
  const r = Papa.parse<Baris>(String(teks || "").replace(/^﻿/, ""), { header: true, skipEmptyLines: "greedy", transformHeader: kunci });
  const kolom = r.meta.fields || [];
  const jenis = kolom.includes("status_akhir") ? "usulan" : ["jenis", "dari", "ke"].every((k) => kolom.includes(k)) ? "serah_terima" : null;
  if (!jenis) return { jenis: null, baris: [], galat: `Kolom tidak dikenali. Usulan: ${KOLOM_USULAN.join(", ")}. Serah terima: ${KOLOM_SERAH_TERIMA.join(", ")}.` };
  return { jenis, baris: (r.data || []).filter((b) => Object.values(b).some((v) => String(v ?? "").trim())) };
}

/** Validasi satu baris usulan. `ada` = usulan yang sudah tercatat (cek duplikat judul). */
export function validasiUsulan(b: Baris, baris: number, sekarang: Date, ada: { nomor: string; judul: string }[]): Hasil<DataUsulan> {
  const gagal = (pesan: string): Hasil<DataUsulan> => ({ baris, ok: false, pesan });
  const kosong = ["judul", "masalah", "perubahan", "bagian", "divisi", "sumber", "status_akhir"].filter((k) => !isi(b, k));
  if (kosong.length) return gagal(`Lengkapi ${kosong.map((k) => k.replace("_", " ")).join(", ")}.`);
  const div = isi(b, "divisi").split(/[,;/|]/).map((x) => x.trim()).filter(Boolean);
  const salah = div.filter((x) => !DIVISI_USULAN[kunci(x)]);
  if (salah.length) return gagal(`Divisi tidak dikenal: ${salah.join(", ")}. Pakai Sosmed, Service, Marketplace, HR, atau Semua.`);
  const sumber = SUMBER[kunci(isi(b, "sumber"))];
  if (!sumber) return gagal(`Sumber tidak dikenal: ${isi(b, "sumber")}.`);
  if (isi(b, "jalur") && kunci(isi(b, "jalur")) !== "biasa") return gagal("Impor hanya untuk jalur Biasa; usulan darurat/internal dicatat manual.");
  const status = STATUS_USULAN[kunci(isi(b, "status_akhir"))];
  if (!status || (status !== "diajukan" && !STATUS_IMPOR.includes(status)))
    return gagal(`Status akhir "${isi(b, "status_akhir")}" tidak bisa diimpor. Pakai Diajukan, ${STATUS_IMPOR.map((s) => LABEL_STATUS[s]).join(", ")}.`);
  const judul = isi(b, "judul");
  const dobel = ada.find((u) => u.judul.trim().toLowerCase() === judul.toLowerCase());
  if (dobel) return gagal(`Sudah ada (${dobel.nomor}).`);
  const data: DataUsulan = { judul, masalah: isi(b, "masalah"), perubahan: isi(b, "perubahan"), bagian: isi(b, "bagian"),
    divisi: Array.from(new Set(div.map((x) => DIVISI_USULAN[kunci(x)]))).sort(), sumber, status, tanggal: null };
  if (status === "diajukan") {
    if (sumber === "owner") return gagal("Sumber Owner untuk usulan Diajukan dicatat manual lewat \"Atas nama owner\".");
    return { baris, ok: true, aksi: "ajukan", ringkas: "Diajukan — masuk alur normal (diteruskan PM)", data };
  }
  const tgl = ubahTanggal(isi(b, "tanggal"));
  if (!tgl) return gagal("Tanggal keputusan wajib diisi (YYYY-MM-DD atau DD/MM/YYYY).");
  if (tgl > isoWib(sekarang)) return gagal("Tanggal keputusan tidak boleh di masa depan.");
  return { baris, ok: true, aksi: "impor", ringkas: `${LABEL_STATUS[status]} · ${teksTgl(tgl)}`, data: { ...data, tanggal: tgl } };
}

/** Validasi satu baris serah terima. Hanya status Berjalan yang diimpor; Selesai/Batal dilewati. */
export function validasiSerahTerima(b: Baris, baris: number, sekarang: Date, peta: PetaLibur | null, ada: { jenis: string; judul: string; status: string }[]): Hasil<DataSerahTerima> {
  const gagal = (pesan: string): Hasil<DataSerahTerima> => ({ baris, ok: false, pesan });
  const st = kunci(isi(b, "status") || "berjalan");
  if (["selesai", "batal", "dibatalkan"].includes(st)) return { baris, ok: true, aksi: "lewati", ringkas: `Dilewati — status ${isi(b, "status")}` };
  if (st !== "berjalan") return gagal(`Status "${isi(b, "status")}" tidak dikenal (Berjalan, Selesai, atau Batal).`);
  const kosong = ["jenis", "dari", "ke", "judul"].filter((k) => !isi(b, k));
  if (kosong.length) return gagal(`Lengkapi ${kosong.join(", ")}.`);
  const jenis = JENIS[kunci(isi(b, "jenis"))];
  if (!jenis) return gagal(`Jenis tidak dikenal: ${isi(b, "jenis")}.`);
  const dari = DIVISI_ST[kunci(isi(b, "dari"))], ke = DIVISI_ST[kunci(isi(b, "ke"))];
  if (!dari || !ke) return gagal(`Divisi tidak dikenal: ${[!dari && isi(b, "dari"), !ke && isi(b, "ke")].filter(Boolean).join(", ")}.`);
  if (dari === ke) return gagal("Divisi asal dan tujuan tidak boleh sama.");
  const judul = isi(b, "judul");
  if (ada.some((k) => k.status === "berjalan" && k.jenis === jenis && k.judul.trim().toLowerCase() === judul.toLowerCase())) return gagal("Sudah ada di Serah Terima (berjalan).");
  const tautan = isi(b, "tautan");
  if (tautan && !tautanSah(tautan)) return gagal("Tautan harus diawali http:// atau https://, atau berupa id item Daily Task.");

  const d: DataSerahTerima = { jenis, dari, ke, judul, catatan: isi(b, "catatan") || null, mulai: null, tanggalRilis: null, bulanRencana: null, tenggatManual: null, tautanItem: tautan || null, peranPj: null };
  let mulai: Date | null = null, tenggatManual: Date | null = null;
  if (pakaiMulai(jenis)) {
    mulai = ubahWaktu(isi(b, "mulai"));
    if (!mulai) return gagal("Waktu mulai wajib diisi dengan jam (YYYY-MM-DD HH:MM).");
    if (mulai.getTime() > sekarang.getTime() + 60_000) return gagal("Waktu mulai tidak boleh di masa depan.");
    if (mulai.getTime() < sekarang.getTime() - 7 * 86_400_000) return gagal("Waktu mulai lebih dari 7 hari lalu — batas sistem; buat manual bila masih relevan.");
    d.mulai = mulai.toISOString();
  } else if (jenis === "info_rilis") {
    d.tanggalRilis = ubahTanggal(isi(b, "tanggal_rilis"));
    if (!d.tanggalRilis) return gagal("Tanggal rilis wajib diisi.");
  } else if (jenis === "kalender_bulanan") {
    const v = isi(b, "bulan_rencana"), t = /^\d{4}-\d{1,2}$/.test(v) ? ubahTanggal(`${v}-01`) : ubahTanggal(v);
    if (!t) return gagal("Bulan rencana wajib diisi (YYYY-MM).");
    d.bulanRencana = `${t.slice(0, 7)}-01`;
  } else {
    tenggatManual = ubahWaktu(isi(b, "tenggat"));
    if (!tenggatManual) return gagal("Tenggat wajib diisi dengan jam (YYYY-MM-DD HH:MM).");
    if (tenggatManual.getTime() <= sekarang.getTime()) return gagal("Tenggat tidak boleh di masa lalu.");
    d.tenggatManual = tenggatManual.toISOString();
    d.peranPj = PERAN[kunci(isi(b, "penanggung_jawab"))] || null;
    if (!d.peranPj) return gagal("Penanggung jawab wajib diisi untuk jenis Lainnya (mis. Leader Service, PM).");
  }
  const tg = tenggatSerahTerima(jenis, { mulai, tanggalRilis: d.tanggalRilis, bulanRencana: d.bulanRencana, tenggatManual }, peta);
  const pj = d.peranPj || pjOtomatis(jenis, dari);
  return { baris, ok: true, aksi: "buat", ringkas: `Tenggat ${teksWaktu(tg)}${tg < sekarang ? " (langsung terlambat)" : ""}${pj ? ` · PJ ${PERAN_LABEL[pj]}` : ""}`, data: d };
}
