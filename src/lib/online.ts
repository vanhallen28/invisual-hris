// src/lib/online.ts
//
// Monitoring "siapa yang sedang membuka HRIS" lewat Supabase Realtime Presence,
// kanal PRIVAT `hadir-online` (kebijakan di online-presence.sql: semua yang login
// boleh mendaftar; hanya HR/manager boleh membaca). Tanpa tabel, tanpa tulisan
// ke database.
//
// Berkas ini hanya berisi konstanta & fungsi murni (tanpa React/Supabase) agar
// bisa diuji langsung. Pemakai: components/PelacakOnline (mendaftar) dan
// components/admin/KartuOnline (membaca).

export const KANAL_ONLINE = "hadir-online";
/** Tab disembunyikan lebih lama dari ini → berhenti mendaftar (agar pindah tab sebentar tak berkedip). */
export const JEDA_SEMBUNYI_MS = 60_000;
/** Kanal ditolak/galat → coba lagi setelah ini. */
export const JEDA_COBA_LAGI_MS = 300_000;

export type PresensiOnline = { idKaryawan: string; nama: string; sejak: string };
export type BarisOnline = { idKaryawan: string; nama: string; sejak: string; perangkat: number };

/**
 * Identitas yang dikirim pelacak.
 * - null hanya bila uid kosong (belum login).
 * - Sesi lokal rusak / tanpa nama → nama "" ; tanpa idKaryawan (akun HR murni) → idKaryawan "".
 *   Keduanya TETAP mendaftar, tetapi tidak lolos saringan daftarOnline().
 */
export function identitasPelacak(sesiLokal: unknown, uid: string | null | undefined): { kunci: string; idKaryawan: string; nama: string } | null {
  if (!uid) return null;
  let o: any = sesiLokal;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { o = null; } }
  if (Array.isArray(o)) o = o[0];
  if (!o || typeof o !== "object") o = {};
  return { kunci: String(uid), idKaryawan: String(o.idKaryawan ?? "").trim(), nama: String(o.nama ?? "").trim() };
}

const waktuMs = (iso: string): number => { const t = Date.parse(String(iso || "")); return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t; };

/**
 * presenceState() → daftar untuk kartu: gabung per idKaryawan (sejak paling awal,
 * perangkat = jumlah presence), hanya karyawan yang ada di `employees`, urut nama.
 */
export function daftarOnline(state: Record<string, any[]> | null | undefined, employees: { idKaryawan: any; nama?: string }[]): BarisOnline[] {
  const resmi = new Map<string, string>();
  (employees || []).forEach((e) => { const id = String(e?.idKaryawan ?? "").trim(); if (id) resmi.set(id, String(e?.nama ?? "").trim()); });
  const gabung = new Map<string, BarisOnline>();
  Object.values(state || {}).forEach((daftar) => {
    (Array.isArray(daftar) ? daftar : []).forEach((p: any) => {
      if (!p || typeof p !== "object") return;
      const id = String(p.idKaryawan ?? "").trim();
      if (!id || !resmi.has(id)) return;
      const sejak = String(p.sejak ?? "");
      // Nama RESMI (tabel employees) didahulukan; nama dari muatan hanya cadangan —
      // muatan berasal dari localStorage peramban pengirim yang bisa diubah.
      const nama = resmi.get(id) || String(p.nama ?? "").trim() || id;
      const ada = gabung.get(id);
      if (!ada) { gabung.set(id, { idKaryawan: id, nama, sejak, perangkat: 1 }); return; }
      ada.perangkat += 1;
      if (waktuMs(sejak) < waktuMs(ada.sejak)) ada.sejak = sejak;
    });
  });
  return Array.from(gabung.values()).sort((a, b) => a.nama.localeCompare(b.nama, "id"));
}

const dd = (n: number) => String(n).padStart(2, "0");

const BULAN_PENDEK = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const awalHari = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "sejak 08:46" (hari ini) · "sejak kemarin 22:10" · "sejak 5 Okt 09:12" (lebih lama); tak valid → "online". Zona waktu perangkat. */
export function labelSejak(iso: string, sekarang: Date = new Date()): string {
  const t = Date.parse(String(iso || ""));
  if (Number.isNaN(t)) return "online";
  const d = new Date(t);
  const jam = `${dd(d.getHours())}:${dd(d.getMinutes())}`;
  const selisihHari = Math.round((awalHari(sekarang) - awalHari(d)) / 86400000);
  if (selisihHari <= 0) return `sejak ${jam}`;
  if (selisihHari === 1) return `sejak kemarin ${jam}`;
  return `sejak ${d.getDate()} ${BULAN_PENDEK[d.getMonth()]} ${jam}`;
}
