// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg("Gagal terhubung ke Google: " + err.message);
      setIsGoogleLoading(false);
    }
  };

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      const inputEmail = email.trim().toLowerCase();

      // 1. OTENTIKASI SUPABASE
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: inputEmail,
        password: password,
      });

      if (authError) throw new Error("Kredensial tidak valid. Periksa kembali email & password Anda.");

      // 2. MENGAMBIL NAMA ASLI DARI DATABASE AGAR TIDAK MENJADI "TAMU"
      const { data: empData } = await supabase
        .from("employees")
        .select("nama, idKaryawan, jabatan")
        .eq("email", inputEmail)
        .single();

      const namaUser = empData?.nama || "Karyawan Invisual";
      const idKaryawan = empData?.idKaryawan || "ID-UNKNOWN";
      const jabatan = empData?.jabatan || "Staff";

      const isAdmin = inputEmail.endsWith("@invisual.studio");

      // 3. SIMPAN KE MEMORI LOKAL DENGAN DATA LENGKAP
      localStorage.setItem("invisual_session", JSON.stringify({ 
        email: inputEmail, 
        role: isAdmin ? "admin" : "karyawan",
        nama: namaUser,
        idKaryawan: idKaryawan,
        jabatan: jabatan
      }));

      // 4. CEK PASSWORD DEFAULT (= ID Karyawan) → WAJIB GANTI DULU
      const pakaiPassDefault =
        !!empData?.idKaryawan && password.trim() === String(empData.idKaryawan).trim();

      if (pakaiPassDefault) {
        await supabase.auth.updateUser({ data: { must_change_password: true } });
        window.location.href = "/ganti-password";
        return;
      }

      // 5. ARAHKAN (HARD REDIRECT)
      if (isAdmin) {
        window.location.href = "/admin/dashboard";
      } else {
        window.location.href = "/user/dashboard";
      }

    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex relative overflow-hidden text-gray-300 select-none">
      <div className="absolute top-[-15%] right-[-10%] w-96 h-96 bg-[#2b5cd5]/10 rounded-full blur-[100px] animate-pulse"></div>
      <div className="absolute bottom-[-15%] left-[-10%] w-96 h-96 bg-purple-500/5 rounded-full blur-[120px]"></div>

      <div className="hidden lg:flex w-1/2 relative bg-[#0d0f14] border-r border-white/[0.03] items-center justify-center overflow-hidden z-10">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.01] mix-blend-overlay"></div>
        <div className="relative z-10 p-16 xl:p-24 text-center flex flex-col items-center">
          <img src="/invisual-light.svg" alt="Invisual Studio" className="h-12 xl:h-14 mb-8 brightness-0 invert opacity-90 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]" style={{ width: 'auto' }} />
          <h1 className="text-4xl xl:text-5xl font-black text-white mb-4 tracking-tight leading-tight">Human Resource <br/>Information System</h1>
          <p className="text-gray-500 text-sm xl:text-base leading-relaxed max-w-sm">Portal premium terenkripsi untuk pengelolaan absensi, rekapitulasi payroll, dan automasi data karyawan Invisual Studio.</p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-md relative z-10 animate-in fade-in duration-500">
          <div className="flex justify-center lg:hidden mb-10"><img src="/invisual-light.svg" alt="Invisual Studio" className="h-9 brightness-0 invert" style={{ width: 'auto' }} /></div>
          <div className="mb-8 text-center lg:text-left pl-1 lg:pl-2">
            <h2 className="text-3xl font-black text-white tracking-tight">Selamat Datang</h2>
            <p className="text-gray-400 text-sm mt-2.5 leading-relaxed">Autentikasi akun Anda untuk masuk ke ruang kerja digital Invisual Studio.</p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/5 border border-red-500/10 text-red-400 text-sm px-4 py-3 rounded-2xl mb-6 flex items-center gap-3">
              <span className="font-medium leading-relaxed">{errorMsg}</span>
            </div>
          )}

          <div className="space-y-5">
            <button type="button" onClick={handleGoogleLogin} disabled={isGoogleLoading || isLoading} className="w-full py-4 bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.98]">
              {isGoogleLoading ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div> : <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.33 0 3.327 2.682 1.386 6.591l3.88 3.174z"/><path fill="#4285F4" d="M23.682 12.273c0-.818-.073-1.609-.209-2.373H12v4.509h6.555a5.61 5.61 0 0 1-2.432 3.687l3.782 2.932c2.209-2.036 3.777-5.036 3.777-8.755z"/><path fill="#FBBC05" d="M5.266 14.235L1.386 17.41A11.944 11.944 0 0 0 12 24c3.055 0 5.79-.991 7.91-2.695l-3.782-2.932a7.11 7.11 0 0 1-4.128 1.155c-3.118 0-5.836-2.127-6.734-5.293z"/><path fill="#34A853" d="M1.386 6.591A11.895 11.942 0 0 0 12 24c3.055 0 5.79-.991 7.91-2.695l-3.782-2.932a7.11 7.11 0 0 1-4.128 1.155c-3.118 0-5.836-2.127-6.734-5.293z"/></svg>}
              {isGoogleLoading ? "Menghubungkan..." : "Masuk dengan Akun Google"}
            </button>

            <div className="flex items-center my-6">
              <div className="flex-1 h-[1px] bg-white/[0.05]"></div><span className="text-[10px] font-black text-gray-600 px-4 uppercase tracking-widest">Or</span><div className="flex-1 h-[1px] bg-white/[0.05]"></div>
            </div>

            <form onSubmit={handleManualLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Alamat Email</label>
                <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@domain.com" className="w-full bg-[#111217] border border-white/[0.04] focus:border-[#2b5cd5] rounded-2xl px-4 py-4 text-sm text-white focus:ring-1 focus:ring-[#2b5cd5]/30 outline-none transition-all placeholder-gray-700 shadow-inner" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Password</label>
                <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Kata sandi (ID Karyawan)..." className="w-full bg-[#111217] border border-white/[0.04] focus:border-[#2b5cd5] rounded-2xl px-4 py-4 text-sm text-white focus:ring-1 focus:ring-[#2b5cd5]/30 outline-none transition-all placeholder-gray-700 shadow-inner" />
              </div>
              <button type="submit" disabled={isLoading || isGoogleLoading} className="w-full py-4 mt-2 bg-white/5 hover:bg-white/10 text-white text-sm font-bold rounded-2xl transition-all border border-white/10 flex items-center justify-center gap-2 active:scale-[0.98]">
                {isLoading ? "Memvalidasi..." : "Masuk Manual"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}