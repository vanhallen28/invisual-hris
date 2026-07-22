"use client";

/**
 * Dashboard Tim — tampilan khusus manajer.
 *
 * View-only: memperlihatkan keadaan kehadiran karyawan HARI INI, dengan
 * daftar nama per kategori. Sengaja TIDAK memuat apa pun dari dashboard
 * admin yang berbahaya — tak ada payroll, email blast, reset absensi,
 * atau Corporate Vault. Manajer bisa melihat, tidak bisa mengubah.
 *
 * Sumber data & perhitungannya sama persis dengan dashboard admin, supaya
 * angka di kedua tempat tidak pernah berbeda.
 *
 * Penjaga akses: hanya anggota dengan role "manager" di tabel members.
 * Selain itu dilempar kembali ke /user/dashboard.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { excludeOwners } from "@/lib/owners";
import LoadingLogo from "@/components/LoadingLogo";

function coversToday(tanggalStr: string, todayISO: string) {
  if (!tanggalStr) return false;
  const dates = String(tanggalStr).match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (dates.length === 0) return false;
  const start = dates[0];
  const end = dates.length > 1 ? dates[1] : dates[0];
  return todayISO >= start && todayISO <= end;
}

const isRemote = (j: string) => /WFH|WFC|Work From/i.test(String(j || ""));

type Absen = { id?: any; idKaryawan?: string; nama?: string; waktuMasuk?: string; status?: string; mode_kerja?: string };
type Izin = { id?: any; nama?: string; jenis?: string; tanggal?: string; status?: string };

export default function DashboardTimPage() {
  const router = useRouter();
  const [izinAkses, setIzinAkses] = useState<"cek" | "boleh" | "tolak">("cek");
  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState<any[]>([]);
  const [absensi, setAbsensi] = useState<Absen[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<Izin[]>([]);
  const [remoteToday, setRemoteToday] = useState<Izin[]>([]);

  const todayISO = new Date().toISOString().split("T")[0];

  // ── Penjaga akses: harus manajer ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getUser();
        const uid = sess?.user?.id;
        if (!uid) { router.replace("/login"); return; }
        const { data: mem } = await supabase.from("members").select("role").eq("id", uid).single();
        if (!alive) return;
        if (mem?.role === "manager") setIzinAkses("boleh");
        else { setIzinAkses("tolak"); router.replace("/user/dashboard"); }
      } catch {
        if (alive) { setIzinAkses("tolak"); router.replace("/user/dashboard"); }
      }
    })();
    return () => { alive = false; };
  }, [router]);

  // ── Muat data (hanya kalau akses diizinkan) ──
  useEffect(() => {
    if (izinAkses !== "boleh") return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data: empData } = await supabase.from("employees").select("*");
        const { data: approvedData } = await supabase
          .from("approvals").select("*")
          .in("status", ["Disetujui", "Menunggu"]).neq("jenis", "Izin Terlambat");
        const { data: attendanceData } = await supabase
          .from("attendance").select("*")
          .eq("tanggal", todayISO).order("waktuMasuk", { ascending: false });

        if (!alive) return;

        // Satu baris per karyawan (absen pertama yang tercatat).
        const seen = new Set<string>();
        const unik: Absen[] = [];
        (attendanceData || []).forEach((a: any) => {
          if (!seen.has(a.idKaryawan)) { seen.add(a.idKaryawan); unik.push(a); }
        });

        const aktif = excludeOwners((empData || []).filter((e: any) => e.isAktif ?? true));
        const menutupi = (approvedData || []).filter((a: any) => coversToday(a.tanggal, todayISO));

        setEmployees(aktif);
        setAbsensi(unik);
        setApprovedLeaves(menutupi.filter((a: any) => !isRemote(a.jenis)));
        setRemoteToday(menutupi.filter((a: any) => isRemote(a.jenis)));
      } catch {
        /* diamkan — tampilan kosong lebih baik daripada layar error */
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [izinAkses, todayISO]);

  // Sedang memeriksa akses — jangan kedipkan isi halaman.
  if (izinAkses !== "boleh") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingLogo size={28} />
      </div>
    );
  }

  const onTime = absensi.filter((a) => a.status === "Tepat Waktu");
  const late = absensi.filter((a) => a.status === "Terlambat");
  const hadirTotal = onTime.length + late.length;
  const belumAbsen = Math.max(0, employees.length - hadirTotal - approvedLeaves.length - remoteToday.length);
  const persen = employees.length ? Math.round((hadirTotal / employees.length) * 100) : 0;

  // Nama yang belum absen: karyawan aktif dikurangi yang sudah absen,
  // yang izin/sakit, dan yang WFH/WFC.
  const namaSudahAbsen = new Set(absensi.map((a) => a.nama));
  const namaIzin = new Set(approvedLeaves.map((l) => l.nama));
  const namaRemote = new Set(remoteToday.map((l) => l.nama));
  const belumAbsenNama = employees
    .filter((e) => !namaSudahAbsen.has(e.nama) && !namaIzin.has(e.nama) && !namaRemote.has(e.nama))
    .map((e) => e.nama);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-white">Dashboard Tim</h1>
        <p className="text-xs md:text-sm text-gray-500 mt-1">
          Kehadiran karyawan hari ini ·{" "}
          {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>

      {loading ? (
        <div className="min-h-[40vh] flex items-center justify-center"><LoadingLogo size={28} /></div>
      ) : (
        <>
          {/* Ringkasan angka */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            <Kartu label="Hadir" nilai={hadirTotal} warna="text-white" sub={`${persen}% dari ${employees.length}`} />
            <Kartu label="Tepat waktu" nilai={onTime.length} warna="text-green-400" />
            <Kartu label="Terlambat" nilai={late.length} warna="text-yellow-400" />
            <Kartu label="WFH / WFC" nilai={remoteToday.length} warna="text-[#8ba7ff]" />
            <Kartu label="Sakit / cuti" nilai={approvedLeaves.length} warna="text-red-400" />
          </div>

          {/* Daftar nama per kategori */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Daftar judul="Tepat waktu" warna="bg-green-500" jumlah={onTime.length}>
              {onTime.map((a, i) => (
                <BarisNama key={a.id || `ot-${i}`} nama={a.nama} kanan={a.waktuMasuk} warnaKanan="text-green-400" />
              ))}
              {onTime.length === 0 && <Kosong />}
            </Daftar>

            <Daftar judul="Terlambat" warna="bg-yellow-500" jumlah={late.length}>
              {late.map((a, i) => (
                <BarisNama key={a.id || `lt-${i}`} nama={a.nama} kanan={a.waktuMasuk} warnaKanan="text-yellow-400" />
              ))}
              {late.length === 0 && <Kosong />}
            </Daftar>

            <Daftar judul="WFH / WFC" warna="bg-[#124bce]" jumlah={remoteToday.length}>
              {remoteToday.map((l, i) => (
                <BarisNama key={l.id || `rm-${i}`} nama={l.nama} kanan={String(l.jenis || "").includes("WFC") ? "WFC" : "WFH"} warnaKanan="text-[#8ba7ff]" />
              ))}
              {remoteToday.length === 0 && <Kosong />}
            </Daftar>

            <Daftar judul="Sakit / cuti" warna="bg-red-500" jumlah={approvedLeaves.length}>
              {approvedLeaves.map((l, i) => (
                <BarisNama key={l.id || `lv-${i}`} nama={l.nama} kanan={l.jenis} warnaKanan="text-red-400" />
              ))}
              {approvedLeaves.length === 0 && <Kosong />}
            </Daftar>

            <Daftar judul="Belum absen" warna="bg-white/30" jumlah={belumAbsen}>
              {belumAbsenNama.map((nama, i) => (
                <BarisNama key={`ba-${i}`} nama={nama} />
              ))}
              {belumAbsen === 0 && <Kosong pesan="Semua sudah tercatat" />}
            </Daftar>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Potongan tampilan ── */

function Kartu({ label, nilai, warna, sub }: { label: string; nilai: number; warna: string; sub?: string }) {
  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
      <p className={`font-display mt-2 text-3xl font-black ${warna}`}>{nilai}</p>
      {sub && <p className="text-[10px] text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function Daftar({ judul, warna, jumlah, children }: { judul: string; warna: string; jumlah: number; children: React.ReactNode }) {
  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-white/5">
        <span className={`w-2.5 h-2.5 rounded-sm ${warna}`} />
        <span className="text-sm font-bold text-white">{judul}</span>
        <span className="ml-auto text-sm font-bold text-gray-400">{jumlah}</span>
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">{children}</div>
    </div>
  );
}

function BarisNama({ nama, kanan, warnaKanan }: { nama?: string; kanan?: string; warnaKanan?: string }) {
  return (
    <div className="flex justify-between items-center px-3 py-2 bg-[#111111] rounded-lg border border-white/5">
      <span className="text-sm text-white truncate">{nama || "—"}</span>
      {kanan && <span className={`text-[11px] font-mono shrink-0 ml-2 ${warnaKanan || "text-gray-400"}`}>{kanan}</span>}
    </div>
  );
}

function Kosong({ pesan = "Tidak ada" }: { pesan?: string }) {
  return <p className="text-xs text-gray-600 italic text-center py-3">{pesan}</p>;
}
