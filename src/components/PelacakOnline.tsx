"use client";
// Mendaftarkan "saya sedang membuka HRIS" ke kanal presence privat `hadir-online`.
// Tanpa UI. Tidak pernah melempar; tidak ada yang menunggu hasilnya; gagal → diam
// dan coba lagi nanti. Dipasang di layout karyawan & admin.
//
// Kanal dimiliki bersama lewat lib/onlineKanal (satu kanal per tab, dipakai juga
// oleh KartuOnline di dasbor). Komponen ini hanya mengirim track/untrack.
//
// - Setiap kali kanal tersambung (generasiJoin berubah, termasuk setelah koneksi
//   pulih) → track ulang.
// - Tab disembunyikan > JEDA_SEMBUNYI_MS → untrack; tampil lagi → track ulang
//   dengan `sejak` yang sama (waktu pertama kali tab ini mendaftar).
// - Kanal "putus" (gangguan jaringan) → tunggu saja; Phoenix menyambung ulang.
// - Kanal "ditolak" (mis. online-presence.sql belum dijalankan) → coba lagi saat
//   tab tampil kembali, atau setelah JEDA_COBA_LAGI_MS.
// - Muatan hanya { idKaryawan, nama, sejak } — tanpa halaman/perangkat/lokasi.
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { JEDA_SEMBUNYI_MS, JEDA_COBA_LAGI_MS, identitasPelacak } from "@/lib/online";
import { pakaiKanal, berlangganan, potret, kanalAktif, bukaUlang } from "@/lib/onlineKanal";

export default function PelacakOnline() {
  useEffect(() => {
    if (!supabase) return;
    let hidup = true;
    let lepasKanal: (() => void) | null = null;
    let lepasPendengar: (() => void) | null = null;
    let lepasVisibilitas: (() => void) | null = null;
    let timerSembunyi: ReturnType<typeof setTimeout> | null = null;
    let timerCoba: ReturnType<typeof setTimeout> | null = null;
    let terdaftar = false;
    let generasiTerdaftar = -1;
    let sejak = "";
    let sudahPeringatan = false;
    let hentikanUlangTrack: (() => void) | null = null;

    const terlihat = () => typeof document === "undefined" || document.visibilityState === "visible";

    const mulai = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data?.session?.user?.id;
        let sesiLokal: unknown = null;
        try { sesiLokal = localStorage.getItem("invisual_session"); } catch { /* diamkan */ }
        const identitas = identitasPelacak(sesiLokal, uid);
        if (!hidup || !identitas) return;

        let timerUlangTrack: ReturnType<typeof setTimeout> | null = null;
        const daftar = async () => {
          const k = kanalAktif();
          // Boleh mendaftar bila tab terlihat ATAU baru disembunyikan (< JEDA_SEMBUNYI_MS, timer masih jalan) —
          // agar reconnect yang berbarengan dengan pindah tab sebentar tidak membuat pengguna berkedip offline.
          if (!hidup || !k || !(terlihat() || timerSembunyi !== null)) return;
          if (!sejak) sejak = new Date().toISOString();
          // Tandai DULU sebelum menunggu track: event sync yang datang selama menunggu
          // tidak boleh memicu track kedua (dulu membuat satu tab terhitung banyak perangkat).
          const generasi = potret().generasiJoin;
          terdaftar = true; generasiTerdaftar = generasi;
          let hasil: unknown = "error";
          try { hasil = await k.track({ idKaryawan: identitas.idKaryawan, nama: identitas.nama, sejak }); } catch { hasil = "error"; }
          // track() mengembalikan 'ok' | 'error' | 'timed out' (tidak melempar). Gagal → coba sekali lagi 5 dtk kemudian.
          if (hasil !== "ok" && generasiTerdaftar === generasi) {
            terdaftar = false; generasiTerdaftar = -1;
            if (!timerUlangTrack) timerUlangTrack = setTimeout(() => { timerUlangTrack = null; if (hidup && !terdaftar && potret().status === "siap") daftar(); }, 5_000);
          }
        };
        const cabut = async () => {
          const k = kanalAktif();
          if (!terdaftar) return;
          terdaftar = false; generasiTerdaftar = -1;
          if (!k) return;
          try { await k.untrack(); } catch { /* diamkan */ }
        };

        const saatBerubah = () => {
          if (!hidup) return;
          const p = potret();
          if (p.status === "siap") {
            if (timerCoba) { clearTimeout(timerCoba); timerCoba = null; }
            if (p.generasiJoin !== generasiTerdaftar) { terdaftar = false; daftar(); }
            return;
          }
          if (p.status === "ditolak") {
            terdaftar = false; generasiTerdaftar = -1;
            if (!sudahPeringatan) { sudahPeringatan = true; console.warn("[online] kanal presence ditolak — bila terus terjadi, jalankan online-presence.sql; dicoba lagi nanti."); }
            if (!timerCoba) timerCoba = setTimeout(() => { timerCoba = null; if (hidup) bukaUlang(); }, JEDA_COBA_LAGI_MS);
            return;
          }
          if (p.status === "tutup" || p.status === "putus") { terdaftar = false; generasiTerdaftar = -1; }
        };
        hentikanUlangTrack = () => { if (timerUlangTrack) { clearTimeout(timerUlangTrack); timerUlangTrack = null; } };
        lepasPendengar = berlangganan(saatBerubah);
        lepasKanal = pakaiKanal(identitas.kunci);
        saatBerubah(); // bila kanal sudah siap (dibuka pihak lain), langsung mendaftar

        const saatVisibilitas = () => {
          if (!hidup) return;
          if (terlihat()) {
            if (timerSembunyi) { clearTimeout(timerSembunyi); timerSembunyi = null; }
            const st = potret().status;
            if (st === "ditolak") { bukaUlang(); return; }   // coba lagi segera saat tab tampil kembali
            if (!terdaftar && st === "siap") daftar();
          } else {
            if (timerSembunyi) clearTimeout(timerSembunyi);
            timerSembunyi = setTimeout(() => { timerSembunyi = null; cabut(); }, JEDA_SEMBUNYI_MS);
          }
        };
        document.addEventListener("visibilitychange", saatVisibilitas);
        lepasVisibilitas = () => document.removeEventListener("visibilitychange", saatVisibilitas);
      } catch { /* diamkan */ }
    };
    mulai();

    return () => {
      hidup = false;
      if (timerSembunyi) clearTimeout(timerSembunyi);
      if (timerCoba) clearTimeout(timerCoba);
      try { hentikanUlangTrack?.(); } catch { /* diamkan */ }
      try { lepasVisibilitas?.(); } catch { /* diamkan */ }
      try { lepasPendengar?.(); } catch { /* diamkan */ }
      try { lepasKanal?.(); } catch { /* diamkan */ }
    };
  }, []);
  return null;
}
