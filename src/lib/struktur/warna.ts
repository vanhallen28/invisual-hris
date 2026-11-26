// src/lib/struktur/warna.ts
// Warna kartu Struktur (struktur-warna.sql): palet {id, nama, hex} + id warna per posisi.
// Fitur hidup hanya bila org_struktur() mengirim `palet` (SQL sudah dijalankan); tanpa itu kartu tampil bawaan.
// Murni (tanpa alias @/) agar bisa diuji dengan node --experimental-strip-types.
/* eslint-disable @typescript-eslint/no-explicit-any -- klien supabase diteruskan dari pemanggil */

export type WarnaPalet = { id: string; nama: string; hex: string };
export type Palet = { versi: number; warna: WarnaPalet[] };

export const BATAS_PALET = { jumlah: 16, nama: 30 };
/** CERMIN isi awal org_palet di struktur-warna.sql (warna tema Neo-Brutal). */
export const PALET_BAWAAN: WarnaPalet[] = [
  { id: "w1", nama: "Kuning", hex: "#ffd23f" }, { id: "w2", nama: "Pink", hex: "#ff90c8" },
  { id: "w3", nama: "Hijau", hex: "#5fe3a1" }, { id: "w4", nama: "Biru", hex: "#7aa2ff" },
  { id: "w5", nama: "Ungu", hex: "#c3a6ff" }, { id: "w6", nama: "Jingga", hex: "#ff9f5a" },
  { id: "w7", nama: "Biru tua", hex: "#124bce" }, { id: "w8", nama: "Magenta", hex: "#de236e" },
];

const RE_HEX = /^#[0-9a-f]{6}$/;
const RE_ID = /^[a-z0-9_-]{1,20}$/;

/** "#ABC", "abc", "#aabbcc", " AABBCC " → "#aabbcc"; selain itu null. */
export function normalHex(s: string): string | null {
  const t = String(s || "").trim().toLowerCase().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(t)) return `#${t[0]}${t[0]}${t[1]}${t[1]}${t[2]}${t[2]}`;
  return /^[0-9a-f]{6}$/.test(t) ? `#${t}` : null;
}

/** Bagian `palet` dari org_struktur() → Palet, atau null bila SQL warna belum dipasang. Butir rusak dibuang. */
export function bacaPalet(raw: any): Palet | null {
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.warna)) return null;
  const lihat = new Set<string>();
  const warna = raw.warna.flatMap((w: any): WarnaPalet[] => {
    const id = typeof w?.id === "string" ? w.id : "";
    const hex = typeof w?.hex === "string" ? w.hex.toLowerCase() : "";
    if (!RE_ID.test(id) || !RE_HEX.test(hex) || lihat.has(id)) return [];
    lihat.add(id);
    return [{ id, nama: typeof w.nama === "string" && w.nama.trim() ? w.nama.trim() : id, hex }];
  });
  return { versi: Number(raw.versi) || 0, warna };
}

// ── Kontras ───────────────────────────────────────────────────────────────────────
const kanal = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
/** Luminans relatif WCAG 2.x. */
export function luminans(hex: string): number {
  const h = normalHex(hex) || "#000000";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b);
}
export const rasioKontras = (a: string, b: string): number => {
  const [x, y] = [luminans(a), luminans(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
export const TINTA = "#111111";
/** Teks di atas warna isi: tinta gelap atau putih, mana yang kontrasnya lebih tinggi. */
export const teksKontras = (hex: string): string => (rasioKontras(hex, TINTA) >= rasioKontras(hex, "#ffffff") ? TINTA : "#ffffff");

// ── Pemakaian ─────────────────────────────────────────────────────────────────────
export const cariWarna = (palet: Palet | null, id: string | null | undefined): WarnaPalet | null =>
  !palet || !id ? null : palet.warna.find((w) => w.id === id) || null;

/** Jumlah kartu (posisi) per id warna. */
export function pemakaianWarna(posisi: { warna?: string | null }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of posisi) if (p.warna) m.set(p.warna, (m.get(p.warna) || 0) + 1);
  return m;
}

/** Atribut untuk elemen kartu: kelas + variabel CSS (--kw, --kw-teks). Tanpa warna → objek kosong (tampilan bawaan). */
export function gayaWarna(w: WarnaPalet | null, kelas = "kartu-warna"): { className?: string; style?: Record<string, string>; "data-warna"?: string } {
  if (!w) return {};
  return { className: kelas, style: { "--kw": w.hex, "--kw-teks": teksKontras(w.hex) }, "data-warna": w.id };
}

// ── Validasi (cermin org__cek_palet) ─────────────────────────────────────────────
export function validasiPalet(warna: WarnaPalet[]): string | null {
  if (warna.length > BATAS_PALET.jumlah) return `Maksimal ${BATAS_PALET.jumlah} warna di palet.`;
  const ids = new Set<string>();
  for (const w of warna) {
    if (!RE_ID.test(w.id) || ids.has(w.id)) return "Id warna tidak valid atau ganda.";
    ids.add(w.id);
    const n = w.nama.trim();
    if (n.length < 1 || n.length > BATAS_PALET.nama) return `Nama warna wajib diisi (maks. ${BATAS_PALET.nama} karakter).`;
    if (!normalHex(w.hex)) return `Kode warna "${w.hex}" harus berformat #RRGGBB.`;
  }
  return null;
}
/** Id baru yang belum dipakai (w1, w2, …). */
export function idWarnaBaru(warna: WarnaPalet[]): string {
  const ada = new Set(warna.map((w) => w.id));
  let n = warna.length + 1;
  while (ada.has(`w${n}`)) n++;
  return `w${n}`;
}

// ── RPC tulis (hanya @invisual.studio) ───────────────────────────────────────────
export type HasilPalet = { ok: true; versi: number; dilepas: number } | { ok: false; pesan: string; tabrakan?: boolean };
const pesanGalat = (e: any): string => String(e?.message || "Gagal menyimpan.").replace(/^.*?ERROR:\s*/, "");

export async function simpanPalet(sb: any, versi: number, warna: WarnaPalet[]): Promise<HasilPalet> {
  try {
    const { data, error } = await sb.rpc("org_simpan_palet", {
      p_versi: versi,
      p_warna: warna.map((w) => ({ id: w.id, nama: w.nama.trim(), hex: normalHex(w.hex) || w.hex })),
    });
    if (error) return { ok: false, pesan: pesanGalat(error), tabrakan: error.code === "40001" };
    return { ok: true, versi: Number(data?.versi) || versi + 1, dilepas: Number(data?.dilepas) || 0 };
  } catch (e: any) {
    return { ok: false, pesan: pesanGalat(e) };
  }
}

export async function aturWarnaPosisi(sb: any, idPosisi: string, idWarna: string | null): Promise<string | null> {
  try {
    const { error } = await sb.rpc("org_warna_posisi", { p_id: idPosisi, p_warna: idWarna });
    return error ? pesanGalat(error) : null;
  } catch (e: any) {
    return pesanGalat(e);
  }
}
