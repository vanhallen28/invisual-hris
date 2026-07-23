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

  // Gerbang logo — menggantikan lampu gantung. Form muncul setelah logo diketuk.
  const [terbuka, setTerbuka] = useState(false);

  const bukaGerbang = () => setTerbuka(true);

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
    <div className={`min-h-screen relative overflow-hidden bg-latar text-gray-300 flex items-center justify-center px-6 py-10 ${terbuka ? "gerbang-terbuka" : ""}`}>

      {/* Halo biru merek — menyala terus, halaman tak pernah terlihat padam */}
      <div className="absolute w-[520px] h-[520px] rounded-full bg-primer-terang/[0.13] blur-[120px] halo-latar pointer-events-none" />

      {/* ══ GERBANG: hanya logo Invisual putih ══ */}
      <button
          type="button"
        onClick={bukaGerbang}
        aria-label="Ketuk untuk membuka halaman masuk"
        className="gerbang"
      >
        {/* Tiga kanal warna dipotong bentuk logo asli, menyatu jadi putih bersih */}
        <span className="logo-set">
          <span className="kanal kanal-r" />
          <span className="kanal kanal-g" />
          <span className="kanal kanal-b" />
          <span className="kanal kanal-putih" />
        </span>
        <span className="gerbang-petunjuk">Ketuk untuk masuk</span>
      </button>

      {/* ══ FORM ══ */}
      <div className="panel-masuk w-full max-w-sm relative z-20">

        <div className="flex flex-col items-center mb-8">
          <img src="/invisual-light.svg" alt="Invisual Studio" className="h-8 brightness-0 invert opacity-95 mb-2.5" style={{ width: "auto" }} />
          <p className="text-[8px] font-black text-gray-600 uppercase tracking-[0.22em] font-mono text-center">Human Resource Information System</p>
        </div>

        {errorMsg && (
          <div className="bg-red-500/[0.06] border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl mb-5 leading-relaxed">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleManualLogin} className="tumpuk-kolom">

          <div className="kolom-fx" style={{ ["--tunda" as any]: "0.06s" }}>
            <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Alamat Email</label>
            <input
              required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              className="w-full bg-transparent text-sm text-white outline-none placeholder-gray-700"
            />
          </div>

          <div className="kolom-fx" style={{ ["--tunda" as any]: "0.14s" }}>
            <label className="block text-[10px] font-black text-gray-500 mb-2 uppercase tracking-widest">Password</label>
            <input
              required type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Kata sandi (ID Karyawan)..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder-gray-700"
            />
          </div>

          <button
            type="submit" disabled={isLoading}
            className="kolom-fx kolom-aksi"
            style={{ ["--tunda" as any]: "0.22s" }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2 text-sm font-bold text-white">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Memvalidasi…
              </span>
            ) : (
              <span className="text-sm font-bold text-white">Masuk</span>
            )}
          </button>
        </form>

        <p className="text-center text-[10px] text-gray-700 mt-7 leading-relaxed">
          Lupa password? Hubungi tim HR untuk pengaturan ulang.
        </p>
      </div>

      <style>{`
        .halo-latar { animation: haloNapas 7s ease-in-out infinite; }
        @keyframes haloNapas {
          0%,100% { opacity: .6; transform: scale(.96); }
          50%     { opacity: 1;  transform: scale(1.06); }
        }

        /* ── GERBANG ── */
        .gerbang {
          position: absolute; z-index: 30; inset: 0; margin: auto;
          width: max-content; height: max-content;
          display: flex; flex-direction: column; align-items: center; gap: 20px;
          background: none; border: 0; padding: 20px 28px; cursor: pointer;
          transition: transform .8s cubic-bezier(.75,-.35,.27,1.4),
                      opacity .5s ease, filter .6s ease;
        }

        /* Empat lapisan sebentuk logo: 3 kanal warna + 1 putih final.
           Semua dipotong oleh /invisual-light.svg, jadi bentuknya logo asli. */
        .logo-set { position: relative; display: block; width: 300px; height: 92px; }
        .kanal {
          position: absolute; inset: 0; display: block;
          -webkit-mask: url(/invisual-light.svg) center / contain no-repeat;
                  mask: url(/invisual-light.svg) center / contain no-repeat;
        }
        .kanal-r, .kanal-g, .kanal-b { mix-blend-mode: screen; }
        .kanal-r { background: #ff2d55; animation: kanalR 1.5s cubic-bezier(.16,1,.3,1) both; }
        .kanal-g { background: #2bff88; animation: kanalG 1.5s cubic-bezier(.16,1,.3,1) both; }
        .kanal-b { background: #2b8cff; animation: kanalB 1.5s cubic-bezier(.16,1,.3,1) both; }

        /* Lapisan putih mengambil alih setelah kanal menyatu — logo akhirnya
           putih bersih dan MENYALA, bukan sisa gradasi warna. */
        .kanal-putih {
          background: #ffffff; opacity: 0;
          filter: drop-shadow(0 0 30px rgba(43,92,213,.45));
          animation: kanalPutih 1.5s ease both;
        }
        @keyframes kanalR {
          0%   { transform: translate(-30px,-9px) scale(1.05); filter: blur(9px); opacity: 0; }
          18%  { opacity: 1; }
          70%  { transform: translate(0,0) scale(1); filter: blur(0); opacity: 1; }
          100% { transform: translate(0,0) scale(1); filter: blur(0); opacity: 0; }
        }
        @keyframes kanalG {
          0%   { transform: translate(26px,8px) scale(.96); filter: blur(9px); opacity: 0; }
          18%  { opacity: 1; }
          70%  { transform: translate(0,0) scale(1); filter: blur(0); opacity: 1; }
          100% { transform: translate(0,0) scale(1); filter: blur(0); opacity: 0; }
        }
        @keyframes kanalB {
          0%   { transform: translate(7px,-24px) scale(1.02); filter: blur(10px); opacity: 0; }
          18%  { opacity: 1; }
          70%  { transform: translate(0,0) scale(1); filter: blur(0); opacity: 1; }
          100% { transform: translate(0,0) scale(1); filter: blur(0); opacity: 0; }
        }
        @keyframes kanalPutih { 0%,58% { opacity: 0; } 78%,100% { opacity: 1; } }

        .gerbang:hover .logo-set { transform: scale(1.05); }
        .logo-set { transition: transform .7s cubic-bezier(.16,1,.3,1); }

        .gerbang-petunjuk {
          font-size: 9px; letter-spacing: .3em; text-transform: uppercase;
          color: rgba(255,255,255,.34); animation: petunjukDenyut 2.6s ease-in-out infinite 1.4s both;
        }
        @keyframes petunjukDenyut { 0%,100% { opacity:.3 } 50% { opacity:.9 } }

        .gerbang-terbuka .gerbang {
          transform: translateY(-180px) scale(.5);
          opacity: 0; filter: blur(6px); pointer-events: none;
        }

        /* ── PANEL FORM ── */
        .panel-masuk {
          opacity: 0; pointer-events: none; transform: translateY(26px);
          transition: opacity .5s ease .1s, transform .7s cubic-bezier(.16,1,.3,1) .1s;
        }
        .gerbang-terbuka .panel-masuk { opacity: 1; pointer-events: auto; transform: translateY(0); }

        /* ── KOLOM MEMUAI (flex 1 → 3, pegas) ── */
        .tumpuk-kolom { display: flex; flex-direction: column; gap: 10px; height: 268px; }
        .kolom-fx {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column; justify-content: center;
          background: var(--color-input); border: 1px solid rgba(255,255,255,.10);
          border-radius: 20px; padding: 14px 20px; overflow: hidden; text-align: left;
          opacity: 0; transform: translateY(16px) scale(.97);
          transition: flex .7s cubic-bezier(.75,-.5,.27,1.55),
                      background .3s ease, border-color .3s ease, box-shadow .3s ease,
                      opacity .45s ease var(--tunda),
                      transform .6s cubic-bezier(.75,-.4,.27,1.5) var(--tunda);
        }
        .gerbang-terbuka .kolom-fx { opacity: 1; transform: translateY(0) scale(1); }
        .kolom-fx:hover, .kolom-fx:focus-within {
          flex: 3; background: var(--color-kartu-hover);
          border-color: rgba(255,255,255,.22); box-shadow: 0 0 26px rgba(43,92,213,.16);
        }
        .kolom-fx:focus-within label { color: var(--color-tint); }

        .kolom-aksi {
          background: var(--color-primer); border-color: rgba(179,197,255,.25);
          align-items: center; cursor: pointer; box-shadow: 0 0 24px rgba(43,92,213,.28);
        }
        .kolom-aksi:hover:not(:disabled) {
          background: var(--color-primer-terang); box-shadow: 0 0 34px rgba(43,92,213,.42);
        }
        .kolom-aksi:disabled { opacity: .55; cursor: not-allowed; }

        @media (max-height: 700px) {
          .tumpuk-kolom { height: auto; }
          .kolom-fx, .kolom-fx:hover, .kolom-fx:focus-within { flex: none; }
        }
        @media (max-width: 420px) { .logo-set { width: 230px; height: 70px; } }

        @media (prefers-reduced-motion: reduce) {
          .gerbang, .panel-masuk, .kolom-fx, .halo-latar, .logo-set,
          .kanal, .gerbang-petunjuk {
            transition-duration: .01ms !important; animation-duration: .01ms !important;
          }
        }
      `}</style>
    </div>
  );
}
