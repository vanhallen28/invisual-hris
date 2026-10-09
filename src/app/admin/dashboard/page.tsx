// src/app/admin/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { saringTerlambat, fleksibelIds, terlambat, tambahJamKe, JAM_KERJA_JAM } from "@/lib/keterlambatan";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logAudit } from "@/lib/audit";
import { pushNotify } from "@/lib/push";
import { useToast } from "@/components/Toast";
import { CorporateSummaryCard } from "@/components/admin/CorporateSummaryCard";
import { ResetAbsensiCard } from "@/components/admin/ResetAbsensiCard";
import { ChatNotifCard } from "@/components/admin/ChatNotifCard";
import { excludeOwners } from "@/lib/owners";
import { namaPanggilan } from "@/lib/nama";
import { ambilAturanJamKerja } from "@/lib/jamKerja";
import { GaleriFotoAbsen } from "@/components/FotoAbsen";
import { mintaBersihkanFotoLama } from "@/lib/fotoAbsen";
import AvatarKaryawan from "@/components/AvatarKaryawan";
import KartuOnline from "@/components/admin/KartuOnline";
import TandaiLembur from "@/components/admin/TandaiLembur";
import KartuLembur from "@/components/admin/KartuLembur";
import InfoLibur from "@/components/InfoLibur";
import { menitWajib, teksMenit, type TandaLembur } from "@/lib/lembur";
import { muatTandaLembur } from "@/lib/lemburData";
import { teksTanggal } from "@/lib/tanggalTampil";
import { useTema } from "@/lib/tema";
import dynamic from "next/dynamic";
import LoadingLogo from "@/components/LoadingLogo";
// Susunan Neo-Brutal hanya diunduh bila tema itu aktif (pengguna tema gelap tidak mengunduhnya).
const DasborHRBrutal = dynamic(() => import("@/components/brutal/DasborHRBrutal"), {
  ssr: false,
  loading: () => <div className="flex min-h-[60vh] items-center justify-center"><LoadingLogo size={56} text="Menyiapkan dasbor" /></div>,
});

// Cek apakah HARI INI termasuk dalam periode izin/cuti.
// Kolom `tanggal` berupa string: "2025-07-16", "2025-07-16 s/d 2025-07-20",
// atau "2025-07-16 (Est. Sampai: 10:00 WIB)". Kita ambil tanggal YYYY-MM-DD-nya.
function coversToday(tanggalStr: string, todayISO: string) {
  if (!tanggalStr) return false;
  const dates = String(tanggalStr).match(/\d{4}-\d{2}-\d{2}/g) || [];
  if (dates.length === 0) return false;
  const start = dates[0];
  const end = dates.length > 1 ? dates[1] : dates[0];
  return todayISO >= start && todayISO <= end;
}

// Satu baris absensi per karyawan (data diurutkan jam masuk terbaru → baris pertama dipakai).
function unikPerKaryawan(rows: any[] | null | undefined) {
  const hasil: any[] = [];
  const seen = new Set();
  (rows || []).forEach((absen) => {
    if (!seen.has(absen.idKaryawan)) {
      seen.add(absen.idKaryawan);
      hasil.push(absen);
    }
  });
  return hasil;
}

// "HH:MM" untuk pengurutan linimasa (menerima "9:05" / "09.05").
function jamUrut(v: any) {
  const m = String(v ?? "").match(/(\d{1,2})[:.](\d{2})/);
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : String(v ?? "");
}

const KELAS_AVATAR = "w-9 h-9 shrink-0 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-bold text-sm";
const KELAS_AKSI_CEPAT = "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-bold text-gray-300 hover:text-white transition-colors cursor-pointer";

