// src/app/user/layout.tsx
"use client";




import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Avatar from "@/components/Avatar";




export default function UserLayout({ children }: { children: React.ReactNode }) {
const pathname = usePathname();
  const isChatPage = !!pathname && pathname.includes('/chat'); // Chat = full-screen (sembunyikan header & bottom-nav)
const [userName, setUserName] = useState("Memuat...");
const [userAvatar, setUserAvatar] = useState("");
const [userRole, setUserRole] = useState("Staff");
const [showLogoutModal, setShowLogoutModal] = useState(false);
const [isManager, setIsManager] = useState(false);




useEffect(() => {
  // 🛡️ BACA SEMUA KEMUNGKINAN KUNCI SESI (ANTI-TENDANG)
  const sessionStr = localStorage.getItem("invisualUserSession") ||
                     sessionStorage.getItem("invisualUserSession") ||
                     localStorage.getItem("invisual_session");




  if (sessionStr && sessionStr !== "null" && sessionStr !== "undefined") {
    try {
      const parsed = JSON.parse(sessionStr);
      const userData = Array.isArray(parsed) ? parsed[0] : parsed;
      if (userData && userData.nama) {
        setUserName(userData.nama);
        setUserRole(userData.jabatan || userData.departemen || "Staff");
        setUserAvatar(userData.avatarUrl || "");
      }
    } catch (e) {
      console.error("Gagal membaca tiket sesi", e);
    }
  }
}, []);





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

  // Role tracker (member/manager) → sembunyikan Daily Task di mobile bagi manager.
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(async ({ data }) => {
      const uid = data?.user?.id;
      if (!uid) return;
      const { data: mem } = await supabase.from("members").select("role").eq("id", uid).single();
      if (alive && mem?.role === "manager") setIsManager(true);
      // Avatar terbaru langsung dari DB — tak bergantung sesi localStorage lama.
      const { data: emp } = await supabase.from("employees").select("avatarUrl").eq("user_id", uid).maybeSingle();
      if (alive && emp?.avatarUrl) setUserAvatar(emp.avatarUrl);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

const openLogoutConfirmation = () => setShowLogoutModal(true);




const executeLogout = async () => {
  setShowLogoutModal(false);
  // HAPUS SEMUA KUNCI AGAR BERSIH
  localStorage.removeItem("invisualUserSession");
  sessionStorage.removeItem("invisualUserSession");
  localStorage.removeItem("invisual_session");
  sessionStorage.clear();
  await supabase.auth.signOut();
  window.location.href = "/login";
};




const navItems = [
  { name: "Dasbor", href: "/user/dashboard", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /> },
  { name: "Absen", href: "/user/kehadiran", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /> },
  { name: "Profil", href: "/user/profil", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /> },
  { name: "Daily Task", short: "Task", href: "/user/daily-task", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" /> },
  { name: "Chat", short: "Chat", href: "/user/chat", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /> },
];




return (
  <div className="min-h-screen bg-[#000000] text-gray-200 flex flex-col md:flex-row font-sans selection:bg-[#124bce] selection:text-white">
  
    {/* 📱 HEADER MOBILE (MINIMALIST) */}
    <header className={`${isChatPage ? "hidden" : ""} md:hidden w-full bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-5 py-4 sticky top-0 z-[99] flex items-center justify-between shadow-sm`}>
      <div className="flex flex-col items-start justify-center">
        <img src="/invisual-light.svg" alt="Invisual Studio" className="h-[22px] brightness-0 invert opacity-90 object-contain text-left" style={{ width: "auto" }} />
        <p className="text-[7.5px] font-black text-gray-500 uppercase tracking-widest mt-1.5 font-mono leading-none text-left">
          Human Resource Information System
        </p>
      </div>
      <div className="flex items-center gap-2.5 shrink-0">
        <Avatar url={userAvatar} name={userName} className="w-8 h-8 rounded-full bg-[#124bce]/10 text-[#b3c5ff] flex items-center justify-center font-black text-[11px] border border-[#124bce]/20 shadow-inner" />
        <button onClick={openLogoutConfirmation} aria-label="Keluar" className="w-8 h-8 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center active:scale-90 transition-transform cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
        </button>
      </div>
    </header>




    {/* 💻 SIDEBAR DESKTOP */}
    <aside className="hidden md:flex flex-col w-64 border-r border-white/10 bg-[#0a0a0a] min-h-screen shrink-0 sticky top-0 z-50">
      <div className="py-8 px-6 border-b border-white/10 flex flex-col items-start justify-center w-full">
        <img src="/invisual-light.svg" alt="Invisual Studio" className="h-[32px] brightness-0 invert opacity-90 object-contain text-left transition-transform hover:scale-105" style={{ width: "auto" }} />
        <p className="text-[8.5px] font-black text-gray-500 uppercase tracking-widest mt-2 leading-tight font-mono text-left">
          Human Resource Information System
        </p>
      </div>




      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.name} href={item.href} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all font-medium text-sm ${isActive ? "bg-[#124bce] text-white shadow-[0_0_15px_rgba(18,75,206,0.4)] border border-white/10" : "text-gray-400 hover:text-white hover:bg-white/5"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">{item.icon}</svg>
              {item.name}
            </Link>
          );
        })}
      </nav>




      <div className="p-4 border-t border-white/10">
        <div className="bg-[#111111] border border-white/5 rounded-xl p-3 flex items-center justify-between shadow-inner">
          <div className="overflow-hidden pr-2 flex-1">
            <p className="text-sm font-bold text-white truncate">{userName}</p>
            <p className="text-[10px] text-gray-500 font-mono truncate">{userRole}</p>
          </div>
          <button onClick={openLogoutConfirmation} title="Keluar" className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white flex items-center justify-center transition-all shrink-0 cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 ml-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
          </button>
        </div>
      </div>
    </aside>




    <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0 bg-[#000000]">
      <div className="p-5 md:p-8 flex-1 w-full max-w-6xl mx-auto">
        <div key={pathname} className={isChatPage ? "" : "page-fade"}>
          {children}
        </div>
      </div>
    </main>




    {/* 📱 BOTTOM NAV MOBILE */}
    <div className={`${isChatPage ? "hidden" : ""} md:hidden fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/5 z-[100] px-3 py-2.5 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.8)]`}>
      <div className="flex justify-between items-center gap-1">
        {navItems.filter((item) => !(isManager && item.href === "/user/daily-task")).map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link key={item.name} href={item.href} className={`relative flex flex-col items-center flex-1 gap-1 py-1 transition-colors duration-300 ${isActive ? "text-[#124bce]" : "text-gray-500 hover:text-gray-300"}`}>
              <span className={`flex items-center justify-center w-10 h-9 rounded-2xl transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] ${isActive ? "bg-[#124bce]/15 -translate-y-1 scale-105" : "translate-y-0 scale-100"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={isActive ? 2.5 : 2} stroke="currentColor" className="w-[20px] h-[20px]">{item.icon}</svg>
              </span>
              <span className={`text-[9px] font-bold tracking-wide transition-transform duration-300 ${isActive ? "-translate-y-0.5" : "translate-y-0"}`}>{(item as any).short || item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>




    {/* 🔥 MODAL LOGOUT KUSTOM */}
    {showLogoutModal && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="bg-[#111111] border border-white/10 w-full max-w-sm rounded-3xl shadow-2xl p-8 relative flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-5 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-7 h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Keluar Portal Karyawan?</h2>
          <p className="text-sm text-gray-400 mb-8 leading-relaxed">Sesi kerja Anda akan ditutup. Anda harus masuk kembali untuk menggunakan sistem.</p>
          <div className="flex w-full gap-3">
            <button onClick={() => setShowLogoutModal(false)} className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold rounded-xl transition-all text-xs border border-white/10 cursor-pointer">
              Batal
            </button>
            <button onClick={executeLogout} className="flex-1 py-3.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] text-xs cursor-pointer">
              Ya, Keluar
            </button>
          </div>
        </div>
      </div>
    )}
  </div>
);
}
