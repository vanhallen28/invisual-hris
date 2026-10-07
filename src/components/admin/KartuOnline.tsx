"use client";
// Kartu "Sedang Online": siapa yang sedang membuka HRIS saat ini (presence kanal
// privat `hadir-online`). Memakai kanal bersama dari lib/onlineKanal (yang sama
// dengan PelacakOnline di layout) — hanya MEMBACA presenceState, tidak mendaftar.
// Hanya karyawan aktif (daftar `employees` dari halaman) yang ditampilkan;
// HR/owner tidak. Tanpa interval: diperbarui oleh event `sync` presence.
//
// Server menolak langganan bila online-presence.sql belum dijalankan (atau
// pengguna bukan HR/manager) → keadaan "ditolak" dengan petunjuk.
import { useEffect, useState, useSyncExternalStore } from "react";
import { supabase } from "@/lib/supabase";
import AvatarKaryawan from "@/components/AvatarKaryawan";
import { namaPanggilan } from "@/lib/nama";
import { daftarOnline, labelSejak } from "@/lib/online";
import { pakaiKanal, berlangganan, potret, type PotretKanal } from "@/lib/onlineKanal";

const KELAS_AVATAR = "w-7 h-7 shrink-0 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-bold text-[10px]";
const POTRET_SERVER: PotretKanal = { status: "memuat", versi: 0, generasiJoin: 0, presence: {} };
const potretServer = () => POTRET_SERVER;

export default function KartuOnline({ employees, kelas = "" }: { employees: any[]; kelas?: string }) {
  // Potret kanal bersama (status + presence); objek baru tiap ada perubahan.
  const p = useSyncExternalStore(berlangganan, potret, potretServer);
  const [gagalSesi, setGagalSesi] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    let hidup = true;
    let lepas: (() => void) | null = null;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const uid = data?.session?.user?.id;
        if (!hidup) return;
        if (!uid) { setGagalSesi(true); return; }
        lepas = pakaiKanal(String(uid));
      } catch { if (hidup) setGagalSesi(true); }
    })();
    return () => { hidup = false; try { lepas?.(); } catch { /* diamkan */ } };
  }, []);

  // p.presence = presenceState saat perubahan terakhir (sync presence / status).
  const daftar = daftarOnline(p.presence, employees || []);
  const total = (employees || []).length;
  // putus = koneksi terganggu, Phoenix menyambung ulang; daftar terakhir tetap ditampilkan.
  const keadaan: "memuat" | "siap" | "putus" | "ditolak" | "sesi" =
    gagalSesi ? "sesi" : p.status === "ditolak" ? "ditolak" : p.status === "siap" ? "siap" : p.status === "putus" ? "putus" : "memuat";
  const tampilDaftar = keadaan === "siap" || keadaan === "putus";

  return (
    <div className={kelas} data-kartu-online>
      <div className="flex justify-between items-center gap-3 mb-4 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${keadaan === "siap" && daftar.length ? "bg-green-400 animate-pulse" : keadaan === "putus" ? "bg-amber-400" : "bg-gray-600"}`} aria-hidden="true" />
          <h3 className="text-base font-bold text-white">Sedang Online</h3>
        </div>
        <span className="text-[11px] text-gray-500">{keadaan === "siap" ? `${daftar.length} dari ${total}` : keadaan === "putus" ? "menyambung ulang…" : keadaan === "memuat" ? "menghubungkan…" : "tidak aktif"}</span>
      </div>
      {keadaan === "sesi" ? (
        <p className="text-xs text-gray-500">Sesi masuk tidak ditemukan — muat ulang halaman atau masuk kembali.</p>
      ) : keadaan === "ditolak" ? (
        <p className="text-xs text-amber-300/90">Kanal online ditolak server. Bila baru dipasang, jalankan <code className="font-mono text-amber-200">online-presence.sql</code> di Supabase, lalu muat ulang halaman ini.</p>
      ) : keadaan === "memuat" ? (
        <div className="h-8 rounded-lg bg-white/5 animate-pulse" />
      ) : tampilDaftar && daftar.length === 0 ? (
        <p className="text-xs text-gray-500 italic">Belum ada yang membuka HRIS.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {daftar.map((b) => (
            <div key={b.idKaryawan} className="flex items-center gap-2 bg-kartu-hover border border-white/10 rounded-full pl-1 pr-3 py-1" title={`${b.nama} — ${labelSejak(b.sejak)}`}>
              <AvatarKaryawan id={b.idKaryawan} nama={b.nama} className={KELAS_AVATAR} />
              <span className="text-sm font-semibold text-gray-200">{namaPanggilan(b.idKaryawan, employees, b.nama)}</span>
              <span className="text-[11px] text-gray-400">{labelSejak(b.sejak)}{b.perangkat > 1 ? ` · ${b.perangkat} perangkat` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
