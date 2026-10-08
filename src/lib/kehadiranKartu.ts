// src/lib/kehadiranKartu.ts
//
// Fungsi murni untuk tiga kartu anomali di admin/kehadiran (Sering Terlambat,
// Lupa Clock-Out, Paling Disiplin): keadaan lipat per perangkat & penyaring
// tanggal untuk baris yang melebar. Tidak menyentuh perhitungan kartu.

export type StatusKehadiran = "Hadir" | "Telat" | "Alpa" | "Cuti/Sakit" | "WFH" | "Libur" | "Libur Nasional" | "-";
/** `libur`: baris hari_libur pada tanggal itu (tanggal merah, atau cuti bersama yang disetel Masuk). */
export type Sel = { iso: string; status: StatusKehadiran; att?: any; leave?: any; libur?: { nama: string; jenis: string; libur: boolean } | null };
export type IdKartu = "telat" | "lupa" | "disiplin";

export const KUNCI_LIPAT = "invisual_kehadiran_lipat";
const SEMUA_KARTU: IdKartu[] = ["telat", "lupa", "disiplin"];

type BacaSaja = Pick<Storage, "getItem"> | null | undefined;
type BacaTulis = Pick<Storage, "getItem" | "setItem"> | null | undefined;

const storageBawaan = (): Storage | null => {
  try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; }
};

/** Keadaan lipat tersimpan ({telat:true,…}). Gagal apa pun → {} (semua terbuka). Membaca storage setiap kali. */
export function bacaLipat(storage: BacaSaja = storageBawaan()): Partial<Record<IdKartu, boolean>> {
  try {
    const raw = storage?.getItem(KUNCI_LIPAT);
    if (!raw) return {};
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object" || Array.isArray(o)) return {};
    const hasil: Partial<Record<IdKartu, boolean>> = {};
    SEMUA_KARTU.forEach((k) => { if (typeof o[k] === "boolean") hasil[k] = o[k]; });
    return hasil;
  } catch { return {}; }
}

/** Simpan keadaan lipat satu kartu, menggabung dengan yang sudah ada. Tidak pernah melempar. */
export function tulisLipat(id: IdKartu, terlipat: boolean, storage: BacaTulis = storageBawaan()): void {
  try {
    const sekarang = bacaLipat(storage);
    storage?.setItem(KUNCI_LIPAT, JSON.stringify({ ...sekarang, [id]: terlipat }));
  } catch { /* diamkan */ }
}

/** Sel yang relevan untuk kartu: telat → "Telat", disiplin → "Hadir". Terbaru dulu. Tidak mengubah masukan. */
export function hariUntukKartu(sel: Sel[], kartu: "telat" | "disiplin"): Sel[] {
  const status: StatusKehadiran = kartu === "telat" ? "Telat" : "Hadir";
  return (sel || []).filter((x) => x && x.status === status).sort((a, b) => String(b.iso).localeCompare(String(a.iso)));
}

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

/** "2026-09-28" → "Sen, 28 Sep". Tak valid → dikembalikan apa adanya. Tanpa pengaruh zona waktu. */
export function labelTanggalPendek(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!m) return String(iso ?? "");
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${HARI[d.getUTCDay()]}, ${d.getUTCDate()} ${BULAN[d.getUTCMonth()]}`;
}
