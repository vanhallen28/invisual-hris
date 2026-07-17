// src/app/admin/layout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatPage = !!pathname && pathname.includes('/chat'); // Chat = full-screen (sembunyikan header & bottom-nav)
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const doLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("invisual_session");
    window.location.href = "/login";
  };

  const navItems = [
    { name: "Dasbor", href: "/admin/dashboard", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /> },
    { name: "Kehadiran", href: "/admin/kehadiran", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    { name: "Karyawan", href: "/admin/karyawan", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /> },
    { name: "Payroll", href: "/admin/payroll", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /> },
    { name: "Daily Task", short: "Task", href: "/admin/daily-task", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /> },
  { name: "Chat", short: "Chat", href: "/admin/chat", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /> },
  { name: "Corporate Vault", short: "Vault", href: "/admin/corporate", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /> },
  { name: "Log Aktivitas", short: "Log", href: "/admin/audit", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /> },
  { name: "Pengaturan", short: "Akun", href: "/admin/pengaturan", icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></> },
  ];

  // 🔐 Wajib ganti password default sebelum memakai portal
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (data?.user?.user_metadata?.must_change_password === true) {
        window.location.href = "/ganti-password";
      }
    }).catch(() => { /* offline / request dibatalkan saat pindah halaman — abaikan */ });
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-screen bg-[#000000] text-gray-200 flex flex-col md:flex-row font-sans">

      {/* HEADER MOBILE (admin) — logo + subtitle, seragam dengan portal karyawan */}
      <header className={`${isChatPage ? "hidden" : ""} md:hidden w-full bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-5 py-4 sticky top-0 z-[99] flex items-center justify-between shadow-sm`}>
        <div className="flex flex-col items-start justify-center">
          <img src="/invisual-light.svg" alt="Invisual Studio" className="h-[22px] brightness-0 invert opacity-90 object-contain" style={{ width: "auto" }} />
          <p className="text-[7.5px] font-black text-gray-500 uppercase tracking-widest mt-1.5 font-mono leading-none">Human Resource Information System</p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <Link href="/admin/pengaturan" title="Pengaturan Akun" className="w-8 h-8 rounded-full bg-[#124bce]/10 text-[#b3c5ff] flex items-center justify-center font-black text-[10px] border border-[#124bce]/20 shadow-inner active:scale-90 transition-transform">HR</Link>
          <button onClick={() => setShowLogoutModal(true)} aria-label="Keluar" className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center active:scale-90 transition-transform cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
          </button>
        </div>
      </header>

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 border-r border-white/10 bg-[#0a0a0a] min-h-screen shrink-0 sticky top-0">
        
        {/* PERBAIKAN LOGOTYPE: Tampil Rata Kiri & Subtitle HRIS */}
        <div className="py-8 px-6 border-b border-white/10 flex flex-col items-start justify-center">
          <img src="/invisual-light.svg" alt="Invisual Studio" className="h-8 brightness-0 invert opacity-90 transition-transform hover:scale-105" style={{ width: "auto" }} />
          <p className="text-[10px] font-medium text-gray-400 mt-2 tracking-wide">
            Human Resource & Internal Information System
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.filter((item) => item.href !== "/admin/pengaturan").map((item) => {
            const isActive = item.href === "/admin/corporate" ? (pathname === item.href || pathname.startsWith(item.href + "/")) : pathname === item.href;
            return (
              <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${isActive ? "bg-white text-black shadow-lg" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">{item.icon}</svg>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <Link href="/admin/pengaturan" title="Pengaturan" className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${pathname === "/admin/pengaturan" ? "bg-[#124bce] text-white" : "text-gray-500 hover:text-white hover:bg-white/5"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </Link>
        </div>
      </aside>

      {/* AREA KONTEN UTAMA */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <div className="p-4 md:p-8 flex-1 w-full max-w-7xl mx-auto">
          <div key={pathname} className={isChatPage ? "" : "page-fade"}>
            {children}
          </div>
        </div>
      </main>

      {/* BOTTOM NAVIGATION MOBILE */}
      <div className={`${isChatPage ? "hidden" : ""} md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/90 backdrop-blur-md border-t border-white/10 z-[100] px-2 py-3 pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.5)]`}>
        <div className="flex justify-around items-center">
          {navItems.filter((item) => item.href !== "/admin/pengaturan" && item.href !== "/admin/audit" && item.href !== "/admin/corporate" && item.href !== "/admin/daily-task").map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href} className={`relative flex flex-col items-center gap-1 py-1 transition-colors duration-300 ${isActive ? "text-[#124bce]" : "text-gray-500 hover:text-gray-300"}`}>
                <span className={`flex items-center justify-center w-11 h-9 rounded-2xl transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] ${isActive ? "bg-[#124bce]/15 -translate-y-1 scale-105" : "translate-y-0 scale-100"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={isActive ? 2.5 : 2} stroke="currentColor" className="w-6 h-6">{item.icon}</svg>
                </span>
                <span className={`text-[9px] font-bold transition-transform duration-300 ${isActive ? "-translate-y-0.5" : "translate-y-0"}`}>{(item as any).short || item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
      

      {showLogoutModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#0f0f0f] border border-white/10 w-full max-w-xs rounded-2xl p-6 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-500"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
            </div>
            <h2 className="text-lg font-bold text-white mb-1.5">Keluar Panel HRD?</h2>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">Sesi admin akan diakhiri. Anda perlu login kembali untuk masuk.</p>
            <div className="flex gap-2.5">
              <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl transition-all text-xs border border-white/10 cursor-pointer">Batal</button>
              <button onClick={doLogout} className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all text-xs cursor-pointer">Ya, Keluar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
