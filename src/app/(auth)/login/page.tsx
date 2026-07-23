// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// Akun Owner: setara admin (role tetap "admin" agar lolos penjaga dashboard),
// TAPI tanpa akses Reset Absensi (kartu Reset disembunyikan lewat penanda isOwner).
const OWNER_EMAILS = ["dea@invisual.studio", "riza@invisual.studio", "tryan@invisual.studio"];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 💡 Lampu gantung — default MATI. Form hanya muncul saat lampu dinyalakan.
  const [lampOn, setLampOn] = useState(false);
  const [pulling, setPulling] = useState(false);
  const toggleLamp = () => {
    setPulling(true);
    setLampOn((v) => !v);
    setTimeout(() => setPulling(false), 500);
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

      // 2. AMBIL DATA KARYAWAN
      const { data: empData } = await supabase
        .from("employees")
        .select("nama, idKaryawan, jabatan")
        .eq("email", inputEmail)
        .single();

      const namaUser = empData?.nama || "Karyawan Invisual";
      const idKaryawan = empData?.idKaryawan || "ID-UNKNOWN";
      const jabatan = empData?.jabatan || "Staff";

      const isAdmin = inputEmail.endsWith("@invisual.studio");

      // 3. SIMPAN SESI LOKAL
      localStorage.setItem("invisual_session", JSON.stringify({
        email: inputEmail,
        role: isAdmin ? "admin" : "karyawan",
        isOwner: OWNER_EMAILS.includes(inputEmail),
        nama: namaUser,
        idKaryawan: idKaryawan,
        jabatan: jabatan,
      }));

      // 4. CEK PASSWORD DEFAULT (= ID Karyawan) → WAJIB GANTI DULU
      const pakaiPassDefault =
        !!empData?.idKaryawan && password.trim() === String(empData.idKaryawan).trim();

      if (pakaiPassDefault) {
        await supabase.auth.updateUser({ data: { must_change_password: true } });
        window.location.href = "/ganti-password";
        return;
      }

      // 5. ARAHKAN
      window.location.href = isAdmin ? "/admin/dashboard" : "/user/dashboard";

    } catch (err: any) {
      const msg = String(err?.message || "");
      setErrorMsg(
        /failed to fetch|network/i.test(msg)
          ? "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."
          : msg
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex relative overflow-hidden text-gray-300 select-none transition-colors duration-[900ms] ${lampOn ? "bg-latar" : "bg-latar"}`}>

      {/* Aksen latar — ikut meredup saat lampu mati */}
      <div className={`absolute top-[-15%] right-[-10%] w-96 h-96 bg-primer-terang/10 rounded-full blur-[100px] transition-opacity duration-[900ms] ${lampOn ? "opacity-100 animate-pulse" : "opacity-0"}`} />
      <div className={`absolute bottom-[-15%] left-[-10%] w-96 h-96 bg-purple-500/5 rounded-full blur-[120px] transition-opacity duration-[900ms] ${lampOn ? "opacity-100" : "opacity-0"}`} />

      {/* ══ PANEL KIRI (desktop) — hero, ikut gelap saat lampu mati ══ */}
      <div className={`hidden lg:flex w-1/2 relative border-r items-center justify-center overflow-hidden z-10 transition-all duration-[900ms] ${lampOn ? "bg-latar border-white/[0.03] opacity-100" : "bg-latar border-white/[0.01] opacity-[0.14]"}`}>
        <div className="relative z-10 p-16 xl:p-24 text-center flex flex-col items-center">
          <img src="/invisual-light.svg" alt="Invisual Studio" className="h-12 xl:h-14 mb-8 brightness-0 invert opacity-90" style={{ width: "auto" }} />
          <h1 className="text-4xl xl:text-5xl font-black text-white mb-4 tracking-tight leading-tight">Human Resource <br />Information System</h1>
          <p className="text-gray-500 text-sm xl:text-base leading-relaxed max-w-sm">Portal premium terenkripsi untuk pengelolaan absensi, rekapitulasi payroll, dan automasi data karyawan Invisual Studio.</p>
        </div>
      </div>

      {/* ══ PANEL KANAN — lampu + form ══ */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-8 relative">

        {/* Kerucut cahaya */}
        <div className={`lamp-cone ${lampOn ? "is-on" : ""}`} />

        {/* 💡 LAMPU GANTUNG */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center origin-top scale-[0.85] sm:scale-100">
          <div className={`lamp-wire ${lampOn ? "is-on" : ""}`} />
          <div className={`lamp-head ${pulling ? "swing" : ""}`}>
            <div className={`lamp-shade ${lampOn ? "is-on" : ""}`} />
            <div className={`lamp-bulb ${lampOn ? "is-on" : ""}`} />
            <button
              type="button"
              onClick={toggleLamp}
              title={lampOn ? "Tarik untuk matikan" : "Tarik untuk menyalakan"}
              aria-label="Nyalakan atau matikan lampu"
              className={`lamp-cord ${pulling ? "pulling" : ""} ${!lampOn ? "attention" : ""}`}
            >
              <span className="cord-line" />
              <span className="cord-knob" />
            </button>
          </div>
          <span className={`lamp-hint ${lampOn ? "is-hidden" : ""}`}>Tarik talinya</span>
        </div>

        {/* ══ FORM — hanya tampil saat lampu menyala ══ */}
        <div className={`login-panel w-full max-w-sm relative z-20 mt-24 sm:mt-16 ${lampOn ? "is-on" : ""}`}>

          <div className="flex flex-col items-center lg:items-start mb-8">
            <img src="/invisual-light.svg" alt="Invisual Studio" className="h-8 brightness-0 invert opacity-90 mb-2.5" style={{ width: "auto" }} />
            <p className="text-[8px] font-black text-gray-600 uppercase tracking-[0.22em] font-mono">Human Resource Information System</p>
          </div>

          {errorMsg && (
            <div className="bg-red-500/[0.06] border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl mb-5 leading-relaxed">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Alamat Email</label>
              <input
                required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="name@domain.com"
                className="w-full bg-input border border-white/[0.05] focus:border-primer-terang rounded-2xl px-5 py-4 text-sm text-white focus:ring-1 focus:ring-primer-terang/30 outline-none transition-all placeholder-gray-700 shadow-inner"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Password</label>
              <input
                required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata sandi (ID Karyawan)..."
                className="w-full bg-input border border-white/[0.05] focus:border-primer-terang rounded-2xl px-5 py-4 text-sm text-white focus:ring-1 focus:ring-primer-terang/30 outline-none transition-all placeholder-gray-700 shadow-inner"
              />
            </div>

            <button
              type="submit" disabled={isLoading}
              className="w-full py-4 mt-2 bg-primer-terang hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-bold rounded-2xl transition-all border border-blue-400/20 flex items-center justify-center gap-2 active:scale-[0.98] shadow-[0_0_24px_rgba(43,92,213,0.28)]"
            >
              {isLoading ? (
                <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Memvalidasi…</>
              ) : "Masuk"}
            </button>
          </form>

          <p className="text-center text-[10px] text-gray-700 mt-7 leading-relaxed">
            Lupa password? Hubungi tim HR untuk pengaturan ulang.
          </p>
        </div>
      </div>

      {/* 💡 Gaya lampu + form */}
      <style>{`
        .lamp-wire { width: 1px; height: 58px; background: #26272c; transition: background .9s ease; }
        .lamp-wire.is-on { background: #6b7280; }

        .lamp-head { position: relative; transform-origin: 50% -58px; }
        .lamp-head.swing { animation: lampSwing .95s cubic-bezier(.36,.07,.19,.97); }
        @keyframes lampSwing {
          0%   { transform: rotate(0deg); }
          22%  { transform: rotate(3.4deg); }
          45%  { transform: rotate(-2.4deg); }
          68%  { transform: rotate(1.3deg); }
          85%  { transform: rotate(-.5deg); }
          100% { transform: rotate(0deg); }
        }

        .lamp-shade {
          width: 116px; height: 54px;
          background: linear-gradient(180deg, #16171c 0%, #0c0d11 100%);
          border: 1px solid rgba(255,255,255,.04);
          border-radius: 62px 62px 10px 10px / 48px 48px 10px 10px;
          transition: background .9s ease, box-shadow .9s ease, border-color .9s ease;
        }
        .lamp-shade.is-on {
          background: linear-gradient(180deg, #383c46 0%, #24272e 100%);
          border-color: rgba(255,214,153,.2);
          box-shadow: 0 12px 40px rgba(255,205,130,.18);
        }

        .lamp-bulb {
          position: absolute; left: 50%; bottom: -5px; transform: translateX(-50%);
          width: 30px; height: 13px; border-radius: 50%;
          background: #1c1d22;
          transition: background .5s ease, box-shadow .7s ease;
        }
        .lamp-bulb.is-on {
          background: #ffe7b8;
          box-shadow: 0 0 24px 10px rgba(255,206,124,.55), 0 0 64px 26px rgba(255,188,86,.22);
        }

        .lamp-cord {
          position: absolute; top: 100%; right: 14px;
          display: flex; flex-direction: column; align-items: center;
          padding: 0; border: 0; background: none; cursor: pointer;
        }
        .cord-line {
          display: block; width: 1px; height: 36px; background: #3f3f46;
          transition: height .2s cubic-bezier(.34,1.56,.64,1), background .3s ease;
        }
        .cord-knob {
          display: block; width: 7px; height: 7px; border-radius: 9999px; background: #a1a1aa;
          transition: background .25s ease, transform .2s ease;
        }
        .lamp-cord:hover .cord-line { background: #71717a; }
        .lamp-cord:hover .cord-knob { background: #f4f4f5; transform: translateY(2px); }
        .lamp-cord.pulling .cord-line { height: 52px; }
        .lamp-cord.pulling .cord-knob { transform: translateY(3px); }
        .lamp-cord.attention .cord-knob { animation: knobPulse 2.2s ease-in-out infinite; }
        @keyframes knobPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,.22); }
          50%      { box-shadow: 0 0 0 6px rgba(255,255,255,0); }
        }

        .lamp-hint {
          margin-top: 52px;
          font-size: 9px; letter-spacing: .24em; text-transform: uppercase;
          color: #52525b; white-space: nowrap;
          animation: hintPulse 2.4s ease-in-out infinite;
          transition: opacity .5s ease;
        }
        .lamp-hint.is-hidden { opacity: 0; animation: none; }
        @keyframes hintPulse { 0%,100% { opacity:.3 } 50% { opacity:.9 } }

        .lamp-cone {
          position: absolute; top: 104px; left: 50%; transform: translateX(-50%);
          width: 560px; max-width: 150%; height: 70%;
          background: radial-gradient(58% 62% at 50% 0%,
            rgba(255,210,138,.16) 0%, rgba(255,192,96,.055) 45%, transparent 72%);
          clip-path: polygon(43% 0, 57% 0, 100% 100%, 0% 100%);
          filter: blur(8px); opacity: 0; pointer-events: none; z-index: 0;
          transition: opacity .9s ease;
        }
        .lamp-cone.is-on { opacity: 1; }

        /* Form hanya muncul saat lampu menyala */
        .login-panel {
          opacity: 0; transform: translateY(16px) scale(.985);
          pointer-events: none; filter: blur(2px);
          transition: opacity .7s ease .12s, transform .8s cubic-bezier(.16,1,.3,1) .12s, filter .7s ease .12s;
        }
        .login-panel.is-on {
          opacity: 1; transform: translateY(0) scale(1);
          pointer-events: auto; filter: blur(0);
        }
      `}</style>
    </div>
  );
}
