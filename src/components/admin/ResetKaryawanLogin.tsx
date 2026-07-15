// src/components/admin/ResetKaryawanLogin.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ResetKaryawanLogin() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any>(null);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; m: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("employees")
        .select("idKaryawan, nama, email, user_id")
        .order("nama", { ascending: true });
      setEmployees(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return employees.slice(0, 8);
    return employees
      .filter((e) => `${e.nama} ${e.email} ${e.idKaryawan}`.toLowerCase().includes(ql))
      .slice(0, 8);
  }, [q, employees]);

  const pick = (e: any) => {
    setSelected(e);
    setNewName(e.nama || "");
    setNewEmail(e.email || "");
    setNewPass("");
    setMsg(null);
    setQ("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!selected) return;

    const nameChanged = newName.trim() && newName.trim() !== (selected.nama || "");
    const emailChanged = newEmail.trim().toLowerCase() !== (selected.email || "").toLowerCase();
    const wantName = nameChanged ? newName.trim() : null;
    const wantEmail = emailChanged ? newEmail.trim().toLowerCase() : null;
    const wantPass = newPass.trim() ? newPass.trim() : null;

    if (!wantName && !wantEmail && !wantPass) return setMsg({ t: "err", m: "Ubah nama, email, atau isi password baru dulu." });
    if (wantEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wantEmail)) return setMsg({ t: "err", m: "Format email baru tidak valid." });
    if (wantPass && wantPass.length < 6) return setMsg({ t: "err", m: "Password minimal 6 karakter." });

    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const res = await fetch("/api/employees/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ idKaryawan: selected.idKaryawan, newName: wantName, newEmail: wantEmail, newPassword: wantPass }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Gagal.");

      // perbarui daftar lokal
      if (wantEmail || wantName) {
        setEmployees((list) => list.map((x) => (x.idKaryawan === selected.idKaryawan ? { ...x, ...(wantEmail ? { email: wantEmail } : {}), ...(wantName ? { nama: wantName } : {}) } : x)));
        setSelected((s: any) => ({ ...s, ...(wantEmail ? { email: wantEmail } : {}), ...(wantName ? { nama: wantName } : {}) }));
      }
      setNewPass("");
      setMsg({
        t: "ok",
        m: `Berhasil disimpan.${wantName ? ` Nama: ${wantName}.` : ""}${wantEmail ? ` Email: ${wantEmail}.` : ""}${wantPass ? " Password baru aktif." : ""}`,
      });
    } catch (err: any) {
      setMsg({ t: "err", m: "Gagal: " + (err?.message || "coba lagi.") });
    }
    setBusy(false);
  };

  const inputCls = "w-full bg-[#1c1c1c] border border-white/5 rounded-lg px-4 py-3 text-sm text-white focus:border-[#2b5cd5] outline-none transition-colors placeholder-gray-700";

  return (
    <div>
      {loading ? (
        <p className="text-xs text-gray-600 py-4">Memuat daftar karyawan…</p>
      ) : !selected ? (
        <div>
          <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-widest">Cari Karyawan</label>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik nama, email, atau ID karyawan…" className={inputCls} />
          <div className="mt-2 flex flex-col gap-1">
            {filtered.map((e) => (
              <button key={e.idKaryawan} onClick={() => pick(e)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-left transition-colors border border-transparent hover:border-white/10">
                <div className="w-8 h-8 rounded-full bg-[#2b5cd5]/10 text-[#b3c5ff] flex items-center justify-center font-bold text-xs border border-[#2b5cd5]/20 shrink-0">
                  {(e.nama || "?").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate">{e.nama}</p>
                  <p className="text-[11px] text-gray-500 truncate">{e.email || "— belum ada email —"}</p>
                </div>
                {!e.user_id && <span className="text-[8px] font-bold text-red-300 bg-red-500/15 px-1.5 py-0.5 rounded shrink-0">Tanpa Akun</span>}
              </button>
            ))}
            {filtered.length === 0 && <p className="text-xs text-gray-600 py-3 text-center">Tak ada karyawan yang cocok.</p>}
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex items-center gap-3 bg-[#1a1c23] border border-white/10 rounded-xl px-4 py-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-[#2b5cd5]/10 text-[#b3c5ff] flex items-center justify-center font-bold text-sm border border-[#2b5cd5]/20 shrink-0">
              {(selected.nama || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white font-bold truncate">{selected.nama}</p>
              <p className="text-[11px] text-gray-500">ID: {selected.idKaryawan}</p>
            </div>
            <button type="button" onClick={() => { setSelected(null); setMsg(null); }} className="text-[11px] text-gray-400 hover:text-white px-2 py-1 rounded-lg hover:bg-white/5 shrink-0">
              Ganti
            </button>
          </div>

          {!selected.user_id && (
            <p className="text-xs text-amber-300 bg-amber-500/[0.06] border border-amber-500/20 rounded-lg px-3.5 py-2.5">
              Karyawan ini belum punya akun login. Buat dulu lewat menu Karyawan → Edit.
            </p>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-widest">Nama Lengkap</label>
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nama karyawan" className={inputCls} disabled={!selected.user_id} />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-widest">Email Login</label>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@domain.com" className={inputCls} disabled={!selected.user_id} />
            <p className="text-[10px] text-gray-600 mt-1">Kosongkan/biarkan sama jika hanya ingin reset password.</p>
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-500 mb-1.5 uppercase tracking-widest">Password Baru</label>
            <input type={showPass ? "text" : "password"} value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Kosongkan jika tak diganti (min. 6 karakter)" className={inputCls} disabled={!selected.user_id} />
          </div>

          <label className="flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer select-none">
            <input type="checkbox" checked={showPass} onChange={(e) => setShowPass(e.target.checked)} className="accent-[#2b5cd5]" />
            Tampilkan password
          </label>

          {msg && (
            <p className={`text-xs px-3.5 py-2.5 rounded-lg leading-relaxed ${msg.t === "ok" ? "text-emerald-300 bg-emerald-500/[0.07] border border-emerald-500/20" : "text-red-400 bg-red-500/[0.06] border border-red-500/20"}`}>{msg.m}</p>
          )}

          <button type="submit" disabled={busy || !selected.user_id} className="self-start bg-[#2b5cd5] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition-all mt-1">
            {busy ? "Menyimpan…" : "Simpan Kredensial Baru"}
          </button>
        </form>
      )}
    </div>
  );
}
