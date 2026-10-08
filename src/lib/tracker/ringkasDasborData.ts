// src/lib/tracker/ringkasDasborData.ts
// Pemuat ringkasan Daily Task untuk Dasbor HR (tema Neo-Brutal) — jalur yang sama dengan
// Antrean ACC: kerangka papan (loadStrukturState) + kolom status/tanggal/timeline pertama
// tiap papan (loadKolom), lalu dihitung oleh ringkasDailyTask. Tidak memuat sel lain.
// Hasil disimpan sebentar di memori agar bolak-balik halaman tidak memuat ulang.
import { loadStrukturState, loadKolom, kolomPertamaPerTipe, terapkanKolom } from "@/lib/tracker/load";
import { ringkasDailyTask, metaPapan, type RingkasDailyTask } from "@/lib/tracker/ringkasDasbor";

const UMUR_MS = 2 * 60 * 1000;
let cache: { kunci: string; waktu: number; hasil: RingkasDailyTask } | null = null;

/** null = gagal dimuat (tabel belum ada / tanpa akses / offline). Tidak pernah melempar. */
export async function muatRingkasDailyTask(supabase: Parameters<typeof loadStrukturState>[0], hariIni: string, paksa = false): Promise<RingkasDailyTask | null> {
  if (!paksa && cache && cache.kunci === hariIni && Date.now() - cache.waktu < UMUR_MS) return cache.hasil;
  try {
    const st = await loadStrukturState(supabase);
    const peta = st.boardsDataMap || {};
    const { nilai } = kolomPertamaPerTipe(peta, ["status", "date", "timeline"]);
    const r = nilai.length ? await loadKolom(supabase, nilai, []) : { values: [], assignees: [] };
    const terisi = terapkanKolom(peta, r.values, [], new Set(nilai), new Set());
    const hasil = ringkasDailyTask(terisi, metaPapan(st.workspaces), hariIni);
    cache = { kunci: hariIni, waktu: Date.now(), hasil };
    return hasil;
  } catch {
    return null;
  }
}
