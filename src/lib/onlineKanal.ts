// src/lib/onlineKanal.ts
//
// PEMILIK TUNGGAL kanal presence `hadir-online` di sisi peramban.
//
// supabase-js menggabungkan dua `supabase.channel()` bertopik sama menjadi SATU
// objek kanal. Bila PelacakOnline (layout) dan KartuOnline (dasbor) masing-masing
// membuat kanal sendiri, yang kedua gagal `subscribe` ("sudah bergabung") dan saat
// salah satu dilepas, kanal milik yang lain ikut tertutup. Karena itu kanal
// dibuat di sini sekali, dipakai bersama dengan hitungan pemakai, dan ditutup
// saat pemakai terakhir melepasnya.
//
// Keadaan:
//   tutup   → tidak ada pemakai / kanal belum dibuka
//   memuat  → sedang bergabung
//   siap    → tersambung; generasiJoin bertambah tiap kali tersambung (termasuk
//             setelah koneksi pulih) → pelacak mendaftar ulang
//   putus   → koneksi terganggu (CHANNEL_ERROR/TIMED_OUT); Phoenix menyambung
//             ulang sendiri. Bila dalam JEDA_PUTUS_MS tidak tersambung lagi →
//             dianggap DITOLAK (mis. online-presence.sql belum dijalankan).
//   ditolak → kanal dibongkar; bukaUlang() untuk mencoba lagi.
//   CLOSED dari server → dibongkar lalu dibuka lagi otomatis ±3 dtk (status putus).
//
// Token: TIDAK di-cache. Tiap kali membuka, sesi segar diambil dari
// supabase.auth.getSession() — token lama yang kedaluwarsa jika dikirim ke
// setAuth akan diteruskan ke SEMUA kanal realtime dan bisa menutup kanal lain.
//
// Tidak ada React di sini; komponen berlangganan lewat `berlangganan()` dan
// membaca `potret()` (objek baru tiap status/presence berubah).

import { supabase } from "@/lib/supabase";
import { KANAL_ONLINE } from "@/lib/online";

export type StatusKanal = "tutup" | "memuat" | "siap" | "putus" | "ditolak";
export type PotretKanal = { status: StatusKanal; versi: number; generasiJoin: number; presence: Record<string, any[]> };

/** Lama menunggu koneksi pulih sebelum CHANNEL_ERROR dianggap penolakan server. */
export const JEDA_PUTUS_MS = 15_000;

let kanal: any = null;
let pemakai = 0;
let status: StatusKanal = "tutup";
let versi = 0;
let generasiJoin = 0;
let potretTerakhir: PotretKanal = { status, versi, generasiJoin, presence: {} };
let kunciTerakhir = "";
let janjiTutup: Promise<unknown> | null = null;   // removeChannel yang sedang berjalan
let timerPutus: ReturnType<typeof setTimeout> | null = null;
let timerBukaUlang: ReturnType<typeof setTimeout> | null = null;
let sedangBuka = false;
/** Jeda sebelum membuka ulang setelah server menutup kanal (deploy/restart) — soket biasanya masih hidup. */
const JEDA_BUKA_ULANG_MS = 3_000;
const pendengar = new Set<() => void>();
const TOPIK_PENUH = "realtime:" + KANAL_ONLINE;

/** presenceState() kanal, atau {} bila belum ada. */
export function presenceSekarang(): Record<string, any[]> { try { return kanal?.presenceState?.() || {}; } catch { return {}; } }

function beriTahu() {
  versi += 1;
  potretTerakhir = { status, versi, generasiJoin, presence: presenceSekarang() };
  pendengar.forEach((cb) => { try { cb(); } catch { /* diamkan */ } });
}

/** Potret keadaan (objek stabil sampai ada perubahan — aman untuk useSyncExternalStore). */
export function potret(): PotretKanal { return potretTerakhir; }
export function berlangganan(cb: () => void): () => void { pendengar.add(cb); return () => { pendengar.delete(cb); }; }
/** Objek kanal aktif (untuk track/untrack) atau null. */
export function kanalAktif(): any { return kanal; }

function hentikanTimerPutus() { if (timerPutus) { clearTimeout(timerPutus); timerPutus = null; } }
function hentikanTimerBukaUlang() { if (timerBukaUlang) { clearTimeout(timerBukaUlang); timerBukaUlang = null; } }
const soketTersambung = () => { try { return !!supabase.realtime?.isConnected?.(); } catch { return false; } };

