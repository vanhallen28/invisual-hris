// src/app/(auth)/ganti-password/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import LoadingLogo from "@/components/LoadingLogo";

export default function GantiPasswordPage() {
  const router = useRouter();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [wajib, setWajib] = useState(false);       // true = dipaksa (password masih default)
  const [idKaryawan, setIdKaryawan] = useState("");
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      let data: any = null;
      try {
        ({ data } = await supabase.auth.getUser());
      } catch {
        setErrorMsg("Tidak dapat terhubung ke server. Periksa koneksi internet Anda.");
        setChecking(false);
        return;
      }
      const user = data?.user;
      if (!user) { router.replace("/login"); return; }
      setEmail(user.email || "");
      setWajib(user.user_metadata?.must_change_password === true);
      try {
        const { data: emp } = await supabase
          .from("employees")
          .select("idKaryawan")
          .eq("email", (user.email || "").toLowerCase())
          .single();
        setIdKaryawan(emp?.idKaryawan ? String(emp.idKaryawan) : "");
      } catch { /* biarkan kosong */ }
      setChecking(false);
    })();
  }, [router]);

  const kembali = () => {
    const isAdmin = email.endsWith("@invisual.studio");
    router.replace(isAdmin ? "/admin/dashboard" : "/user/dashboard");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (pass.length < 8) return setErrorMsg("Password baru minimal 8 karakter.");
    if (pass !== confirm) return setErrorMsg("Konfirmasi password tidak cocok.");
    if (idKaryawan && pass.trim() === idKaryawan.trim())
      return setErrorMsg("Password tidak boleh sama dengan ID Karyawan (password default).");

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: pass,
        data: { must_change_password: false },
      });
      if (error) throw error;

      const isAdmin = email.endsWith("@invisual.studio");
      window.location.href = isAdmin ? "/admin/dashboard" : "/user/dashboard";
    } catch (err: any) {
      setErrorMsg("Gagal mengubah password: " + (err?.message || "coba lagi."));
      setIsLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingLogo size={64} withRing text="Memeriksa sesi" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-gray-200 flex items-center justify-center px-5 py-10 font-sans">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/invisual-light.svg" alt="Invisual" className="h-6 brightness-0 invert opacity-90 mb-2" style={{ width: "auto" }} />
          <p className="text-[8px] font-black text-gray-600 uppercase tracking-widest font-mono">Human Resource Information System</p>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-7 shadow-2xl">
          <h1 className="text-xl font-bold text-white mb-1.5">
            {wajib ? "Ganti Password Anda" : "Ubah Password"}
          </h1>
          <p className="text-xs text-gray-500 leading-relaxed mb-6">
            {wajib
              ? "Anda masih memakai password default (ID Karyawan). Demi keamanan, buat password baru sebelum melanjutkan."
              : "Buat password baru untuk akun Anda."}
          </p>

          {wajib && (
            <div className="flex items-start gap-2.5 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl px-4 py-3 mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-amber-400 shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.19-1.458-1.517-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                Password default mudah ditebak rekan kerja. Wajib diganti sekali.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Password Baru</label>
              <input
                type={show ? "text" : "password"}
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Minimal 8 karakter"
                className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:border-[#2b5cd5] outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 mb-1.5 uppercase">Konfirmasi Password Baru</label>
              <input
                type={show ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Ulangi password baru"
                className="w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:border-[#2b5cd5] outline-none transition-colors"
              />
            </div>

            <label className="flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="accent-[#2b5cd5]" />
              Tampilkan password
            </label>

            {errorMsg && (
              <p className="text-xs text-red-400 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2.5">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#2b5cd5] hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-bold rounded-lg py-3 transition-all shadow-[0_0_18px_rgba(43,92,213,0.35)] mt-1"
            >
              {isLoading ? "Menyimpan…" : "Simpan Password Baru"}
            </button>

            {!wajib && (
              <button type="button" onClick={kembali} className="w-full text-xs text-gray-500 hover:text-gray-300 py-2 transition-colors">
                Batal, kembali ke portal
              </button>
            )}
          </form>
        </div>

        <p className="text-center text-[10px] text-gray-700 mt-6">
          Password disimpan terenkripsi. Tim HR tidak dapat melihatnya.
        </p>
      </div>
    </div>
  );
}
