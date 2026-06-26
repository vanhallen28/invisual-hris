// src/app/(auth)/logout/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      // 1. Hancurkan sesi lokal (Local Storage)
      localStorage.removeItem("invisual_session");

      // 2. Hancurkan sesi Supabase (Sangat penting untuk Google Auth)
      await supabase.auth.signOut();
      
      // 3. Arahkan kembali ke halaman Gerbang Login
      router.replace("/login");
    };

    // Eksekusi pemutusan setelah jeda 1 detik agar pengguna sempat membaca teks
    const timer = setTimeout(() => {
      performLogout();
    }, 1200);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center flex-col relative overflow-hidden">
      
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-[#2b5cd5]/10 rounded-full blur-[100px]"></div>
      
      <div className="relative z-10 flex flex-col items-center justify-center animate-in fade-in duration-500">
        <img src="/invisual-light.svg" alt="Invisual" className="h-10 brightness-0 invert opacity-50 mb-8" />
        
        <div className="w-10 h-10 border-4 border-white/10 border-t-[#2b5cd5] rounded-full animate-spin mb-6 shadow-[0_0_15px_rgba(43,92,213,0.3)]"></div>
        
        <h2 className="text-white font-bold text-lg tracking-wide mb-1">Memutuskan Sesi Akses...</h2>
        <p className="text-xs text-gray-500 font-medium">Sistem sedang mengenkripsi ulang jalur masuk Anda.</p>
      </div>
      
    </div>
  );
}