// Sel bento — memakai kelas bersama `kartu-glow` (didefinisikan di globals.css),
// kelas yang SAMA dipakai semua halaman lain. Satu sumber: kalau diubah di
// globals.css, dashboard dan seluruh halaman ikut berubah bersamaan.
// Posisi kursor diisi komponen GlowLayer di app/layout.tsx.
function BentoCell({
  children,
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      <div className="relative z-10">{children}</div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const toast = useToast();
  const router = useRouter();
  const [tema] = useTema();   // Neo-Brutal ("terang") memakai tata letak sendiri; tema gelap tidak berubah

  const [adminEmail, setAdminEmail] = useState<string>("Memuat...");
  const todayDate = new Date().toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(); // tanggal LOKAL (WIB), bukan UTC
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<any[]>([]);
  const [remoteToday, setRemoteToday] = useState<any[]>([]);  // WFH/WFC disetujui hari ini
  const [todayAttendances, setTodayAttendances] = useState<any[]>([]);
  // Salinan khusus "Log absensi live" yang disegarkan otomatis (clock-in & clock-out
  // terbaru). Sengaja TERPISAH dari todayAttendances agar angka kartu, cincin
  // kehadiran, anomali & export tetap seperti semula (dihitung saat halaman dimuat).
  const [absenLog, setAbsenLog] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [bukaAlasan, setBukaAlasan] = useState<string | number | null>(null); // baris keterangan yang terbuka

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  const [showWABroadcastModal, setShowWABroadcastModal] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [isSendingWA, setIsSendingWA] = useState(false);
  const [waStatus, setWaStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [anomalyList, setAnomalyList] = useState<any[]>([]);
  // Panel "Perlu dilengkapi" bisa disembunyikan untuk hari ini (per tab/sesi).
  // Menggantikan popup penghalang "Anomali Terdeteksi!" yang dulu muncul tiap buka dasbor.
  const [sembunyiAnomali, setSembunyiAnomali] = useState<boolean>(() => {
    try { return typeof window !== "undefined" && window.sessionStorage.getItem("invisual_sembunyi_anomali") === todayISO; } catch { return false; }
  });
  // Galeri foto selfie absensi (dibuka dari "Log absensi live"); fokusId = karyawan yang diklik
  const [galeriFoto, setGaleriFoto] = useState<{ fokusId: string | null } | null>(null);
  // Saringan "Log absensi live": semua kejadian / hanya clock-in / hanya clock-out
  const [saringLog, setSaringLog] = useState<"semua" | "masuk" | "pulang">("semua");
  // Kompensasi lembur: naikkan versi agar KartuLembur memuat ulang setelah menandai/membatalkan.
  const [versiLembur, setVersiLembur] = useState(0);
  // Tanda lembur HARI INI per idKaryawan — agar tombol "Lembur" di Log absensi live tahu sudah ditandai atau belum.
  const [tandaLemburHariIni, setTandaLemburHariIni] = useState<Record<string, TandaLembur>>({});

  useEffect(() => {

    // =========================================================================
    // 🔒 PENJAGA PINTU ADMIN YANG DIPERKUAT (ANTI-TENDANG)
    // =========================================================================
    const verifyAccess = async () => {
      let sessionData = localStorage.getItem("invisual_session");

      // Jalan penyelamat: localStorage bisa terhapus (mis. iOS membersihkan
      // penyimpanan) padahal sesi Supabase masih hidup. Sebelum menendang,
      // coba bangun ulang identitas dari Supabase auth. Ini TIDAK melonggarkan
      // siapa yang boleh masuk — kalau Supabase auth juga mati, tetap ditendang.
      if (!sessionData) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          const email = user?.email || "";
          if (email && email.endsWith("@invisual.studio")) {
            const pulih = { email, role: "admin" };
            localStorage.setItem("invisual_session", JSON.stringify(pulih));
            sessionData = JSON.stringify(pulih);
          }
        } catch {
          /* Supabase tak bisa dihubungi — lanjut ke penolakan di bawah */
        }
      }

      if (!sessionData) {
        router.replace("/login");
        return false;
      }

      try {
        const parsedSession = JSON.parse(sessionData);
        if (parsedSession.role !== "admin") {
          router.replace("/user/dashboard");
          return false;
        }

        setAdminEmail(parsedSession.email);
        return true; // Lolos verifikasi
      } catch (e) {
        router.replace("/login");
        return false;
      }
    };

    // Hanya jalankan penarikan data JIKA verifikasi lulus
    verifyAccess().then((lolos) => {
      if (lolos) {
        fetchDashboardData();
        // Hapus foto absen > 7 hari (maks. sekali sehari; cadangan bila cron belum aktif)
        mintaBersihkanFotoLama(supabase);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Kosongkan dependency array agar tidak terjadi re-render berulang


  const handleLogout = async () => {
    const confirmLogout = await toast.konfirmasi("Keluar dari Panel Admin?", { labelYa: "Keluar" });
    if (!confirmLogout) return;
    
    localStorage.removeItem("invisual_session");
    await supabase.auth.signOut(); 
    router.replace("/login");
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: empData } = await supabase.from("employees").select("*");
      const { data: pendingData } = await supabase.from("approvals").select("*").eq("status", "Menunggu").order("id", { ascending: false });
      const { data: approvedData } = await supabase.from("approvals").select("*").in("status", ["Disetujui", "Menunggu"]).neq("jenis", "Izin Terlambat");
      const { data: attendanceData } = await supabase.from("attendance").select("*").eq("tanggal", todayISO).order("waktuMasuk", { ascending: false });

      const uniqueAttendances: any[] = unikPerKaryawan(attendanceData);

      // Owner dikecualikan dari statistik operasional (headcount, absensi, anomali)
      const activeEmployees = excludeOwners(empData?.filter(e => e.isAktif ?? true) || []);
      setEmployees(activeEmployees);
      setPendingApprovals(pendingData || []);
      // Pisahkan WFH/WFC dari sakit/cuti. Sebelumnya keduanya masuk satu
      // kartu "Sakit/cuti"; sekarang kerja remote punya kartunya sendiri.
      const menutupiHariIni = (approvedData || []).filter((a: any) => coversToday(a.tanggal, todayISO));
      const isRemote = (j: string) => /WFH|WFC|Work From/i.test(String(j || ""));
      // Kalau karyawan SUDAH clock-in hari ini, dia HADIR — jangan ikut dihitung
      // sebagai "izin" (perbaikan: yang datang tepat waktu kadang muncul di izin).
      const sudahAbsenIds = new Set((uniqueAttendances || []).map((a: any) => a.idKaryawan));
      setApprovedLeaves(menutupiHariIni.filter((a: any) => !isRemote(a.jenis) && !sudahAbsenIds.has(a.idKaryawan)));
      setRemoteToday(menutupiHariIni.filter((a: any) => isRemote(a.jenis)));
      setTodayAttendances(uniqueAttendances);
      setAbsenLog(uniqueAttendances);
      // Tanda lembur hari ini (tabel `lembur`; kosong bila lembur.sql belum dijalankan).
      const tandaHariIni = await muatTandaLembur(supabase, { dari: todayISO, sampai: todayISO });
      setTandaLemburHariIni(Object.fromEntries(tandaHariIni.map((t) => [String(t.idKaryawan), t])));

      const detectedAnomalies: any[] = [];
      
      activeEmployees.forEach((emp) => {
        const issues: string[] = [];
        if (!emp.noRekening || emp.noRekening === "" || emp.noRekening === "-") issues.push("Nomor Rekening Bank Kosong");
        if (!emp.namaBank || emp.namaBank === "" || emp.namaBank === "-") issues.push("Nama Bank Penerima Belum Diisi");
        if (!emp.nikKtp || String(emp.nikKtp).trim() === "") issues.push("Nomor KTP (NIK) Belum Diisi");
        if (!emp.tanggalBergabung) issues.push("Tanggal Resmi Bergabung Belum Diatur");
        if (!emp.noPonsel || emp.noPonsel === "") issues.push("Nomor Handphone/WhatsApp Kosong");
        if (issues.length > 0) detectedAnomalies.push({ idKaryawan: emp.idKaryawan, nama: emp.nama, issues: issues });
      });

      const lateRecords = saringTerlambat(uniqueAttendances, empData || []).filter((a: any) => !a.anomali_disetujui);
      lateRecords.forEach(late => {
        detectedAnomalies.push({ idKaryawan: late.idKaryawan, nama: late.nama, issues: [`Terlambat Presensi Masuk (${late.waktuMasuk} WIB)`], type: 'late', attendanceId: late.id });
      });

      setAnomalyList(detectedAnomalies);
    } catch (error) {
      console.error("Gagal sinkronisasi analitik dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh RINGAN antrean persetujuan (tanpa flash loading): pengajuan baru
  // (mis. Izin Terlambat) muncul otomatis tiap 20 dtk & saat tab difokuskan,
  // tanpa perlu reload halaman.
  useEffect(() => {
    const segarkanPending = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const { data } = await supabase.from("approvals").select("*").eq("status", "Menunggu").order("id", { ascending: false });
        setPendingApprovals(data || []);
      } catch { /* diamkan */ }
    };
    // Log absensi live: clock-in & clock-out terbaru ikut muncul tanpa muat ulang halaman.
    const segarkanAbsen = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      try {
        const d = new Date();
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const { data, error } = await supabase.from("attendance").select("*").eq("tanggal", iso).order("waktuMasuk", { ascending: false });
        if (!error && data) setAbsenLog(unikPerKaryawan(data));
      } catch { /* diamkan */ }
    };
    const segarkan = () => { segarkanPending(); segarkanAbsen(); };
    const iv = setInterval(segarkan, 20000);
    window.addEventListener('focus', segarkan);
    document.addEventListener('visibilitychange', segarkan);
    return () => { clearInterval(iv); window.removeEventListener('focus', segarkan); document.removeEventListener('visibilitychange', segarkan); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalAnomali = anomalyList.reduce((acc, current) => acc + current.issues.length, 0);
  const anomaliData = anomalyList.filter((a) => a.type !== "late").length;   // karyawan dengan data belum lengkap
  const anomaliTelat = anomalyList.filter((a) => a.type === "late").length;  // keterlambatan hari ini yang belum ditinjau
  const sembunyikanAnomaliHariIni = () => {
    try { window.sessionStorage.setItem("invisual_sembunyi_anomali", todayISO); } catch { /* penyimpanan sesi tak tersedia */ }
    setSembunyiAnomali(true);
  };
  const tampilkanAnomali = () => {
    try { window.sessionStorage.removeItem("invisual_sembunyi_anomali"); } catch { /* abaikan */ }
    setSembunyiAnomali(false);
  };

  const handleApprovalAction = async (id: string, action: "Disetujui" | "Ditolak", keputusan?: "normal" | "sesuai_telat") => {
    try {
      const { error } = await supabase.from("approvals").update({ status: action, ...(keputusan ? { keputusanPulang: keputusan } : {}) }).eq("id", id);
      if (error) throw error;
      // Izin Terlambat disetujui → sesuaikan jam wajib pulang di absen hari itu.
      if (action === "Disetujui" && keputusan) {
        const req: any = pendingApprovals.find((r: any) => r.id === id);
        if (req?.idKaryawan) {
          const tgl = String(req.tanggal || "").slice(0, 10);
          const { data: att } = await supabase.from("attendance").select("id, waktuMasuk").eq("idKaryawan", req.idKaryawan).eq("tanggal", tgl).maybeSingle();
          if (att?.id) {
            let jps = "18:00";
            if (keputusan === "normal") {
              const { data: emp } = await supabase.from("employees").select("jamKeluar").eq("idKaryawan", req.idKaryawan).maybeSingle();
              jps = emp?.jamKeluar || "18:00";
            } else {
              // Durasi kerja diatur HR di Pengaturan (bawaan 9 jam).
              const aturanJK = await ambilAturanJamKerja(supabase);
              jps = tambahJamKe(att.waktuMasuk || "09:00", aturanJK.durasiJam || JAM_KERJA_JAM);
            }
            await supabase.from("attendance").update({ jamPulangSeharusnya: jps }).eq("id", att.id);
          }
        }
      }
      // 🔔 beri tahu karyawan hasil pengajuannya
      try {
        const reqN: any = pendingApprovals.find((r: any) => r.id === id);
        if (reqN?.idKaryawan) {
          const { data: empN } = await supabase.from("employees").select("user_id").eq("idKaryawan", reqN.idKaryawan).maybeSingle();
          if (empN?.user_id) pushNotify(supabase, { memberIds: [empN.user_id], title: `Pengajuan ${reqN.jenis}: ${action}`, body: action === "Disetujui" ? "Pengajuan Anda telah disetujui." : "Pengajuan Anda ditolak.", url: "/user/kehadiran", tag: "pengajuan" });
        }
      } catch { /* abaikan */ }
      logAudit(action === "Disetujui" ? "Setujui Cuti/Izin" : "Tolak Cuti/Izin", `Pengajuan #${id}`);
      fetchDashboardData();
    } catch (err) {
      toast.gagal("Gagal memperbarui status.");
    }
  };

  // Setujui keterlambatan: tandai anomali_disetujui = true (data presensi TETAP tercatat,
  // hanya tak lagi dianggap anomali). Tidak menyentuh data master karyawan.
  const handleApproveLate = async (item: any) => {
    try {
      let query = supabase.from("attendance").update({ anomali_disetujui: true });
      query = item.attendanceId
        ? query.eq("id", item.attendanceId)
        : query.eq("idKaryawan", item.idKaryawan).eq("tanggal", todayISO);
      const { error } = await query;
      if (error) throw error;
      fetchDashboardData();
    } catch (err) {
      toast.gagal("Gagal menyetujui keterlambatan.");
    }
  };

  const handleExportCSV = () => {
    if(todayAttendances.length === 0) return toast.info("Belum ada data absensi hari ini.");
    const headers = ["Nama Karyawan", "Waktu Masuk", "Status Absen", "Lokasi Koordinat"];
    const rows = todayAttendances.map(a => `"${a.nama}","${a.waktuMasuk}","${a.status}","${a.lokasi || 'Terverifikasi'}"`);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Laporan_Absen_${todayISO}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackupDatabase = () => {
    if(employees.length === 0) return toast.info("Database kosong.");
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(employees, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `Backup_HR_Data_${todayISO}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setAttachedFile(e.target.files[0]);
  };

  const closeBroadcastModal = () => {
    setShowBroadcastModal(false);
    setBroadcastMessage("");
    setBroadcastSubject("");
    setAttachedFile(null); 
  };

  const executeBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return toast.gagal("Isi email tidak boleh kosong.");
    setIsBroadcasting(true);
    try {
      const recipients = employees.map((emp: any) => emp.email).filter(Boolean);
      const { data: sess } = await supabase.auth.getSession();
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess?.session?.access_token || ""}` },
        body: JSON.stringify({ recipients, subject: broadcastSubject, message: broadcastMessage }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result?.error || "Gagal mengirim email.");
      toast[result.mode === "SIMULATION" ? "info" : "sukses"](
        result.mode === "SIMULATION"
          ? `[Simulasi] Email ke ${result.sent} staf tercetak di terminal server.`
          : `Email berhasil dikirim ke ${result.sent} staf.`);
      logAudit("Kirim Email Blast", `${recipients.length} penerima`, broadcastSubject || undefined);
      closeBroadcastModal();
    } catch (err: any) {
      toast.gagal("Gagal mengirim email: " + err.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const closeWABroadcastModal = () => {
    setShowWABroadcastModal(false);
    setWaMessage("");
    setWaStatus(null);
  };

  const executeWABroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waMessage.trim()) return toast.gagal("Pesan tidak boleh kosong!");
    setIsSendingWA(true);
    try {
      const targetNumbers = employees.map((emp: any) => emp.noPonsel).filter(Boolean).join(",");
      if (!targetNumbers) { setWaStatus({ type: "error", text: "Belum ada nomor WhatsApp karyawan yang terisi." }); return; }
      const { data: sess } = await supabase.auth.getSession();
      const response = await fetch("/api/wa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sess?.session?.access_token || ""}` },
        body: JSON.stringify({ target: targetNumbers, message: `*PENGUMUMAN*\n\n${waMessage}` }),
      });
      const result = await response.json();
      setWaStatus({ type: "success", text: result.mode === "SIMULATION" ? "[SIMULASI] Sukses tercetak di terminal." : "Siaran WhatsApp sukses terkirim!" });
      logAudit("Kirim WhatsApp Blast", `${targetNumbers.split(",").filter(Boolean).length} nomor`);
      setWaMessage(""); 
    } catch (error: any) {
      setWaStatus({ type: "error", text: "Gagal menghubungkan gateway." });
    } finally {
      setIsSendingWA(false);
      setTimeout(() => setWaStatus(null), 8000);
    }
  };

  const handleFixAnomaly = (idKaryawan: string) => {
    setActiveModal(null);
    router.push(`/admin/karyawan?edit=${idKaryawan}`);
  };

  const onTimeToday = todayAttendances.filter(a => a.status === "Tepat Waktu");
  const lateToday = saringTerlambat(todayAttendances, employees);
  // Keterlambatan yang izinnya belum di-ACC (semua tanggal) → untuk kartu penanda.
  const telatMenungguKeputusan = pendingApprovals.filter((r: any) => r.jenis === "Izin Terlambat");
  const jamMasukPetaHariIni: Record<string, string> = {};
  todayAttendances.forEach((a: any) => { if (a.idKaryawan) jamMasukPetaHariIni[a.idKaryawan] = a.waktuMasuk; });
  // Turunan untuk cincin kehadiran (tampilan saja)
  const hadirTotal = onTimeToday.length + lateToday.length;
  const persenHadir = employees.length ? Math.round((hadirTotal / employees.length) * 100) : 0;
  // "Belum absen" dihitung dari DAFTAR karyawan (bukan pengurangan angka).
  // Dulu: total − hadir − sakit/cuti − WFH/WFC. Padahal karyawan WFH/WFC yang
  // SUDAH clock-in sudah termasuk "hadir", jadi ikut dikurangkan dua kali dan
  // angkanya hampir selalu 0. Sekarang: karyawan aktif yang belum punya absen
  // hari ini DAN tidak sedang sakit/cuti. Karyawan WFH/WFC yang belum clock-in
  // tetap tampil di sini (diberi penanda), karena mereka pun wajib absen.
  const normNama = (v: any) => String(v ?? "").trim().toLowerCase();
  const idSudahAbsen = new Set(todayAttendances.map((a: any) => String(a.idKaryawan ?? "")).filter(Boolean));
  const izinIds = new Set(approvedLeaves.map((a: any) => String(a.idKaryawan ?? "")).filter(Boolean));
  const izinNama = new Set(approvedLeaves.filter((a: any) => !a.idKaryawan).map((a: any) => normNama(a.nama)));
  const remoteIds = new Set(remoteToday.map((a: any) => String(a.idKaryawan ?? "")).filter(Boolean));
  const remoteNama = new Set(remoteToday.filter((a: any) => !a.idKaryawan).map((a: any) => normNama(a.nama)));
  const belumAbsenList = employees.filter((e: any) => {
    const id = String(e.idKaryawan ?? "");
    if (id && idSudahAbsen.has(id)) return false;
    if ((id && izinIds.has(id)) || izinNama.has(normNama(e.nama))) return false;
    return true;
  });
  const belumAbsen = belumAbsenList.length;
  const sedangRemote = (e: any) => (!!e.idKaryawan && remoteIds.has(String(e.idKaryawan))) || remoteNama.has(normNama(e.nama));

  // Log absensi live: clock-in & clock-out jadi satu linimasa, kejadian terbaru di atas.
  const kejadianAbsen = absenLog.flatMap((a: any) => {
    const ev: { kunci: string; jenis: "masuk" | "pulang"; jam: string; a: any }[] = [];
    const k = String(a.id ?? a.idKaryawan ?? a.nama);
    if (a.waktuMasuk) ev.push({ kunci: `masuk-${k}`, jenis: "masuk", jam: jamUrut(a.waktuMasuk), a });
    if (a.waktuKeluar) ev.push({ kunci: `pulang-${k}`, jenis: "pulang", jam: jamUrut(a.waktuKeluar), a });
    return ev;
  }).sort((x, y) => y.jam.localeCompare(x.jam) || (x.jenis === y.jenis ? 0 : x.jenis === "pulang" ? -1 : 1));
  const jumlahMasukLog = kejadianAbsen.filter((e) => e.jenis === "masuk").length;
  const jumlahPulangLog = kejadianAbsen.filter((e) => e.jenis === "pulang").length;
  const kejadianTampil = saringLog === "semua" ? kejadianAbsen : kejadianAbsen.filter((e) => e.jenis === saringLog);

  // Judul jendela rincian sesuai kategori yang diklik.
  const JUDUL_RINCIAN: Record<string, string> = {
    total: "Total karyawan", hadir: "Tepat waktu", terlambat: "Terlambat",
    absen: "Sakit / cuti", remote: "WFH / WFC", belum: "Belum absen",
  };
  // Baris legenda yang bisa diklik (membuka daftar nama sesuai kategorinya).
  const barisKlik = (kunci: string) => ({
    role: "button" as const,
    tabIndex: 0,
    onClick: () => setActiveModal(kunci),
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveModal(kunci); } },
  });

  // =========================================================================
  // KOMPONEN HEADER KANAN (THEME + USER PROFILE + LOGOUT)
  // =========================================================================
  const RightHeaderControls = () => (
    <div className="flex items-center gap-3 relative z-50">
      <div className="flex items-center gap-2 bg-kartu-hover border border-white/10 rounded-full pl-4 pr-1.5 py-1.5 shadow-lg">
        <span className="text-xs text-gray-300 font-medium hidden sm:block max-w-[150px] truncate" title={adminEmail}>
          {adminEmail}
        </span>
        <button onClick={handleLogout} title="Keluar dari Sistem" className="w-7 h-7 rounded-full bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 ml-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      
      {/* =========================================================================
          VIEW MODE 1: THEME GLOW NEO-3D
          ========================================================================= */}
      {tema !== "terang" ? (
        <div className="w-full flex flex-col gap-6 pb-6 font-sans animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 relative z-20">
            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-white tracking-tight">Dasbor HR</h1>
              <p className="text-sm text-gray-400 mt-1">Kehadiran hari ini, pengajuan yang menunggu keputusan, dan aksi cepat.</p>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-2">
              <RightHeaderControls />
              <div className="text-right hidden sm:block">
                <p className="text-[11px] font-black text-tint tracking-wider uppercase mt-1">Hari Ini • {todayDate}</p>
              </div>
            </div>
          </div>

          {/* Tanggal merah hari ini / berikutnya (tabel hari_libur; tidak tampil bila kosong) */}
          <InfoLibur peran="hr" className="relative z-20 -mt-2" />

          {/* Aksi cepat — dulu blok "Pusat Aksi Cepat Eksekutif" di paling bawah; kini baris tombol kecil di bawah judul */}
          <div className="flex flex-wrap gap-2 relative z-20" role="group" aria-label="Aksi cepat" data-aksi-cepat>
            <button onClick={handleExportCSV} className={KELAS_AKSI_CEPAT}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              Export CSV
            </button>
            <button onClick={() => setShowBroadcastModal(true)} className={KELAS_AKSI_CEPAT}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
              Email Blast
            </button>
            <button onClick={() => setShowWABroadcastModal(true)} className={`${KELAS_AKSI_CEPAT} text-green-300 border-green-500/30 hover:bg-green-500/10`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>
              WhatsApp Blast
            </button>
            <button onClick={() => router.push("/admin/payroll")} title="Buka Payroll (finalkan periode lalu kirim slip ke email)" className={`${KELAS_AKSI_CEPAT} text-purple-300 border-purple-500/30 hover:bg-purple-500/10`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              Kirim Slip Gaji
            </button>
            <button onClick={handleBackupDatabase} className={KELAS_AKSI_CEPAT}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" /></svg>
              Backup DB
            </button>
          </div>

          {/* Panel "Perlu dilengkapi" — pengganti popup penghalang & banner merah. Daftar dan aksinya tetap di modal "anomali". */}
          {!isLoading && anomalyList.length > 0 && !sembunyiAnomali && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 relative z-20" data-panel-anomali>
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-amber-200">Perlu dilengkapi</p>
                  <p className="text-xs text-amber-100/75 mt-0.5">
                    {anomaliData > 0 && <>{anomaliData} data karyawan belum lengkap</>}
                    {anomaliData > 0 && anomaliTelat > 0 && <> · </>}
                    {anomaliTelat > 0 && <>{anomaliTelat} keterlambatan hari ini belum ditinjau</>}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 w-full sm:w-auto shrink-0">
                <button onClick={sembunyikanAnomaliHariIni} className="flex-1 sm:flex-none text-xs font-bold text-amber-200/80 hover:text-white px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors whitespace-nowrap">Sembunyikan hari ini</button>
                <button onClick={() => setActiveModal("anomali")} className="flex-1 sm:flex-none bg-amber-400 hover:bg-amber-300 text-black text-xs font-bold px-5 py-2.5 rounded-xl whitespace-nowrap transition-colors">Tinjau {totalAnomali}</button>
              </div>
            </div>
          )}
          {!isLoading && anomalyList.length > 0 && sembunyiAnomali && (
            <div className="flex items-center justify-between gap-3 text-xs text-gray-400 px-1 relative z-20" data-panel-anomali="tersembunyi">
              <span><b className="text-amber-200">{totalAnomali}</b> hal perlu ditinjau (disembunyikan hari ini)</span>
              <button onClick={tampilkanAnomali} className="font-bold text-tint hover:text-white">Tampilkan</button>
            </div>
          )}
          {!isLoading && anomalyList.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/[0.06] px-4 py-3 relative z-20">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-green-400 shrink-0" aria-hidden><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
              <p className="text-sm text-green-200"><b>Data karyawan lengkap</b> <span className="text-green-200/70">· tidak ada keterlambatan yang perlu ditinjau hari ini.</span></p>
            </div>
          )}

          {/* Penanda: keterlambatan yang izinnya belum di-ACC (aditif; juga tampil di antrean di bawah) */}
          {!isLoading && telatMenungguKeputusan.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 md:p-5 shadow-lg relative z-20">
              <div className="flex items-center justify-between gap-3 mb-3 border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-amber-300">Keterlambatan menunggu keputusan pulang</p>
                    <p className="text-[11px] text-amber-200/70 mt-0.5">Tentukan jam pulang tiap karyawan yang clock-in terlambat. Juga tampil di antrean di bawah.</p>
                  </div>
                </div>
                <span className="shrink-0 bg-amber-500/20 text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-500/30">{telatMenungguKeputusan.length}</span>
              </div>
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                {telatMenungguKeputusan.map((req: any) => (
                  <div key={req.id} className="bg-black/20 border border-amber-500/15 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <AvatarKaryawan id={req.idKaryawan} nama={req.nama} className="w-9 h-9 shrink-0 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-300 font-bold border border-amber-500/30" />
                      <div className="min-w-0">
                        <h4 className="font-bold text-white text-sm truncate" title={req.nama}>{namaPanggilan(req.idKaryawan, employees, req.nama)}</h4>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {req.tanggal && <span className="text-[11px] text-gray-400" title={req.tanggal}>{teksTanggal(req.tanggal)}</span>}
                          {jamMasukPetaHariIni[req.idKaryawan] && <span className="text-[11px] text-amber-300 font-mono">Clock-in {jamMasukPetaHariIni[req.idKaryawan]}</span>}
                        </div>
                        <p className="text-[11px] text-gray-300 italic break-words whitespace-pre-wrap mt-0.5">{req.alasan ? `"${req.alasan}"` : "Tanpa keterangan"}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end shrink-0">
                      <button onClick={() => handleApprovalAction(req.id, "Ditolak")} className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white relative z-30">Tolak</button>
                      <button onClick={() => handleApprovalAction(req.id, "Disetujui", "normal")} title="Keterlambatan dimaafkan — pulang jam normal" className="px-3 py-2 bg-green-600/90 hover:bg-green-600 text-white text-xs font-bold rounded-xl relative z-30 whitespace-nowrap">ACC pulang 18:00</button>
                      <button onClick={() => handleApprovalAction(req.id, "Disetujui", "sesuai_telat")} title="Wajib ganti jam — pulang sesuai keterlambatan (clock-in + durasi kerja di Pengaturan)" className="px-3 py-2 bg-primer-terang hover:bg-blue-600 text-white text-xs font-bold rounded-xl relative z-30 whitespace-nowrap">ACC pulang +jam</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-20">

            {/* Sel utama — cincin kehadiran */}
            <BentoCell className="col-span-2 lg:row-span-2 flex flex-col justify-between">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Kehadiran hari ini</p>
                  <p className="text-xs text-gray-500 mt-1">{todayDate}</p>
                </div>
                <span className="shrink-0 bg-green-500/15 text-green-400 text-[11px] font-bold px-2.5 py-1 rounded-full">{isLoading ? "-" : `${persenHadir}% masuk`}</span>
              </div>

              <div className="flex flex-wrap items-center gap-6 py-5">
                <svg viewBox="0 0 100 100" className="w-32 h-32 shrink-0 transition-transform duration-500 group-hover:rotate-6">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="color-mix(in oklab, var(--putih) 7%, transparent)" strokeWidth="11" />
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#2b5cd5" strokeWidth="11" strokeLinecap="round" strokeDasharray={`${(persenHadir / 100) * 264} 264`} transform="rotate(-90 50 50)" />
                  <text x="50" y="49" textAnchor="middle" fill="var(--putih)" fontSize="24" fontWeight="700">{isLoading ? "-" : hadirTotal}</text>
                  <text x="50" y="64" textAnchor="middle" fill="var(--abu-400)" fontSize="9">dari {employees.length} staf</text>
                </svg>

                <div className="space-y-2.5 flex-1 min-w-[150px]">
                  <div {...barisKlik("hadir")} title="Lihat daftar Tepat waktu" className="flex items-center gap-2.5 cursor-pointer rounded-lg hover:bg-white/5 transition-colors relative z-30">
                    <span className="w-2.5 h-2.5 rounded-lg bg-primer-terang"></span>
                    <span className="text-sm text-gray-400">Tepat waktu</span>
                    <span className="ml-auto text-sm font-bold text-white">{isLoading ? "-" : onTimeToday.length}</span>
                    <span className="text-[11px] text-tint">→</span>
                  </div>
                  <div {...barisKlik("terlambat")} title="Lihat daftar Terlambat" className="flex items-center gap-2.5 cursor-pointer rounded-lg hover:bg-white/5 transition-colors relative z-30">
                    <span className="w-2.5 h-2.5 rounded-lg bg-yellow-500"></span>
                    <span className="text-sm text-gray-400">Terlambat</span>
                    <span className="ml-auto text-sm font-bold text-white">{isLoading ? "-" : lateToday.length}</span>
                    <span className="text-[11px] text-tint">→</span>
                  </div>
                  <div {...barisKlik("absen")} title="Lihat daftar Sakit / cuti" className="flex items-center gap-2.5 cursor-pointer rounded-lg hover:bg-white/5 transition-colors relative z-30">
                    <span className="w-2.5 h-2.5 rounded-lg bg-red-500"></span>
                    <span className="text-sm text-gray-400">Sakit / cuti</span>
                    <span className="ml-auto text-sm font-bold text-white">{isLoading ? "-" : approvedLeaves.length}</span>
                    <span className="text-[11px] text-tint">→</span>
                  </div>
                  <div {...barisKlik("remote")} title="Lihat daftar WFH / WFC" className="flex items-center gap-2.5 cursor-pointer rounded-lg hover:bg-white/5 transition-colors relative z-30">
                    <span className="w-2.5 h-2.5 rounded-lg bg-tint-redup"></span>
                    <span className="text-sm text-gray-400">WFH / WFC</span>
                    <span className="ml-auto text-sm font-bold text-white">{isLoading ? "-" : remoteToday.length}</span>
                    <span className="text-[11px] text-tint">→</span>
                  </div>
                  <div {...barisKlik("belum")} title="Lihat daftar Belum absen" className="flex items-center gap-2.5 cursor-pointer rounded-lg hover:bg-white/5 transition-colors relative z-30">
                    <span className="w-2.5 h-2.5 rounded-lg bg-white/20"></span>
                    <span className="text-sm text-gray-400">Belum absen</span>
                    <span className="ml-auto text-sm font-bold text-white">{isLoading ? "-" : belumAbsen}</span>
                    <span className="text-[11px] text-tint">→</span>
                  </div>
                  <div onClick={() => setActiveModal("total")} className="mt-2 pt-2.5 border-t border-white/10 flex items-center gap-2.5 cursor-pointer rounded-lg hover:bg-white/5 transition-colors relative z-30">
                    <span className="w-2.5"></span>
                    <span className="text-sm font-semibold text-gray-300">Total karyawan</span>
                    <span className="ml-auto text-sm font-bold text-white">{isLoading ? "-" : employees.length}</span>
                    <span className="text-[11px] text-tint">→</span>
                  </div>
                </div>
              </div>
            </BentoCell>

            {/* Butuh persetujuan — sejajar cincin kehadiran: dua hal yang paling sering dicek HR */}
            <BentoCell className="col-span-2 lg:row-span-2 flex flex-col">
              <div className="flex justify-between items-center mb-5 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Butuh persetujuan</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">Menyetujui cuti otomatis memotong saldo cuti tahunan.</p>
                </div>
                <span className="shrink-0 bg-primer-terang/20 text-tint text-[11px] font-bold px-3 py-1.5 rounded-full border border-primer-terang/30">{pendingApprovals.length} tertunda</span>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <img src="/logo.png" alt="Memuat data Invisual" className="h-10 w-10 animate-spin object-contain mb-3" />
                  <p className="text-gray-500 text-[11px] font-mono tracking-wider uppercase animate-pulse">Sinkronisasi database...</p>
                </div>
              ) : pendingApprovals.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center min-h-[240px] rounded-xl border border-white/5 bg-white/[0.02] py-8">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6 text-green-400"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                  </div>
                  <p className="text-white text-sm font-bold">Semua beres</p>
                  <p className="text-gray-500 text-xs mt-1">Tidak ada pengajuan tertunda.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar pr-2">
                  {pendingApprovals.map((req) => (
                    <div key={req.id} className="bg-white/[0.03] border border-white/5 p-3.5 rounded-xl flex flex-col gap-2 transition-colors hover:border-white/15">
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarKaryawan id={req.idKaryawan} nama={req.nama} className="w-9 h-9 shrink-0 rounded-full bg-primer-terang/20 flex items-center justify-center text-tint font-bold border border-primer-terang/30" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-white text-sm truncate" title={req.nama}>{namaPanggilan(req.idKaryawan, employees, req.nama)}</h4>
                          <span className="text-[11px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-bold uppercase mt-1 inline-block">{req.jenis}</span>
                        </div>
                      </div>
                      <div className="pl-12">
                        {req.tanggal && <p className="text-[11px] text-gray-500" title={req.tanggal}>{teksTanggal(req.tanggal)}</p>}
                        <p className="text-[11px] text-gray-300 mt-0.5 italic break-words whitespace-pre-wrap">{req.alasan ? `"${req.alasan}"` : "Tanpa keterangan"}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap justify-end pt-1">
                        <button onClick={() => handleApprovalAction(req.id, "Ditolak")} className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white relative z-30">Tolak</button>
                        {req.jenis === "Izin Terlambat" ? (
                          <>
                            <button onClick={() => handleApprovalAction(req.id, "Disetujui", "normal")} title="Keterlambatan dimaafkan — pulang jam normal" className="px-3 py-2 bg-green-600/90 hover:bg-green-600 text-white text-xs font-bold rounded-xl relative z-30">ACC pulang 18:00</button>
                            <button onClick={() => handleApprovalAction(req.id, "Disetujui", "sesuai_telat")} title="Wajib ganti jam — pulang sesuai keterlambatan (clock-in + durasi kerja di Pengaturan)" className="px-3 py-2 bg-primer-terang hover:bg-blue-600 text-white text-xs font-bold rounded-xl relative z-30">ACC pulang +jam</button>
                          </>
                        ) : (
                          <button onClick={() => handleApprovalAction(req.id, "Disetujui")} className="px-4 py-2 bg-primer-terang hover:bg-blue-600 text-white text-xs font-bold rounded-xl relative z-30">Setujui</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </BentoCell>

            {/* Log absensi live — clock-in & clock-out (riwayat pulang) dalam satu linimasa */}
            <BentoCell className="col-span-2 lg:col-span-4">
              <div className="flex justify-between items-center gap-3 mb-4 border-b border-white/5 pb-4">
                <h3 className="text-base font-bold text-white">Log absensi live</h3>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-500">{absenLog.length} tercatat</span>
                  <button
                    type="button"
                    onClick={() => setGaleriFoto({ fokusId: null })}
                    title="Lihat foto selfie absensi (7 hari terakhir)"
                    className="flex items-center gap-1.5 text-[11px] font-bold text-tint bg-primer/10 hover:bg-primer/20 border border-primer/30 px-2.5 py-1 rounded-lg transition-colors shrink-0"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                    Foto absen
                  </button>
                </div>
              </div>
              <div role="group" aria-label="Saring log absensi" className="flex gap-1.5 mb-4 relative z-30">
                {([
                  ["semua", "Semua", kejadianAbsen.length],
                  ["masuk", "Masuk", jumlahMasukLog],
                  ["pulang", "Pulang", jumlahPulangLog],
                ] as const).map(([kunci, label, n]) => (
                  <button
                    key={kunci}
                    type="button"
                    aria-pressed={saringLog === kunci}
                    onClick={() => setSaringLog(kunci)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${saringLog === kunci ? "bg-primer text-white" : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"}`}
                  >
                    {label} <span className={saringLog === kunci ? "text-white/70" : "text-gray-500"}>{n}</span>
                  </button>
                ))}
              </div>
              <div className="relative border-l border-white/10 ml-3 space-y-4 max-h-[280px] overflow-y-auto custom-scrollbar">
                {kejadianTampil.map((ev, idx) => {
                  const absen = ev.a;
                  const pulang = ev.jenis === "pulang";
                  const adaFoto = pulang ? !!absen.foto_keluar : !!absen.foto_masuk;
                  return (
                    <div key={ev.kunci} className="relative pl-6 animate-in slide-in-from-left-2" style={{ animationDelay: `${Math.min(idx, 10) * 50}ms` }}>
                      <div className={`absolute left-[-5px] top-[11px] w-2.5 h-2.5 rounded-full ring-4 ring-latar ${pulang ? "bg-tint-redup" : absen.status === 'Terlambat' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                      <div className="flex items-start gap-2.5">
                        <AvatarKaryawan id={absen.idKaryawan} nama={absen.nama} className="w-8 h-8 shrink-0 rounded-full bg-white/5 border border-white/10 text-white flex items-center justify-center font-bold text-xs" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-white truncate" title={absen.nama}>{namaPanggilan(absen.idKaryawan, employees, absen.nama)}</p>
                            {absen.mode_kerja && absen.mode_kerja !== "Kantor" && (
                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-primer/15 text-tint-redup px-1.5 py-0.5 rounded border border-primer/30">{absen.mode_kerja}</span>
                            )}
                            {!pulang && absen.kompensasi_lembur && (
                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-green-500/10 text-green-300 px-1.5 py-0.5 rounded border border-green-500/30" title={`Kompensasi lembur ${absen.kompensasi_dari || ""}`} data-lencana="kompensasi">kompensasi</span>
                            )}
                            {pulang && tandaLemburHariIni[String(absen.idKaryawan ?? "")] && Number(absen.lembur_menit) >= menitWajib(tandaLemburHariIni[String(absen.idKaryawan ?? "")]) && (
                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30" title={`Ditandai lembur & clock-out ≥ ${teksMenit(menitWajib(tandaLemburHariIni[String(absen.idKaryawan ?? "")]))} setelah jam wajib pulang`} data-lencana="lembur">lembur</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setGaleriFoto({ fokusId: String(absen.idKaryawan ?? "") })}
                              title={adaFoto ? `Lihat foto ${pulang ? "pulang" : "masuk"}` : `Foto ${pulang ? "pulang" : "masuk"} (belum ada)`}
                              aria-label={`Lihat foto absen ${absen.nama}`}
                              className={`sentuh ml-auto shrink-0 p-1 rounded-md transition-colors ${adaFoto ? "text-tint hover:bg-primer/20" : "text-gray-600 hover:text-gray-400 hover:bg-white/5"}`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                            </button>
                            {!pulang && (
                              <TandaiLembur kecil idKaryawan={String(absen.idKaryawan ?? "")} nama={absen.nama} tanggal={todayISO} tandaAda={tandaLemburHariIni[String(absen.idKaryawan ?? "")] || null} onSelesai={() => { setVersiLembur((v) => v + 1); fetchDashboardData(); }} />
                            )}
                          </div>
                          {pulang ? (
                            <span className="text-[11px] bg-primer/10 text-tint-redup px-2 py-0.5 rounded font-mono border border-primer/25 mt-1 inline-block">Pulang {absen.waktuKeluar}</span>
                          ) : (
                            <span className="text-[11px] bg-white/5 text-gray-300 px-2 py-0.5 rounded font-mono border border-white/10 mt-1 inline-block">Masuk {absen.waktuMasuk}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {absenLog.length === 0 ? (
                  <p className="text-xs text-gray-500 pl-6 italic">Belum ada yang absen hari ini.</p>
                ) : kejadianTampil.length === 0 ? (
                  <p className="text-xs text-gray-500 pl-6 italic">{saringLog === "pulang" ? "Belum ada yang clock-out hari ini." : "Belum ada yang clock-in hari ini."}</p>
                ) : null}
              </div>
            </BentoCell>

            {/* Lembur — tanda lembur hari ini & yang kompensasinya berlaku hari ini (hanya tampil bila ada) */}
            <KartuLembur versi={versiLembur} hariIni={todayISO} employees={employees} onUbah={() => { setVersiLembur((v) => v + 1); fetchDashboardData(); }} bungkus={(isi) => <BentoCell className="col-span-2 lg:col-span-4">{isi}</BentoCell>} />

            {/* Sedang Online — siapa yang sedang membuka HRIS (presence kanal privat; hanya HR/manager yang bisa membaca) */}
            <BentoCell className="col-span-2 lg:col-span-4">
              <KartuOnline employees={employees} />
            </BentoCell>
          </div>
        </div>
      ) : (
        /* Tema Neo-Brutal: tata letak mockup; data & aksi tetap dari halaman ini */
        <DasborHRBrutal
          todayISO={todayISO}
          isLoading={isLoading}
          employees={employees}
          onTimeToday={onTimeToday}
          lateToday={lateToday}
          approvedLeaves={approvedLeaves}
          remoteToday={remoteToday}
          belumAbsen={belumAbsen}
          hadirTotal={hadirTotal}
          absenLog={absenLog}
          pendingApprovals={pendingApprovals}
          jamMasukPetaHariIni={jamMasukPetaHariIni}
          tandaLemburHariIni={tandaLemburHariIni}
          saringLog={saringLog}
          setSaringLog={setSaringLog}
          anomali={{ jumlah: anomalyList.length, total: totalAnomali, data: anomaliData, telat: anomaliTelat, sembunyi: sembunyiAnomali, onSembunyi: sembunyikanAnomaliHariIni, onTampil: tampilkanAnomali }}
          versiLembur={versiLembur}
          bukaRincian={setActiveModal}
          bukaFoto={(fokusId) => setGaleriFoto({ fokusId })}
          onKeputusan={handleApprovalAction}
          onLemburBerubah={() => { setVersiLembur((v) => v + 1); fetchDashboardData(); }}
          aksi={{ exportCsv: handleExportCSV, email: () => setShowBroadcastModal(true), wa: () => setShowWABroadcastModal(true), payroll: () => router.push("/admin/payroll"), backup: handleBackupDatabase }}
        />
      )}


      {/* ===== Notifikasi Chat + Ringkasan Corporate Vault + Reset Absensi (tambahan, kedua tema) ===== */}
      <div className="relative z-40 mt-4 px-2 pb-6">
        <ChatNotifCard />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <CorporateSummaryCard />
          <ResetAbsensiCard />
        </div>
      </div>

      {/* =========================================================================
          MODAL GLOBAL (Menyesuaikan Tema) - LAPISAN PALING ATAS
          ========================================================================= */}
      {activeModal === "anomali" && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="bg-kartu border border-white/10 w-full max-w-xl rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-white/5 bg-kartu flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                 <h2 className="text-sm font-bold text-amber-200">Data yang perlu dilengkapi</h2>
              </div>
              <button onClick={() => setActiveModal(null)} className="sentuh text-gray-500 hover:text-white p-1.5 bg-white/5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {anomalyList.map((item, index) => (
                <div key={`anomali-${index}`} className="bg-kartu border border-white/[0.04] p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-start gap-4 hover:border-red-500/30 transition-colors">
                  <div className="space-y-2">
                    <div>
                      <p className="font-bold text-sm text-white">{item.nama}</p>
                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">{item.idKaryawan}</p>
                    </div>
                    {/* MERENDER DAFTAR PERMASALAHAN KOLOM SECARA DETAIL & SPESIFIK */}
                    <div className="space-y-1">
                      {item.issues.map((issue: string, i: number) => (
                        <p key={i} className="text-xs text-red-300 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" aria-hidden></span> {issue}
                        </p>
                      ))}
                    </div>
                  </div>
                  {/* Keterlambatan cukup DISETUJUI (anomali hilang, data presensi utuh).
                      Masalah data karyawan tetap perlu diperbaiki via form edit. */}
                  {item.type === 'late' ? (
                    <button
                      onClick={() => handleApproveLate(item)}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-primer-terang hover:bg-blue-600 text-white text-xs font-bold rounded-lg whitespace-nowrap transition-all self-end sm:self-start shadow-[0_0_12px_rgba(43,92,213,0.4)]"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.061l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>
                      Setujui
                    </button>
                  ) : (
                    <button
                      onClick={() => handleFixAnomaly(item.idKaryawan)}
                      className="w-full sm:w-auto px-4 py-2 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 text-xs font-bold rounded-lg whitespace-nowrap transition-all self-end sm:self-start"
                    >
                      Lengkapi data
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 bg-kartu border-t border-white/5 text-right">
               <button onClick={() => setActiveModal(null)} className="px-5 py-2.5 bg-white/5 text-xs text-gray-300 font-bold hover:text-white rounded-lg border border-white/10">Tutup</button>
            </div>
          </div>
        </div>
      )}


      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`${'bg-kartu rounded-xl'} border border-white/10 w-full max-w-lg shadow-2xl overflow-hidden`}>
            <div className={`p-5 border-b border-white/5 flex justify-between items-center ${'bg-kartu-hover'}`}>
              <h2 className="text-sm font-bold text-white tracking-tight">Siaran Email (Milis)</h2>
              <button onClick={closeBroadcastModal} className="sentuh text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={executeBroadcast} className="p-6 space-y-4">
              <div className="bg-input p-3 rounded-lg border border-white/5 flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase tracking-wider">Dikirim Dari</span>
                <span className="text-tint font-mono">business@invisual.studio</span>
              </div>
              <input type="text" placeholder="Subjek email..." value={broadcastSubject} onChange={(e) => setBroadcastSubject(e.target.value)} className="w-full bg-kartu border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-primer-terang outline-none placeholder-gray-600 transition-all" />
              <textarea required rows={4} placeholder="Ketik isi email di sini..." value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} className="w-full bg-kartu border border-white/5 rounded-xl p-4 text-sm text-white focus:border-primer-terang outline-none custom-scrollbar resize-none placeholder-gray-600 transition-all" />
              <div className="mt-1">
                {!attachedFile ? (
                  <label className="flex items-center gap-2 w-max cursor-pointer text-xs font-bold text-gray-400 hover:text-tint bg-white/5 border border-white/10 px-3 py-2 rounded-lg transition-all">
                    Lampirkan PDF/DOC
                    <input type="file" className="hidden" onChange={handleFileChange} />
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-primer-terang/10 border border-primer-terang/30 px-3 py-2 rounded-lg">
                    <span className="text-xs font-medium text-white truncate max-w-[250px]">{attachedFile.name}</span>
                    <button type="button" onClick={() => setAttachedFile(null)} className="sentuh text-gray-400 hover:text-red-400 p-1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                )}
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={closeBroadcastModal} className="px-4 py-2 bg-white/5 text-gray-300 font-bold rounded-lg text-xs">Batal</button>
                <button type="submit" disabled={isBroadcasting} className="px-4 py-2 bg-primer-terang text-white font-bold rounded-lg text-xs disabled:opacity-50">{isBroadcasting ? "Mengirim Email..." : "Kirim Massal"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWABroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`${'bg-kartu rounded-xl'} border border-white/10 w-full max-w-lg shadow-2xl overflow-hidden`}>
            <div className={`p-5 border-b border-white/5 flex justify-between items-center ${'bg-kartu-hover'}`}>
              <h2 className="text-sm font-bold text-white tracking-tight">Siaran WhatsApp</h2>
              <button onClick={closeWABroadcastModal} className="sentuh text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={executeWABroadcast} className="p-6 space-y-4">
              {waStatus && (
                <div className={`text-[11px] font-bold px-3 py-2 rounded-lg border ${waStatus.type === "success" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                   {waStatus.text}
                </div>
              )}
              <textarea required rows={4} placeholder="Ketik pengumuman WhatsApp di sini..." value={waMessage} onChange={(e) => setWaMessage(e.target.value)} className="w-full bg-kartu border border-white/5 rounded-xl p-4 text-sm text-white focus:border-green-500 outline-none custom-scrollbar resize-none placeholder-gray-600 transition-all" />
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={closeWABroadcastModal} className="px-4 py-2 bg-white/5 text-gray-300 font-bold rounded-lg text-xs">Batal</button>
                <button type="submit" disabled={isSendingWA} className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg text-xs disabled:opacity-50">{isSendingWA ? "Mengirim API..." : "Kirim Massal"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OTHER REGULAR DETAILS MODAL */}
      {activeModal && activeModal !== "anomali" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className={`${'bg-kartu rounded-xl'} border border-white/10 w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`p-4 border-b border-white/5 flex justify-between items-center ${'bg-kartu-hover'}`}>
              <h2 className={`font-bold text-white ${'text-lg uppercase tracking-wider text-xs'}`}>{JUDUL_RINCIAN[activeModal] || "Detail Informasi"}</h2>
              <button onClick={() => setActiveModal(null)} className="sentuh text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5">
              {activeModal === "total" && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {employees.map((emp, i) => (
                    <div key={emp.idKaryawan || emp.id || i} className="flex justify-between items-center gap-3 p-3 bg-input rounded-lg border border-white/5">
                      <div className="flex items-center gap-3 min-w-0"><AvatarKaryawan id={emp.idKaryawan} nama={emp.nama} className={KELAS_AVATAR} /><div className="min-w-0"><p className="font-bold text-sm text-white">{emp.nama}</p><p className="text-[11px] text-gray-500 font-mono mt-0.5">{emp.idKaryawan} • {emp.jabatan}</p></div></div>
                      <span className="text-[11px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded font-bold">Aktif</span>
                    </div>
                  ))}
                </div>
              )}
              {activeModal === "hadir" && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {onTimeToday.map((absen, i) => (
                    <div key={absen.id || `ot-${i}`} className="flex justify-between items-center gap-3 p-3 bg-input rounded-lg border border-white/5 border-l-2 border-l-green-500">
                      <div className="flex items-center gap-3 min-w-0"><AvatarKaryawan id={absen.idKaryawan} nama={absen.nama} className={KELAS_AVATAR} /><div className="min-w-0"><p className="font-bold text-sm text-white">{absen.nama}</p><p className="text-[11px] text-gray-500">{absen.lokasi || "Lokasi Terverifikasi"}</p></div></div>
                      <span className="text-xs font-mono text-green-400">{absen.waktuMasuk} WIB</span>
                    </div>
                  ))}
                  {onTimeToday.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Belum ada yang Clock-In.</p>}
                </div>
              )}
              {activeModal === "terlambat" && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {lateToday.map((absen, i) => (
                    <div key={absen.id || `lt-${i}`} className="flex justify-between items-center gap-3 p-3 bg-input rounded-lg border border-white/5 border-l-2 border-l-yellow-500">
                      <div className="flex items-center gap-3 min-w-0"><AvatarKaryawan id={absen.idKaryawan} nama={absen.nama} className={KELAS_AVATAR} /><div className="min-w-0"><p className="font-bold text-sm text-white">{absen.nama}</p><p className="text-[11px] text-gray-500">{absen.lokasi}</p></div></div>
                      <span className="text-xs font-mono text-amber-400">{absen.waktuMasuk} WIB</span>
                    </div>
                  ))}
                  {lateToday.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Tidak ada yang terlambat.</p>}
                </div>
              )}
              {activeModal === "absen" && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {approvedLeaves.length > 0 && <p className="text-[11px] text-gray-500 mb-1">Klik nama untuk melihat keterangan.</p>}
                  {approvedLeaves.map((leave, i) => {
                    const kunci = leave.id || `lv-${i}`;
                    const buka = bukaAlasan === kunci;
                    return (
                      <div key={kunci} onClick={() => setBukaAlasan(buka ? null : kunci)} className="flex flex-col p-3 bg-input rounded-lg border border-white/5 border-l-2 border-l-red-500 cursor-pointer hover:bg-white/5 transition-colors">
                        <div className="flex justify-between items-center gap-3"><div className="flex items-center gap-3 min-w-0"><AvatarKaryawan id={leave.idKaryawan} nama={leave.nama} className={KELAS_AVATAR} /><div className="min-w-0"><p className="font-bold text-sm text-white">{leave.nama}</p><p className="text-[11px] text-gray-500 mt-0.5" title={leave.tanggal}>{teksTanggal(leave.tanggal)}</p></div></div><span className="shrink-0 text-[11px] bg-red-500/10 text-red-400 px-2 py-1 rounded font-bold uppercase">{leave.jenis}</span></div>
                        {buka && <p className="text-[11px] text-gray-300 mt-2 pt-2 border-t border-white/10 italic whitespace-pre-wrap break-words">{leave.alasan ? `"${leave.alasan}"` : "Tidak ada keterangan."}</p>}
                      </div>
                    );
                  })}
                  {approvedLeaves.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Tidak ada cuti/sakit.</p>}
                </div>
              )}
              {activeModal === "belum" && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {belumAbsenList.length > 0 && <p className="text-[11px] text-gray-500 mb-1">Karyawan aktif yang belum clock-in hari ini (yang sedang sakit/cuti tidak termasuk).</p>}
                  {belumAbsenList.map((emp: any, i: number) => (
                    <div key={emp.idKaryawan || emp.id || `ba-${i}`} className="flex justify-between items-center gap-3 p-3 bg-input rounded-lg border border-white/5 border-l-2 border-l-white/30">
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarKaryawan id={emp.idKaryawan} nama={emp.nama} className={KELAS_AVATAR} />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">{emp.nama}</p>
                          <p className="text-[11px] text-gray-500 font-mono mt-0.5 truncate">{emp.idKaryawan || "-"} • {emp.jabatan || "-"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {sedangRemote(emp) && <span className="text-[11px] bg-primer/15 text-tint-redup px-2 py-1 rounded font-bold uppercase">WFH/WFC</span>}
                        {emp.fleksibel === true
                          ? <span className="text-[11px] bg-white/5 text-gray-400 px-2 py-1 rounded font-bold">Fleksibel</span>
                          : <span className="text-xs font-mono text-gray-400">Masuk {emp.jamMasuk || "09:00"}</span>}
                      </div>
                    </div>
                  ))}
                  {belumAbsenList.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Semua karyawan sudah absen atau sedang izin.</p>}
                </div>
              )}
              {activeModal === "remote" && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {remoteToday.length > 0 && <p className="text-[11px] text-gray-500 mb-1">Klik nama untuk melihat keterangan.</p>}
                  {remoteToday.map((leave, i) => {
                    const kunci = leave.id || `rm-${i}`;
                    const buka = bukaAlasan === kunci;
                    return (
                      <div key={kunci} onClick={() => setBukaAlasan(buka ? null : kunci)} className="flex flex-col p-3 bg-input rounded-lg border border-white/5 border-l-2 border-l-primer cursor-pointer hover:bg-white/5 transition-colors">
                        <div className="flex justify-between items-center gap-3"><div className="flex items-center gap-3 min-w-0"><AvatarKaryawan id={leave.idKaryawan} nama={leave.nama} className={KELAS_AVATAR} /><div className="min-w-0"><p className="font-bold text-sm text-white">{leave.nama}</p><p className="text-[11px] text-gray-500 mt-0.5" title={leave.tanggal}>{teksTanggal(leave.tanggal)}</p></div></div><span className="shrink-0 text-[11px] bg-primer/15 text-tint-redup px-2 py-1 rounded font-bold uppercase">{leave.jenis}</span></div>
                        {buka && <p className="text-[11px] text-gray-300 mt-2 pt-2 border-t border-white/10 italic whitespace-pre-wrap break-words">{leave.alasan ? `"${leave.alasan}"` : "Tidak ada keterangan."}</p>}
                      </div>
                    );
                  })}
                  {remoteToday.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Tidak ada WFH/WFC hari ini.</p>}
                </div>
              )}
            </div>
            {true && (
              <div className="p-4 border-t border-white/5 bg-kartu-hover">
                <button onClick={() => setActiveModal(null)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors">Tutup Jendela</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Galeri foto selfie absensi */}
      {galeriFoto && <GaleriFotoAbsen hariIni={todayISO} fokusId={galeriFoto.fokusId} onTutup={() => setGaleriFoto(null)} />}
    </div>
  );
}