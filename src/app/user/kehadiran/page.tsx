// src/app/user/kehadiran/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import LoadingLogo from "@/components/LoadingLogo";

export default function UserKehadiranPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [jamMasuk, setJamMasuk] = useState("09:00");
  const [jamKeluar, setJamKeluar] = useState("17:00");
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [pengajuanList, setPengajuanList] = useState<any[]>([]);
  const [recentAttendances, setRecentAttendances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // 🔥 STATE NOTIFIKASI KUSTOM (Pengganti alert bawaan browser yang jelek)
  const [toast, setToast] = useState<{show: boolean, type: "success" | "error", message: string}>({ show: false, type: "success", message: "" });

  // STATE FORMULIR PENGAJUAN
  const [showForm, setShowForm] = useState(false);
  const [jenisIzin, setJenisIzin] = useState("Cuti Tahunan");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalSelesai, setTanggalSelesai] = useState("");
  const [estimasiSampai, setEstimasiSampai] = useState("");
  const [alasan, setAlasan] = useState("");
  const [suratDokter, setSuratDokter] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // KAMERA & FOTO
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [captureMode, setCaptureMode] = useState<"in" | "out" | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  const todayDate = new Date().toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = new Date().toISOString().split('T')[0];

  // FUNGSI MENAMPILKAN NOTIFIKASI CANTIK
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast({ show: false, type: "success", message: "" }), 4000);
  };

  useEffect(() => {
    const initializePage = async () => {
      try {
        const sessionStr = localStorage.getItem("invisualUserSession") || 
                           sessionStorage.getItem("invisualUserSession") || 
                           localStorage.getItem("invisual_session");
       
        if (sessionStr && sessionStr !== "null" && sessionStr !== "undefined") {
          const user = JSON.parse(sessionStr);
          const userData = Array.isArray(user) ? user[0] : user;
         
          if (userData && userData.nama) {
            setCurrentUser(userData);
            const safeId = userData.idKaryawan || userData.id_karyawan || userData.id || "INV-UNKNOWN";
            await fetchDashboardData(safeId);
          } else {
             window.location.href = "/login";
          }
        } else {
           window.location.href = "/login";
        }
      } catch (e) {
        console.error("Gagal membaca sesi:", e);
        window.location.href = "/login";
      } finally {
        setIsLoading(false);
      }
    };

    initializePage();
  }, []);

  const fetchDashboardData = async (safeId: string) => {
    try {
      const { data: todayData } = await supabase.from("attendance").select("*").eq("idKaryawan", safeId).eq("tanggal", todayISO).single();
      if (todayData) setTodayAttendance(todayData);

      const { data: absData } = await supabase.from("attendance").select("*").eq("idKaryawan", safeId).order("tanggal", { ascending: false }).limit(5);
      if (absData) setRecentAttendances(absData);

      const { data: reqData } = await supabase.from("approvals").select("*").eq("idKaryawan", safeId).order("id", { ascending: false });
      if (reqData) setPengajuanList(reqData);

      const { data: schedData } = await supabase.from("employees").select("jamMasuk, jamKeluar").eq("idKaryawan", safeId).single();
      if (schedData?.jamMasuk) setJamMasuk(schedData.jamMasuk);
      if (schedData?.jamKeluar) setJamKeluar(schedData.jamKeluar);
    } catch (e) {
      console.error("Error fetching data:", e);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      if (videoRef.current) videoRef.current.srcObject = stream;
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

  // Mulai proses absen: nyalakan kamera untuk mode tertentu ('in' / 'out')
  const startCapture = async (mode: "in" | "out") => {
    setCapturedPhoto(null);
    setCaptureMode(mode);
    await startCamera();
  };

  // Batalkan: matikan kamera & kembali ke tombol Clock In/Out
  const cancelCapture = () => {
    stopCamera();
    setCaptureMode(null);
  };

  // Kamera hanya dimatikan saat komponen ditutup (tidak auto-start lagi)
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

  const handleAjukanIzin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return showToast("error", "Sesi login tidak valid.");
   
    setIsSubmitting(true);

    let formatTanggal = tanggalMulai;
    if (tanggalSelesai && tanggalMulai !== tanggalSelesai && jenisIzin !== "Izin Terlambat") {
      formatTanggal += ` s/d ${tanggalSelesai}`;
    }
    if (jenisIzin === "Izin Terlambat" && estimasiSampai) {
      formatTanggal += ` (Est. Sampai: ${estimasiSampai} WIB)`;
    }

    const safeIdKaryawan = currentUser.idKaryawan || currentUser.id_karyawan || currentUser.id || "INV-UNKNOWN";

    const newRequest = {
      id: "req-" + Date.now().toString(),
      nama: currentUser.nama || "Karyawan Invisual",
      idKaryawan: safeIdKaryawan,
      jenis: jenisIzin,
      tanggal: formatTanggal,
      alasan: alasan,
      status: "Menunggu"
    };

    try {
      const { error } = await supabase.from("approvals").insert([newRequest]);
      if (error) throw error;

      showToast("success", `Pengajuan ${jenisIzin} berhasil dikirim ke HRD!`);
     
      setShowForm(false);
      setAlasan("");
      setTanggalMulai("");
      setTanggalSelesai("");
      setEstimasiSampai("");
      setSuratDokter("");
     
      await fetchDashboardData(safeIdKaryawan);
    } catch (err: any) {
      showToast("error", "Gagal mengirim pengajuan: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockIn = async () => {
    if (hasCameraPermission === false) return showToast("error", "Izinkan akses kamera di browser Anda!");
    setIsActionLoading(true);
    takePhoto(); // ambil foto lalu kamera otomatis mati

    const now = new Date();
    const timeString = now.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    const [schedH, schedM] = String(jamMasuk || "09:00").split(":").map(Number);
    const isLate = (now.getHours() * 60 + now.getMinutes()) > ((schedH || 9) * 60 + (schedM || 0));
    const statusKehadiran = isLate ? "Terlambat" : "Tepat Waktu";
    const safeId = currentUser.idKaryawan || currentUser.id_karyawan || currentUser.id || "INV-UNKNOWN";

    try {
      const { error } = await supabase.from("attendance").insert([{
        idKaryawan: safeId, nama: currentUser.nama, tanggal: todayISO,
        waktuMasuk: timeString, waktuKeluar: null, lokasi: "Kantor Invisual (Selfie)", status: statusKehadiran
      }]);
      if (error) throw error;
      showToast("success", `Clock-In berhasil dicatat pada ${timeString} WIB.`);
      await fetchDashboardData(safeId);
    } catch (err: any) {
      showToast("error", "Gagal merekam absensi: " + err.message);
    } finally {
      setIsActionLoading(false);
      setCaptureMode(null); // kembali ke tampilan tombol, kamera tetap mati
    }
  };

  const handleClockOut = async () => {
    if (hasCameraPermission === false) return showToast("error", "Izinkan akses kamera di browser Anda!");
    setIsActionLoading(true);
    takePhoto(); // ambil foto lalu kamera otomatis mati

    const timeString = new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    const safeId = currentUser.idKaryawan || currentUser.id_karyawan || currentUser.id || "INV-UNKNOWN";
    
    try {
      const { error } = await supabase.from("attendance").update({ waktuKeluar: timeString }).eq("id", todayAttendance.id);
      if (error) throw error;
      showToast("success", `Clock-Out berhasil: ${timeString} WIB. Hati-hati di jalan!`);
      await fetchDashboardData(safeId);
    } catch (err: any) {
      showToast("error", "Gagal merekam jam pulang: " + err.message);
    } finally {
      setIsActionLoading(false);
      setCaptureMode(null); // kembali ke tampilan tombol, kamera tetap mati
    }
  };

  // 🔄 LOADING AWAL HALAMAN — logo.png berputar (pengganti spinner border lama)
  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-gray-400">
        <LoadingLogo size={72} text="Memverifikasi Data..." />
      </div>
    );
  }

  const isAttendanceComplete = todayAttendance?.waktuKeluar != null;

  return (
    <div className="w-full flex flex-col gap-6 pb-6 font-sans">
     
      {/* 🔥 CUSTOM TOAST NOTIFICATION (PENGGANTI ALERT) */}
      {toast.show && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[10000] w-[92%] max-w-sm animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="relative flex items-center gap-3.5 bg-[#15121A] border border-white/10 rounded-2xl shadow-2xl px-4 py-3.5 overflow-hidden">
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${toast.type === 'success' ? 'bg-green-400' : 'bg-red-400'}`} />
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${toast.type === 'success' ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
              {toast.type === 'success' ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              )}
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${toast.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{toast.type === 'success' ? 'Berhasil' : 'Gagal'}</p>
              <p className="text-[13px] font-semibold text-white leading-snug">{toast.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* HEADER UTAMA */}
      <div className="flex justify-between items-center bg-[#15121A] border border-white/5 p-4 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="text-xl md:text-2xl font-bold text-white">Kehadiran Saya</h1>
          <p className="text-[10px] md:text-xs text-gray-400 mt-1">Halo <span className="text-[#b3c5ff] font-bold">{currentUser?.nama}</span>, kelola absen Anda. <span className="inline-flex items-center gap-1 ml-1 text-[#8ba7ff]"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Jam kerja {jamMasuk}–{jamKeluar}</span></p>
        </div>
        <button onClick={() => setShowForm(true)} className="relative z-10 bg-[#124bce] hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-colors whitespace-nowrap active:scale-95">
          Ajukan Izin / Cuti
        </button>
      </div>

      {/* KARTU RINGKASAN */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mo-stagger">
        <div className="bg-[#15121A] border border-white/5 rounded-2xl p-4 md:p-5 shadow-lg mo-lift border-l-4 border-l-green-500">
          <p className="text-[10px] md:text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest truncate">Hadir</p>
          <p className="text-xl md:text-2xl font-black text-white">22 <span className="text-xs font-normal text-gray-400">Hr</span></p>
        </div>
        <div className="bg-[#15121A] border border-white/5 rounded-2xl p-4 md:p-5 shadow-lg mo-lift border-l-4 border-l-yellow-500">
          <p className="text-[10px] md:text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest truncate">Terlambat</p>
          <p className="text-xl md:text-2xl font-black text-white">1 <span className="text-xs font-normal text-gray-400">Hr</span></p>
        </div>
        <div className="bg-[#15121A] border border-white/5 rounded-2xl p-4 md:p-5 shadow-lg mo-lift border-l-4 border-l-red-500">
          <p className="text-[10px] md:text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest truncate">Sakit/Izin</p>
          <p className="text-xl md:text-2xl font-black text-white">0 <span className="text-xs font-normal text-gray-400">Hr</span></p>
        </div>
        <div className="bg-[#124bce]/10 border border-[#124bce]/30 rounded-2xl p-4 md:p-5 shadow-lg mo-lift border-l-4 border-l-[#124bce]">
          <p className="text-[10px] md:text-xs text-[#b3c5ff] font-bold mb-1 uppercase tracking-widest truncate">Sisa Cuti</p>
          <p className="text-xl md:text-2xl font-black text-white">{currentUser?.sisaCuti ?? 12} <span className="text-xs font-normal text-gray-400">Hr</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-1">
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
                <p className="text-[8px] md:text-xs font-bold uppercase tracking-widest text-center">Kamera Dinonaktifkan</p>
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
                    <p className="text-gray-700 text-[8px] md:text-[10px] mt-0.5">{isAttendanceComplete ? "Absensi hari ini sudah selesai" : `Tekan tombol ${!todayAttendance ? "Clock In" : "Clock Out"} untuk mulai absen`}</p>
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
                Absensi Selesai
              </div>
            ) : captureMode ? (
              /* Kamera aktif → ambil foto & submit, atau batal */
              <div className="flex gap-2.5">
                <button
                  onClick={captureMode === "in" ? handleClockIn : handleClockOut}
                  disabled={isActionLoading || !cameraOn}
                  className={`flex-1 text-white font-bold py-3.5 md:py-4 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 disabled:opacity-50 text-xs md:text-sm ${captureMode === "in" ? "bg-[#124bce] hover:bg-blue-600" : "bg-[#de236e] hover:bg-[#c51f60]"}`}
                >
                  {isActionLoading ? (
                    <><LoadingLogo size={20} /> Menyimpan Wajah...</>
                  ) : (
                    <>📸 Absen Sekarang</>
                  )}
                </button>
                <button
                  onClick={cancelCapture}
                  disabled={isActionLoading}
                  className="px-4 md:px-5 py-3.5 md:py-4 rounded-xl md:rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 font-bold transition-all disabled:opacity-50 text-xs md:text-sm"
                >
                  Batal
                </button>
              </div>
            ) : !todayAttendance ? (
              /* Belum clock-in → tombol memulai (kamera muncul saat diklik) */
              <button onClick={() => startCapture("in")} className="w-full bg-[#124bce] hover:bg-blue-600 text-white font-bold py-3.5 md:py-4 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 text-xs md:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 md:w-5 md:h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.822 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                CLOCK IN
              </button>
            ) : (
              /* Sudah clock-in, belum clock-out → tombol memulai clock-out */
              <button onClick={() => startCapture("out")} className="w-full bg-[#de236e]/10 hover:bg-[#de236e] text-[#e85a92] hover:text-white border border-[#de236e]/30 font-bold py-3.5 md:py-4 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 text-xs md:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 md:w-5 md:h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.822 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                CLOCK OUT
              </button>
            )}
          </div>
        </div>

        {/* KANAN: STATUS PENGAJUAN */}
        <div className="bg-[#15121A] border border-white/5 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-xl overflow-hidden flex flex-col">
          <h3 className="text-base md:text-lg font-bold text-white mb-4 border-b border-white/5 pb-4">Status Pengajuan Saya</h3>
         
          <div className="flex-1 overflow-y-auto max-h-80 custom-scrollbar pr-1">
            {pengajuanList.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs md:text-sm">Belum ada riwayat pengajuan izin/cuti.</div>
            ) : (
              <div className="flex flex-col gap-3 mo-stagger">
                {pengajuanList.map((req) => (
                  <div key={req.id} className="bg-[#1C1823] border border-white/5 p-3 md:p-4 rounded-xl flex items-center justify-between gap-2 hover:bg-white/5 mo-lift">
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-white text-[10px] md:text-xs truncate">{req.jenis}</span>
                      </div>
                      <p className="text-[9px] md:text-[10px] text-gray-400 truncate">{req.tanggal}</p>
                      {req.alasan && <p className="text-[9px] md:text-[10px] text-gray-500 mt-1 italic truncate">"{req.alasan}"</p>}
                    </div>
                    <span className={`text-[7px] md:text-[9px] font-bold px-2 py-1 rounded border uppercase tracking-widest shrink-0
                      ${req.status === 'Disetujui' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        req.status === 'Ditolak' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                      {req.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL FORMULIR PENGAJUAN — VERSI DARK / FLAT (TANPA GLOW)
          ========================================================================= */}
      {showForm && (
        <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center p-4 pb-24 md:pb-4">
          {/* Latar Blur */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl animate-in fade-in duration-300"></div>
          
          <div className="relative bg-[#0B0A0F] border border-white/10 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">

            <div className="px-6 py-5 md:px-8 md:py-6 border-b border-white/5 flex justify-between items-center relative z-10">
              <div>
                <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">Formulir Pengajuan</h2>
                <p className="text-[10px] md:text-xs text-gray-400 mt-1">Sistem akan memproses ke dasbor HRD.</p>
              </div>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-white p-2 bg-white/5 rounded-full transition-colors border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
           
            <form onSubmit={handleAjukanIzin} className="px-6 py-5 md:px-8 md:py-6 space-y-5 overflow-y-auto max-h-[60vh] custom-scrollbar relative z-10">
             
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Jenis Pengajuan</label>
                <select value={jenisIzin} onChange={(e) => setJenisIzin(e.target.value)} className="w-full bg-[#1C1823] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#124bce] focus:ring-1 focus:ring-[#124bce]/50 outline-none transition-all shadow-inner">
                  <option value="Cuti Tahunan">Cuti Tahunan</option>
                  <option value="Izin Terlambat">Izin Terlambat</option>
                  <option value="Izin Tidak Masuk">Izin Tidak Masuk (Pribadi)</option>
                  <option value="Izin Sakit">Izin Sakit</option>
                  <option value="Work From Home (WFH)">Work From Home (WFH)</option>
                  <option value="Work From Cafe (WFC)">Work From Cafe (WFC)</option>
                </select>
              </div>

              {jenisIzin === "Izin Terlambat" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Tanggal</label>
                    <input type="date" required value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} className="w-full bg-[#1C1823] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#124bce] outline-none transition-all shadow-inner [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#b3c5ff] mb-1.5 uppercase tracking-widest">Est. Sampai</label>
                    <input type="time" required value={estimasiSampai} onChange={(e) => setEstimasiSampai(e.target.value)} className="w-full bg-[#124bce]/10 border border-[#124bce]/30 rounded-xl px-4 py-3 text-sm text-white focus:border-[#124bce] outline-none transition-all shadow-inner [color-scheme:dark]" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Tgl Mulai</label>
                    <input type="date" required value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} className="w-full bg-[#1C1823] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#124bce] outline-none transition-all shadow-inner [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Tgl Selesai</label>
                    <input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} className="w-full bg-[#1C1823] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#124bce] outline-none transition-all shadow-inner [color-scheme:dark]" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Keterangan Singkat</label>
                <textarea required rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Tuliskan keterangan detail di sini..." className="w-full bg-[#1C1823] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-[#124bce] focus:ring-1 focus:ring-[#124bce]/50 outline-none transition-all shadow-inner resize-none custom-scrollbar" />
              </div>

              {jenisIzin === "Izin Sakit" && (
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 animate-in fade-in">
                  <label className="block text-xs font-bold text-red-400 mb-2 uppercase tracking-wide flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg> Wajib Surat Dokter</label>
                  <input type="file" required accept="image/*,.pdf" onChange={(e) => setSuratDokter(e.target.files?.[0]?.name || "")} className="w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-red-500/10 file:text-red-400 hover:file:bg-red-500/20 cursor-pointer transition-colors" />
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button type="submit" disabled={isSubmitting} className="w-full py-4 text-xs font-bold text-white uppercase tracking-widest bg-[#124bce] hover:bg-blue-600 rounded-xl transition-colors disabled:opacity-50 active:scale-[0.98]">
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoadingLogo size={18} />
                      Mengirim ke HRD...
                    </span>
                  ) : (
                    "Kirim Pengajuan"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
