// src/app/user/profil/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { generatePayslip } from "@/utils/generatePayslip"; 
import LoadingLogo from "@/components/LoadingLogo"; // 🔥 INI KUNCI UNTUK MEMANGGIL KOMPONEN ANDA

export default function UserProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false); // State Loading PDF
  const [userEmail, setUserEmail] = useState<string>("");
  const [showGaji, setShowGaji] = useState(false);

  useEffect(() => {
    const initializeProfile = async () => {
      try {
        const sessionStr = localStorage.getItem("invisualUserSession") || 
                           sessionStorage.getItem("invisualUserSession") || 
                           localStorage.getItem("invisual_session");

        if (sessionStr && sessionStr !== "null" && sessionStr !== "undefined") {
          const user = JSON.parse(sessionStr);
          const userData = Array.isArray(user) ? user[0] : user;

          if (userData && userData.email) {
            setUserEmail(userData.email);
            await fetchEmployeeData(userData.email);
          } else {
            window.location.href = "/login";
          }
        } else {
          window.location.href = "/login";
        }
      } catch (e) {
        console.error("Gagal membaca sesi profil:", e);
        window.location.href = "/login";
      }
    };
    initializeProfile();
  }, []);

  const fetchEmployeeData = async (email: string) => {
    try {
      const { data, error } = await supabase.from("employees").select("*").eq("email", email).single();
      if (error) throw error;
      if (data) {
        setProfile(data);
        localStorage.setItem("invisualUserSession", JSON.stringify(data));
      }
    } catch (error) {
      console.error("Gagal menarik data database:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!userEmail) return;
    const channel = supabase.channel('realtime-profil-karyawan')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'employees' }, (payload) => {
          if (payload.new.email === userEmail) {
            setProfile(payload.new);
            localStorage.setItem("invisualUserSession", JSON.stringify(payload.new));
          }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userEmail]);

  // 🔥 FUNGSI PEMICU UNDUH PDF
  const handleDownloadSlip = () => {
    if (!profile) return;
    setIsGenerating(true);
    
    // Memberikan jeda animasi sedikit agar terasa prosesnya
    setTimeout(() => {
      generatePayslip(profile);
      setIsGenerating(false);
    }, 1500);
  };

  const formatRupiah = (angka: number) => {
    if (!angka) return "Rp 0";
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(angka);
  };

  const calculateMasaKerja = (joinDateString: string) => {
    if (!joinDateString || joinDateString === "") return "Belum ditentukan";
    const joinDate = new Date(joinDateString);
    const now = new Date();
    if (isNaN(joinDate.getTime())) return "Format Invalid";
    let years = now.getFullYear() - joinDate.getFullYear();
    let months = now.getMonth() - joinDate.getMonth();
    if (months < 0) { years--; months += 12; }
    if (years === 0 && months === 0) return "Pegawai Baru";
    return `${years > 0 ? years + " Thn " : ""}${months > 0 ? months + " Bln" : ""}`.trim();
  };

  // 🔥 PERBAIKAN: MEMANGGIL KOMPONEN CUSTOM LOADING LOGO ANDA
  if (isLoading || !profile) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-4 text-gray-400">
        <LoadingLogo size={72} text="Menarik Data Profil..." />
      </div>
    );
  }

  const names = profile.nama.split(" ");
  let initials = names[0].charAt(0);
  if (names.length > 1) initials += names[1].charAt(0);

  return (
    <div className="w-full flex flex-col gap-6 pb-10 font-sans animate-in fade-in duration-500">
      
      {/* HEADER PROFIL */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 mb-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Detail Profil</h1>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">Data sinkronisasi HR Invisual.</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-[9px] md:text-[10px] text-green-400 font-bold uppercase tracking-widest">Live Sync Aktif</span>
        </div>
      </div>

      {/* BANNER PROFIL KARYAWAN */}
      <div className="bg-[#141414] border border-white/5 rounded-3xl p-6 shadow-xl relative overflow-hidden mt-2">
        <div className="absolute top-0 left-0 right-0 h-24 bg-[#1a1a22]"></div>
        <div className="relative z-10 flex flex-col md:flex-row gap-5 items-center md:items-start mt-8">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-[#2b5cd5] p-1 shrink-0">
            <div className="w-full h-full bg-[#111111] rounded-full flex items-center justify-center font-black text-3xl md:text-4xl text-white">
              {initials.toUpperCase()}
            </div>
          </div>
          <div className="text-center md:text-left flex-1 mt-2">
            <h1 className="text-2xl md:text-3xl font-black text-white">{profile.nama}</h1>
            <p className="text-[#b3c5ff] font-bold text-xs md:text-sm tracking-widest uppercase mt-1 truncate">{profile.jabatan || profile.departemen || "Karyawan Invisual"}</p>
            <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-4">
              <span className="bg-white/5 border border-white/10 px-3 py-1 rounded-full text-xs text-gray-300 font-mono">ID: {profile.idKaryawan || "-"}</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider
                ${profile.status === 'PKWT (Kontrak)' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 
                  profile.status === 'Tetap' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 
                  'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                {profile.status || "Aktif"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
        
        {/* KARTU KIRI: PRIBADI */}
        <div className="bg-[#141414] border border-white/5 rounded-3xl p-5 md:p-6 shadow-xl hover:border-white/10 transition-colors h-max">
          <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
             <div className="p-2 bg-[#2b5cd5]/10 rounded-lg text-[#2b5cd5]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" /></svg>
             </div>
             <h2 className="text-base md:text-lg font-bold text-white tracking-wide">Identitas Pribadi</h2>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">Email</p>
              <p className="text-sm text-gray-200 bg-[#0a0a0a] border border-white/5 px-3 py-2.5 rounded-lg truncate">{profile.email || "-"}</p>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">No. WhatsApp</p>
              <p className="text-sm text-gray-200 bg-[#0a0a0a] border border-white/5 px-3 py-2.5 rounded-lg truncate">{profile.noPonsel || "-"}</p>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">NIK KTP</p>
              <p className="text-sm text-gray-200 font-mono bg-[#0a0a0a] border border-white/5 px-3 py-2.5 rounded-lg truncate">{profile.nikKtp || "-"}</p>
            </div>
            <div>
              <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">Domisili</p>
              <p className="text-xs md:text-sm text-gray-300 leading-relaxed bg-[#0a0a0a] border border-white/5 px-3 py-2.5 rounded-lg break-words">{profile.alamatDomisili || "-"}</p>
            </div>
          </div>
        </div>

        {/* KANAN: KEPEGAWAIAN & FINANSIAL */}
        <div className="flex flex-col gap-5 md:gap-6">
          <div className="bg-[#141414] border border-white/5 rounded-3xl p-5 md:p-6 shadow-xl hover:border-white/10 transition-colors">
            <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
               <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.084-.768 2.028-1.838 2.171l-1.528.203c-1.18.156-2.394.23-3.634.23-1.24 0-2.453-.074-3.633-.23l-1.529-.203A2.25 2.25 0 016.25 18.4V14.15M6.25 14.15l-3.32-3.32m0 0l3.32-3.32m-3.32 3.32h14.5M20.25 14.15l3.32-3.32m0 0l-3.32-3.32" /></svg>
               </div>
               <h2 className="text-base md:text-lg font-bold text-white tracking-wide">Data Kepegawaian</h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">Mulai Gabung</p>
                <p className="text-xs md:text-sm text-gray-200 truncate">{profile.tanggalBergabung || "-"}</p>
                <p className="text-[9px] md:text-[10px] text-[#2b5cd5] font-bold mt-1 truncate">🕒 {calculateMasaKerja(profile.tanggalBergabung)}</p>
              </div>
              <div className="bg-[#2b5cd5]/10 border border-[#2b5cd5]/20 p-2.5 rounded-xl text-center">
                <p className="text-[9px] md:text-[10px] font-bold text-[#b3c5ff] uppercase tracking-wider mb-1 truncate">Sisa Cuti</p>
                <p className="text-xl md:text-2xl text-white font-black">{profile.sisaCuti !== undefined ? profile.sisaCuti : 12}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#141414] border border-white/5 rounded-3xl p-5 md:p-6 shadow-xl hover:border-white/10 transition-colors">
             <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
               <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               </div>
               <h2 className="text-base md:text-lg font-bold text-white tracking-wide">Data Finansial & Gaji</h2>
            </div>
            <div className="space-y-4">
              
              {/* Info Gaji Pokok (Tutup/Buka) */}
              <div className="bg-green-500/5 border border-green-500/10 p-3 rounded-xl flex justify-between items-center transition-colors">
                <div className="overflow-hidden pr-2">
                  <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">Gaji Pokok Utama</p>
                  <p className={`text-sm md:text-lg text-green-400 font-bold transition-all duration-300 truncate`}>
                    {showGaji ? formatRupiah(profile.gajipokok || profile.gajiPokok || 0) : "Rp ••••••••"}
                  </p>
                </div>
                <button 
                  onClick={() => setShowGaji(!showGaji)} 
                  className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500 hover:text-white transition-colors cursor-pointer"
                  title={showGaji ? "Sembunyikan Gaji" : "Lihat Gaji"}
                >
                  {showGaji ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>

              <div>
                <p className="text-[9px] md:text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 truncate">Informasi Rekening Transfer</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="bg-white text-black font-black uppercase px-2 py-1 rounded text-[9px] md:text-[10px] shrink-0">
                    {profile.namaBank || "BANK"}
                  </span>
                  <span className="text-xs md:text-sm text-white font-mono tracking-widest truncate">
                    {profile.noRekening || "—"}
                  </span>
                </div>
              </div>

              {/* 🔥 TOMBOL GENERATE PDF SLIP GAJI */}
              <div className="pt-5 mt-5 border-t border-white/5">
                <button 
                  onClick={handleDownloadSlip} 
                  disabled={isGenerating}
                  className="w-full bg-[#2b5cd5] hover:bg-blue-600 px-4 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? (
                    <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  )}
                  <span className="text-xs md:text-sm font-bold text-white uppercase tracking-widest">
                    {isGenerating ? "Mencetak Dokumen..." : "Unduh Slip Gaji (PDF)"}
                  </span>
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}