function tutupKanal() {
  hentikanTimerPutus();
  const k = kanal;
  kanal = null;
  if (k) { try { janjiTutup = Promise.resolve(supabase.removeChannel(k)).catch(() => null); } catch { /* diamkan */ } }
}

async function buka(kunci: string) {
  if (!supabase || kanal || sedangBuka) return;
  sedangBuka = true;
  try {
    kunciTerakhir = kunci;
    status = "memuat"; beriTahu();
    // Tunggu kanal lama benar-benar lepas; supabase.channel() mengembalikan objek lama
    // yang masih "leaving" bila dipanggil terlalu cepat (subscribe-nya lalu diam saja).
    if (janjiTutup) { try { await janjiTutup; } catch { /* diamkan */ } janjiTutup = null; }
    try {
      const sisa = (supabase.getChannels?.() || []).filter((c: any) => c?.topic === TOPIK_PENUH);
      for (const c of sisa) { try { await supabase.removeChannel(c); } catch { /* diamkan */ } }
    } catch { /* diamkan */ }
    // Token SEGAR (bukan cache) — supabase-js sudah meneruskan pembaruan token ke realtime,
    // setAuth eksplisit hanya memastikan join pertama membawa JWT.
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) await supabase.realtime.setAuth(token);
    } catch { /* diamkan */ }
    if (pemakai <= 0 || kanal) { if (pemakai <= 0) { status = "tutup"; beriTahu(); } return; }

    const k = supabase.channel(KANAL_ONLINE, { config: { private: true, presence: { key: kunci, enabled: true } } });
    kanal = k;
    k.on("presence", { event: "sync" }, () => { if (kanal === k) beriTahu(); });
    k.subscribe((st: string) => {
      if (kanal !== k) return;
      if (st === "SUBSCRIBED") { hentikanTimerPutus(); status = "siap"; generasiJoin += 1; beriTahu(); return; }
      if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
        // Bisa gangguan transport (Phoenix menyambung ulang sendiri) ATAU penolakan server.
        // Beri tenggang; penolakan hanya mungkin saat SOKET tersambung — selama soket masih
        // putus (pindah wifi, laptop tidur), tenggang diperpanjang, bukan dianggap ditolak.
        if (status !== "putus") { status = "putus"; beriTahu(); }
        const periksa = () => {
          timerPutus = null;
          if (kanal !== k) return;
          if (!soketTersambung()) { timerPutus = setTimeout(periksa, JEDA_PUTUS_MS); return; }
          tutupKanal(); status = "ditolak"; beriTahu();
        };
        if (!timerPutus) timerPutus = setTimeout(periksa, JEDA_PUTUS_MS);
        return;
      }
      if (st === "CLOSED") {
        // Ditutup oleh server (deploy/restart Realtime, token kedaluwarsa saat tab di latar
        // belakang) — bukan oleh kita (penutupan sendiri sudah membuat kanal !== k). Phoenix tidak
        // menyambung ulang kanal closed, jadi bongkar lalu buka lagi sebentar kemudian; bila join
        // berikutnya ditolak, jalur tenggang di atas yang memutuskan "ditolak".
        tutupKanal(); status = "putus"; beriTahu();
        hentikanTimerBukaUlang();
        timerBukaUlang = setTimeout(() => { timerBukaUlang = null; if (pemakai > 0 && !kanal && !sedangBuka) buka(kunciTerakhir); }, JEDA_BUKA_ULANG_MS);
      }
    });
  } catch { tutupKanal(); status = "ditolak"; beriTahu(); }
  finally { sedangBuka = false; }
}

/**
 * Pakai kanal bersama. Membuat kanal bila belum ada (kunci presence = uid pengguna ini).
 * Mengembalikan fungsi pelepas; kanal ditutup saat pemakai terakhir melepas.
 */
export function pakaiKanal(kunci: string): () => void {
  pemakai += 1;
  if (!kanal && !sedangBuka) buka(kunci);
  let dilepas = false;
  return () => {
    if (dilepas) return; dilepas = true;
    pemakai -= 1;
    if (pemakai <= 0) { pemakai = 0; hentikanTimerBukaUlang(); tutupKanal(); status = "tutup"; beriTahu(); }
  };
}

/** Coba buka lagi setelah ditolak (dipanggil pelacak dengan jeda / saat tab tampil lagi). */
export function bukaUlang(): void {
  if (pemakai <= 0 || kanal || sedangBuka) return;
  buka(kunciTerakhir);
}
