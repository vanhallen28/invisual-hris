// src/components/layout/SidebarAdmin.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SidebarAdmin() {
  const pathname = usePathname();

  const menuAdmin = [
    { name: "Panel Kontrol", path: "/admin/dashboard", icon: "M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" },
    { name: "Data Karyawan", path: "/admin/karyawan", icon: "M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" },
    { name: "Laporan Presensi", path: "/admin/kehadiran", icon: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
    { name: "Manajemen Payroll", path: "/admin/payroll", icon: "M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5h16.5c.621 0 1.125.504 1.125 1.125v12.375c0 .621-.504 1.125-1.125 1.125H3.75a1.125 1.125 0 0 1-1.125-1.125V5.625C2.625 5.004 3.129 4.5 3.75 4.5Z" },
  ];

  return (
    <aside className="w-64 bg-[#141414] border-r border-white/5 p-6 flex flex-col hidden md:flex">
      <div className="mb-4 px-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Menu HRD / Admin</div>
      <nav className="flex flex-col gap-1.5">
        {menuAdmin.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link key={item.name} href={item.path} className={`flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all ${isActive ? "bg-[#2b5cd5] text-white font-semibold" : "text-gray-400 hover:text-white hover:bg-white/5 font-medium"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              <span className="text-sm tracking-wide">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}