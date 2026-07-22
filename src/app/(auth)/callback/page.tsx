// src/app/auth/callback/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";

export default function AuthCallbackPage() {
  const toast = useToast();
  const router = useRouter();
  const [statusText, setStatusText] = useState("Memverifikasi akun Google Anda...");

  // DAFTAR PUTIH EMAIL ADMIN (WHITELIST) - Harus sama dengan yang di halaman login
  const ADMIN_EMAILS = [
    "business@invisual.studio",
    "hr@invisual.studio",
    "admin@invisual.studio"
  ];

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // 1. Ambil data user yang baru saja sukses login dari Google
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user || !user.email) {
          throw new Error("Gagal mengambil sesi identitas dari Google.");
        }

        setStatusText("Mencocokkan email dengan Database Invisual...");

        // 2. Cocokkan email Google-nya dengan tabel employees di Supabase
        const { data: emp, error: dbError } = await supabase
          .from("employees")
          .select("*")
          .eq("email", user.email.toLowerCase())
          .single();

        if (dbError || !emp) {
          // Jika email Google tidak terdaftar di database karyawan, paksa logout!
          await supabase.auth.signOut();
          toast.gagal(`Email ${user.email} tidak terdaftar. Hubungi admin.`);
          router.replace("/login");
          return;
        }

        if (!emp.isAktif) {
          await supabase.auth.signOut();
          toast.gagal("Akun nonaktif. Status kepegawaian dinonaktifkan.");
          router.replace("/login");
          return;
        }

        // 3. Filter Peran (Role) menggunakan Whitelist
        const userEmail = emp.email.toLowerCase();
        const isAdmin = ADMIN_EMAILS.includes(userEmail);
        const role = isAdmin ? "admin" : "karyawan";

        // 4. Simpan sesi terenkripsi ke lokal browser agar halaman lain tahu siapa yang sedang login
        localStorage.setItem("invisual_session", JSON.stringify({ ...emp, role }));

        setStatusText("Otentikasi berhasil! Mengalihkan ke ruang kerja...");

        // 5. Lempar ke halaman dashboard masing-masing sesuai role murni
        if (isAdmin) {
          router.replace("/admin/dashboard");
        } else {
          router.replace("/user/dashboard");
        }

      } catch (error: any) {
        console.error("Auth Callback Error:", error.message);
        router.replace("/login");
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden select-none">
      {/* Efek pendaran latar belakang */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#2b5cd5]/10 rounded-full blur-[100px]"></div>
      
      <div className="relative z-10 flex flex-col items-center text-center animate-in fade-in duration-500">
        {/* Spinner Loading Mewah */}
        <div className="w-12 h-12 border-4 border-white/10 border-t-[#2b5cd5] rounded-full animate-spin mb-6 shadow-[0_0_20px_rgba(43,92,213,0.2)]"></div>
        
        <h2 className="text-white font-black text-xl tracking-tight mb-2">Mengamankan Sesi Portal</h2>
        <p className="text-xs text-gray-500 font-mono tracking-wide uppercase bg-white/5 px-3 py-1 rounded-full border border-white/5">
          {statusText}
        </p>
      </div>
    </div>
  );
}