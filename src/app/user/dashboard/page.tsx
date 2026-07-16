// src/app/user/dashboard/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import LoadingLogo from "@/components/LoadingLogo";

export default function UserDashboardPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // STATE UNTUK POPUP SELAMAT DATANG NEO-3D
  const [showWelcomePopup, setShowWelcomePopup] = useState(false);

  // STATE UNTUK RIWAYAT & PENGAJUAN
  const [recentAttendances, setRecentAttendances] = useState<any[]>([]);
  const [recentLeaves, setRecentLeaves] = useState<any[]>([]);

  // STATE & REF UNTUK KAMERA SELFIE
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [captureMode, setCaptureMode] = useState<"in" | "out" | null>(null);
  const [jamMasuk, setJamMasuk] = useState("09:00");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  const todayDate = new Date().toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        const sessionLs = localStorage.getItem("invisualUserSession");
        const sessionSs = sessionStorage.getItem("invisualUserSession");
        const session = sessionSs || sessionLs || localStorage.getItem("invisual_session");
        
        if (session && session !== "null" && session !== "undefined") {
          const user = JSON.parse(session);
          const userData = Array.isArray(user) ? user[0] : user;
          
          if (userData && userData.nama) {
            setCurrentUser(userData);

            const safeId = userData.idKaryawan || userData.id_karyawan || userData.id || "INV-UNKNOWN";

            // 🔥 LOGIKA POPUP: Memakai kunci baru agar pasti muncul untuk Anda lihat desainnya
            const hasBeenWelcomed = sessionStorage.getItem("invisual_popup_v2_" + safeId);
            if (!hasBeenWelcomed) {
              setShowWelcomePopup(true);
              sessionStorage.setItem("invisual_popup_v2_" + safeId, "true");
            }

            await fetchDashboardData(safeId);
          } else {
             window.location.href = "/login";
          }
        } else {
           window.location.href = "/login";
        }
      } catch (e) {
        console.error("Gagal membaca sesi", e);
        window.location.href = "/login";
      } finally {
        setIsLoading(false);
      }
    };

    initializeDashboard();
  }, []);

  // Timer popup berjalan otomatis tertutup setelah 5 detik
  useEffect(() => {
    if (showWelcomePopup && !isLoading) {
      const timer = setTimeout(() => setShowWelcomePopup(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showWelcomePopup, isLoading]);

  const fetchDashboardData = async (safeId: string) => {
    try {
      const { data: todayData } = await supabase.from("attendance").select("*").eq("idKaryawan", safeId).eq("tanggal", todayISO).single();
      if (todayData) setTodayAttendance(todayData);

      const { data: absData } = await supabase.from("attendance").select("*").eq("idKaryawan", safeId).order("tanggal", { ascending: false }).limit(5);
      if (absData) setRecentAttendances(absData);

      const { data: cutiData } = await supabase.from("approvals").select("*").eq("idKaryawan", safeId).order("id", { ascending: false }).limit(3);
      if (cutiData) setRecentLeaves(cutiData);

      const { data: schedData } = await supabase.from("employees").select("jamMasuk").eq("idKaryawan", safeId).single();
      if (schedData?.jamMasuk) setJamMasuk(schedData.jamMasuk);
    } catch (e) {
      console.error("Error fetching data dari Supabase:", e);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setHasCameraPermission(true);
      setCameraOn(true);
    } catch (err) {
      setHasCameraPermission(false);
      setCameraOn(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  };

  // Mulai absen: nyalakan kamera untuk mode tertentu
  const startCapture = async (mode: "in" | "out") => {
    setCapturedPhoto(null);
    setCaptureMode(mode);
    await startCamera();
  };
  const cancelCapture = () => {
    stopCamera();
    setCaptureMode(null);
  };

  // Kamera hanya dimatikan saat halaman ditutup (tidak auto-start lagi)
  useEffect(() => {
    return () => stopCamera();
  }, []);

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      setIsFlashing(true);
      setTimeout(() => setIsFlashing(false), 150);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setCapturedPhoto(dataUrl);
        stopCamera();
        return dataUrl;
      }
    }
    return null;
  };

  const handleClockIn = async () => {
    if (hasCameraPermission === false) return alert("Izinkan akses kamera di browser Anda!");
    setIsActionLoading(true);
    takePhoto();

    const now = new Date();
    const timeString = now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    const [schedH, schedM] = String(jamMasuk || "09:00").split(":").map(Number);
    const isLate = (now.getHours() * 60 + now.getMinutes()) > ((schedH || 9) * 60 + (schedM || 0));
    const statusKehadiran = isLate ? "Terlambat" : "Tepat Waktu";

    const safeId = currentUser.idKaryawan || currentUser.id_karyawan || currentUser.id || "INV-UNKNOWN";

    try {
      const { error } = await supabase.from("attendance").insert([{
        idKaryawan: safeId, 
        nama: currentUser.nama, 
        tanggal: todayISO,
        waktuMasuk: timeString, 
        waktuKeluar: null, 
        lokasi: "Invisual Studio (Selfie)", 
        status: statusKehadiran
      }]);
      if (error) throw error;
      alert(`✅ Clock-In berhasil: ${timeString} WIB.`);
      await fetchDashboardData(safeId);
    } catch (err: any) {
      alert("Gagal merekam absensi: " + err.message);
    } finally {
      setIsActionLoading(false);
      setCaptureMode(null);
    }
  };

  const handleClockOut = async () => {
    if (hasCameraPermission === false) return alert("Izinkan akses kamera di browser Anda!");
    setIsActionLoading(true);
    takePhoto();

    const timeString = new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    const safeId = currentUser.idKaryawan || currentUser.id_karyawan || currentUser.id || "INV-UNKNOWN";
    
    try {
      const { error } = await supabase.from("attendance").update({ waktuKeluar: timeString }).eq("id", todayAttendance.id);
      if (error) throw error;
      alert(`✅ Clock-Out berhasil: ${timeString} WIB.`);
      await fetchDashboardData(safeId);
    } catch (err: any) {
      alert("Gagal merekam jam pulang: " + err.message);
    } finally {
      setIsActionLoading(false);
      setCaptureMode(null);
    }
  };

  // 🔄 LOADING AWAL DASHBOARD — logo.png berputar (pengganti spinner border lama)
  if (isLoading || !currentUser) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3 text-gray-400">
        <LoadingLogo size={72} text="Menyiapkan Ruang Kerja..." />
      </div>
    );
  }

  const isAttendanceComplete = todayAttendance?.waktuKeluar != null;

  return (
    <div className="w-full flex flex-col gap-4 md:gap-6 pb-10 font-sans">
      
      {/* HEADER TANGGAL */}
      <div className="flex justify-end mb-1 md:mb-2">
        <div className="bg-[#15121A] border border-white/5 px-4 py-2.5 rounded-xl flex items-center gap-3 shadow-lg">
          <span className="w-2 h-2 bg-[#de236e] rounded-full animate-pulse"></span>
          <p className="text-xs font-bold text-white tracking-wide">{todayDate}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        
        {/* KIRI: TERMINAL KAMERA ABSENSI */}
        <div className="bg-[#15121A] border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl relative overflow-hidden flex flex-col">
          <h3 className="text-base md:text-lg font-bold text-white mb-3 md:mb-4 border-b border-white/5 pb-3 md:pb-4 flex justify-between items-center">
            Terminal Absensi
            {isAttendanceComplete ? (
              <span className="text-[8px] md:text-[10px] bg-green-500/10 text-green-400 px-2 md:px-3 py-1 rounded-full border border-green-500/20 uppercase tracking-widest flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Selesai
              </span>
            ) : todayAttendance?.waktuMasuk ? (
              <span className="text-[8px] md:text-[10px] bg-blue-500/10 text-[#b3c5ff] px-2 md:px-3 py-1 rounded-full border border-[#124bce]/30 uppercase tracking-widest flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#124bce] animate-pulse"></span> On Duty
              </span>
            ) : (
              <span className="text-[8px] md:text-[10px] bg-yellow-500/10 text-yellow-400 px-2 md:px-3 py-1 rounded-full border border-yellow-500/20 uppercase tracking-widest flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span> Standby
              </span>
            )}
          </h3>
          
          <div className="w-full aspect-video bg-black rounded-xl md:rounded-2xl border border-white/10 flex items-center justify-center relative overflow-hidden mb-4 md:mb-6">
            {isFlashing && <div className="absolute inset-0 bg-white z-50 animate-out fade-out duration-150"></div>}

            {/* 🔄 OVERLAY LOADING saat sedang menyimpan absensi (clock-in/out) */}
            {isActionLoading && (
              <div className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-center justify-center">
                <LoadingLogo size={56} text="Menyimpan Wajah..." />
              </div>
            )}

            {capturedPhoto ? (
              <img src={capturedPhoto} alt="Selfie Absensi" className="w-full h-full object-cover" />
            ) : isAttendanceComplete ? (
              <div className="flex flex-col items-center gap-2 md:gap-3 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 md:w-12 md:h-12 opacity-50"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                <p className="text-[8px] md:text-[10px] font-bold uppercase tracking-widest text-center">Kamera Dinonaktifkan</p>
              </div>
            ) : hasCameraPermission === false ? (
              <div className="text-center px-4">
                <p className="text-red-400 text-xs md:text-sm font-bold mb-1">Kamera Ditolak</p>
                <p className="text-[9px] md:text-xs text-gray-500">Izinkan kamera di pengaturan browser.</p>
              </div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${cameraOn ? "opacity-100" : "opacity-0"}`} />
                {!cameraOn && !capturedPhoto && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 bg-[#050404]">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 md:w-10 md:h-10 text-gray-600 mb-2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" /><path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" /></svg>
                    <p className="text-gray-500 text-[10px] md:text-xs font-bold">Kamera Nonaktif</p>
                    <p className="text-gray-700 text-[8px] md:text-[10px] mt-0.5">{isAttendanceComplete ? "Absensi hari ini sudah selesai" : `Tekan ${!todayAttendance ? "Clock In" : "Clock Out"} untuk mulai absen`}</p>
                  </div>
                )}
              </>
            )}

            <canvas ref={canvasRef} className="hidden" />

            {(cameraOn && !capturedPhoto) && (
              <>
                <div className="absolute bottom-2 md:bottom-4 left-2 md:left-4 bg-black/60 backdrop-blur-md px-2 md:px-3 py-1 md:py-1.5 rounded-md md:rounded-lg border border-white/10 flex items-center gap-1.5 md:gap-2 z-10">
                  <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <span className="text-[8px] md:text-[10px] text-white font-mono tracking-widest truncate">Face ID</span>
                </div>
                <div className="absolute inset-0 border-[1px] border-white/10 grid grid-cols-3 grid-rows-3 pointer-events-none z-10 opacity-30">
                  <div className="border-r border-b border-white/10"></div><div className="border-r border-b border-white/10"></div><div className="border-b border-white/10"></div>
                  <div className="border-r border-b border-white/10"></div><div className="border-r border-b border-white/10"></div><div className="border-b border-white/10"></div>
                  <div className="border-r border-white/10"></div><div className="border-r border-white/10"></div><div></div>
                </div>
              </>
            )}
          </div>

          <div className="mt-auto">
            {isAttendanceComplete ? (
              <div className="w-full bg-green-500/10 border border-green-500/20 text-green-400 font-bold py-3.5 md:py-4 rounded-xl md:rounded-2xl flex justify-center items-center gap-2 text-xs md:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 md:w-5 md:h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Absensi Hari Ini Selesai
              </div>
            ) : captureMode ? (
              <div className="flex gap-2.5">
                <button
                  onClick={captureMode === "in" ? handleClockIn : handleClockOut}
                  disabled={isActionLoading || !cameraOn}
                  className={`flex-1 text-white font-bold py-3.5 md:py-4 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 disabled:opacity-50 text-xs md:text-sm ${captureMode === "in" ? "bg-[#124bce] hover:bg-blue-600" : "bg-[#de236e] hover:bg-[#c51f60]"}`}
                >
                  {isActionLoading ? (<><LoadingLogo size={20} withRing={false} /> Menyimpan Wajah...</>) : (<>📸 Absen Sekarang</>)}
                </button>
                <button onClick={cancelCapture} disabled={isActionLoading} className="px-4 md:px-5 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 font-bold transition-all disabled:opacity-50 text-xs md:text-sm">
                  Batal
                </button>
              </div>
            ) : !todayAttendance ? (
              <button onClick={() => startCapture("in")} className="w-full bg-[#124bce] hover:bg-blue-600 text-white font-bold py-3.5 md:py-4 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 text-xs md:text-sm">
                📸 CLOCK IN SEKARANG
              </button>
            ) : (
              <button onClick={() => startCapture("out")} className="w-full bg-[#de236e]/10 hover:bg-[#de236e] text-[#e85a92] hover:text-white border border-[#de236e]/30 font-bold py-3.5 md:py-4 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 text-xs md:text-sm">
                📸 CLOCK OUT (PULANG)
              </button>
            )}
          </div>
        </div>

        {/* KANAN: RIWAYAT ABSENSI & STATUS PENGAJUAN */}
        <div className="flex flex-col gap-4 md:gap-6 mo-stagger">
          
          <div className="bg-[#15121A] border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl">
            <h3 className="text-[10px] md:text-sm font-bold text-gray-400 mb-3 md:mb-4 uppercase tracking-widest truncate">Catatan Hari Ini</h3>
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="bg-[#1C1823] p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5 relative overflow-hidden mo-lift">
                <div className="absolute right-0 top-0 w-8 h-8 md:w-12 md:h-12 bg-[#124bce]/10 rounded-bl-full"></div>
                <p className="text-[9px] md:text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider md:tracking-widest relative z-10 truncate">Masuk</p>
                <p className="text-lg md:text-2xl font-mono font-bold text-white relative z-10 truncate">{todayAttendance?.waktuMasuk || "--:--"}</p>
                {todayAttendance?.status && (
                  <p className={`text-[8px] md:text-[10px] mt-1 font-bold uppercase tracking-wider md:tracking-widest relative z-10 truncate ${todayAttendance.status === 'Terlambat' ? 'text-yellow-500' : 'text-green-400'}`}>
                    {todayAttendance.status}
                  </p>
                )}
              </div>
              <div className="bg-[#1C1823] p-3 md:p-4 rounded-xl md:rounded-2xl border border-white/5 relative overflow-hidden mo-lift">
                <div className="absolute right-0 top-0 w-8 h-8 md:w-12 md:h-12 bg-[#de236e]/10 rounded-bl-full"></div>
                <p className="text-[9px] md:text-[10px] text-gray-500 mb-1 font-bold uppercase tracking-wider md:tracking-widest relative z-10 truncate">Pulang</p>
                <p className="text-lg md:text-2xl font-mono font-bold text-white relative z-10 truncate">{todayAttendance?.waktuKeluar || "--:--"}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#15121A] border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl flex-1 flex flex-col">
            <h3 className="text-[10px] md:text-sm font-bold text-gray-400 mb-3 md:mb-4 uppercase tracking-widest flex justify-between items-center">
              <span>Riwayat Absensi Terakhir</span>
            </h3>
            <div className="flex-1 space-y-2.5 md:space-y-3 overflow-y-auto max-h-40 custom-scrollbar pr-1">
              {recentAttendances.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">Belum ada riwayat.</p>
              ) : (
                recentAttendances.map((att, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-[#1C1823] p-2.5 md:p-3 rounded-xl border border-white/5 mo-lift">
                    <div className="overflow-hidden pr-2">
                      <p className="text-[10px] md:text-xs font-bold text-white truncate">{att.tanggal}</p>
                      <p className="text-[8px] md:text-[10px] text-gray-500 font-mono truncate">{att.lokasi}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] md:text-xs font-mono text-white mb-0.5">{att.waktuMasuk}</p>
                      <span className={`text-[7px] md:text-[9px] font-bold px-1.5 md:px-2 py-0.5 rounded uppercase ${att.status === 'Terlambat' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-400'}`}>
                        {att.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-[#15121A] border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl flex-1 flex flex-col">
            <h3 className="text-[10px] md:text-sm font-bold text-gray-400 mb-3 md:mb-4 uppercase tracking-widest flex justify-between items-center">
              <span>Status Pengajuan Terakhir</span>
            </h3>
            <div className="flex-1 space-y-2.5 md:space-y-3 overflow-y-auto max-h-40 custom-scrollbar pr-1">
              {recentLeaves.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">Belum ada pengajuan.</p>
              ) : (
                recentLeaves.map((leave, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-[#1C1823] p-2.5 md:p-3 rounded-xl border border-white/5 mo-lift">
                    <div className="overflow-hidden pr-2">
                      <p className="text-[10px] md:text-xs font-bold text-white truncate">{leave.jenis}</p>
                      <p className="text-[8px] md:text-[10px] text-gray-500 font-mono truncate">{leave.tanggal}</p>
                    </div>
                    <div className="shrink-0">
                      <span className={`text-[7px] md:text-[9px] font-bold px-1.5 md:px-2 py-0.5 rounded uppercase border
                        ${leave.status === 'Disetujui' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                          leave.status === 'Ditolak' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                          'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                        {leave.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* =========================================================================
          POPUP SELAMAT DATANG — VERSI DARK / FLAT (TANPA GLOW)
          ========================================================================= */}
      {showWelcomePopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#050404]/90 backdrop-blur-md p-4 animate-in fade-in duration-500">
          <div className="relative w-full max-w-sm">
            
            {/* Kotak Kontainer Utama */}
            <div className="relative bg-[#0B0A0F] border border-white/10 rounded-[2rem] shadow-2xl p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-500 overflow-hidden">
              
              {/* Ikon Lingkaran Konsentris — versi flat */}
              <div className="relative w-24 h-24 flex items-center justify-center mb-6 mt-2">
                <div className="absolute inset-0 rounded-full border border-white/15"></div>
                <div className="absolute inset-2 rounded-full border border-white/10"></div>
                <div className="absolute inset-4 bg-[#1C1823] rounded-full flex items-center justify-center border border-white/5">
                  <span className="text-3xl text-gray-200 font-serif italic">i</span>
                </div>
              </div>
              
              {/* Teks Sapaan */}
              <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Selamat Datang!</h2>
              <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                Halo, <span className="font-bold text-[#b3c5ff]">{currentUser.nama.split(" ")[0]}</span>!<br/>
                Sistem absensi HR Anda siap digunakan.
              </p>
              
              {/* Tombol — versi flat */}
              <button 
                onClick={() => setShowWelcomePopup(false)} 
                className="w-full bg-[#124bce] hover:bg-blue-600 px-6 py-3.5 rounded-full transition-colors duration-300 flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-white"><path d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" /></svg>
                <span className="text-sm font-bold text-white tracking-widest uppercase">Clock-In</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
