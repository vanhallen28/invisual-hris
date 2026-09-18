// src/app/user/kehadiran/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { TOLERANSI_TELAT_MENIT, jamPulangDariClockIn } from "@/lib/keterlambatan";
import { jarakMeter, ambilPosisi } from "@/lib/lokasi";
import { pushNotify } from "@/lib/push";
import LoadingLogo from "@/components/LoadingLogo";
import { useToast } from "@/components/Toast";

// Gaya sel bento + cahaya biru yang mengikuti kursor (tampilan saja).
const bentoCls =
  "relative overflow-hidden bg-white/[0.04] border border-white/10 rounded-2xl transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20";
const bentoGlow = {
  backgroundImage:
    "radial-gradient(340px circle at var(--mx, -300px) var(--my, -300px), rgba(18,75,206,0.16), transparent 62%)",
};
const bentoMove = (e: { currentTarget: HTMLDivElement; clientX: number; clientY: number }) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
};
const bentoLeave = (e: { currentTarget: HTMLDivElement }) => {
  e.currentTarget.style.setProperty("--mx", "-300px");
  e.currentTarget.style.setProperty("--my", "-300px");
};

export default function UserKehadiranPage() {
  const toast = useToast();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [jamMasuk, setJamMasuk] = useState("09:00");
  const [toleransiTelat, setToleransiTelat] = useState(TOLERANSI_TELAT_MENIT);
  const [blokirPulangTelat, setBlokirPulangTelat] = useState(false);
  const [geofenceAktif, setGeofenceAktif] = useState(false);
  const [kantorLat, setKantorLat] = useState(NaN);
  const [kantorLng, setKantorLng] = useState(NaN);
  const [kantorRadius, setKantorRadius] = useState(150);
  const [isFleksibel, setIsFleksibel] = useState(false);
  const [jamKeluar, setJamKeluar] = useState("17:00");
  const [todayAttendance, setTodayAttendance] = useState<any>(null);
  const [pengajuanList, setPengajuanList] = useState<any[]>([]);
  const [recentAttendances, setRecentAttendances] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // 🔥 STATE NOTIFIKASI KUSTOM (Pengganti alert bawaan browser yang jelek)

  // STATE FORMULIR PENGAJUAN
  const [showForm, setShowForm] = useState(false);
  const [promptTelat, setPromptTelat] = useState(false);
  const [wajibTelat, setWajibTelat] = useState(false);
  const [alasanWajibTelat, setAlasanWajibTelat] = useState("");
  const [alasanTelat, setAlasanTelat] = useState("");
  const [menyimpanTelat, setMenyimpanTelat] = useState(false);
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
  // Lokasi kerja saat absen masuk. Default kantor; WFH/WFC hanya boleh
  // dipilih kalau pengajuannya untuk hari ini sudah disetujui.
  const [modeKerja, setModeKerja] = useState<"Kantor" | "WFH" | "WFC">("Kantor");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  const todayDate = new Date().toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(); // tanggal LOKAL (WIB), bukan UTC

  // WFH/WFC hanya boleh dipilih saat absen kalau pengajuannya untuk hari
  // ini sudah disetujui. Tanggal pengajuan bisa satu hari ("2025-07-16")
  // atau rentang ("2025-07-16 s/d 2025-07-20"); keduanya dicek di sini.
  const izinDisetujuiHariIni = (kunci: string) =>
    pengajuanList.some((r) => {
      if (r.status !== "Disetujui") return false;
      if (!String(r.jenis || "").includes(kunci)) return false;
      const t = String(r.tanggal || "");
      if (t.includes(" s/d ")) {
        const [awal, akhir] = t.split(" s/d ");
        return todayISO >= awal.trim() && todayISO <= akhir.trim();
      }
      return t.trim() === todayISO;
    });
  const bolehWFH = izinDisetujuiHariIni("WFH");
  const bolehWFC = izinDisetujuiHariIni("WFC");

  // FUNGSI MENAMPILKAN NOTIFIKASI CANTIK
  // Diarahkan ke toast global standar. Tanda tangan lama (type, message)
  // dipertahankan agar semua pemanggilan showToast(...) tetap jalan.
  const showToast = (type: "success" | "error", message: string) => {
    if (type === "error") toast.gagal(message); else toast.sukses(message);
  };

  useEffect(() => {
    const initializePage = async () => {
      try {
        const sessionStr = localStorage.getItem("invisualUserSession") || 
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
      const { data: todayData } = await supabase.from("attendance").select("*").eq("idKaryawan", safeId).eq("tanggal", todayISO).maybeSingle();
      if (todayData) setTodayAttendance(todayData);

      const { data: absData } = await supabase.from("attendance").select("*").eq("idKaryawan", safeId).order("tanggal", { ascending: false }).limit(5);
      if (absData) setRecentAttendances(absData);

      const { data: reqData } = await supabase.from("approvals").select("*").eq("idKaryawan", safeId).order("id", { ascending: false });
      if (reqData) setPengajuanList(reqData);

      const { data: schedData } = await supabase.from("employees").select("jamMasuk, jamKeluar, fleksibel, toleransiTelat").eq("idKaryawan", safeId).single();
      if (schedData?.jamMasuk) setJamMasuk(schedData.jamMasuk);
      if (schedData?.jamKeluar) setJamKeluar(schedData.jamKeluar);
      setIsFleksibel(schedData?.fleksibel === true);
      if (schedData?.toleransiTelat != null) setToleransiTelat(Number(schedData.toleransiTelat));
      const { data: pgn } = await supabase.from("pengaturan").select("nilai").eq("kunci", "blokir_pulang_telat").maybeSingle();
      setBlokirPulangTelat(pgn?.nilai === "true");
      const { data: geo } = await supabase.from("pengaturan").select("kunci, nilai").in("kunci", ["geofence_aktif", "kantor_lat", "kantor_lng", "kantor_radius"]);
      const gmap: Record<string, string> = {}; (geo || []).forEach((r: any) => { gmap[r.kunci] = r.nilai; });
      setGeofenceAktif(gmap.geofence_aktif === "true");
      setKantorLat(parseFloat(gmap.kantor_lat)); setKantorLng(parseFloat(gmap.kantor_lng)); setKantorRadius(Number(gmap.kantor_radius) || 150);
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
      pushNotify(supabase, { toAdmins: true, title: `Pengajuan ${jenisIzin}`, body: `${currentUser?.nama || "Karyawan"}: ${jenisIzin}${alasan ? " — " + alasan : ""}`, url: "/admin/dashboard", tag: "pengajuan" });
     
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

  const ajukanIzinTelat = async () => {
    if (!currentUser) return;
    setMenyimpanTelat(true);
    const safeId = currentUser.idKaryawan || currentUser.id_karyawan || currentUser.id || "INV-UNKNOWN";
    const req = {
      id: "req-" + Date.now().toString(),
      nama: currentUser.nama || "Karyawan Invisual",
      idKaryawan: safeId,
      jenis: "Izin Terlambat",
      tanggal: todayISO,
      alasan: alasanTelat.trim() || "Terlambat",
      status: "Menunggu",
    };
    try {
      const { error } = await supabase.from("approvals").insert([req]);
      if (error) throw error;
      showToast("success", "Izin keterlambatan diajukan. Menunggu persetujuan.");
      pushNotify(supabase, { toAdmins: true, title: "Izin Terlambat", body: `${currentUser?.nama || "Karyawan"} mengajukan izin terlambat${alasanTelat ? " — " + alasanTelat : ""}`, url: "/admin/dashboard", tag: "pengajuan" });
      setPromptTelat(false); setAlasanTelat("");
    } catch (e: any) {
      showToast("error", "Gagal mengajukan: " + (e?.message || e));
    } finally {
      setMenyimpanTelat(false);
    }
  };

  const handleClockIn = async () => {
    if (hasCameraPermission === false) return showToast("error", "Izinkan akses kamera di browser Anda!");
    // Geofence: mode Kantor wajib di lokasi kantor. WFH/WFC (sudah disetujui) dilewati.
    if (geofenceAktif && modeKerja === "Kantor") {
      if (!isFinite(kantorLat) || !isFinite(kantorLng)) return showToast("error", "Lokasi kantor belum diatur admin. Hubungi HRD.");
      try {
        const pos = await ambilPosisi();
        const jarak = jarakMeter(pos.lat, pos.lng, kantorLat, kantorLng);
        if (jarak > kantorRadius) return showToast("error", `Anda ~${Math.round(jarak)} m dari kantor (batas ${kantorRadius} m). Absen kantor hanya di lokasi kantor. Untuk WFH/WFC, ajukan lalu pilih modenya.`);
      } catch (e: any) {
        return showToast("error", (e?.message || "Gagal cek lokasi.") + " Absen kantor butuh izin lokasi.");
      }
    }
    // Cek terlambat SEBELUM selfie. Terlambat & belum ada izin telat hari ini → WAJIB isi alasan (modal, tak bisa dilewati).
    const nowCek = new Date();
    const [sHc, sMc] = String(jamMasuk || "09:00").split(":").map(Number);
    const telatCek = (nowCek.getHours() * 60 + nowCek.getMinutes()) > ((sHc || 9) * 60 + (sMc || 0) + toleransiTelat);
    const statusCek = (!isFleksibel && modeKerja === "Kantor" && telatCek) ? "Terlambat" : "Tepat Waktu";
    const safeIdCek = currentUser.idKaryawan || currentUser.id_karyawan || currentUser.id || "INV-UNKNOWN";
    if (statusCek === "Terlambat") {
      const sudahIzin = await cekSudahAdaIzinTelat(safeIdCek);
      if (!sudahIzin) { setWajibTelat(true); return; } // tahan clock-in; buka modal wajib alasan
    }
    await lakukanClockIn(""); // tepat waktu / sudah ada izin → langsung
  };

  const cekSudahAdaIzinTelat = async (safeId: string) => {
    try {
      const { data } = await supabase.from("approvals").select("id").eq("idKaryawan", safeId).eq("tanggal", todayISO).eq("jenis", "Izin Terlambat").limit(1);
      return !!(data && data.length > 0);
    } catch { return false; }
  };

  const lakukanClockIn = async (alasanTelatWajib: string) => {
    if (!currentUser) return;
    setIsActionLoading(true);
    takePhoto(); // ambil foto lalu kamera otomatis mati

    const now = new Date();
    const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const [schedH, schedM] = String(jamMasuk || "09:00").split(":").map(Number);
    const isLate = (now.getHours() * 60 + now.getMinutes()) > ((schedH || 9) * 60 + (schedM || 0) + toleransiTelat);
    // WFH/WFC tidak dihitung terlambat (hanya mode Kantor); jam fleksibel juga tidak.
    const statusKehadiran = (!isFleksibel && modeKerja === "Kantor" && isLate) ? "Terlambat" : "Tepat Waktu";
    const jamPulang = isFleksibel ? null : jamPulangDariClockIn(timeString, jamMasuk, jamKeluar, toleransiTelat);
    const safeId = currentUser.idKaryawan || currentUser.id_karyawan || currentUser.id || "INV-UNKNOWN";

    try {
      const { error } = await supabase.from("attendance").insert([{
        idKaryawan: safeId, nama: currentUser.nama, tanggal: todayISO,
        waktuMasuk: timeString, waktuKeluar: null,
        lokasi: modeKerja === "Kantor" ? "Kantor Invisual (Selfie)" : `${modeKerja} (Selfie)`,
        mode_kerja: modeKerja, status: statusKehadiran,
        jamPulangSeharusnya: jamPulang
      }]);
      if (error) throw error;
      showToast("success", `Clock-In berhasil dicatat pada ${timeString} WIB.`);
      pushNotify(supabase, { toAdmins: true, title: "Absen Masuk", body: `${currentUser?.nama || "Karyawan"} clock-in ${timeString} (${statusKehadiran})`, url: "/admin/kehadiran", tag: "absen" });
      // Terlambat + alasan wajib terisi → otomatis buat pengajuan Izin Terlambat (Menunggu) → masuk antrean manajer.
      if (statusKehadiran === "Terlambat" && alasanTelatWajib.trim()) {
        const req = {
          id: "req-" + Date.now().toString(),
          nama: currentUser.nama || "Karyawan Invisual",
          idKaryawan: safeId,
          jenis: "Izin Terlambat",
          tanggal: todayISO,
          alasan: alasanTelatWajib.trim(),
          status: "Menunggu",
        };
        const { error: e2 } = await supabase.from("approvals").insert([req]);
        if (!e2) pushNotify(supabase, { toAdmins: true, title: "Izin Terlambat", body: `${currentUser?.nama || "Karyawan"} clock-in terlambat ${timeString} — ${alasanTelatWajib.trim()}`, url: "/admin/dashboard", tag: "pengajuan" });
      }
      await fetchDashboardData(safeId);
    } catch (err: any) {
      if (err?.code === "23505") { showToast("info", "Anda sudah tercatat absen masuk hari ini."); await fetchDashboardData(safeId); }
      else showToast("error", "Gagal merekam absensi: " + err.message);
    } finally {
      setIsActionLoading(false);
      setCaptureMode(null); // kembali ke tampilan tombol, kamera tetap mati
      setAlasanWajibTelat("");
    }
  };

  const handleClockOut = async () => {
    if (hasCameraPermission === false) return showToast("error", "Izinkan akses kamera di browser Anda!");
    if (blokirPulangTelat && todayAttendance?.jamPulangSeharusnya) {
      const _n = new Date();
      const _hhmm = `${String(_n.getHours()).padStart(2, '0')}:${String(_n.getMinutes()).padStart(2, '0')}`;
      if (_hhmm < todayAttendance.jamPulangSeharusnya) return showToast("error", `Belum boleh clock-out. Jam wajib pulang Anda ${todayAttendance.jamPulangSeharusnya} WIB.`);
    }
    setIsActionLoading(true);
    takePhoto(); // ambil foto lalu kamera otomatis mati

    const now = new Date();
    const timeString = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const safeId = currentUser.idKaryawan || currentUser.id_karyawan || currentUser.id || "INV-UNKNOWN";
    
    try {
      const { error } = await supabase.from("attendance").update({ waktuKeluar: timeString }).eq("id", todayAttendance.id);
      if (error) throw error;
      showToast("success", `Clock-Out berhasil: ${timeString} WIB. Hati-hati di jalan!`);
      pushNotify(supabase, { toAdmins: true, title: "Absen Pulang", body: `${currentUser?.nama || "Karyawan"} clock-out ${timeString}`, url: "/admin/kehadiran", tag: "absen" });
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
     


      {/* HEADER UTAMA */}
      <div className="flex justify-between items-center bg-white/[0.04] border border-white/10 p-4 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h1 className="font-display text-xl md:text-2xl font-bold text-white tracking-tight">Kehadiran Saya</h1>
          <p className="text-[10px] md:text-xs text-gray-400 mt-1">Halo <span className="text-tint font-bold">{currentUser?.nama}</span>, kelola absen Anda. <span className="inline-flex items-center gap-1 ml-1 text-tint-redup"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Jam kerja {jamMasuk}–{jamKeluar}</span></p>
        </div>
        <button onClick={() => setShowForm(true)} className="relative z-10 bg-primer hover:bg-blue-600 text-white px-4 py-2.5 rounded-xl text-xs md:text-sm font-bold transition-colors whitespace-nowrap active:scale-95">
          Ajukan Izin / Cuti
        </button>
      </div>

      {/* KARTU RINGKASAN */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mo-stagger">
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 md:p-5 shadow-lg mo-lift border-l-4 border-l-green-500">
          <p className="text-[10px] md:text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest truncate">Hadir</p>
          <p className="text-xl md:text-2xl font-black text-white">22 <span className="text-xs font-normal text-gray-400">Hr</span></p>
        </div>
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 md:p-5 shadow-lg mo-lift border-l-4 border-l-yellow-500">
          <p className="text-[10px] md:text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest truncate">Terlambat</p>
          <p className="text-xl md:text-2xl font-black text-white">1 <span className="text-xs font-normal text-gray-400">Hr</span></p>
        </div>
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 md:p-5 shadow-lg mo-lift border-l-4 border-l-red-500">
          <p className="text-[10px] md:text-xs text-gray-500 font-bold mb-1 uppercase tracking-widest truncate">Sakit/Izin</p>
          <p className="text-xl md:text-2xl font-black text-white">0 <span className="text-xs font-normal text-gray-400">Hr</span></p>
        </div>
        <div className="bg-primer/10 border border-primer/30 rounded-2xl p-4 md:p-5 shadow-lg mo-lift border-l-4 border-l-primer">
          <p className="text-[10px] md:text-xs text-tint font-bold mb-1 uppercase tracking-widest truncate">Sisa Cuti</p>
          <p className="text-xl md:text-2xl font-black text-white">{currentUser?.sisaCuti ?? 12} <span className="text-xs font-normal text-gray-400">Hr</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mt-1">
        {/* KIRI: TERMINAL KAMERA ABSENSI */}
        <div onMouseMove={bentoMove} onMouseLeave={bentoLeave} style={bentoGlow} className={`${bentoCls} md:rounded-3xl p-4 md:p-6 flex flex-col`}>
          <h3 className="text-base md:text-lg font-bold text-white mb-3 md:mb-4 border-b border-white/5 pb-3 md:pb-4 flex justify-between items-center">
            Terminal Absensi
            {isAttendanceComplete ? (
              <span className="text-[8px] md:text-[10px] bg-green-500/10 text-green-400 px-2 md:px-3 py-1 rounded-full border border-green-500/20 uppercase tracking-widest flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span> Selesai
              </span>
            ) : todayAttendance?.waktuMasuk ? (
              <span className="text-[8px] md:text-[10px] bg-blue-500/10 text-tint px-2 md:px-3 py-1 rounded-full border border-primer/30 uppercase tracking-widest flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-primer animate-pulse"></span> On Duty
              </span>
            ) : (
              <span className="text-[8px] md:text-[10px] bg-yellow-500/10 text-yellow-400 px-2 md:px-3 py-1 rounded-full border border-yellow-500/20 uppercase tracking-widest flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span> Standby
              </span>
            )}
          </h3>
          
          {todayAttendance?.waktuMasuk && !isAttendanceComplete && todayAttendance?.jamPulangSeharusnya && (
            <div className="mb-4 md:mb-5 -mt-1 flex items-center gap-2 text-[10px] md:text-xs bg-primer/10 border border-primer/20 rounded-lg px-3 py-2">
              <span className="text-gray-400">Jam wajib pulang:</span>
              <span className="text-tint font-bold font-mono">{todayAttendance.jamPulangSeharusnya} WIB</span>
              {blokirPulangTelat && <span className="text-[9px] text-yellow-400 ml-auto text-right">Clock-out dikunci s/d jam ini</span>}
            </div>
          )}

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
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 bg-latar">
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
              /* Kamera aktif → pilih lokasi (khusus masuk), lalu ambil foto */
              <div className="flex flex-col gap-2.5">
                {captureMode === "in" && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Lokasi kerja</p>
                    <div className="grid grid-cols-3 gap-2">
                      {([
                        { key: "Kantor", label: "Kantor", boleh: true },
                        { key: "WFH", label: "WFH", boleh: bolehWFH },
                        { key: "WFC", label: "WFC", boleh: bolehWFC },
                      ] as const).map((opt) => {
                        const aktif = modeKerja === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            disabled={!opt.boleh}
                            onClick={() => setModeKerja(opt.key)}
                            title={opt.boleh ? undefined : `Pengajuan ${opt.label} hari ini belum disetujui`}
                            className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                              aktif
                                ? "bg-primer text-white border-primer"
                                : opt.boleh
                                  ? "bg-white/[0.03] text-gray-300 border-white/10 hover:border-white/20"
                                  : "bg-white/[0.02] text-gray-600 border-white/5 cursor-not-allowed"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {(!bolehWFH && !bolehWFC) && (
                      <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">WFH/WFC aktif hanya bila pengajuan hari ini sudah disetujui HRD.</p>
                    )}
                  </div>
                )}
              <div className="flex gap-2.5">
                <button
                  onClick={captureMode === "in" ? handleClockIn : handleClockOut}
                  disabled={isActionLoading || !cameraOn}
                  className={`flex-1 text-white font-bold py-3.5 md:py-4 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 disabled:opacity-50 text-xs md:text-sm ${captureMode === "in" ? "bg-primer hover:bg-blue-600" : "bg-magenta hover:bg-magenta"}`}
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
              </div>
            ) : !todayAttendance ? (
              /* Belum clock-in → tombol memulai (kamera muncul saat diklik) */
              <button onClick={() => startCapture("in")} className="w-full bg-primer hover:bg-blue-600 text-white font-bold py-3.5 md:py-4 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 text-xs md:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 md:w-5 md:h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.822 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                CLOCK IN
              </button>
            ) : (
              /* Sudah clock-in, belum clock-out → tombol memulai clock-out */
              <button onClick={() => startCapture("out")} className="w-full bg-magenta/10 hover:bg-magenta text-magenta hover:text-white border border-magenta/30 font-bold py-3.5 md:py-4 rounded-xl md:rounded-2xl transition-all flex justify-center items-center gap-2 text-xs md:text-sm">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 md:w-5 md:h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.822 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" /></svg>
                CLOCK OUT
              </button>
            )}
          </div>
        </div>

        {/* KANAN: STATUS PENGAJUAN */}
        <div onMouseMove={bentoMove} onMouseLeave={bentoLeave} style={bentoGlow} className={`${bentoCls} md:rounded-3xl p-4 md:p-6 flex flex-col`}>
          <h3 className="text-base md:text-lg font-bold text-white mb-4 border-b border-white/5 pb-4">Status Pengajuan Saya</h3>
         
          <div className="flex-1 overflow-y-auto max-h-80 custom-scrollbar pr-1">
            {pengajuanList.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs md:text-sm">Belum ada riwayat pengajuan izin/cuti.</div>
            ) : (
              <div className="flex flex-col gap-3 mo-stagger">
                {pengajuanList.map((req) => (
                  <div key={req.id} className="bg-kartu border border-white/5 p-3 md:p-4 rounded-xl flex items-center justify-between gap-2 hover:bg-white/5 mo-lift">
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
          
          <div className="relative bg-latar border border-white/10 w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 md:zoom-in-95 duration-300">

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
                <select value={jenisIzin} onChange={(e) => setJenisIzin(e.target.value)} className="w-full bg-kartu border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primer focus:ring-1 focus:ring-primer/50 outline-none transition-all shadow-inner">
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
                    <input type="date" required value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} className="w-full bg-kartu border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primer outline-none transition-all shadow-inner [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-tint mb-1.5 uppercase tracking-widest">Est. Sampai</label>
                    <input type="time" required value={estimasiSampai} onChange={(e) => setEstimasiSampai(e.target.value)} className="w-full bg-primer/10 border border-primer/30 rounded-xl px-4 py-3 text-sm text-white focus:border-primer outline-none transition-all shadow-inner [color-scheme:dark]" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Tgl Mulai</label>
                    <input type="date" required value={tanggalMulai} onChange={(e) => setTanggalMulai(e.target.value)} className="w-full bg-kartu border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primer outline-none transition-all shadow-inner [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Tgl Selesai</label>
                    <input type="date" value={tanggalSelesai} onChange={(e) => setTanggalSelesai(e.target.value)} className="w-full bg-kartu border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primer outline-none transition-all shadow-inner [color-scheme:dark]" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1.5 uppercase tracking-widest">Keterangan Singkat</label>
                <textarea required rows={3} value={alasan} onChange={(e) => setAlasan(e.target.value)} placeholder="Tuliskan keterangan detail di sini..." className="w-full bg-kartu border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-primer focus:ring-1 focus:ring-primer/50 outline-none transition-all shadow-inner resize-none custom-scrollbar" />
              </div>

              {jenisIzin === "Izin Sakit" && (
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5 animate-in fade-in">
                  <label className="block text-xs font-bold text-red-400 mb-2 uppercase tracking-wide flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg> Wajib Surat Dokter</label>
                  <input type="file" required accept="image/*,.pdf" onChange={(e) => setSuratDokter(e.target.files?.[0]?.name || "")} className="w-full text-sm text-gray-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-red-500/10 file:text-red-400 hover:file:bg-red-500/20 cursor-pointer transition-colors" />
                </div>
              )}

              <div className="pt-2 flex gap-3">
                <button type="submit" disabled={isSubmitting} className="w-full py-4 text-xs font-bold text-white uppercase tracking-widest bg-primer hover:bg-blue-600 rounded-xl transition-colors disabled:opacity-50 active:scale-[0.98]">
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

      {promptTelat && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => !menyimpanTelat && setPromptTelat(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-kartu p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white">Anda tercatat terlambat</h3>
            <p className="mt-1.5 text-[12px] text-gray-400 leading-relaxed">Ajukan izin keterlambatan agar atasan bisa menyetujui <span className="text-tint font-semibold">pulang jam normal (18:00)</span>. Tanpa izin yang disetujui, jam pulang wajib mengikuti +9 jam dari clock-in.</p>
            <textarea value={alasanTelat} onChange={(e) => setAlasanTelat(e.target.value)} rows={3} placeholder="Alasan keterlambatan (mis. macet, ada urusan keluarga)…" className="mt-3 w-full bg-input border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primer resize-none" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setPromptTelat(false); setAlasanTelat(""); }} disabled={menyimpanTelat} className="rounded-lg px-4 py-2 text-sm font-bold text-gray-400 hover:text-white disabled:opacity-50">Lewati</button>
              <button onClick={ajukanIzinTelat} disabled={menyimpanTelat} className="rounded-lg bg-primer px-4 py-2 text-sm font-bold text-white hover:bg-primer-terang disabled:opacity-50">{menyimpanTelat ? "Mengirim…" : "Ajukan Izin Terlambat"}</button>
            </div>
          </div>
        </div>
      )}

      {/* WAJIB: clock-in dalam kondisi terlambat harus isi alasan (tak bisa dilewati) */}
      {wajibTelat && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-kartu p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-amber-400"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
              Anda Terlambat
            </h3>
            <p className="mt-1.5 text-[12px] text-gray-400 leading-relaxed">Absen masuk Anda melewati jam masuk. <span className="text-amber-300 font-semibold">Alasan keterlambatan wajib diisi</span> untuk melanjutkan clock-in. Pengajuan izin terlambat otomatis dibuat dan jam wajib pulang mengikuti +9 jam dari sekarang (atasan dapat menyetujui pulang jam normal).</p>
            <textarea value={alasanWajibTelat} onChange={(e) => setAlasanWajibTelat(e.target.value)} rows={3} autoFocus placeholder="Alasan keterlambatan (mis. macet, ada urusan keluarga)…" className="mt-3 w-full bg-input border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primer resize-none" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setWajibTelat(false); setAlasanWajibTelat(""); setCaptureMode(null); }} disabled={isActionLoading} className="rounded-lg px-4 py-2 text-sm font-bold text-gray-400 hover:text-white disabled:opacity-50">Batal</button>
              <button onClick={async () => { if (!alasanWajibTelat.trim()) return showToast("error", "Alasan keterlambatan wajib diisi."); setWajibTelat(false); await lakukanClockIn(alasanWajibTelat); }} disabled={isActionLoading || !alasanWajibTelat.trim()} className="rounded-lg bg-primer px-4 py-2 text-sm font-bold text-white hover:bg-primer-terang disabled:opacity-50">{isActionLoading ? "Memproses…" : "Clock-In & Ajukan Izin"}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
