// src/components/layout/BottomNavUser.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function BottomNavUser() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#141414]/90 backdrop-blur-xl border-t border-white/5 pb-safe z-50">
      <div className="flex justify-around items-center h-16 px-6">
        <Link href="/user/dashboard" className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${pathname === '/user/dashboard' ? 'text-[#2b5cd5]' : 'text-gray-500 hover:text-gray-300'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M11.47 3.84a.75.75 0 011.06 0l8.99 8.99a.75.75 0 01-1.06 1.06l-4.62-4.62V21a.75.75 0 01-.75.75h-3v-4.5a.75.75 0 00-.75-.75h-1.5a.75.75 0 00-.75.75V21h-3a.75.75 0 01-.75-.75V9.27l-4.62 4.62a.75.75 0 01-1.06-1.06l8.99-8.99z" /></svg>
          <span className="text-[10px] font-bold">Beranda</span>
        </Link>
        
        <Link href="/user/kehadiran" className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${pathname === '/user/kehadiran' ? 'text-[#2b5cd5]' : 'text-gray-500 hover:text-gray-300'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z" clipRule="evenodd" /></svg>
          <span className="text-[10px] font-bold">Kehadiran</span>
        </Link>

        {/* MENU PROFIL UNTUK MOBILE */}
        <Link href="/user/profil" className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${pathname === '/user/profil' ? 'text-[#2b5cd5]' : 'text-gray-500 hover:text-gray-300'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" /></svg>
          <span className="text-[10px] font-bold">Profil</span>
        </Link>
      </div>
    </nav>
  );
}