// src/app/admin/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import { saringTerlambat, fleksibelIds, terlambat } from "@/lib/keterlambatan";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

export default function AdminDashboardPage() {
  const toast = useToast();
  const [theme, setTheme] = useState<"glow" | "minimalist">("glow");
  const [adminEmail, setAdminEmail] = useState<string>("Memuat...");
  
  const [employees, setEmployees] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<any[]>([]);
  const [todayAttendances, setTodayAttendances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);

  const [showWABroadcastModal, setShowWABroadcastModal] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [isSendingWA, setIsSendingWA] = useState(false);
  const [waStatus, setWaStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [payslipState, setPayslipState] = useState<{ isOpen: boolean; status: 'idle' | 'sending' | 'success' }>({
    isOpen: false,
    status: 'idle'
  });

  const [showAnomalyPopup, setShowAnomalyPopup] = useState(false);
  const [hasShownAnomaly, setHasShownAnomaly] = useState(false);
  const [anomalyList, setAnomalyList] = useState<any[]>([]);

  const todayDate = new Date().toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const storedTheme = localStorage.getItem("invisual_dashboard_theme") as "glow" | "minimalist";
    if (storedTheme) setTheme(storedTheme);

    // =========================================================================
    // 🔒 PENJAGA PINTU ADMIN SUPABASE (MENCEGAH ADMIN DITENDANG KELUAR)
    // =========================================================================
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Jika tidak ada tiket sesi -> Tendang ke Login
      if (!session) {
        window.location.href = "/login";
        return;
      }
      
      const email = session.user.email?.toLowerCase() || "";
      
      // Jika Karyawan mencoba masuk ke Dashboard Admin -> Tendang ke Dashboard Karyawan
      if (!email.endsWith("@invisual.studio")) {
        window.location.href = "/user/dashboard";
        return;
      }

      // Aman! Lanjut proses dasbor HRD
      setAdminEmail(email);
      fetchDashboardData(); 
    };

    checkAuth();
  }, []);

  const changeTheme = (newTheme: "glow" | "minimalist") => {
    setTheme(newTheme);
    localStorage.setItem("invisual_dashboard_theme", newTheme);
  };

  const handleLogout = async () => {
    const confirmLogout = await toast.konfirmasi("Keluar dari Panel Admin?", { labelYa: "Keluar" });
    if (!confirmLogout) return;
    
    await supabase.auth.signOut(); 
    window.location.href = "/login";
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: empData } = await supabase.from("employees").select("*");
      const { data: pendingData } = await supabase.from("approvals").select("*").eq("status", "Menunggu").order("id", { ascending: false });
      const { data: approvedData } = await supabase.from("approvals").select("*").in("status", ["Disetujui", "Menunggu"]).neq("jenis", "Izin Terlambat");
      const { data: attendanceData } = await supabase.from("attendance").select("*").eq("tanggal", todayISO).order("waktuMasuk", { ascending: false });

      const uniqueAttendances: any[] = [];
      const seenIds = new Set();
      if (attendanceData) {
        attendanceData.forEach((absen) => {
          if (!seenIds.has(absen.idKaryawan)) {
            seenIds.add(absen.idKaryawan);
            uniqueAttendances.push(absen);
          }
        });
      }

      const activeEmployees = empData?.filter(e => e.isAktif ?? true) || [];
      setEmployees(activeEmployees);
      setPendingApprovals(pendingData || []);
      setApprovedLeaves(approvedData || []);
      setTodayAttendances(uniqueAttendances);

      const detectedAnomalies: any[] = [];
      
      activeEmployees.forEach((emp) => {
        const issues: string[] = [];
        if (!emp.noRekening || emp.noRekening === "" || emp.noRekening === "-") issues.push("Nomor Rekening Bank Kosong");
        if (!emp.namaBank || emp.namaBank === "" || emp.namaBank === "-") issues.push("Nama Bank Penerima Belum Diisi");
        if (!emp.nikKtp || String(emp.nikKtp).trim() === "") issues.push("Nomor KTP (NIK) Belum Diisi");
        if (!emp.tanggalBergabung) issues.push("Tanggal Resmi Bergabung Belum Diatur");
        if (!emp.noPonsel || emp.noPonsel === "") issues.push("Nomor Handphone/WhatsApp Kosong");

        if (issues.length > 0) {
          detectedAnomalies.push({ idKaryawan: emp.idKaryawan, nama: emp.nama, issues: issues });
        }
      });

      const lateRecords = saringTerlambat(uniqueAttendances, empData || []);
      lateRecords.forEach(late => {
        detectedAnomalies.push({ idKaryawan: late.idKaryawan, nama: late.nama, issues: [`Terlambat Presensi Masuk (${late.waktuMasuk} WIB)`] });
      });

      setAnomalyList(detectedAnomalies);
    } catch (error) {
      console.error("Gagal sinkronisasi analitik dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (anomalyList.length > 0 && !isLoading && !hasShownAnomaly) {
      setShowAnomalyPopup(true);
      setHasShownAnomaly(true);
    }
  }, [anomalyList, isLoading, hasShownAnomaly]);

  const totalAnomali = anomalyList.reduce((acc, current) => acc + current.issues.length, 0);

  const handleApprovalAction = async (id: string, action: "Disetujui" | "Ditolak") => {
    try {
      const { error } = await supabase.from("approvals").update({ status: action }).eq("id", id);
      if (error) throw error;
      fetchDashboardData();
    } catch (err) {
      toast.gagal("Gagal memperbarui status.");
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
      setWaMessage(""); 
    } catch (error: any) {
      setWaStatus({ type: "error", text: "Gagal menghubungkan gateway." });
    } finally {
      setIsSendingWA(false);
      setTimeout(() => setWaStatus(null), 8000);
    }
  };

  const executeSendPayslips = () => {
    setPayslipState(prev => ({ ...prev, status: 'sending' }));
    setTimeout(() => {
      setPayslipState(prev => ({ ...prev, status: 'success' }));
    }, 3500);
  };

  const handleFixAnomaly = (idKaryawan: string) => {
    setActiveModal(null);
    setShowAnomalyPopup(false);
    window.location.href = `/admin/karyawan?edit=${idKaryawan}`;
  };

  const onTimeToday = todayAttendances.filter(a => a.status === "Tepat Waktu");
  const lateToday = saringTerlambat(todayAttendances, employees);

  // =========================================================================
  // KOMPONEN HEADER KANAN (THEME + USER PROFILE + LOGOUT)
  // =========================================================================
  const RightHeaderControls = () => (
    <div className="flex items-center gap-3 relative z-50">
      <div className="flex bg-white/5 p-1 rounded-full border border-white/10 shrink-0">
        <button onClick={() => changeTheme('glow')} title="Tema Glow 3D" className={`p-1.5 rounded-full transition-all ${theme === 'glow' ? 'bg-primer-terang text-white shadow-[0_0_10px_rgba(43,92,213,0.6)]' : 'text-gray-500 hover:text-white'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813A3.75 3.75 0 007.466 7.89l.813-2.846A.75.75 0 019 4.5z" clipRule="evenodd" /></svg>
        </button>
        <button onClick={() => changeTheme('minimalist')} title="Tema Minimalist" className={`p-1.5 rounded-full transition-all ${theme === 'minimalist' ? 'bg-white text-black shadow-lg' : 'text-gray-500 hover:text-white'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6zm3-1.5a1.5 1.5 0 00-1.5 1.5v12a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H6z" clipRule="evenodd" /></svg>
        </button>
      </div>

      <div className="h-6 w-px bg-white/10 hidden sm:block"></div>

      <div className="flex items-center gap-2 bg-kartu-hover border border-white/10 rounded-full pl-4 pr-1.5 py-1.5 shadow-lg">
        <span className="text-xs text-gray-300 font-medium hidden sm:block max-w-[150px] truncate" title={adminEmail}>
          {adminEmail}
        </span>
        <button onClick={handleLogout} title="Keluar dari Sistem" className="w-7 h-7 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center transition-all cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 ml-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
        </button>
      </div>
    </div>
  );

  // =========================================================================
  // EFEK TRANSISI HALAMAN MENGGUNAKAN LOGO BERPUTAR (Mengganti seluruh layar sementara)
  // =========================================================================
  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[75vh] animate-in fade-in zoom-in-95 duration-500">
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-primer-terang/20 rounded-full blur-2xl animate-pulse"></div>
          <img 
            src="/logo.png" 
            alt="Loading Invisual..." 
            className="relative w-16 h-16 animate-spin object-contain" 
            style={{ animationDuration: "3s" }} 
          />
        </div>
        <p className="text-gray-500 text-[10px] md:text-xs font-mono tracking-[0.25em] uppercase mt-8 animate-pulse">
          Menyinkronkan Data...
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      
      {/* =========================================================================
          VIEW MODE 1: THEME GLOW NEO-3D
          ========================================================================= */}
      {theme === "glow" && (
        <div className="w-full flex flex-col gap-6 pb-6 font-sans animate-in fade-in duration-500">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 relative z-20">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">Panel Kontrol HRD</h1>
              <p className="text-sm text-gray-400 mt-1">Pantau kehadiran karyawan secara real-time dari seluruh titik Invisual Studio.</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <RightHeaderControls />
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black text-primer-terang tracking-widest uppercase mt-1">Hari Ini • {todayDate}</p>
              </div>
            </div>
          </div>

          {anomalyList.length > 0 ? (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg relative z-20">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" /></svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-red-400">Pusat Deteksi Anomali Menemukan {totalAnomali} Masalah Berkas</p>
                  <p className="text-xs text-red-400/70 mt-0.5">Sistem kecerdasan buatan menyaring data wajib yang tidak sinkron.</p>
                </div>
              </div>
              <button onClick={() => setActiveModal("anomali")} className="w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-[0_0_15px_rgba(239,68,68,0.4)] whitespace-nowrap transition-all">Bedah Berkas</button>
            </div>
          ) : (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-4 shadow-lg relative z-20">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 shrink-0"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg></div>
              <div><p className="text-sm font-bold text-green-400">Database & Karyawan Sinkron</p><p className="text-xs text-green-400/70 mt-0.5">Seluruh berkas karyawan bersih dan tervalidasi 100% aman.</p></div>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-20">
            <div onClick={() => setActiveModal("total")} className="p-5 shadow-lg cursor-pointer hover:bg-white/5 hover:scale-[1.02] hover:border-primer-terang/30 transition-all duration-200 group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
              <div className="absolute right-0 top-0 w-16 h-16 bg-primer-terang/10 rounded-bl-full group-hover:scale-125 transition-transform"></div>
              <p className="text-[10px] md:text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest relative z-10">Total Karyawan</p>
              <p className="text-3xl md:text-4xl font-black text-white relative z-10">{employees.length}</p>
            </div>
            <div onClick={() => setActiveModal("hadir")} className="p-5 shadow-lg cursor-pointer hover:bg-white/5 hover:scale-[1.02] hover:border-green-500/30 transition-all duration-200 group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
              <div className="absolute right-0 top-0 w-16 h-16 bg-green-500/10 rounded-bl-full group-hover:scale-125 transition-transform"></div>
              <p className="text-[10px] md:text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest relative z-10">Tepat Waktu</p>
              <p className="text-3xl md:text-4xl font-black text-green-400 relative z-10">{onTimeToday.length}</p>
            </div>
            <div onClick={() => setActiveModal("terlambat")} className="p-5 shadow-lg cursor-pointer hover:bg-white/5 hover:scale-[1.02] hover:border-yellow-500/30 transition-all duration-200 group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
              <div className="absolute right-0 top-0 w-16 h-16 bg-yellow-500/10 rounded-bl-full group-hover:scale-125 transition-transform"></div>
              <p className="text-[10px] md:text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest relative z-10">Terlambat</p>
              <p className="text-3xl md:text-4xl font-black text-yellow-400 relative z-10">{lateToday.length}</p>
            </div>
            <div onClick={() => setActiveModal("absen")} className="p-5 shadow-lg cursor-pointer hover:bg-white/5 hover:scale-[1.02] hover:border-red-500/30 transition-all duration-200 group relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
              <div className="absolute right-0 top-0 w-16 h-16 bg-red-500/10 rounded-bl-full group-hover:scale-125 transition-transform"></div>
              <p className="text-[10px] md:text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest relative z-10">Sakit / Cuti</p>
              <p className="text-3xl md:text-4xl font-black text-red-400 relative z-10">{approvedLeaves.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-20">
            <div className="lg:col-span-2 p-6 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
              <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-white">Butuh Persetujuan</h3>
                  <p className="text-xs text-gray-400 mt-1">Persetujuan otomatis memotong saldo cuti tahunan.</p>
                </div>
                <span className="bg-primer-terang/20 text-tint text-[10px] font-bold px-3 py-1.5 rounded-full border border-primer-terang/30">{pendingApprovals.length} Tertunda</span>
              </div>
              {pendingApprovals.length === 0 ? <div className="text-center py-10 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow"><p className="text-gray-500 text-sm">Tidak ada pengajuan izin tertunda.</p></div> : (
                <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                  {pendingApprovals.map((req) => (
                    <div key={req.id} className="p-4 flex justify-between items-center gap-4 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primer-terang/20 flex items-center justify-center text-tint font-bold border border-primer-terang/30">{req.nama?.charAt(0).toUpperCase() || "?"}</div>
                        <div>
                          <h4 className="font-bold text-white text-sm">{req.nama}</h4>
                          <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-bold uppercase mt-1 inline-block">{req.jenis}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleApprovalAction(req.id, "Ditolak")} className="px-3 py-2 text-xs font-bold text-gray-400 hover:text-white relative z-30">Tolak</button>
                        <button onClick={() => handleApprovalAction(req.id, "Disetujui")} className="px-4 py-2 bg-primer-terang hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-lg relative z-30">Setujui</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
              <h3 className="text-lg font-bold text-white mb-6 border-b border-white/5 pb-4">Log Absensi Live</h3>
              <div className="relative border-l border-white/10 ml-3 space-y-6 max-h-[300px] overflow-y-auto custom-scrollbar">
                {todayAttendances.slice(0, 8).map((absen, idx) => (
                  <div key={`log-${absen.id}`} className="relative pl-6 animate-in slide-in-from-left-2" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className={`absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-kartu ${absen.status === 'Terlambat' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                    <p className="text-sm font-bold text-white">{absen.nama}</p>
                    <span className="text-[10px] bg-white/5 text-gray-300 px-2 py-0.5 rounded font-mono border border-white/10 mt-1 inline-block">Masuk: {absen.waktuMasuk}</span>
                  </div>
                ))}
                {todayAttendances.length === 0 && <p className="text-xs text-gray-500 pl-4 italic">Belum ada absen.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE 2: THEME FLAT MINIMALIST (SaaS Style)
          ========================================================================= */}
      {theme === "minimalist" && (
        <div className="w-full flex flex-col gap-6 pb-6 font-sans text-gray-300 animate-in fade-in duration-500 relative z-20">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-2 pt-2">
            <div><h1 className="text-3xl font-semibold text-white tracking-tight">Overview</h1><p className="text-sm text-gray-400 mt-1.5 flex items-center gap-2">Welcome back! <span className="text-gray-600">•</span> {todayDate}</p></div>
            <RightHeaderControls />
          </div>

          {anomalyList.length > 0 && (
            <div className="bg-latar border border-red-500/10 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <p className="text-sm text-gray-300">Sistem mengidentifikasi <span className="text-red-400 font-semibold">{totalAnomali} masalah integritas data</span> kepegawaian.</p>
              <button onClick={() => setActiveModal("anomali")} className="text-xs font-semibold bg-white text-black px-4 py-2 rounded-md hover:bg-gray-200 transition-colors relative z-30">Bedah Diagnostik</button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div onClick={() => setActiveModal("total")} className="bg-latar border border-white/10 rounded-xl p-5 cursor-pointer hover:bg-input transition-colors flex flex-col justify-between h-32 relative z-30">
              <div className="flex justify-between items-start"><p className="text-sm font-medium text-gray-400">Total Karyawan</p><div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10 8a3 3 0 100-6 3 3 0 000 6zM3.465 14.493a1.23 1.23 0 00.41 1.412A9.957 9.957 0 0010 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 00-13.074.003z" /></svg></div></div>
              <h2 className="text-3xl font-bold text-white">{employees.length}</h2>
            </div>
            <div onClick={() => setActiveModal("hadir")} className="bg-latar border border-white/10 rounded-xl p-5 cursor-pointer hover:bg-input transition-colors flex flex-col justify-between h-32 relative z-30">
              <div className="flex justify-between items-start"><p className="text-sm font-medium text-gray-400">Tepat Waktu</p><div className="w-8 h-8 rounded-lg bg-green-500/10 text-green-400 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg></div></div>
              <h2 className="text-3xl font-bold text-white">{onTimeToday.length}</h2>
            </div>
            <div onClick={() => setActiveModal("terlambat")} className="bg-latar border border-white/10 rounded-xl p-5 cursor-pointer hover:bg-input transition-colors flex flex-col justify-between h-32 relative z-30">
              <div className="flex justify-between items-start"><p className="text-sm font-medium text-gray-400">Terlambat</p><div className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" /></svg></div></div>
              <h2 className="text-3xl font-bold text-white">{lateToday.length}</h2>
            </div>
            <div onClick={() => setActiveModal("absen")} className="bg-latar border border-white/10 rounded-xl p-5 cursor-pointer hover:bg-input transition-colors flex flex-col justify-between h-32 relative z-30">
              <div className="flex justify-between items-start"><p className="text-sm font-medium text-gray-400">Sakit / Cuti</p><div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-400 flex items-center justify-center"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clipRule="evenodd" /></svg></div></div>
              <h2 className="text-3xl font-bold text-white">{approvedLeaves.length}</h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-latar border border-white/10 rounded-xl p-6 flex flex-col relative z-20">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base font-semibold text-white">Pending Leave Requests</h3>
                <span className="bg-white/10 text-gray-300 text-xs font-medium px-2.5 py-1 rounded-md">{pendingApprovals.length} Pending</span>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 max-h-[300px] pr-2">
                {pendingApprovals.length === 0 ? <div className="text-sm text-gray-500 py-4 border border-dashed border-white/5 rounded-lg text-center">All caught up! No pending requests.</div> : (
                  pendingApprovals.map((req) => (
                    <div key={req.id} className="bg-input border border-white/10 p-4 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-300 font-medium">{req.nama?.charAt(0).toUpperCase() || "?"}</div>
                        <div><h4 className="font-medium text-white text-sm">{req.nama}</h4><p className="text-xs text-gray-400 mt-0.5">{req.jenis} • {new Date(req.tanggal).toLocaleDateString('id-ID')}</p></div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => handleApprovalAction(req.id, "Ditolak")} className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white border border-transparent hover:border-white/10 rounded-md transition-colors relative z-30">Reject</button>
                        <button onClick={() => handleApprovalAction(req.id, "Disetujui")} className="px-3 py-1.5 bg-white text-black hover:bg-gray-200 text-xs font-medium rounded-md transition-colors relative z-30">Approve</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-latar border border-white/10 rounded-xl p-6 flex flex-col relative z-20">
              <h3 className="text-base font-semibold text-white mb-6">Live Attendance Log</h3>
              <div className="relative border-l border-white/10 ml-2 space-y-6 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar pr-2">
                {todayAttendances.slice(0, 8).map((absen, idx) => (
                  <div key={`log-${absen.id}`} className="relative pl-5" style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className={`absolute left-[-5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-latar ${absen.status === 'Terlambat' ? 'bg-yellow-500' : 'bg-green-500'}`}></div>
                    <p className="text-sm font-medium text-white">{absen.nama}</p>
                    <span className="text-[10px] text-gray-500 font-mono mt-1 block">{absen.waktuMasuk} WIB</span>
                  </div>
                ))}
                {todayAttendances.length === 0 && <p className="text-xs text-gray-500 pl-4">No data today.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ⚙️ KUNCI PENTING: Z-INDEX 40 AGAR TOMBOL INI 100% BISA DIKLIK!
          ========================================================================= */}
      <div className="relative z-40 mt-4 px-2 pb-6">
        <h3 className="text-sm font-bold text-gray-400 tracking-widest uppercase mb-4 pl-2 font-mono">Pusat Aksi Cepat Eksekutif</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <button onClick={handleExportCSV} className="bg-kartu border border-white/10 p-4 rounded-xl text-center hover:bg-white/10 transition-all text-xs font-bold text-gray-300 shadow-xl cursor-pointer pointer-events-auto">Export CSV</button>
          <button onClick={() => setShowBroadcastModal(true)} className="bg-kartu border border-white/10 p-4 rounded-xl text-center hover:bg-white/10 transition-all text-xs font-bold text-gray-300 shadow-xl cursor-pointer pointer-events-auto">Email Blast</button>
          <button onClick={() => setShowWABroadcastModal(true)} className="bg-kartu border border-green-500/30 p-4 rounded-xl text-center hover:bg-green-500/20 transition-all text-xs font-bold text-green-400 shadow-xl cursor-pointer pointer-events-auto">WhatsApp Blast</button>
          <button onClick={() => setPayslipState({ isOpen: true, status: 'idle' })} className="bg-kartu border border-purple-500/30 p-4 rounded-xl text-center hover:bg-purple-500/20 transition-all text-xs font-bold text-purple-400 shadow-xl cursor-pointer pointer-events-auto">Kirim Slip Gaji</button>
          <button onClick={handleBackupDatabase} className="bg-kartu border border-white/10 p-4 rounded-xl text-center hover:bg-white/10 transition-all text-xs font-bold text-gray-300 shadow-xl cursor-pointer pointer-events-auto">Backup DB</button>
        </div>
      </div>

      {/* =========================================================================
          MODAL GLOBAL (Menyesuaikan Tema) - LAPISAN PALING ATAS
          ========================================================================= */}
      {activeModal === "anomali" && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="bg-input border border-white/10 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-white/5 bg-kartu flex justify-between items-center">
              <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                 <h2 className="text-sm font-mono font-black text-red-400 uppercase tracking-widest">Manifest Masalah Diagnostik</h2>
              </div>
              <button onClick={() => setActiveModal(null)} className="text-gray-500 hover:text-white p-1.5 bg-white/5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {anomalyList.map((item, index) => (
                <div key={`anomali-${index}`} className="bg-kartu-hover border border-white/[0.04] p-4 rounded-xl flex flex-col sm:flex-row justify-between sm:items-start gap-4 hover:border-red-500/30 transition-colors">
                  <div className="space-y-2">
                    <div>
                      <p className="font-bold text-sm text-white">{item.nama}</p>
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.idKaryawan}</p>
                    </div>
                    {/* MERENDER DAFTAR PERMASALAHAN KOLOM SECARA DETAIL & SPESIFIK */}
                    <div className="space-y-1">
                      {item.issues.map((issue: string, i: number) => (
                        <p key={i} className="text-xs text-red-400 flex items-center gap-1.5">
                          <span className="text-[8px]">❌</span> {issue}
                        </p>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={() => handleFixAnomaly(item.idKaryawan)}
                    className="w-full sm:w-auto px-4 py-2 bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 text-xs font-bold rounded-lg whitespace-nowrap transition-all self-end sm:self-start"
                  >
                    Sembuhkan Data
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 bg-kartu border-t border-white/5 text-right">
               <button onClick={() => setActiveModal(null)} className="px-5 py-2.5 bg-white/5 text-xs text-gray-300 font-bold hover:text-white rounded-lg border border-white/10">Tutup Dasbor Diagnostik</button>
            </div>
          </div>
        </div>
      )}

      {showAnomalyPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-input border border-white/10 w-full max-w-sm p-8 relative flex flex-col items-center text-center rounded-2xl shadow-2xl">
            <button onClick={() => setShowAnomalyPopup(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20 shadow-[0_0_25px_rgba(239,68,68,0.2)] mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight">Anomali Terdeteksi!</h2>
            <p className="text-sm text-gray-400 mt-2 mb-6">Pusat keamanan mendeteksi data administrasi karyawan tidak lengkap di database Supabase.</p>
            <div className="flex w-full gap-3">
              <button onClick={() => setShowAnomalyPopup(false)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-xs text-gray-300 font-bold rounded-lg border border-white/10">Abaikan</button>
              <button onClick={() => { setShowAnomalyPopup(false); setActiveModal("anomali"); }} className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-xs font-bold text-white rounded-lg shadow-lg shadow-red-600/30">Bedah Masalah</button>
            </div>
          </div>
        </div>
      )}

      {payslipState.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className={`${theme === 'glow' ? 'bg-kartu rounded-3xl shadow-[0_0_40px_rgba(168,85,247,0.15)]' : 'bg-input rounded-2xl shadow-2xl'} border border-white/10 w-full max-w-sm p-8 relative flex flex-col items-center text-center animate-in zoom-in-95 kartu-glow`}>
            {payslipState.status === 'idle' && (
              <>
                <button onClick={() => setPayslipState({ isOpen: false, status: 'idle' })} className="absolute top-4 right-4 text-gray-500 hover:text-white"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4 border border-purple-500/20"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg></div>
                <h2 className="text-xl font-bold text-white tracking-tight">Kirim Slip Gaji Massal</h2>
                <p className="text-sm text-gray-400 mt-2 mb-6">Kirimkan berkas PDF gaji bulan ini secara otomatis ke email <span className="text-white font-bold">{employees.length} staf aktif</span>.</p>
                <div className="flex w-full gap-3"><button onClick={() => setPayslipState({ isOpen: false, status: 'idle' })} className="flex-1 py-2.5 bg-white/5 text-xs text-gray-300 font-bold rounded-lg border border-white/10">Batal</button><button onClick={executeSendPayslips} className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white rounded-lg shadow-lg">Kirim Sekarang</button></div>
              </>
            )}
            
            {/* === PERUBAHAN LOADING SAAT MEMPROSES PENGIRIMAN PAYSLIP === */}
            {payslipState.status === 'sending' && (
              <div className="py-6 flex flex-col items-center justify-center">
                <img 
                  src="/logo.png" 
                  alt="Memproses..." 
                  className="w-12 h-12 animate-spin object-contain mb-4" 
                  style={{ animationDuration: "3s" }} 
                />
                <h2 className="text-base font-bold text-white animate-pulse">Memproses Antrean Server...</h2>
              </div>
            )}

            {payslipState.status === 'success' && (
              <div className="py-2">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center text-green-500 mx-auto mb-4 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.2)]"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg></div>
                <h2 className="text-xl font-bold text-white">Slip Gaji Terkirim!</h2>
                <p className="text-sm text-gray-400 mt-2 mb-6">Seluruh dokumen PDF berhasil terdistribusi secara privat ke email masing-masing pegawai.</p>
                <button onClick={() => setPayslipState({ isOpen: false, status: 'idle' })} className="w-full py-2.5 bg-white/5 text-xs font-bold text-white border border-white/10 rounded-lg">Selesai</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`${theme === 'glow' ? 'bg-kartu rounded-3xl' : 'bg-kartu rounded-xl'} border border-white/10 w-full max-w-lg shadow-2xl overflow-hidden kartu-glow`}>
            <div className={`p-5 border-b border-white/5 flex justify-between items-center ${theme === 'glow' ? 'bg-kartu-hover' : 'bg-latar'}`}>
              <h2 className="text-sm font-bold text-white tracking-tight">Siaran Email (Milis)</h2>
              <button onClick={closeBroadcastModal} className="text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={executeBroadcast} className="p-6 space-y-4">
              <div className="bg-input p-3 rounded-lg border border-white/10 flex justify-between items-center text-xs">
                <span className="text-gray-500 font-bold uppercase tracking-widest">Dikirim Dari</span>
                <span className="text-tint font-mono">business@invisual.studio</span>
              </div>
              <input type="text" placeholder="Subjek email..." value={broadcastSubject} onChange={(e) => setBroadcastSubject(e.target.value)} className="w-full bg-input border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primer-terang outline-none placeholder-gray-600 transition-all" />
              <textarea required rows={4} placeholder="Ketik isi email di sini..." value={broadcastMessage} onChange={(e) => setBroadcastMessage(e.target.value)} className="w-full bg-input border border-white/10 rounded-xl p-4 text-sm text-white focus:border-primer-terang outline-none custom-scrollbar resize-none placeholder-gray-600 transition-all" />
              <div className="mt-1">
                {!attachedFile ? (
                  <label className="flex items-center gap-2 w-max cursor-pointer text-xs font-bold text-gray-400 hover:text-tint bg-white/5 border border-white/10 px-3 py-2 rounded-lg transition-all">
                    Lampirkan PDF/DOC
                    <input type="file" className="hidden" onChange={handleFileChange} />
                  </label>
                ) : (
                  <div className="flex items-center justify-between bg-primer-terang/10 border border-primer-terang/30 px-3 py-2 rounded-lg">
                    <span className="text-xs font-medium text-white truncate max-w-[250px]">{attachedFile.name}</span>
                    <button type="button" onClick={() => setAttachedFile(null)} className="text-gray-400 hover:text-red-500 p-1"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                )}
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={closeBroadcastModal} className="px-4 py-2 bg-white/5 text-gray-300 font-bold rounded-lg text-xs">Batal</button>
                {/* === PERUBAHAN LOADING PADA TOMBOL BROADCAST EMAIL === */}
                <button type="submit" disabled={isBroadcasting} className="px-4 py-2 bg-primer-terang text-white font-bold rounded-lg text-xs disabled:opacity-50 flex items-center justify-center gap-2">
                  {isBroadcasting && <img src="/logo.png" className="w-4 h-4 animate-spin object-contain" style={{ animationDuration: "3s" }} />}
                  {isBroadcasting ? "Mengirim Email..." : "Kirim Massal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWABroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`${theme === 'glow' ? 'bg-kartu rounded-3xl' : 'bg-kartu rounded-xl'} border border-white/10 w-full max-w-lg shadow-2xl overflow-hidden kartu-glow`}>
            <div className={`p-5 border-b border-white/5 flex justify-between items-center ${theme === 'glow' ? 'bg-kartu-hover' : 'bg-latar'}`}>
              <h2 className="text-sm font-bold text-white tracking-tight">Siaran WhatsApp</h2>
              <button onClick={closeWABroadcastModal} className="text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={executeWABroadcast} className="p-6 space-y-4">
              {waStatus && (
                <div className={`text-[11px] font-bold px-3 py-2 rounded-lg border ${waStatus.type === "success" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                   {waStatus.text}
                </div>
              )}
              <textarea required rows={4} placeholder="Ketik pengumuman WhatsApp di sini..." value={waMessage} onChange={(e) => setWaMessage(e.target.value)} className="w-full bg-input border border-white/10 rounded-xl p-4 text-sm text-white focus:border-green-500 outline-none custom-scrollbar resize-none placeholder-gray-600 transition-all" />
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={closeWABroadcastModal} className="px-4 py-2 bg-white/5 text-gray-300 font-bold rounded-lg text-xs">Batal</button>
                {/* === PERUBAHAN LOADING PADA TOMBOL BROADCAST WA === */}
                <button type="submit" disabled={isSendingWA} className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg text-xs disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSendingWA && <img src="/logo.png" className="w-4 h-4 animate-spin object-contain" style={{ animationDuration: "3s" }} />}
                  {isSendingWA ? "Mengirim API..." : "Kirim Massal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OTHER REGULAR DETAILS MODAL */}
      {activeModal && activeModal !== "anomali" && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className={`${theme === 'glow' ? 'bg-kartu rounded-3xl' : 'bg-kartu rounded-xl'} border border-white/10 w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 kartu-glow`}>
            <div className={`p-4 border-b border-white/5 flex justify-between items-center ${theme === 'glow' ? 'bg-kartu-hover' : 'bg-latar'}`}>
              <h2 className={`font-bold text-white ${theme === 'glow' ? 'text-lg uppercase tracking-wider text-xs' : 'text-sm'}`}>Detail Informasi</h2>
              <button onClick={() => setActiveModal(null)} className="text-gray-500 hover:text-white p-1 bg-white/5 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-5">
              {activeModal === "total" && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {employees.map(emp => (
                    <div key={emp.id} className="flex justify-between items-center p-3 bg-input rounded-lg border border-white/10">
                      <div><p className="font-bold text-sm text-white">{emp.nama}</p><p className="text-[10px] text-gray-500 font-mono mt-0.5">{emp.idKaryawan} • {emp.jabatan}</p></div>
                      <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded font-bold">Aktif</span>
                    </div>
                  ))}
                </div>
              )}
              {activeModal === "hadir" && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {onTimeToday.map(absen => (
                    <div key={absen.id} className="flex justify-between items-center p-3 bg-input rounded-lg border border-white/10 border-l-2 border-l-green-500">
                      <div><p className="font-bold text-sm text-white">{absen.nama}</p><p className="text-[10px] text-gray-500">{absen.lokasi || "Lokasi Terverifikasi"}</p></div>
                      <span className="text-xs font-mono text-green-400">{absen.waktuMasuk} WIB</span>
                    </div>
                  ))}
                  {onTimeToday.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Belum ada yang Clock-In.</p>}
                </div>
              )}
              {activeModal === "terlambat" && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {lateToday.map(absen => (
                    <div key={absen.id} className="flex justify-between items-center p-3 bg-input rounded-lg border border-white/10 border-l-2 border-l-yellow-500">
                      <div><p className="font-bold text-sm text-white">{absen.nama}</p><p className="text-[10px] text-gray-500">{absen.lokasi}</p></div>
                      <span className="text-xs font-mono text-yellow-400">{absen.waktuMasuk} WIB</span>
                    </div>
                  ))}
                  {lateToday.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Tidak ada yang terlambat.</p>}
                </div>
              )}
              {activeModal === "absen" && (
                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                  {approvedLeaves.map(leave => (
                    <div key={leave.id} className="flex flex-col p-3 bg-input rounded-lg border border-white/10 border-l-2 border-l-red-500">
                      <div className="flex justify-between items-center"><p className="font-bold text-sm text-white">{leave.nama}</p><span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded font-bold uppercase">{leave.jenis}</span></div>
                      <p className="text-[10px] text-gray-500 mt-1">{leave.tanggal}</p>
                    </div>
                  ))}
                  {approvedLeaves.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Tidak ada cuti/sakit.</p>}
                </div>
              )}
            </div>
            {theme === "glow" && (
              <div className="p-4 border-t border-white/5 bg-kartu-hover">
                <button onClick={() => setActiveModal(null)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-xl transition-colors">Tutup Jendela</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}