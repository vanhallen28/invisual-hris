// src/components/layout/SidebarUser.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SidebarUser() {
  const pathname = usePathname();

  // FUNGSI LOGOUT
  const handleLogout = () => {
    localStorage.removeItem("invisualUserSession");
    sessionStorage.removeItem("invisualUserSession");
    window.location.href = "/login";
  };

  return (
    <aside className="w-64 bg-[#0a0a0a] border-r border-white/5 hidden md:flex flex-col">
      <div className="p-6">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Portal Karyawan</p>
        <nav className="flex flex-col gap-2">
          <Link href="/user/dashboard" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/user/dashboard' ? 'bg-[#2b5cd5] text-white font-bold shadow-[0_0_15px_rgba(43,92,213,0.3)]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" /></svg>
            Beranda Absensi
          </Link>
          <Link href="/user/kehadiran" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/user/kehadiran' ? 'bg-[#2b5cd5] text-white font-bold shadow-[0_0_15px_rgba(43,92,213,0.3)]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Kehadiran Saya
          </Link>
          {/* MENU PROFIL YANG HILANG KINI KEMBALI */}
          <Link href="/user/profil" className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/user/profil' ? 'bg-[#2b5cd5] text-white font-bold shadow-[0_0_15px_rgba(43,92,213,0.3)]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
            Profil Karyawan
          </Link>
        </nav>
      </div>
      
      {/* TOMBOL LOGOUT MERAH DI BAWAH SIDEBAR */}
      <div className="mt-auto p-6 border-t border-white/5">
         <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-bold transition-all border border-red-500/20 shadow-lg">
           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
           KELUAR SISTEM
         </button>
      </div>
    </aside>
  );
}