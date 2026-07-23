// src/app/admin/pengaturan/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import LoadingLogo from "@/components/LoadingLogo";
import ResetKaryawanLogin from "@/components/admin/ResetKaryawanLogin";

/* Bagian accordion yang bisa dibuka-tutup */
function Section({ id, open, setOpen, icon, title, subtitle, badge, children }: any) {
  const isOpen = open === id;
  return (
    <div className={`bg-kartu border rounded-2xl overflow-hidden transition-colors ${isOpen ? "border-primer-terang/40" : "border-white/10"} kartu-glow`}>
      <button onClick={() => setOpen(isOpen ? null : id)} className="w-full flex items-center gap-3.5 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isOpen ? "bg-primer-terang/15 text-tint-redup" : "bg-white/5 text-gray-400"}`}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-4.5 h-4.5">{icon}</svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">{title}</p>
            {badge}
          </div>
          <p className="text-[11px] text-gray-500 truncate mt-0.5">{subtitle}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-1 border-t border-white/5">{children}</div>
        </div>
      </div>
    </div>
  );
}

const ICONS = {
  email: <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />,
  lock: <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />,
  user: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />,
  key: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />,
};

export default function PengaturanAkunPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [providers, setProviders] = useState<string[]>([]);
  const [hasPassword, setHasPassword] = useState(false);
  const [open, setOpen] = useState<string | null>("email");

  // email
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<any>(null);
  // password
  const [curPass, setCurPass] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const [passMsg, setPassMsg] = useState<any>(null);
  // nama
  const [name, setName] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user;
        if (!u) { window.location.href = "/login"; return; }
        setUser(u);
        setName(u.user_metadata?.name || "");
        const provs = (u.identities || []).map((i: any) => i.provider);
        setProviders(provs);
        setHasPassword(provs.includes("email"));
      } catch { setEmailMsg({ t: "err", m: "Tidak dapat terhubung ke server." }); }
      setLoading(false);
    })();
  }, []);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setEmailMsg(null);
    const em = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return setEmailMsg({ t: "err", m: "Format email tidak valid." });
    if (em === (user?.email || "").toLowerCase()) return setEmailMsg({ t: "err", m: "Email baru sama dengan email saat ini." });
    setEmailBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: em });
      if (error) throw error;
      setEmailMsg({ t: "ok", m: `Tautan konfirmasi dikirim ke ${em}. Buka email itu untuk menyelesaikan perubahan. Email lama tetap berlaku sampai dikonfirmasi.` });
      setNewEmail("");
    } catch (err: any) { setEmailMsg({ t: "err", m: "Gagal: " + (err?.message || "coba lagi.") }); }
    setEmailBusy(false);
  };

  const submitPass = async (e: React.FormEvent) => {
    e.preventDefault(); setPassMsg(null);
    if (pass.length < 8) return setPassMsg({ t: "err", m: "Password baru minimal 8 karakter." });
    if (pass !== pass2) return setPassMsg({ t: "err", m: "Konfirmasi password tidak cocok." });
    setPassBusy(true);
    try {
      if (hasPassword) {
        if (!curPass) { setPassMsg({ t: "err", m: "Masukkan password saat ini." }); setPassBusy(false); return; }
        const { error: reauth } = await supabase.auth.signInWithPassword({ email: user.email, password: curPass });
        if (reauth) { setPassMsg({ t: "err", m: "Password saat ini salah." }); setPassBusy(false); return; }
      }
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw error;
      setHasPassword(true);
      setProviders((p) => (p.includes("email") ? p : [...p, "email"]));
      setCurPass(""); setPass(""); setPass2("");
      setPassMsg({ t: "ok", m: hasPassword ? "Password berhasil diperbarui." : "Password berhasil dibuat. Kini bisa login dengan email + password." });
    } catch (err: any) { setPassMsg({ t: "err", m: "Gagal: " + (err?.message || "coba lagi.") }); }
    setPassBusy(false);
  };

  const submitName = async (e: React.FormEvent) => {
    e.preventDefault(); setNameMsg(null);
    const nm = name.trim();
    if (nm.length < 2) return setNameMsg({ t: "err", m: "Nama minimal 2 karakter." });
    setNameBusy(true);
    try {
      // metadata (client) + members (server, via API)
      await supabase.auth.updateUser({ data: { name: nm } });
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      await fetch("/api/employees/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ selfName: nm }),
      });
      // perbarui sesi lokal agar header ikut berubah
      try {
        const sess = JSON.parse(localStorage.getItem("invisual_session") || "{}");
        sess.nama = nm; localStorage.setItem("invisual_session", JSON.stringify(sess));
      } catch {}
      setNameMsg({ t: "ok", m: "Nama tampilan berhasil diperbarui." });
    } catch (err: any) { setNameMsg({ t: "err", m: "Gagal: " + (err?.message || "coba lagi.") }); }
    setNameBusy(false);
  };

  if (loading) {
    return <div className="flex min-h-[70vh] items-center justify-center"><LoadingLogo size={64} withRing text="Memuat pengaturan" /></div>;
  }

  const inputCls = "w-full bg-input border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:border-primer-terang outline-none transition-colors placeholder-gray-700";
  const btnCls = "self-start bg-primer-terang hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-all mt-1";
  const Msg = ({ data }: any) => data ? (
    <p className={`text-xs px-3.5 py-2.5 rounded-lg leading-relaxed ${data.t === "ok" ? "text-emerald-300 bg-emerald-500/[0.07] border border-emerald-500/20" : "text-red-400 bg-red-500/[0.06] border border-red-500/20"}`}>{data.m}</p>
  ) : null;

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Pengaturan Akun</h1>
        <p className="text-sm text-gray-500 mt-1">Kelola akun admin dan kredensial login karyawan.</p>
      </div>

      {/* identitas */}
      <div className="p-5 mb-5 flex items-center gap-4 relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 kartu-glow">
        <div className="w-12 h-12 rounded-full bg-primer-terang/10 text-tint flex items-center justify-center font-black text-lg border border-primer-terang/20 shrink-0">
          {(name || user?.email || "A").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-white truncate">{name || "Admin"}</p>
          <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {/* AKUN ADMIN */}
        <Section id="email" open={open} setOpen={setOpen} icon={ICONS.email} title="Ubah Email Login" subtitle="Ganti alamat email untuk masuk">
          <form onSubmit={submitEmail} className="flex flex-col gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-widest">Email Saat Ini</label>
              <input value={user?.email || ""} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-widest">Email Baru</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email.baru@invisual.studio" className={inputCls} />
            </div>
            <Msg data={emailMsg} />
            <button type="submit" disabled={emailBusy} className={btnCls}>{emailBusy ? "Mengirim…" : "Kirim Tautan Konfirmasi"}</button>
          </form>
        </Section>

        <Section id="pass" open={open} setOpen={setOpen} icon={ICONS.lock} title={hasPassword ? "Ubah Password" : "Buat Password"} subtitle={hasPassword ? "Perbarui password akun Anda" : "Buat password agar bisa login tanpa Google"}
          badge={!hasPassword ? <span className="text-[8px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded">Belum ada</span> : null}>
          <form onSubmit={submitPass} className="flex flex-col gap-3">
            {hasPassword && (
              <div>
                <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-widest">Password Saat Ini</label>
                <input type={showPass ? "text" : "password"} value={curPass} onChange={(e) => setCurPass(e.target.value)} placeholder="Password lama" className={inputCls} />
              </div>
            )}
            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-widest">Password Baru</label>
              <input type={showPass ? "text" : "password"} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Minimal 8 karakter" className={inputCls} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-widest">Konfirmasi Password Baru</label>
              <input type={showPass ? "text" : "password"} value={pass2} onChange={(e) => setPass2(e.target.value)} placeholder="Ulangi password baru" className={inputCls} />
            </div>
            <label className="flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={showPass} onChange={(e) => setShowPass(e.target.checked)} className="accent-primer-terang" /> Tampilkan password
            </label>
            <Msg data={passMsg} />
            <button type="submit" disabled={passBusy} className={btnCls}>{passBusy ? "Menyimpan…" : hasPassword ? "Perbarui Password" : "Buat Password"}</button>
          </form>
        </Section>

        <Section id="nama" open={open} setOpen={setOpen} icon={ICONS.user} title="Ubah Nama" subtitle="Nama tampilan Anda di chat & sistem">
          <form onSubmit={submitName} className="flex flex-col gap-3">
            <div>
              <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-widest">Nama Tampilan</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama Anda" className={inputCls} />
            </div>
            <Msg data={nameMsg} />
            <button type="submit" disabled={nameBusy} className={btnCls}>{nameBusy ? "Menyimpan…" : "Simpan Nama"}</button>
          </form>
        </Section>

        {/* MANAJEMEN KARYAWAN */}
        <div className="flex items-center gap-3 mt-4 mb-1">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Manajemen Karyawan</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        <Section id="karyawan" open={open} setOpen={setOpen} icon={ICONS.key} title="Reset Login Karyawan" subtitle="Ubah nama, email, atau password karyawan yang lupa">
          <ResetKaryawanLogin />
        </Section>
      </div>

      <p className="text-center text-[10px] text-gray-700 mt-6">Semua perubahan tersimpan terenkripsi & aman.</p>
    </div>
  );
}
