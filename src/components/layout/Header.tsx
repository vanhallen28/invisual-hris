// src/components/layout/Header.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Header() {
  const [userName, setUserName] = useState("Memuat...");
  const [userInitial, setUserInitial] = useState("-");
  const [userRole, setUserRole] = useState("KARYAWAN");

  useEffect(() => {
    const getSession = () => {
      const ls = localStorage.getItem("invisualUserSession");
      const ss = sessionStorage.getItem("invisualUserSession");
      const session = ss || ls;

      if (session && session !== "null" && session !== "undefined") {
        try {
          const parsed = JSON.parse(session);
          const user = Array.isArray(parsed) ? parsed[0] : parsed;
          
          if (user && user.nama) {
            setUserName(user.nama);
            // Ambil inisial
            const names = user.nama.split(" ");
            let initials = names[0].charAt(0);
            if (names.length > 1) initials += names[1].charAt(0);
            setUserInitial(initials.toUpperCase());
            
            if (user.role === "admin" || user.idKaryawan === "ADMIN") {
              setUserRole("ADMIN / HRD");
            } else {
              setUserRole("EMPLOYEE");
            }
          }
        } catch (e) {
          console.error("Gagal membaca sesi untuk Header:", e);
        }
      } else {
        setUserName("Tamu");
        setUserInitial("?");
        setUserRole("TIDAK LOGIN");
      }
    };

    getSession();
    window.addEventListener('storage', getSession);
    return () => window.removeEventListener('storage', getSession);
  }, []);

  // FUNGSI LOGOUT YANG AKAN MENGHAPUS SESI DAN MELEMPAR KEMBALI KE LOGIN
  const handleLogout = () => {
    localStorage.removeItem("invisualUserSession");
    sessionStorage.removeItem("invisualUserSession");
    window.location.href = "/login";
  };

  return (
    <header className="h-20 bg-[#141414] border-b border-white/5 flex items-center justify-between px-8 sticky top-0 z-50">
      <Link href="/">
        <Image
          src="/invisual-light.svg"
          alt="Invisual Logo"
          width={160}
          height={40}
          className="h-7 brightness-0 invert"
          style={{ width: "auto" }}
        />
      </Link>

      <div className="flex items-center gap-6">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-bold text-white">{userName}</p>
          <p className="text-[10px] text-[#2b5cd5] font-black tracking-widest uppercase">{userRole}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#2b5cd5] flex items-center justify-center text-white font-bold shadow-[0_0_15px_rgba(43,92,213,0.4)] border border-[#b3c5ff]/30">
          {userInitial}
        </div>

        <div className="w-px h-8 bg-white/10 mx-2"></div>

        {/* TOMBOL LOGOUT HEADER */}
        <button onClick={handleLogout} className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors group">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 group-hover:-translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-widest hidden md:block">Keluar</span>
        </button>
      </div>
    </header>
  );
}