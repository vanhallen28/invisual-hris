// src/app/admin/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: "Dasbor", href: "/admin/dashboard", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /> },
    { name: "Kehadiran", href: "/admin/kehadiran", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { name: "Karyawan", href: "/admin/karyawan", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /> },
    { name: "Payroll", href: "/admin/payroll", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /> },
  ];

  return (
    <div className="min-h-screen bg-[#000000] text-gray-200 flex flex-col md:flex-row font-sans">
      
      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/10 bg-[#0a0a0a] min-h-screen shrink-0 sticky top-0">
        
        {/* PERBAIKAN LOGOTYPE: Tampil Rata Kiri & Subtitle HRIS */}
        <div className="py-8 px-6 border-b border-white/10 flex flex-col items-start justify-center">
          <img src="/invisual-light.svg" alt="Invisual Studio" className="h-8 brightness-0 invert opacity-90 transition-transform hover:scale-105" style={{ width: "auto" }} />
          <p className="text-[10px] font-medium text-gray-400 mt-2 tracking-wide">
            Human Resource Information System
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive ? "bg-white text-black shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">{item.icon}</svg>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* AREA KONTEN UTAMA */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <div className="p-4 md:p-8 flex-1 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* BOTTOM NAVIGATION MOBILE */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/10 z-[100] px-2 py-3 pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        <div className="flex justify-around items-center">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href} className={`flex flex-col items-center gap-1.5 transition-all p-2 rounded-xl ${isActive ? "text-white bg-white/10" : "text-gray-500 hover:text-gray-300"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={isActive ? 2.5 : 2} stroke="currentColor" className="w-6 h-6">{item.icon}</svg>
                <span className="text-[9px] font-bold">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
      
    </div>
  );
}